//! Read-only Windows privacy, battery, keyboard and Downloads telemetry.
use serde_json::{json,Value};
use std::{collections::{HashMap,HashSet},path::{Path,PathBuf},sync::Arc,time::{Instant,SystemTime}};
use tauri::Emitter;
use windows::{core::{PCWSTR,PWSTR},Win32::{
    Foundation::{CloseHandle,ERROR_SUCCESS},
    Globalization::{GetLocaleInfoW,LOCALE_SISO639LANGNAME},
    System::{Registry::*,Power::{GetSystemPowerStatus,SYSTEM_POWER_STATUS},Diagnostics::ToolHelp::*},
    UI::{Input::KeyboardAndMouse::{GetKeyboardLayout,GetKeyState,VK_CAPITAL},Shell::{SHGetKnownFolderPath,FOLDERID_Downloads,KF_FLAG_DEFAULT},WindowsAndMessaging::{GetForegroundWindow,GetWindowThreadProcessId}},
}};

pub fn caps()->bool{unsafe{GetKeyState(VK_CAPITAL.0 as i32)&1!=0}}
pub fn layout()->String{
    unsafe{
        let foreground=GetForegroundWindow();let thread=GetWindowThreadProcessId(foreground,None);
        let id=GetKeyboardLayout(thread).0 as usize as u32&0xffff;
        let mut value=[0u16;32];let count=GetLocaleInfoW(id,LOCALE_SISO639LANGNAME,Some(&mut value));
        if count>1{String::from_utf16_lossy(&value[..count as usize-1]).to_uppercase()}else{String::new()}
    }
}
fn power_payload(status:SYSTEM_POWER_STATUS)->Option<Value>{
    if status.BatteryFlag&128!=0 || status.BatteryLifePercent>100{return None;}
    Some(json!({"percent":status.BatteryLifePercent,"plugged":status.ACLineStatus==1,"charging":status.BatteryFlag&8!=0,"saver":status.SystemStatusFlag==1,"remainingSeconds":if status.BatteryLifeTime==u32::MAX{None}else{Some(status.BatteryLifeTime)}}))
}
pub fn battery()->Option<Value>{let mut status=SYSTEM_POWER_STATUS::default();unsafe{GetSystemPowerStatus(&mut status).ok()?;}power_payload(status)}

