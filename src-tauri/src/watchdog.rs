//! Independent native/page liveness and bounded recovery of the main Woods window.
//! Probes do not depend on RAF or background-page timers. No other process is killed.
#[path = "watchdog_policy.rs"]
mod policy;

use policy::{Action, Attempt, Monitor, Reason, Recovery};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use windows::{
    core::{PCWSTR, PWSTR},
    Win32::{
        Foundation::{
            CloseHandle, BOOL, FILETIME, HANDLE, HWND, LPARAM, WAIT_OBJECT_0, WAIT_TIMEOUT, WPARAM,
        },
        System::{
            Com::CoCreateGuid,
            Threading::{
                CreateEventW, GetCurrentProcess, GetProcessTimes, OpenEventW, OpenProcess,
                QueryFullProcessImageNameW, SetEvent, WaitForSingleObject, EVENT_MODIFY_STATE,
                PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
                SYNCHRONIZATION_SYNCHRONIZE,
            },
        },
        UI::WindowsAndMessaging::{
            IsWindow, SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_NULL,
        },
    },
};

#[link(name = "kernel32")]
extern "system" {
    fn QueryUnbiasedInterruptTime(unbiased_time: *mut u64) -> BOOL;
}

const PARENT_PID: &str = "WOODS_WATCHDOG_PARENT_PID";
const PARENT_CREATED: &str = "WOODS_WATCHDOG_PARENT_CREATED";
const HANDOFF_NAME: &str = "WOODS_WATCHDOG_HANDOFF_EVENT";
const ACK_TIMEOUT_MS: u32 = 5_000;
const COMMIT_TIMEOUT_MS: u32 = 10_000;
const MAX_JOURNAL_BYTES: u64 = 64 * 1024;
static AFTER_RECOVERY: AtomicBool = AtomicBool::new(false);
static STOPPING: AtomicBool = AtomicBool::new(false);
static PROTECTION: Mutex<Protection> = Mutex::new(Protection {
    count: 0,
    recovering: false,
});
struct Protection {
    count: usize,
    recovering: bool,
}

/// Keep this guard until the native work actually ends, including file finalization.
/// A canceled dictation retains its guard in the worker's Arc<Session>.
pub struct ActivityGuard {
    _private: (),
}
pub fn protect_activity() -> Result<ActivityGuard, String> {
    if STOPPING.load(Ordering::SeqCst) {
        return Err("Woods Island завершается".into());
    }
    let mut state = PROTECTION
        .lock()
        .map_err(|_| "Activity state unavailable")?;
    if state.recovering {
        return Err("Woods Island восстанавливает интерфейс. Попробуй ещё раз.".into());
    }
    state.count = state
        .count
        .checked_add(1)
        .ok_or("Too many active operations")?;
    Ok(ActivityGuard { _private: () })
}
impl Drop for ActivityGuard {
    fn drop(&mut self) {
        if let Ok(mut state) = PROTECTION.lock() {
            state.count = state.count.saturating_sub(1);
        }
    }
}
fn is_protected() -> bool {
    PROTECTION
        .try_lock()
        .map(|state| state.count > 0)
        .unwrap_or(true)
}
fn claim_recovery() -> bool {
    if STOPPING.load(Ordering::SeqCst) {
        return false;
    }
    let Ok(mut state) = PROTECTION.try_lock() else {
        return false;
    };
    if state.count > 0 {
        return false;
    }
    state.recovering = true;
    true
}
fn release_recovery() {
    if let Ok(mut state) = PROTECTION.lock() {
        state.recovering = false;
    }
}

