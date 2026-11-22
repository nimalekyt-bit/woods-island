//! Independent HyperX Cloud III / Cloud II Core telemetry codec.
//! Wire facts: HyperXWM, HyperHeadset and Wireless-Device-Battery-Monitor.
//! These GETs use the normal receiver channel; no audio mode switch or reset.

pub(super) const REPORT_ID: u8 = 0x66;

#[derive(Clone, Copy)]
pub(super) struct Model {
    pub name: &'static str,
    core: bool,
}

pub(super) fn model(vid: u16, pid: u16) -> Option<Model> {
    if vid != 0x03f0 {
        return None;
    }
    match pid {
        0x05b7 | 0x0c9d => Some(Model {
            name: "HyperX Cloud III Wireless",
            core: false,
        }),
        0x069f | 0x0995 => Some(Model {
            name: "HyperX Cloud II Core Wireless",
            core: true,
        }),
        _ => None,
    }
}

impl Model {
    pub fn accepts(self, page: u16, input: u16, output: u16) -> bool {
        input == output
            && if self.core {
                page >= 0xff00 && matches!(input, 62 | 64)
            } else {
                input == 62
            }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Query {
    Connection,
    Charging,
    Battery,
}

impl Query {
    fn command(self) -> u8 {
        match self {
            Self::Connection => 0x82,
            Self::Charging => 0x8a,
            Self::Battery => 0x89,
        }
    }

    pub fn request(self, size: usize) -> Option<Vec<u8>> {
        if !matches!(size, 62 | 64) {
            return None;
        }
        let mut frame = vec![0; size];
        frame[0] = REPORT_ID;
        frame[1] = self.command();
        Some(frame)
    }

    pub fn value(self, frame: &[u8]) -> Option<u8> {
        // Numbered Windows reports retain 66 in byte zero. A zero radio/charge
        // status with zero padding is valid. A battery GET echo has neither
        // voltage nor percentage data and must not become an invented 0%.
        let request = self.request(frame.len())?;
        if frame[..2] != request[..2] || self == Self::Battery && frame == request {
            return None;
        }
        let value = frame[if self == Self::Battery { 4 } else { 2 }];
        (value <= if self == Self::Battery { 100 } else { 1 }).then_some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reply(query: Query, value: u8) -> Vec<u8> {
        let mut frame = query.request(62).unwrap();
        if query == Query::Battery {
            // Voltage bytes accompanying a real direct percentage. They are
            // not converted to a percentage or used to infer charging.
            frame[2..4].copy_from_slice(&[0x0e, 0x10]);
        }
        frame[if query == Query::Battery { 4 } else { 2 }] = value;
        frame
    }

    #[test]
    fn exact_models_and_report_shapes_exclude_other_headset_protocols() {
        for pid in [0x05b7, 0x0c9d, 0x069f, 0x0995] {
            assert!(model(0x03f0, pid).is_some());
        }
        assert!(model(0x0951, 0x0c9d).is_none());
        for pid in [0x06be, 0x098d, 0x08be, 0x0ab5, 0x0696] {
            assert!(model(0x03f0, pid).is_none());
        }
        let cloud = model(0x03f0, 0x0c9d).unwrap();
        assert!(cloud.accepts(0xff13, 62, 62));
        assert!(!cloud.accepts(0xff13, 64, 64));
        let core = model(0x03f0, 0x069f).unwrap();
        assert!(core.accepts(0xff00, 64, 64));
        assert!(!core.accepts(1, 64, 64));
        assert!(!core.accepts(0xff00, 62, 64));
    }

    #[test]
    fn direct_percentage_and_charging_are_independent_including_zero() {
        for percent in [0, 1, 50, 100] {
            assert_eq!(
                Query::Battery.value(&reply(Query::Battery, percent)),
                Some(percent)
            );
        }
        for query in [Query::Connection, Query::Charging] {
            for value in [0, 1] {
                assert_eq!(query.value(&reply(query, value)), Some(value));
            }
            assert_eq!(query.value(&reply(query, 2)), None);
            assert_eq!(query.value(&reply(query, 255)), None);
        }
        assert_eq!(Query::Battery.value(&reply(Query::Battery, 101)), None);
        assert_eq!(Query::Battery.value(&reply(Query::Charging, 1)), None);
    }

    #[test]
    fn incomplete_unrelated_and_unnumbered_frames_are_rejected() {
        for query in [Query::Connection, Query::Charging, Query::Battery] {
            let expected = if query == Query::Battery {
                None
            } else {
                Some(0)
            };
            assert_eq!(query.value(&query.request(62).unwrap()), expected);
            assert_eq!(query.value(&query.request(64).unwrap()), expected);
            for size in [0, 1, 2, 5, 61, 63, 65, 4096] {
                assert_eq!(query.value(&vec![0; size]), None);
                assert!(query.request(size).is_none());
            }
            let mut frame = reply(query, 1);
            frame[0] = 0;
            assert_eq!(query.value(&frame), None);
        }
        assert_eq!(Query::Battery.request(62).unwrap()[..2], [0x66, 0x89]);
    }
}
