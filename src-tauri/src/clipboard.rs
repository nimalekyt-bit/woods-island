#[path = "clipboard_store.rs"]
mod store;
pub use store::{ClipboardStore, PREVIEW_LIMIT};
use store::{MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_CONTROL};
/// Injects Ctrl+V key combination into the active foreground window.
/// Because Woods Island window has WS_EX_NOACTIVATE, the target window
/// (VS Code, Word, Browser, etc.) is ALREADY focused!
pub fn paste_to_focused_window(text: &str) -> Result<(), String> {
    // Put text into clipboard via arboard
    set_text(text)?;

    paste_current()
}

pub fn paste_current() -> Result<(), String> {
    // A shortcut may still hold Alt/Shift/Ctrl; injecting V then would invoke
    // a different command in the target app. Wait for the physical release.
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState,VK_MENU,VK_SHIFT,VK_LWIN,VK_RWIN};
    let released=|| unsafe{[VK_CONTROL,VK_MENU,VK_SHIFT,VK_LWIN,VK_RWIN].iter().all(|key|GetAsyncKeyState(key.0 as i32)>=0)};
    let deadline=std::time::Instant::now()+std::time::Duration::from_millis(1500);
    while !released(){if std::time::Instant::now()>=deadline{return Err("Отпустите клавиши Ctrl, Alt и Shift перед вставкой".into());}std::thread::sleep(std::time::Duration::from_millis(10));}
    std::thread::sleep(std::time::Duration::from_millis(20));

    unsafe {
        // Press Ctrl
        keybd_event(VK_CONTROL.0 as u8, 0, Default::default(), 0);
        // Press 'V' (0x56)
        keybd_event(0x56, 0, Default::default(), 0);
        // Release 'V'
        keybd_event(0x56, 0, KEYEVENTF_KEYUP, 0);
        // Release Ctrl
        keybd_event(VK_CONTROL.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok(())
}

pub fn set_text(text: &str) -> Result<(), String> {
    arboard::Clipboard::new().and_then(|mut c| c.set_text(text.to_owned())).map_err(|e| e.to_string())
}

pub fn get_files() -> Option<Vec<String>> {
    let files:Vec<String>=clipboard_win::get_clipboard(clipboard_win::formats::FileList).ok()?;
    if files.is_empty(){None}else{Some(files)}
}
pub fn set_files(paths:&[String])->Result<(),String>{
    let _clipboard=clipboard_win::Clipboard::new_attempts(10).map_err(|e|e.to_string())?;
    clipboard_win::raw::set_file_list(paths).map_err(|e|e.to_string())
}

pub fn set_png(data_url: &str) -> Result<(), String> {
    use base64::Engine;
    let data = base64::engine::general_purpose::STANDARD.decode(data_url.split_once(',').map(|(_, b)| b).unwrap_or(data_url)).map_err(|e| e.to_string())?;
    let image = image::load_from_memory(&data).map_err(|e| e.to_string())?.into_rgba8();
    arboard::Clipboard::new().and_then(|mut c| c.set_image(arboard::ImageData { width: image.width() as usize, height: image.height() as usize, bytes: std::borrow::Cow::Owned(image.into_raw()) })).map_err(|e| e.to_string())
}

/// Respect Windows private clipboard formats before even reading clipboard data.
fn excluded() -> bool {
    use windows::{core::PCWSTR, Win32::System::DataExchange::{RegisterClipboardFormatW, IsClipboardFormatAvailable}};
    for name in ["ExcludeClipboardContentFromMonitorProcessing", "Clipboard Viewer Ignore"] {
        let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        unsafe {
            let format = RegisterClipboardFormatW(PCWSTR(name.as_ptr()));
            if format != 0 && IsClipboardFormatAvailable(format).is_ok() { return true; }
        }
    }
    false
}

pub fn start_watcher(app: tauri::AppHandle, state: std::sync::Arc<crate::AppState>) {
    use tauri::Emitter;
    std::thread::spawn(move || {
        let mut last_sequence = unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() };
        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let seq = unsafe { windows::Win32::System::DataExchange::GetClipboardSequenceNumber() };
            if seq == last_sequence { continue; }
            last_sequence = seq;
            if excluded() { continue; }
            let settings = state.settings.lock().unwrap().clone();
            let owner = unsafe { windows::Win32::System::DataExchange::GetClipboardOwner() }.ok();
            let mut own=false;
            if let Some(hwnd) = owner {
                let mut pid = 0;
                unsafe { windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut pid)); }
                own=pid==std::process::id();
                if crate::system::process_name(pid).map(|n| settings["clipExcludedApps"].as_array().map(|apps| apps.iter().any(|a| a.as_str().map(|s| s.eq_ignore_ascii_case(&n)).unwrap_or(false))).unwrap_or(false)).unwrap_or(false) { continue; }
            }
            let limit = settings["clipLimit"].as_u64().unwrap_or(200).clamp(1, 5000) as usize;
            let mut clip = match arboard::Clipboard::new() { Ok(c) => c, Err(_) => continue };
            let item = if let Some(files)=get_files(){
                serde_json::to_string(&files).ok().map(|json|(json,"files"))
            } else if let Ok(text) = clip.get_text() {
                if text.is_empty() || text.len() > 2 * 1024 * 1024 { continue; }
                Some((text, "text"))
            } else if let Ok(image) = clip.get_image() {
                use base64::Engine;
                if image.width.checked_mul(image.height).is_none_or(|pixels| pixels > MAX_IMAGE_PIXELS) { continue; }
                let mut buffer = std::io::Cursor::new(Vec::new());
                if image::RgbaImage::from_raw(image.width as u32, image.height as u32, image.bytes.into_owned()).map(|img| image::DynamicImage::ImageRgba8(img).write_to(&mut buffer, image::ImageFormat::Png).is_ok()).unwrap_or(false) {
                    if buffer.get_ref().len() > MAX_IMAGE_BYTES { continue; }
                    Some((format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buffer.into_inner())), "image"))
                } else { None }
            } else { None };
            if let Some((content, kind)) = item {
                if let Ok(id) = state.clipboard_store.add_item(&content, kind) {
                    if let Err(error) = state.clipboard_store.prune(limit) { crate::app_log(&format!("Clipboard cleanup: {error}")); }
                    if let Ok(entry) = state.clipboard_store.get_preview(id) {
                        let _ = app.emit("clipboard:new", serde_json::json!({"clip":entry,"own":own,"again":false}));
                    }
                }
            }
        }
    });
}
