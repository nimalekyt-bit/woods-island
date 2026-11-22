//! Independent DAREU JM wire-format implementation. GET commands only.
//! Facts and exact model mappings are documented in docs/peripheral-support.md.
pub(super) const REPORT_SIZE: usize = 17;
#[derive(serde::Deserialize)]
pub(super) struct Model {
    pub pid: u16,
    pub cid: u8,
    pub mid: u8,
    pub name: String,
    pub wireless: bool,
}
fn models() -> &'static [Model] {
    static MODELS: std::sync::OnceLock<Vec<Model>> = std::sync::OnceLock::new();
    MODELS.get_or_init(|| {
        serde_json::from_str(include_str!("dareu_jm_models.json"))
            .expect("checked DAREU model facts")
    })
}
pub(super) fn known_pid(pid: u16) -> bool {
    models().iter().any(|model| model.pid == pid)
}
pub(super) fn model(pid: u16, cid: u8, mid: u8) -> Option<&'static Model> {
    models()
        .iter()
        .find(|model| (model.pid, model.cid, model.mid) == (pid, cid, mid))
}

pub(super) fn request(command: u8, selector: u8) -> Option<[u8; REPORT_SIZE]> {
    // Do not expose configuration, reset, pairing or firmware commands.
    if !matches!((command, selector), (1, 8) | (3 | 4, 0 | 0x80)) {
        return None;
    }
    let mut bytes = [0; REPORT_SIZE];
    bytes[0] = 8;
    bytes[1] = command;
    bytes[5] = selector;
    bytes[16] = 0x55u8.wrapping_sub(
        bytes[..16]
            .iter()
            .fold(0u8, |sum, byte| sum.wrapping_add(*byte)),
    );
    Some(bytes)
}

pub(super) fn valid_reply(bytes: &[u8], request: &[u8]) -> bool {
    bytes.len() == REPORT_SIZE
        && request.len() == REPORT_SIZE
        && bytes[0] == 8
        && bytes[1] == request[1]
        && bytes[2] == 0
        && bytes != request
        && bytes.iter().fold(0u8, |sum, byte| sum.wrapping_add(*byte)) == 0x55
}

pub(super) fn charging(status: u8) -> Option<bool> {
    match status {
        0 => Some(false),
        1 | 2 => Some(true),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn captured_a950_air_cable_and_receiver_frames_confirm_separate_charging_state() {
        let q = request(4, 0).unwrap();
        let cable = [
            0x08, 0x04, 0, 0, 0, 0x02, 0x5f, 0x01, 0x10, 0x86, 0, 0, 0, 0, 0, 0, 0x51,
        ];
        let receiver = [
            0x08, 0x04, 0, 0, 0, 0x02, 0x64, 0, 0x10, 0x65, 0, 0, 0, 0, 0, 0, 0x6e,
        ];
        assert!(valid_reply(&cable, &q));
        assert!(valid_reply(&receiver, &q));
        assert_eq!(cable[6], 95);
        assert_eq!(receiver[6], 100);
        assert_eq!(charging(cable[7]), Some(true));
        assert_eq!(charging(receiver[7]), Some(false));
    }
    #[test]
    fn only_identified_read_commands_are_constructible() {
        assert_eq!(request(4, 0).unwrap()[16], 0x49);
        assert!(request(9, 0).is_none());
        assert!(request(7, 0).is_none());
        assert!(request(1, 0x80).is_none());
        assert_eq!(model(0x1154, 10, 11).unwrap().name, "A950 AIR");
        assert!(model(0x1154, 255, 255).is_none());
        assert!(model(0x1074, 10, 11).is_none());
    }
    #[test]
    fn replies_reject_echo_wrong_channel_and_corruption() {
        let request = request(4, 0x80).unwrap();
        assert!(!valid_reply(&request, &request));
        let mut reply = request;
        reply[6] = 72;
        reply[7] = 1;
        reply[16] =
            0x55u8.wrapping_sub(reply[..16].iter().fold(0u8, |sum, b| sum.wrapping_add(*b)));
        assert!(valid_reply(&reply, &request));
        assert_eq!(charging(reply[7]), Some(true));
        assert_eq!(charging(255), None);
        reply[6] = 255;
        assert!(!valid_reply(&reply, &request));
        assert!(!valid_reply(&reply[..8], &request));
    }
    #[test]
    fn registry_keys_are_unique_and_never_brand_wildcards() {
        let mut keys = std::collections::BTreeSet::new();
        assert!(models().len() > 40);
        for model in models() {
            assert!(keys.insert((model.pid, model.cid, model.mid)));
            assert!(!model.name.trim().is_empty());
            assert!(model.pid != 0);
        }
        assert!(!known_pid(0xffff));
        assert!(!known_pid(0));
    }
}
