//! Steam download progress from actual library manifests.
use serde_json::{json,Value};
use std::{collections::{HashMap,HashSet},path::{Path,PathBuf},time::{Duration,Instant}};
fn pairs(text:&str)->Vec<(String,String)>{
    let mut tokens=Vec::new();let mut chars=text.chars();
    while let Some(c)=chars.next(){if c!='"'{continue;}let mut token=String::new();while let Some(c)=chars.next(){if c=='"'{break;}if c=='\\'{if let Some(next)=chars.next(){token.push(next);}}else{token.push(c);}}tokens.push(token);}
    tokens.windows(2).map(|p|(p[0].clone(),p[1].clone())).collect()
}
fn steam_path()->Option<PathBuf>{
    if let Some(path)=std::env::var_os("WOODS_ISLAND_STEAM_PATH"){return Some(path.into());}
    use windows::{core::w,Win32::System::Registry::*};
    unsafe{let mut value=[0u16;32768];let mut bytes=(value.len()*2) as u32;
        if RegGetValueW(HKEY_CURRENT_USER,w!("Software\\Valve\\Steam"),w!("SteamPath"),RRF_RT_REG_SZ,None,Some(value.as_mut_ptr().cast()),Some(&mut bytes)).is_ok(){let len=value.iter().position(|c|*c==0).unwrap_or(value.len());return Some(PathBuf::from(String::from_utf16_lossy(&value[..len])));}}
    None
}
const ACTIVITY_GRACE:Duration=Duration::from_secs(15);
struct Progress{bytes:u64,total:u64,moved_at:Option<Instant>}
#[derive(Default)]pub struct Downloads{previous:HashMap<String,Progress>,last:Option<Instant>}
fn library_key(path:&Path)->String{path.to_string_lossy().replace('/',"\\").trim_end_matches('\\').to_lowercase()}
impl Downloads{
    pub fn poll(&mut self,enabled:bool)->(Vec<Value>,Vec<Value>){
        let isolated=crate::win::WindowManager::passive_qa()&&std::env::var_os("WOODS_ISLAND_STEAM_PATH").is_some();
        let running=isolated||crate::telemetry::running_processes().contains("steam.exe");
        if !enabled||!running{self.previous.clear();self.last=None;return(vec![],vec![]);}
        let Some(root)=steam_path()else{return(vec![],vec![]);};
        self.poll_root(root,Instant::now())
    }
    fn poll_root(&mut self,root:PathBuf,now:Instant)->(Vec<Value>,Vec<Value>){
        let elapsed=self.last.replace(now).map(|t|now.saturating_duration_since(t).as_secs_f64().max(0.01)).unwrap_or(1.);
        let mut libraries=vec![root.join("steamapps")];
        if let Ok(text)=std::fs::read_to_string(root.join("steamapps/libraryfolders.vdf")){for(key,value)in pairs(&text){if key=="path"{libraries.push(PathBuf::from(value).join("steamapps"));}}}
        let mut unique=HashSet::new();libraries.retain(|path|unique.insert(library_key(path)));
        let mut active=Vec::new();let mut done=Vec::new();let mut observed=HashMap::new();
        for library in libraries{for file in std::fs::read_dir(&library).into_iter().flatten().flatten().take(3000){let path=file.path();if path.extension()!=Some(std::ffi::OsStr::new("acf")){continue;}let Ok(text)=std::fs::read_to_string(path)else{continue;};let data:HashMap<_,_>=pairs(&text).into_iter().collect();
            let get=|key:&str|data.get(key).cloned().unwrap_or_default();let number=|key:&str|get(key).parse::<u64>().unwrap_or(0);
            let total=number("BytesToDownload");let bytes=number("BytesDownloaded").min(total);if total==0{continue;}
            let appid=get("appid");if appid.is_empty(){continue;}let id=format!("steam:{appid}");let name=get("name");if name.is_empty()||observed.contains_key(&id){continue;}let target=library.join("common").join(get("installdir"));
            let previous=self.previous.get(&id);let compatible=previous.filter(|p|p.total==total&&bytes>=p.bytes);
            let moved=compatible.is_some_and(|p|bytes>p.bytes);
            let moved_at=if moved{Some(now)}else{compatible.and_then(|p|p.moved_at)};
            let flags=number("StateFlags");let downloading=flags&(1024|65536)!=0&&flags&(131072|8192)==0;
            let recent=moved_at.is_some_and(|at|now.saturating_duration_since(at)<ACTIVITY_GRACE);
            let speed=compatible.map(|p|bytes.saturating_sub(p.bytes) as f64/elapsed).unwrap_or(0.);
            let payload=json!({"id":id,"name":name,"path":target.to_string_lossy(),"size":bytes,"total":total,"speed":speed,"source":"steam","icon":null});
            if bytes<total&&downloading&&recent{active.push(payload);}else if bytes==total&&compatible.is_some_and(|p|p.bytes<p.total&&p.moved_at.is_some()){done.push(payload);}
            observed.insert(id,Progress{bytes,total,moved_at});
        }}self.previous=observed;(active,done)
    }
}
#[cfg(test)]mod tests{use super::*;
    fn fixture()->PathBuf{static SEQUENCE:std::sync::atomic::AtomicU64=std::sync::atomic::AtomicU64::new(0);let root=std::env::temp_dir().join("woodscorp_obs/fixtures").join(format!("steam-{}-{}-{}",std::process::id(),crate::media::now_ms(),SEQUENCE.fetch_add(1,std::sync::atomic::Ordering::Relaxed)));std::fs::create_dir_all(root.join("steamapps")).unwrap();root}
    fn write(root:&Path,bytes:u64,flags:u64){std::fs::write(root.join("steamapps/appmanifest_42.acf"),format!("\"AppState\" {{ \"appid\" \"42\" \"name\" \"Test\" \"installdir\" \"test\" \"BytesToDownload\" \"500\" \"BytesDownloaded\" \"{bytes}\" \"StateFlags\" \"{flags}\" }}")).unwrap();}
    #[test]fn queued_and_stale_counters_are_not_transfers(){let root=fixture();let now=Instant::now();let mut d=Downloads::default();write(&root,100,518);assert!(d.poll_root(root.clone(),now).0.is_empty());assert!(d.poll_root(root.clone(),now+Duration::from_secs(1)).0.is_empty());write(&root,100,1574);assert!(d.poll_root(root.clone(),now+Duration::from_secs(2)).0.is_empty());std::fs::remove_dir_all(root).unwrap();}
    #[test]fn only_measured_transfer_completes_and_stalls_expire(){let root=fixture();let now=Instant::now();let mut d=Downloads::default();write(&root,100,1024);d.poll_root(root.clone(),now);write(&root,200,1024);let active=d.poll_root(root.clone(),now+Duration::from_secs(1)).0;assert_eq!(active.len(),1);assert_eq!(active[0]["speed"],100.);assert!(d.poll_root(root.clone(),now+Duration::from_secs(17)).0.is_empty());write(&root,300,1024|131072);assert!(d.poll_root(root.clone(),now+Duration::from_secs(18)).0.is_empty());write(&root,400,1024);assert_eq!(d.poll_root(root.clone(),now+Duration::from_secs(19)).0.len(),1);write(&root,500,4);assert_eq!(d.poll_root(root.clone(),now+Duration::from_secs(20)).1.len(),1);assert!(d.poll_root(root.clone(),now+Duration::from_secs(21)).1.is_empty());std::fs::remove_dir_all(root).unwrap();}
    #[test]fn equivalent_library_paths_and_duplicate_apps_do_not_double_count(){assert_eq!(library_key(Path::new("E:/Steam/steamapps/")),library_key(Path::new("e:\\STEAM\\steamapps")));let root=fixture();let extra=root.join("other/steamapps");std::fs::create_dir_all(&extra).unwrap();let vdf=format!("\"libraryfolders\" {{ \"path\" \"{}\" }}",root.join("other").to_string_lossy().replace('\\',"\\\\"));std::fs::write(root.join("steamapps/libraryfolders.vdf"),vdf).unwrap();let now=Instant::now();let mut d=Downloads::default();write(&root,100,1024);std::fs::copy(root.join("steamapps/appmanifest_42.acf"),extra.join("appmanifest_42.acf")).unwrap();d.poll_root(root.clone(),now);write(&root,200,1024);std::fs::copy(root.join("steamapps/appmanifest_42.acf"),extra.join("appmanifest_42.acf")).unwrap();assert_eq!(d.poll_root(root.clone(),now+Duration::from_secs(1)).0.len(),1);std::fs::remove_dir_all(root).unwrap();}
    #[test]fn manifest_preserves_unicode_and_windows_paths(){let p=pairs(r#""AppState" { "name" "Игра" "path" "E:\\Games\\Steam" "BytesDownloaded" "120" }"#);assert!(p.contains(&("name".into(),"Игра".into())));assert!(p.contains(&("path".into(),"E:\\Games\\Steam".into())));assert!(p.contains(&("BytesDownloaded".into(),"120".into())));}
}
