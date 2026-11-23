//! Read-only file ownership. Restart Manager never shuts down or restarts apps here.
use std::{path::{Path, PathBuf}, sync::mpsc::{self, Receiver, SyncSender}, time::{Duration, Instant}};
use windows::{core::{PCWSTR, PWSTR}, Win32::{Foundation::{CloseHandle, ERROR_MORE_DATA, ERROR_SUCCESS, FILETIME}, System::{RestartManager::*, Threading::*}}};

pub(crate) fn torrent_client(name: &str) -> bool {
    matches!(name.to_ascii_lowercase().as_str(), "qbittorrent.exe" | "utorrent.exe" | "bittorrent.exe" |
        "transmission-qt.exe" | "transmission-daemon.exe" | "transmission.exe" |
        "deluge.exe" | "deluged.exe" | "deluge-gtk.exe" | "tixati.exe" |
        "biglybt.exe" | "vuze.exe" | "bitcomet.exe" | "bitcomet64.exe" | "picotorrent.exe")
}

struct Session(u32);
impl Drop for Session { fn drop(&mut self) { unsafe { let _ = RmEndSession(self.0); } } }

fn process_name(process: RM_UNIQUE_PROCESS) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process.dwProcessId).ok()?;
        let result = (|| {
            let (mut created, mut exit, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default(), FILETIME::default());
            GetProcessTimes(handle, &mut created, &mut exit, &mut kernel, &mut user).ok()?;
            // A PID may already have been reused since Restart Manager took its snapshot.
            if created.dwLowDateTime != process.ProcessStartTime.dwLowDateTime || created.dwHighDateTime != process.ProcessStartTime.dwHighDateTime { return None; }
            let mut buffer = [0u16; 32768]; let mut len = buffer.len() as u32;
            QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut len).ok()?;
            Path::new(&String::from_utf16_lossy(&buffer[..len as usize])).file_name().map(|name| name.to_string_lossy().into_owned())
        })();
        let _ = CloseHandle(handle); result
    }
}

