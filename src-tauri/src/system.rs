use serde_json::{json, Value};
use std::{collections::HashMap, path::{Path, PathBuf}, process::{Command, Stdio}, os::windows::process::CommandExt, sync::Mutex, time::{Duration, Instant}};
use windows::core::{Interface, PCWSTR, w};

const APPS_PREFIX: &str = "shell:AppsFolder\\";
static APPS_CACHE: Mutex<Option<(Instant, Vec<Value>)>> = Mutex::new(None);
static ICON_CACHE: Mutex<Option<HashMap<String, (Instant, Option<String>)>>> = Mutex::new(None);

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
    if let Some(aumid) = path.strip_prefix(APPS_PREFIX) {
        if reveal || elevated { return Err("Store apps do not support reveal or administrator launch".into()); }
        return launch_store(aumid);
    }
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

pub fn run_vpn_command(text: &str, elevated: bool) -> Result<(), String> {
    use base64::Engine;
    if text.trim().is_empty() || text.len() > 16384 || text.contains('\0') { return Err("VPN command must contain 1–16384 characters".into()); }
    let script = format!("$ErrorActionPreference='Stop'; try {{ & {{ {text}\n }}; if (-not $?) {{ exit 1 }}; if ($null -ne $LASTEXITCODE) {{ exit $LASTEXITCODE }} }} catch {{ exit 1 }}");
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    if elevated {
        use windows::Win32::{Foundation::{CloseHandle, WAIT_OBJECT_0}, System::Threading::{GetExitCodeProcess, WaitForSingleObject}, UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW, SEE_MASK_NOCLOSEPROCESS, SEE_MASK_NOASYNC}};
        let args: Vec<_> = format!("-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand {encoded}").encode_utf16().chain(Some(0)).collect();
        let mut info = SHELLEXECUTEINFOW { cbSize:std::mem::size_of::<SHELLEXECUTEINFOW>() as u32, fMask:SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC, lpVerb:w!("runas"), lpFile:w!("powershell.exe"), lpParameters:PCWSTR(args.as_ptr()), nShow:0, ..Default::default() };
        unsafe {
            ShellExecuteExW(&mut info).map_err(|e|format!("Windows could not elevate the VPN command: {e}"))?;
            if info.hProcess.is_invalid() { return Err("Windows did not return a VPN command process".into()); }
            let wait = WaitForSingleObject(info.hProcess, 30000);
            let mut code = 1;
            let queried = GetExitCodeProcess(info.hProcess, &mut code);
            let _ = CloseHandle(info.hProcess);
            if wait != WAIT_OBJECT_0 { return Err("VPN command did not finish within 30 seconds; its result is unknown".into()); }
            queried.map_err(|e|e.to_string())?;
            return if code == 0 { Ok(()) } else { Err(format!("VPN command exited with code {code}")) };
        }
    }
    let mut child = command("powershell.exe").args(["-NoProfile","-NonInteractive","-EncodedCommand",&encoded]).spawn().map_err(|e|e.to_string())?;
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e|e.to_string())? {
            return if status.success() { Ok(()) } else { Err(format!("VPN command exited with code {}",status.code().unwrap_or(-1))) };
        }
        if started.elapsed() >= Duration::from_secs(30) { let _ = child.kill(); let _ = child.wait(); return Err("VPN command exceeded 30 seconds".into()); }
        std::thread::sleep(Duration::from_millis(50));
    }
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

fn desktop_apps() -> Vec<Value> {
    let mut out = Vec::new();
    for base in [std::env::var_os("APPDATA").map(PathBuf::from), std::env::var_os("PROGRAMDATA").map(PathBuf::from)].into_iter().flatten() {
        collect(&base.join("Microsoft/Windows/Start Menu/Programs"), 6, 2000, &mut out, None, true);
    }
    out.sort_by(|a,b| a["name"].as_str().unwrap_or_default().cmp(b["name"].as_str().unwrap_or_default()));
    out.dedup_by(|a,b| a["path"] == b["path"]);
    out
}

