//! Bounded AIMP Remote API and Winamp IPC adapters for players without GSMTC.
use serde_json::{json, Value};
use windows::{core::{w, PCWSTR}, Win32::{
    Foundation::{CloseHandle, HANDLE, HWND, LPARAM, WPARAM},
    System::{Memory::{MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ}, Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION}},
    UI::WindowsAndMessaging::{FindWindowW, GetWindowTextW, GetWindowThreadProcessId, SendMessageTimeoutW, SMTO_ABORTIFHUNG, WM_COMMAND, WM_USER},
}};

const TIMEOUT_MS: u32 = 400;
const AIMP_MAPPING_BYTES: usize = 2048;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LegacyKind { Aimp, Winamp }
impl LegacyKind {
    pub fn id(self) -> &'static str { match self { Self::Aimp => "woods.legacy.aimp", Self::Winamp => "woods.legacy.winamp" } }
    pub fn name(self) -> &'static str { match self { Self::Aimp => "AIMP", Self::Winamp => "Winamp" } }
    fn executable(self) -> &'static str { match self { Self::Aimp => "aimp.exe", Self::Winamp => "winamp.exe" } }
    fn class(self) -> PCWSTR { match self { Self::Aimp => w!("AIMP2_RemoteInfo"), Self::Winamp => w!("Winamp v1.x") } }
    pub fn from_id(id: &str) -> Option<Self> { [Self::Aimp, Self::Winamp].into_iter().find(|kind| kind.id() == id) }
}

struct OwnedHandle(HANDLE);
impl Drop for OwnedHandle { fn drop(&mut self) { let _ = unsafe { CloseHandle(self.0) }; } }

unsafe fn message(window: HWND, code: u32, wparam: usize, lparam: isize) -> Result<isize, String> {
    let mut result = 0;
    let ok = SendMessageTimeoutW(window, code, WPARAM(wparam), LPARAM(lparam), SMTO_ABORTIFHUNG, TIMEOUT_MS, Some(&mut result));
    if ok.0 == 0 { Err("Плеер не ответил вовремя".into()) } else { Ok(result as isize) }
}

unsafe fn find(kind: LegacyKind) -> Option<(HWND, u32)> {
    let window = FindWindowW(kind.class(), None).ok()?;
    let mut pid = 0;
    GetWindowThreadProcessId(window, Some(&mut pid));
    if pid == 0 { return None; }
    let process = OwnedHandle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?);
    let mut path = [0u16; 32768];
    let mut length = path.len() as u32;
    QueryFullProcessImageNameW(process.0, PROCESS_NAME_WIN32, windows::core::PWSTR(path.as_mut_ptr()), &mut length).ok()?;
    let path = String::from_utf16_lossy(&path[..length as usize]);
    if !path.rsplit(['/', '\\']).next()?.eq_ignore_ascii_case(kind.executable()) { return None; }
    Some((window, pid))
}

#[derive(Debug, PartialEq)]
pub struct AimpInfo { pub title: String, pub artist: String, pub album: String, pub file: String, pub duration_ms: u64 }

pub fn parse_aimp_info(bytes: &[u8]) -> Result<AimpInfo, String> {
    let bounded = bytes.get(..AIMP_MAPPING_BYTES).ok_or("AIMP вернул неполный отчёт")?;
    let number = |offset| u32::from_le_bytes(bounded[offset..offset + 4].try_into().unwrap());
    if number(4) == 0 { return Err("В AIMP нет активного трека".into()); }
    let mut strings = Vec::with_capacity(6);
    let mut offset = 88usize;
    for field in 0..6 {
        let count = usize::try_from(number(40 + field * 4)).map_err(|_| "Некорректная длина строки AIMP")?;
        let end = count.checked_mul(2).and_then(|length| offset.checked_add(length)).filter(|end| *end <= bounded.len()).ok_or("Строка AIMP выходит за отчёт")?;
        let utf16 = bounded[offset..end].chunks_exact(2).map(|unit| u16::from_le_bytes([unit[0], unit[1]])).collect::<Vec<_>>();
        strings.push(String::from_utf16_lossy(&utf16).trim_matches('\0').trim().to_owned());
        offset = end;
    }
    let title = if strings[5].is_empty() {
        strings[3].rsplit(['/', '\\']).next().unwrap_or_default().rsplit_once('.').map(|(name, _)| name).unwrap_or(&strings[3]).to_owned()
    } else { strings[5].clone() };
    if title.is_empty() { return Err("В AIMP нет названия трека".into()); }
    Ok(AimpInfo { title, artist: strings[1].clone(), album: strings[0].clone(), file: strings[3].clone(), duration_ms: u64::from(number(16)) })
}

