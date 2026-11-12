use serde_json::{json, Value};
use std::{path::{Path, PathBuf}, process::{Command, Stdio}, os::windows::process::CommandExt};
use windows::core::{PCWSTR, w};

pub fn command(program: &str) -> Command {
    let mut c = Command::new(program);
    c.creation_flags(0x08000000).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    c
}

pub fn process_name(pid: u32) -> Option<String> {
    use windows::Win32::{Foundation::CloseHandle, System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION}};
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = vec![0u16; 32768];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, windows::core::PWSTR(buf.as_mut_ptr()), &mut len);
        let _ = CloseHandle(handle);
        ok.ok()?;
        Path::new(&String::from_utf16_lossy(&buf[..len as usize])).file_name().map(|p| p.to_string_lossy().into_owned())
    }
}

pub fn open_path(path: &str, reveal: bool, elevated: bool) -> Result<(), String> {
    use windows::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    if path.trim().is_empty() { return Err("Path or URL is required".into()); }
    if reveal {
        return command("explorer.exe").arg(format!("/select,{}", path)).spawn().map(|_| ()).map_err(|e| e.to_string());
    }
    let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
    let verb = if elevated { w!("runas") } else { w!("open") };
    let result = unsafe { ShellExecuteW(None, verb, PCWSTR(wide.as_ptr()), None, None, SW_SHOWNORMAL) };
    if result.0 as isize > 32 { Ok(()) } else { Err(format!("Windows could not open the target (code {})", result.0 as isize)) }
}

pub fn run_shell(shell: &str, text: &str) -> Result<(), String> {
    let (program, option) = match shell.to_lowercase().as_str() {
        "cmd" | "cmd.exe" => ("cmd.exe", "/C"),
        "pwsh" | "pwsh.exe" => ("pwsh.exe", "-Command"),
        "powershell" | "powershell.exe" | "" => ("powershell.exe", "-Command"),
        _ => return Err("Supported shells: cmd, powershell, pwsh".into()),
    };
    command(program).arg(option).arg(text).spawn().map(|_| ()).map_err(|e| e.to_string())
}

pub fn item(path: &Path) -> Value {
    let metadata = std::fs::metadata(path).ok();
    let directory = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
    json!({"path":path.to_string_lossy(),"name":path.file_stem().unwrap_or_default().to_string_lossy(),"isDir":directory,"kind":if directory{"folder"}else{"file"},"icon":null,"exists":metadata.is_some(),"size":metadata.map(|m|m.len()).unwrap_or(0)})
}

fn collect(dir: &Path, depth: usize, max: usize, out: &mut Vec<Value>, query: Option<&str>, shortcuts: bool) {
    if out.len() >= max || depth == 0 { return; }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if out.len() >= max { break; }
            let path = entry.path();
            // Do not traverse symlinks/junctions or hidden dependency trees.
            let ty = match entry.file_type() { Ok(t) => t, Err(_) => continue };
            if ty.is_symlink() { continue; }
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if ["node_modules", ".git", "target", ".obsidian"].contains(&name.as_str()) { continue; }
            if ty.is_dir() {
                if !shortcuts && query.map(|q| name.contains(q)).unwrap_or(true) { out.push(item(&path)); }
                collect(&path, depth-1, max, out, query, shortcuts);
            } else if (!shortcuts || path.extension().map(|e| e.eq_ignore_ascii_case("lnk") || e.eq_ignore_ascii_case("url")).unwrap_or(false)) && query.map(|q| name.contains(q)).unwrap_or(true) {
                out.push(item(&path));
            }
        }
    }
}

pub fn apps() -> Vec<Value> {
    let mut out = Vec::new();
    for base in [std::env::var_os("APPDATA").map(PathBuf::from), std::env::var_os("PROGRAMDATA").map(PathBuf::from)].into_iter().flatten() {
        collect(&base.join("Microsoft/Windows/Start Menu/Programs"), 6, 2000, &mut out, None, true);
    }
    out.sort_by(|a,b| a["name"].as_str().unwrap_or_default().cmp(b["name"].as_str().unwrap_or_default()));
    out.dedup_by(|a,b| a["path"] == b["path"]);
    out
}

pub fn recent() -> Vec<Value> {
    let mut out = Vec::new();
    if let Some(base) = std::env::var_os("APPDATA") {
        collect(&PathBuf::from(base).join("Microsoft/Windows/Recent"), 1, 100, &mut out, None, true);
    }
    out
}

pub fn search_files(query: &str, folders: &[String]) -> Vec<Value> {
    if query.trim().len() < 2 { return Vec::new(); }
    let q = query.to_lowercase();
    let mut out = Vec::new();
    let defaults = std::env::var_os("USERPROFILE").map(|h| vec![PathBuf::from(&h).join("Desktop"),PathBuf::from(&h).join("Documents"),PathBuf::from(&h).join("Downloads")]).unwrap_or_default();
    let paths: Vec<PathBuf> = if folders.is_empty() { defaults } else { folders.iter().map(PathBuf::from).collect() };
    for path in paths { collect(&path, 4, 60, &mut out, Some(&q), false); }
    out
}