struct Key(HKEY);
impl Drop for Key{fn drop(&mut self){unsafe{let _=RegCloseKey(self.0);}}}
fn open_key(parent:HKEY,name:&str)->Option<Key>{
    let name:Vec<u16>=name.encode_utf16().chain(Some(0)).collect();let mut key=HKEY::default();
    let status=unsafe{RegOpenKeyExW(parent,PCWSTR(name.as_ptr()),0,KEY_READ,&mut key)};
    if status==ERROR_SUCCESS{Some(Key(key))}else{None}
}
fn children(key:HKEY)->Vec<String>{
    let mut result=Vec::new();
    for index in 0..10000 {
        let mut name=[0u16;512];let mut len=name.len() as u32;
        let status=unsafe{RegEnumKeyExW(key,index,PWSTR(name.as_mut_ptr()),&mut len,None,PWSTR::null(),None,None)};
        if status!=ERROR_SUCCESS{break;}
        result.push(String::from_utf16_lossy(&name[..len as usize]));
    }
    result
}
fn timestamp(key:HKEY,name:&str)->Option<u64>{
    let name:Vec<u16>=name.encode_utf16().chain(Some(0)).collect();let mut number=0u64;let mut size=8;
    let status=unsafe{RegGetValueW(key,None,PCWSTR(name.as_ptr()),RRF_RT_REG_QWORD,None,Some((&mut number as *mut u64).cast()),Some(&mut size))};
    if status==ERROR_SUCCESS&&size==8{Some(number)}else{None}
}
fn running_processes()->HashSet<String>{
    unsafe{
        let Ok(snapshot)=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0)else{return HashSet::new();};
        let mut item=PROCESSENTRY32W::default();item.dwSize=std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut result=HashSet::new();
        if Process32FirstW(snapshot,&mut item).is_ok(){loop{
            let count=item.szExeFile.iter().position(|c|*c==0).unwrap_or(item.szExeFile.len());
            result.insert(String::from_utf16_lossy(&item.szExeFile[..count]).to_lowercase());
            if Process32NextW(snapshot,&mut item).is_err(){break;}
        }}
        let _=CloseHandle(snapshot);result
    }
}
fn display_app(raw:&str)->String{
    let normalized=raw.replace('#',"\\");let name=Path::new(&normalized).file_name().map(|n|n.to_string_lossy().into_owned()).unwrap_or_else(||normalized.clone());
    let lower=name.to_lowercase();
    for (token,label) in [("ayugram","AyuGram"),("telegram","Telegram"),("discord","Discord"),("chrome","Chrome"),("msedge","Edge"),("opera","Opera"),("firefox","Firefox"),("yandex","Яндекс"),("obs","OBS Studio"),("camera","Камера Windows"),("woods-island","Woods Island"),("zoom","Zoom"),("teams","Teams")]{if lower.contains(token){return label.into();}}
    name.trim_end_matches(".exe").to_owned()
}
fn capability(kind:&str,processes:&HashSet<String>)->Vec<String>{
    let Some(key)=open_key(HKEY_CURRENT_USER,&format!("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{kind}"))else{return vec![];};
    let mut result=HashSet::new();
    for name in children(key.0){
        if name=="NonPackaged"{
            let Some(nonpackaged)=open_key(key.0,&name)else{continue;};
            for app_name in children(nonpackaged.0){
                let Some(app)=open_key(nonpackaged.0,&app_name)else{continue;};
                let path=app_name.replace('#',"\\");let executable=Path::new(&path).file_name().map(|s|s.to_string_lossy().to_lowercase()).unwrap_or_default();
                if timestamp(app.0,"LastUsedTimeStart").unwrap_or(0)>0&&timestamp(app.0,"LastUsedTimeStop")==Some(0)&&processes.contains(&executable){result.insert(display_app(&app_name));}
            }
        }else if let Some(app)=open_key(key.0,&name){
            if timestamp(app.0,"LastUsedTimeStart").unwrap_or(0)>0&&timestamp(app.0,"LastUsedTimeStop")==Some(0){result.insert(display_app(&name));}
        }
    }
    let mut result:Vec<String>=result.into_iter().collect();result.sort();result
}
pub fn privacy()->Value{let processes=running_processes();json!({"mic":capability("microphone",&processes),"cam":capability("webcam",&processes)})}
pub fn snapshot()->Value{json!({"privacy":privacy(),"battery":battery(),"layout":layout(),"capsLock":caps()})}

pub fn virtual_desktop()->Option<Value>{
    let key=open_key(HKEY_CURRENT_USER,"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops")?;
    let binary=|name:&str|->Option<Vec<u8>>{let name:Vec<u16>=name.encode_utf16().chain(Some(0)).collect();let mut data=vec![0u8;4096];let mut size=data.len() as u32;let status=unsafe{RegGetValueW(key.0,None,PCWSTR(name.as_ptr()),RRF_RT_REG_BINARY,None,Some(data.as_mut_ptr().cast()),Some(&mut size))};if status!=ERROR_SUCCESS{return None;}data.truncate(size as usize);Some(data)};
    let ids=binary("VirtualDesktopIDs")?;let current=binary("CurrentVirtualDesktop")?;
    if current.len()!=16||ids.len()%16!=0{return None;}
    let index=ids.chunks_exact(16).position(|id|id==current)?;
    let guid=windows::core::GUID::from_values(u32::from_le_bytes(current[0..4].try_into().ok()?),u16::from_le_bytes(current[4..6].try_into().ok()?),u16::from_le_bytes(current[6..8].try_into().ok()?),current[8..16].try_into().ok()?);
    let name=open_key(key.0,&format!("{{{guid:?}}}")).and_then(|desktop|{
        let mut data=[0u16;512];let mut bytes=(data.len()*2) as u32;
        let status=unsafe{RegGetValueW(desktop.0,None,windows::core::w!("Name"),RRF_RT_REG_SZ,None,Some(data.as_mut_ptr().cast()),Some(&mut bytes))};
        if status==ERROR_SUCCESS{let count=data.iter().position(|c|*c==0).unwrap_or(data.len());Some(String::from_utf16_lossy(&data[..count]))}else{None}
    }).unwrap_or_default();
    Some(json!({"index":index+1,"count":ids.len()/16,"name":name}))
}