pub unsafe fn read_aimp_mapping(name: PCWSTR) -> Result<AimpInfo, String> {
    let mapping = OwnedHandle(OpenFileMappingW(FILE_MAP_READ.0, false, name).map_err(|e| e.to_string())?);
    let view = MapViewOfFile(mapping.0, FILE_MAP_READ, 0, 0, AIMP_MAPPING_BYTES);
    if view.Value.is_null() { return Err("Не удалось прочитать отчёт AIMP".into()); }
    // Copy before unmapping: metadata is owned by the player and may change between polls.
    let bytes = std::slice::from_raw_parts(view.Value.cast::<u8>(), AIMP_MAPPING_BYTES).to_vec();
    let _ = UnmapViewOfFile(view);
    parse_aimp_info(&bytes)
}

pub fn parse_winamp_title(caption: &str) -> Option<(String, String)> {
    let mut caption = caption.trim();
    for suffix in [" [Paused]", " [Stopped]", " *", " - Winamp", " – Winamp"] {
        if let Some(value) = caption.strip_suffix(suffix) { caption = value.trim_end(); }
    }
    // The classic title prepends the playlist position. Never strip a track's ordinary digits.
    if let Some((index, title)) = caption.split_once(". ") {
        if !index.is_empty() && index.bytes().all(|c| c.is_ascii_digit()) { caption = title; }
    }
    if caption.is_empty() || caption.eq_ignore_ascii_case("winamp") { return None; }
    Some(match caption.split_once(" - ") { Some((artist, title)) if !title.trim().is_empty() => (title.trim().to_owned(), artist.trim().to_owned()), _ => (caption.to_owned(), String::new()) })
}

/// The window-specific entry also permits genuine Win32 fixture tests without launching a player.
pub unsafe fn snapshot_window(kind: LegacyKind, window: HWND, pid: u32, aimp_info: impl FnOnce() -> Result<AimpInfo, String>) -> Result<Value, String> {
    let state = match kind { LegacyKind::Aimp => message(window, WM_USER + 0x77, 0x40, 0)?, LegacyKind::Winamp => message(window, WM_USER, 0, 104)? };
    if !match kind { LegacyKind::Aimp => [1, 2].contains(&state), LegacyKind::Winamp => [1, 3].contains(&state) } { return Err("В плеере нет активного трека".into()); }
    let (title, artist, album, duration, position) = match kind {
        LegacyKind::Aimp => {
            let info = aimp_info()?;
            let duration = message(window, WM_USER + 0x77, 0x30, 0).ok().filter(|n| *n > 0).map(|n| n as u64).unwrap_or(info.duration_ms);
            let position = message(window, WM_USER + 0x77, 0x20, 0)?.max(0) as u64;
            (info.title, info.artist, info.album, duration, position)
        },
        LegacyKind::Winamp => {
            let mut caption = [0u16; 1024];
            let length = GetWindowTextW(window, &mut caption).max(0) as usize;
            let (title, artist) = parse_winamp_title(&String::from_utf16_lossy(&caption[..length])).ok_or("В Winamp нет названия трека")?;
            let position = message(window, WM_USER, 0, 105)?.max(0) as u64;
            let duration = (message(window, WM_USER, 1, 105)?.max(0) as u64).saturating_mul(1000);
            (title, artist, String::new(), duration, position)
        },
    };
    let key = format!("{}|{}|{}|{}", kind.id(), artist, album, title);
    let updated_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|time| time.as_millis() as u64).unwrap_or(0);
    Ok(json!({"key":key,"title": title,"artist": artist,"album":album,"app":kind.id(),"appName":kind.name(),"playing":state==1,"positionMs":if duration>0{position.min(duration)}else{position},"durationMs":duration,"cover":null,"canSeek":duration>0,"pid":pid,"updatedAt":updated_at,"sources":1}))
}

