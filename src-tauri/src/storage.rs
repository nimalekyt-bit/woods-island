use serde_json::Value;
use std::{fs, io::Write, path::{Path, PathBuf}, sync::{Mutex, atomic::{AtomicU64, Ordering}}};

static WRITE_LOCK: Mutex<()> = Mutex::new(());
static RECOVERY_WARNINGS: Mutex<Vec<String>> = Mutex::new(Vec::new());
static ARCHIVE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub fn get_storage_dir() -> PathBuf {
    let dir = std::env::var_os("WOODS_ISLAND_DATA_DIR").map(PathBuf::from).unwrap_or_else(|| {
        std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join("woods-island")
    });
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn recovery_warnings() -> Vec<String> {
    RECOVERY_WARNINGS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

pub fn warn(message: impl Into<String>) {
    let message = message.into();
    let mut warnings = RECOVERY_WARNINGS.lock().unwrap_or_else(|e| e.into_inner());
    if !warnings.contains(&message) && warnings.len() < 20 { warnings.push(message); }
}

fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

fn atomic_write_unlocked(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid storage path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = sibling(path, ".tmp");
    {
        let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
        file.write_all(content).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp, path).map_err(|e| e.to_string())
}

pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().map_err(|_| "Storage lock poisoned")?;
    atomic_write_unlocked(path, content)
}

fn settings_file(path: &Path) -> bool { path.file_name().and_then(|n| n.to_str()) == Some("settings.json") }

// Damaged settings may contain an old plaintext upload key. Preserve those bytes
// with DPAPI rather than creating a second plaintext copy during recovery.
fn archive_damaged(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
    let sequence = ARCHIVE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let protected = settings_file(path);
    let content = if protected { protect(bytes)? } else { bytes.to_vec() };
    let suffix = format!(".damaged-{timestamp}-{sequence}{}", if protected { ".dpapi" } else { "" });
    let archive = sibling(path, &suffix);
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(archive).map_err(|e| e.to_string())?;
    file.write_all(&content).and_then(|_| file.sync_all()).map_err(|e| e.to_string())
}

fn valid_json(path: &Path, bytes: &[u8]) -> bool {
    let Ok(value) = serde_json::from_slice::<Value>(bytes) else { return false; };
    match path.file_name().and_then(|n| n.to_str()).unwrap_or_default() {
        "settings.json" | "launcher_groups.json" | "launcher_hotkeys.json" | "note_folders.json" | "media_names.json" | "news.json" => value.is_object(),
        "shelf.json" | "launcher.json" | "colors.json" | "reminders.json" | "chat.json" => value.is_array(),
        _ => true,
    }
}

fn valid_content(path: &Path, bytes: &[u8], json: bool) -> bool {
    if json { valid_json(path, bytes) } else { std::str::from_utf8(bytes).is_ok() }
}

fn read_recoverable(path: &Path, json: bool) -> Result<Option<Vec<u8>>, String> {
    let _guard = WRITE_LOCK.lock().map_err(|_| "Storage lock poisoned")?;
    let current = match fs::read(path) {
        Ok(bytes) if valid_content(path, &bytes, json) => return Ok(Some(bytes)),
        Ok(bytes) => Some(bytes),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(format!("Cannot read profile file: {e}")),
    };
    let backup = fs::read(sibling(path, ".bak")).ok().filter(|bytes| valid_content(path, bytes, json));
    if current.is_none() && backup.is_none() { return Ok(None); }
    if let Some(bytes) = current.as_ref() { archive_damaged(path, bytes)?; }
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    if let Some(bytes) = backup {
        atomic_write_unlocked(path, &bytes)?;
        warn(format!("{name}: восстановлена последняя исправная копия. Повреждённые данные сохранены в папке профиля."));
        Ok(Some(bytes))
    } else {
        warn(format!("{name}: файл повреждён. Исходные данные сохранены; до восстановления используются начальные значения."));
        Ok(None)
    }
}

fn without_upload_key(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if let Some(object) = value.as_object_mut() { object.remove("uploadKey"); }
    serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())
}

fn save_recoverable(path: &Path, bytes: &[u8], json: bool) -> Result<(), String> {
    if !valid_content(path, bytes, json) { return Err("Invalid profile data; existing file was not replaced".into()); }
    let _guard = WRITE_LOCK.lock().map_err(|_| "Storage lock poisoned")?;
    let backup_path = sibling(path, ".bak");
    let previous = match fs::read(path) {
        Ok(old) if valid_content(path, &old, json) => Some(old),
        Ok(old) => { archive_damaged(path, &old)?; None },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(format!("Cannot preserve previous profile data: {e}")),
    };
    if let Some(old) = previous {
        let backup = if settings_file(path) { without_upload_key(&old)? } else { old };
        atomic_write_unlocked(&backup_path, &backup)?;
    } else if !backup_path.exists() {
        atomic_write_unlocked(&backup_path, bytes)?;
    } else if settings_file(path) {
        let old = fs::read(&backup_path).map_err(|e| e.to_string())?;
        if valid_json(path, &old) { atomic_write_unlocked(&backup_path, &without_upload_key(&old)?)?; }
        else { archive_damaged(path, &old)?; atomic_write_unlocked(&backup_path, bytes)?; }
    }
    atomic_write_unlocked(path, bytes)
}

