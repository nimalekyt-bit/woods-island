//! Real Windows network inventory and explicit user initiated connections.
use serde_json::{json, Value};
use windows::{core::{GUID, PCWSTR}, Win32::{Foundation::{HANDLE, BOOL}, NetworkManagement::WiFi::*}};
use std::{path::PathBuf, process::Stdio, sync::Mutex, time::{Duration,Instant}};

static VPN_CACHE: Mutex<Option<(Instant,Vec<Value>)>> = Mutex::new(None);
static CUSTOM_VPN: Mutex<Option<CustomVpn>> = Mutex::new(None);
static CUSTOM_VPN_REQUESTED: Mutex<Option<bool>> = Mutex::new(None);
static VPN_ACTION: Mutex<()> = Mutex::new(());

#[derive(Clone, PartialEq)]
struct CustomVpn { name: String, connect: String, disconnect: String, elevated: bool }

fn custom_vpn(settings: &Value) -> Option<CustomVpn> {
    let name = settings["vpnCustomName"].as_str()?.trim().to_owned();
    let connect = settings["vpnCustomOn"].as_str()?.trim().to_owned();
    let disconnect = settings["vpnCustomOff"].as_str()?.trim().to_owned();
    if name.is_empty() || name.len() > 100 || [connect.as_str(),disconnect.as_str()].iter().any(|s|s.is_empty() || s.len() > 16384 || s.contains('\0')) { return None; }
    Some(CustomVpn { name, connect, disconnect, elevated:settings["vpnCustomAdmin"].as_bool().unwrap_or(false) })
}

pub fn configure_vpn(settings: &Value) {
    let next = custom_vpn(settings);
    let mut saved = CUSTOM_VPN.lock().unwrap_or_else(|e|e.into_inner());
    if *saved != next { *saved = next; *CUSTOM_VPN_REQUESTED.lock().unwrap_or_else(|e|e.into_inner()) = None; vpn_refresh(); }
}