pub fn snapshots() -> Vec<Value> {
    [LegacyKind::Aimp, LegacyKind::Winamp].into_iter().filter_map(|kind| unsafe { let (window, pid) = find(kind)?; snapshot_window(kind, window, pid, || read_aimp_mapping(w!("AIMP2_RemoteInfo"))).ok() }).collect()
}

pub unsafe fn control_window(kind: LegacyKind, window: HWND, command: &str) -> Result<(), String> {
    match kind {
        LegacyKind::Aimp => {
            let code = match command { "play" => 13, "pause" => { if message(window, WM_USER + 0x77, 0x40, 0)? != 1 { return Ok(()); } 15 }, "toggle" => 14, "next" => 17, "prev" => 18, _ => return Err("Неизвестная команда плеера".into()) };
            message(window, WM_USER + 0x75, code, 0)?;
        },
        LegacyKind::Winamp => {
            let state = message(window, WM_USER, 0, 104)?;
            let code = match command { "play" if state == 1 => return Ok(()), "pause" if state != 1 => return Ok(()), "play" if state == 3 => 40046, "play" => 40045, "pause" => 40046, "toggle" if state == 1 || state == 3 => 40046, "toggle" => 40045, "next" => 40048, "prev" => 40044, _ => return Err("Неизвестная команда плеера".into()) };
            message(window, WM_COMMAND, code, 0)?;
        },
    }
    Ok(())
}

pub fn control(id: &str, command: &str) -> Result<(), String> {
    let kind = LegacyKind::from_id(id).ok_or("Неизвестный плеер")?;
    unsafe { let (window, _) = find(kind).ok_or("Плеер уже закрыт")?; control_window(kind, window, command) }
}

pub unsafe fn seek_window(window: HWND, position: u64) -> Result<(), String> {
    let position = usize::try_from(position.min(i32::MAX as u64)).map_err(|_| "Позиция трека слишком велика")?;
    message(window, WM_USER, position, 106)?;
    Ok(())
}

pub fn seek(id: &str, position: u64) -> Result<(), String> {
    let kind = LegacyKind::from_id(id).ok_or("Неизвестный плеер")?;
    unsafe { let (window, _) = find(kind).ok_or("Плеер уже закрыт")?; seek_window(window, position) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn captions_keep_unicode_and_remove_only_playlist_prefix() {
        assert_eq!(parse_winamp_title("12. Музыкант - Ночь - Winamp [Paused]"),Some(("Ночь".into(),"Музыкант".into())));
        assert_eq!(parse_winamp_title("1984 - Winamp"),Some(("1984".into(),String::new())));
        assert_eq!(parse_winamp_title("Winamp"),None);
    }
    #[test] fn aimp_report_rejects_corrupt_utf16_bounds_and_inactive_track() {
        let mut bytes=[0u8;2048];assert!(parse_aimp_info(&bytes).is_err());bytes[4]=1;
        bytes[40..44].copy_from_slice(&u32::MAX.to_le_bytes());assert!(parse_aimp_info(&bytes).is_err());
        assert!(parse_aimp_info(&bytes[..88]).is_err());
    }
}
