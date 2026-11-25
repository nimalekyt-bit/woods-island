//! Read-only Windows privacy, battery, keyboard and Downloads telemetry.
use serde_json::{json,Value};
use std::{collections::{HashMap,HashSet},path::{Path,PathBuf},sync::{Arc,Mutex},time::{Duration,Instant,SystemTime}};
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
pub(crate) fn running_processes()->HashSet<String>{
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
pub fn snapshot()->Value{json!({"privacy":privacy(),"battery":battery(),"layout":layout(),"capsLock":caps(),"vdesk":virtual_desktop()})}

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
    let lower=name.to_lowercase();for suffix in PARTIAL_SUFFIXES{if lower.ends_with(suffix){return Some(name[..name.len()-suffix.len()].to_owned());}}None
}
const PARTIAL_SUFFIXES: [&str;7] = [".crdownload",".part",".partial",".download",".!qb",".!ut",".!bt"];
#[derive(Clone,Debug)]
struct FileState{size:u64,modified:Option<SystemTime>,created:Option<SystemTime>,stable:u8,done:bool,moved_at:Option<Instant>,owner:crate::file_owners::FileOwner}
struct Downloads{folder:Option<PathBuf>,rules:Value,files:HashMap<PathBuf,FileState>,last:Instant,owners:crate::file_owners::Queue,cached_clients:(Instant,bool)}
impl Downloads{
    fn new()->Self{Self{folder:None,rules:Value::Null,files:HashMap::new(),last:Instant::now(),owners:crate::file_owners::Queue::new(),cached_clients:(Instant::now()-Duration::from_secs(60),false)}}
    fn poll(&mut self,settings:&Value)->(Vec<Value>,Vec<Value>){
        self.poll_at(settings,Instant::now())
    }
    fn poll_at(&mut self,settings:&Value,now:Instant)->(Vec<Value>,Vec<Value>){
        let clients_running = if now.saturating_duration_since(self.cached_clients.0) >= Duration::from_secs(4) {
            let found = running_processes().iter().any(|name|crate::file_owners::torrent_client(name));
            self.cached_clients = (now, found);
            found
        } else {
            self.cached_clients.1
        };
        self.poll_at_with_clients(settings,now,clients_running)
    }
    fn poll_at_with_clients(&mut self,settings:&Value,now:Instant,clients_running:bool)->(Vec<Value>,Vec<Value>){
        let folder=downloads_folder(settings);let first=folder!=self.folder||self.rules!=settings["downloadsIgnore"];
        if first{self.files.clear();self.folder=folder.clone();self.rules=settings["downloadsIgnore"].clone();}
        for reply in self.owners.drain(){if let Some(file)=self.files.get_mut(&reply.path){crate::file_owners::Queue::apply(reply,&mut file.owner,now);}}
        let elapsed=now.saturating_duration_since(self.last).as_secs_f64().max(0.001);self.last=now;
        let Some(folder)=folder else{return(vec![],vec![]);};let Ok(entries)=std::fs::read_dir(&folder)else{return(vec![],vec![]);};
        let mut observed=HashMap::new();let mut active=Vec::new();let mut completed=Vec::new();let mut candidates=Vec::new();
        for entry in entries.flatten().take(20000){
            let path=entry.path();let Ok(kind)=entry.file_type()else{continue;};if !kind.is_file()||kind.is_symlink(){continue;}
            let name=entry.file_name().to_string_lossy().into_owned();if ignored(&name,settings){continue;}
            let partial=partial_name(&name);
            // Windows directory entries can retain size zero until a writer closes its handle.
            // Query live files directly; keep the cheap directory metadata for the old baseline.
            let live=partial.is_some()||self.files.get(&path).is_some_and(|file|!file.done||file.owner.torrent)||(!first&&!self.files.contains_key(&path));
            let Ok(metadata)=(if live{std::fs::metadata(&path)}else{entry.metadata()})else{continue;};
            let size=metadata.len();let modified=metadata.modified().ok();let created=metadata.created().ok();
            let direct=self.files.get(&path).filter(|p|p.created==created&&size>=p.size);
            // Preserve ownership when a client removes its temporary extension after finishing.
            let renamed=if direct.is_none()&&partial.is_none(){PARTIAL_SUFFIXES.iter().find_map(|suffix|{
                let old=folder.join(format!("{name}{suffix}"));self.files.get(&old).filter(|p|p.created==created&&size>=p.size&&!old.exists())
            })}else{None};
            let previous=direct.or(renamed);
            let changed=previous.map(|p|p.size!=size||p.modified!=modified).unwrap_or(true);
            let stable=if changed{0}else{previous.map(|p|p.stable.saturating_add(1)).unwrap_or(0)};
            let done=previous.map(|p|p.done&&!changed).unwrap_or(first&&partial.is_none());
            let moved_at=if previous.is_some_and(|p|size>p.size){Some(now)}else{previous.filter(|p|size>=p.size).and_then(|p|p.moved_at)};
            let mut owner=previous.map(|p|p.owner.clone()).unwrap_or_else(||crate::file_owners::FileOwner::new(now));
            if renamed.is_some(){owner.renamed(now);}
            let moving=moved_at.is_some_and(|at|now.saturating_duration_since(at)<Duration::from_secs(15));
            if (!done&&partial.is_none())||(partial.is_some()&&moving){candidates.push((path.clone(),name,partial,moving,previous.map(|p|size.saturating_sub(p.size) as f64/elapsed).unwrap_or(0.)));}
            observed.insert(path,FileState{size,modified,created,stable,done,moved_at,owner});
        }
        // First inspect new lifecycles, then refresh old ones; a large torrent cannot starve new downloads.
        candidates.sort_by_key(|(path,..)|!observed[path].owner.priority());
        for (path,..) in &candidates{let file=observed.get_mut(path).unwrap();self.owners.inspect(path,file.created,&mut file.owner,now,clients_running);}
        let show_torrents=settings["downloadsTorrents"].as_bool().unwrap_or(false);
        for (path,name,partial,moving,speed) in candidates{
            let file=observed.get_mut(&path).unwrap();let hidden=file.owner.torrent&&!show_torrents;let waiting=file.owner.waiting(now);
            if moving&&(partial.is_some()||file.owner.writing())&&!hidden&&!waiting{
                active.push(json!({"id":path.to_string_lossy(),"path":path.to_string_lossy(),"name":partial.as_ref().unwrap_or(&name),"size":file.size,"total":null,"speed":speed,"icon":null}));
            }
            if partial.is_none()&&!file.done&&file.stable>=2&&!waiting{
                // A delayed/failed check or a non-torrent writer cannot confirm
                // completion. Require recent evidence that the file is closed.
                let closed=file.owner.current==crate::file_owners::Ownership::Closed&&file.owner.fresh(now);
                if closed{file.done=true;if !hidden{completed.push(json!({"id":path.to_string_lossy(),"path":path.to_string_lossy(),"name":name,"size":file.size,"title":null,"icon":null}));}}
            }
        }
        self.files=observed;active.sort_by(|a,b|a["name"].as_str().cmp(&b["name"].as_str()));(active,completed)
    }
}

