//! Real Windows network inventory and explicit user initiated connections.
use serde_json::{json, Value};
use windows::{core::{GUID, PCWSTR}, Win32::{Foundation::{HANDLE, BOOL}, NetworkManagement::WiFi::*}};
use std::{path::PathBuf, process::Stdio, sync::Mutex, time::{Duration,Instant}};

static VPN_CACHE: Mutex<Option<(Instant,Vec<Value>)>> = Mutex::new(None);

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
pub fn bt_devices()->Vec<Value>{bluetooth_inventory().iter().map(|device|json!({"id":format!("{:012x}",unsafe{device.Address.Anonymous.ullLong}),"name":string(&device.szName),"connected":device.fConnected.as_bool(),"paired":device.fAuthenticated.as_bool(),"kind":"other","battery":null})).collect()}
pub fn bt_switch(id:&str,on:bool)->Result<(),String>{
    use windows::Win32::Devices::Bluetooth::*;
    let device=bluetooth_inventory().into_iter().find(|d|format!("{:012x}",unsafe{d.Address.Anonymous.ullLong})==id).ok_or("Bluetooth device was not found")?;
    unsafe{
        let mut count=64;let mut services=vec![GUID::default();64];
        let result=BluetoothEnumerateInstalledServices(HANDLE::default(),&device,&mut count,Some(services.as_mut_ptr()));
        if result!=0{return Err(format!("Windows could not enumerate Bluetooth services ({result})"));}
        services.truncate(count.min(64) as usize);
        if services.is_empty(){return Err("Подключите устройство в настройках Bluetooth Windows, чтобы зарегистрировать его службы.".into());}
        let mut any=false;
        for service in services{if BluetoothSetServiceState(HANDLE::default(),&device,&service,if on{BLUETOOTH_SERVICE_ENABLE}else{BLUETOOTH_SERVICE_DISABLE})==0{any=true;}}
        if any{Ok(())}else{Err("Windows denied Bluetooth service switching".into())}
    }
}

fn powershell_json(script:&str)->Result<Value,String>{
    let output=crate::system::command("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",script]).stdout(Stdio::piped()).output().map_err(|e|e.to_string())?;
    if !output.status.success(){return Err("Windows could not query network profiles".into());}
    serde_json::from_slice(&output.stdout).map_err(|e|e.to_string())
}
fn warp_path()->Option<PathBuf>{
    let program=std::env::var_os("ProgramFiles").map(PathBuf::from).map(|p|p.join("Cloudflare/Cloudflare WARP/warp-cli.exe"));
    program.filter(|p|p.is_file()).or_else(||std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).map(|p|p.join("warp-cli.exe")).find(|p|p.is_file()))
}
pub fn vpn_profiles()->Vec<Value>{
    if let Some((at,profiles))=VPN_CACHE.lock().unwrap().as_ref(){if at.elapsed()<Duration::from_secs(15){return profiles.clone();}}
    let mut profiles=Vec::new();
    if let Ok(value)=powershell_json("$ErrorActionPreference='Stop'; @(Get-VpnConnection | Select-Object Name,ConnectionStatus) | ConvertTo-Json -Compress"){for item in value.as_array().into_iter().flatten(){if let Some(name)=item["Name"].as_str(){profiles.push(json!({"id":format!("ras:{name}"),"name":name,"on":item["ConnectionStatus"].as_str()==Some("Connected"),"ready":true}));}}}
    if let Some(path)=warp_path(){let output=crate::system::command(path.to_string_lossy().as_ref()).arg("status").stdout(Stdio::piped()).output().ok();let on=output.filter(|o|o.status.success()).map(|o|String::from_utf8_lossy(&o.stdout).contains("Connected")).unwrap_or(false);profiles.push(json!({"id":"app:warp","name":"Cloudflare WARP","on":on,"ready":true}));}
    *VPN_CACHE.lock().unwrap()=Some((Instant::now(),profiles.clone()));profiles
}
pub fn vpn_refresh(){*VPN_CACHE.lock().unwrap()=None;}
pub fn vpn_toggle(id:&str,on:bool)->Result<(),String>{
    let status=if id=="app:warp"{let path=warp_path().ok_or("Cloudflare WARP is not installed")?;crate::system::command(path.to_string_lossy().as_ref()).arg(if on{"connect"}else{"disconnect"}).status().map_err(|e|e.to_string())?}
    else if let Some(name)=id.strip_prefix("ras:"){let mut command=crate::system::command("rasdial.exe");command.arg(name);if !on{command.arg("/disconnect");}command.status().map_err(|e|e.to_string())?}
    else{return Err("VPN profile is unavailable".into());};
    vpn_refresh();
    if status.success(){Ok(())}else{Err("VPN connection failed. Check saved credentials in Windows VPN settings.".into())}
}

#[cfg(test)]mod tests{use super::*;#[test]fn wifi_xml_encodes_literal_characters(){assert_eq!(xml_escape("a&<\"'"),"a&amp;&lt;&quot;&apos;");}#[test]fn utf16_stops_at_null(){assert_eq!(string(&[65,66,0,67]),"AB");}}