struct Wlan(HANDLE);
impl Wlan {
    fn open()->Result<Self,String>{unsafe{let mut version=0;let mut handle=HANDLE::default();let result=WlanOpenHandle(2,None,&mut version,&mut handle);if result==0{Ok(Self(handle))}else{Err(format!("Windows WLAN service is unavailable ({result})"))}}}
    fn interfaces(&self)->Result<Vec<WLAN_INTERFACE_INFO>,String>{unsafe{
        let mut list=std::ptr::null_mut();let result=WlanEnumInterfaces(self.0,None,&mut list);
        if result!=0{return Err(format!("Cannot list Wi-Fi adapters ({result})"));}
        if list.is_null(){return Ok(Vec::new());}
        let count=(*list).dwNumberOfItems as usize;
        let items=std::slice::from_raw_parts((*list).InterfaceInfo.as_ptr(),count).to_vec();
        WlanFreeMemory(list.cast());Ok(items)
    }}
    fn networks(&self,guid:&GUID)->Result<Vec<WLAN_AVAILABLE_NETWORK>,String>{unsafe{
        let mut list=std::ptr::null_mut();let result=WlanGetAvailableNetworkList(self.0,guid,0,None,&mut list);
        if result!=0{return Err(format!("Cannot scan Wi-Fi networks ({result})"));}
        if list.is_null(){return Ok(Vec::new());}
        let items=std::slice::from_raw_parts((*list).Network.as_ptr(),(*list).dwNumberOfItems as usize).to_vec();
        WlanFreeMemory(list.cast());Ok(items)
    }}
}
impl Drop for Wlan{fn drop(&mut self){unsafe{WlanCloseHandle(self.0,None);}}}
fn wide(text:&str)->Vec<u16>{text.encode_utf16().chain(Some(0)).collect()}
fn string(buffer:&[u16])->String{String::from_utf16_lossy(&buffer[..buffer.iter().position(|c|*c==0).unwrap_or(buffer.len())])}
fn ssid(network:&WLAN_AVAILABLE_NETWORK)->String{String::from_utf8_lossy(&network.dot11Ssid.ucSSID[..network.dot11Ssid.uSSIDLength.min(32) as usize]).into_owned()}
fn xml_escape(text:&str)->String{text.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;").replace('\'',"&apos;")}

pub fn wifi_networks()->Result<Vec<Value>,String>{
    let wlan=Wlan::open()?;let mut result=Vec::new();
    for interface in wlan.interfaces()?{
        for network in wlan.networks(&interface.InterfaceGuid)?{
            let name=ssid(&network);if name.is_empty(){continue;}
            if result.iter().any(|n:&Value|n["ssid"]==name){continue;}
            result.push(json!({"ssid":name,"signal":network.wlanSignalQuality,"bars":((network.wlanSignalQuality+24)/25).min(4),"secure":network.bSecurityEnabled.as_bool(),"connected":network.dwFlags&WLAN_AVAILABLE_NETWORK_CONNECTED!=0,"profile":string(&network.strProfileName)}));
        }
    }
    result.sort_by_key(|n|std::cmp::Reverse((n["connected"].as_bool().unwrap_or(false),n["signal"].as_u64().unwrap_or(0))));Ok(result)
}

pub fn wifi_join(name:&str,password:Option<&str>)->Result<Value,String>{
    if name.is_empty()||name.as_bytes().len()>32{return Err("Invalid Wi-Fi SSID".into());}
    let wlan=Wlan::open()?;
    for interface in wlan.interfaces()?{
        let Some(network)=wlan.networks(&interface.InterfaceGuid)?.into_iter().find(|n|ssid(n)==name) else{continue;};
        let mut profile=string(&network.strProfileName);
        if profile.is_empty()||password.is_some(){
            if network.bSecurityEnabled.as_bool()&&password.filter(|p|!p.is_empty()).is_none(){return Ok(json!({"ok":false,"needsPassword":true,"message":"Введите пароль сети Wi-Fi"}));}
            let auth=network.dot11DefaultAuthAlgorithm.0;
            let (authentication,encryption)=if !network.bSecurityEnabled.as_bool(){("open","none")}else if auth==6{("WPA2PSK","AES")}else if auth==4{("WPAPSK","TKIP")}else{return Ok(json!({"ok":false,"needsPassword":false,"message":"Для этой сети требуются расширенные настройки Windows"}));};
            profile=name.to_string();
            let key=if network.bSecurityEnabled.as_bool(){format!("<sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{}</keyMaterial></sharedKey>",xml_escape(password.unwrap_or_default()))}else{String::new()};
            let data=format!("<?xml version=\"1.0\"?><WLANProfile xmlns=\"http://www.microsoft.com/networking/WLAN/profile/v1\"><name>{}</name><SSIDConfig><SSID><hex>{}</hex><name>{}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>manual</connectionMode><MSM><security><authEncryption><authentication>{authentication}</authentication><encryption>{encryption}</encryption><useOneX>false</useOneX></authEncryption>{key}</security></MSM></WLANProfile>",xml_escape(name),name.as_bytes().iter().map(|b|format!("{b:02X}")).collect::<String>(),xml_escape(name));
            let data=wide(&data);let mut reason=0;
            let result=unsafe{WlanSetProfile(wlan.0,&interface.InterfaceGuid,WLAN_PROFILE_USER,PCWSTR(data.as_ptr()),PCWSTR::null(),true,None,&mut reason)};
            if result!=0{return Ok(json!({"ok":false,"needsPassword":network.bSecurityEnabled.as_bool(),"message":format!("Windows rejected Wi-Fi profile ({result}, reason {reason})")}));}
        }
        let profile=wide(&profile);
        let params=WLAN_CONNECTION_PARAMETERS{wlanConnectionMode:wlan_connection_mode_profile,strProfile:PCWSTR(profile.as_ptr()),dot11BssType:dot11_BSS_type_infrastructure,..Default::default()};
        let result=unsafe{WlanConnect(wlan.0,&interface.InterfaceGuid,&params,None)};
        if result!=0{return Ok(json!({"ok":false,"needsPassword":false,"message":format!("Windows could not connect ({result})")}));}
        // WlanConnect merely queues a request. Wait for the real adapter result.
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_millis(250));
            if wlan.networks(&interface.InterfaceGuid)?.iter().any(|n|ssid(n)==name&&n.dwFlags&WLAN_AVAILABLE_NETWORK_CONNECTED!=0){return Ok(json!({"ok":true,"needsPassword":false}));}
        }
        return Ok(json!({"ok":false,"needsPassword":network.bSecurityEnabled.as_bool(),"message":"Сеть не подключилась. Проверьте пароль и доступность точки доступа."}));
    }
    Err("Wi-Fi network is no longer available".into())
}

