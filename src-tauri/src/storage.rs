use serde_json::Value;
use std::{fs, io::Write, path::{Path, PathBuf}, sync::Mutex};

static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn get_storage_dir() -> PathBuf {
    let dir = std::env::var_os("WOODS_ISLAND_DATA_DIR").map(PathBuf::from).unwrap_or_else(|| {
        std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join("woods-island")
    });
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().map_err(|_| "Storage lock poisoned")?;
    let parent = path.parent().ok_or("Invalid storage path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
        file.write_all(content).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp, path).map_err(|e| e.to_string())
}

pub fn load_json_file(filename: &str) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(get_storage_dir().join(filename)).ok()?).ok()
}

pub fn save_json_file(filename: &str, val: &Value) -> Result<(), String> {
    atomic_write(&get_storage_dir().join(filename), &serde_json::to_vec_pretty(val).map_err(|e| e.to_string())?)
}

pub fn load_string_file(filename: &str, default: &str) -> String {
    fs::read_to_string(get_storage_dir().join(filename)).unwrap_or_else(|_| default.to_owned())
}

pub fn save_string_file(filename: &str, content: &str) -> Result<(), String> {
    atomic_write(&get_storage_dir().join(filename), content.as_bytes())
}

/// API keys are encrypted by Windows DPAPI for the current Windows user.
pub fn save_secret(name: &str, secret: &str) -> Result<(), String> {
    use windows::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    if secret.is_empty() {
        let path = get_storage_dir().join(format!("{}.key", name));
        return if path.exists() { fs::remove_file(path).map_err(|e| e.to_string()) } else { Ok(()) };
    }
    let mut bytes = secret.as_bytes().to_vec();
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_mut_ptr() };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output).map_err(|e| e.to_string())?;
        let encrypted = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(HLOCAL(output.pbData as _));
        atomic_write(&get_storage_dir().join(format!("{}.key", name)), &encrypted)
    }
}

pub fn load_secret(name: &str) -> Option<String> {
    use windows::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    let mut bytes = fs::read(get_storage_dir().join(format!("{}.key", name))).ok()?;
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_mut_ptr() };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output).ok()?;
        let clear = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(HLOCAL(output.pbData as _));
        String::from_utf8(clear).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn atomic_overwrite_retains_utf8_and_complete_json() {
        let path = std::env::temp_dir().join(format!("woods-storage-{}.json", std::process::id()));
        atomic_write(&path, br#"{"old":true}"#).unwrap();
        let expected = serde_json::json!({"notes": "Брянск — заметка"});
        atomic_write(&path, &serde_json::to_vec(&expected).unwrap()).unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&fs::read(&path).unwrap()).unwrap(), expected);
        fs::remove_file(path).unwrap();
    }
}
