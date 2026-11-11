//! Steam download progress from actual library manifests.
use serde_json::{json,Value};
use std::{collections::HashMap,path::PathBuf,time::Instant};
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
#[derive(Default)]pub struct Downloads{previous:HashMap<String,(u64,u64)>,last:Option<Instant>}
impl Downloads{
    pub fn poll(&mut self,enabled:bool)->(Vec<Value>,Vec<Value>){
        let elapsed=self.last.replace(Instant::now()).map(|t|t.elapsed().as_secs_f64().max(0.01)).unwrap_or(1.);
        if !enabled{self.previous.clear();return (vec![],vec![]);}
        let Some(root)=steam_path()else{return (vec![],vec![]);};let mut libraries=vec![root.join("steamapps")];
        if let Ok(text)=std::fs::read_to_string(root.join("steamapps/libraryfolders.vdf")){for(key,value)in pairs(&text){if key=="path"{libraries.push(PathBuf::from(value).join("steamapps"));}}}
        libraries.sort();libraries.dedup();let mut active=Vec::new();let mut done=Vec::new();let mut observed=HashMap::new();
        for library in libraries{for file in std::fs::read_dir(&library).into_iter().flatten().flatten().take(3000){let path=file.path();if path.extension()!=Some(std::ffi::OsStr::new("acf")){continue;}let Ok(text)=std::fs::read_to_string(path)else{continue;};let data:HashMap<_,_>=pairs(&text).into_iter().collect();
            let get=|key:&str|data.get(key).cloned().unwrap_or_default();let number=|key:&str|get(key).parse::<u64>().unwrap_or(0);
            let total=number("BytesToDownload");let bytes=number("BytesDownloaded").min(total);if total==0{continue;}
            let id=format!("steam:{}",get("appid"));let name=get("name");if name.is_empty(){continue;}let target=library.join("common").join(get("installdir"));
            let previous=self.previous.get(&id);let speed=previous.map(|(old,_)|bytes.saturating_sub(*old) as f64/elapsed).unwrap_or(0.);
            let payload=json!({"id":id,"name":name,"path":target.to_string_lossy(),"size":bytes,"total":total,"speed":speed,"source":"steam","icon":null});
            if bytes<total{active.push(payload);}else if previous.map(|(old,total)|old<total).unwrap_or(false){done.push(payload);}
            observed.insert(id,(bytes,total));
        }}self.previous=observed;(active,done)
    }
}
#[cfg(test)]mod tests{use super::*;
    #[test]fn manifest_preserves_unicode_and_windows_paths(){let p=pairs(r#""AppState" { "name" "Игра" "path" "E:\\Games\\Steam" "BytesDownloaded" "120" }"#);assert!(p.contains(&("name".into(),"Игра".into())));assert!(p.contains(&("path".into(),"E:\\Games\\Steam".into())));assert!(p.contains(&("BytesDownloaded".into(),"120".into())));}
}
