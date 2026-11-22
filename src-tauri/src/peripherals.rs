//! Local peripheral battery telemetry. Windows properties and standard HID only.
//! Vendor commands must be enabled by an independently verified device adapter.
mod compx;
mod dareu;
mod dareu_em901x;
mod dareu_tg;
mod hyperx;
mod g435;
mod keyboard_usb;
mod rongyuan;
mod schedule;
mod steelseries;
mod windows_devices;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Listener};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub reported_name: Option<String>,
    pub kind: String,
    pub transport: String,
    pub present: bool,
    pub connected: Option<bool>,
    // Used only while merging physical HID collections in one native scan.
    #[serde(skip)]
    pub(super) connection_priority: u8,
    pub percent: Option<u8>,
    pub charging: Option<bool>,
    #[serde(default)]
    pub charging_read_at: Option<u64>,
    pub battery_status: String,
    #[serde(default)]
    pub unavailable_reason: Option<String>,
    pub source: String,
    pub last_read_at: Option<u64>,
}

impl Device {
    pub(super) fn new(id: String, name: String, kind: &str, transport: &str) -> Self {
        Self {
            id,
            name,
            kind: kind.into(),
            transport: transport.into(),
            present: true,
            connected: None,
            connection_priority: 0,
            percent: None,
            charging: None,
            charging_read_at: None,
            battery_status: "unavailable".into(),
            source: "none".into(),
            last_read_at: None,
            unavailable_reason: Some("readerUnavailable".into()),
            reported_name: None,
        }
    }
    pub(super) fn battery(&mut self, percent: u8, source: &str) {
        if percent <= 100 {
            self.percent = Some(percent);
            self.source = source.into();
            self.last_read_at = Some(crate::media::now_ms());
            self.battery_status = "available".into();
            self.unavailable_reason = None;
        }
    }
}

#[derive(Default)]
struct Cache {
    devices: BTreeMap<String, Device>,
    missing_since: BTreeMap<String, u64>,
    revision: u64,
    last_scan_at: Option<u64>,
    error: Option<String>,
}

impl Cache {
    fn update(&mut self, devices: Vec<Device>, now: u64) -> bool {
        self.update_inventory(devices, &BTreeSet::new(), now)
    }