pub fn pick_files() -> Result<Vec<String>, String> {
    use windows::Win32::{System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED}, UI::Shell::{FileOpenDialog, IFileOpenDialog, FOS_ALLOWMULTISELECT, FOS_FILEMUSTEXIST, SIGDN_FILESYSPATH}};
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER).map_err(|e| e.to_string())?;
        let opts = dialog.GetOptions().map_err(|e| e.to_string())?;
        dialog.SetOptions(opts | FOS_ALLOWMULTISELECT | FOS_FILEMUSTEXIST).map_err(|e| e.to_string())?;
        if dialog.Show(None).is_err() { return Ok(vec![]); }
        let results = dialog.GetResults().map_err(|e| e.to_string())?;
        let mut files = Vec::new();
        for i in 0..results.GetCount().map_err(|e| e.to_string())? {
            if let Ok(item) = results.GetItemAt(i) {
                if let Ok(name) = item.GetDisplayName(SIGDN_FILESYSPATH) {
                    files.push(name.to_string().map_err(|e| e.to_string())?);
                    windows::Win32::System::Com::CoTaskMemFree(Some(name.0 as _));
                }
            }
        }
        Ok(files)
    }
}

pub fn autostart(enabled: bool) -> Result<(), String> {
    use windows::Win32::System::Registry::{RegCreateKeyExW, RegSetValueExW, RegDeleteValueW, RegCloseKey, HKEY_CURRENT_USER, HKEY, KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ};
    unsafe {
        let mut key = HKEY::default();
        RegCreateKeyExW(HKEY_CURRENT_USER, w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run"), 0, None, REG_OPTION_NON_VOLATILE, KEY_SET_VALUE, None, &mut key, None).ok().map_err(|e| e.to_string())?;
        let result = if enabled {
            let executable = std::env::current_exe().map_err(|e|e.to_string())?;
            let text = format!("\"{}\"", executable.display());
            let data: Vec<u16> = text.encode_utf16().chain(Some(0)).collect();
            let bytes = std::slice::from_raw_parts(data.as_ptr() as *const u8, data.len()*2);
            RegSetValueExW(key, w!("WoodsIsland"), 0, REG_SZ, Some(bytes)).ok().map_err(|e|e.to_string())
        } else {
            let status = RegDeleteValueW(key, w!("WoodsIsland"));
            if status.0 == 2 { Ok(()) } else { status.ok().map_err(|e|e.to_string()) }
        };
        let _ = RegCloseKey(key);
        result
    }
}

fn radio_states() -> (Option<bool>, Option<bool>) {
    let mut states = (None, None);
    let Ok(_apartment) = crate::audio::WinRtApartment::new() else { return states; };
    let Ok(radios) = windows::Devices::Radios::Radio::GetRadiosAsync().and_then(|op| op.get()) else { return states; };
    use windows::Devices::Radios::{RadioKind, RadioState};
    for radio in &radios {
        let (Ok(kind), Ok(state)) = (radio.Kind(), radio.State()) else { continue; };
        let slot = if kind == RadioKind::WiFi { &mut states.0 }
            else if kind == RadioKind::Bluetooth { &mut states.1 } else { continue; };
        *slot = Some(slot.unwrap_or(false) || state == RadioState::On);
    }
    states
}

pub fn radio_set(kind: windows::Devices::Radios::RadioKind, on: bool) -> Result<(), String> {
    let _apartment = crate::audio::WinRtApartment::new()?;
    use windows::Devices::Radios::{Radio, RadioState, RadioAccessStatus};
    let radios = Radio::GetRadiosAsync().map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
    for radio in &radios {
        if radio.Kind().map_err(|e|e.to_string())? == kind {
            let status = radio.SetStateAsync(if on { RadioState::On } else { RadioState::Off }).map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
            return if status == RadioAccessStatus::Allowed { Ok(()) } else { Err("Windows denied radio access. Use Windows network/Bluetooth settings.".into()) };
        }
    }
    Err("This computer has no such radio adapter".into())
}

pub fn controls() -> Value {
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
    let mut light = 0u32;
    let mut size = 4u32;
    let dark = unsafe { RegGetValueW(HKEY_CURRENT_USER, w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"), w!("AppsUseLightTheme"), RRF_RT_REG_DWORD, None, Some(&mut light as *mut _ as _), Some(&mut size)).is_ok() }.then_some(light == 0);
    let (wifi, bluetooth) = radio_states();
    let ethernet = crate::network::ethernet_adapter();
    json!({"wifi":wifi,"bluetooth":bluetooth,"ethernet":ethernet.as_ref().map(|a|a["connected"].as_bool().unwrap_or(false)),"ethernetAdapter":ethernet,"dark":dark,"canSleep":unsafe{windows::Win32::System::Power::IsPwrSuspendAllowed().as_bool()},"vpns":[]})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inventory_does_not_follow_dependency_trees() {
        let base = std::env::temp_dir().join(format!("woods-inventory-{}",std::process::id()));
        std::fs::create_dir_all(base.join("node_modules")).unwrap();
        std::fs::write(base.join("actual.txt"),"a").unwrap();
        std::fs::write(base.join("node_modules/hidden.txt"),"b").unwrap();
        let mut out=Vec::new(); collect(&base,4,100,&mut out,Some("txt"),false);
        assert_eq!(out.len(),1); assert_eq!(out[0]["name"],"actual");
        std::fs::remove_dir_all(base).unwrap();
    }
}