fn downloads_folder(settings:&Value)->Option<PathBuf>{
    if let Some(path)=settings["downloadsDir"].as_str().filter(|s|!s.trim().is_empty()){return Some(PathBuf::from(path));}
    unsafe{
        let path=SHGetKnownFolderPath(&FOLDERID_Downloads,KF_FLAG_DEFAULT,None).ok()?;
        let value=path.to_string().ok().map(PathBuf::from);windows::Win32::System::Com::CoTaskMemFree(Some(path.0.cast()));value
    }
}
fn glob(pattern:&str,name:&str)->bool{
    let pattern:Vec<char>=pattern.to_lowercase().chars().collect();let name:Vec<char>=name.to_lowercase().chars().collect();
    let(mut p,mut n)=(0,0);let mut star=None;let mut retry=0;
    while n<name.len(){
        if p<pattern.len()&&(pattern[p]=='?'||pattern[p]==name[n]){p+=1;n+=1;}
        else if p<pattern.len()&&pattern[p]=='*'{star=Some(p);p+=1;retry=n;}
        else if let Some(at)=star{p=at+1;retry+=1;n=retry;}
        else{return false;}
    }
    while p<pattern.len()&&pattern[p]=='*'{p+=1;}p==pattern.len()
}
fn ignored(name:&str,settings:&Value)->bool{
    name.to_lowercase().ends_with(".tmp")||settings["downloadsIgnore"].as_array().map(|rules|rules.iter().filter_map(Value::as_str).any(|rule|glob(rule,name))).unwrap_or(false)
}
fn partial_name(name:&str)->Option<String>{
    let lower=name.to_lowercase();for suffix in [".crdownload",".part",".partial",".download"]{if lower.ends_with(suffix){return Some(name[..name.len()-suffix.len()].to_owned());}}None
}
#[derive(Clone)]
struct FileState{size:u64,modified:Option<SystemTime>,stable:u8,done:bool}
struct Downloads{folder:Option<PathBuf>,rules:Value,files:HashMap<PathBuf,FileState>,last:Instant}
impl Downloads{
    fn new()->Self{Self{folder:None,rules:Value::Null,files:HashMap::new(),last:Instant::now()}}
    fn poll(&mut self,settings:&Value)->(Vec<Value>,Vec<Value>){
        let folder=downloads_folder(settings);let first=folder!=self.folder||self.rules!=settings["downloadsIgnore"];
        if first{self.files.clear();self.folder=folder.clone();self.rules=settings["downloadsIgnore"].clone();}
        let elapsed=self.last.elapsed().as_secs_f64().max(0.001);self.last=Instant::now();
        let Some(folder)=folder else{return(vec![],vec![]);};let Ok(entries)=std::fs::read_dir(&folder)else{return(vec![],vec![]);};
        let mut observed=HashMap::new();let mut active=Vec::new();let mut completed=Vec::new();
        for entry in entries.flatten().take(20000){
            let path=entry.path();let Ok(kind)=entry.file_type()else{continue;};if !kind.is_file()||kind.is_symlink(){continue;}
            let name=entry.file_name().to_string_lossy().into_owned();if ignored(&name,settings){continue;}
            let Ok(metadata)=entry.metadata()else{continue;};let size=metadata.len();let modified=metadata.modified().ok();let partial=partial_name(&name);
            let previous=self.files.get(&path);
            let changed=previous.map(|p|p.size!=size||p.modified!=modified).unwrap_or(true);
            let stable=if changed{0}else{previous.map(|p|p.stable.saturating_add(1)).unwrap_or(0)};
            let mut done=previous.map(|p|p.done).unwrap_or(first&&partial.is_none());
            if let Some(real_name)=partial {
                let speed=previous.map(|p|size.saturating_sub(p.size) as f64/elapsed).unwrap_or(0.);
                active.push(json!({"id":path.to_string_lossy(),"path":path.to_string_lossy(),"name":real_name,"size":size,"total":null,"speed":speed,"icon":null}));
            }else if !done&&stable>=2 {
                done=true;completed.push(json!({"id":path.to_string_lossy(),"path":path.to_string_lossy(),"name":name,"size":size,"title":null,"icon":null}));
            }
            observed.insert(path,FileState{size,modified,stable,done});
        }
        self.files=observed;active.sort_by(|a,b|a["name"].as_str().cmp(&b["name"].as_str()));(active,completed)
    }
}

