use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, KEYEVENTF_KEYUP, VK_CONTROL,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipboardItem {
    pub id: i64,
    pub content: String,
    pub item_type: String,
    pub pinned: bool,
    pub created_at: String,
}

pub struct ClipboardStore {
    conn: Mutex<Connection>,
}

impl ClipboardStore {
    pub fn new(db_path: PathBuf) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                item_type TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_items(&self, limit: usize) -> Result<Vec<ClipboardItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content, item_type, pinned, created_at 
             FROM clipboard_items 
             ORDER BY pinned DESC, created_at DESC, id DESC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            let pinned_int: i32 = row.get(3)?;
            Ok(ClipboardItem {
                id: row.get(0)?,
                content: row.get(1)?,
                item_type: row.get(2)?,
                pinned: pinned_int != 0,
                created_at: row.get(4)?,
            })
        })?;

        let mut items = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                items.push(item);
            }
        }
        Ok(items)
    }

    pub fn add_item(&self, content: &str, item_type: &str) -> Result<i64, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        // Recopying a pinned item must preserve its ID and pin state.
        if let Ok(id) = conn.query_row("SELECT id FROM clipboard_items WHERE content = ?1 AND item_type = ?2", params![content, item_type], |row| row.get::<_, i64>(0)) {
            conn.execute("UPDATE clipboard_items SET created_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?1", params![id])?;
            return Ok(id);
        }
        conn.execute(
            "INSERT INTO clipboard_items (content, item_type, pinned, created_at) VALUES (?1, ?2, 0, strftime('%Y-%m-%d %H:%M:%f','now'))",
            params![content, item_type],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn toggle_pin(&self, id: i64) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE clipboard_items SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn delete_item(&self, id: i64) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_item(&self, id: i64) -> Result<ClipboardItem, rusqlite::Error> {
        self.conn.lock().unwrap().query_row("SELECT id, content, item_type, pinned, created_at FROM clipboard_items WHERE id=?1", params![id], |row| Ok(ClipboardItem { id: row.get(0)?, content: row.get(1)?, item_type: row.get(2)?, pinned: row.get::<_, i32>(3)? != 0, created_at: row.get(4)? }))
    }

    pub fn set_pin(&self, id: i64, pinned: bool) -> Result<(), rusqlite::Error> {
        self.conn.lock().unwrap().execute("UPDATE clipboard_items SET pinned=?1 WHERE id=?2", params![pinned, id])?;
        Ok(())
    }

    pub fn clear_unpinned(&self) -> Result<(), rusqlite::Error> {
        self.conn.lock().unwrap().execute("DELETE FROM clipboard_items WHERE pinned=0", [])?;
        Ok(())
    }

    pub fn prune(&self, limit: usize) -> Result<(), rusqlite::Error> {
        self.conn.lock().unwrap().execute("DELETE FROM clipboard_items WHERE pinned=0 AND id NOT IN (SELECT id FROM clipboard_items WHERE pinned=0 ORDER BY created_at DESC,id DESC LIMIT ?1)", params![limit as i64])?;
        Ok(())
    }
}

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
                let mut buffer = std::io::Cursor::new(Vec::new());
                if image::RgbaImage::from_raw(image.width as u32, image.height as u32, image.bytes.into_owned()).map(|img| image::DynamicImage::ImageRgba8(img).write_to(&mut buffer, image::ImageFormat::Png).is_ok()).unwrap_or(false) {
                    Some((format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buffer.into_inner())), "image"))
                } else { None }
            } else { None };
            if let Some((content, kind)) = item {
                if let Ok(id) = state.clipboard_store.add_item(&content, kind) {
                    let _ = state.clipboard_store.prune(limit);
                    let preview = if kind == "files" {
                        serde_json::from_str::<Vec<String>>(&content).unwrap_or_default().join("\n")
                    } else { content.chars().take(500).collect::<String>() };
                    let mut entry = serde_json::json!({"id":id,"kind":kind,"text":content,"preview":preview,"pinned":false,"time":crate::media::now_ms()});
                    if kind == "image" {
                        use base64::Engine;
                        if let Some((_,data)) = content.split_once(',') {
                            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(data) {
                                if let Ok(image) = image::load_from_memory(&bytes) {
                                    entry["width"] = serde_json::json!(image.width());
                                    entry["height"] = serde_json::json!(image.height());
                                    entry["thumb"] = serde_json::json!(content);
                                }
                            }
                        }
                    }
                    let _ = app.emit("clipboard:new", serde_json::json!({"clip":entry,"own":own,"again":false}));
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recopy_old_item_survives_prune_as_newest() {
        let store=ClipboardStore::new(PathBuf::from(":memory:")).unwrap();
        let oldest=store.add_item("old", "text").unwrap();
        let newer=store.add_item("new", "text").unwrap();
        store.conn.lock().unwrap().execute("UPDATE clipboard_items SET created_at='2000-01-01 00:00:00' WHERE id=?1",params![oldest]).unwrap();
        store.conn.lock().unwrap().execute("UPDATE clipboard_items SET created_at='2001-01-01 00:00:00' WHERE id=?1",params![newer]).unwrap();
        assert_eq!(store.add_item("old","text").unwrap(),oldest);
        assert_eq!(store.get_items(2).unwrap()[0].id,oldest);
        store.prune(1).unwrap();
        assert_eq!(store.get_items(2).unwrap()[0].id,oldest);
        assert_eq!(store.get_items(2).unwrap().len(),1);
    }
    #[test]
    fn recopy_preserves_pin_and_clear_keeps_pinned() {
        let store = ClipboardStore::new(PathBuf::from(":memory:")).unwrap();
        let id = store.add_item("важное", "text").unwrap();
        store.set_pin(id, true).unwrap();
        assert_eq!(store.add_item("важное", "text").unwrap(), id);
        store.add_item("temporary", "text").unwrap();
        store.clear_unpinned().unwrap();
        let items = store.get_items(100).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].pinned);
    }
}
