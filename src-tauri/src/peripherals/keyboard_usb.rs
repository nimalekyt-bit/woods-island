//! Independent read-only SONiX and Semico status frames.
//! Descriptor and protocol facts are linked from docs/peripheral-support.md.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Protocol {
    Sonix,
    Semico,
}
impl Protocol {
    pub fn source(self) -> &'static str {
        match self {
            Self::Sonix => "sonix",
            Self::Semico => "semico",
        }
    }
    pub fn size(self) -> usize {
        match self {
            Self::Sonix => 33,
            Self::Semico => 65,
        }
    }
    pub fn request(self) -> Vec<u8> {
        let mut frame = vec![0; self.size()];
        match self {
            Self::Sonix => {
                frame[1] = 0x20;
                frame[2] = 1;
                frame[32] = 0x21;
            }
            Self::Semico => frame[1..6].copy_from_slice(&[0xaa, 0x55, 0xcc, 0x33, 0x0e]),
        }
        frame
    }
    pub fn reply(self, frame: &[u8]) -> Option<Reading> {
        if frame.len() != self.size() || frame[0] != 0 {
            return None;
        }
        match self {
            Self::Sonix => {
                if frame[1..3] != [0x20, 1]
                    || frame[32] != frame[1..32].iter().fold(0u8, |sum, b| sum.wrapping_add(*b))
                {
                    return None;
                }
                // Zero is also used for off/out-of-range/other-mode, not confirmed empty battery.
                Some(Reading {
                    percent: (1..=100).contains(&frame[4]).then_some(frame[4]),
                    connected: None,
                })
            }
            Self::Semico => {
                if frame[1..6] != [0xaa, 0x55, 0xcc, 0x33, 0x0e] || frame[7] > 3 {
                    return None;
                }
                Some(Reading {
                    percent: (frame[7] != 0 && frame[6] <= 100).then_some(frame[6]),
                    connected: Some(frame[7] != 0),
                })
            }
        }
    }
}
pub(super) struct Reading {
    pub percent: Option<u8>,
    pub connected: Option<bool>,
}
pub(super) fn identify(
    vid: u16,
    pid: u16,
    interface: u8,
    page: u16,
    usage: u16,
    input: u16,
    output: u16,
) -> Option<Protocol> {
    match (vid, pid, interface, page, usage, input, output) {
        (0x05ac, 0x024f, 3, 0xff60, 0x61, 33, 33) | (0x0c45, 0xfefe, 3, 0xff60, 0x61, 33, 33) => {
            Some(Protocol::Sonix)
        }
        (0x1a2c, 0x8fff | 0xa034 | 0xa036, 0, 0xff02, 2, 65, 65) => Some(Protocol::Semico),
        _ => None,
    }
}
pub(super) fn cable_name(vid: u16, pid: u16) -> Option<&'static str> {
    match (vid, pid) {
        (0x1a2c, 0xa034) => Some("Attack Shark X98"),
        (0x1a2c, 0xa036) => Some("AJAZZ AK820 Max Plus"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_apple_ids_do_not_authorize_queries_on_fl680_or_an_apple_keyboard() {
        assert_eq!(identify(0x05ac, 0x024f, 0, 1, 6, 9, 2), None);
        assert_eq!(
            identify(0x05ac, 0x024f, 3, 0xff60, 0x61, 33, 33),
            Some(Protocol::Sonix)
        );
        assert_eq!(identify(0x05ac, 0x024f, 1, 0xff60, 0x61, 33, 33), None);
        assert_eq!(identify(0x1a2c, 0xffff, 0, 0xff02, 2, 65, 65), None);
    }
    #[test]
    fn sonix_checks_checksum_and_never_treats_zero_or_echo_as_empty_battery() {
        let q = Protocol::Sonix.request();
        assert_eq!(Protocol::Sonix.reply(&q).unwrap().percent, None);
        let mut r = q;
        r[4] = 73;
        assert!(Protocol::Sonix.reply(&r).is_none());
        r[32] = 0x21 + 73;
        assert_eq!(Protocol::Sonix.reply(&r).unwrap().percent, Some(73));
        r[4] = 255;
        r[32] = 0x20;
        assert_eq!(Protocol::Sonix.reply(&r).unwrap().percent, None);
        assert!(Protocol::Sonix.reply(&r[..10]).is_none());
    }
    #[test]
    fn semico_connection_and_zero_level_are_valid_but_state_is_not_charging() {
        let mut r = Protocol::Semico.request();
        r[6] = 0;
        r[7] = 1;
        let reading = Protocol::Semico.reply(&r).unwrap();
        assert_eq!(reading.percent, Some(0));
        assert_eq!(reading.connected, Some(true));
        r[7] = 0;
        assert_eq!(Protocol::Semico.reply(&r).unwrap().percent, None);
        assert_eq!(Protocol::Semico.reply(&r).unwrap().connected, Some(false));
        r[7] = 255;
        assert!(Protocol::Semico.reply(&r).is_none());
        r[7] = 1;
        r[5] = 0xff;
        assert!(Protocol::Semico.reply(&r).is_none());
    }
}