pub fn wifi_leave()->Result<(),String>{let wlan=Wlan::open()?;for interface in wlan.interfaces()?{let result=unsafe{WlanDisconnect(wlan.0,&interface.InterfaceGuid,None)};if result!=0{return Err(format!("Windows could not disconnect Wi-Fi ({result})"));}}Ok(())}

fn bluetooth_inventory()->Vec<windows::Win32::Devices::Bluetooth::BLUETOOTH_DEVICE_INFO>{
    use windows::Win32::Devices::Bluetooth::*;
    unsafe{
        let params=BLUETOOTH_DEVICE_SEARCH_PARAMS{dwSize:std::mem::size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32,fReturnAuthenticated:BOOL(1),fReturnRemembered:BOOL(1),fReturnConnected:BOOL(1),..Default::default()};
        let mut item=BLUETOOTH_DEVICE_INFO{dwSize:std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32,..Default::default()};
        let Ok(find)=BluetoothFindFirstDevice(&params,&mut item) else{return Vec::new();};
        let mut devices=vec![item];
        while BluetoothFindNextDevice(find,&mut item).is_ok(){devices.push(item);}
        let _=BluetoothFindDeviceClose(find);devices
    }
}
fn bluetooth_services(device:&windows::Win32::Devices::Bluetooth::BLUETOOTH_DEVICE_INFO)->Result<Vec<GUID>,String>{
    use windows::Win32::Devices::Bluetooth::*;
    let mut services=vec![GUID::default();16];
    for _ in 0..3 {
        let mut count=services.len() as u32;
        let result=unsafe{BluetoothEnumerateInstalledServices(HANDLE::default(),device,&mut count,Some(services.as_mut_ptr()))};
        if result==234 && count<=256 {services.resize(count as usize,GUID::default());continue;}
        if result!=0{return Err(format!("Windows could not enumerate Bluetooth services ({result})"));}
        services.truncate((count as usize).min(services.len()));return Ok(services);
    }
    Err("Bluetooth services changed during enumeration; try again".into())
}
fn bluetooth_kind(class:u32)->&'static str{
    match (class>>8)&31 {1=>"computer",2=>"phone",4=>"audio",5 if class&0x80!=0=>"mouse",5 if class&0x40!=0=>"keyboard",5 if class&0x0c==0x08=>"gamepad",_=>"other"}
}
pub fn bt_devices()->Vec<Value>{bluetooth_inventory().iter().map(|device|{
    let switchable=device.fAuthenticated.as_bool()&&bluetooth_services(device).is_ok_and(|services|!services.is_empty());
    json!({"id":format!("{:012x}",unsafe{device.Address.Anonymous.ullLong}),"name":string(&device.szName),"connected":device.fConnected.as_bool(),"paired":device.fAuthenticated.as_bool(),"kind":bluetooth_kind(device.ulClassofDevice),"battery":null,"batteryStatus":"unavailable","switchable":switchable,"switchStatus":if switchable{"available"}else{"windowsSettings"}})
}).collect()}
pub fn bt_switch(id:&str,on:bool)->Result<(),String>{
    use windows::Win32::Devices::Bluetooth::*;
    let device=bluetooth_inventory().into_iter().find(|d|format!("{:012x}",unsafe{d.Address.Anonymous.ullLong})==id).ok_or("Bluetooth device was not found")?;
    unsafe{
        let services=bluetooth_services(&device)?;
        if services.is_empty(){return Err("Подключите устройство в настройках Bluetooth Windows, чтобы зарегистрировать его службы.".into());}
        let mut any=false;
        for service in services{if BluetoothSetServiceState(HANDLE::default(),&device,&service,if on{BLUETOOTH_SERVICE_ENABLE}else{BLUETOOTH_SERVICE_DISABLE})==0{any=true;}}
        if !any{return Err("Windows denied Bluetooth service switching".into());}
        let began=Instant::now();
        loop {
            if bluetooth_inventory().iter().any(|current|format!("{:012x}",current.Address.Anonymous.ullLong)==id&&current.fConnected.as_bool()==on){return Ok(());}
            if began.elapsed()>=Duration::from_secs(8){return Err("Службы Bluetooth переключены, но Windows не подтвердила состояние подключения. Проверьте устройство в параметрах Bluetooth.".into());}
            std::thread::sleep(Duration::from_millis(250));
        }
    }
}

