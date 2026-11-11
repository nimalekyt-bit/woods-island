//! Explicit Markdown export into the user's Obsidian vault.
use serde_json::{json, Value};
use std::{fs, io::Write, path::Path};

fn filename(title: &str) -> String {
    let cleaned: String = title.chars().filter(|c| !c.is_control())
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c }).take(100).collect();
    let cleaned = cleaned.trim().trim_matches('.').trim();
    let stem = if cleaned.is_empty() { "Заметка" } else { cleaned };
    let device = stem.split('.').next().unwrap_or("").to_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
    if reserved.contains(&device.as_str()) { format!("_{}", stem) } else { stem.to_owned() }
}

pub fn selected(id: Option<&str>, title: Option<String>, text: Option<String>, folders: &str, current: &str) -> Result<(String, String), String> {
    let (title, text) = if let Some(id) = id {
        let data: Value = serde_json::from_str(folders).map_err(|_| "Данные заметок повреждены")?;
        let note = data["folders"].as_array().and_then(|notes| notes.iter().find(|note| note["id"].as_str() == Some(id))).ok_or("Заметка не найдена")?;
        (title.or_else(|| note["name"].as_str().map(str::to_owned)), text.unwrap_or_else(|| note["text"].as_str().unwrap_or("").to_owned()))
    } else { (title, text.unwrap_or_else(|| current.to_owned())) };
    if text.trim().is_empty() { return Err("Заметка пуста".into()); }
    let title = title.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| text.lines().find(|l| !l.trim().is_empty()).unwrap_or("Заметка").trim().trim_start_matches('#').trim().to_owned());
    Ok((title, text))
}

pub fn export(vault: &Path, title: &str, text: &str) -> Result<Value, String> {
    if !vault.is_absolute() || !vault.is_dir() { return Err("Укажите существующую папку Obsidian Vault в настройках".into()); }
    let vault = vault.canonicalize().map_err(|e| e.to_string())?;
    let directory = vault.join("Woods Island");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let directory = directory.canonicalize().map_err(|e| e.to_string())?;
    if !directory.starts_with(&vault) { return Err("Папка экспорта находится вне Obsidian Vault".into()); }
    let stem = filename(title);
    for suffix in 0..10_000 {
        let name = if suffix == 0 { format!("{}.md", stem) } else { format!("{} ({}).md", stem, suffix + 1) };
        let path = directory.join(name);
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(error) = file.write_all(text.as_bytes()).and_then(|_| file.sync_all()) { let _ = fs::remove_file(&path); return Err(error.to_string()); }
                // Display a conventional Windows path rather than a \\?\ prefix.
                let path = path.to_string_lossy().strip_prefix("\\\\?\\").unwrap_or(&path.to_string_lossy()).to_owned();
                return Ok(json!({"path":path,"title":title}));
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    }
    Err("Слишком много заметок с одинаковым названием".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn filenames_cannot_traverse_or_address_devices() {
        assert_eq!(filename("../../CON"), "_.._CON");
        assert_eq!(filename("NUL.txt"), "_NUL.txt");
        assert_eq!(filename("  ..  "), "Заметка");
        assert_eq!(filename("Мысли: планы?"), "Мысли_ планы_");
    }
    #[test] fn selected_folder_is_markdown_and_unknown_id_errors() {
        let data = r##"{"current":"a","folders":[{"id":"a","name":"Мысли","text":"# План\nТекст"}]}"##;
        assert_eq!(selected(Some("a"), None, None, data, "").unwrap(), ("Мысли".into(), "# План\nТекст".into()));
        assert!(selected(Some("unknown"), None, None, data, "").is_err());
        assert!(selected(None, None, None, data, " ").is_err());
    }
    #[test] fn export_preserves_existing_note_and_stays_in_vault() {
        let vault = std::env::temp_dir().join(format!("woods-note-export-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&vault).unwrap();
        let first = export(&vault,"../Мысли", "Первый текст").unwrap();
        let second = export(&vault,"../Мысли", "Второй текст").unwrap();
        assert_ne!(first["path"],second["path"]);
        assert_eq!(fs::read_to_string(first["path"].as_str().unwrap()).unwrap(),"Первый текст");
        assert!(Path::new(second["path"].as_str().unwrap()).canonicalize().unwrap().starts_with(vault.canonicalize().unwrap()));
        fs::remove_dir_all(vault).unwrap();
    }
}
