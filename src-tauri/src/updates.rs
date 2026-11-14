//! Signed NSIS updates. Downloading never exits the application; installation is explicit.
use serde::Serialize;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::{LazyLock, Mutex}, time::{Duration, Instant}};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::{Update, Updater, UpdaterExt};

pub const RELEASES: &str = "https://github.com/nimalekyt-bit/woods-island/releases";
const MAX_PACKAGE: u64 = 256 * 1024 * 1024;
static OPERATION: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static CANCEL: LazyLock<tokio::sync::watch::Sender<u64>> = LazyLock::new(|| tokio::sync::watch::channel(0).0);
static CURRENT: LazyLock<Mutex<Current>> = LazyLock::new(|| Mutex::new(Current::default()));

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub status: String,
    pub version: Option<String>,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub error: Option<String>,
    pub can_install: bool,
    pub reason: Option<String>,
}
impl Default for Status {
    fn default() -> Self {
        let can_install = installed_directory().is_some();
        Self { status: "idle".into(), version: None, downloaded: 0, total: None,
            error: None, can_install, reason: (!can_install).then(|| "portable".into()) }
    }
}
#[derive(Default)]
struct Current { status: Status, update: Option<Update> }

// A portable copy must never silently become a separately installed application.
fn installed_directory() -> Option<PathBuf> {
    if crate::win::WindowManager::passive_qa() { return None; }
    let exe = std::env::current_exe().ok()?;
    let directory = exe.parent()?;
    if !directory.join("uninstall.exe").is_file() { return None; }
    // Only the NSIS-registered installation can replace itself. A copied folder
    // containing an uninstaller still belongs to the portable/manual flow.
    use windows::{core::w, Win32::{Foundation::ERROR_SUCCESS, System::Registry::*}};
    let mut value = [0_u16; 32768];
    let mut size = std::mem::size_of_val(&value) as u32;
    let result = unsafe { RegGetValueW(HKEY_CURRENT_USER,
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Woods Island"),
        w!("InstallLocation"), RRF_RT_REG_SZ, None,
        Some(value.as_mut_ptr().cast()), Some(&mut size)) };
    if result != ERROR_SUCCESS { return None; }
    let end = value.iter().position(|c| *c == 0)?;
    let registered = String::from_utf16(&value[..end]).ok()?;
    let registered = PathBuf::from(registered.trim_matches('"')).canonicalize().ok()?;
    let actual = directory.canonicalize().ok()?;
    if !registered.to_string_lossy().eq_ignore_ascii_case(&actual.to_string_lossy()) { return None; }
    Some(directory.to_owned())
}
pub(crate) fn ensure_crypto() {
    // The updater uses reqwest's rustls-no-provider backend. Its client must
    // have an explicit provider before the first check or download.
    let _ = rustls::crypto::ring::default_provider().install_default();
}
fn updater(app: &AppHandle) -> Result<Updater, tauri_plugin_updater::Error> {
    ensure_crypto();
    let handle = app.clone();
    // The plugin's default hook tears down Tauri before ShellExecute succeeds.
    // Finalize recordings here, but keep the UI alive if Windows refuses to launch.
    let mut builder = app.updater_builder().on_before_exit(move || crate::finalize_background(&handle));
    if let Some(directory) = installed_directory() {
        // NSIS requires /D last and unquoted, including paths containing spaces.
        builder = builder.installer_arg(format!("/D={}", directory.display()));
    }
    builder.timeout(Duration::from_secs(20)).build()
}
fn cache_file() -> PathBuf { crate::storage::get_storage_dir().join("updates").join("setup.exe") }
fn metadata_file() -> PathBuf { cache_file().with_file_name("release.json") }
pub(crate) fn cached_manifest(update: &Update) -> Value {
    // Release notes and unrelated server fields are not needed for restoration.
    json!({"version":update.version,"platforms":{"windows-x86_64":{
        "url":update.download_url,"signature":update.signature
    }}})
}
pub fn restore(app: &AppHandle) {
    let Ok(_operation) = OPERATION.try_lock() else { return; };
    if installed_directory().is_none() || CURRENT.lock().unwrap().update.is_some() { return; }
    let Ok(meta) = std::fs::metadata(metadata_file()) else { return; };
    if meta.len() > 128 * 1024 { return; }
    let Some(raw) = std::fs::read(metadata_file()).ok().and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok()) else { return; };
    let Ok(updater) = updater(app) else { return; };
    let Ok(Some(update)) = updater.restore_update(raw) else { return; };
    if !allowed_package(&update.version, update.download_url.as_str()) { return; }
    let Ok(meta) = std::fs::metadata(cache_file()) else { return; };
    if meta.len() > MAX_PACKAGE { return; }
    let Ok(bytes) = std::fs::read(cache_file()) else { return; };
    if update.verify(&bytes).is_err() { return; }
    let version = update.version.clone();
    CURRENT.lock().unwrap().update = Some(update);
    change(app, |s| { s.status = "ready".into(); s.version = Some(version); s.downloaded = meta.len(); s.total = Some(meta.len()); });
}
pub fn status() -> Value { serde_json::to_value(&CURRENT.lock().unwrap().status).unwrap_or(Value::Null) }
fn change(app: &AppHandle, f: impl FnOnce(&mut Status)) {
    let snapshot = { let mut current = CURRENT.lock().unwrap(); f(&mut current.status); current.status.clone() };
    let _ = app.emit("update:state", snapshot);
}
fn fail(app: &AppHandle, code: &str) -> String {
    change(app, |s| { s.status = "error".into(); s.error = Some(code.into()); });
    code.into()
}
fn version_parts(version: &str) -> Option<[u64; 3]> {
    let parts = version.split('.').collect::<Vec<_>>();
    if parts.len() != 3 || parts.iter().any(|part| part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit())) { return None; }
    Some([parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?])
}
fn allowed_package(version: &str, url: &str) -> bool {
    version_parts(version).is_some() && url == format!("{RELEASES}/download/v{version}/Woods-Island-{version}-windows-x64-Setup.exe")
}
fn error_code(error: &tauri_plugin_updater::Error) -> &'static str {
    use tauri_plugin_updater::Error;
    match error {
        Error::Minisign(_) | Error::MissingSignedVersion | Error::SignedVersionMismatch { .. } => "signature",
        _ => "downloadFailed",
    }
}