    fn update_inventory(
        &mut self,
        devices: Vec<Device>,
        present: &BTreeSet<String>,
        now: u64,
    ) -> bool {
        let physical: BTreeMap<_, _> = devices.iter().map(|d| (d.id.clone(), d.clone())).collect();
        let mut parents = std::collections::BTreeSet::new();
        let mut next = BTreeMap::new();
        let mut recheck_loss = false;
        for mut device in devices {
            if receiver_marker(&device.source) {
                continue;
            }
            if let Some(parent) = endpoint_parent(&device.id) {
                parents.insert(parent.to_owned());
            }
            if self.devices.get(&device.id).is_some_and(|previous| {
                previous.connected == Some(true) && device.connected == Some(false)
            }) {
                recheck_loss = true;
            }
            self.missing_since.remove(&device.id);
            if device.percent.is_none() {
                if let Some(previous) = self.devices.get(&device.id) {
                    if previous
                        .last_read_at
                        .is_some_and(|at| now.saturating_sub(at) < 30 * 60 * 1000)
                    {
                        device.percent = previous.percent;
                        device.last_read_at = previous.last_read_at;
                        device.source = previous.source.clone();
                        device.battery_status = "stale".into();
                        // A stale report cannot confirm charging or connectivity.
                        if device.charging_read_at.is_none() {
                            device.charging = None;
                        }
                    }
                }
            }
            if device.connected == Some(false) {
                device.charging = None;
                device.charging_read_at = None;
                if device.percent.is_some() {
                    device.battery_status = "stale".into();
                }
            }
            next.insert(device.id.clone(), device);
        }
        for (id, previous) in &self.devices {
            if next.contains_key(id) {
                continue;
            }
            if let Some(parent) = endpoint_parent(id) {
                if let Some(receiver) = physical.get(parent).filter(|d| d.present) {
                    parents.insert(parent.to_owned());
                    self.missing_since.remove(id);
                    let mut device = previous.clone();
                    // Successful slot inventory proves absence; a failed query proves nothing.
                    device.present = true;
                    device.connected = if receiver_marker(&receiver.source) {
                        Some(false)
                    } else {
                        None
                    };
                    device.charging = None;
                    device.charging_read_at = None;
                    if previous.connected == Some(true) && device.connected == Some(false) {
                        recheck_loss = true;
                    }
                    if previous
                        .last_read_at
                        .is_some_and(|at| now.saturating_sub(at) < 30 * 60 * 1000)
                    {
                        device.battery_status = "stale".into();
                    } else {
                        device.percent = None;
                        device.last_read_at = None;
                        device.battery_status = "unavailable".into();
                    }
                    next.insert(id.clone(), device);
                    continue;
                }
            }
            // Complete SetupAPI discovery still proves USB presence when a
            // read was deferred or the HID handle could not be opened.
            if present.contains(endpoint_parent(id).unwrap_or(id)) {
                self.missing_since.remove(id);
                let mut device = previous.clone();
                device.present = true;
                device.connected = None;
                device.charging = None;
                device.charging_read_at = None;
                if device
                    .last_read_at
                    .is_some_and(|at| now.saturating_sub(at) < 30 * 60 * 1000)
                {
                    device.battery_status = "stale".into();
                } else {
                    device.percent = None;
                    device.last_read_at = None;
                    device.battery_status = "unavailable".into();
                }
                next.insert(id.clone(), device);
                continue;
            }
            let since = *self.missing_since.entry(id.clone()).or_insert(now);
            if now.saturating_sub(since) >= 30 * 60 * 1000 {
                continue;
            }
            let mut device = previous.clone();
            if device.present {
                recheck_loss = true;
            }
            device.present = false;
            device.connected = Some(false);
            device.charging = None;
            device.charging_read_at = None;
            if device.percent.is_some()
                && device
                    .last_read_at
                    .is_some_and(|at| now.saturating_sub(at) < 30 * 60 * 1000)
            {
                device.battery_status = "stale".into();
            } else {
                device.percent = None;
                device.last_read_at = None;
                device.battery_status = "unavailable".into();
            }
            next.insert(id.clone(), device);
        }
        // Composite receiver nodes are inventory, not additional mice in the card.
        for parent in parents {
            next.remove(&parent);
        }
        self.missing_since.retain(|id, _| next.contains_key(id));
        self.devices = next;
        self.last_scan_at = Some(now);
        self.error = None;
        self.revision += 1;
        recheck_loss
    }
    fn failed(&mut self, now: u64) {
        self.error = Some("inventoryUnavailable".into());
        for device in self.devices.values_mut() {
            if device.percent.is_some()
                && device
                    .last_read_at
                    .is_some_and(|at| now.saturating_sub(at) < 30 * 60 * 1000)
            {
                device.battery_status = "stale".into();
            } else {
                device.percent = None;
                device.last_read_at = None;
                device.battery_status = "unavailable".into();
            }
            // An inventory error is neither a radio loss nor fresh charging.
            device.charging = None;
            device.charging_read_at = None;
            device.connected = None;
        }
        self.revision += 1;
    }
    fn payload(&self) -> Value {
        let now = crate::media::now_ms();
        let manual = manual_history().lock().unwrap_or_else(|e| e.into_inner());
        let devices: Vec<Value> = self.devices.values().map(|device| {
            let mut item = serde_json::to_value(device).unwrap_or(Value::Null);
            item["manualMeasurementAvailable"] = json!(device.present
                && device.unavailable_reason.as_deref() == Some("audioInterruption"));
            if let Some(reading) = manual.get(&device.id).filter(|r| r.valid(now)) {
                item["percent"] = json!(reading.estimated_percent);
                item["source"] = json!("g435-manual");
                item["batteryStatus"] = json!("stale");
                item["lastReadAt"] = json!(reading.read_at);
                item["manualMillivolts"] = json!(reading.millivolts);
                item["charging"] = Value::Null;
                item["chargingReadAt"] = Value::Null;
            }
            item
        }).collect();
        json!({"revision": self.revision, "devices": devices,
            "lastScanAt": self.last_scan_at, "loading": self.last_scan_at.is_none() && self.error.is_none(),
            "error": self.error})
    }
}
fn receiver_marker(source: &str) -> bool {
    matches!(source, "inventory-tg" | "inventory-ry")
}
fn endpoint_parent(id: &str) -> Option<&str> {
    id.rsplit_once(":tg:")
        .or_else(|| id.rsplit_once(":ry:"))
        .map(|(parent, _)| parent)
}

