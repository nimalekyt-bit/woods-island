//! Opt-in manual G435 0ACB voltage reading. Never used by the ordinary scanner.
//! Framing: official RTK output transport, local hardware acceptance 22.11.2026.
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use windows::core::PCWSTR;
use windows::Win32::Devices::HumanInterfaceDevice::*;
use windows::Win32::Foundation::*;
use windows::Win32::Storage::FileSystem::*;
use windows::Win32::System::Threading::*;
use windows::Win32::System::IO::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Reading {
    pub millivolts: u16,
    pub estimated_percent: u8,
    pub read_at: u64,
}
impl Reading {
    pub fn valid(&self, now: u64) -> bool {
        (2500..=4600).contains(&self.millivolts)
            && self.estimated_percent == estimate(self.millivolts)
            && self.read_at <= now
            && now - self.read_at < 24 * 60 * 60 * 1000
    }
}

fn estimate(mv: u16) -> u8 {
    const CURVE: [(u16, u8); 16] = [
        (4200, 100),
        (4150, 95),
        (4100, 90),
        (4050, 85),
        (4000, 80),
        (3950, 75),
        (3900, 70),
        (3850, 62),
        (3800, 55),
        (3750, 45),
        (3700, 35),
        (3650, 25),
        (3600, 15),
        (3550, 10),
        (3500, 5),
        (3400, 0),
    ];
    if mv >= 4200 {
        return 100;
    }
    for pair in CURVE.windows(2) {
        let [(hi, hp), (lo, lp)] = pair else {
            unreachable!()
        };
        if mv >= *lo {
            let range = (hi - lo) as u32;
            return (*lp as u32 + ((mv - lo) as u32 * (hp - lp) as u32 + range / 2) / range) as u8;
        }
    }
    0
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Query {
    Connected,
    Mode,
    Remote,
    Battery,
}
fn command(query: Query, sequence: u8) -> Vec<u8> {
    match query {
        Query::Connected => vec![0x50, 0x41, 14, sequence, 1, 0xe3],
        Query::Mode => vec![0x50, 0x41, 14, sequence, 1, 0xe0],
        Query::Remote => vec![0x50, 0x41, 14, sequence, 2, 0xe1, 1],
        Query::Battery => vec![0x50, 0x41, 6, sequence, 1, 0, 0x31],
    }
}
fn frame(operation: u8, body: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0; 515];
    bytes[..3].copy_from_slice(&[6, operation, 3]);
    if !body.is_empty() {
        bytes[3..5].copy_from_slice(&(body.len() as u16).to_le_bytes());
        bytes[5..5 + body.len()].copy_from_slice(body);
    }
    bytes
}
fn parse(bytes: &[u8], query: Query, sequence: u8) -> Option<u16> {
    if bytes.len() != 64 || bytes[0] != 6 || bytes[1] == 0xff || !(1..=62).contains(&bytes[63]) {
        return None;
    }
    let data = &bytes[1..1 + bytes[63] as usize];
    match query {
        Query::Battery => data.windows(7).find_map(|part| {
            if part[..5] != [7, 0, 6, sequence | 0x80, 0] {
                return None;
            }
            let mv = u16::from_le_bytes([part[5], part[6]]);
            (2500..=4600).contains(&mv).then_some(mv)
        }),
        Query::Connected | Query::Mode => data.windows(4).find_map(|part| {
            let opcode = if query == Query::Connected {
                0xe3
            } else {
                0xe0
            };
            (part[..3] == [2, 0, opcode] && part[3] <= 1).then_some(part[3] as u16)
        }),
        Query::Remote => None,
    }
}

trait Exchange {
    fn enter(&mut self) -> Result<(), String>;
    fn drain(&mut self) -> Result<(), String>;
    fn query(&mut self, query: Query, sequence: u8) -> Result<Option<u16>, String>;
    fn exit(&mut self) -> bool;
}
fn session(io: &mut impl Exchange) -> Result<Reading, String> {
    let entered = io.enter();
    if matches!(&entered, Err(error) if error == "g435Busy") {
        return Err("g435Busy".into());
    }
    let result = (|| {
        entered?;
        io.drain()?;
        match io.query(Query::Connected, 1)? {
            Some(1) => {}
            Some(0) => return Err("g435HeadsetOff".into()),
            _ => return Err("g435NoReply".into()),
        }
        match io.query(Query::Mode, 2)? {
            Some(1) => {}
            Some(0) => {
                io.query(Query::Remote, 3)?;
                if io.query(Query::Mode, 4)? != Some(1) {
                    return Err("g435NoReply".into());
                }
            }
            _ => return Err("g435NoReply".into()),
        }
        let mv = io.query(Query::Battery, 5)?.ok_or("g435NoReply")?;
        if !(2500..=4600).contains(&mv) {
            return Err("g435NoReply".into());
        }
        Ok(Reading {
            millivolts: mv,
            estimated_percent: estimate(mv),
            read_at: crate::media::now_ms(),
        })
    })();
    if !io.exit() {
        return Err("g435ExitUnconfirmed".into());
    }
    result
}

