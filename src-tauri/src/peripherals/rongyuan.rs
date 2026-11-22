//! Modern RONGYUAN receiver status, independently implemented from protocol facts.
//! The legacy 05AC:024F FL680 interface is deliberately outside this registry.
pub(super) const REPORT_SIZE: usize = 65;
const RECEIVERS: &[u32] = &[
    0x0db0197e, 0x0db08e9a, 0x145f0376, 0x145f038d, 0x14a5c045, 0x25aa2008, 0x25aa4008, 0x25aa4018,
    0x31514011, 0x31514014, 0x31514017, 0x31514021, 0x31514027, 0x3151402d, 0x31514038, 0x31515006,
    0x31515007, 0x31515008, 0x31515020, 0x31515026, 0x3151502b, 0x31515031, 0x31515037, 0x31515038,
    0x3151503d, 0x3151503f, 0x31515040, 0x31515042, 0x31515045, 0x3151504b, 0x3151504e, 0x31515050,
    0x31515052, 0x31515055, 0x3151505a, 0x342de3e0, 0x342de3e1, 0x342de3e2, 0x342de3e6, 0x342de3e7,
    0x342de3e8, 0x342de3f5, 0x342de3f6, 0x342de3f7, 0x342de3fb, 0x342de3fc, 0x342de3fd, 0x347aa302,
    0x347aa305, 0x374aa205, 0x374aa217, 0x374aa220, 0x374aa223, 0x374aa226, 0x374aa229, 0x374aa234,
    0x374aa237, 0x374aa251, 0x374aa263, 0x374aa268, 0x374aa311, 0x374aa314, 0x374aa319, 0x374aa322,
    0x374aa329, 0x374aa355, 0x379a1804, 0x379a1807, 0x38a90002, 0x38ee0000, 0x38ee0002, 0x38ee0039,
    0x391d1a04, 0x391d1a08, 0x391d1a0e, 0x391d1a13, 0x391d1a25, 0x391d1a2b, 0x391d1a34, 0x391d2017,
    0x391d2a05,
];
pub(super) fn receiver(vid: u16, pid: u16) -> bool {
    RECEIVERS.contains(&((vid as u32) << 16 | pid as u32))
}
pub(super) fn request() -> [u8; REPORT_SIZE] {
    let mut frame = [0; REPORT_SIZE];
    frame[1] = 0xf7;
    frame
}
pub(super) struct Slot {
    pub kind: &'static str,
    pub connected: bool,
    pub percent: Option<u8>,
}
pub(super) fn slots(frame: &[u8]) -> Option<[Slot; 2]> {
    if frame.len() != REPORT_SIZE
        || frame[0] != 0
        || frame[1] > 1
        || frame[4] > 1
        || frame[5] > 1
        || frame[6] > 1
        || frame[2..7].iter().all(|b| *b == 0)
    {
        return None;
    }
    // A zero after wake-up is not reported yet; other unsupported values are not percentages.
    let slot = |kind, level: u8, offline: u8| Slot {
        kind,
        connected: offline == 0,
        percent: (offline == 0 && (1..=100).contains(&level)).then_some(level),
    };
    Some([
        slot("keyboard", frame[2], frame[4]),
        slot("mouse", frame[3], frame[5]),
    ])
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_registry_excludes_legacy_fl680_and_unrelated_shared_vendors() {
        assert_eq!(RECEIVERS.len(), 81);
        let keys: std::collections::BTreeSet<_> = RECEIVERS.iter().collect();
        assert_eq!(keys.len(), RECEIVERS.len());
        assert!(receiver(0x3151, 0x402d));
        assert!(!receiver(0x05ac, 0x024f));
        assert!(!receiver(0x3151, 0xffff));
    }
    #[test]
    fn slots_keep_distinct_levels_and_do_not_guess_charging_from_changes() {
        let mut r = [0; REPORT_SIZE];
        r[1] = 1;
        r[2] = 70;
        r[3] = 30;
        r[6] = 1;
        let s = slots(&r).unwrap();
        assert_eq!(s[0].kind, "keyboard");
        assert_eq!(s[0].percent, Some(70));
        assert_eq!(s[1].kind, "mouse");
        assert_eq!(s[1].percent, Some(30));
        r[4] = 1;
        r[3] = 255;
        let s = slots(&r).unwrap();
        assert!(!s[0].connected);
        assert_eq!(s[0].percent, None);
        assert!(s[1].connected);
        assert_eq!(s[1].percent, None);
        assert!(slots(&[0; REPORT_SIZE]).is_none());
        assert!(slots(&request()).is_none());
        r[5] = 255;
        assert!(slots(&r).is_none());
        assert!(slots(&r[..10]).is_none());
    }
}
