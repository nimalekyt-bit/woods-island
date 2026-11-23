#![windows_subsystem = "windows"]
// An isolated QA writer, never a downloaded or installed third-party executable.
use std::{fs::{self, OpenOptions}, io::Write, path::PathBuf, time::{Duration, Instant}};
fn main() {
    let folder = PathBuf::from(std::env::args_os().nth(1).expect("QA folder"));
    let filename = std::env::args_os().nth(2).unwrap_or_else(|| "Архив.zip.part".into());
    let filename = PathBuf::from(filename);
    assert!(filename.components().count() == 1 && matches!(filename.components().next(), Some(std::path::Component::Normal(_))));
    let mut file = OpenOptions::new().create_new(true).read(true).write(true).open(folder.join("downloads").join(filename)).unwrap();
    file.write_all(b"Woods QA download").unwrap(); file.flush().unwrap(); fs::write(folder.join("ready"), b"").unwrap();
    let start = Instant::now();
    while !folder.join("close").exists() && start.elapsed() < Duration::from_secs(45) {
        if let Ok(bytes) = fs::read(folder.join("grow")) { file.write_all(&bytes).unwrap(); file.flush().unwrap(); let _ = fs::remove_file(folder.join("grow")); }
        std::thread::sleep(Duration::from_millis(25));
    }
}
