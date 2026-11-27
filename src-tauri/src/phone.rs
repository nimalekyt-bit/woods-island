//! Explicit, local-only phone sharing. Nothing listens until the owner presses Connect.
//! The QR capability is single-use; each phone needs separate desktop approval.
#[path = "phone/core.rs"]
mod core;
#[path = "phone/shelf.rs"]
mod shelf;
use core::{Authentication, Request, MAX_FILE, MAX_HEADERS, MAX_TEXT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
pub use shelf::shelf_item;
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use windows::{
    core::PCWSTR,
    Win32::{
        NetworkManagement::{IpHelper::*, Ndis::IfOperStatusUp},
        Networking::WinSock::{AF_INET, SOCKADDR_IN},
        Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG},
        Storage::FileSystem::GetDiskFreeSpaceExW,
    },
};

const MAX_CONNECTIONS: usize = 16;
const MAX_OFFERED: usize = 64;
const MAX_SESSION_BYTES: u64 = 1024 * 1024 * 1024;
const DISK_RESERVE: u64 = 512 * 1024 * 1024;
const TRANSFER_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const PERSIST_SECRET_NAME: &str = "phone_session";
static SERVICE: OnceLock<Arc<PhoneService>> = OnceLock::new();
static DRAINING_STOP: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedPhoneSession {
    port: u16,
    device: String,
    capability: String,
    expires_at_ms: u64,
}

fn save_persisted_session(session: &Session) {
    if crate::win::WindowManager::passive_qa() {
        return;
    }
    let Some(active) = session.auth.active.as_ref() else {
        return;
    };
    let Some(port) = session
        .host
        .rsplit_once(':')
        .and_then(|(_, p)| p.parse::<u16>().ok())
    else {
        return;
    };
    let now = Instant::now();
    if now >= active.expires {
        clear_persisted_session();
        return;
    }
    let record = PersistedPhoneSession {
        port,
        device: active.device.clone(),
        capability: active.capability.clone(),
        expires_at_ms: expiry(active.expires, now),
    };
    if let Ok(encoded) = serde_json::to_string(&record) {
        let _ = crate::storage::save_secret(PERSIST_SECRET_NAME, &encoded);
    }
}

fn load_persisted_session() -> Option<PersistedPhoneSession> {
    if crate::win::WindowManager::passive_qa() {
        return None;
    }
    let raw = crate::storage::load_secret(PERSIST_SECRET_NAME)?;
    let parsed: PersistedPhoneSession = serde_json::from_str(&raw).ok()?;
    if parsed.port == 0 || parsed.capability.is_empty() || parsed.expires_at_ms <= now_ms() {
        clear_persisted_session();
        return None;
    }
    Some(parsed)
}