pub fn load_json_file(filename: &str) -> Option<Value> {
    match read_recoverable(&get_storage_dir().join(filename), true) {
        Ok(Some(bytes)) => serde_json::from_slice(&bytes).ok(),
        Ok(None) => None,
        Err(_) => { warn(format!("{filename}: не удалось прочитать или восстановить профиль. Исходный файл не заменён.")); None },
    }
}

pub fn save_json_file(filename: &str, val: &Value) -> Result<(), String> {
    let mut value = val.clone();
    if filename == "settings.json" { protect_upload_key(&mut value)?; }
    save_recoverable(&get_storage_dir().join(filename), &serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?, true)
}

fn json_string_file(filename: &str) -> bool { matches!(filename, "launcher_groups.json" | "launcher_hotkeys.json" | "timer.json" | "reminders.json" | "note_folders.json" | "chat.json") }

pub fn load_string_file(filename: &str, default: &str) -> String {
    match read_recoverable(&get_storage_dir().join(filename), json_string_file(filename)) {
        Ok(Some(bytes)) => String::from_utf8(bytes).unwrap_or_else(|_| default.to_owned()),
        Ok(None) => default.to_owned(),
        Err(_) => { warn(format!("{filename}: не удалось прочитать профиль. Исходный файл не заменён.")); default.to_owned() },
    }
}

pub fn save_string_file(filename: &str, content: &str) -> Result<(), String> {
    save_recoverable(&get_storage_dir().join(filename), content.as_bytes(), json_string_file(filename))
}

fn protect(secret: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    let mut bytes = secret.to_vec();
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len().try_into().map_err(|_| "Secret is too large")?, pbData: bytes.as_mut_ptr() };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output).map_err(|e| e.to_string())?;
        let encrypted = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(HLOCAL(output.pbData as _));
        Ok(encrypted)
    }
}

fn unprotect(encrypted: &[u8]) -> Option<Vec<u8>> {
    use windows::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    let mut bytes = encrypted.to_vec();
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len().try_into().ok()?, pbData: bytes.as_mut_ptr() };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output).ok()?;
        let clear = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(HLOCAL(output.pbData as _));
        Some(clear)
    }
}

fn save_secret_at(directory: &Path, name: &str, secret: &str) -> Result<(), String> {
    let path = directory.join(format!("{name}.key"));
    if secret.is_empty() {
        return match fs::remove_file(path) { Ok(()) => Ok(()), Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), Err(e) => Err(e.to_string()) };
    }
    atomic_write(&path, &protect(secret.as_bytes())?)?;
    let stored = fs::read(path).map_err(|e| e.to_string())?;
    if unprotect(&stored).as_deref() != Some(secret.as_bytes()) { return Err("Encrypted key verification failed".into()); }
    Ok(())
}

/// API keys are encrypted by Windows DPAPI for the current Windows user.
pub fn save_secret(name: &str, secret: &str) -> Result<(), String> { save_secret_at(&get_storage_dir(), name, secret) }

pub fn load_secret(name: &str) -> Option<String> {
    String::from_utf8(unprotect(&fs::read(get_storage_dir().join(format!("{name}.key"))).ok()?)?).ok()
}

fn protect_upload_key(settings: &mut Value) -> Result<(), String> {
    protect_upload_key_at(&get_storage_dir(), settings)
}

fn protect_upload_key_at(directory: &Path, settings: &mut Value) -> Result<(), String> {
    if let Some(key) = settings.get("uploadKey").and_then(Value::as_str).filter(|key| !key.is_empty()) { save_secret_at(directory, "upload", key)?; }
    if let Some(object) = settings.as_object_mut() { object.remove("uploadKey"); }
    Ok(())
}

/// Call before exposing settings to any webview. Only mutate the caller's value
/// after DPAPI verification and sanitized primary/backup writes succeed.
pub fn migrate_upload_key(settings: &mut Value) -> Result<(), String> {
    migrate_upload_key_at(&get_storage_dir(), settings)
}

