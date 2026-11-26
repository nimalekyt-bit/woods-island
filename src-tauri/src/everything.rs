use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const EVERYTHING_IPC_COPYDATAQUERYW: usize = 2;
const EVERYTHING_IPC_FOLDER: u32 = 0x0000_0001;
const REPLY_MSG_ID: u32 = 0x5749_4556; // "WIEV"
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static IPC_LOCK: Mutex<()> = Mutex::new(());
static IPC_REPLY_BUFFER: Mutex<Option<Vec<u8>>> = Mutex::new(None);

#[cfg(target_os = "windows")]
fn find_everything_window() -> Option<windows::Win32::Foundation::HWND> {
    use windows::core::w;
    use windows::Win32::UI::WindowsAndMessaging::FindWindowW;
    unsafe {
        for class in [
            w!("EVERYTHING_TASKBAR_NOTIFICATION"),
            w!("EVERYTHING_TASKBAR_NOTIFICATION_(1.5a)"),
        ] {
            if let Ok(hwnd) = FindWindowW(class, None) {
                if !hwnd.0.is_null() {
                    return Some(hwnd);
                }
            }
        }
    }
    None
}

fn find_es_exe() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            candidates.push(dir.join("es.exe"));
        }
    }
    for env_key in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(env_key) {
            let b = PathBuf::from(base);
            candidates.push(b.join("Everything").join("es.exe"));
            candidates.push(b.join("Everything 1.5a").join("es.exe"));
            candidates.push(b.join("Microsoft").join("WinGet").join("Links").join("es.exe"));
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

pub fn is_available() -> bool {
    #[cfg(target_os = "windows")]
    if find_everything_window().is_some() {
        return true;
    }
    find_es_exe().is_some()
}

fn make_result_item(full_path: &Path, is_dir_hint: Option<bool>) -> Value {
    let metadata = std::fs::metadata(full_path).ok();
    let is_dir = is_dir_hint
        .or_else(|| metadata.as_ref().map(|m| m.is_dir()))
        .unwrap_or(false);
    let name = if is_dir {
        full_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned()
    } else {
        full_path
            .file_stem()
            .or_else(|| full_path.file_name())
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned()
    };
    json!({
        "path": full_path.to_string_lossy(),
        "name": name,
        "isDir": is_dir,
        "kind": if is_dir { "folder" } else { "file" },
        "icon": null,
        "exists": metadata.is_some() || is_dir_hint.is_some(),
        "size": metadata.map(|m| m.len()).unwrap_or(0),
        "source": "everything"
    })
}

fn read_u32_le(buf: &[u8], offset: usize) -> Option<u32> {
    let slice = buf.get(offset..offset + 4)?;
    Some(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_utf16_z(buf: &[u8], byte_offset: usize) -> Option<String> {
    if byte_offset >= buf.len() {
        return None;
    }
    let mut units = Vec::new();
    let mut pos = byte_offset;
    while pos + 1 < buf.len() {
        let code = u16::from_le_bytes([buf[pos], buf[pos + 1]]);
        if code == 0 {
            break;
        }
        units.push(code);
        pos += 2;
        if units.len() > 4096 {
            break;
        }
    }
    Some(String::from_utf16_lossy(&units))
}

/// Parses an `EVERYTHING_IPC_LISTW` payload returned via `WM_COPYDATA`.
pub fn parse_everything_ipc_list_w(buf: &[u8], max_results: usize) -> Vec<Value> {
    // Header layout: 7 u32 fields = 28 bytes (totfolders, totfiles, totitems, numfolders, numfiles, numitems, offset)
    if buf.len() < 28 {
        return Vec::new();
    }
    let num_items = read_u32_le(buf, 20).unwrap_or(0) as usize;
    let count = num_items.min(max_results).min(200);
    let mut out = Vec::with_capacity(count);
    let mut seen = HashSet::new();

    for i in 0..count {
        let entry_off = 28 + i * 12;
        let Some(flags) = read_u32_le(buf, entry_off) else { break };
        let Some(filename_off) = read_u32_le(buf, entry_off + 4) else { break };
        let Some(path_off) = read_u32_le(buf, entry_off + 8) else { break };
        let Some(filename) = read_utf16_z(buf, filename_off as usize) else { continue };
        let Some(dir_path) = read_utf16_z(buf, path_off as usize) else { continue };
        if filename.is_empty() {
            continue;
        }
        let full = if dir_path.is_empty() {
            PathBuf::from(&filename)
        } else {
            Path::new(&dir_path).join(&filename)
        };
        let key = full.to_string_lossy().to_lowercase();
        if !seen.insert(key) {
            continue;
        }
        let is_dir = (flags & EVERYTHING_IPC_FOLDER) != 0;
        out.push(make_result_item(&full, Some(is_dir)));
    }
    out
}

/// Parses line-delimited paths returned by Voidtools `es.exe`.
pub fn parse_es_output(stdout: &str, max_results: usize) -> Vec<Value> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for raw_line in stdout.lines() {
        if out.len() >= max_results {
            break;
        }
        let line = raw_line.trim().trim_matches('"');
        if line.is_empty() {
            continue;
        }
        let key = line.to_lowercase();
        if !seen.insert(key) {
            continue;
        }
        out.push(make_result_item(Path::new(line), None));
    }
    out
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn reply_wnd_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::System::DataExchange::COPYDATASTRUCT;
    use windows::Win32::UI::WindowsAndMessaging::{DefWindowProcW, WM_COPYDATA};
    if msg == WM_COPYDATA {
        let cds = lparam.0 as *const COPYDATASTRUCT;
        if !cds.is_null() {
            let cds_ref = &*cds;
            if cds_ref.dwData == REPLY_MSG_ID as usize && !cds_ref.lpData.is_null() && cds_ref.cbData > 0 {
                let len = (cds_ref.cbData as usize).min(4 * 1024 * 1024);
                let bytes = std::slice::from_raw_parts(cds_ref.lpData as *const u8, len).to_vec();
                if let Ok(mut guard) = IPC_REPLY_BUFFER.lock() {
                    *guard = Some(bytes);
                }
                return LRESULT(1);
            }
        }
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn query_via_ipc(query: &str, max_results: usize) -> Option<Vec<Value>> {
    use windows::core::w;
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::System::DataExchange::COPYDATASTRUCT;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DestroyWindow, DispatchMessageW, PeekMessageW, RegisterClassW,
        SendMessageTimeoutW, TranslateMessage, HWND_MESSAGE, MSG, PM_REMOVE, SMTO_ABORTIFHUNG,
        WINDOW_EX_STYLE, WINDOW_STYLE, WM_COPYDATA, WNDCLASSW,
    };

    let target = find_everything_window()?;
    let _guard = IPC_LOCK.lock().ok()?;
    if let Ok(mut slot) = IPC_REPLY_BUFFER.lock() {
        *slot = None;
    }

    unsafe {
        let hinst = GetModuleHandleW(None).ok()?;
        let class_name = w!("WoodsIslandEverythingReply");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(reply_wnd_proc),
            hInstance: hinst.into(),
            lpszClassName: class_name,
            ..Default::default()
        };
        let _ = RegisterClassW(&wc);

        let reply_hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            class_name,
            w!(""),
            WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            HWND_MESSAGE,
            None,
            hinst,
            None,
        )
        .ok()?;

        // Build EVERYTHING_IPC_QUERYW: 5 u32s + UTF-16LE query + NUL
        let mut payload = Vec::with_capacity(20 + (query.len() + 1) * 2);
        payload.extend_from_slice(&(reply_hwnd.0 as u32).to_le_bytes());
        payload.extend_from_slice(&REPLY_MSG_ID.to_le_bytes());
        payload.extend_from_slice(&0u32.to_le_bytes()); // search_flags
        payload.extend_from_slice(&0u32.to_le_bytes()); // offset
        payload.extend_from_slice(&(max_results as u32).to_le_bytes());
        for unit in query.encode_utf16() {
            payload.extend_from_slice(&unit.to_le_bytes());
        }
        payload.extend_from_slice(&0u16.to_le_bytes());

        let cds = COPYDATASTRUCT {
            dwData: EVERYTHING_IPC_COPYDATAQUERYW,
            cbData: payload.len() as u32,
            lpData: payload.as_mut_ptr() as *mut _,
        };

        let mut send_result: usize = 0;
        let sent = SendMessageTimeoutW(
            target,
            WM_COPYDATA,
            WPARAM(reply_hwnd.0 as usize),
            LPARAM(&cds as *const _ as isize),
            SMTO_ABORTIFHUNG,
            400,
            Some(&mut send_result),
        );

        let mut received: Option<Vec<u8>> = None;
        if sent.0 != 0 {
            let deadline = Instant::now() + Duration::from_millis(450);
            let mut msg = MSG::default();
            while Instant::now() < deadline {
                if let Ok(mut slot) = IPC_REPLY_BUFFER.lock() {
                    if let Some(buf) = slot.take() {
                        received = Some(buf);
                        break;
                    }
                }
                while PeekMessageW(&mut msg, reply_hwnd, 0, 0, PM_REMOVE).as_bool() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
                if let Ok(mut slot) = IPC_REPLY_BUFFER.lock() {
                    if let Some(buf) = slot.take() {
                        received = Some(buf);
                        break;
                    }
                }
                std::thread::sleep(Duration::from_millis(5));
            }
        }

        let _ = DestroyWindow(reply_hwnd);
        received.map(|buf| parse_everything_ipc_list_w(&buf, max_results))
    }
}

fn query_via_es(query: &str, max_results: usize) -> Option<Vec<Value>> {
    use std::os::windows::process::CommandExt;
    let es = find_es_exe()?;
    let output = std::process::Command::new(es)
        .args(["-n", &max_results.to_string(), query])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Some(parse_es_output(&stdout, max_results))
}

/// Searches the entire PC via Voidtools Everything (native IPC first, then `es.exe`).
/// Returns `None` if Everything is not installed or running, so caller can fall back to built-in search.
pub fn search(query: &str, max_results: usize) -> Option<Vec<Value>> {
    let trimmed = query.trim();
    if trimmed.len() < 2 || trimmed.len() > 256 || trimmed.contains('\0') {
        return None;
    }
    #[cfg(target_os = "windows")]
    if let Some(items) = query_via_ipc(trimmed, max_results) {
        return Some(items);
    }
    query_via_es(trimmed, max_results)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn push_utf16_z(buf: &mut Vec<u8>, text: &str) {
        for u in text.encode_utf16() {
            buf.extend_from_slice(&u.to_le_bytes());
        }
        buf.extend_from_slice(&0u16.to_le_bytes());
    }

    #[test]
    fn parses_everything_ipc_list_w_with_unicode_files_and_folders() {
        let mut buf = Vec::new();
        // 7 header u32s: totfolders=1, totfiles=1, totitems=2, numfolders=1, numfiles=1, numitems=2, offset=0
        for v in [1u32, 1, 2, 1, 1, 2, 0] {
            buf.extend_from_slice(&v.to_le_bytes());
        }
        let items_start = buf.len();
        buf.resize(items_start + 2 * 12, 0);

        let f1_off = buf.len() as u32;
        push_utf16_z(&mut buf, "Проекты");
        let p1_off = buf.len() as u32;
        push_utf16_z(&mut buf, "D:\\Work");

        let f2_off = buf.len() as u32;
        push_utf16_z(&mut buf, "Отчёт 2026.pdf");
        let p2_off = buf.len() as u32;
        push_utf16_z(&mut buf, "C:\\Users\\Woods\\Documents");

        // Write item 0 (folder)
        buf[items_start..items_start + 4].copy_from_slice(&EVERYTHING_IPC_FOLDER.to_le_bytes());
        buf[items_start + 4..items_start + 8].copy_from_slice(&f1_off.to_le_bytes());
        buf[items_start + 8..items_start + 12].copy_from_slice(&p1_off.to_le_bytes());

        // Write item 1 (file)
        let i1 = items_start + 12;
        buf[i1..i1 + 4].copy_from_slice(&0u32.to_le_bytes());
        buf[i1 + 4..i1 + 8].copy_from_slice(&f2_off.to_le_bytes());
        buf[i1 + 8..i1 + 12].copy_from_slice(&p2_off.to_le_bytes());

        let parsed = parse_everything_ipc_list_w(&buf, 20);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["isDir"], true);
        assert_eq!(parsed[0]["kind"], "folder");
        assert_eq!(parsed[0]["name"], "Проекты");
        assert_eq!(parsed[0]["path"], "D:\\Work\\Проекты");
        assert_eq!(parsed[0]["source"], "everything");
        assert_eq!(parsed[1]["isDir"], false);
        assert_eq!(parsed[1]["kind"], "file");
        assert_eq!(parsed[1]["name"], "Отчёт 2026");
        assert_eq!(parsed[1]["path"], "C:\\Users\\Woods\\Documents\\Отчёт 2026.pdf");
    }

    #[test]
    fn malformed_or_truncated_ipc_buffer_returns_safely() {
        assert!(parse_everything_ipc_list_w(&[], 10).is_empty());
        assert!(parse_everything_ipc_list_w(&[1, 2, 3, 4], 10).is_empty());
        let mut bogus = vec![0u8; 28];
        bogus[20..24].copy_from_slice(&50u32.to_le_bytes()); // claims 50 items, has 0 bytes
        assert!(parse_everything_ipc_list_w(&bogus, 10).is_empty());
    }

    #[test]
    fn parses_es_cli_output_deduplicating_and_respecting_limit() {
        let out = "\n\"C:\\Docs\\Тест.docx\"\nC:\\Docs\\тест.docx\nD:\\Games\\Warface.exe\nE:\\Extra\\file.txt\n";
        let parsed = parse_es_output(out, 2);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0]["name"], "Тест");
        assert_eq!(parsed[1]["name"], "Warface");
    }
}