static DOWNLOAD_SNAPSHOT: Mutex<Option<Value>> = Mutex::new(None);
pub fn downloads_snapshot() -> Value { DOWNLOAD_SNAPSHOT.lock().unwrap_or_else(|e|e.into_inner()).clone().unwrap_or_else(||json!([])) }

pub fn start(app:tauri::AppHandle,state:Arc<crate::AppState>){
    let downloads_app=app.clone();let downloads_state=state.clone();
    let _ = std::thread::Builder::new().name("woods-downloads".into()).spawn(move||{
        let mut tracker=Downloads::new();let mut steam=crate::steam::Downloads::default();
        loop{
            let (show_dl, show_steam, dl_settings) = {
                let s = downloads_state.settings.lock().unwrap();
                (
                    s["showDownloads"].as_bool().unwrap_or(true),
                    s["steamDownloads"].as_bool().unwrap_or(true),
                    json!({
                        "downloadsDir": s["downloadsDir"],
                        "downloadsIgnore": s["downloadsIgnore"],
                        "downloadsTorrents": s["downloadsTorrents"]
                    })
                )
            };
            let (mut active, mut completed) = if show_dl { tracker.poll(&dl_settings) } else { (vec![], vec![]) };
            if show_steam {
                let (steam_active,steam_done)=steam.poll(true);
                active.extend(steam_active);completed.extend(steam_done);
            }
            let active=Value::Array(active);
            let changed = { let mut saved = DOWNLOAD_SNAPSHOT.lock().unwrap_or_else(|e|e.into_inner()); let changed=saved.as_ref()!=Some(&active); if changed { *saved=Some(active.clone()); } changed };
            if changed { let _=downloads_app.emit("downloads:update",&active); }
            for file in completed{let _=downloads_app.emit("downloads:done",file);}
            let sleep_ms = if crate::is_low_power() { 3000 } else { 1000 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));
        }
    });
    let telem_state = state.clone();
    let _ = std::thread::Builder::new().name("woods-telemetry".into()).spawn(move||{
        let mut previous=snapshot();let mut slow=Instant::now();let mut desktop=Value::Null;
        loop{
            let low_power = crate::is_low_power();
            let code=layout();if previous["layout"].as_str()!=Some(&code){let _=app.emit("input:lang",&code);let _=app.emit("input:layout",&code);previous["layout"]=json!(code);}
            let on=caps();if previous["capsLock"].as_bool()!=Some(on){let _=app.emit("input:caps",on);previous["capsLock"]=json!(on);}
            let slow_interval = if low_power { Duration::from_secs(6) } else { Duration::from_secs(3) };
            if slow.elapsed()>=slow_interval{
                let current=json!(virtual_desktop());if current!=desktop{let _=app.emit("desktop:virtual",&current);desktop=current;}
                let power=json!(battery());if power!=previous["battery"]{let _=app.emit("power:update",&power);previous["battery"]=power;}
                let show_privacy = telem_state.settings.lock().map(|s| s["showPrivacy"].as_bool().unwrap_or(true)).unwrap_or(true);
                if show_privacy {
                    let active=privacy();if active!=previous["privacy"]{let _=app.emit("privacy:update",&active);previous["privacy"]=active;}
                }
                slow=Instant::now();
            }
            let sleep_ms = if low_power { 1000 } else { 300 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));
        }
    });
}