fn clear_persisted_session() {
    if crate::win::WindowManager::passive_qa() {
        return;
    }
    let _ = crate::storage::save_secret(PERSIST_SECRET_NAME, "");
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingPhone {
    pub id: String,
    pub device: String,
    pub expires_at: u64,
}
#[derive(Clone, Debug, Serialize)]
pub struct OfferedFile {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub taken: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneState {
    pub running: bool,
    pub url: Option<String>,
    pub network: Option<String>,
    pub public: Option<bool>,
    pub permission_required: Option<bool>,
    pub connected: bool,
    pub device: Option<String>,
    pub problem: Option<String>,
    pub pending: Option<PendingPhone>,
    pub expires_at: Option<u64>,
    pub offered: Vec<OfferedFile>,
}
struct Offer {
    public: OfferedFile,
    path: PathBuf,
    created: Option<SystemTime>,
    modified: Option<SystemTime>,
    transferred: bool,
}
#[derive(Clone)]
struct LocalNetwork {
    ip: Ipv4Addr,
    prefix: u8,
    name: String,
    interface: u32,
}
impl LocalNetwork {
    fn accepts(&self, peer: SocketAddr) -> bool {
        let std::net::IpAddr::V4(peer) = peer.ip() else {
            return false;
        };
        let mask = u32::MAX.checked_shl(32 - self.prefix as u32).unwrap_or(0);
        u32::from(peer) & mask == u32::from(self.ip) & mask
    }
}
struct Session {
    auth: Authentication,
    network: LocalNetwork,
    host: String,
    public: Option<bool>,
    permission_required: Option<bool>,
    stopped: Arc<AtomicBool>,
    offers: Vec<Offer>,
    received_bytes: u64,
    received_files: usize,
}
struct PhoneService {
    app: AppHandle,
    state: Arc<crate::AppState>,
    session: Mutex<Option<Session>>,
    action: Mutex<()>,
    upload: Mutex<()>,
    connections: AtomicUsize,
    active: Mutex<Vec<(usize, Arc<AtomicBool>, TcpStream)>>,
    next_connection: AtomicUsize,
}

pub fn initialize(app: AppHandle, state: Arc<crate::AppState>) {
    let instance = Arc::new(PhoneService {
        app,
        state,
        session: Mutex::new(None),
        action: Mutex::new(()),
        upload: Mutex::new(()),
        connections: AtomicUsize::new(0),
        active: Mutex::new(Vec::new()),
        next_connection: AtomicUsize::new(0),
    });
    if SERVICE.set(instance.clone()).is_ok() && !crate::win::WindowManager::passive_qa() {
        let _ = std::thread::Builder::new()
            .name("woods-phone-restore".into())
            .spawn(move || {
                if let Some(saved) = load_persisted_session() {
                    if instance.start_with_saved(Some(saved)).is_err() {
                        clear_persisted_session();
                    }
                }
            });
    }
}
pub fn shutdown() {
    if let Some(service) = SERVICE.get() {
        service.stop_internal(false);
    }
}
fn service() -> Result<Arc<PhoneService>, String> {
    SERVICE
        .get()
        .cloned()
        .ok_or_else(|| "Phone sharing is not initialized".into())
}
fn random() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    unsafe {
        BCryptGenRandom(None, &mut bytes, BCRYPT_USE_SYSTEM_PREFERRED_RNG)
            .ok()
            .map_err(|_| "Windows random source is unavailable")?;
    }
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}
fn qa_loopback() -> bool {
    crate::win::WindowManager::passive_qa()
        && std::env::var("WOODS_PHONE_QA_LOOPBACK").as_deref() == Ok("1")
}
fn expiry(at: Instant, now: Instant) -> u64 {
    now_ms().saturating_add(
        at.saturating_duration_since(now)
            .as_millis()
            .min(u64::MAX as u128) as u64,
    )
}
fn local_network() -> Result<LocalNetwork, String> {
    // Loopback is an explicit isolated QA transport and never a production fallback.
    if qa_loopback() {
        return Ok(LocalNetwork {
            ip: Ipv4Addr::LOCALHOST,
            prefix: 8,
            name: "Isolated Woods QA".into(),
            interface: 0,
        });
    }
    unsafe {
        let mut size = 16 * 1024u32;
        for _ in 0..3 {
            if size > 1024 * 1024 {
                return Err("nonet".into());
            }
            let mut buffer = vec![0u64; (size as usize + 7) / 8];
            let ptr = buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
            let code = GetAdaptersAddresses(
                AF_INET.0 as u32,
                GAA_FLAG_SKIP_ANYCAST
                    | GAA_FLAG_SKIP_MULTICAST
                    | GAA_FLAG_SKIP_DNS_SERVER
                    | GAA_FLAG_INCLUDE_GATEWAYS,
                None,
                Some(ptr),
                &mut size,
            );
            if code == 111 {
                continue;
            }
            if code != 0 {
                return Err("nonet".into());
            }
            let mut adapter = ptr;
            let mut candidates = Vec::new();
            let mut count = 0;
            while !adapter.is_null() && count < 256 {
                count += 1;
                let item = &*adapter;
                let name = item.FriendlyName.to_string().unwrap_or_default();
                let description = item
                    .Description
                    .to_string()
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                if item.OperStatus == IfOperStatusUp
                    && [IF_TYPE_ETHERNET_CSMACD, IF_TYPE_IEEE80211].contains(&item.IfType)
                    && !item.FirstGatewayAddress.is_null()
                    && ![
                        "vpn",
                        "virtual",
                        "wintun",
                        "wireguard",
                        "tap-windows",
                        "hyper-v",
                    ]
                    .iter()
                    .any(|part| description.contains(part))
                {
                    let mut address = item.FirstUnicastAddress;
                    let mut addresses = 0;
                    while !address.is_null() && addresses < 64 {
                        addresses += 1;
                        let unicast = &*address;
                        if !unicast.Address.lpSockaddr.is_null()
                            && unicast.Address.iSockaddrLength as usize
                                >= std::mem::size_of::<SOCKADDR_IN>()
                        {
                            let address_v4 = &*unicast.Address.lpSockaddr.cast::<SOCKADDR_IN>();
                            if address_v4.sin_family == AF_INET
                                && (1..=30).contains(&unicast.OnLinkPrefixLength)
                            {
                                let ip =
                                    Ipv4Addr::from(address_v4.sin_addr.S_un.S_addr.to_ne_bytes());
                                if ip.is_private() {
                                    candidates.push((
                                        item.Ipv4Metric,
                                        LocalNetwork {
                                            ip,
                                            prefix: unicast.OnLinkPrefixLength,
                                            name: name.clone(),
                                            interface: item.Anonymous1.Anonymous.IfIndex,
                                        },
                                    ));
                                }
                            }
                        }
                        address = unicast.Next;
                    }
                }
                adapter = item.Next;
            }
            candidates.sort_by_key(|(metric, _)| *metric);
            return candidates
                .into_iter()
                .next()
                .map(|(_, network)| network)
                .ok_or_else(|| "nonet".into());
        }
    }
    Err("nonet".into())
}
fn public_profile(interface: u32) -> Option<bool> {
    if interface == 0 {
        return Some(false);
    }
    let script=format!("Get-NetConnectionProfile -InterfaceIndex {interface} -ErrorAction Stop | Select-Object -First 1 -ExpandProperty NetworkCategory");
    match read_network_policy(&script)?.as_str() {
        "Public" => Some(true),
        "Private" | "DomainAuthenticated" => Some(false),
        _ => None,
    }
}
fn read_network_policy(script: &str) -> Option<String> {
    let mut child = crate::system::command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .stdout(std::process::Stdio::piped())
        .spawn()
        .ok()?;
    let start = Instant::now();
    loop {
        if child.try_wait().ok()?.is_some() {
            let output = child.wait_with_output().ok()?;
            if !output.status.success() {
                return None;
            }
            return Some(String::from_utf8_lossy(&output.stdout).trim().to_owned());
        }
        if start.elapsed() > Duration::from_secs(4) {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        std::thread::sleep(Duration::from_millis(40));
    }
}
fn network_permission_required(public: Option<bool>) -> Option<bool> {
    if crate::win::WindowManager::passive_qa() { return Some(false); }
    if public == Some(true) { return Some(true); }
    let executable = std::env::current_exe().ok()?;
    let quoted = executable.to_string_lossy().replace('\'', "''");
    // Read once per explicit start; no policy changes, elevation or background polling.
    let script = format!("$ErrorActionPreference='Stop'; $p=Get-NetFirewallProfile -Name Private; if(-not $p.Enabled -or $p.DefaultInboundAction -eq 'Allow') {{ 'allowed'; exit }}; try {{ $filters=@(Get-NetFirewallApplicationFilter -PolicyStore ActiveStore -Program '{quoted}') }} catch {{ if($_.CategoryInfo.Category -eq 'ObjectNotFound') {{ 'required'; exit }}; throw }}; $rules=@($filters | Get-NetFirewallRule | Where-Object {{ $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' -and ($_.Profile.ToString() -match 'Private|Any') }}); foreach($r in $rules) {{ $port=$r | Get-NetFirewallPortFilter; $address=$r | Get-NetFirewallAddressFilter; if($port.Protocol -in @('TCP','Any') -and $port.LocalPort -eq 'Any' -and (@($address.RemoteAddress) -contains 'Any' -or @($address.RemoteAddress) -contains 'LocalSubnet')) {{ 'allowed'; exit }} }}; 'required'");
    match read_network_policy(&script)?.as_str() {
        "allowed" => Some(false),
        "required" => Some(true),
        _ => None,
    }
}
impl PhoneService {
    fn state(&self) -> PhoneState {
        let now = Instant::now();
        let mut guard = self.session.lock().unwrap_or_else(|e| e.into_inner());
        let Some(session) = guard.as_mut() else {
            return PhoneState {
                running: false,
                url: None,
                network: None,
                public: None,
                permission_required: None,
                connected: false,
                device: None,
                problem: None,
                pending: None,
                expires_at: None,
                offered: vec![],
            };
        };
        session.auth.expire(now);
        let active = session.auth.active.as_ref();
        PhoneState {
            running: !session.stopped.load(Ordering::Acquire),
            url: (!session.auth.link.is_empty() && session.permission_required != Some(true))
                .then(|| format!("http://{}/phone/#{}", session.host, session.auth.link)),
            network: Some(session.network.name.clone()),
            public: session.public,
            permission_required: session.permission_required,
            connected: active
                .is_some_and(|a| now.saturating_duration_since(a.seen) < Duration::from_secs(8)),
            device: active.map(|a| a.device.clone()),
            problem: None,
            pending: session.auth.pending.as_ref().map(|p| PendingPhone {
                id: p.id.clone(),
                device: p.device.clone(),
                expires_at: expiry(p.expires, now),
            }),
            expires_at: active.map(|a| expiry(a.expires, now)),
            offered: session.offers.iter().map(|o| o.public.clone()).collect(),
        }
    }
    fn emit(&self) {
        let _ = self.app.emit("phone:state", self.state());
    }
    fn start(self: &Arc<Self>) -> Result<PhoneState, String> {
        self.start_with_saved(None)
    }
    fn start_with_saved(
        self: &Arc<Self>,
        saved: Option<PersistedPhoneSession>,
    ) -> Result<PhoneState, String> {
        let _action = self.action.lock().map_err(|_| "Phone action failed")?;
        if let Ok(mut drain) = DRAINING_STOP.lock() {
            if let Some(prev) = drain.take() {
                prev.store(true, Ordering::Release);
            }
        }
        if self
            .session
            .lock()
            .map_err(|_| "Phone state failed")?
            .as_ref()
            .is_some_and(|session| !session.stopped.load(Ordering::Acquire))
        {
            return Ok(self.state());
        }
        let network = local_network()?;
        let bind_port = saved.as_ref().map(|s| s.port).unwrap_or(0);
        let listener = TcpListener::bind((network.ip, bind_port))
            .map_err(|_| "Phone listener could not start")?;
        listener
            .set_nonblocking(true)
            .map_err(|_| "Phone listener could not start")?;
        let host = listener
            .local_addr()
            .map_err(|_| "Phone listener address is unavailable")?
            .to_string();
        let public = public_profile(network.interface);
        let permission_required = network_permission_required(public);
        let stopped = Arc::new(AtomicBool::new(false));
        let now = Instant::now();
        let auth = match saved {
            Some(record) => {
                let remaining_ms = record.expires_at_ms.saturating_sub(now_ms());
                if remaining_ms < 5_000 {
                    clear_persisted_session();
                    return Err("Saved phone session expired".into());
                }
                Authentication::restored(
                    record.device,
                    record.capability,
                    Duration::from_millis(remaining_ms),
                    now,
                )
            }
            None => Authentication::new(random()?, now),
        };
        *self.session.lock().map_err(|_| "Phone state failed")? = Some(Session {
            auth,
            network: network.clone(),
            host,
            public,
            permission_required,
            stopped: stopped.clone(),
            offers: vec![],
            received_bytes: 0,
            received_files: 0,
        });
        let service = self.clone();
        let started = std::thread::Builder::new()
            .name("woods-phone-listener".into())
            .spawn(move || {
                let mut emitted = Instant::now();
                while !stopped.load(Ordering::Acquire) {
                    match listener.accept() {
                        Ok((stream, peer)) if network.accepts(peer) => {
                            let count = service.connections.fetch_add(1, Ordering::AcqRel);
                            if count >= MAX_CONNECTIONS {
                                service.connections.fetch_sub(1, Ordering::AcqRel);
                                let _ = respond(
                                    stream,
                                    503,
                                    "application/json",
                                    br#"{"error":"busy"}"#,
                                );
                                continue;
                            }
                            let worker = service.clone();
                            let run = stopped.clone();
                            let connection =
                                service.next_connection.fetch_add(1, Ordering::Relaxed);
                            let Ok(socket) = stream.try_clone() else {
                                service.connections.fetch_sub(1, Ordering::AcqRel);
                                continue;
                            };
                            {
                                let mut active =
                                    service.active.lock().unwrap_or_else(|e| e.into_inner());
                                if stopped.load(Ordering::Acquire) {
                                    let _ = socket.shutdown(Shutdown::Both);
                                    service.connections.fetch_sub(1, Ordering::AcqRel);
                                    continue;
                                }
                                active.push((connection, stopped.clone(), socket));
                            }
                            if std::thread::Builder::new()
                                .name("woods-phone-request".into())
                                .spawn(move || {
                                    struct Slot(Arc<PhoneService>, usize);
                                    impl Drop for Slot {
                                        fn drop(&mut self) {
                                            self.0.connections.fetch_sub(1, Ordering::AcqRel);
                                            self.0
                                                .active
                                                .lock()
                                                .unwrap_or_else(|e| e.into_inner())
                                                .retain(|(id, _, _)| *id != self.1);
                                        }
                                    }
                                    let _slot = Slot(worker.clone(), connection);
                                    worker.request(stream, run);
                                })
                                .is_err()
                            {
                                service.connections.fetch_sub(1, Ordering::AcqRel);
                                service
                                    .active
                                    .lock()
                                    .unwrap_or_else(|e| e.into_inner())
                                    .retain(|(id, _, _)| *id != connection);
                            }
                        }
                        Ok((stream, _)) => {
                            let _ = respond(
                                stream,
                                403,
                                "application/json",
                                br#"{"error":"local_network_required"}"#,
                            );
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {}
                        Err(_) => {
                            stopped.store(true, Ordering::Release);
                            break;
                        }
                    }
                    if emitted.elapsed() >= Duration::from_secs(2) {
                        service.emit();
                        emitted = Instant::now();
                    }
                    std::thread::sleep(Duration::from_millis(30));
                }
                service.close_connections(Some(&stopped));
                service.emit();
            });
        if started.is_err() {
            if let Some(session) = self
                .session
                .lock()
                .map_err(|_| "Phone state failed")?
                .take()
            {
                session.stopped.store(true, Ordering::Release);
            }
            self.emit();
            return Err("Phone listener worker could not start".into());
        }
        self.emit();
        Ok(self.state())
    }
    fn stop(&self) -> PhoneState {
        self.stop_internal(true)
    }
    fn stop_internal(&self, clear_saved: bool) -> PhoneState {
        let _action = self.action.lock().unwrap_or_else(|e| e.into_inner());
        let mut drained: Option<Arc<AtomicBool>> = None;
        if let Some(session) = self
            .session
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
        {
            if clear_saved {
                clear_persisted_session();
                // Keep the listener alive briefly with session=None so the phone's next poll
                // receives HTTP 410 {"error":"disconnected"} and shows a clear message immediately.
                drained = Some(session.stopped.clone());
            } else {
                save_persisted_session(&session);
                session.stopped.store(true, Ordering::Release);
            }
        } else if clear_saved {
            clear_persisted_session();
        }
        if let Some(flag) = drained {
            if let Ok(mut slot) = DRAINING_STOP.lock() {
                if let Some(prev) = slot.replace(flag.clone()) {
                    prev.store(true, Ordering::Release);
                }
            }
            let _ = std::thread::Builder::new()
                .name("woods-phone-drain".into())
                .spawn(move || {
                    std::thread::sleep(Duration::from_millis(2600));
                    flag.store(true, Ordering::Release);
                });
        } else {
            self.close_connections(None);
        }
        self.emit();
        self.state()
    }
    fn renew(&self) -> Result<PhoneState, String> {
        let mut guard = self.session.lock().map_err(|_| "Phone state failed")?;
        let session = guard.as_mut().ok_or("Phone is not running")?;
        session.auth.renew(random()?, Instant::now());
        session.offers.clear();
        session.received_bytes = 0;
        session.received_files = 0;
        clear_persisted_session();
        drop(guard);
        self.close_connections(None);
        self.emit();
        Ok(self.state())
    }
    fn close_connections(&self, run: Option<&Arc<AtomicBool>>) {
        self.active
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .retain(|(_, generation, socket)| {
                if run.is_none_or(|run| Arc::ptr_eq(run, generation)) {
                    let _ = socket.shutdown(Shutdown::Both);
                    false
                } else {
                    true
                }
            });
    }
    fn allow(&self, id: &str) -> Result<PhoneState, String> {
        let mut guard = self.session.lock().map_err(|_| "Phone state failed")?;
        let session = guard.as_mut().ok_or("Phone is not running")?;
        session
            .auth
            .allow(id, Instant::now())
            .map_err(str::to_owned)?;
        save_persisted_session(session);
        drop(guard);
        self.emit();
        Ok(self.state())
    }
    fn deny(&self, id: &str) -> Result<PhoneState, String> {
        let mut guard = self.session.lock().map_err(|_| "Phone state failed")?;
        let session = guard.as_mut().ok_or("Phone is not running")?;
        session.auth.deny(id).map_err(str::to_owned)?;
        session.auth.renew(random()?, Instant::now());
        drop(guard);
        self.emit();
        Ok(self.state())
    }
    fn send(&self, paths: Vec<String>) -> Result<PhoneState, String> {
        if paths.len() > MAX_OFFERED {
            return Err("At most 64 files can be offered".into());
        }
        let mut additions = Vec::new();
        for path in paths {
            let path = fs::canonicalize(path).map_err(|_| "A selected file is unavailable")?;
            let metadata = fs::metadata(&path).map_err(|_| "A selected file is unavailable")?;
            if !metadata.is_file() || metadata.len() > MAX_FILE {
                return Err("Select regular files up to 256 MiB".into());
            }
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .ok_or("A selected filename is unavailable")?;
            additions.push(Offer {
                public: OfferedFile {
                    id: random()?,
                    name,
                    size: metadata.len(),
                    taken: false,
                },
                path,
                created: metadata.created().ok(),
                modified: metadata.modified().ok(),
                transferred: false,
            });
        }
        let mut guard = self.session.lock().map_err(|_| "Phone state failed")?;
        let session = guard.as_mut().ok_or("Phone is not running")?;
        if session.offers.len() + additions.len() > MAX_OFFERED {
            return Err("At most 64 files can be offered".into());
        }
        for addition in additions {
            if !session.offers.iter().any(|o| o.path == addition.path) {
                session.offers.push(addition);
            }
        }
        drop(guard);
        self.emit();
        Ok(self.state())
    }
    fn unsend(&self, id: &str) -> Result<PhoneState, String> {
        let mut guard = self.session.lock().map_err(|_| "Phone state failed")?;
        let session = guard.as_mut().ok_or("Phone is not running")?;
        session.offers.retain(|o| o.public.id != id);
        drop(guard);
        self.emit();
        Ok(self.state())
    }
    fn authorize(
        &self,
        cap: &str,
        run: &Arc<AtomicBool>,
        epoch: Option<u64>,
        touch: bool,
    ) -> Result<u64, &'static str> {
        if run.load(Ordering::Acquire) {
            return Err("disconnected");
        }
        let mut guard = self.session.lock().map_err(|_| "internal_error")?;
        let session = guard.as_mut().ok_or("disconnected")?;
        if !Arc::ptr_eq(run, &session.stopped)
            || epoch.is_some_and(|e| e != session.auth.epoch)
            || !session.auth.authorized(cap, Instant::now(), touch)
        {
            return Err("not_approved");
        }
        Ok(session.auth.epoch)
    }
    fn request(&self, mut stream: TcpStream, run: Arc<AtomicBool>) {
        // On Windows Winsock2, TcpStream accepted from a non-blocking TcpListener
        // inherits non-blocking mode. Explicitly switch to blocking with timeouts
        // so multi-megabyte Wi-Fi uploads never fail with WSAEWOULDBLOCK mid-stream.
        let _ = stream.set_nonblocking(false);
        let _ = stream.set_nodelay(true);
        let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(30)));
        let mut response_started = false;
        let result = (|| -> Result<(), (&'static str, u16)> {
            let (request, prefix) = read_head(&mut stream).map_err(|e| (e, 400))?;
            if request
                .headers
                .get("expect")
                .is_some_and(|v| v.eq_ignore_ascii_case("100-continue"))
            {
                let _ = stream.write_all(b"HTTP/1.1 100 Continue\r\n\r\n");
                let _ = stream.flush();
            }
            let expected = {
                let guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                guard
                    .as_ref()
                    .filter(|s| Arc::ptr_eq(&run, &s.stopped))
                    .map(|s| s.host.clone())
                    .ok_or(("disconnected", 410))?
            };
            if request.headers.get("host") != Some(&expected) {
                return Err(("invalid_host", 403));
            }
            if request
                .headers
                .get("origin")
                .is_some_and(|origin| origin != &format!("http://{expected}"))
            {
                return Err(("invalid_origin", 403));
            }
            let (route, query) = request
                .target
                .split_once('?')
                .unwrap_or((&request.target, ""));
            if request.method == "GET" {
                match route {
                    "/phone/" => {
                        return write_response(
                            &mut stream,
                            200,
                            "text/html; charset=utf-8",
                            include_bytes!("phone/page.html"),
                        )
                        .map_err(|_| ("connection_closed", 400))
                    }
                    "/phone/app.js" => {
                        return write_response(
                            &mut stream,
                            200,
                            "application/javascript; charset=utf-8",
                            include_bytes!("phone/page.js"),
                        )
                        .map_err(|_| ("connection_closed", 400))
                    }
                    "/phone/style.css" => {
                        return write_response(
                            &mut stream,
                            200,
                            "text/css; charset=utf-8",
                            include_bytes!("phone/page.css"),
                        )
                        .map_err(|_| ("connection_closed", 400))
                    }
                    _ => {}
                }
            }
            let cap = request
                .headers
                .get("authorization")
                .and_then(|h| h.strip_prefix("Bearer "))
                .unwrap_or("");
            if route == "/pair" && request.method == "POST" {
                let body = read_body(&mut stream, &request, prefix, 8192).map_err(|e| (e, 400))?;
                let data: Value =
                    serde_json::from_slice(&body).map_err(|_| ("invalid_json", 400))?;
                let token = data["token"].as_str().ok_or(("invalid_link", 403))?;
                let device = data["device"]
                    .as_str()
                    .unwrap_or("Phone")
                    .chars()
                    .filter(|c| !c.is_control())
                    .take(60)
                    .collect::<String>();
                let ticket = random().map_err(|_| ("internal_error", 500))?;
                let id = random().map_err(|_| ("internal_error", 500))?;
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                let session = guard.as_mut().ok_or(("disconnected", 410))?;
                if !Arc::ptr_eq(&run, &session.stopped) {
                    return Err(("disconnected", 410));
                }
                session
                    .auth
                    .pair(token, ticket.clone(), id, device, Instant::now())
                    .map_err(|e| (e, 403))?;
                drop(guard);
                self.emit();
                return json_response(&mut stream, &json!({"ticket":ticket,"status":"pending"}))
                    .map_err(|_| ("connection_closed", 400));
            }
            if route == "/approval" && request.method == "GET" {
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                let session = guard.as_mut().ok_or(("disconnected", 410))?;
                session.auth.expire(Instant::now());
                let pending = session
                    .auth
                    .pending
                    .as_ref()
                    .is_some_and(|p| core::constant_time_eq(&p.ticket, cap));
                let approved = session.auth.authorized(cap, Instant::now(), false);
                if !pending && !approved {
                    return Err(("pairing_expired", 410));
                }
                return json_response(
                    &mut stream,
                    &json!({"status":if approved{"approved"}else{"pending"}}),
                )
                .map_err(|_| ("connection_closed", 400));
            }
            let epoch = self
                .authorize(cap, &run, None, true)
                .map_err(|e| (e, 403))?;
            if route == "/disconnect" && request.method == "POST" {
                self.renew().map_err(|_| ("internal_error", 500))?;
                return json_response(&mut stream, &json!({"ok":true}))
                    .map_err(|_| ("connection_closed", 400));
            }
            if route == "/state" && request.method == "GET" {
                let state = self.state();
                return json_response(&mut stream,&json!({"device":state.device,"offered":state.offered,"expiresAt":state.expires_at,"maxFileBytes":MAX_FILE})).map_err(|_|("connection_closed",400));
            }
            if route == "/remote/state" && request.method == "GET" {
                let media = crate::media::get_current_media();
                let cover = crate::media::get_current_cover();
                let audio = crate::audio::state().ok();
                let timer_raw = self.state.timer_data.lock().map(|g| g.clone()).unwrap_or_default();
                let timer: Value = serde_json::from_str(&timer_raw).unwrap_or(Value::Null);
                return json_response(
                    &mut stream,
                    &json!({
                        "media": media,
                        "cover": cover,
                        "audio": audio,
                        "timer": timer,
                    }),
                )
                .map_err(|_| ("connection_closed", 400));
            }
            if route == "/remote/action" && request.method == "POST" {
                let body = read_body(&mut stream, &request, prefix, 8192).map_err(|e| (e, 400))?;
                let data: Value = serde_json::from_slice(&body).map_err(|_| ("invalid_json", 400))?;
                let action = data["action"].as_str().unwrap_or("");
                self.authorize(cap, &run, Some(epoch), true)
                    .map_err(|e| (e, 403))?;
                match action {
                    "media_toggle" => {
                        let ok = crate::media::media_control("toggle");
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "media_prev" => {
                        let ok = crate::media::media_control("prev");
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "media_next" => {
                        let ok = crate::media::media_control("next");
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "volume_set" => {
                        let level = data["level"].as_f64().ok_or(("invalid_level", 400))?.clamp(0.0, 1.0);
                        let ok = crate::audio::set_volume(level).is_ok();
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "volume_mute" => {
                        let ok = crate::audio::toggle_mute(false).is_ok();
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "mic_mute" => {
                        let ok = crate::audio::toggle_mute(true).is_ok();
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "lock" => {
                        let ok = crate::run_power_action("lock");
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "sleep" => {
                        let ok = crate::run_power_action("sleep");
                        return json_response(&mut stream, &json!({ "ok": ok }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "open_url" => {
                        let raw = data["url"].as_str().unwrap_or("").trim();
                        let parsed = reqwest::Url::parse(raw).map_err(|_| ("invalid_url", 400))?;
                        if !["http", "https"].contains(&parsed.scheme()) {
                            return Err(("invalid_url", 400));
                        }
                        crate::system::open_path(parsed.as_str(), false, false)
                            .map_err(|_| ("open_failed", 500))?;
                        let _ = self.app.emit(
                            "phone:got",
                            json!({"kind": "link", "text": parsed.as_str(), "added": now_ms()}),
                        );
                        return json_response(&mut stream, &json!({ "ok": true }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "screenshot" => {
                        let img = crate::capture::screenshot(crate::capture::screen_rect())
                            .map_err(|_| ("capture_failed", 500))?;
                        let preview = if img.width() > 1440 {
                            let h = ((img.height() as f64) * (1440.0 / img.width() as f64)).round().max(1.0) as u32;
                            image::imageops::thumbnail(&img, 1440, h)
                        } else {
                            img
                        };
                        let mut out = std::io::Cursor::new(Vec::new());
                        let rgb = image::DynamicImage::ImageRgba8(preview).to_rgb8();
                        image::write_buffer_with_format(
                            &mut out,
                            rgb.as_raw(),
                            rgb.width(),
                            rgb.height(),
                            image::ExtendedColorType::Rgb8,
                            image::ImageFormat::Jpeg,
                        )
                        .map_err(|_| ("encode_failed", 500))?;
                        let b64 = base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            out.into_inner(),
                        );
                        return json_response(
                            &mut stream,
                            &json!({ "ok": true, "image": format!("data:image/jpeg;base64,{b64}") }),
                        )
                        .map_err(|_| ("connection_closed", 400));
                    }
                    "timer_start" => {
                        let mins = data["minutes"].as_f64().unwrap_or(5.0).clamp(0.5, 180.0);
                        let base_ms = (mins * 60_000.0).round() as u64;
                        let label: String = data["label"]
                            .as_str()
                            .unwrap_or("")
                            .chars()
                            .filter(|c| !c.is_control())
                            .take(40)
                            .collect();
                        let now = now_ms();
                        let timer_json = json!({
                            "base": base_ms,
                            "total": base_ms,
                            "endsAt": now.saturating_add(base_ms),
                            "left": null,
                            "doneAt": null,
                            "label": label,
                        });
                        let serialized = timer_json.to_string();
                        let _ = crate::storage::save_string_file("timer.json", &serialized);
                        if let Ok(mut g) = self.state.timer_data.lock() {
                            *g = serialized.clone();
                        }
                        let _ = self.app.emit("timer:remote", serialized);
                        return json_response(&mut stream, &json!({ "ok": true, "timer": timer_json }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    "timer_reset" => {
                        let timer_json = json!({
                            "base": 300_000u64,
                            "total": 300_000u64,
                            "endsAt": null,
                            "left": null,
                            "doneAt": null,
                            "label": "",
                        });
                        let serialized = timer_json.to_string();
                        let _ = crate::storage::save_string_file("timer.json", &serialized);
                        if let Ok(mut g) = self.state.timer_data.lock() {
                            *g = serialized.clone();
                        }
                        let _ = self.app.emit("timer:remote", serialized);
                        return json_response(&mut stream, &json!({ "ok": true, "timer": timer_json }))
                            .map_err(|_| ("connection_closed", 400));
                    }
                    _ => return Err(("unknown_action", 400)),
                }
            }
            if route == "/text" && request.method == "POST" {
                let body =
                    read_body(&mut stream, &request, prefix, MAX_TEXT).map_err(|e| (e, 400))?;
                let text = std::str::from_utf8(&body).map_err(|_| ("invalid_text", 400))?;
                if text.trim().is_empty() || text.contains('\0') {
                    return Err(("invalid_text", 400));
                }
                self.authorize(cap, &run, Some(epoch), true)
                    .map_err(|e| (e, 403))?;
                let _activity =
                    crate::watchdog::protect_activity().map_err(|_| ("app_recovering", 503))?;
                if qa_loopback() {
                    crate::storage::atomic_write(
                        &crate::storage::get_storage_dir().join("phone-qa-text.txt"),
                        text.as_bytes(),
                    )
                    .map_err(|_| ("write_failed", 500))?;
                } else {
                    crate::clipboard::set_text(text).map_err(|_| ("clipboard_failed", 500))?;
                }
                let kind =
                    if text.trim().starts_with("https://") || text.trim().starts_with("http://") {
                        "link"
                    } else {
                        "text"
                    };
                let _ = self.app.emit(
                    "phone:got",
                    json!({"kind":kind,"text":text,"added":now_ms()}),
                );
                return json_response(&mut stream, &json!({"ok":true}))
                    .map_err(|_| ("connection_closed", 400));
            }
            if route == "/file" && request.method == "POST" {
                let _activity =
                    crate::watchdog::protect_activity().map_err(|_| ("app_recovering", 503))?;
                let _upload = self.upload.try_lock().map_err(|_| ("busy", 409))?;
                let encoded = query
                    .strip_prefix("name=")
                    .ok_or(("invalid_filename", 400))?;
                let decoded =
                    urlencoding::decode(encoded).map_err(|_| ("invalid_filename", 400))?;
                let name = core::safe_filename(&decoded).map_err(|e| (e, 400))?;
                let folder = crate::storage::get_storage_dir().join("phone-inbox");
                fs::create_dir_all(&folder).map_err(|_| ("write_failed", 500))?;
                let wide: Vec<u16> = folder
                    .to_string_lossy()
                    .encode_utf16()
                    .chain(Some(0))
                    .collect();
                let mut free = 0;
                unsafe {
                    GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), Some(&mut free), None, None)
                        .map_err(|_| ("disk_unavailable", 500))?;
                }
                if free < request.length.saturating_add(DISK_RESERVE) {
                    return Err(("disk_full", 507));
                }
                {
                    let guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                    let session = guard.as_ref().ok_or(("disconnected", 410))?;
                    if session.received_bytes.saturating_add(request.length) > MAX_SESSION_BYTES
                        || session.received_files >= 200
                    {
                        return Err(("session_limit", 413));
                    }
                }
                let item_id = random().map_err(|_| ("internal_error", 500))?;
                let item_folder = folder.join(&item_id);
                fs::create_dir(&item_folder).map_err(|_| ("write_failed", 500))?;
                let temporary = item_folder.join(format!(".incoming-{item_id}"));
                let target = item_folder.join(&name);
                struct Cleanup(PathBuf, PathBuf, PathBuf, bool);
                impl Drop for Cleanup {
                    fn drop(&mut self) {
                        if !self.3 {
                            let _ = fs::remove_file(&self.1);
                            let _ = fs::remove_file(&self.2);
                            let _ = fs::remove_dir(&self.0);
                        }
                    }
                }
                let mut cleanup = Cleanup(item_folder, temporary.clone(), target.clone(), false);
                let mut file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&temporary)
                    .map_err(|_| ("write_failed", 500))?;
                let start = Instant::now();
                let deadline = start + TRANSFER_TIMEOUT;
                let mut left = request.length;
                if prefix.len() as u64 > left {
                    return Err(("unexpected_body", 400));
                }
                file.write_all(&prefix).map_err(|_| ("write_failed", 500))?;
                left -= prefix.len() as u64;
                let mut received = prefix.len() as u64;
                let mut last_auth = Instant::now();
                let mut last_progress = Instant::now();
                if request.length > 0 {
                    let _ = self.app.emit(
                        "phone:upload",
                        json!({"name": name, "received": received, "total": request.length, "active": true}),
                    );
                }
                let mut chunk = [0u8; 64 * 1024];
                while left > 0 {
                    if Instant::now() >= deadline {
                        let _ = self.app.emit("phone:upload", json!({"active": false}));
                        return Err(("transfer_timeout", 408));
                    }
                    if last_auth.elapsed() >= Duration::from_millis(250) {
                        if let Err(e) = self.authorize(cap, &run, Some(epoch), true) {
                            let _ = self.app.emit("phone:upload", json!({"active": false}));
                            return Err((e, 403));
                        }
                        last_auth = Instant::now();
                    }
                    let amount = (left as usize).min(chunk.len());
                    let read = match read_chunk(&mut stream, &mut chunk[..amount], deadline) {
                        Ok(n) if n > 0 => n,
                        Ok(_) => {
                            let _ = self.app.emit("phone:upload", json!({"active": false}));
                            return Err(("connection_closed", 400));
                        }
                        Err(code) => {
                            let _ = self.app.emit("phone:upload", json!({"active": false}));
                            return Err((code, if code == "transfer_timeout" { 408 } else { 400 }));
                        }
                    };
                    file.write_all(&chunk[..read]).map_err(|_| {
                        let _ = self.app.emit("phone:upload", json!({"active": false}));
                        ("write_failed", 500)
                    })?;
                    left -= read as u64;
                    received += read as u64;
                    if last_progress.elapsed() >= Duration::from_millis(120) || left == 0 {
                        let _ = self.app.emit(
                            "phone:upload",
                            json!({"name": name, "received": received, "total": request.length, "active": true}),
                        );
                        last_progress = Instant::now();
                    }
                }
                let _ = self.app.emit("phone:upload", json!({"active": false}));
                file.sync_all().map_err(|_| ("write_failed", 500))?;
                drop(file);
                // Cancel/renew cannot publish a partly accepted file into the shelf.
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                let session = guard.as_mut().ok_or(("disconnected", 410))?;
                if run.load(Ordering::Acquire)
                    || !Arc::ptr_eq(&run, &session.stopped)
                    || session.auth.epoch != epoch
                    || !session.auth.authorized(cap, Instant::now(), true)
                {
                    return Err(("disconnected", 410));
                }
                fs::rename(&temporary, &target).map_err(|_| ("write_failed", 500))?;
                // Image decoding and shell icon resolution cannot hold the session
                // lock needed by Stop/Renew. Recheck capability before publication.
                drop(guard);
                let mut item = shelf_item(&target);
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                let session = guard.as_mut().ok_or(("disconnected", 410))?;
                if run.load(Ordering::Acquire)
                    || !Arc::ptr_eq(&run, &session.stopped)
                    || session.auth.epoch != epoch
                    || !session.auth.authorized(cap, Instant::now(), true)
                {
                    return Err(("disconnected", 410));
                }
                item["id"] = json!(format!("phone-{item_id}"));
                item["name"] = json!(name);
                item["fromPhone"] = json!(true);
                item["added"] = json!(now_ms());
                let mut shelf = self
                    .state
                    .shelf_items
                    .lock()
                    .map_err(|_| ("internal_error", 500))?;
                let mut updated = shelf.clone();
                updated.push(item.clone());
                if let Err(_) = crate::storage::save_json_file("shelf.json", &json!(updated)) {
                    let _ = fs::remove_file(&target);
                    return Err(("write_failed", 500));
                }
                *shelf = updated.clone();
                session.received_bytes += request.length;
                session.received_files += 1;
                cleanup.3 = true;
                drop(shelf);
                drop(guard);
                let clipboard = !qa_loopback()
                    && crate::clipboard::set_files(&[target.to_string_lossy().into_owned()])
                        .is_ok();
                let _ = self.app.emit("shelf:changed", updated);
                let _=self.app.emit("phone:got",json!({"kind":"file","path":target.to_string_lossy(),"name":name,"size":request.length,"added":item["added"],"clipboard":clipboard}));
                return json_response(&mut stream, &json!({"ok":true,"clipboard":clipboard}))
                    .map_err(|_| ("connection_closed", 400));
            }
            if request.method == "GET" && route.starts_with("/files/") {
                let _activity =
                    crate::watchdog::protect_activity().map_err(|_| ("app_recovering", 503))?;
                let id = &route[7..];
                let (mut file, name, size) = {
                    let guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                    let session = guard.as_ref().ok_or(("disconnected", 410))?;
                    let offer = session
                        .offers
                        .iter()
                        .find(|o| o.public.id == id)
                        .ok_or(("missing_file", 404))?;
                    let file = File::open(&offer.path).map_err(|_| ("missing_file", 404))?;
                    let meta = file.metadata().map_err(|_| ("missing_file", 404))?;
                    if !meta.is_file()
                        || meta.len() != offer.public.size
                        || meta.created().ok() != offer.created
                        || meta.modified().ok() != offer.modified
                    {
                        return Err(("file_changed", 409));
                    }
                    (file, offer.public.name.clone(), offer.public.size)
                };
                let disposition = format!(
                    "attachment; filename=\"download\"; filename*=UTF-8''{}",
                    urlencoding::encode(&name)
                );
                let header=format!("HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Disposition: {disposition}\r\nContent-Length: {size}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n");
                response_started = true;
                stream
                    .write_all(header.as_bytes())
                    .map_err(|_| ("connection_closed", 400))?;
                let mut chunk = [0u8; 64 * 1024];
                let mut left = size;
                let start = Instant::now();
                while left > 0 {
                    if start.elapsed() > TRANSFER_TIMEOUT {
                        return Ok(());
                    }
                    if self.authorize(cap, &run, Some(epoch), true).is_err() {
                        return Ok(());
                    }
                    {
                        let guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                        if !guard
                            .as_ref()
                            .is_some_and(|s| s.offers.iter().any(|o| o.public.id == id))
                        {
                            return Ok(());
                        }
                    }
                    let amount = (left as usize).min(chunk.len());
                    let read = file
                        .read(&mut chunk[..amount])
                        .map_err(|_| ("missing_file", 404))?;
                    if read == 0 {
                        return Ok(());
                    }
                    if stream.write_all(&chunk[..read]).is_err() {
                        return Ok(());
                    }
                    left -= read as u64;
                }
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                if let Some(offer) = guard
                    .as_mut()
                    .filter(|s| s.auth.epoch == epoch)
                    .and_then(|s| s.offers.iter_mut().find(|o| o.public.id == id))
                {
                    offer.transferred = true;
                }
                return Ok(());
            }
            if request.method == "POST" && route.starts_with("/taken/") {
                let mut guard = self.session.lock().map_err(|_| ("internal_error", 500))?;
                let session = guard.as_mut().ok_or(("disconnected", 410))?;
                let offer = session
                    .offers
                    .iter_mut()
                    .find(|o| o.public.id == route[7..] && o.transferred)
                    .ok_or(("missing_file", 404))?;
                let already = offer.public.taken;
                offer.public.taken = true;
                let name = offer.public.name.clone();
                drop(guard);
                if !already {
                    let _ = self.app.emit("phone:taken", name);
                }
                self.emit();
                return json_response(&mut stream, &json!({"ok":true}))
                    .map_err(|_| ("connection_closed", 400));
            }
            Err(("not_found", 404))
        })();
        if !response_started {
            if let Err((code, status)) = result {
                let _ = json_error(&mut stream, status, code);
            }
        }
    }
}
fn read_chunk(
    stream: &mut TcpStream,
    buf: &mut [u8],
    deadline: Instant,
) -> Result<usize, &'static str> {
    loop {
        if Instant::now() >= deadline {
            return Err("transfer_timeout");
        }
        match stream.read(buf) {
            Ok(n) => return Ok(n),
            Err(err) if err.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(err)
                if matches!(
                    err.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) =>
            {
                if Instant::now() >= deadline {
                    return Err("transfer_timeout");
                }
                std::thread::sleep(Duration::from_millis(5));
                continue;
            }
            Err(_) => return Err("connection_closed"),
        }
    }
}
fn read_head(stream: &mut TcpStream) -> Result<(Request, Vec<u8>), &'static str> {
    let mut data = Vec::new();
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut chunk = [0u8; 4096];
    loop {
        let amount = read_chunk(stream, &mut chunk, deadline).map_err(|e| {
            if e == "transfer_timeout" {
                "request_timeout"
            } else {
                e
            }
        })?;
        if amount == 0 {
            return Err("connection_closed");
        }
        data.extend_from_slice(&chunk[..amount]);
        if let Some(end) = data.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
            if end + 4 > MAX_HEADERS {
                return Err("headers_too_large");
            }
            let head = core::parse_request(&data[..end])?;
            return Ok((head, data[end + 4..].to_vec()));
        }
        if data.len() > MAX_HEADERS {
            return Err("headers_too_large");
        }
    }
}
fn read_body(
    stream: &mut TcpStream,
    request: &Request,
    mut prefix: Vec<u8>,
    max: u64,
) -> Result<Vec<u8>, &'static str> {
    if request.length > max || prefix.len() as u64 > request.length {
        return Err("body_too_large");
    }
    let deadline = Instant::now() + Duration::from_secs(20);
    while (prefix.len() as u64) < request.length {
        let remaining = request.length as usize - prefix.len();
        let mut chunk = vec![0u8; remaining.min(8192)];
        let amount = read_chunk(stream, &mut chunk, deadline).map_err(|e| {
            if e == "transfer_timeout" {
                "request_timeout"
            } else {
                e
            }
        })?;
        if amount == 0 {
            return Err("connection_closed");
        }
        prefix.extend_from_slice(&chunk[..amount]);
    }
    Ok(prefix)
}
fn write_response(
    stream: &mut TcpStream,
    status: u16,
    mime: &str,
    body: &[u8],
) -> std::io::Result<()> {
    let header=format!("HTTP/1.1 {status} {}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'\r\nConnection: close\r\n\r\n",if status==200{"OK"}else{"Request failed"},body.len());
    stream.write_all(header.as_bytes())?;
    stream.write_all(body)
}
fn respond(mut stream: TcpStream, status: u16, mime: &str, body: &[u8]) -> std::io::Result<()> {
    let _ = stream.set_nonblocking(false);
    stream.set_write_timeout(Some(Duration::from_secs(2)))?;
    write_response(&mut stream, status, mime, body)
}
fn json_response(stream: &mut TcpStream, body: &Value) -> std::io::Result<()> {
    write_response(stream, 200, "application/json", body.to_string().as_bytes())
}
fn json_error(stream: &mut TcpStream, status: u16, error: &str) -> std::io::Result<()> {
    write_response(
        stream,
        status,
        "application/json",
        json!({"error":error}).to_string().as_bytes(),
    )
}

pub async fn phone_start() -> Result<PhoneState, String> {
    tauri::async_runtime::spawn_blocking(|| service()?.start())
        .await
        .map_err(|_| "Phone worker failed".to_owned())?
}
pub fn phone_state() -> Result<PhoneState, String> {
    Ok(service()?.state())
}
pub fn phone_stop() -> Result<PhoneState, String> {
    Ok(service()?.stop())
}
pub fn phone_renew() -> Result<PhoneState, String> {
    service()?.renew()
}
pub fn phone_allow(id: Option<String>) -> Result<PhoneState, String> {
    service()?.allow(&id.ok_or("Choose the phone awaiting approval")?)
}
pub fn phone_deny(id: String) -> Result<PhoneState, String> {
    service()?.deny(&id)
}
pub async fn phone_send(paths: Vec<String>) -> Result<PhoneState, String> {
    tauri::async_runtime::spawn_blocking(move || service()?.send(paths))
        .await
        .map_err(|_| "Phone worker failed".to_owned())?
}
pub fn phone_unsend(id: String) -> Result<PhoneState, String> {
    service()?.unsend(&id)
}
pub async fn phone_firewall() -> Result<PhoneState, String> {
    tauri::async_runtime::spawn_blocking(||{
        let service=service()?;if crate::win::WindowManager::passive_qa(){return Err("Firewall changes are disabled in passive QA".into());}
        let executable=std::env::current_exe().map_err(|_|"Application path is unavailable")?;let quoted=executable.to_string_lossy().replace('\'',"''");
        let rule_id=format!("Woods-Island-Phone-{:x}",Sha256::digest(executable.to_string_lossy().as_bytes()));
        // Private profile + local subnet + this exact binary. Never change a global firewall setting.
        let script=format!("$program='{quoted}'; $id='{rule_id}'; $rule=Get-NetFirewallRule -Name $id -ErrorAction SilentlyContinue; if($rule) {{ if(($rule | Get-NetFirewallApplicationFilter).Program -ne $program) {{ throw 'Unexpected firewall rule ownership' }}; $rule | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Private -ErrorAction Stop; $rule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet -ErrorAction Stop; $rule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort Any -RemotePort Any -ErrorAction Stop }} else {{ New-NetFirewallRule -Name $id -DisplayName 'Woods Island Phone' -Program $program -Direction Inbound -Action Allow -Profile Private -RemoteAddress LocalSubnet -Protocol TCP -ErrorAction Stop | Out-Null }}");
        crate::system::run_vpn_command(&script,true).map_err(|message|message.replace("VPN command","Phone network permission"))?;
        if let Some(session)=service.session.lock().map_err(|_|"Phone state failed")?.as_mut(){session.permission_required=Some(false);}
        service.emit();Ok(service.state())
    }).await.map_err(|_|"Phone worker failed".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slow_chunked_upload_succeeds_from_nonblocking_listener() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        listener.set_nonblocking(true).unwrap();
        let addr = listener.local_addr().unwrap();
        let payload = vec![0x5Au8; 512 * 1024];
        let total = payload.len();

        let client = std::thread::spawn(move || {
            let mut stream = TcpStream::connect(addr).unwrap();
            let head = format!(
                "POST /file?name=photo.jpg HTTP/1.1\r\nHost: {addr}\r\nContent-Length: {total}\r\n\r\n"
            );
            stream.write_all(head.as_bytes()).unwrap();
            stream.flush().unwrap();
            for chunk in payload.chunks(16 * 1024) {
                std::thread::sleep(Duration::from_millis(4));
                stream.write_all(chunk).unwrap();
                stream.flush().unwrap();
            }
        });

        let mut accepted = loop {
            match listener.accept() {
                Ok((s, _)) => break s,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(5));
                }
                Err(e) => panic!("accept failed: {e}"),
            }
        };
        accepted.set_nonblocking(false).unwrap();
        accepted
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        let (req, prefix) = read_head(&mut accepted).unwrap();
        assert_eq!(req.length as usize, total);
        let mut received = prefix.len();
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut buf = [0u8; 64 * 1024];
        while received < total {
            let want = (total - received).min(buf.len());
            let n = read_chunk(&mut accepted, &mut buf[..want], deadline).unwrap();
            assert!(n > 0);
            assert!(buf[..n].iter().all(|&b| b == 0x5A));
            received += n;
        }
        assert_eq!(received, total);
        client.join().unwrap();
    }
}