enum Work {
    Probe(u64),
    Navigate,
}
#[derive(Clone, Copy)]
enum Notice {
    Recovered,
    Limited,
}
struct Service {
    monitor: Mutex<Monitor>,
    stopped: AtomicBool,
    worker_busy: AtomicBool,
    profile: PathBuf,
    notice: Mutex<Option<Notice>>,
    enabled: bool,
}
fn wall_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}
fn active_ms() -> u64 {
    let mut time = 0;
    if unsafe { QueryUnbiasedInterruptTime(&mut time) }.as_bool() {
        time / 10_000
    } else {
        static FALLBACK: OnceLock<Instant> = OnceLock::new();
        FALLBACK
            .get_or_init(Instant::now)
            .elapsed()
            .as_millis()
            .min(u64::MAX as u128) as u64
    }
}
fn lock_monitor(service: &Service) -> std::sync::MutexGuard<'_, Monitor> {
    service
        .monitor
        .lock()
        .unwrap_or_else(|error| error.into_inner())
}
fn native_responsive(raw: isize) -> bool {
    let hwnd = HWND(raw as *mut _);
    unsafe {
        IsWindow(hwnd).as_bool()
            && SendMessageTimeoutW(
                hwnd,
                WM_NULL,
                WPARAM(0),
                LPARAM(0),
                SMTO_ABORTIFHUNG | SMTO_BLOCK,
                1_000,
                None,
            )
            .0 != 0
    }
}
fn is_english(app: &AppHandle) -> bool {
    if let Some(state) = app.try_state::<Arc<crate::AppState>>() {
        if let Ok(settings) = state.settings.try_lock() {
            match settings["language"].as_str() {
                Some("en") => return true,
                Some("ru") => return false,
                _ => {}
            }
        }
    }
    unsafe { windows::Win32::Globalization::GetUserDefaultUILanguage() & 0x3ff == 9 }
}
fn notice_text(app: &AppHandle, notice: Notice) -> &'static str {
    match (notice,is_english(app)) {
        (Notice::Recovered,false)=>"Woods Island восстановил интерфейс. Сведения о сбое сохранены.",
        (Notice::Recovered,true)=>"Woods Island recovered its interface. Details of the failure were saved.",
        (Notice::Limited,false)=>"Автовосстановление Woods Island приостановлено после повторных сбоев. Сведения сохранены; перезапусти приложение вручную.",
        (Notice::Limited,true)=>"Woods Island paused automatic recovery after repeated failures. Details were saved; restart the app manually.",
    }
}
fn emit_notice(app: &AppHandle, service: &Service) {
    let notice = service
        .notice
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    if let Some(notice) = notice {
        let _ = app.emit_to("main", "island:warn", notice_text(app, notice));
    }
}
fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_JOURNAL_BYTES as usize {
        return Err("Watchdog record too large".into());
    }
    // Separate files and lock ownership: a blocked application storage mutex must
    // not block the watchdog. Only this service writes these fixed filenames.
    let temp = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temp, path).map_err(|e| e.to_string())
}
fn attempts(profile: &Path) -> Result<Vec<Attempt>, String> {
    let path = profile.join("watchdog-budget.json");
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file() || metadata.len() > MAX_JOURNAL_BYTES {
        return Err("Invalid watchdog budget file".into());
    }
    let value: Value = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if value["schemaVersion"] != 1 {
        return Err("Unsupported watchdog budget".into());
    }
    let entries = value["attempts"]
        .as_array()
        .filter(|entries| entries.len() <= 16)
        .ok_or("Invalid watchdog attempts")?;
    entries
        .iter()
        .map(|entry| {
            Ok(Attempt {
                at: entry["at"].as_u64().ok_or("Invalid watchdog time")?,
                recovery: match entry["kind"].as_str() {
                    Some("navigate") => Recovery::Navigate,
                    Some("restart") => Recovery::Restart,
                    _ => return Err("Invalid watchdog recovery".into()),
                },
            })
        })
        .collect()
}
fn reserve_attempt(profile: &Path, now: u64, recovery: Recovery) -> Result<bool, String> {
    let mut records = attempts(profile)?;
    if !policy::within_budget(&records, now, recovery) {
        return Ok(false);
    }
    records
        .retain(|entry| entry.at > now || now.saturating_sub(entry.at) < policy::BUDGET_WINDOW_MS);
    records.push(Attempt { at: now, recovery });
    let entries=records.into_iter().map(|entry|json!({"at":entry.at,"kind":match entry.recovery{Recovery::Navigate=>"navigate",Recovery::Restart=>"restart"}})).collect::<Vec<_>>();
    write_json(
        &profile.join("watchdog-budget.json"),
        &json!({"schemaVersion":1,"attempts":entries}),
    )?;
    Ok(true)
}
fn record_incident(service: &Service, reason: Reason, recovery: Recovery, result: &str) {
    let now = active_ms();
    let monitor = lock_monitor(service);
    let (page_age, native_age) = monitor.ages(now);
    let value = json!({"schemaVersion":1,"at":wall_ms(),"version":env!("CARGO_PKG_VERSION"),"pid":std::process::id(),
        "reason":reason.as_str(),"recovery":match recovery{Recovery::Navigate=>"navigate",Recovery::Restart=>"restart"},
        "result":result,"pageReady":monitor.is_ready(),"pageAgeActiveMs":page_age,"windowAgeActiveMs":native_age});
    drop(monitor);
    let _ = write_json(&service.profile.join("watchdog-last.json"), &value);
    // Only bounded liveness facts are logged: no keys, clipboard, chat or memory dump.
    let log = service.profile.join("watchdog.log");
    if fs::metadata(&log).is_ok_and(|metadata| metadata.len() > 128 * 1024) {
        let _ = fs::rename(&log, service.profile.join("watchdog.previous.log"));
    }
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(log) {
        let _ = writeln!(file, "{value}");
    }
}
fn limit(app: &AppHandle, service: &Service, reason: Reason, recovery: Recovery, result: &str) {
    lock_monitor(service).block();
    release_recovery();
    record_incident(service, reason, recovery, result);
    *service.notice.lock().unwrap_or_else(|e| e.into_inner()) = Some(Notice::Limited);
    crate::storage::warn(notice_text(app, Notice::Limited));
}
fn main_url(app: &AppHandle) -> Result<tauri::Url, String> {
    if tauri::is_dev() {
        if let Some(url) = &app.config().build.dev_url {
            return url.join("index.html").map_err(|e| e.to_string());
        }
    }
    // The main window is always our local entry. The AI service lives in another
    // webview. This also repairs an initial renderer stuck on about:blank.
    tauri::Url::parse("http://tauri.localhost/index.html").map_err(|e| e.to_string())
}

