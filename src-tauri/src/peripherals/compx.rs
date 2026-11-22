//! Read-only COMPX mouse status for exact transports documented by the references.
//! Other devices from these vendors may use different feature, keyboard or serial protocols.
pub(super) const REPORT_SIZE: usize = 17;

pub(super) struct Model {
    pub name: &'static str,
    pub wired: bool,
}

pub(super) fn model(vid: u16, pid: u16) -> Option<Model> {
    let (name, wired) = match (vid, pid) {
        (0x3554, 0xf58a | 0xf58e) => ("VXE Dragonfly R1", false),
        (0x3554, 0xf58c | 0xf58f) => ("VXE Dragonfly R1", true),
        (0x3554, 0xf505) => ("ATK/VXE Wireless Mouse", false),
        (0x3554, 0xf506) => ("ATK/VXE Wireless Mouse", true),
        // These PIDs are shared by Redragon and Taidu. Do not invent a retail model.
        (0x3554, 0xf55d | 0xf5d5) => ("COMPX Wireless Mouse", false),
        (0x3554, 0xf55e) => ("COMPX Wireless Mouse", true),
        (0x3770, 0x0200 | 0x0300) => ("Hitscan Hyperlight", false),
        (0x3770, 0x0100) => ("Hitscan Hyperlight", true),
        (0x35bb, 0xd3fb) => ("HECATE Wireless Mouse", false),
        (0x35bb, 0xd3fa | 0xd3fc | 0xd3fd) => ("HECATE Wireless Mouse", true),
        (0x3710, 0x5406) => ("Pulsar Wireless Mouse", false),
        _ => return None,
    };
    Some(Model { name, wired })
}

#[derive(Clone, Copy)]
pub(super) enum Query {
    Connection,
    Battery,
}
impl Query {
    fn command(self) -> u8 {
        match self {
            Self::Connection => 3,
            Self::Battery => 4,
        }
    }
    pub fn request(self) -> [u8; REPORT_SIZE] {
        let mut r = [0; REPORT_SIZE];
        r[0] = 8;
        r[1] = self.command();
        r[16] = 0x55u8.wrapping_sub(8 + r[1]);
        r
    }
    pub fn valid(self, r: &[u8]) -> bool {
        r.len() == REPORT_SIZE
            && r[0] == 8
            && r[1] == self.command()
            && r[2] == 0
            && r != self.request()
            && r.iter().fold(0u8, |sum, v| sum.wrapping_add(*v)) == 0x55
    }
}

pub(super) fn connection(r: &[u8]) -> Option<bool> {
    if !Query::Connection.valid(r) {
        return None;
    }
    match r[6] {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}
pub(super) fn battery(r: &[u8]) -> Option<(Option<u8>, Option<bool>)> {
    if !Query::Battery.valid(r) {
        return None;
    }
    let charging = match r[7] {
        0 => Some(false),
        1 | 2 => Some(true),
        _ => None,
    };
    Some(((r[6] <= 100).then_some(r[6]), charging))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn reply(q: Query, value: u8, state: u8) -> [u8; REPORT_SIZE] {
        let mut r = q.request();
        r[5] = 2;
        r[6] = value;
        r[7] = state;
        r[16] = 0x55u8.wrapping_sub(r[..16].iter().fold(0u8, |sum, v| sum.wrapping_add(*v)));
        r
    }
    #[test]
    fn checksum_echo_foreign_command_and_status_are_checked() {
        assert!(!Query::Battery.valid(&Query::Battery.request()));
        let mut r = reply(Query::Battery, 72, 1);
        assert_eq!(battery(&r), Some((Some(72), Some(true))));
        assert_eq!(connection(&r), None);
        r[6] = 73;
        assert_eq!(battery(&r), None);
        assert!(!Query::Battery.valid(&r[..8]));
        let mut r = reply(Query::Battery, 72, 1);
        r[2] = 1;
        r[16] = r[16].wrapping_sub(1);
        assert_eq!(battery(&r), None);
    }
    #[test]
    fn independent_status_does_not_guess_percent_or_presence() {
        assert_eq!(
            battery(&reply(Query::Battery, 255, 1)),
            Some((None, Some(true)))
        );
        assert_eq!(
            battery(&reply(Query::Battery, 0, 255)),
            Some((Some(0), None))
        );
        assert_eq!(connection(&reply(Query::Connection, 0, 0)), Some(false));
        assert_eq!(connection(&reply(Query::Connection, 1, 0)), Some(true));
        assert_eq!(connection(&reply(Query::Connection, 255, 0)), None);
    }
    #[test]
    fn exact_ids_exclude_serial_headsets_keyboards_and_new_hitscan_protocols() {
        assert!(model(0x3554, 0xf58a).is_some());
        assert!(model(0x3770, 0x0200).is_some());
        assert!(model(0x3770, 0x0136).is_none());
        assert!(model(0x373b, 0x1204).is_none());
        assert!(model(0x3554, 0xfa09).is_none());
        assert!(model(0x3710, 0x5403).is_none());
        assert!(model(0x3554, 0xffff).is_none());
        assert_eq!(
            model(0x3554, 0xf506).unwrap().name,
            "ATK/VXE Wireless Mouse"
        );
    }
}
