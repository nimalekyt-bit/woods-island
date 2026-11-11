use tauri::Emitter;
use windows::UI::Notifications::{Management::{UserNotificationListener,UserNotificationListenerAccessStatus},NotificationKinds};
pub fn access()->bool{let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return false;};UserNotificationListener::Current().and_then(|l|l.GetAccessStatus()).map(|s|s==UserNotificationListenerAccessStatus::Allowed).unwrap_or(false)}
fn access_name(status: UserNotificationListenerAccessStatus) -> &'static str {if status==UserNotificationListenerAccessStatus::Allowed{"allowed"}else if status==UserNotificationListenerAccessStatus::Denied{"denied"}else{"unspecified"}}
pub fn status()->String{let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return "unavailable".into();};UserNotificationListener::Current().and_then(|l|l.GetAccessStatus()).map(|s|access_name(s).to_owned()).unwrap_or_else(|_|"unavailable".into())}
pub fn request()->Result<String,String>{let _apartment=crate::audio::WinRtApartment::new()?;let listener=UserNotificationListener::Current().map_err(|e|e.to_string())?;listener.RequestAccessAsync().map_err(|e|e.to_string())?.get().map(|s|access_name(s).to_owned()).map_err(|e|e.to_string())}
pub fn start(app:tauri::AppHandle,state:std::sync::Arc<crate::AppState>){
    std::thread::spawn(move||{
        let Ok(_apartment)=crate::audio::WinRtApartment::new()else{return;};
        let mut seen=std::collections::HashSet::new();let mut initialized=false;
        loop{
            std::thread::sleep(std::time::Duration::from_secs(2));let settings=state.settings.lock().unwrap().clone();
            if settings["showNotifications"]!=serde_json::json!(true)||!access(){continue;}
            let Ok(listener)=UserNotificationListener::Current()else{continue;};
            let Ok(operation)=listener.GetNotificationsAsync(NotificationKinds::Toast)else{continue;};let Ok(notes)=operation.get()else{continue;};
            let mut current=std::collections::HashSet::new();
            for note in &notes{
                let Ok(id)=note.Id()else{continue;};current.insert(id);if seen.contains(&id)||!initialized{continue;}
                let info=note.AppInfo().ok();let name=info.as_ref().and_then(|i|i.DisplayInfo().ok()).and_then(|d|d.DisplayName().ok()).map(|s|s.to_string()).unwrap_or_default();
                let aumid=info.and_then(|i|i.AppUserModelId().ok()).map(|s|s.to_string()).unwrap_or_default();
                if settings["notifyMuted"].as_array().map(|a|a.iter().any(|v|v.as_str()==Some(&aumid)||v.as_str()==Some(&name))).unwrap_or(false){continue;}
                let mut text=Vec::new();
                if let Ok(visual)=note.Notification().and_then(|n|n.Visual()){if let Ok(bindings)=visual.Bindings(){for binding in &bindings{if let Ok(elements)=binding.GetTextElements(){for element in &elements{if let Ok(value)=element.Text(){text.push(value.to_string());}}}}}}
                let title=text.first().cloned().unwrap_or_default();let body=text.iter().skip(1).cloned().collect::<Vec<_>>().join("\n");
                let _=app.emit("notify:new",serde_json::json!({"id":id,"app":name,"aumid":aumid,"title":title,"body":body,"icon":null}));
            }
            seen=current;initialized=true;
        }
    });
}
