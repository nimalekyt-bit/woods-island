use base64::Engine;
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashSet, fs, path::{Path, PathBuf}, sync::Mutex};

pub const PREVIEW_LIMIT: usize = 200;
const PREVIEW_TEXT_CHARS: usize = 4096;
const PREVIEW_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: usize = 32 * 1024 * 1024;
pub const MAX_IMAGE_BYTES: usize = 24 * 1024 * 1024;

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
    cache_dir: Option<PathBuf>,
}

fn file_error(error: std::io::Error) -> rusqlite::Error { rusqlite::Error::ToSqlConversionFailure(Box::new(error)) }

impl ClipboardStore {
    pub fn new(db_path: PathBuf) -> Result<Self, rusqlite::Error> {
        // Check an existing database read-only first. Opening a damaged WAL in
        // read-write mode could otherwise alter it even when startup later fails.
        if db_path.is_file() {
            let probe = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
            probe.busy_timeout(std::time::Duration::from_millis(500))?;
            let integrity: String = probe.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
            if integrity != "ok" { return Err(rusqlite::Error::InvalidQuery); }
        }
        let conn = Connection::open(&db_path)?;
        conn.busy_timeout(std::time::Duration::from_millis(500))?;
        let integrity: String = conn.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
        if integrity != "ok" { return Err(rusqlite::Error::InvalidQuery); }
        conn.execute("CREATE TABLE IF NOT EXISTS clipboard_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
            item_type TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP)", [])?;
        // Validate an existing schema before declaring the store usable.
        conn.prepare("SELECT id, content, item_type, pinned, created_at FROM clipboard_items LIMIT 1")?;
        conn.pragma_update(None, "secure_delete", "ON")?;
        let cache_dir = (db_path != Path::new(":memory:")).then(|| db_path.parent().unwrap_or(Path::new(".")).to_path_buf());
        let store = Self { conn: Mutex::new(conn), cache_dir };
        if let Err(error) = store.cleanup_orphans() { crate::app_log(&format!("Clipboard image cleanup: {error}")); }
        Ok(store)
    }

    /// Never rename, truncate or delete an inaccessible database or its journal.
    /// Other modules can keep working while this session's history stays in RAM.
    pub fn open_resilient(db_path: PathBuf) -> Result<Self, rusqlite::Error> {
        match Self::new(db_path.clone()) {
            Ok(store) => Ok(store),
            Err(error) => {
                crate::app_log(&format!("Clipboard database unavailable at {}: {error}", db_path.display()));
                crate::storage::warn("История буфера временно работает в памяти и исчезнет при выходе. Исходная база сохранена в папке профиля; проверьте доступ к ней или восстановите её из копии.");
                Self::new(PathBuf::from(":memory:"))
            }
        }
    }

    pub fn is_temporary(&self) -> bool { self.cache_dir.is_none() }

    pub fn get_items(&self, limit: usize) -> Result<Vec<ClipboardItem>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn.prepare("SELECT id, content, item_type, pinned, created_at FROM clipboard_items ORDER BY pinned DESC, created_at DESC, id DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit.min(5000) as i64], read_item)?;
        rows.collect()
    }