fn physical_ethernet(row: &windows::Win32::NetworkManagement::IpHelper::MIB_IF_ROW2) -> bool {
    // HardwareInterface is the first flag. VPN/TAP/Hyper-V adapters can also
    // report Ethernet type, but must never stand in for the physical cable.
    row.Type == windows::Win32::NetworkManagement::IpHelper::IF_TYPE_ETHERNET_CSMACD
        && row.InterfaceAndOperStatusFlags._bitfield & 1 != 0
}

pub fn ethernet_adapter() -> Option<Value> {
    use windows::Win32::NetworkManagement::{IpHelper::*, Ndis::IfOperStatusUp};
    unsafe {
        let mut table = std::ptr::null_mut();
        if GetIfTable2(&mut table).is_err() || table.is_null() { return None; }
        let rows = std::slice::from_raw_parts((*table).Table.as_ptr(), (*table).NumEntries as usize);
        let adapter = rows.iter().filter(|row| physical_ethernet(row))
            .max_by_key(|row| (row.OperStatus == IfOperStatusUp, row.TransmitLinkSpeed, std::cmp::Reverse(row.InterfaceIndex)))
            .map(|row| json!({"index":row.InterfaceIndex,"name":string(&row.Alias),"description":string(&row.Description),"connected":row.OperStatus==IfOperStatusUp,"speed":row.TransmitLinkSpeed}));
        FreeMibTable(table.cast());
        adapter
    }
}

