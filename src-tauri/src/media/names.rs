//! Resolve browser PWAs and desktop AppUserModelIDs through Windows' installed-app display names.
use windows::{core::PCWSTR, Win32::{System::Com::CoTaskMemFree, UI::Shell::{SHCreateItemFromParsingName, IShellItem, SIGDN_NORMALDISPLAY}}};

pub fn registered_app_name(app_id: &str) -> Option<String> {
    if app_id.is_empty() || app_id.len() > 1024 || app_id.contains(['\0', '\r', '\n', '\\', '/']) { return None; }
    let path = format!("shell:AppsFolder\\{app_id}").encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    unsafe {
        let item: IShellItem = SHCreateItemFromParsingName(PCWSTR(path.as_ptr()), None).ok()?;
        let display = item.GetDisplayName(SIGDN_NORMALDISPLAY).ok()?;
        let name = display.to_string().ok();
        CoTaskMemFree(Some(display.0.cast()));
        name.map(|name| name.trim().to_owned()).filter(|name| !name.is_empty() && name != app_id)
    }
}

pub fn firefox_app_id(app_id: &str) -> bool {
    app_id.to_ascii_lowercase().contains("firefox") || app_id.eq_ignore_ascii_case("308046B0AF4A39CB")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn firefox_recognizes_the_classic_install_app_id_without_labeling_every_hash() {
        assert!(firefox_app_id("308046B0AF4A39CB"));assert!(firefox_app_id("Mozilla.Firefox"));assert!(!firefox_app_id("C5D896686DC0E35B"));
    }
    #[test] fn app_folder_resolver_rejects_paths_and_control_characters_before_shell_calls() {
        for id in ["", "\\server\\file", "../file", "app\0bad", "app\nbad"] { assert_eq!(registered_app_name(id),None); }
    }
}