    pub fn get_item(&self, id: i64) -> Result<ClipboardItem, rusqlite::Error> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner()).query_row("SELECT id, content, item_type, pinned, created_at FROM clipboard_items WHERE id=?1", params![id], read_item)
    }

    pub fn add_item(&self, content: &str, item_type: &str) -> Result<i64, rusqlite::Error> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        if let Ok(id) = conn.query_row("SELECT id FROM clipboard_items WHERE content=?1 AND item_type=?2", params![content, item_type], |row| row.get::<_, i64>(0)) {
            conn.execute("UPDATE clipboard_items SET created_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?1", params![id])?;
            return Ok(id);
        }
        conn.execute("INSERT INTO clipboard_items (content,item_type,pinned,created_at) VALUES (?1,?2,0,strftime('%Y-%m-%d %H:%M:%f','now'))", params![content,item_type])?;
        Ok(conn.last_insert_rowid())
    }

    pub fn toggle_pin(&self, id: i64) -> Result<(), rusqlite::Error> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner()).execute("UPDATE clipboard_items SET pinned=CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id=?1", params![id])?;
        Ok(())
    }

    pub fn set_pin(&self, id: i64, pinned: bool) -> Result<(), rusqlite::Error> {
        self.conn.lock().unwrap_or_else(|e| e.into_inner()).execute("UPDATE clipboard_items SET pinned=?1 WHERE id=?2", params![pinned,id])?;
        Ok(())
    }

    pub fn delete_item(&self, id: i64) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute("DELETE FROM clipboard_items WHERE id=?1", params![id])?;
        self.remove_cached_image(id)
    }

    pub fn clear_unpinned(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut statement = conn.prepare("SELECT id FROM clipboard_items WHERE pinned=0 AND item_type='image'")?;
        let removed: Vec<i64> = statement.query_map([], |r|r.get(0))?.collect::<Result<_,_>>()?;
        conn.execute("DELETE FROM clipboard_items WHERE pinned=0", [])?;
        for id in removed { self.remove_cached_image(id)?; }
        Ok(())
    }

    pub fn prune(&self, limit: usize) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
        let mut statement = conn.prepare("SELECT id FROM clipboard_items WHERE pinned=0 AND item_type='image' AND id NOT IN (SELECT id FROM clipboard_items WHERE pinned=0 ORDER BY created_at DESC,id DESC LIMIT ?1)")?;
        let removed: Vec<i64> = statement.query_map(params![limit.min(5000) as i64], |r|r.get(0))?.collect::<Result<_,_>>()?;
        conn.execute("DELETE FROM clipboard_items WHERE pinned=0 AND id NOT IN (SELECT id FROM clipboard_items WHERE pinned=0 ORDER BY created_at DESC,id DESC LIMIT ?1)", params![limit.min(5000) as i64])?;
        for id in removed { self.remove_cached_image(id)?; }
        Ok(())
    }

    fn remove_cached_image(&self, id: i64) -> Result<(), rusqlite::Error> {
        if let Some(directory) = &self.cache_dir {
            for suffix in [".png", ".thumb.png"] {
                match fs::remove_file(directory.join(format!("clipboard-{id}{suffix}"))) {
                    Ok(()) => {},
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
                    Err(e) => return Err(file_error(e)),
                }
            }
        }
        Ok(())
    }

    fn cleanup_orphans(&self) -> Result<(), rusqlite::Error> {
        self.cleanup_orphans_locked(&self.conn.lock().unwrap_or_else(|e| e.into_inner()))
    }

    fn cleanup_orphans_locked(&self, conn: &Connection) -> Result<(), rusqlite::Error> {
        let Some(directory) = &self.cache_dir else { return Ok(()); };
        let mut statement = conn.prepare("SELECT id FROM clipboard_items WHERE item_type='image'")?;
        let ids: HashSet<i64> = statement.query_map([], |row| row.get(0))?.collect::<Result<_,_>>()?;
        for entry in fs::read_dir(directory).map_err(file_error)? {
            let entry = entry.map_err(file_error)?;
            if !entry.file_type().map_err(file_error)?.is_file() { continue; }
            if let Some(id) = cached_image_id(&entry.file_name().to_string_lossy()) {
                if !ids.contains(&id) { fs::remove_file(entry.path()).map_err(file_error)?; }
            }
        }
        Ok(())
    }

    /// Search full text before applying the display limit. Images remain out of
    /// the SQL result until their small preview cache needs to be materialized.
    pub fn list_previews(&self, limit: usize, query: Option<&str>) -> Result<Vec<Value>, String> {
        let query = query.unwrap_or_default().to_lowercase();
        let mut selected = Vec::new();
        {
            let conn = self.conn.lock().unwrap_or_else(|e| e.into_inner());
            let mut stmt = conn.prepare("SELECT id,CASE WHEN item_type='image' THEN '' ELSE content END,item_type,pinned,created_at FROM clipboard_items ORDER BY pinned DESC,created_at DESC,id DESC").map_err(|e|e.to_string())?;
            let mut rows = stmt.query([]).map_err(|e|e.to_string())?;
            while let Some(row) = rows.next().map_err(|e|e.to_string())? {
                let mut item = read_item(row).map_err(|e|e.to_string())?;
                if !query.is_empty() && (item.item_type == "image" || !item.content.to_lowercase().contains(&query)) { continue; }
                if item.item_type == "text" { item.content = item.content.chars().take(PREVIEW_TEXT_CHARS).collect(); }
                selected.push(item);
                if selected.len() >= limit.clamp(1, PREVIEW_LIMIT) { break; }
            }
        }
        let mut previews = Vec::new(); let mut bytes = 0;
        for item in selected {
            // Keep image materialization synchronized with delete/clear/prune.
            let conn = self.conn.lock().unwrap_or_else(|e|e.into_inner());
            let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM clipboard_items WHERE id=?1)", params![item.id], |r|r.get(0)).map_err(|e|e.to_string())?;
            if !exists { continue; }
            let preview = self.preview_locked(&conn, &item)?;
            bytes += serde_json::to_vec(&preview).map_err(|e|e.to_string())?.len();
            if bytes > PREVIEW_BYTES { break; }
            previews.push(preview);
        }
        Ok(previews)
    }

    pub fn get_preview(&self, id: i64) -> Result<Value, String> {
        let conn = self.conn.lock().unwrap_or_else(|e|e.into_inner());
        let item = conn.query_row("SELECT id,CASE WHEN item_type='image' THEN '' ELSE content END,item_type,pinned,created_at FROM clipboard_items WHERE id=?1", params![id], read_item).map_err(|e|e.to_string())?;
        self.preview_locked(&conn, &item)
    }

    fn preview_locked(&self, conn: &Connection, item: &ClipboardItem) -> Result<Value, String> {
        let text: String = item.content.chars().take(PREVIEW_TEXT_CHARS).collect();
        let mut value = json!({"id":item.id,"kind":item.item_type,"text":text,"preview":text,"pinned":item.pinned,"time":item.created_at,"createdAt":item.created_at});
        if item.item_type == "files" {
            value["preview"] = json!(serde_json::from_str::<Vec<String>>(&item.content).unwrap_or_default().join("\n").chars().take(PREVIEW_TEXT_CHARS).collect::<String>());
        } else if item.item_type == "image" {
            value["text"] = json!(""); value["preview"] = json!("");
            match self.image_preview(conn, item.id) {
                Ok((width,height,thumb,path)) => {
                    value["width"] = json!(width); value["height"] = json!(height); value["thumb"] = json!(thumb);
                    if let Some(path) = path { value["imagePath"] = json!(path.to_string_lossy()); }
                }
                Err(error) => { value["previewError"] = json!("Image preview unavailable"); crate::app_log(&format!("Clipboard preview {}: {error}", item.id)); }
            }
        }
        Ok(value)
    }

    fn image_preview(&self, conn: &Connection, id: i64) -> Result<(u32,u32,String,Option<PathBuf>), String> {
        let path = self.cache_dir.as_ref().map(|dir| dir.join(format!("clipboard-{id}.png")));
        let thumb_path = self.cache_dir.as_ref().map(|dir| dir.join(format!("clipboard-{id}.thumb.png")));
        if let (Some(original),Some(thumbnail)) = (&path,&thumb_path) {
            if let (Ok((width,height)),Ok(meta)) = (image::image_dimensions(original),fs::metadata(thumbnail)) {
                if meta.len() <= 128 * 1024 {
                    if let Ok(bytes) = fs::read(thumbnail) {
                        if image::load_from_memory(&bytes).is_ok_and(|image| image.width()<=160 && image.height()<=120) {
                            return Ok((width,height,data_url(&bytes),path));
                        }
                    }
                }
            }
        }
        let content: String = conn.query_row("SELECT content FROM clipboard_items WHERE id=?1 AND item_type='image'", params![id], |r| r.get(0)).map_err(|e|e.to_string())?;
        let encoded = content.split_once(',').map(|(_,bytes)|bytes).ok_or("Invalid clipboard image")?;
        if encoded.len() > MAX_IMAGE_BYTES * 4 / 3 + 8 { return Err("Clipboard image exceeds the size limit".into()); }
        let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?;
        let reader = image::ImageReader::new(std::io::Cursor::new(&bytes)).with_guessed_format().map_err(|e|e.to_string())?;
        let (width,height) = reader.into_dimensions().map_err(|e|e.to_string())?;
        if u64::from(width)*u64::from(height) > MAX_IMAGE_PIXELS as u64 { return Err("Clipboard image dimensions exceed the limit".into()); }
        let image = image::load_from_memory(&bytes).map_err(|e|e.to_string())?;
        let mut buffer = std::io::Cursor::new(Vec::new());
        image.thumbnail(160,120).write_to(&mut buffer,image::ImageFormat::Png).map_err(|e|e.to_string())?;
        let thumb = buffer.into_inner();
        if let (Some(original),Some(thumbnail)) = (&path,&thumb_path) {
            crate::storage::atomic_write(original, &bytes)?;
            crate::storage::atomic_write(thumbnail, &thumb)?;
        }
        Ok((width,height,data_url(&thumb),path))
    }
}