pub(crate) fn owners(path: &Path) -> Result<Vec<String>, String> {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    if wide[..wide.len()-1].contains(&0) { return Err("Invalid file path".into()); }
    unsafe {
        let mut id = 0; let mut key = [0u16; CCH_RM_SESSION_KEY as usize + 1];
        let status = RmStartSession(&mut id, 0, PWSTR(key.as_mut_ptr()));
        if status != ERROR_SUCCESS { return Err(format!("File ownership session: {}", status.0)); }
        let session = Session(id);
        let status = RmRegisterResources(session.0, Some(&[PCWSTR(wide.as_ptr())]), None, None);
        if status != ERROR_SUCCESS { return Err(format!("File ownership registration: {}", status.0)); }
        let (mut needed, mut count, mut reasons) = (0, 0, 0);
        let mut status = RmGetList(session.0, &mut needed, &mut count, None, &mut reasons);
        if status == ERROR_SUCCESS && needed == 0 { return Ok(vec![]); }
        // Owners can change while the list is being read. Bound both retries and allocation.
        for _ in 0..3 {
            if status != ERROR_MORE_DATA || needed > 256 { return Err(format!("File ownership list: {}", status.0)); }
            let mut info = vec![RM_PROCESS_INFO::default(); needed as usize]; count = needed;
            status = RmGetList(session.0, &mut needed, &mut count, Some(info.as_mut_ptr()), &mut reasons);
            if status == ERROR_SUCCESS {
                let mut result = Vec::new();
                for item in info.into_iter().take(count as usize) {
                    // An inaccessible owner is unknown, not proof that a transfer finished.
                    result.push(process_name(item.Process).ok_or_else(|| "File owner changed or is inaccessible".to_owned())?);
                }
                return Ok(result);
            }
        }
        Err("File owners kept changing".into())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Ownership { Closed, Other, Torrent, Unknown }

#[derive(Clone, Debug)]
pub(crate) struct FileOwner {
    pub torrent: bool,
    pub current: Ownership,
    pub since: Instant,
    checked: Option<Instant>,
    pending: Option<u64>,
}
impl FileOwner {
    pub fn new(now: Instant) -> Self { Self { torrent: false, current: Ownership::Unknown, since: now, checked: None, pending: None } }
    pub fn waiting(&self, now: Instant) -> bool {
        self.current == Ownership::Unknown && now.saturating_duration_since(self.since) < Duration::from_secs(if self.pending.is_none() && self.checked.is_none() { 30 } else { 5 })
    }
    pub fn priority(&self) -> bool { self.checked.is_none() }
    pub fn renamed(&mut self, now: Instant) { self.pending = None; self.checked = None; self.current = Ownership::Unknown; self.since = now; }
    pub fn writing(&self) -> bool { matches!(self.current, Ownership::Torrent | Ownership::Other) }
    pub fn fresh(&self, now: Instant) -> bool { self.checked.is_some_and(|at| now.saturating_duration_since(at) < Duration::from_secs(2)) }
}

struct Job { path: PathBuf, token: u64, created: Option<std::time::SystemTime> }
pub(crate) struct Reply { pub path: PathBuf, token: u64, verdict: Ownership }

pub(crate) struct Queue { sender: SyncSender<Job>, receiver: Receiver<Reply>, next: u64, budget: usize }
impl Queue {
    pub fn new() -> Self {
        let (sender, jobs) = mpsc::sync_channel::<Job>(32);
        let (results, receiver) = mpsc::channel();
        std::thread::Builder::new().name("woods-file-owners".into()).spawn(move || {
            while let Ok(job) = jobs.recv() {
                let verdict = owners(&job.path).map(|names| {
                    if names.iter().any(|name| torrent_client(name)) { Ownership::Torrent }
                    else if names.is_empty() { Ownership::Closed } else { Ownership::Other }
                }).unwrap_or(Ownership::Unknown);
                let same_file = std::fs::metadata(&job.path).ok().is_some_and(|metadata| metadata.created().ok() == job.created);
                if results.send(Reply { path: job.path, token: job.token, verdict: if same_file { verdict } else { Ownership::Unknown } }).is_err() { break; }
            }
        }).expect("File ownership worker");
        Self { sender, receiver, next: 0, budget: 8 }
    }
    pub fn drain(&mut self) -> Vec<Reply> { self.budget = 8; self.receiver.try_iter().collect() }
    pub fn apply(reply: Reply, state: &mut FileOwner, now: Instant) {
        if state.pending != Some(reply.token) { return; }
        state.pending = None; state.checked = Some(now); state.current = reply.verdict;
        state.torrent |= reply.verdict == Ownership::Torrent;
    }
    pub fn inspect(&mut self, path: &Path, created: Option<std::time::SystemTime>, state: &mut FileOwner, now: Instant, _clients_running: bool) {
        if state.pending.is_some() { return; }
        let delay = if state.current == Ownership::Unknown { 5 } else { 2 };
        if state.checked.is_some_and(|at| now.saturating_duration_since(at) < Duration::from_secs(delay)) { return; }
        // Browsers can keep their final filename open. An absent torrent
        // process never proves that another application's file is closed.
        if self.budget == 0 { return; }
        let token = self.next.wrapping_add(1);
        if self.sender.try_send(Job { path: path.to_path_buf(), token, created }).is_ok() {
            self.next = token; self.budget -= 1; state.pending = Some(token);
            if state.checked.is_none() { state.since = now; }
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::{fs::OpenOptions, io::Write};
    pub struct Writer { pub folder: PathBuf, pub child: std::process::Child }
    impl Writer {
        pub fn new(name: &str) -> Self {
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let folder = std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("owner-{}-{}-{}", std::process::id(), crate::media::now_ms(), NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
            std::fs::create_dir_all(&folder).unwrap(); let exe = folder.join(name);
            std::fs::copy(std::env::current_exe().unwrap(), &exe).unwrap();
            let child = crate::system::command(exe.to_str().unwrap()).args(["--exact", "file_owners::tests::fixture_writer", "--nocapture"])
                .env("WOODS_OWNER_FIXTURE", &folder).spawn().unwrap();
            let mut writer = Self { folder, child }; let start = Instant::now();
            while !writer.folder.join("ready").exists() {
                assert!(writer.child.try_wait().unwrap().is_none(), "Writer exited early");
                assert!(start.elapsed() < Duration::from_secs(15), "Writer did not open the file");
                std::thread::sleep(Duration::from_millis(20));
            }
            writer
        }
        pub fn path(&self) -> PathBuf { self.folder.join("downloads/Архив.zip.part") }
        pub fn close(&mut self) { std::fs::write(self.folder.join("close"), b"").unwrap(); assert!(self.child.wait().unwrap().success()); }
    }
    impl Drop for Writer { fn drop(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); let _ = std::fs::remove_dir_all(&self.folder); } }
    #[test] fn fixture_writer() {
        let Some(folder) = std::env::var_os("WOODS_OWNER_FIXTURE").map(PathBuf::from) else { return; };
        std::fs::create_dir_all(folder.join("downloads")).unwrap();
        let mut file = OpenOptions::new().create_new(true).write(true).read(true).open(folder.join("downloads/Архив.zip.part")).unwrap();
        file.write_all(b"torrent fixture").unwrap(); file.flush().unwrap(); std::fs::write(folder.join("ready"), b"").unwrap();
        let start = Instant::now();
        while !folder.join("close").exists() && start.elapsed() < Duration::from_secs(45) {
            if let Ok(bytes) = std::fs::read(folder.join("grow")) { file.write_all(&bytes).unwrap(); file.flush().unwrap(); let _ = std::fs::remove_file(folder.join("grow")); }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
    #[test] fn exact_names_do_not_hide_unrelated_apps() {
        assert!(torrent_client("qBittorrent.exe")); assert!(torrent_client("UTorrent.exe"));
        for name in ["torrent-report.exe", "chrome.exe", "qbittorrent-updater.exe", "javaw.exe"] { assert!(!torrent_client(name)); }
    }
    #[test] fn native_owner_is_specific_to_the_open_file_and_unicode_path() {
        let mut writer = Writer::new("qbittorrent.exe");
        assert!(owners(&writer.path()).unwrap().iter().any(|name| torrent_client(name)));
        let ordinary = writer.folder.join("ordinary.txt"); std::fs::write(&ordinary, b"other").unwrap();
        assert!(owners(&ordinary).unwrap().is_empty());
        writer.close(); assert!(owners(&writer.path()).unwrap().is_empty());
    }
    #[test] fn queue_overload_never_blocks_and_old_replies_cannot_classify_a_new_file() {
        let mut queue = Queue::new(); let now = Instant::now();
        let mut states: Vec<_> = (0..1000).map(|_| FileOwner::new(now)).collect();
        for (i, state) in states.iter_mut().enumerate() { queue.inspect(Path::new(&format!("missing-{i}")), None, state, now, true); }
        assert_eq!(states.iter().filter(|state| state.pending.is_some()).count(), 8);
        assert!(states[999].waiting(now)); assert!(!states[999].waiting(now + Duration::from_secs(31)));
        let mut replacement = FileOwner::new(now);
        Queue::apply(Reply { path: "x".into(), token: 1, verdict: Ownership::Torrent }, &mut replacement, now);
        assert!(!replacement.torrent);
    }
    #[test] fn ownership_errors_do_not_keep_ordinary_downloads_hidden_on_every_retry() {
        let now=Instant::now();let mut state=FileOwner::new(now);state.pending=Some(1);
        Queue::apply(Reply{path:"missing".into(),token:1,verdict:Ownership::Unknown},&mut state,now+Duration::from_secs(1));
        assert!(state.waiting(now+Duration::from_secs(2)));
        let mut queue=Queue::new();queue.inspect(Path::new("missing"),None,&mut state,now+Duration::from_secs(7),true);
        assert!(!state.waiting(now+Duration::from_secs(7)),"Retry must not restart the grace period");
    }
}