static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
static WAKE: (Mutex<bool>, Condvar) = (Mutex::new(false), Condvar::new());
static STARTED: OnceLock<()> = OnceLock::new();
static MANUAL_BUSY: Mutex<()> = Mutex::new(());
static MANUAL_HISTORY: OnceLock<Mutex<BTreeMap<String, g435::Reading>>> = OnceLock::new();
fn manual_history() -> &'static Mutex<BTreeMap<String,g435::Reading>> {
    MANUAL_HISTORY.get_or_init(|| {
        let now=crate::media::now_ms();
        let saved = crate::storage::load_json_file("peripheral-manual.json")
            .and_then(|v|serde_json::from_value::<BTreeMap<String,g435::Reading>>(v).ok())
            .unwrap_or_default().into_iter().filter(|(id,r)|id.len()<=256&&r.valid(now)).take(128).collect();
        Mutex::new(saved)
    })
}
fn cache() -> &'static Mutex<Cache> {
    CACHE.get_or_init(|| Mutex::new(Cache::default()))
}

pub fn snapshot() -> Value {
    cache().lock().unwrap_or_else(|e| e.into_inner()).payload()
}

/// Dedicated CLI entry points never launch the HUD or ordinary battery polling.
pub fn g435_child(target: &str, recovery: bool) -> Value { g435::child(target,recovery) }

fn run_g435_child(target: &str, recovery: bool, seconds: u64) -> Result<Value,String> {
    let mut child=Command::new(std::env::current_exe().map_err(|_|"g435Io")?)
        .arg(if recovery{"--g435-exit"}else{"--g435-measure"}).arg(target)
        .arg("--allow-audio-pause").stdin(Stdio::null()).stdout(Stdio::piped())
        .stderr(Stdio::null()).creation_flags(0x08000000).spawn().map_err(|_|"g435Io")?;
    let stdout=child.stdout.take().ok_or("g435Io")?;
    let reader=std::thread::spawn(move||{let mut bytes=Vec::new();stdout.take(64*1024+1).read_to_end(&mut bytes).map(|_|bytes)});
    let began=Instant::now();
    let finished=loop {
        match child.try_wait(){Ok(Some(status))=>break status.success(),Err(_)=>{let _=child.kill();let _=child.wait();break false;},_=>{}}
        if began.elapsed()>=Duration::from_secs(seconds){let _=child.kill();let _=child.wait();break false;}
        std::thread::sleep(Duration::from_millis(25));
    };
    let bytes=reader.join().map_err(|_|"g435Io")?.map_err(|_|"g435Io")?;
    if !finished || bytes.len()>64*1024{return Err("g435Timeout".into());}
    serde_json::from_slice(&bytes).map_err(|_|"g435Io".into())
}

pub fn measure_g435(target: &str, allow_audio_pause: bool, app: &AppHandle) -> Result<Value,String> {
    if !allow_audio_pause{return Err("g435ConfirmationRequired".into());}
    if crate::win::WindowManager::passive_qa(){return Err("g435QaDisabled".into());}
    let _busy=MANUAL_BUSY.try_lock().map_err(|_|"g435Busy")?;
    let eligible=cache().lock().unwrap_or_else(|e|e.into_inner()).devices.get(target)
        .is_some_and(|d|d.present&&d.unavailable_reason.as_deref()==Some("audioInterruption"));
    if !eligible{return Err("g435Unsupported".into());}
    let result=match run_g435_child(target,false,14){
        Ok(value)=>value,
        Err(_)=>{
            let recovered=run_g435_child(target,true,5).ok().is_some_and(|v|v["ok"]==true);
            return Err(if recovered{"g435Timeout"}else{"g435ExitUnconfirmed"}.into());
        }
    };
    if result["ok"]!=true{return Err(result["error"].as_str().unwrap_or("g435NoReply").into());}
    let reading: g435::Reading=serde_json::from_value(result["reading"].clone()).map_err(|_|"g435NoReply")?;
    if !reading.valid(crate::media::now_ms()){return Err("g435NoReply".into());}
    let saved={
        let mut history=manual_history().lock().unwrap_or_else(|e|e.into_inner());
        history.retain(|_,r|r.valid(crate::media::now_ms()));
        if history.len()>=128&&!history.contains_key(target){history.pop_first();}
        history.insert(target.into(),reading);
        crate::storage::save_json_file("peripheral-manual.json",&json!(*history)).is_ok()
    };
    cache().lock().unwrap_or_else(|e|e.into_inner()).revision+=1;
    let _=app.emit("peripherals:update",snapshot());
    Ok(json!({"saved":saved}))
}