fn valid_aumid(aumid: &str) -> bool {
    aumid.len() <= 256 && aumid.split_once('!').is_some_and(|(family, app)| {
        !family.is_empty() && !app.is_empty() && aumid.chars().all(|c|c.is_ascii_alphanumeric() || "._!-".contains(c))
    })
}

unsafe fn shell_name(item: &windows::Win32::UI::Shell::IShellItem, mode: windows::Win32::UI::Shell::SIGDN) -> Option<String> {
    let raw = item.GetDisplayName(mode).ok()?;
    let result = raw.to_string().ok();
    windows::Win32::System::Com::CoTaskMemFree(Some(raw.0 as _));
    result
}

fn store_apps() -> Vec<Value> {
    use windows::Win32::UI::Shell::*;
    let Ok(_apartment) = crate::audio::ComApartment::new() else { return Vec::new(); };
    unsafe {
        let Ok(folder): Result<IShellItem, _> = SHCreateItemFromParsingName(w!("shell:AppsFolder"), None) else { return Vec::new(); };
        let Ok(items): Result<IEnumShellItems, _> = folder.BindToHandler(None, &BHID_EnumItems) else { return Vec::new(); };
        let mut output = Vec::new();
        for _ in 0..2000 {
            let mut fetched = 0;
            let mut next = [None];
            if items.Next(&mut next, Some(&mut fetched)).is_err() || fetched == 0 { break; }
            let Some(item) = next[0].take() else { continue; };
            let Some(aumid) = shell_name(&item, SIGDN_PARENTRELATIVEPARSING).filter(|id|valid_aumid(id)) else { continue; };
            let name = shell_name(&item, SIGDN_NORMALDISPLAY).unwrap_or_else(||aumid.clone());
            output.push(json!({"path":format!("{APPS_PREFIX}{aumid}"),"name":name,"aumid":aumid,"isDir":false,"kind":"app","icon":null,"exists":true,"size":0}));
        }
        output
    }
}

/// Cache inventory on demand; the HUD never scans Start Menu/AppX in a timer.
pub fn apps() -> Vec<Value> {
    let mut cache = APPS_CACHE.lock().unwrap_or_else(|e|e.into_inner());
    if let Some((at, items)) = cache.as_ref() { if at.elapsed() < Duration::from_secs(60) { return items.clone(); } }
    let mut items = desktop_apps();
    items.extend(store_apps());
    items.sort_by(|a,b|a["name"].as_str().unwrap_or_default().to_lowercase().cmp(&b["name"].as_str().unwrap_or_default().to_lowercase()));
    items.dedup_by(|a,b|a["path"] == b["path"]);
    *cache = Some((Instant::now(), items.clone()));
    items
}

pub fn app_item(path: &str) -> Result<Value, String> {
    if path.starts_with(APPS_PREFIX) {
        return apps().into_iter().find(|item|item["path"].as_str() == Some(path)).ok_or_else(||"Store app is no longer installed".into());
    }
    let local = Path::new(path);
    if !local.exists() { return Err(format!("File does not exist: {path}")); }
    Ok(item(local))
}

fn launch_store(aumid: &str) -> Result<(), String> {
    use windows::Win32::{System::Com::{CoCreateInstance, CLSCTX_LOCAL_SERVER}, UI::Shell::{ApplicationActivationManager, IApplicationActivationManager, AO_NONE}};
    if !valid_aumid(aumid) { return Err("Invalid Store application ID".into()); }
    let _apartment = crate::audio::ComApartment::new()?;
    let wide: Vec<_> = aumid.encode_utf16().chain(Some(0)).collect();
    unsafe {
        let manager: IApplicationActivationManager = CoCreateInstance(&ApplicationActivationManager, None, CLSCTX_LOCAL_SERVER).map_err(|e|e.to_string())?;
        manager.ActivateApplication(PCWSTR(wide.as_ptr()), PCWSTR::null(), AO_NONE).map(|_|()).map_err(|e|e.to_string())
    }
}