/// Called from setup after the native main HWND is known. Idempotent per app.
/// QA defaults to no recovery; a dedicated isolated test opts in explicitly.
pub fn start(app: AppHandle, hwnd: isize) -> bool {
    let enabled = !crate::win::WindowManager::passive_qa()
        || std::env::var("WOODS_WATCHDOG_QA_RECOVERY").as_deref() == Ok("1");
    let service = Arc::new(Service {
        monitor: Mutex::new(Monitor::new(active_ms())),
        stopped: AtomicBool::new(false),
        worker_busy: AtomicBool::new(false),
        profile: crate::storage::get_storage_dir(),
        notice: Mutex::new(if AFTER_RECOVERY.swap(false, Ordering::SeqCst) {
            Some(Notice::Recovered)
        } else {
            None
        }),
        enabled,
    });
    if !app.manage(service.clone()) {
        return false;
    }
    if !enabled || hwnd == 0 {
        return false;
    }
    let (sender, receiver) = mpsc::sync_channel::<Work>(1);
    let worker_app = app.clone();
    let worker_service = service.clone();
    let worker=std::thread::Builder::new().name("woods-page-probe".into()).spawn(move||{
        while let Ok(work)=receiver.recv(){
            if worker_service.stopped.load(Ordering::SeqCst){break;}
            worker_service.worker_busy.store(true,Ordering::SeqCst);
            if let Some(window)=worker_app.get_webview_window("main"){
                match work{
                    Work::Probe(sequence)=>{let _=window.eval(format!("(()=>{{const api=window.__TAURI_INTERNALS__;if(api)void api.invoke('page_pong',{{sequence:{sequence},ready:!!document.querySelector('[data-island]')}}).catch(()=>{{}});}})()"));},
                    Work::Navigate=>{
                        let result=main_url(&worker_app).and_then(|url|window.navigate(url).map_err(|e|e.to_string()));
                        if result.is_err(){release_recovery();}
                    }
                }
            }
            worker_service.worker_busy.store(false,Ordering::SeqCst);
        }
    });
    if worker.is_err() {
        service.stopped.store(true, Ordering::SeqCst);
        return false;
    }
    let failed_service = service.clone();
    let launched = std::thread::Builder::new()
        .name("woods-watchdog".into())
        .spawn(move || {
            let mut previous_wall = wall_ms();
            let mut previous_active = active_ms();
            while !service.stopped.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_secs(2));
                if service.stopped.load(Ordering::SeqCst) {
                    break;
                }
                let now = active_ms();
                let wall = wall_ms();
                if policy::resumed(previous_wall, wall, previous_active, now) {
                    lock_monitor(&service).resume(now);
                }
                previous_wall = wall;
                previous_active = now;
                let responsive = native_responsive(hwnd);
                let fullscreen_occluded = responsive
                    && lock_monitor(&service).is_ready()
                    && crate::is_fullscreen_active();
                let action = lock_monitor(&service).poll(
                    now,
                    responsive,
                    is_protected() || fullscreen_occluded,
                    !service.worker_busy.load(Ordering::SeqCst),
                );
                match action {
                    Action::None => {}
                    Action::Probe(sequence) => {
                        service.worker_busy.store(true, Ordering::SeqCst);
                        if sender.try_send(Work::Probe(sequence)).is_err() {
                            service.worker_busy.store(false, Ordering::SeqCst);
                        }
                    }
                    Action::Recover(recovery, reason) => {
                        if service.stopped.load(Ordering::SeqCst) || STOPPING.load(Ordering::SeqCst)
                        {
                            break;
                        }
                        if !claim_recovery() {
                            lock_monitor(&service).resume(active_ms());
                            continue;
                        }
                        if service.stopped.load(Ordering::SeqCst) || STOPPING.load(Ordering::SeqCst)
                        {
                            release_recovery();
                            break;
                        }
                        match reserve_attempt(&service.profile, wall, recovery) {
                            Ok(true) => {}
                            Ok(false) => {
                                limit(&app, &service, reason, recovery, "budgetExhausted");
                                continue;
                            }
                            Err(_) => {
                                limit(&app, &service, reason, recovery, "budgetUnavailable");
                                continue;
                            }
                        }
                        record_incident(&service, reason, recovery, "requested");
                        match recovery {
                            Recovery::Navigate => {
                                *service.notice.lock().unwrap_or_else(|e| e.into_inner()) =
                                    Some(Notice::Recovered);
                                if sender.try_send(Work::Navigate).is_err() {
                                    release_recovery();
                                    record_incident(
                                        &service,
                                        reason,
                                        recovery,
                                        "navigationQueueBusy",
                                    );
                                }
                            }
                            Recovery::Restart => {
                                if spawn_replacement().is_ok() {
                                    // Native work is protected by guards and no new work can
                                    // start after claim_recovery. Persisted profile is retained.
                                    service.stopped.store(true, Ordering::SeqCst);
                                    std::process::exit(0);
                                }
                                if STOPPING.load(Ordering::SeqCst) {
                                    release_recovery();
                                    break;
                                }
                                limit(&app, &service, reason, recovery, "replacementLaunchFailed");
                            }
                        }
                    }
                }
                let healthy = {
                    let monitor = lock_monitor(&service);
                    monitor.is_ready()
                        && monitor.ages(active_ms()).0 <= policy::PROBE_EXPIRES_MS
                        && monitor.status() != "recovering"
                };
                if healthy {
                    emit_notice(&app, &service);
                }
            }
        })
        .is_ok();
    if !launched {
        failed_service.stopped.store(true, Ordering::SeqCst);
        lock_monitor(&failed_service).stop();
    }
    launched
}