pub async fn check(app: AppHandle) -> Result<Option<Value>, String> {
    let _operation = OPERATION.try_lock().map_err(|_| "busy".to_owned())?;
    let was_ready = CURRENT.lock().unwrap().status.status == "ready";
    change(&app, |s| { s.status = "checking".into(); s.error = None; });
    let updater = updater(&app).map_err(|_| fail(&app, "configuration"))?;
    let update = updater.check().await.map_err(|_| {
        if was_ready { change(&app, |s| { s.status = "ready".into(); s.error = Some("offline".into()); }); "offline".into() }
        else { fail(&app, "offline") }
    })?;
    let Some(mut update) = update else {
        CURRENT.lock().unwrap().update = None;
        change(&app, |s| { s.status = "upToDate".into(); s.version = None; s.downloaded = 0; s.total = None; });
        return Ok(None);
    };
    if !allowed_package(&update.version, update.download_url.as_str())
        || version_parts(&update.version) <= version_parts(env!("CARGO_PKG_VERSION")) {
        return Err(fail(&app, "invalidRelease"));
    }
    update.timeout = Some(Duration::from_secs(300));
    let can_install = installed_directory().is_some();
    let ready = if can_install && std::fs::metadata(cache_file()).is_ok_and(|m| m.len() <= MAX_PACKAGE) {
        std::fs::read(cache_file()).ok().filter(|bytes| update.verify(bytes).is_ok()).map(|b| b.len() as u64)
    } else { None };
    let info = json!({"version":update.version,"current":env!("CARGO_PKG_VERSION"),
        "url":format!("{RELEASES}/tag/v{}",update.version),"notes":update.body});
    let version = update.version.clone();
    CURRENT.lock().unwrap().update = Some(update);
    change(&app, |s| {
        s.status = if ready.is_some() { "ready" } else { "available" }.into();
        s.version = Some(version); s.can_install = can_install;
        s.reason = (!can_install).then(|| "portable".into()); s.downloaded = ready.unwrap_or(0); s.total = ready;
    });
    let _ = app.emit("update:available", info.clone());
    Ok(Some(info))
}