fn shell_icon(path: &str) -> Option<String> {
    use windows::Win32::{Foundation::SIZE, Graphics::Gdi::*, UI::Shell::*};
    let _apartment = crate::audio::ComApartment::new().ok()?;
    let wide: Vec<_> = path.encode_utf16().chain(Some(0)).collect();
    unsafe {
        let shell: IShellItem = SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None).ok()?;
        let factory: IShellItemImageFactory = shell.cast().ok()?;
        let bitmap = factory.GetImage(SIZE { cx:64, cy:64 }, SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK).ok()?;
        let result = (|| {
            let mut details = BITMAP::default();
            if GetObjectW(bitmap, std::mem::size_of::<BITMAP>() as i32, Some(&mut details as *mut _ as _)) == 0 { return None; }
            let (width, height) = (details.bmWidth, details.bmHeight.abs());
            if width <= 0 || height <= 0 || width > 256 || height > 256 { return None; }
            let mut info = BITMAPINFO::default();
            info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            info.bmiHeader.biWidth = width;
            info.bmiHeader.biHeight = -height;
            info.bmiHeader.biPlanes = 1;
            info.bmiHeader.biBitCount = 32;
            info.bmiHeader.biCompression = BI_RGB.0;
            let mut bytes = vec![0u8; width as usize * height as usize * 4];
            let dc = GetDC(None);
            if dc.is_invalid() { return None; }
            let rows = GetDIBits(dc, bitmap, 0, height as u32, Some(bytes.as_mut_ptr() as _), &mut info, DIB_RGB_COLORS);
            ReleaseDC(None, dc);
            if rows != height { return None; }
            let has_alpha = bytes.chunks_exact(4).any(|pixel|pixel[3] != 0);
            for pixel in bytes.chunks_exact_mut(4) {
                pixel.swap(0, 2);
                if !has_alpha { pixel[3] = 255; }
                // Shell bitmaps contain premultiplied channels; PNG expects straight alpha.
                else if pixel[3] > 0 && pixel[3] < 255 { for channel in 0..3 { pixel[channel] = ((pixel[channel] as u32 * 255 / pixel[3] as u32).min(255)) as u8; } }
            }
            let image = image::RgbaImage::from_raw(width as u32, height as u32, bytes)?;
            crate::capture::data_url(&image::imageops::thumbnail(&image,64,64)).ok()
        })();
        let _ = DeleteObject(bitmap);
        result
    }
}

/// Resolve native executable, shortcut and packaged-app icons only when requested.
pub fn icon(path: &str) -> Option<String> {
    if path.is_empty() || path.len() > 32768 || path.contains('\0') { return None; }
    {
        let cache = ICON_CACHE.lock().unwrap_or_else(|e|e.into_inner());
        if let Some((at, result)) = cache.as_ref().and_then(|entries|entries.get(path)) {
            if at.elapsed() < Duration::from_secs(if result.is_some() {300} else {30}) { return result.clone(); }
        }
    }
    let result = shell_icon(path);
    let mut cache = ICON_CACHE.lock().unwrap_or_else(|e|e.into_inner());
    let entries = cache.get_or_insert_with(HashMap::new);
    if entries.len() >= 256 { entries.retain(|_,(at,_)|at.elapsed() < Duration::from_secs(30)); if entries.len() >= 256 { entries.clear(); } }
    entries.insert(path.into(), (Instant::now(),result.clone()));
    result
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
    fn packaged_ids_accept_real_ids_and_reject_paths_and_arguments() {
        assert!(valid_aumid("Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"));
        assert!(valid_aumid("Vendor.App_xyz!Desktop.App"));
        for id in ["", "App", "!App", "Family!", "Family!App --flag", "Family!../App", "Family!App\\other", "Family!App\0hidden"] { assert!(!valid_aumid(id),"{id:?}"); }
        assert!(!valid_aumid(&format!("{}!App","a".repeat(257))));
    }
    #[test]
    fn executable_icons_are_native_png_and_cached() {
        let root=std::env::var("WINDIR").unwrap_or_else(|_|"C:\\Windows".into());
        let path=format!("{root}\\System32\\notepad.exe");
        let first=icon(&path).expect("Windows Notepad should have a native executable icon");
        assert!(first.starts_with("data:image/png;base64,"));
        assert_eq!(icon(&path),Some(first));
        assert!(icon("missing-island-icon.exe").is_none());
    }
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