/// Read-only diagnostic snapshot; it never starts a background worker or changes settings.
pub fn inspect() -> Result<Value, String> {
    let mut cache = Cache::default();
    cache.update(windows_devices::scan()?, crate::media::now_ms());
    Ok(cache.payload())
}

/// Scanner subprocess payload includes physical receiver markers for failure handling.
pub fn scan_payload() -> Result<Value, String> {
    windows_devices::guard_scanner()?;
    let order =
        schedule::decoded_order(&std::env::var("WOODS_PERIPHERAL_SCAN_ORDER").unwrap_or_default());
    serde_json::to_value(windows_devices::scan_ordered(&order)?).map_err(|e| e.to_string())
}

/// Cached HID descriptor metadata only: no feature/input/output report transactions.
pub fn descriptor_inventory() -> Result<Value, String> {
    windows_devices::descriptors()
}

/// Targeted diagnostic GET_FEATURE on the identified legacy RONGYUAN keyboard collection.
pub fn rongyuan_feature_inventory() -> Result<Value, String> {
    windows_devices::rongyuan_features()
}

pub fn rongyuan_status_inventory() -> Result<Value, String> {
    windows_devices::rongyuan_status()
}

pub fn request_refresh() {
    *WAKE.0.lock().unwrap_or_else(|e| e.into_inner()) = true;
    WAKE.1.notify_one();
}

fn isolated_scan(
    state: &crate::AppState,
    queue: &mut schedule::ScanQueue,
) -> Result<schedule::ScanReport, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut child = Command::new(exe)
        .arg("--peripheral-scan")
        .env(
            "WOODS_PERIPHERAL_SCAN_ORDER",
            schedule::encoded_order(&queue.order()),
        )
        .env("WOODS_PERIPHERAL_SCAN_PROGRESS", "1")
        .env(
            "WOODS_PERIPHERAL_PARENT_PID",
            std::process::id().to_string(),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| e.to_string())?;
    let output = child.stdout.take().ok_or("Scanner stdout unavailable")?;
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        output
            .take(512 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let began = Instant::now();
    let success = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.success(),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                break false;
            }
            Ok(None) => {}
        }
        let enabled = state.settings.lock().unwrap_or_else(|e| e.into_inner())["showPeripherals"]
            .as_bool()
            .unwrap_or(true);
        if !enabled || began.elapsed() >= Duration::from_secs(8) {
            let _ = child.kill();
            let _ = child.wait();
            break false;
        }
        std::thread::sleep(Duration::from_millis(40));
    };
    let bytes = reader
        .join()
        .map_err(|_| "Scanner reader failed")?
        .map_err(|e| e.to_string())?;
    if !success || bytes.len() > 512 * 1024 {
        let inventory = bytes
            .split(|b| *b == b'\n')
            .next()
            .and_then(|line| serde_json::from_slice::<schedule::ScanInventory>(line).ok());
        queue.failed(inventory);
        return Err("Scanner unavailable".into());
    }
    bytes
        .split(|b| *b == b'\n')
        .rev()
        .find(|line| line.iter().any(|byte| !byte.is_ascii_whitespace()))
        .ok_or("Scanner payload unavailable".into())
        .and_then(|line| serde_json::from_slice(line).map_err(|e| e.to_string()))
}

