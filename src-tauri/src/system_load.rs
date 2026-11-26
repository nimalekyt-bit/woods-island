use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Condvar, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use windows::{
    core::{w, PCWSTR, PWSTR},
    Win32::{
        Foundation::FILETIME,
        NetworkManagement::{IpHelper::*, Ndis::IfOperStatusUp},
        System::{
            Performance::*,
            SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX},
            Threading::GetSystemTimes,
        },
    },
};

static PANEL_UNTIL: AtomicU64 = AtomicU64::new(0);
static RUNNING: AtomicBool = AtomicBool::new(false);
static SAMPLES: AtomicU64 = AtomicU64::new(0);
static GPU_EXPANSIONS: AtomicU64 = AtomicU64::new(0);
static CACHE: Mutex<Option<Value>> = Mutex::new(None);
static WAKE: OnceLock<(Mutex<bool>, Condvar)> = OnceLock::new();
pub fn configure() {
    let (lock, wake) = WAKE.get_or_init(|| (Mutex::new(false), Condvar::new()));
    *lock.lock().unwrap() = true;
    wake.notify_one();
}
pub fn request() -> Value {
    PANEL_UNTIL.store(crate::media::now_ms() + 3000, Ordering::Relaxed);
    configure();
    CACHE
        .lock()
        .unwrap()
        .as_ref()
        .filter(|data| {
            crate::media::now_ms().saturating_sub(data["observedAt"].as_u64().unwrap_or(0)) < 5000
        })
        .cloned()
        .unwrap_or(Value::Null)
}
pub fn status() -> Value {
    json!({"collecting":RUNNING.load(Ordering::Relaxed),"samples":SAMPLES.load(Ordering::Relaxed),"gpuExpansions":GPU_EXPANSIONS.load(Ordering::Relaxed)})
}
fn time(value: FILETIME) -> u64 {
    ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
}
fn cpu(previous: Option<(u64, u64, u64)>, current: (u64, u64, u64)) -> Option<f64> {
    let (idle, kernel, user) = current;
    let (old_idle, old_kernel, old_user) = previous?;
    let total = kernel
        .checked_sub(old_kernel)?
        .checked_add(user.checked_sub(old_user)?)?;
    let idle = idle.checked_sub(old_idle)?;
    (total > 0).then(|| 100. * total.saturating_sub(idle) as f64 / total as f64)
}
fn engine(path: &str) -> Option<String> {
    path.split("_luid_").nth(1).map(str::to_owned)
}
fn gpu_wildcard(query: isize) -> Option<Vec<u16>> {
    let mut probe = 0;
    if unsafe {
        PdhAddEnglishCounterW(
            query,
            w!("\\GPU Engine(*)\\Utilization Percentage"),
            0,
            &mut probe,
        )
    } != 0
    {
        return None;
    }
    let result = (|| {
        let mut bytes = 0;
        if unsafe { PdhGetCounterInfoW(probe, false, &mut bytes, None) } != PDH_MORE_DATA
            || bytes == 0
            || bytes > 65536
        {
            return None;
        }
        // PDH returns a structure with pointers; allocate with pointer alignment.
        let mut storage = vec![0usize; (bytes as usize).div_ceil(std::mem::size_of::<usize>())];
        let info = storage.as_mut_ptr().cast::<PDH_COUNTER_INFO_W>();
        if unsafe { PdhGetCounterInfoW(probe, false, &mut bytes, Some(info)) } != 0 {
            return None;
        }
        let path = unsafe { (*info).szFullPath.to_string().ok()? };
        Some(path.encode_utf16().chain(Some(0)).collect())
    })();
    unsafe {
        let _ = PdhRemoveCounter(probe);
    }
    result
}
struct Gpu {
    query: isize,
    counters: BTreeMap<String, isize>,
    expanded: Instant,
    wildcard: Option<Vec<u16>>,
}
impl Drop for Gpu {
    fn drop(&mut self) {
        unsafe {
            let _ = PdhCloseQuery(self.query);
        }
    }
}
impl Gpu {
    fn new() -> Option<Self> {
        let mut query = 0;
        if unsafe { PdhOpenQueryW(None, 0, &mut query) } != 0 {
            return None;
        }
        Some(Self {
            query,
            counters: BTreeMap::new(),
            expanded: Instant::now() - Duration::from_secs(60),
            wildcard: gpu_wildcard(query),
        })
    }
    fn refresh(&mut self) {
        if self.expanded.elapsed() < Duration::from_secs(10) {
            return;
        }
        self.expanded = Instant::now();
        GPU_EXPANSIONS.fetch_add(1, Ordering::Relaxed);
        if self.wildcard.is_none() {
            self.wildcard = gpu_wildcard(self.query);
        }
        let Some(path) = self.wildcard.as_ref() else {
            return;
        };
        let wildcard = PCWSTR(path.as_ptr());
        let mut length = 0;
        let status =
            unsafe { PdhExpandWildCardPathW(None, wildcard, PWSTR::null(), &mut length, 0) };
        if status != PDH_MORE_DATA || length == 0 || length > 2_000_000 {
            return;
        }
        let mut buffer = vec![0u16; length as usize];
        if unsafe {
            PdhExpandWildCardPathW(None, wildcard, PWSTR(buffer.as_mut_ptr()), &mut length, 0)
        } != 0
        {
            return;
        }
        let paths = buffer
            .split(|c| *c == 0)
            .filter(|part| !part.is_empty())
            .map(String::from_utf16_lossy)
            .collect::<Vec<_>>();
        // Oversized driver inventories cannot be silently sampled as a partial GPU.
        if paths.len() > 2048 {
            for handle in self.counters.values() {
                unsafe {
                    let _ = PdhRemoveCounter(*handle);
                }
            }
            self.counters.clear();
            return;
        }
        self.counters.retain(|path, handle| {
            if paths.contains(path) {
                true
            } else {
                unsafe {
                    let _ = PdhRemoveCounter(*handle);
                }
                false
            }
        });
        for path in paths {
            if !self.counters.contains_key(&path) {
                let wide = path.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
                let mut handle = 0;
                if unsafe { PdhAddCounterW(self.query, PCWSTR(wide.as_ptr()), 0, &mut handle) } == 0
                {
                    self.counters.insert(path, handle);
                }
            }
        }
    }
    fn sample(&mut self) -> Option<f64> {
        self.refresh();
        if self.counters.is_empty() || unsafe { PdhCollectQueryData(self.query) } != 0 {
            return None;
        }
        let mut engines = BTreeMap::<String, f64>::new();
        for (path, handle) in &self.counters {
            let mut value = PDH_FMT_COUNTERVALUE::default();
            if unsafe { PdhGetFormattedCounterValue(*handle, PDH_FMT_DOUBLE, None, &mut value) }
                == 0
                && (value.CStatus == 0 || value.CStatus == 1)
            {
                let reading = unsafe { value.Anonymous.doubleValue };
                if reading.is_finite() && reading >= 0. {
                    if let Some(key) = engine(path) {
                        *engines.entry(key).or_default() += reading;
                    }
                }
            }
        }
        engines
            .into_values()
            .map(|value| value.clamp(0., 100.))
            .reduce(f64::max)
    }
}
struct Sampler {
    cpu: Option<(u64, u64, u64)>,
    network: BTreeMap<u64, (u64, u64)>,
    at: Instant,
    gpu: Option<Gpu>,
}
impl Sampler {
    fn new() -> Self {
        Self {
            cpu: None,
            network: BTreeMap::new(),
            at: Instant::now(),
            gpu: None,
        }
    }
    fn sample(&mut self, gpu: bool, network: bool) -> Value {
        let now = Instant::now();
        let seconds = now.duration_since(self.at).as_secs_f64();
        let (mut idle, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        let cpu = if unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }
            .is_ok()
        {
            let current = (time(idle), time(kernel), time(user));
            let value = cpu(self.cpu, current);
            self.cpu = Some(current);
            value
        } else {
            None
        };
        let mut memory = MEMORYSTATUSEX::default();
        memory.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        let memory_ok = unsafe { GlobalMemoryStatusEx(&mut memory) }.is_ok();
        let used = memory.ullTotalPhys.saturating_sub(memory.ullAvailPhys);
        let (mut down, mut up) = (None, None);
        if network {
            let mut table = std::ptr::null_mut();
            if unsafe { GetIfTable2(&mut table) }.0 == 0 && !table.is_null() {
                let rows = unsafe {
                    std::slice::from_raw_parts(
                        (*table).Table.as_ptr(),
                        (*table).NumEntries.min(4096) as usize,
                    )
                };
                let mut fresh = BTreeMap::new();
                let (mut incoming, mut outgoing, mut known) = (0u64, 0u64, false);
                for row in rows {
                    // Hardware interfaces only: don't double-count a VPN/virtual adapter
                    // and the physical NIC carrying that same traffic.
                    if row.OperStatus != IfOperStatusUp
                        || row.InterfaceAndOperStatusFlags._bitfield & 1 == 0
                    {
                        continue;
                    }
                    let id = unsafe { row.InterfaceLuid.Value };
                    if let Some((old_down, old_up)) = self.network.get(&id) {
                        if let (Some(d), Some(u)) = (
                            row.InOctets.checked_sub(*old_down),
                            row.OutOctets.checked_sub(*old_up),
                        ) {
                            incoming = incoming.saturating_add(d);
                            outgoing = outgoing.saturating_add(u);
                            known = true;
                        }
                    }
                    fresh.insert(id, (row.InOctets, row.OutOctets));
                }
                unsafe {
                    FreeMibTable(table.cast());
                }
                self.network = fresh;
                if known && seconds > 0. {
                    down = Some(incoming as f64 / seconds);
                    up = Some(outgoing as f64 / seconds);
                }
            }
        } else {
            self.network.clear();
        }
        let gpu = if gpu {
            if self.gpu.is_none() {
                self.gpu = Gpu::new();
            }
            self.gpu.as_mut().and_then(Gpu::sample)
        } else {
            self.gpu = None;
            None
        };
        self.at = now;
        json!({"cpu":cpu,"memory":if memory_ok&&memory.ullTotalPhys>0{Some(100.*used as f64/memory.ullTotalPhys as f64)}else{None},"memoryUsed":if memory_ok{Some(used)}else{None},"memoryTotal":if memory_ok{Some(memory.ullTotalPhys)}else{None},"gpu":gpu,"down":down,"up":up,"observedAt":crate::media::now_ms()})
    }
}
pub fn start(app: AppHandle, state: Arc<crate::AppState>) {
    let _ = std::thread::Builder::new()
        .name("woods-system-load".into())
        .spawn(move || {
            let mut sampler = None;
            let mut next_sample=Instant::now();
            loop {
                let settings = state.settings.lock().unwrap().clone();
                let panel = PANEL_UNTIL.load(Ordering::Relaxed) > crate::media::now_ms();
                let parts = settings["loadInPill"]
                    .as_array()
                    .into_iter().flatten().filter_map(Value::as_str)
                    .filter(|part|["cpu","ram","gpu","net"].contains(part)).collect::<Vec<_>>();
                let active = !crate::is_low_power() && (panel || !parts.is_empty());
                RUNNING.store(active, Ordering::Relaxed);
                if active && (sampler.is_none()||Instant::now()>=next_sample) {
                    let collector = sampler.get_or_insert_with(Sampler::new);
                    let value = collector.sample(
                        panel || parts.contains(&"gpu"),
                        panel || parts.contains(&"net"),
                    );
                    SAMPLES.fetch_add(1, Ordering::Relaxed);
                    *CACHE.lock().unwrap() = Some(value.clone());
                    let _ = app.emit("system:load", &value);
                    next_sample=Instant::now()+Duration::from_secs(1);
                } else if !active {
                    sampler = None;
                    *CACHE.lock().unwrap() = None;
                }
                let (lock, wake) = WAKE.get_or_init(|| (Mutex::new(false), Condvar::new()));
                let dirty = lock.lock().unwrap();
                let (mut dirty, _) = wake
                    .wait_timeout_while(
                        dirty,
                        if active {
                            next_sample.saturating_duration_since(Instant::now())
                        } else {
                            Duration::from_secs(5)
                        },
                        |dirty| !*dirty,
                    )
                    .unwrap();
                *dirty = false;
            }
        });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cpu_time_handles_initial_sample_resets_idle_and_full_load() {
        assert_eq!(cpu(None, (1, 2, 3)), None);
        assert_eq!(cpu(Some((0, 0, 0)), (50, 100, 0)), Some(50.));
        assert_eq!(cpu(Some((100, 100, 100)), (99, 99, 99)), None);
        assert_eq!(cpu(Some((0, 0, 0)), (0, 100, 100)), Some(100.));
    }
    #[test]
    fn gpu_aggregation_groups_processes_on_the_same_physical_engine() {
        assert_eq!(
            engine("pid_1_luid_0x1_phys_0_eng_0_engtype_3D"),
            engine("pid_2_luid_0x1_phys_0_eng_0_engtype_3D")
        );
        assert_ne!(
            engine("pid_1_luid_0x1_phys_0_eng_0_engtype_3D"),
            engine("pid_1_luid_0x2_phys_0_eng_0_engtype_3D")
        );
    }
}