pub fn page_pong(webview: &tauri::Webview, sequence: u64, ready: bool) -> bool {
    if webview.label() != "main" {
        return false;
    }
    let Some(service) = webview.app_handle().try_state::<Arc<Service>>() else {
        return false;
    };
    if !service.enabled || service.stopped.load(Ordering::SeqCst) {
        return false;
    }
    let accepted = lock_monitor(&service).reply_tolerant(sequence, ready, active_ms(), 15_000);
    if accepted && ready {
        release_recovery();
    }
    accepted
}
pub fn stop(app: &AppHandle) {
    STOPPING.store(true, Ordering::SeqCst);
    if let Some(service) = app.try_state::<Arc<Service>>() {
        service.stopped.store(true, Ordering::SeqCst);
        lock_monitor(&service).stop();
    }
    release_recovery();
}
pub fn status(app: &AppHandle) -> Value {
    let Some(service) = app.try_state::<Arc<Service>>() else {
        return json!({"enabled":false,"state":"disabled"});
    };
    if !service.enabled {
        return json!({"enabled":false,"state":"disabled"});
    }
    let monitor = lock_monitor(&service);
    let (page_age, window_age) = monitor.ages(active_ms());
    json!({"enabled":service.enabled,"pid":std::process::id(),"state":monitor.status(),"pageReady":monitor.is_ready(),"pageAgeActiveMs":page_age,"windowAgeActiveMs":window_age,"protected":is_protected()})
}