fn migrate_upload_key_at(directory: &Path, settings: &mut Value) -> Result<(), String> {
    let mut sanitized = settings.clone();
    protect_upload_key_at(directory, &mut sanitized)?;
    let path = directory.join("settings.json");
    let backup_has_key = fs::read(sibling(&path, ".bak")).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()).is_some_and(|value| value.get("uploadKey").is_some());
    if settings.get("uploadKey").is_some() || backup_has_key {
        save_recoverable(&path, &serde_json::to_vec_pretty(&sanitized).map_err(|e|e.to_string())?, true)?;
    }
    *settings = sanitized;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn directory() -> PathBuf {
        let path = std::env::temp_dir().join(format!("woods-storage-{}-{}", std::process::id(), ARCHIVE_SEQUENCE.fetch_add(1, Ordering::Relaxed)));
        fs::create_dir_all(&path).unwrap(); path
    }
    #[test]
    fn corrupt_json_recovers_previous_utf8_and_preserves_damage() {
        let dir = directory(); let path = dir.join("launcher.json");
        let previous = br#"[{"id":"old"}]"#;
        save_recoverable(&path, previous, true).unwrap();
        save_recoverable(&path, "[{\"id\":\"новый\"}]".as_bytes(), true).unwrap();
        fs::write(&path, b"{broken").unwrap();
        assert_eq!(read_recoverable(&path, true).unwrap().unwrap(), previous);
        let archived: Vec<_> = fs::read_dir(&dir).unwrap().filter_map(Result::ok).filter(|e| e.file_name().to_string_lossy().contains(".damaged-")).collect();
        assert_eq!(archived.len(), 1); assert_eq!(fs::read(archived[0].path()).unwrap(), b"{broken");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn corrupt_json_without_backup_is_preserved_and_wrong_shape_is_rejected() {
        let dir = directory(); let path = dir.join("launcher.json");
        fs::write(&path, b"null").unwrap();
        assert!(read_recoverable(&path, true).unwrap().is_none());
        assert_eq!(fs::read(&path).unwrap(), b"null");
        assert!(save_recoverable(&path, b"{}", true).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"null");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn missing_primary_recovers_backup_and_plain_notes_stay_plain() {
        let dir = directory(); let path = dir.join("notes.json");
        save_recoverable(&path, "Обычная заметка — не JSON".as_bytes(), false).unwrap();
        fs::remove_file(&path).unwrap();
        assert_eq!(read_recoverable(&path, false).unwrap().unwrap(), "Обычная заметка — не JSON".as_bytes());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn encrypted_key_roundtrips_and_settings_backups_exclude_old_key() {
        let dir = directory(); let path = dir.join("settings.json");
        let secret = "unit-test-upload-key";
        save_secret_at(&dir, "upload", secret).unwrap();
        let encrypted = fs::read(dir.join("upload.key")).unwrap();
        assert!(!encrypted.windows(secret.len()).any(|w| w == secret.as_bytes()));
        assert_eq!(unprotect(&encrypted).unwrap(), secret.as_bytes());
        fs::write(&path, br#"{"uploadKey":"old-secret","scale":100}"#).unwrap();
        save_recoverable(&path, br#"{"scale":120}"#, true).unwrap();
        assert!(serde_json::from_slice::<Value>(&fs::read(sibling(&path, ".bak")).unwrap()).unwrap().get("uploadKey").is_none());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn damaged_settings_archive_is_encrypted_and_original_is_retained() {
        let dir = directory(); let path = dir.join("settings.json");
        let broken = b"{\"uploadKey\":\"sensitive-value\"";
        fs::write(&path, broken).unwrap();
        assert!(read_recoverable(&path, true).unwrap().is_none());
        assert_eq!(fs::read(&path).unwrap(), broken);
        let archive = fs::read_dir(&dir).unwrap().filter_map(Result::ok).find(|e| e.file_name().to_string_lossy().ends_with(".dpapi")).unwrap();
        let bytes = fs::read(archive.path()).unwrap();
        assert_eq!(unprotect(&bytes).unwrap(), broken);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn upload_migration_is_verified_and_retains_original_on_write_failure() {
        let dir=directory();let path=dir.join("settings.json");
        let mut settings=serde_json::json!({"uploadKey":"migration-test-secret","scale":150});
        let original=serde_json::to_vec(&settings).unwrap();fs::write(&path,&original).unwrap();
        fs::create_dir(dir.join("upload.key")).unwrap();
        assert!(migrate_upload_key_at(&dir,&mut settings).is_err());
        assert_eq!(fs::read(&path).unwrap(),original);assert_eq!(settings["uploadKey"],"migration-test-secret");
        fs::remove_dir(dir.join("upload.key")).unwrap();
        migrate_upload_key_at(&dir,&mut settings).unwrap();
        assert!(settings.get("uploadKey").is_none());
        assert_eq!(unprotect(&fs::read(dir.join("upload.key")).unwrap()).unwrap(),b"migration-test-secret");
        for file in [&path,&sibling(&path,".bak")] {
            assert!(serde_json::from_slice::<Value>(&fs::read(file).unwrap()).unwrap().get("uploadKey").is_none());
        }
        fs::remove_dir_all(dir).unwrap();
    }
}