fn ras_profiles() -> Vec<Value> {
    use windows::Win32::NetworkManagement::Rras::*;
    unsafe {
        let mut connections = vec![RASCONNW::default()];
        let mut connected_names = Vec::new();
        for _ in 0..3 {
            connections[0].dwSize = std::mem::size_of::<RASCONNW>() as u32;
            let mut bytes = (connections.len() * std::mem::size_of::<RASCONNW>()) as u32;
            let mut count = 0;
            let status = RasEnumConnectionsW(Some(connections.as_mut_ptr()), &mut bytes, &mut count);
            if status == 603 { connections.resize((bytes as usize).div_ceil(std::mem::size_of::<RASCONNW>()).max(1), RASCONNW::default()); continue; }
            if status == 0 {
                for item in connections.iter().take(count as usize) {
                    let mut info = RASCONNSTATUSW::default();
                    info.dwSize = std::mem::size_of::<RASCONNSTATUSW>() as u32;
                    let status = RasGetConnectStatusW(item.hrasconn, &mut info);
                    let connected = info.rasconnstate;
                    if status == 0 && connected == RASCS_Connected { let name = item.szEntryName; connected_names.push(string(&name)); }
                }
            }
            break;
        }
        let mut entries = vec![RASENTRYNAMEW::default()];
        for _ in 0..3 {
            entries[0].dwSize = std::mem::size_of::<RASENTRYNAMEW>() as u32;
            let mut bytes = (entries.len() * std::mem::size_of::<RASENTRYNAMEW>()) as u32;
            let mut count = 0;
            let status = RasEnumEntriesW(PCWSTR::null(), PCWSTR::null(), Some(entries.as_mut_ptr()), &mut bytes, &mut count);
            if status == 603 { entries.resize((bytes as usize).div_ceil(std::mem::size_of::<RASENTRYNAMEW>()).max(1), RASENTRYNAMEW::default()); continue; }
            if status != 0 { return Vec::new(); }
            return entries.iter().take(count as usize).filter_map(|item| {
                let name = string(&item.szEntryName);
                if name.is_empty() { return None; }
                let name_wide = wide(&name);
                let phonebook = if item.szPhonebookPath[0] == 0 { PCWSTR::null() } else { PCWSTR(item.szPhonebookPath.as_ptr()) };
                let mut entry = vec![RASENTRYW::default()];
                let mut vpn = false;
                for _ in 0..3 {
                    entry[0].dwSize = std::mem::size_of::<RASENTRYW>() as u32;
                    let mut size = (entry.len() * std::mem::size_of::<RASENTRYW>()) as u32;
                    let status = RasGetEntryPropertiesW(phonebook, PCWSTR(name_wide.as_ptr()), Some(entry.as_mut_ptr()), &mut size, None, None);
                    if status == 603 { entry.resize((size as usize).div_ceil(std::mem::size_of::<RASENTRYW>()).max(1), RASENTRYW::default()); continue; }
                    vpn = status == 0 && entry[0].dwType == RASET_Vpn;
                    break;
                }
                if !vpn { return None; }
                Some(json!({"id":format!("ras:{name}"),"name":name,"on":connected_names.contains(&name),"ready":true}))
            }).collect();
        }
        Vec::new()
    }
}
fn warp_path()->Option<PathBuf>{
    let program=std::env::var_os("ProgramFiles").map(PathBuf::from).map(|p|p.join("Cloudflare/Cloudflare WARP/warp-cli.exe"));
    program.filter(|p|p.is_file()).or_else(||std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).map(|p|p.join("warp-cli.exe")).find(|p|p.is_file()))
}

fn tunnel_service(name: &str) -> Option<(&'static str, &str)> {
    let (prefix, profile) = name.split_once('$')?;
    let brand = if prefix.eq_ignore_ascii_case("AmneziaWGTunnel") { "AmneziaWG" } else if prefix.eq_ignore_ascii_case("WireGuardTunnel") { "WireGuard" } else { return None; };
    if profile.is_empty() || profile.len() > 200 || profile.contains(['\0','/','\\']) { return None; }
    Some((brand,profile))
}

fn tunnel_names() -> Vec<String> {
    use windows::{core::{w, PWSTR}, Win32::System::Registry::*};
    unsafe {
        let mut key = HKEY::default();
        if RegOpenKeyExW(HKEY_LOCAL_MACHINE,w!("SYSTEM\\CurrentControlSet\\Services"),0,KEY_READ,&mut key).is_err() { return Vec::new(); }
        let mut names = Vec::new();
        for index in 0..8192 {
            let mut buffer = [0u16;512];
            let mut len = buffer.len() as u32;
            let result = RegEnumKeyExW(key,index,PWSTR(buffer.as_mut_ptr()),&mut len,None,PWSTR::null(),None,None);
            if result.0 == 259 { break; }
            if result.is_ok() { let name=String::from_utf16_lossy(&buffer[..len as usize]); if tunnel_service(&name).is_some() { names.push(name); } }
        }
        let _ = RegCloseKey(key);
        names
    }
}

