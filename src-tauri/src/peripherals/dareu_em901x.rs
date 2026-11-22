//! EM901X uses a feature command and a separate sibling input collection.
//! Facts: official EM901X GET Power protocol notes linked in peripheral-support.md.
pub(super) const RECEIVER_PID: u16 = 0x1074;
pub(super) const REPORT_SIZE: usize = 17;
pub(super) fn request() -> [u8; REPORT_SIZE] {
    let mut frame = [0; REPORT_SIZE];
    frame[0] = 8;
    frame[1] = 4;
    frame[16] = 0x49;
    frame
}
pub(super) fn battery(frame: &[u8]) -> Option<(Option<u8>, Option<bool>)> {
    if frame.len() != REPORT_SIZE || frame[..3] != [9, 4, 0] {
        return None;
    }
    // The reply checksum rule is not established for this revision. Do not apply JM's rule.
    Some((
        (frame[6] <= 100).then_some(frame[6]),
        super::dareu::charging(frame[7]),
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn separate_input_report_is_required_and_unknown_fields_stay_independent() {
        assert_eq!(request()[16], 0x49);
        assert!(battery(&request()).is_none());
        let mut reply = [0; REPORT_SIZE];
        reply[0] = 9;
        reply[1] = 4;
        reply[6] = 55;
        reply[7] = 1;
        assert_eq!(battery(&reply), Some((Some(55), Some(true))));
        reply[6] = 255;
        assert_eq!(battery(&reply), Some((None, Some(true))));
        reply[6] = 0;
        reply[7] = 255;
        assert_eq!(battery(&reply), Some((Some(0), None)));
        reply[2] = 1;
        assert!(battery(&reply).is_none());
        assert!(battery(&reply[..10]).is_none());
    }
}