#[cfg(test)]mod tests{
    use super::*;
    fn until(d:&mut Downloads,settings:&Value,mut predicate:impl FnMut(&(Vec<Value>,Vec<Value>))->bool)->(Vec<Value>,Vec<Value>){
        let start=Instant::now();loop{let result=d.poll(settings);if predicate(&result){return result;}assert!(start.elapsed()<Duration::from_secs(12),"Download observation timed out: {:?}",d.files);std::thread::sleep(Duration::from_millis(100));}
    }
    #[test]fn torrent_owner_filter_survives_setting_changes_rename_and_completion(){
        let mut writer=crate::file_owners::tests::Writer::new("qbittorrent.exe");let folder=writer.folder.join("downloads");
        let mut settings=json!({"downloadsDir":folder.to_string_lossy(),"downloadsTorrents":false});let mut d=Downloads::new();
        assert!(d.poll(&settings).0.is_empty());std::fs::write(writer.folder.join("grow"),b"more bytes").unwrap();
        let start=Instant::now();while !d.files.get(&writer.path()).is_some_and(|f|f.owner.torrent){
            let result=d.poll(&settings);assert!(result.0.is_empty());assert!(result.1.is_empty());assert!(start.elapsed()<Duration::from_secs(10),"Missing torrent owner: {:?}, processes: {:?}",d.files,running_processes());std::thread::sleep(Duration::from_millis(100));
        }
        settings["downloadsTorrents"]=json!(true);assert_eq!(d.poll(&settings).0.len(),1);
        settings["downloadsTorrents"]=json!(false);assert!(d.poll(&settings).0.is_empty());
        let ordinary=folder.join("browser.txt");std::fs::write(&ordinary,b"browser download").unwrap();
        let result=until(&mut d,&settings,|(_,done)|done.iter().any(|f|f["name"]=="browser.txt"));assert_eq!(result.1.len(),1);
        writer.close();let final_path=folder.join("Архив.zip");std::fs::rename(writer.path(),&final_path).unwrap();
        let start=Instant::now();while !d.files.get(&final_path).is_some_and(|f|f.done){
            let result=d.poll(&settings);assert!(result.1.is_empty(),"Hidden torrent must not notify on rename");assert!(start.elapsed()<Duration::from_secs(10));std::thread::sleep(Duration::from_millis(100));
        }
        assert!(d.files[&final_path].owner.torrent);settings["downloadsTorrents"]=json!(true);assert!(d.poll(&settings).1.is_empty());
    }
    #[test]fn opted_in_torrent_does_not_finish_while_writer_is_open(){
        let mut writer=crate::file_owners::tests::Writer::new("qbittorrent.exe");let folder=writer.folder.join("downloads");
        let settings=json!({"downloadsDir":folder.to_string_lossy(),"downloadsTorrents":true});let mut d=Downloads::new();d.poll(&settings);
        std::fs::write(writer.folder.join("grow"),b"incoming").unwrap();until(&mut d,&settings,|(active,_)|!active.is_empty());
        // A client may write its final filename directly, with no partial-file suffix.
        let final_path=folder.join("Архив.zip");std::fs::rename(writer.path(),&final_path).unwrap();
        let start=Instant::now();while start.elapsed()<Duration::from_secs(3){assert!(d.poll(&settings).1.is_empty());std::thread::sleep(Duration::from_millis(100));}
        assert!(d.files[&final_path].owner.torrent);writer.close();
        let result=until(&mut d,&settings,|(_,done)|done.iter().any(|f|f["name"]=="Архив.zip"));assert_eq!(result.1.len(),1);assert!(d.poll(&settings).1.is_empty());
    }
    #[test]fn browser_final_name_waits_for_close_without_any_torrent_process(){
        let mut writer=crate::file_owners::tests::Writer::new("chrome.exe");let folder=writer.folder.join("downloads");
        let settings=json!({"downloadsDir":folder.to_string_lossy(),"downloadsTorrents":false});let mut d=Downloads::new();
        d.poll_at_with_clients(&settings,Instant::now(),false);
        let final_path=folder.join("Архив.zip");std::fs::rename(writer.path(),&final_path).unwrap();
        let start=Instant::now();while start.elapsed()<Duration::from_secs(3){
            assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty(),"An open browser file cannot be ready");
            std::thread::sleep(Duration::from_millis(100));
        }
        assert_eq!(d.files[&final_path].owner.current,crate::file_owners::Ownership::Other);
        std::fs::write(writer.folder.join("grow"),b"incoming browser bytes").unwrap();
        let start=Instant::now();loop{
            let (active,done)=d.poll_at_with_clients(&settings,Instant::now(),false);assert!(done.is_empty());
            if active.iter().any(|file|file["name"]=="Архив.zip"){break;}
            assert!(start.elapsed()<Duration::from_secs(10),"Final-name browser progress is missing");std::thread::sleep(Duration::from_millis(100));
        }
        writer.close();let start=Instant::now();loop{
            let (_,done)=d.poll_at_with_clients(&settings,Instant::now(),false);
            if done.iter().any(|file|file["name"]=="Архив.zip"){assert_eq!(done.len(),1);break;}
            assert!(start.elapsed()<Duration::from_secs(10),"Closed browser file never completed");std::thread::sleep(Duration::from_millis(100));
        }
        assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty());
    }
    #[test]fn replacements_do_not_inherit_torrent_ownership(){
        let folder=std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("replacement-{}",crate::media::now_ms()));std::fs::create_dir_all(&folder).unwrap();
        let settings=json!({"downloadsDir":folder.to_string_lossy()});let path=folder.join("report.txt");std::fs::write(&path,b"long old payload").unwrap();let mut d=Downloads::new();d.poll_at_with_clients(&settings,Instant::now(),false);
        d.files.get_mut(&path).unwrap().owner.torrent=true;std::fs::write(&path,b"new").unwrap();
        d.poll_at_with_clients(&settings,Instant::now(),false);assert!(!d.files[&path].owner.torrent);
        assert_eq!(until(&mut d,&settings,|(_,done)|done.iter().any(|file|file["name"]=="report.txt")).1.len(),1);
        std::fs::remove_file(path).unwrap();std::fs::remove_dir(folder).unwrap();
    }
    #[test]fn old_partial_files_are_not_active_and_stalled_transfers_expire(){
        let folder=std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("partial-{}-{}",std::process::id(),crate::media::now_ms()));std::fs::create_dir_all(&folder).unwrap();
        let file=folder.join("archive.zip.crdownload");std::fs::write(&file,b"old").unwrap();let settings=json!({"downloadsDir":folder.to_string_lossy()});let mut d=Downloads::new();let now=Instant::now();
        assert!(d.poll_at_with_clients(&settings,now,false).0.is_empty());assert!(d.poll_at_with_clients(&settings,now+Duration::from_secs(1),false).0.is_empty());
        std::fs::write(&file,b"old plus incoming bytes").unwrap();d.poll_at_with_clients(&settings,now+Duration::from_secs(2),false);
        let active=until(&mut d,&settings,|(active,_)|!active.is_empty()).0;
        assert_eq!(active.len(),1);assert_eq!(active[0]["size"],json!(23));assert!(d.poll_at_with_clients(&settings,now+Duration::from_secs(18),false).0.is_empty());
        std::fs::remove_file(file).unwrap();std::fs::remove_dir(folder).unwrap();
    }
    #[test]fn unknown_or_absent_battery_is_not_fabricated(){assert!(power_payload(SYSTEM_POWER_STATUS{BatteryFlag:128,BatteryLifePercent:255,..Default::default()}).is_none());let status=power_payload(SYSTEM_POWER_STATUS{BatteryFlag:8,BatteryLifePercent:68,ACLineStatus:1,SystemStatusFlag:0,..Default::default()}).unwrap();assert_eq!(status["percent"],68);assert_eq!(status["plugged"],true);}
    #[test]fn download_name_masks_are_case_insensitive_and_unicode_safe(){assert!(glob("setup-*.exe","SETUP-1.EXE"));assert!(glob("*.txt","заметка.txt"));assert!(!glob("a?c","ac"));assert_eq!(partial_name("Архив.zip.crdownload"),Some("Архив.zip".into()));}
    #[test]fn existing_downloads_do_not_generate_old_notifications(){
        let folder=std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("woods-download-test-{}",crate::media::now_ms()));std::fs::create_dir_all(&folder).unwrap();std::fs::write(folder.join("old.txt"),b"old").unwrap();
        let settings=json!({"downloadsDir":folder.to_string_lossy()});let mut d=Downloads::new();assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty());
        std::fs::write(folder.join("new.txt"),b"new").unwrap();assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty());assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty());
        assert_eq!(until(&mut d,&settings,|(_,done)|done.iter().any(|file|file["name"]=="new.txt")).1.len(),1);assert!(d.poll_at_with_clients(&settings,Instant::now(),false).1.is_empty());
        for name in ["old.txt","new.txt"]{let _=std::fs::remove_file(folder.join(name));}let _=std::fs::remove_dir(folder);
    }
}