struct ServiceHandle(windows::Win32::System::Services::SC_HANDLE);
impl Drop for ServiceHandle { fn drop(&mut self) { unsafe { let _ = windows::Win32::System::Services::CloseServiceHandle(self.0); } } }
fn service_handle(name: &str, access: u32) -> Result<ServiceHandle,String> {
    use windows::Win32::System::Services::*;
    let manager = ServiceHandle(unsafe { OpenSCManagerW(PCWSTR::null(),PCWSTR::null(),SC_MANAGER_CONNECT) }.map_err(|e|e.to_string())?);
    let name = wide(name);
    unsafe { OpenServiceW(manager.0,PCWSTR(name.as_ptr()),access) }.map(ServiceHandle).map_err(|e|format!("Windows denied VPN service access; run Woods Island as administrator: {e}"))
}
fn service_state(service: &ServiceHandle) -> Result<windows::Win32::System::Services::SERVICE_STATUS_CURRENT_STATE,String> {
    use windows::Win32::System::Services::*;
    let mut status = SERVICE_STATUS::default();
    unsafe { QueryServiceStatus(service.0,&mut status) }.map_err(|e|e.to_string())?;
    Ok(status.dwCurrentState)
}
fn tunnel_profiles() -> Vec<Value> {
    use windows::Win32::System::Services::*;
    tunnel_names().into_iter().filter_map(|name| {
        let (brand,profile) = tunnel_service(&name)?;
        let service = service_handle(&name,SERVICE_QUERY_STATUS).ok()?;
        let status = service_state(&service).ok()?;
        Some(json!({"id":format!("service:{name}"),"name":format!("{brand} · {profile}"),"on":status==SERVICE_RUNNING,"ready":true,"via":brand,"onSource":"service","busy":status==SERVICE_START_PENDING || status==SERVICE_STOP_PENDING}))
    }).collect()
}

fn installed_vpn_clients() -> Vec<Value> {
    let definitions = [
        ("amneziawg","AmneziaWG","AmneziaWG/amneziawg.exe"),
        ("hiddify","Hiddify","Hiddify/Hiddify.exe"),
        ("proton","Proton VPN","Proton/VPN/ProtonVPN.Launcher.exe"),
        ("radmin","Radmin VPN","Radmin VPN/RvRvpnGui.exe"),
        ("v2raytun","v2RayTun","v2RayTun/v2RayTun.exe"),
        ("wireguard","WireGuard","WireGuard/wireguard.exe"),
    ];
    definitions.iter().filter_map(|(id,name,relative)| {
        let path = ["ProgramFiles","ProgramFiles(x86)","LOCALAPPDATA"].iter().filter_map(std::env::var_os).map(PathBuf::from).map(|base|base.join(relative)).find(|path|path.is_file())?;
        Some(json!({"id":format!("app:{id}"),"name":name,"on":false,"ready":false,"launchPath":path.to_string_lossy(),"reason":if ["amneziawg","wireguard"].contains(id){"Откройте клиент и установите туннель как службу для управления из Woods Island"}else{"Откройте клиент или настройте команды VPN в Woods Island"}}))
    }).collect()
}

fn warp_connected(output: &str) -> bool {
    output.lines().any(|line| { let value = line.trim().trim_start_matches("Status update:").trim(); value == "Connected" || value.starts_with("Connected to ") })
}
fn warp_status(path: &std::path::Path) -> Option<bool> {
    use std::io::Read;
    let mut child = crate::system::command(path.to_string_lossy().as_ref()).arg("status").stdout(Stdio::piped()).spawn().ok()?;
    let at = Instant::now();
    loop {
        if let Some(status) = child.try_wait().ok()? {
            if !status.success() { return None; }
            let mut output = String::new();
            child.stdout.take()?.take(65536).read_to_string(&mut output).ok()?;
            return Some(warp_connected(&output));
        }
        if at.elapsed() >= Duration::from_secs(2) { let _=child.kill(); let _=child.wait(); return None; }
        std::thread::sleep(Duration::from_millis(25));
    }
}
pub fn vpn_profiles()->Vec<Value>{
    if let Some((at,profiles))=VPN_CACHE.lock().unwrap().as_ref(){if at.elapsed()<Duration::from_secs(15){return profiles.clone();}}
    let mut profiles=ras_profiles();
    profiles.extend(tunnel_profiles());
    profiles.extend(installed_vpn_clients());
    if let Some(path)=warp_path(){let on=warp_status(&path);profiles.push(json!({"id":"app:warp","name":"Cloudflare WARP","on":on.unwrap_or(false),"ready":on.is_some(),"onSource":"client","launchPath":path.parent().map(|p|p.join("Cloudflare WARP.exe")).map(|p|p.to_string_lossy().into_owned())}));}
    if let Some(custom)=CUSTOM_VPN.lock().unwrap_or_else(|e|e.into_inner()).as_ref(){profiles.push(custom_vpn_profile(custom,*CUSTOM_VPN_REQUESTED.lock().unwrap_or_else(|e|e.into_inner())));}
    *VPN_CACHE.lock().unwrap()=Some((Instant::now(),profiles.clone()));profiles
}
pub fn vpn_refresh(){*VPN_CACHE.lock().unwrap()=None;}

