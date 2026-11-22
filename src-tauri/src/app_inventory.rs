use serde_json::{json, Value};
use std::collections::BTreeMap;
use windows::Win32::UI::WindowsAndMessaging::*;
use windows::Win32::{
    Foundation::{BOOL, ERROR_SUCCESS, HWND, LPARAM},
    System::Registry::*,
};

pub fn executable(command: &str) -> Option<String> {
    let text = command.trim();
    let path = if let Some(quoted) = text.strip_prefix('"') {
        quoted.split('"').next()?
    } else {
        let end = text.to_ascii_lowercase().find(".exe")? + 4;
        &text[..end]
    };
    let name = path.rsplit(['\\', '/']).next()?.trim().to_lowercase();
    (name.ends_with(".exe") && name.len() < 256 && !name.contains(['\n', '\r', '"']))
        .then_some(name)
}
struct Key(HKEY);
impl Drop for Key {
    fn drop(&mut self) {
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}
fn open(root: HKEY, path: &str) -> Option<Key> {
    let path: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
    let mut key = HKEY::default();
    unsafe {
        (RegOpenKeyExW(
            root,
            windows::core::PCWSTR(path.as_ptr()),
            0,
            KEY_READ,
            &mut key,
        ) == ERROR_SUCCESS)
            .then_some(Key(key))
    }
}
fn value(key: HKEY, subkey: &str) -> Option<String> {
    let subkey: Vec<u16> = subkey.encode_utf16().chain(Some(0)).collect();
    let mut bytes = 0u32;
    unsafe {
        if RegGetValueW(
            key,
            windows::core::PCWSTR(subkey.as_ptr()),
            None,
            RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ,
            None,
            None,
            Some(&mut bytes),
        ) != ERROR_SUCCESS
            || bytes > 65536
        {
            return None;
        }
        let mut buffer = vec![0u16; (bytes as usize + 1) / 2];
        if RegGetValueW(
            key,
            windows::core::PCWSTR(subkey.as_ptr()),
            None,
            RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut bytes),
        ) != ERROR_SUCCESS
        {
            return None;
        }
        let end = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
        String::from_utf16(&buffer[..end]).ok()
    }
}
const BROWSERS: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "browser.exe",
    "opera.exe",
    "brave.exe",
    "vivaldi.exe",
    "librewolf.exe",
    "waterfox.exe",
    "floorp.exe",
    "zen.exe",
    "chromium.exe",
    "thorium.exe",
    "duckduckgo.exe",
];
pub fn browsers() -> Vec<String> {
    let mut found = std::collections::BTreeSet::new();
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for base in [
            "SOFTWARE\\Clients\\StartMenuInternet",
            "SOFTWARE\\WOW6432Node\\Clients\\StartMenuInternet",
        ] {
            let Some(key) = open(root, base) else {
                continue;
            };
            for index in 0..256 {
                let mut name = [0u16; 512];
                let mut size = name.len() as u32;
                let status = unsafe {
                    RegEnumKeyExW(
                        key.0,
                        index,
                        windows::core::PWSTR(name.as_mut_ptr()),
                        &mut size,
                        None,
                        windows::core::PWSTR::null(),
                        None,
                        None,
                    )
                };
                if status != ERROR_SUCCESS {
                    break;
                }
                let client = String::from_utf16_lossy(&name[..size as usize]);
                if let Some(name) = value(key.0, &format!("{client}\\shell\\open\\command"))
                    .and_then(|cmd| executable(&cmd))
                {
                    found.insert(name);
                }
            }
        }
        for name in BROWSERS {
            if open(
                root,
                &format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{name}"),
            )
            .is_some()
            {
                found.insert((*name).to_owned());
            }
        }
    }
    for app in open_programs() {
        if let Some(name) = app["executable"]
            .as_str()
            .filter(|name| BROWSERS.contains(name))
        {
            found.insert(name.to_owned());
        }
    }
    found.into_iter().collect()
}
unsafe extern "system" fn collect(hwnd: HWND, param: LPARAM) -> BOOL {
    if !IsWindowVisible(hwnd).as_bool()
        || GetWindowLongPtrW(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW.0 as isize != 0
    {
        return BOOL(1);
    }
    let mut pid = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == std::process::id() {
        return BOOL(1);
    }
    let mut class = [0u16; 128];
    let size = GetClassNameW(hwnd, &mut class);
    if [
        "Progman",
        "WorkerW",
        "Shell_TrayWnd",
        "Shell_SecondaryTrayWnd",
    ]
    .contains(&String::from_utf16_lossy(&class[..size.max(0) as usize]).as_str())
    {
        return BOOL(1);
    }
    let mut cloaked = 0u32;
    let _ = windows::Win32::Graphics::Dwm::DwmGetWindowAttribute(
        hwnd,
        windows::Win32::Graphics::Dwm::DWMWA_CLOAKED,
        (&mut cloaked as *mut u32).cast(),
        std::mem::size_of::<u32>() as u32,
    );
    if cloaked != 0 {
        return BOOL(1);
    }
    let mut title = [0u16; 512];
    let size = GetWindowTextW(hwnd, &mut title);
    if size <= 0 {
        return BOOL(1);
    }
    let Some(name) = crate::system::process_name(pid) else {
        return BOOL(1);
    };
    let apps = &mut *(param.0 as *mut BTreeMap<String, Value>);
    apps.entry(name.to_lowercase()).or_insert_with(||json!({"executable":name,"name":name.trim_end_matches(".exe"),"title":String::from_utf16_lossy(&title[..size as usize])}));
    BOOL((apps.len() < 200) as i32)
}
pub fn open_programs() -> Vec<Value> {
    let mut apps = BTreeMap::new();
    unsafe {
        let _ = EnumWindows(
            Some(collect),
            LPARAM((&mut apps as *mut BTreeMap<String, Value>) as isize),
        );
    }
    apps.into_values().collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_commands_extract_only_process_names() {
        assert_eq!(
            executable(r#""C:\Program Files\Browser\chrome.exe" --profile="My account""#),
            Some("chrome.exe".into())
        );
        assert_eq!(
            executable(r#"C:\Program Files\Browser\FIREFOX.EXE -url %1"#),
            Some("firefox.exe".into())
        );
        assert!(executable("not a browser command").is_none());
    }
}