struct Owned(HANDLE);
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
struct Hardware {
    file: Owned,
    deadline: Instant,
}
impl Hardware {
    unsafe fn open(path: &[u16]) -> Result<Self, String> {
        let file = Owned(
            CreateFileW(
                PCWSTR(path.as_ptr()),
                0xc0000000,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_OVERLAPPED,
                None,
            )
            .map_err(|_| "g435Io")?,
        );
        let mut attr = HIDD_ATTRIBUTES {
            Size: std::mem::size_of::<HIDD_ATTRIBUTES>() as u32,
            ..Default::default()
        };
        if !HidD_GetAttributes(file.0, &mut attr).as_bool()
            || (attr.VendorID, attr.ProductID, attr.VersionNumber) != (0x046d, 0x0acb, 8)
        {
            return Err("g435Unsupported".into());
        }
        Ok(Self {
            file,
            deadline: Instant::now() + Duration::from_secs(8),
        })
    }
    unsafe fn io(&self, code: Option<u32>, bytes: &mut [u8]) -> Result<(), String> {
        if Instant::now() > self.deadline {
            return Err("g435Timeout".into());
        }
        let event = Owned(CreateEventW(None, true, false, None).map_err(|_| "g435Io")?);
        let mut operation = OVERLAPPED {
            hEvent: event.0,
            ..Default::default()
        };
        let mut used = 0;
        let result = if let Some(code) = code {
            DeviceIoControl(
                self.file.0,
                code,
                Some(bytes.as_ptr().cast()),
                bytes.len() as u32,
                if code == 0x000b0192 {
                    Some(bytes.as_mut_ptr().cast())
                } else {
                    None
                },
                if code == 0x000b0192 {
                    bytes.len() as u32
                } else {
                    0
                },
                Some(&mut used),
                Some(&mut operation),
            )
        } else {
            ReadFile(
                self.file.0,
                Some(bytes),
                Some(&mut used),
                Some(&mut operation),
            )
        };
        if result.is_err() {
            if GetLastError() != ERROR_IO_PENDING {
                return Err("g435Io".into());
            }
            if WaitForSingleObject(event.0, 350) != WAIT_OBJECT_0 {
                let _ = CancelIoEx(self.file.0, Some(&operation));
                // Keep the OVERLAPPED and buffers alive until cancellation completes.
                let _ = GetOverlappedResult(self.file.0, &operation, &mut used, true);
                return Err("g435Timeout".into());
            }
            GetOverlappedResult(self.file.0, &operation, &mut used, false).map_err(|_| "g435Io")?;
        }
        if code.is_none() && used < 2 {
            return Err("g435NoReply".into());
        }
        Ok(())
    }
    fn bridge(&self, operation: u8, body: &[u8]) -> Result<(), String> {
        unsafe {
            self.io(Some(0x000b0195), &mut frame(operation, body))?;
            let mut ack = [0; 8];
            self.io(None, &mut ack)?;
            if operation == 1 && ack[..2] == [6, 0xfe] {
                return Err("g435Busy".into());
            }
            if ack[..2] != [6, 0x5a] {
                return Err("g435NoReply".into());
            }
        }
        Ok(())
    }
    fn feature(&self) -> Result<Vec<u8>, String> {
        let mut bytes = vec![0; 64];
        bytes[0] = 6;
        unsafe {
            self.io(Some(0x000b0192), &mut bytes)?;
        }
        Ok(bytes)
    }
}
impl Exchange for Hardware {
    fn enter(&mut self) -> Result<(), String> {
        self.bridge(1, &[])
    }
    fn drain(&mut self) -> Result<(), String> {
        for _ in 0..4 {
            if self.feature()?[1] == 0xff {
                return Ok(());
            }
        }
        Err("g435NoReply".into())
    }
    fn query(&mut self, query: Query, sequence: u8) -> Result<Option<u16>, String> {
        self.bridge(4, &command(query, sequence))?;
        if query == Query::Remote {
            return Ok(None);
        }
        let deadline = self
            .deadline
            .min(Instant::now() + Duration::from_millis(700));
        while Instant::now() < deadline {
            if let Some(value) = parse(&self.feature()?, query, sequence) {
                return Ok(Some(value));
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        Ok(None)
    }
    fn exit(&mut self) -> bool {
        self.deadline = Instant::now() + Duration::from_secs(2);
        self.bridge(8, &[]).is_ok() || self.bridge(8, &[]).is_ok()
    }
}

pub(super) fn child(target: &str, recovery: bool) -> serde_json::Value {
    let result = (|| -> Result<serde_json::Value, String> {
        if crate::win::WindowManager::passive_qa() && !recovery {
            return Err("g435QaDisabled".into());
        }
        let name: Vec<u16> = "Local\\WoodsIslandG435Manual"
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let lock = unsafe {
            Owned(CreateMutexW(None, false, PCWSTR(name.as_ptr())).map_err(|_| "g435Io")?)
        };
        let acquired = unsafe { WaitForSingleObject(lock.0, 0) };
        if acquired != WAIT_OBJECT_0 && acquired != WAIT_ABANDONED {
            return Err("g435Busy".into());
        }
        let path = super::windows_devices::g435_path(target)?;
        let mut io = unsafe { Hardware::open(&path)? };
        let result = if recovery {
            if io.exit() {
                Ok(serde_json::json!({"recovered":true}))
            } else {
                Err("g435ExitUnconfirmed".into())
            }
        } else {
            session(&mut io)
                .and_then(|reading| serde_json::to_value(reading).map_err(|_| "g435Io".into()))
        };
        unsafe {
            let _ = ReleaseMutex(lock.0);
        }
        result
    })();
    match result {
        Ok(reading) => serde_json::json!({"ok":true,"reading":reading}),
        Err(error) => serde_json::json!({"ok":false,"error":error}),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fake {
        calls: Vec<Query>,
        fail: Option<Query>,
        mode: u16,
        linked: Option<u16>,
        exit: bool,
        busy: bool,
        exited: bool,
    }
    impl Default for Fake {
        fn default() -> Self {
            Self {
                calls: vec![],
                fail: None,
                mode: 1,
                linked: Some(1),
                exit: true,
                busy: false,
                exited: false,
            }
        }
    }
    impl Exchange for Fake {
        fn enter(&mut self) -> Result<(), String> {
            if self.busy {
                Err("g435Busy".into())
            } else {
                Ok(())
            }
        }
        fn drain(&mut self) -> Result<(), String> {
            Ok(())
        }
        fn query(&mut self, q: Query, _: u8) -> Result<Option<u16>, String> {
            self.calls.push(q);
            if self.fail == Some(q) {
                return Err("g435Io".into());
            }
            Ok(match q {
                Query::Connected => self.linked,
                Query::Mode => Some(self.mode),
                Query::Remote => {
                    self.mode = 1;
                    None
                }
                Query::Battery => Some(4029),
            })
        }
        fn exit(&mut self) -> bool {
            self.exited = true;
            self.exit
        }
    }
    #[test]
    fn estimate_is_monotonic_and_has_no_charging_inference() {
        assert_eq!(estimate(4029), 83);
        assert!((2500..4600).all(|mv| estimate(mv) <= estimate(mv + 1)));
    }
    #[test]
    fn failures_exit_and_never_accept_a_read_without_cleanup() {
        for q in [Query::Connected, Query::Mode, Query::Battery] {
            let mut io = Fake {
                fail: Some(q),
                ..Default::default()
            };
            assert!(session(&mut io).is_err());
            assert!(io.exited);
        }
        let mut io = Fake {
            exit: false,
            ..Default::default()
        };
        assert_eq!(session(&mut io).unwrap_err(), "g435ExitUnconfirmed");
    }
    #[test]
    fn off_or_unknown_link_never_queries_battery() {
        for linked in [None, Some(0)] {
            let mut io = Fake {
                linked,
                ..Default::default()
            };
            assert!(session(&mut io).is_err());
            assert!(!io.calls.contains(&Query::Battery));
        }
    }
    #[test]
    fn existing_bridge_session_is_not_closed() {
        let mut io = Fake {
            busy: true,
            ..Default::default()
        };
        assert_eq!(session(&mut io).unwrap_err(), "g435Busy");
        assert!(!io.exited);
        assert!(io.calls.is_empty());
    }
    #[test]
    fn remote_mode_is_checked_before_battery() {
        let mut io = Fake {
            mode: 0,
            ..Default::default()
        };
        assert_eq!(session(&mut io).unwrap().estimated_percent, 83);
        assert_eq!(
            io.calls,
            vec![
                Query::Connected,
                Query::Mode,
                Query::Remote,
                Query::Mode,
                Query::Battery
            ]
        );
    }
    #[test]
    fn parser_rejects_padding_wrong_sequence_and_echo() {
        let mut bytes = vec![0; 64];
        bytes[0] = 6;
        bytes[1..8].copy_from_slice(&[7, 0, 6, 0x85, 0, 0xbd, 0x0f]);
        bytes[63] = 7;
        assert_eq!(parse(&bytes, Query::Battery, 5), Some(4029));
        assert_eq!(parse(&bytes, Query::Battery, 4), None);
        bytes[63] = 0;
        assert_eq!(parse(&bytes, Query::Battery, 5), None);
        assert_eq!(
            parse(&frame(4, &command(Query::Battery, 5)), Query::Battery, 5),
            None
        );
    }
    #[test]
    fn history_expires_and_does_not_accept_future_or_invented_values() {
        let mut r = Reading {
            millivolts: 4029,
            estimated_percent: 83,
            read_at: 1000,
        };
        assert!(r.valid(1001));
        assert!(!r.valid(999));
        assert!(!r.valid(1000 + 24 * 60 * 60 * 1000));
        r.estimated_percent = 100;
        assert!(!r.valid(1001));
    }
}