pub async fn download(app: AppHandle) -> Result<bool, String> {
    let _operation = OPERATION.try_lock().map_err(|_| "busy".to_owned())?;
    if installed_directory().is_none() { return Err(fail(&app, "notInstalled")); }
    let candidate = CURRENT.lock().unwrap().update.clone();
    let update = candidate.ok_or_else(|| fail(&app, "checkFirst"))?;
    let mut cancel = CANCEL.subscribe();
    change(&app, |s| { s.status = "downloading".into(); s.error = None; s.downloaded = 0; s.total = None; });
    let mut received = 0_u64;
    let mut last_event = Instant::now();
    let mut too_large = false;
    let result = {
        let fetch = update.download(|chunk, total| {
            received = received.saturating_add(chunk as u64);
            if received > MAX_PACKAGE || total.is_some_and(|n| n > MAX_PACKAGE) {
                too_large = true; CANCEL.send_modify(|n| *n = n.wrapping_add(1));
            }
            if last_event.elapsed() > Duration::from_millis(150) {
                change(&app, |s| { s.downloaded = received; s.total = total; }); last_event = Instant::now();
            }
        }, || {});
        tokio::pin!(fetch);
        tokio::select! { biased;
            _ = cancel.changed() => None,
            bytes = &mut fetch => Some(bytes),
        }
    };
    if too_large { return Err(fail(&app, "packageTooLarge")); }
    let Some(result) = result else {
        change(&app, |s| { s.status = "available".into(); s.error = None; s.downloaded = 0; s.total = None; });
        return Ok(false);
    };
    let bytes = result.map_err(|error| fail(&app, error_code(&error)))?;
    if bytes.len() as u64 > MAX_PACKAGE { return Err(fail(&app, "packageTooLarge")); }
    crate::storage::atomic_write(&cache_file(), &bytes).map_err(|_| fail(&app, "storage"))?;
    let metadata = serde_json::to_vec(&cached_manifest(&update)).map_err(|_| fail(&app, "invalidRelease"))?;
    if metadata.len() > 128 * 1024 { return Err(fail(&app, "invalidRelease")); }
    crate::storage::atomic_write(&metadata_file(), &metadata).map_err(|_| fail(&app, "storage"))?;
    change(&app, |s| { s.status = "ready".into(); s.downloaded = bytes.len() as u64; s.total = Some(bytes.len() as u64); });
    Ok(true)
}
pub fn cancel() -> bool {
    if CURRENT.lock().unwrap().status.status != "downloading" { return false; }
    CANCEL.send_modify(|n| *n = n.wrapping_add(1)); true
}
pub async fn install(app: AppHandle) -> Result<bool, String> {
    let _operation = OPERATION.try_lock().map_err(|_| "busy".to_owned())?;
    if installed_directory().is_none() { return Err(fail(&app, "notInstalled")); }
    let update = {
        let current = CURRENT.lock().unwrap();
        if current.status.status != "ready" { return Err("downloadFirst".into()); }
        current.update.clone().ok_or("checkFirst")?
    };
    if std::fs::metadata(cache_file()).map_err(|_| fail(&app, "storage"))?.len() > MAX_PACKAGE {
        return Err(fail(&app, "packageTooLarge"));
    }
    let bytes = std::fs::read(cache_file()).map_err(|_| fail(&app, "storage"))?;
    update.verify(&bytes).map_err(|_| fail(&app, "signature"))?;
    change(&app, |s| { s.status = "installing".into(); s.error = None; });
    update.install(&bytes).map_err(|_| {
        // A launch failure does not invalidate the verified package. Preserve
        // the install action so a retry also works without an internet connection.
        change(&app, |s| { s.status = "ready".into(); s.error = Some("installFailed".into()); });
        "installFailed".to_owned()
    })?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stable_versions_order_numerically_and_reject_paths() {
        assert!(version_parts("1.10.0") > version_parts("1.2.0"));
        for invalid in ["1.2", "../setup", "1.2.0-beta", "v1.2.0", "1.2.0/evil", "1.2.-1"] { assert!(version_parts(invalid).is_none()); }
    }
    #[test]
    fn packages_are_bound_to_the_product_version_and_exact_https_asset() {
        let valid = format!("{RELEASES}/download/v1.2.0/Woods-Island-1.2.0-windows-x64-Setup.exe");
        assert!(allowed_package("1.2.0", &valid));
        assert!(!allowed_package("1.3.0", &valid));
        assert!(!allowed_package("1.2.0", &valid.replace("https:", "http:")));
        assert!(!allowed_package("1.2.0", &format!("{valid}?token=anything")));
        assert!(!allowed_package("1.2.0", &valid.replace("github.com/", "github.com.evil/")));
    }
}