pub fn start(app: AppHandle, state: std::sync::Arc<crate::AppState>) {
    if STARTED.set(()).is_err() {
        return;
    }
    let enabled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(
        state.settings.lock().unwrap_or_else(|e| e.into_inner())["showPeripherals"]
            .as_bool()
            .unwrap_or(true),
    ));
    app.listen("settings:changed", move |event| {
        if let Ok(settings) = serde_json::from_str::<Value>(event.payload()) {
            let next = settings["showPeripherals"].as_bool().unwrap_or(true);
            if enabled.swap(next, std::sync::atomic::Ordering::Relaxed) != next {
                request_refresh();
            }
        }
    });
    std::thread::Builder::new()
        .name("peripheral-battery".into())
        .spawn(move || {
            let mut schedule = schedule::ScanQueue::default();
            loop {
                let enabled = state.settings.lock().unwrap_or_else(|e| e.into_inner())
                    ["showPeripherals"]
                    .as_bool()
                    .unwrap_or(true);
                if !enabled {
                    let pending = WAKE.0.lock().unwrap_or_else(|e| e.into_inner());
                    let mut pending = WAKE
                        .1
                        .wait_while(pending, |pending| !*pending)
                        .unwrap_or_else(|e| e.into_inner());
                    *pending = false;
                    continue;
                }
                let started = Instant::now();
                let scan = isolated_scan(&state, &mut schedule);
                let mut poll_delay = Duration::from_secs(60);
                let payload = {
                    let mut saved = cache().lock().unwrap_or_else(|e| e.into_inner());
                    match scan {
                        Ok(scan) => {
                            schedule.update(&scan);
                            if saved.update_inventory(
                                scan.devices,
                                &scan.discovered,
                                crate::media::now_ms(),
                            ) {
                                // Confirm a loss once; ordinary scans stay at the low-cost interval.
                                poll_delay = Duration::from_secs(15);
                            }
                        }
                        Err(_) => {
                            saved.failed(crate::media::now_ms());
                        }
                    }
                    saved.payload()
                };
                let _ = app.emit("peripherals:update", payload);
                let pending = WAKE.0.lock().unwrap_or_else(|e| e.into_inner());
                let (mut pending, _) = WAKE
                    .1
                    .wait_timeout_while(pending, poll_delay, |pending| !*pending)
                    .unwrap_or_else(|e| e.into_inner());
                *pending = false;
                drop(pending);
                // Merge noisy device broadcasts and refresh clicks into one scan.
                let delay = Duration::from_secs(3).saturating_sub(started.elapsed());
                if !delay.is_zero() {
                    std::thread::sleep(delay);
                }
            }
        })
        .expect("peripheral telemetry worker");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persistent_inventory_errors_expire_the_last_percentage_and_recover() {
        let mut cache = Cache::default();
        let mut device = reading("mouse", Some(0), 1000);
        device.charging = Some(true);
        device.charging_read_at = Some(1000);
        cache.update(vec![device], 1000);
        cache.failed(2000);
        let device = &cache.devices["mouse"];
        assert_eq!(device.percent, Some(0));
        assert_eq!(device.last_read_at, Some(1000));
        assert_eq!(device.battery_status, "stale");
        assert!(device.present);
        assert_eq!(device.connected, None);
        assert_eq!(device.charging, None);
        assert_eq!(device.charging_read_at, None);
        assert_eq!(cache.last_scan_at, Some(1000));
        cache.failed(1_801_000);
        assert_eq!(cache.devices["mouse"].percent, None);
        assert_eq!(cache.devices["mouse"].battery_status, "unavailable");
        cache.update(vec![reading("mouse", Some(12), 1_802_000)], 1_802_000);
        assert_eq!(cache.devices["mouse"].percent, Some(12));
        assert_eq!(cache.devices["mouse"].battery_status, "available");
        assert_eq!(cache.devices["mouse"].connected, Some(true));
        assert_eq!(cache.error, None);
    }
    #[test]
    fn discovered_but_unread_devices_and_receiver_slots_are_unknown_not_removed() {
        let mut cache = Cache::default();
        let mut mouse = reading("mouse", Some(73), 1000);
        mouse.charging = Some(true);
        let slot = reading("receiver:tg:1:1147", Some(20), 1000);
        cache.update(vec![mouse, slot], 1000);
        let present = BTreeSet::from(["mouse".into(), "receiver".into()]);
        assert!(!cache.update_inventory(vec![], &present, 2000));
        for device in cache.devices.values() {
            assert!(device.present);
            assert_eq!(device.connected, None);
            assert_eq!(device.charging, None);
            assert_eq!(device.battery_status, "stale");
        }
        assert_eq!(cache.devices["mouse"].percent, Some(73));
        cache.update_inventory(vec![], &present, 2_000_000);
        assert!(cache.devices.values().all(|d| d.percent.is_none()));
        assert!(cache.update_inventory(vec![], &BTreeSet::new(), 2_000_001));
        assert!(cache.devices.values().all(|d| !d.present));
    }
    #[test]
    fn modern_receiver_failure_and_an_unused_slot_do_not_add_fantom_devices() {
        let mut cache = Cache::default();
        let endpoint = reading("container:one:ry:keyboard", Some(40), 1000);
        let mut marker = Device::new(
            "container:one".into(),
            "Receiver".into(),
            "other",
            "receiver",
        );
        marker.source = "inventory-ry".into();
        cache.update(vec![marker.clone(), endpoint.clone()], 1000);
        assert_eq!(cache.devices.len(), 1);
        let parent = Device::new(
            "container:one".into(),
            "Receiver".into(),
            "other",
            "receiver",
        );
        cache.update(vec![parent], 2000);
        assert_eq!(cache.devices[&endpoint.id].connected, None);
        assert_eq!(cache.devices.len(), 1);
        cache.update(vec![marker], 3000);
        assert_eq!(cache.devices[&endpoint.id].connected, Some(false));
        assert!(cache.devices[&endpoint.id].present);
        assert_eq!(cache.devices.len(), 1);
    }
    #[test]
    fn receiver_query_failure_keeps_endpoint_uncertain_instead_of_inventing_a_usb_loss() {
        let mut cache = Cache::default();
        let mut endpoint = reading("container:one:tg:1:1147", Some(73), 1000);
        endpoint.transport = "receiver".into();
        cache.update(vec![endpoint.clone()], 1000);
        let receiver = Device::new(
            "container:one".into(),
            "Receiver".into(),
            "other",
            "receiver",
        );
        assert!(!cache.update(vec![receiver], 2000));
        let saved = &cache.devices[&endpoint.id];
        assert!(saved.present);
        assert_eq!(saved.connected, None);
        assert_eq!(saved.percent, Some(73));
        assert_eq!(saved.battery_status, "stale");
        assert_eq!(cache.devices.len(), 1);
        let mut marker = Device::new(
            "container:one".into(),
            "Receiver".into(),
            "other",
            "receiver",
        );
        marker.source = "inventory-tg".into();
        cache.update(vec![marker], 3000);
        assert!(cache.devices[&endpoint.id].present);
        assert_eq!(cache.devices[&endpoint.id].connected, Some(false));
        assert_eq!(cache.devices.len(), 1);
        assert!(cache.update(vec![], 4000));
        assert!(!cache.devices[&endpoint.id].present);
    }

    #[test]
    fn slot_identity_and_receiver_markers_survive_scanner_serialization() {
        let mut marker = Device::new(
            "container:one".into(),
            "Receiver".into(),
            "other",
            "receiver",
        );
        marker.source = "inventory-tg".into();
        let first = reading("container:one:tg:1:1147", Some(20), 1000);
        let second = reading("container:one:tg:2:1147", Some(80), 1000);
        let encoded = serde_json::to_vec(&vec![marker, first, second]).unwrap();
        let mut cache = Cache::default();
        cache.update(serde_json::from_slice(&encoded).unwrap(), 1000);
        assert_eq!(cache.devices.len(), 2);
        assert_eq!(cache.devices["container:one:tg:1:1147"].percent, Some(20));
        assert_eq!(cache.devices["container:one:tg:2:1147"].percent, Some(80));
    }
    #[test]
    fn a_loss_requests_one_confirmation_scan_not_continuous_fast_polling() {
        let mut cache = Cache::default();
        assert!(!cache.update(vec![reading("one", Some(50), 1000)], 1000));
        assert!(cache.update(vec![], 2000));
        assert!(!cache.update(vec![], 17000));
        assert!(!cache.update(vec![reading("one", Some(49), 18000)], 18000));
        let mut lost = reading("one", None, 19000);
        lost.connected = Some(false);
        assert!(cache.update(vec![lost.clone()], 19000));
        assert!(!cache.update(vec![lost], 34000));
    }
    fn reading(id: &str, percent: Option<u8>, at: u64) -> Device {
        let mut d = Device::new(id.into(), "Mouse".into(), "mouse", "bluetooth");
        d.connected = Some(true);
        d.percent = percent;
        if percent.is_some() {
            d.last_read_at = Some(at);
            d.battery_status = "available".into();
        }
        d
    }
    #[test]
    fn failed_reading_is_stale_and_never_zero_or_charging() {
        let mut cache = Cache::default();
        let mut first = reading("one", Some(73), 1000);
        first.charging = Some(true);
        cache.update(vec![first], 1000);
        cache.update(vec![reading("one", None, 2000)], 2000);
        let device = &cache.devices["one"];
        assert_eq!(device.percent, Some(73));
        assert_eq!(device.battery_status, "stale");
        assert_eq!(device.last_read_at, Some(1000));
        assert_eq!(device.charging, None);
    }

    #[test]
    fn confirmed_radio_loss_retains_last_level_with_its_original_age_but_no_charging() {
        let mut cache = Cache::default();
        let mut first = reading("one", Some(73), 1000);
        first.charging = Some(true);
        first.charging_read_at = Some(1000);
        cache.update(vec![first], 1000);
        let mut asleep = reading("one", None, 2000);
        asleep.connected = Some(false);
        cache.update(vec![asleep.clone()], 2000);
        let d = &cache.devices["one"];
        assert_eq!(d.percent, Some(73));
        assert_eq!(d.last_read_at, Some(1000));
        assert_eq!(d.battery_status, "stale");
        assert_eq!(d.charging, None);
        assert_eq!(d.charging_read_at, None);
        cache.update(vec![asleep], 2_000_000);
        assert_eq!(cache.devices["one"].percent, None);
    }
    #[test]
    fn independently_fresh_charging_survives_an_unavailable_percentage() {
        let mut cache = Cache::default();
        cache.update(vec![reading("one", Some(73), 1000)], 1000);
        let mut next = reading("one", None, 2000);
        next.charging = Some(true);
        next.charging_read_at = Some(2000);
        cache.update(vec![next], 2000);
        assert_eq!(cache.devices["one"].percent, Some(73));
        assert_eq!(cache.devices["one"].battery_status, "stale");
        assert_eq!(cache.devices["one"].charging, Some(true));
        cache.update(vec![], 3000);
        assert_eq!(cache.devices["one"].charging_read_at, None);
    }
    #[test]
    fn reconnect_does_not_duplicate_identical_named_devices() {
        let mut cache = Cache::default();
        cache.update(
            vec![
                reading("one", Some(30), 1000),
                reading("two", Some(80), 1000),
            ],
            1000,
        );
        cache.update(vec![reading("two", Some(80), 2000)], 2000);
        assert_eq!(cache.devices["one"].connected, Some(false));
        cache.update(
            vec![
                reading("one", Some(42), 3000),
                reading("two", Some(79), 3000),
            ],
            3000,
        );
        assert_eq!(cache.devices.len(), 2);
        assert_eq!(cache.devices["one"].percent, Some(42));
        assert!(cache.missing_since.is_empty());
    }
    #[test]
    fn disappeared_devices_expire_and_true_zero_survives() {
        let mut cache = Cache::default();
        cache.update(vec![reading("one", Some(0), 1000)], 1000);
        assert_eq!(cache.devices["one"].percent, Some(0));
        cache.update(vec![], 2000);
        cache.update(vec![], 2_000_000);
        assert!(cache.devices.is_empty());
        assert!(cache.missing_since.is_empty());
    }
    #[test]
    fn usb_loss_does_not_extend_the_lifetime_of_an_old_battery_reading() {
        let mut cache = Cache::default();
        cache.update(vec![reading("one", Some(0), 1000)], 1000);
        // The last response is almost 30 minutes old when the USB endpoint vanishes.
        cache.update(vec![reading("one", None, 1_799_000)], 1_799_000);
        assert_eq!(cache.devices["one"].percent, Some(0));
        cache.update(vec![], 1_800_000);
        assert_eq!(cache.devices["one"].percent, Some(0));
        cache.update(vec![], 1_801_000);
        let device = &cache.devices["one"];
        assert!(!device.present);
        assert_eq!(device.connected, Some(false));
        assert_eq!(device.percent, None);
        assert_eq!(device.last_read_at, None);
        assert_eq!(device.battery_status, "unavailable");
        // Retention of the disconnected row is independent of battery freshness.
        assert!(cache.missing_since.contains_key("one"));
        cache.update(vec![reading("one", Some(0), 1_802_000)], 1_802_000);
        assert_eq!(cache.devices["one"].percent, Some(0));
        assert_eq!(cache.devices["one"].battery_status, "available");
    }
}
