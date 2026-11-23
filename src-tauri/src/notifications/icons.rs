use super::icon_image::{image_url,MAX_ICON_BYTES};
use std::{collections::HashMap,sync::Mutex,time::{Duration,Instant}};
use windows::{core::Interface,ApplicationModel::AppInfo,Foundation::{AsyncStatus,IAsyncInfo,Size},Storage::Streams::DataReader};

static CACHE:Mutex<Option<HashMap<String,(Instant,Option<String>)>>>=Mutex::new(None);
fn completed(operation:&impl Interface,deadline:Instant)->bool {
    let Ok(info)=operation.cast::<IAsyncInfo>()else{return false;};
    loop {
        match info.Status(){
            Ok(AsyncStatus::Completed)=>return true,
            Ok(AsyncStatus::Started) if Instant::now()<deadline=>std::thread::sleep(Duration::from_millis(10)),
            _=>{let _=info.Cancel();return false;}
        }
    }
}
fn logo(info:&AppInfo)->Option<String>{
    let deadline=Instant::now()+Duration::from_millis(900);
    let reference=info.DisplayInfo().ok()?.GetLogo(Size{Width:96.,Height:96.}).ok()?;
    let operation=reference.OpenReadAsync().ok()?;
    if !completed(&operation,deadline){return None;}
    let stream=operation.get().ok()?;
    let size=stream.Size().ok()?;
    if size==0||size>MAX_ICON_BYTES{return None;}
    let input=stream.GetInputStreamAt(0).ok()?;
    let reader=DataReader::CreateDataReader(&input).ok()?;
    let load=reader.LoadAsync(size as u32).ok()?;
    if !completed(&load,deadline){return None;}
    if load.get().ok()?!=size as u32{return None;}
    let mut bytes=vec![0;size as usize];reader.ReadBytes(&mut bytes).ok()?;
    let _=reader.Close();let _=stream.Close();
    image_url(&bytes)
}
pub(super) fn for_app(info:&AppInfo,aumid:&str,name:&str)->Option<String>{
    let key=format!("{aumid}\0{name}");let now=Instant::now();
    {
        let cache=CACHE.lock().ok()?;
        if let Some((until,value))=cache.as_ref().and_then(|cache|cache.get(&key)){
            if *until>now{return value.clone();}
        }
    }
    // AppInfo covers packaged apps and registered browser/site notifications.
    // Shell artwork is a local fallback when Windows exposes no display logo.
    let value=logo(info).or_else(||if aumid.is_empty(){None}else{crate::system::icon(&format!("shell:AppsFolder\\{aumid}"))});
    let mut guard=CACHE.lock().ok()?;let cache=guard.get_or_insert_with(HashMap::new);
    if cache.len()>=128{
        if let Some(oldest)=cache.iter().min_by_key(|(_,value)|value.0).map(|(key,_)|key.clone()){cache.remove(&oldest);}
    }
    cache.insert(key,(now+if value.is_some(){Duration::from_secs(300)}else{Duration::from_secs(30)},value.clone()));
    value
}
pub fn for_id(aumid:&str)->Option<String>{
    if aumid.is_empty()||aumid.len()>512||aumid.contains(['\0','\r','\n']){return None;}
    let _apartment=crate::audio::WinRtApartment::new().ok()?;
    let info=AppInfo::GetFromAppUserModelId(&aumid.into()).ok()?;
    let name=info.DisplayInfo().ok().and_then(|display|display.DisplayName().ok()).map(|value|value.to_string()).unwrap_or_default();
    for_app(&info,aumid,&name)
}