fn read_item(row: &rusqlite::Row<'_>) -> Result<ClipboardItem,rusqlite::Error> {
    Ok(ClipboardItem { id:row.get(0)?,content:row.get(1)?,item_type:row.get(2)?,pinned:row.get::<_,i32>(3)?!=0,created_at:row.get(4)? })
}
fn data_url(bytes: &[u8]) -> String { format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)) }
fn cached_image_id(name: &str) -> Option<i64> {
    let body = name.strip_prefix("clipboard-")?;
    let digits = body.strip_suffix(".thumb.png").or_else(||body.strip_suffix(".png"))?;
    if digits.is_empty() || !digits.bytes().all(|b|b.is_ascii_digit()) { return None; }
    digits.parse::<i64>().ok().filter(|id|*id>0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64,Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fn directory() -> PathBuf { let p=std::env::temp_dir().join(format!("woods-clipboard-{}-{}",std::process::id(),NEXT.fetch_add(1,Ordering::Relaxed)));fs::create_dir_all(&p).unwrap();p }
    fn picture_color(red: u8) -> String { let mut data=std::io::Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(640,480,image::Rgba([red,40,60,255]))).write_to(&mut data,image::ImageFormat::Png).unwrap();data_url(&data.into_inner()) }
    fn picture() -> String { picture_color(20) }
    #[test]
    fn recopy_preserves_pin_and_prune_keeps_newest() {
        let store=ClipboardStore::new(PathBuf::from(":memory:")).unwrap();
        let old=store.add_item("old","text").unwrap();let pinned=store.add_item("pinned","text").unwrap();store.set_pin(pinned,true).unwrap();
        store.conn.lock().unwrap().execute("UPDATE clipboard_items SET created_at='2000-01-01' WHERE id=?1",params![old]).unwrap();
        let newer=store.add_item("new","text").unwrap();store.conn.lock().unwrap().execute("UPDATE clipboard_items SET created_at='2001-01-01' WHERE id=?1",params![newer]).unwrap();assert_eq!(store.add_item("old","text").unwrap(),old);
        store.prune(1).unwrap();assert_eq!(store.get_items(10).unwrap().len(),2);
        assert!(store.get_item(old).is_ok());assert!(store.get_item(newer).is_err());
        assert_eq!(store.add_item("pinned","text").unwrap(),pinned);assert!(store.get_item(pinned).unwrap().pinned);
        store.clear_unpinned().unwrap();assert_eq!(store.get_items(10).unwrap().len(),1);
    }
    #[test]
    fn previews_are_small_and_delete_clear_prune_remove_only_owned_images() {
        let dir=directory();let store=ClipboardStore::new(dir.join("history.db")).unwrap();let original=picture();
        let id=store.add_item(&original,"image").unwrap();let preview=store.get_preview(id).unwrap();
        assert_eq!(preview["text"],"");assert_eq!(preview["preview"],"");assert_eq!(preview["width"],640);
        let data=base64::engine::general_purpose::STANDARD.decode(preview["thumb"].as_str().unwrap().split_once(',').unwrap().1).unwrap();let thumb=image::load_from_memory(&data).unwrap();assert_eq!((thumb.width(),thumb.height()),(160,120));
        assert_eq!(store.get_item(id).unwrap().content,original);
        fs::write(dir.join("clipboard-not-owned.png"),b"keep").unwrap();
        store.delete_item(id).unwrap();assert!(!dir.join(format!("clipboard-{id}.png")).exists());assert!(!dir.join(format!("clipboard-{id}.thumb.png")).exists());
        let pinned=store.add_item(&original,"image").unwrap();store.set_pin(pinned,true).unwrap();store.get_preview(pinned).unwrap();
        let extra=store.add_item(&picture_color(90),"image").unwrap();store.get_preview(extra).unwrap();store.prune(0).unwrap();
        assert!(!dir.join(format!("clipboard-{extra}.png")).exists());assert!(dir.join(format!("clipboard-{pinned}.png")).exists());
        store.set_pin(pinned,false).unwrap();store.clear_unpinned().unwrap();assert!(!dir.join(format!("clipboard-{pinned}.png")).exists());assert!(dir.join("clipboard-not-owned.png").exists());
        drop(store);fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn unicode_search_scans_beyond_display_limit_and_never_truncates_paste() {
        let store=ClipboardStore::new(PathBuf::from(":memory:")).unwrap();let text=format!("{} НУЖНАЯ ЗАМЕТКА","x".repeat(6000));let id=store.add_item(&text,"text").unwrap();
        for n in 0..205 { store.add_item(&format!("new {n}"),"text").unwrap(); }
        assert_eq!(store.list_previews(5000,None).unwrap().len(),PREVIEW_LIMIT);
        let results=store.list_previews(5000,Some("нужная заметка")).unwrap();assert_eq!(results.len(),1);assert_eq!(results[0]["id"],id);assert!(results[0]["text"].as_str().unwrap().len()<=PREVIEW_TEXT_CHARS);
        assert_eq!(store.get_item(id).unwrap().content,text);
    }
    #[test]
    fn corrupted_database_uses_memory_without_changing_original_or_sidecars() {
        let dir=directory();let path=dir.join("history.db");fs::write(&path,b"not a sqlite database").unwrap();fs::write(dir.join("history.db-wal"),b"preserve journal").unwrap();
        let store=ClipboardStore::open_resilient(path.clone()).unwrap();assert!(store.is_temporary());store.add_item("temporary","text").unwrap();
        assert_eq!(fs::read(path).unwrap(),b"not a sqlite database");assert_eq!(fs::read(dir.join("history.db-wal")).unwrap(),b"preserve journal");drop(store);fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn locked_database_is_not_replaced_and_cached_filename_parser_is_strict() {
        let dir=directory();let path=dir.join("history.db");let store=ClipboardStore::new(path.clone()).unwrap();store.add_item("preserved","text").unwrap();
        store.conn.lock().unwrap().execute_batch("BEGIN EXCLUSIVE").unwrap();let temporary=ClipboardStore::open_resilient(path).unwrap();assert!(temporary.is_temporary());store.conn.lock().unwrap().execute_batch("ROLLBACK").unwrap();assert_eq!(store.get_items(10).unwrap()[0].content,"preserved");
        for name in ["clipboard-../1.png","clipboard--1.png","clipboard-1.png.old","clipboard-owner.png","clipboard-0.png"] { assert_eq!(cached_image_id(name),None); }
        assert_eq!(cached_image_id("clipboard-12.thumb.png"),Some(12));drop(temporary);drop(store);fs::remove_dir_all(dir).unwrap();
    }
}