fn custom_vpn_profile(custom:&CustomVpn,requested:Option<bool>)->Value{
    json!({"id":"app:custom","name":custom.name,"on":null,"ready":true,"status":"unknown","onSource":"command","lastRequestedOn":requested})
}
/// A successful script is evidence of command execution, never of a tunnel.
pub fn vpn_summary(profiles:&[Value])->Value{
    let active=profiles.iter().find(|profile|profile["on"]==true);
    let unknown=profiles.iter().any(|profile|profile["on"].is_null());
    json!({"active":if active.is_some(){Some(true)}else if unknown{None}else{Some(false)},"status":if active.is_some(){"connected"}else if unknown{"unknown"}else{"disconnected"},"via":active.and_then(|profile|profile["name"].as_str()),"ip":null,"country":null,"countryCode":null})
}

pub fn start_controls_monitor(app: tauri::AppHandle, state: std::sync::Arc<crate::AppState>) {
    use tauri::Emitter;
    std::thread::spawn(move || loop {
        let mut current = crate::system::controls();
        current["vpns"] = json!(vpn_profiles());
        let changed = {
            let mut saved = state.controls.lock().unwrap();
            let changed = *saved != current;
            *saved = current.clone();
            changed
        };
        if changed { let _ = app.emit("controls:changed", &current); }
        std::thread::sleep(Duration::from_secs(3));
    });
}
pub fn vpn_toggle(id:&str,on:bool)->Result<(),String>{
    let _action = VPN_ACTION.try_lock().map_err(|_|"A VPN action is already running")?;
    if id == "app:custom" {
        let custom = CUSTOM_VPN.lock().unwrap_or_else(|e|e.into_inner()).clone().ok_or("Configure both custom VPN commands first")?;
        crate::system::run_vpn_command(if on{&custom.connect}else{&custom.disconnect},custom.elevated)?;
        *CUSTOM_VPN_REQUESTED.lock().unwrap_or_else(|e|e.into_inner()) = Some(on);
        vpn_refresh();
        return Ok(());
    }
    if let Some(name) = id.strip_prefix("service:") {
        use windows::Win32::System::Services::*;
        if tunnel_service(name).is_none() { return Err("Unsupported VPN service".into()); }
        let service = service_handle(name,SERVICE_QUERY_STATUS | if on{SERVICE_START}else{SERVICE_STOP})?;
        let target = if on{SERVICE_RUNNING}else{SERVICE_STOPPED};
        if service_state(&service)? != target {
            unsafe { if on{StartServiceW(service.0,None)}else{ControlService(service.0,SERVICE_CONTROL_STOP,&mut SERVICE_STATUS::default())} }.map_err(|e|e.to_string())?;
            let at = Instant::now();
            while service_state(&service)? != target {
                if at.elapsed() >= Duration::from_secs(15) { vpn_refresh(); return Err("VPN tunnel did not reach the requested state within 15 seconds".into()); }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
        vpn_refresh();
        return Ok(());
    }
    let status=if id=="app:warp"{let path=warp_path().ok_or("Cloudflare WARP is not installed")?;crate::system::command(path.to_string_lossy().as_ref()).arg(if on{"connect"}else{"disconnect"}).status().map_err(|e|e.to_string())?}
    else if let Some(name)=id.strip_prefix("ras:"){let mut command=crate::system::command("rasdial.exe");command.arg(name);if !on{command.arg("/disconnect");}command.status().map_err(|e|e.to_string())?}
    else{return Err("VPN profile is unavailable".into());};
    vpn_refresh();
    if status.success(){Ok(())}else{Err("VPN connection failed. Check saved credentials in Windows VPN settings.".into())}
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn custom_commands_require_both_actions_and_reject_nulls(){
        let valid=json!({"vpnCustomName":"Local VPN","vpnCustomOn":"& 'C:\\VPN Client\\vpn.exe' connect","vpnCustomOff":"& 'C:\\VPN Client\\vpn.exe' disconnect","vpnCustomAdmin":true});
        let parsed=custom_vpn(&valid).unwrap();assert_eq!(parsed.name,"Local VPN");assert!(parsed.elevated);
        for field in ["vpnCustomName","vpnCustomOn","vpnCustomOff"]{let mut invalid=valid.clone();invalid[field]=json!("");assert!(custom_vpn(&invalid).is_none());}
        let mut invalid=valid.clone();invalid["vpnCustomOn"]=json!("connect\0hidden");assert!(custom_vpn(&invalid).is_none());
        invalid["vpnCustomOn"]=json!("x".repeat(16385));assert!(custom_vpn(&invalid).is_none());
    }
    #[test]fn warp_status_does_not_treat_disconnected_or_error_as_connected(){
        assert!(warp_connected("Status update: Connected\n"));assert!(warp_connected("Connected to Example\r\n"));
        for text in ["Disconnected","Not Connected","Error: Connected service missing","Status update: Disconnected","Connecting"]{assert!(!warp_connected(text),"{text}");}
    }
    #[test]fn tunnel_services_are_restricted_to_registered_vpn_prefixes(){
        assert_eq!(tunnel_service("AmneziaWGTunnel$home"),Some(("AmneziaWG","home")));
        assert_eq!(tunnel_service("WireGuardTunnel$Office"),Some(("WireGuard","Office")));
        for name in ["ProtonVPN Service","Spooler","AmneziaWGTunnel$","WireGuardTunnel$../other","WireGuardTunnel$other\\path"]{assert!(tunnel_service(name).is_none());}
    }
    #[test]fn wifi_xml_encodes_literal_characters(){assert_eq!(xml_escape("a&<\"'"),"a&amp;&lt;&quot;&apos;");}
    #[test]fn custom_command_success_never_claims_a_connected_tunnel(){
        let custom=CustomVpn{name:"VPN".into(),connect:"connect".into(),disconnect:"disconnect".into(),elevated:false};
        for requested in [None,Some(true),Some(false)]{let profile=custom_vpn_profile(&custom,requested);assert!(profile["on"].is_null());assert_eq!(profile["lastRequestedOn"],json!(requested));assert_eq!(vpn_summary(&[profile])["status"],"unknown");}
        assert_eq!(vpn_summary(&[json!({"on":null}),json!({"on":true,"name":"Verified"})])["active"],true);
        assert_eq!(vpn_summary(&[json!({"on":false})])["active"],false);
    }
    #[test]fn bluetooth_class_maps_only_reported_capabilities(){assert_eq!(bluetooth_kind(0x0400),"audio");assert_eq!(bluetooth_kind(0x0540),"keyboard");assert_eq!(bluetooth_kind(0x0580),"mouse");assert_eq!(bluetooth_kind(0),"other");}
    #[test]fn utf16_stops_at_null(){assert_eq!(string(&[65,66,0,67]),"AB");}
    #[test]fn virtual_ethernet_and_wifi_cannot_replace_the_physical_adapter(){
        use windows::Win32::NetworkManagement::IpHelper::*;
        let mut row = MIB_IF_ROW2::default();
        row.Type = IF_TYPE_ETHERNET_CSMACD;
        assert!(!physical_ethernet(&row));
        row.InterfaceAndOperStatusFlags._bitfield = 1;
        assert!(physical_ethernet(&row));
        row.Type = IF_TYPE_IEEE80211;
        assert!(!physical_ethernet(&row));
    }
}