struct Process(HANDLE);
impl Drop for Process {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
fn creation_time(handle: HANDLE) -> Result<u64, String> {
    let (mut created, mut exit, mut kernel, mut user) = (
        FILETIME::default(),
        FILETIME::default(),
        FILETIME::default(),
        FILETIME::default(),
    );
    unsafe { GetProcessTimes(handle, &mut created, &mut exit, &mut kernel, &mut user) }
        .map_err(|e| e.to_string())?;
    Ok(u64::from(created.dwLowDateTime) | (u64::from(created.dwHighDateTime) << 32))
}
fn image_path(handle: HANDLE) -> Result<PathBuf, String> {
    let mut buffer = vec![0u16; 32768];
    let mut count = buffer.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut count,
        )
    }
    .map_err(|e| e.to_string())?;
    Ok(PathBuf::from(String::from_utf16_lossy(
        &buffer[..count as usize],
    )))
}
fn event_name(name: &str) -> Vec<u16> {
    name.encode_utf16().chain(Some(0)).collect()
}
struct HandoffEvents {
    name: String,
    ready: Process,
    commit: Process,
}
impl HandoffEvents {
    fn create(pid: u32, created: u64) -> Result<Self, String> {
        let nonce = unsafe { CoCreateGuid() }.map_err(|error| error.to_string())?;
        let name = format!("Local\\WoodsIslandHandoff-{pid}-{created}-{nonce:?}");
        let ready_name = event_name(&format!("{name}-ready"));
        let commit_name = event_name(&format!("{name}-commit"));
        let ready = Process(
            unsafe { CreateEventW(None, false, false, PCWSTR(ready_name.as_ptr())) }
                .map_err(|error| error.to_string())?,
        );
        let commit = Process(
            unsafe { CreateEventW(None, false, false, PCWSTR(commit_name.as_ptr())) }
                .map_err(|error| error.to_string())?,
        );
        Ok(Self {
            name,
            ready,
            commit,
        })
    }
    /// The predecessor remains alive unless a fully verified child acknowledged
    /// possession of its waitable process handle and recovery is still intended.
    fn authorize_exit(
        &self,
        timeout: u32,
        may_commit: impl FnOnce() -> bool,
    ) -> Result<(), String> {
        match unsafe { WaitForSingleObject(self.ready.0, timeout) } {
            WAIT_OBJECT_0 => {}
            WAIT_TIMEOUT => {
                return Err("Watchdog replacement did not acknowledge its predecessor".into())
            }
            _ => return Err("Watchdog acknowledgment wait failed".into()),
        }
        if !may_commit() {
            return Err("Watchdog handoff was canceled".into());
        }
        unsafe { SetEvent(self.commit.0) }.map_err(|error| error.to_string())
    }
}
fn acknowledge_handoff(pid: u32, created: u64, name: &str, timeout: u32) -> Result<(), String> {
    let prefix = format!("Local\\WoodsIslandHandoff-{pid}-{created}-");
    let suffix = name
        .strip_prefix(&prefix)
        .ok_or("Invalid watchdog handoff event")?;
    if suffix.len() != 36
        || !suffix
            .chars()
            .all(|character| character.is_ascii_hexdigit() || character == '-')
    {
        return Err("Invalid watchdog handoff nonce".into());
    }
    let ready_name = event_name(&format!("{name}-ready"));
    let commit_name = event_name(&format!("{name}-commit"));
    // Open both events before ACK. A timeout/cancellation drops the parent's
    // handles; the child keeps these handles only until its bounded commit wait.
    let ready = Process(
        unsafe { OpenEventW(EVENT_MODIFY_STATE, false, PCWSTR(ready_name.as_ptr())) }
            .map_err(|error| error.to_string())?,
    );
    let commit = Process(
        unsafe {
            OpenEventW(
                SYNCHRONIZATION_SYNCHRONIZE,
                false,
                PCWSTR(commit_name.as_ptr()),
            )
        }
        .map_err(|error| error.to_string())?,
    );
    unsafe { SetEvent(ready.0) }.map_err(|error| error.to_string())?;
    match unsafe { WaitForSingleObject(commit.0, timeout) } {
        WAIT_OBJECT_0 => Ok(()),
        WAIT_TIMEOUT => Err("Watchdog predecessor did not commit recovery".into()),
        _ => Err("Watchdog commit wait failed".into()),
    }
}
fn spawn_replacement() -> Result<(), String> {
    if STOPPING.load(Ordering::SeqCst) {
        return Err("Application is stopping".into());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let created = creation_time(unsafe { GetCurrentProcess() })?;
    let handoff = HandoffEvents::create(std::process::id(), created)?;
    crate::system::command(exe.to_str().ok_or("Executable path is not UTF-8")?)
        .args(std::env::args_os().skip(1))
        .env(PARENT_PID, std::process::id().to_string())
        .env(PARENT_CREATED, created.to_string())
        .env(HANDOFF_NAME, &handoff.name)
        .spawn()
        .map_err(|e| e.to_string())?;
    handoff.authorize_exit(ACK_TIMEOUT_MS, || !STOPPING.load(Ordering::SeqCst))
}
fn wait_for_identity(pid: u32, created: u64, timeout: u32, handoff: &str) -> Result<(), String> {
    if pid == 0 || pid == std::process::id() {
        return Err("Invalid watchdog predecessor".into());
    }
    let handle = match unsafe {
        OpenProcess(
            PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
            false,
            pid,
        )
    } {
        Ok(handle) => Process(handle),
        Err(error) => return Err(error.to_string()),
    };
    // Never wait for a different process that happened to reuse this PID.
    if creation_time(handle.0)? != created {
        return Err("Watchdog predecessor creation identity differs".into());
    }
    let expected = std::env::current_exe().map_err(|e| e.to_string())?;
    let actual = image_path(handle.0)?;
    if actual.to_string_lossy().to_lowercase() != expected.to_string_lossy().to_lowercase() {
        return Err("Watchdog predecessor executable differs".into());
    }
    // The predecessor does not exit before this ACK. Holding the verified handle
    // closes OpenProcess's ERROR_ACCESS_DENIED race during process destruction.
    acknowledge_handoff(pid, created, handoff, COMMIT_TIMEOUT_MS)?;
    match unsafe { WaitForSingleObject(handle.0, timeout) } {
        WAIT_OBJECT_0 => Ok(()),
        WAIT_TIMEOUT => Err("Watchdog predecessor did not exit".into()),
        _ => Err("Watchdog predecessor wait failed".into()),
    }
}
/// Call before application initialization in main.rs. The replacement waits for
/// this exact predecessor's exit before taking the existing single-instance mutex.
/// One-shot environment flags are cleared so normal restarts cannot inherit them.
pub fn wait_for_predecessor() -> Result<(), String> {
    let pid = std::env::var(PARENT_PID).ok();
    let created = std::env::var(PARENT_CREATED).ok();
    let handoff = std::env::var(HANDOFF_NAME).ok();
    std::env::remove_var(PARENT_PID);
    std::env::remove_var(PARENT_CREATED);
    std::env::remove_var(HANDOFF_NAME);
    match (pid, created, handoff) {
        (None, None, None) => Ok(()),
        (Some(pid), Some(created), Some(handoff)) => {
            let pid = pid
                .parse::<u32>()
                .map_err(|_| "Invalid watchdog predecessor PID")?;
            let created = created
                .parse::<u64>()
                .map_err(|_| "Invalid watchdog predecessor time")?;
            wait_for_identity(pid, created, 30_000, &handoff)?;
            AFTER_RECOVERY.store(true, Ordering::SeqCst);
            Ok(())
        }
        _ => Err("Incomplete watchdog predecessor identity".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn current_process_has_a_stable_creation_identity() {
        let handle = unsafe { GetCurrentProcess() };
        let at = creation_time(handle).unwrap();
        assert!(at > 0);
        assert_eq!(creation_time(handle).unwrap(), at);
    }
    #[test]
    fn activity_guard_protects_all_clones_until_the_last_worker_releases_it() {
        let guard = Arc::new(protect_activity().unwrap());
        let worker = guard.clone();
        drop(guard);
        assert!(is_protected());
        assert!(!claim_recovery());
        drop(worker);
    }
    #[test]
    fn invalid_predecessor_cannot_wait_for_the_current_process() {
        assert!(wait_for_identity(std::process::id(), 0, 1, "invalid").is_err());
        assert!(wait_for_identity(0, 0, 1, "invalid").is_err());
    }
    #[test]
    fn handoff_names_are_random_and_bound_to_the_verified_creation_identity() {
        let created = creation_time(unsafe { GetCurrentProcess() }).unwrap();
        let first = HandoffEvents::create(std::process::id(), created).unwrap();
        let second = HandoffEvents::create(std::process::id(), created).unwrap();
        assert_ne!(first.name, second.name);
        assert!(acknowledge_handoff(std::process::id(), created + 1, &first.name, 1).is_err());
        assert!(
            acknowledge_handoff(std::process::id(), created, "Local\\OtherProgramEvent", 1)
                .is_err()
        );
        assert_eq!(
            unsafe { WaitForSingleObject(first.ready.0, 0) },
            WAIT_TIMEOUT
        );
    }
    #[test]
    fn missing_ack_and_canceled_handoff_never_commit_or_exit_the_parent() {
        let created = creation_time(unsafe { GetCurrentProcess() }).unwrap();
        let handoff = HandoffEvents::create(std::process::id(), created).unwrap();
        assert!(handoff
            .authorize_exit(1, || panic!("Missing ACK must not reach commit"))
            .is_err());
        assert_eq!(
            unsafe { WaitForSingleObject(handoff.commit.0, 0) },
            WAIT_TIMEOUT
        );
        unsafe { SetEvent(handoff.ready.0) }.unwrap();
        assert!(handoff.authorize_exit(1, || false).is_err());
        assert_eq!(
            unsafe { WaitForSingleObject(handoff.commit.0, 0) },
            WAIT_TIMEOUT
        );
        assert_eq!(
            creation_time(unsafe { GetCurrentProcess() }).unwrap(),
            created
        );
    }
    #[test]
    fn child_ack_has_a_bounded_commit_wait_and_does_not_exit_the_parent() {
        let pid = std::process::id();
        let created = creation_time(unsafe { GetCurrentProcess() }).unwrap();
        let handoff = HandoffEvents::create(pid, created).unwrap();
        let failure = acknowledge_handoff(pid, created, &handoff.name, 1).unwrap_err();
        assert!(failure.contains("did not commit"));
        assert_eq!(
            unsafe { WaitForSingleObject(handoff.ready.0, 0) },
            WAIT_OBJECT_0
        );
        assert_eq!(
            creation_time(unsafe { GetCurrentProcess() }).unwrap(),
            created
        );
    }
    #[test]
    fn native_ack_and_commit_roundtrip_uses_two_distinct_waitable_events() {
        let pid = std::process::id();
        let created = creation_time(unsafe { GetCurrentProcess() }).unwrap();
        let handoff = HandoffEvents::create(pid, created).unwrap();
        let name = handoff.name.clone();
        let peer = std::thread::spawn(move || acknowledge_handoff(pid, created, &name, 1_000));
        handoff.authorize_exit(1_000, || true).unwrap();
        peer.join().unwrap().unwrap();
        assert_eq!(
            unsafe { WaitForSingleObject(handoff.commit.0, 0) },
            WAIT_TIMEOUT
        );
        assert_eq!(
            creation_time(unsafe { GetCurrentProcess() }).unwrap(),
            created
        );
    }
    #[test]
    fn failed_ack_does_not_refund_the_persisted_restart_budget() {
        let dir = std::env::temp_dir().join(format!(
            "woods-watchdog-ack-budget-{}-{}",
            std::process::id(),
            wall_ms()
        ));
        fs::create_dir_all(&dir).unwrap();
        let handoff = HandoffEvents::create(
            std::process::id(),
            creation_time(unsafe { GetCurrentProcess() }).unwrap(),
        )
        .unwrap();
        for now in [1_000, 2_000] {
            assert!(reserve_attempt(&dir, now, Recovery::Restart).unwrap());
            assert!(handoff.authorize_exit(1, || true).is_err());
        }
        assert!(!reserve_attempt(&dir, 3_000, Recovery::Restart).unwrap());
        fs::remove_file(dir.join("watchdog-budget.json")).unwrap();
        fs::remove_dir(dir).unwrap();
    }
    #[test]
    fn budget_roundtrip_retains_kinds_and_never_overwrites_invalid_records() {
        let dir = std::env::temp_dir().join(format!(
            "woods-watchdog-test-{}-{}",
            std::process::id(),
            wall_ms()
        ));
        fs::create_dir_all(&dir).unwrap();
        assert!(reserve_attempt(&dir, 1_000, Recovery::Restart).unwrap());
        assert!(reserve_attempt(&dir, 2_000, Recovery::Restart).unwrap());
        assert!(!reserve_attempt(&dir, 3_000, Recovery::Restart).unwrap());
        let path = dir.join("watchdog-budget.json");
        fs::write(&path, b"invalid retained bytes").unwrap();
        assert!(reserve_attempt(&dir, 4_000, Recovery::Navigate).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"invalid retained bytes");
        fs::remove_file(path).unwrap();
        fs::remove_dir(dir).unwrap();
    }
}
