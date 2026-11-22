//! Independent TG GET codec. Exact product facts come from the official driver.
//! This family uses feature reports, not the JM input/output transport.
pub(super) const REPORT_SIZE: usize = 65;
pub(super) const RECEIVER_PID: u16 = 0x1131;

pub(super) struct Model {
    pub pid: u16,
    pub report_id: u8,
    pub name: &'static str,
}
const MODELS: &[Model] = &[
    Model {
        pid: 0x1147,
        report_id: 10,
        name: "A950 Air",
    },
    Model {
        pid: 0x1169,
        report_id: 10,
        name: "A950 Air KR",
    },
    Model {
        pid: 0x1130,
        report_id: 10,
        name: "A980 PRO",
    },
    Model {
        pid: 0x1166,
        report_id: 10,
        name: "A980 PRO V3",
    },
    Model {
        pid: 0x1148,
        report_id: 10,
        name: "A980 PRO V2",
    },
    Model {
        pid: 0x1129,
        report_id: 10,
        name: "A980 PRO MAX",
    },
    Model {
        pid: 0x1150,
        report_id: 10,
        name: "A980 PRO MAX V2",
    },
    Model {
        pid: 0x1111,
        report_id: 0,
        name: "M20",
    },
    Model {
        pid: 0x1091,
        report_id: 0,
        name: "Z10",
    },
];
pub(super) fn model(pid: u16) -> Option<&'static Model> {
    MODELS.iter().find(|m| m.pid == pid)
}

#[derive(Clone, Copy)]
pub(super) enum Query {
    Battery,
    RadioSlots,
}

pub(super) fn request(report_id: u8, target: u8, query: Query) -> Option<[u8; REPORT_SIZE]> {
    if !matches!(report_id, 0 | 10) || target > 15 {
        return None;
    }
    let mut bytes = [0; REPORT_SIZE];
    bytes[0] = report_id;
    bytes[1] = target << 4;
    match query {
        Query::Battery => {
            bytes[2] = 4;
            bytes[3] = 7;
            bytes[4] = 0x80;
        }
        Query::RadioSlots if target == 0 && report_id == 10 => {
            bytes[2] = 6;
            bytes[4] = 0xa0;
        }
        Query::RadioSlots => return None,
    }
    // These exact models do not implement the official driver's ICheckCRC trait.
    Some(bytes)
}

pub(super) fn valid_reply(bytes: &[u8], request: &[u8]) -> bool {
    bytes.len() == REPORT_SIZE
        && request.len() == REPORT_SIZE
        && bytes[0] == request[0]
        && bytes[1] == (request[1] | 2)
        && bytes[2] as usize <= REPORT_SIZE - 7
        && bytes[3..6] == request[3..6]
}
pub(super) fn pending_reply(bytes: &[u8], request: &[u8]) -> bool {
    bytes.len() == REPORT_SIZE
        && bytes[0] == request[0]
        && bytes[1] & 0xf0 == request[1]
        && bytes[1] & 15 <= 1
}

pub(super) struct Battery {
    pub percent: Option<u8>,
    pub charging: Option<bool>,
}
pub(super) fn battery(bytes: &[u8], request: &[u8], wireless: bool) -> Option<Battery> {
    if !valid_reply(bytes, request) || request[3..5] != [7, 0x80] || bytes[2] != 4 {
        return None;
    }
    // Some report-10 wired devices return a zero placeholder while charging.
    // Keep the independently reported charging flag without inventing 0% or 50%.
    let percent =
        (bytes[8] <= 100 && bytes[9] <= 100 && (wireless || request[0] != 10 || bytes[8] != 0))
            .then_some(bytes[8]);
    Some(Battery {
        percent,
        charging: super::dareu::charging(bytes[7]),
    })
}

pub(super) struct Slot {
    pub target: u8,
    pub pid: u16,
    pub connected: Option<bool>,
}
pub(super) fn radio_slots(bytes: &[u8], request: &[u8]) -> Option<Vec<Slot>> {
    if !valid_reply(bytes, request) || request[3..5] != [0, 0xa0] {
        return None;
    }
    let count = bytes[7] as usize;
    if count > 15 || count * 3 + 1 > bytes[2] as usize {
        return None;
    }
    let mut result = Vec::new();
    for i in 0..count {
        let at = 8 + i * 3;
        let pid = u16::from_be_bytes([bytes[at + 1], bytes[at + 2]]);
        if !model(pid).is_some_and(|m| m.report_id == 10) {
            continue;
        }
        result.push(Slot {
            target: i as u8 + 1,
            pid,
            connected: match bytes[at] {
                0 => Some(false),
                1 => Some(true),
                _ => None,
            },
        });
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn reply(request: &[u8; REPORT_SIZE], data: &[u8]) -> [u8; REPORT_SIZE] {
        let mut r = *request;
        r[1] |= 2;
        r[2] = data.len() as u8;
        r[7..7 + data.len()].copy_from_slice(data);
        r
    }
    #[test]
    fn battery_does_not_confuse_error_busy_echo_or_foreign_target_with_a_reading() {
        let q = request(10, 1, Query::Battery).unwrap();
        assert!(battery(&q, &q, true).is_none());
        let mut r = reply(&q, &[1, 75, 100, 10]);
        let b = battery(&r, &q, true).unwrap();
        assert_eq!(b.percent, Some(75));
        assert_eq!(b.charging, Some(true));
        r[1] = 0x22;
        assert!(battery(&r, &q, true).is_none());
        r[1] = 0x11;
        assert!(pending_reply(&r, &q));
        assert!(battery(&r, &q, true).is_none());
        r[1] = 0x13;
        assert!(!pending_reply(&r, &q));
        assert!(battery(&r, &q, true).is_none());
        assert!(battery(&r[..10], &q, true).is_none());
    }
    #[test]
    fn zero_placeholder_and_unknown_charging_remain_independent() {
        let q = request(10, 0, Query::Battery).unwrap();
        let r = reply(&q, &[1, 0, 100, 10]);
        assert_eq!(battery(&r, &q, false).unwrap().percent, None);
        assert_eq!(battery(&r, &q, false).unwrap().charging, Some(true));
        assert_eq!(battery(&r, &q, true).unwrap().percent, Some(0));
        let r = reply(&q, &[255, 70, 100, 10]);
        let b = battery(&r, &q, true).unwrap();
        assert_eq!(b.percent, Some(70));
        assert_eq!(b.charging, None);
        let r = reply(&q, &[0, 255, 100, 10]);
        assert_eq!(battery(&r, &q, true).unwrap().percent, None);
    }
    #[test]
    fn receiver_slots_keep_two_identical_mice_separate_and_reject_overruns() {
        let q = request(10, 0, Query::RadioSlots).unwrap();
        let mut r = reply(&q, &[2, 1, 0x11, 0x47, 0, 0x11, 0x47]);
        let slots = radio_slots(&r, &q).unwrap();
        assert_eq!(slots.len(), 2);
        assert_eq!((slots[0].target, slots[1].target), (1, 2));
        assert_eq!(slots[0].connected, Some(true));
        assert_eq!(slots[1].connected, Some(false));
        r[7] = 255;
        assert!(radio_slots(&r, &q).is_none());
        r[7] = 3;
        assert!(radio_slots(&r, &q).is_none());
        assert!(request(10, 1, Query::RadioSlots).is_none());
        assert!(request(10, 16, Query::Battery).is_none());
        assert!(model(0x1154).is_none());
        assert!(model(0xffff).is_none());
    }
}