pub fn start(app:tauri::AppHandle,state:Arc<crate::AppState>){
    let downloads_app=app.clone();let downloads_state=state.clone();
    std::thread::spawn(move||{
        let mut tracker=Downloads::new();let mut steam=crate::steam::Downloads::default();
        loop{
            let settings=downloads_state.settings.lock().unwrap().clone();let (mut active,mut completed)=tracker.poll(&settings);
            let (steam_active,steam_done)=steam.poll(settings["steamDownloads"].as_bool().unwrap_or(true));active.extend(steam_active);completed.extend(steam_done);let active=Value::Array(active);
            // Repeat the measured snapshot so a webview that subscribes after
            // setup also sees paused/in-progress downloads without a size change.
            let _=downloads_app.emit("downloads:update",&active);
            for file in completed{let _=downloads_app.emit("downloads:done",file);}
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    });
    std::thread::spawn(move||{
        let mut previous=snapshot();let mut slow=Instant::now();let mut desktop=Value::Null;
        loop{
            let code=layout();if previous["layout"].as_str()!=Some(&code){let _=app.emit("input:lang",&code);let _=app.emit("input:layout",&code);previous["layout"]=json!(code);}
            let on=caps();if previous["capsLock"].as_bool()!=Some(on){let _=app.emit("input:caps",on);previous["capsLock"]=json!(on);}
            if slow.elapsed()>=std::time::Duration::from_secs(2){
                let current=json!(virtual_desktop());if current!=desktop{let _=app.emit("desktop:virtual",&current);desktop=current;}
                let power=json!(battery());if power!=previous["battery"]{let _=app.emit("power:update",&power);previous["battery"]=power;}
                let active=privacy();if active!=previous["privacy"]{let _=app.emit("privacy:update",&active);previous["privacy"]=active;}slow=Instant::now();
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn unknown_or_absent_battery_is_not_fabricated(){assert!(power_payload(SYSTEM_POWER_STATUS{BatteryFlag:128,BatteryLifePercent:255,..Default::default()}).is_none());let status=power_payload(SYSTEM_POWER_STATUS{BatteryFlag:8,BatteryLifePercent:68,ACLineStatus:1,SystemStatusFlag:0,..Default::default()}).unwrap();assert_eq!(status["percent"],68);assert_eq!(status["plugged"],true);}
    #[test]fn download_name_masks_are_case_insensitive_and_unicode_safe(){assert!(glob("setup-*.exe","SETUP-1.EXE"));assert!(glob("*.txt","заметка.txt"));assert!(!glob("a?c","ac"));assert_eq!(partial_name("Архив.zip.crdownload"),Some("Архив.zip".into()));}
    #[test]fn existing_downloads_do_not_generate_old_notifications(){let folder=std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("woods-download-test-{}",crate::media::now_ms()));std::fs::create_dir_all(&folder).unwrap();std::fs::write(folder.join("old.txt"),b"old").unwrap();let settings=json!({"downloadsDir":folder.to_string_lossy()});let mut d=Downloads::new();assert!(d.poll(&settings).1.is_empty());std::fs::write(folder.join("new.txt"),b"new").unwrap();assert!(d.poll(&settings).1.is_empty());assert!(d.poll(&settings).1.is_empty());assert_eq!(d.poll(&settings).1.len(),1);assert!(d.poll(&settings).1.is_empty());for name in ["old.txt","new.txt"]{let _=std::fs::remove_file(folder.join(name));}let _=std::fs::remove_dir(folder);}
}
