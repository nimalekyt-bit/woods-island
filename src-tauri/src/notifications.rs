use tauri::Emitter;
use windows::UI::Notifications::{Management::{UserNotificationListener,UserNotificationListenerAccessStatus},NotificationKinds};
mod icon_image;
mod icons;
pub fn icon(aumid:&str)->Option<String>{icons::for_id(aumid)}
pub fn access()->bool{let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return false;};UserNotificationListener::Current().and_then(|l|l.GetAccessStatus()).map(|s|s==UserNotificationListenerAccessStatus::Allowed).unwrap_or(false)}
fn access_name(status: UserNotificationListenerAccessStatus) -> &'static str {if status==UserNotificationListenerAccessStatus::Allowed{"allowed"}else if status==UserNotificationListenerAccessStatus::Denied{"denied"}else{"unspecified"}}
pub fn status()->String{let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return "unavailable".into();};UserNotificationListener::Current().and_then(|l|l.GetAccessStatus()).map(|s|access_name(s).to_owned()).unwrap_or_else(|_|"unavailable".into())}
pub fn request()->Result<String,String>{let _apartment=crate::audio::WinRtApartment::new()?;let listener=UserNotificationListener::Current().map_err(|e|e.to_string())?;listener.RequestAccessAsync().map_err(|e|e.to_string())?.get().map(|s|access_name(s).to_owned()).map_err(|e|e.to_string())}
pub fn start(app:tauri::AppHandle,state:std::sync::Arc<crate::AppState>){
    if crate::win::WindowManager::passive_qa(){return;}
    let _ = std::thread::Builder::new().name("woods-notifications".into()).spawn(move||{
        let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return;};
        let mut seen=std::collections::HashSet::new();let mut initialized=false;
        let mut cached_listener: Option<UserNotificationListener> = None;
        loop{
            let sleep_ms = if crate::is_low_power() { 4000 } else { 2500 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));
            let (enabled, muted) = {
                let s = state.settings.lock().unwrap();
                let on = s["showNotifications"] == serde_json::json!(true);
                let list = if on {
                    s["notifyMuted"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect::<Vec<_>>()).unwrap_or_default()
                } else {
                    Vec::new()
                };
                (on, list)
            };
            if !enabled { initialized=false; seen.clear(); continue; }
            if cached_listener.is_none() {
                cached_listener = UserNotificationListener::Current().ok();
            }
            let Some(ref listener) = cached_listener else { continue; };
            if listener.GetAccessStatus().ok() != Some(UserNotificationListenerAccessStatus::Allowed) {
                initialized=false; seen.clear(); continue;
            }
            let Ok(operation)=listener.GetNotificationsAsync(NotificationKinds::Toast)else{cached_listener=None;continue;};
            let Ok(notes)=operation.get()else{cached_listener=None;continue;};
            let mut current=std::collections::HashSet::new();
            for note in &notes{
                let Ok(id)=note.Id()else{continue;};current.insert(id);if seen.contains(&id)||!initialized{continue;}
                let info=note.AppInfo().ok();let name=info.as_ref().and_then(|i|i.DisplayInfo().ok()).and_then(|d|d.DisplayName().ok()).map(|s|s.to_string()).unwrap_or_default();
                let aumid=info.as_ref().and_then(|i|i.AppUserModelId().ok()).map(|s|s.to_string()).unwrap_or_default();
                if muted.iter().any(|m| m == &aumid || m == &name){continue;}
                let mut text=Vec::new();
                if let Ok(visual)=note.Notification().and_then(|n|n.Visual()){if let Ok(bindings)=visual.Bindings(){for binding in &bindings{if let Ok(elements)=binding.GetTextElements(){for element in &elements{if let Ok(value)=element.Text(){text.push(value.to_string());}}}}}}
                let title=text.first().cloned().unwrap_or_default();let body=text.iter().skip(1).cloned().collect::<Vec<_>>().join("\n");
                let icon=info.as_ref().and_then(|info|icons::for_app(info,&aumid,&name));
                let _=app.emit("notify:new",serde_json::json!({"id":id,"app":name,"aumid":aumid,"title":title,"body":body,"icon":icon}));
            }
            seen=current;initialized=true;
        }
    });
}
