//! Independent SteelSeries mouse battery queries. Protocol evidence:
//! rivalcfg device profiles and OpenMouse's Aerox 3 hardware captures.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Format {
    Aerox,
    Rival,
    RivalPro,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct Model {
    pub name: &'static str,
    pub wired: bool,
    pub interface: u8,
    format: Format,
}

pub(super) fn model(vid: u16, pid: u16) -> Option<Model> {
    if vid != 0x1038 {
        return None;
    }
    let (name, wired, interface, format) = match pid {
        0x1838 | 0x183a => ("Aerox 3 Wireless", pid == 0x183a, 3, Format::Aerox),
        0x1878 | 0x187a => (
            "Aerox 3 Wireless CS2 Dragon Lore",
            pid == 0x187a,
            3,
            Format::Aerox,
        ),
        0x1852 | 0x1854 => ("Aerox 5 Wireless", pid == 0x1854, 3, Format::Aerox),
        0x1858 | 0x185a => ("Aerox 9 Wireless", pid == 0x185a, 3, Format::Aerox),
        0x1840 | 0x1842 => ("Prime Wireless", pid == 0x1842, 3, Format::Aerox),
        0x1830 => ("Rival 3 Wireless", false, 3, Format::Rival),
        0x1872 => ("Rival 3 Wireless Gen 2", false, 3, Format::Rival),
        0x1726 | 0x172b => ("Rival 650 Wireless", pid == 0x172b, 0, Format::Rival),
        0x1880 => ("Rival Pro", false, 2, Format::RivalPro),
        _ => return None,
    };
    Some(Model {
        name,
        wired,
        interface,
        format,
    })
}

impl Model {
    pub fn accepts(self, interface: u8, page: u16, usage: u16, input: u16, output: u16) -> bool {
        // Never send a query to the mouse/keyboard movement collection.
        interface == self.interface
            && page >= 0xff00
            && usage != 0
            && (4..=1025).contains(&input)
            && (3..=1025).contains(&output)
            && (self.format != Format::Aerox || (page, usage, input, output) == (0xffc0, 1, 65, 65))
    }

    pub fn request(self, size: usize) -> Option<Vec<u8>> {
        if !(3..=1025).contains(&size) {
            return None;
        }
        let mut frame = vec![0; size];
        match self.format {
            Format::Aerox => frame[1] = if self.wired { 0x92 } else { 0xd2 },
            Format::Rival => frame[1..3].copy_from_slice(&[0xaa, 1]),
            Format::RivalPro => frame[1] = 0x92,
        }
        Some(frame)
    }

    /// Windows unnumbered input includes a dummy report ID, unlike hidapi's payload.
    pub fn reply(self, frame: &[u8]) -> Option<Reading> {
        if frame.first() != Some(&0) {
            return None;
        }
        let p = &frame[1..];
        let mut result = Reading::default();
        match self.format {
            Format::Aerox => {
                let command = if self.wired { 0x92 } else { 0xd2 };
                if p.len() < 2 || p[0] != command {
                    // In particular, receiver sleep sends 40 FF 01, not battery data.
                    return None;
                }
                let level = p[1] & 0x7f;
                if level == 0 {
                    result.connected = Some(false);
                } else if level <= 21 {
                    result.percent = Some((level - 1) * 5);
                    result.charging = Some(p[1] & 0x80 != 0);
                    result.connected = Some(true);
                }
            }
            Format::Rival => {
                if p.len() < 3 || p[0] > 100 {
                    return None;
                }
                result.percent = Some(p[0]);
                result.charging = match p[2] {
                    0 => Some(false),
                    1 => Some(true),
                    _ => None,
                };
                // Cached receiver levels do not prove radio presence.
            }
            Format::RivalPro => {
                if p.len() < 3 || p[..2] != [0x92, 0] || p[2] > 100 {
                    return None;
                }
                result.percent = Some(p[2]);
                // The base also reports a spare battery; that is not the mouse's level.
            }
        }
        Some(result)
    }
}

#[derive(Default, Debug, PartialEq)]
pub(super) struct Reading {
    pub percent: Option<u8>,
    pub charging: Option<bool>,
    pub connected: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn aerox_captured_channel_frames_and_sleep_are_not_confused() {
        let cable = model(0x1038, 0x183a).unwrap();
        let receiver = model(0x1038, 0x1838).unwrap();
        // Public macOS captures, wrapped in Windows' zero report ID.
        assert_eq!(
            cable.reply(&[0, 0x92, 0x95]).unwrap(),
            Reading {
                percent: Some(100),
                charging: Some(true),
                connected: Some(true),
            }
        );
        assert_eq!(
            receiver.reply(&[0, 0xd2, 0x15]).unwrap().charging,
            Some(false)
        );
        assert!(receiver.reply(&[0, 0x40, 0xff, 1]).is_none());
        assert!(receiver.reply(&[0, 0x92, 0x95]).is_none());
        assert!(receiver.reply(&[0, 0xd2]).is_none());
        assert!(receiver.reply(&[6, 0xd2, 0x15]).is_none());
        assert!(receiver.accepts(3, 0xffc0, 1, 65, 65));
        assert!(!receiver.accepts(0, 1, 2, 9, 2));
        assert!(!receiver.accepts(3, 0xffc0, 1, 33, 33));
        assert!(model(0x1038, 0x184c).is_none()); // wired-only Rival 3
    }
    #[test]
    fn invalid_levels_do_not_become_full_charged_or_connected() {
        let m = model(0x1038, 0x1852).unwrap();
        for raw in [0x7f, 0xff, 0x16, 0x96] {
            assert_eq!(m.reply(&[0, 0xd2, raw]).unwrap(), Reading::default());
        }
        for raw in [0, 0x80] {
            let r = m.reply(&[0, 0xd2, raw]).unwrap();
            assert_eq!(r.connected, Some(false));
            assert_eq!(r.percent, None);
            assert_eq!(r.charging, None);
        }
        assert_eq!(m.reply(&[0, 0xd2, 0x81]).unwrap().percent, Some(0));
    }
    #[test]
    fn rival_raw_percent_and_spare_battery_are_separate() {
        let m = model(0x1038, 0x1726).unwrap();
        assert_eq!(m.reply(&[0, 0, 0, 1]).unwrap().percent, Some(0));
        assert_eq!(m.reply(&[0, 75, 0, 255]).unwrap().charging, None);
        assert!(m.reply(&[0, 255, 0, 1]).is_none());
        assert_eq!(m.reply(&[0, 75, 0, 1]).unwrap().connected, None);
        let base = model(0x1038, 0x1880).unwrap();
        let r = base.reply(&[0, 0x92, 0, 30, 1, 95]).unwrap();
        assert_eq!(r.percent, Some(30));
        assert_eq!(r.charging, None);
        assert!(base.reply(&[0, 0x92, 1, 30]).is_none());
    }
}
