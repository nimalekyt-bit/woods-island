use tauri::{AppHandle, Emitter, Manager, WebviewUrl, LogicalPosition, LogicalSize};
use std::sync::{Mutex,atomic::{AtomicU64,Ordering}};
use std::collections::BTreeMap;
use webview2_com::{Microsoft::Web::WebView2::Win32::ICoreWebView2_3, TrySuspendCompletedHandler};
use windows_core_webview::Interface;
static POPPED:Mutex<Option<String>>=Mutex::new(None);
static LAST_WORD:AtomicU64=AtomicU64::new(0);
static VISIBLE_VIEWS:Mutex<BTreeMap<String,bool>>=Mutex::new(BTreeMap::new());

fn service_url(service:&str)->Result<reqwest::Url,String>{
    let url=match service{"chatgpt"|"openai"=>"https://chatgpt.com","claude"=>"https://claude.ai","gemini"=>"https://gemini.google.com","deepseek"=>"https://chat.deepseek.com","grok"=>"https://grok.com","qwen"=>"https://chat.qwen.ai",_=>return Err("Unknown AI website".into())};
    reqwest::Url::parse(url).map_err(|e|e.to_string())
}
pub fn popped()->Option<String>{POPPED.lock().unwrap().clone()}
pub fn open(app:&AppHandle,service:Option<&str>)->Result<(),String>{let service=service.unwrap_or("gemini");service_url(service)?;app.emit("webai:open",service).map_err(|e|e.to_string())}
pub fn browser(service:&str)->Result<(),String>{crate::system::open_path(service_url(service)?.as_str(),false,false)}
fn accept_word(word:u64)->bool{word>=LAST_WORD.fetch_max(word,Ordering::SeqCst)}
fn wants_visible(label:&str)->bool{VISIBLE_VIEWS.lock().unwrap_or_else(|e|e.into_inner()).get(label).copied().unwrap_or(false)}
/// WebView2 suspension trims renderer memory without navigating away or losing
/// an unsent draft. The runtime may refuse while audio/capture is active.
fn view_activity(app:&AppHandle,webview:&tauri::Webview,visible:bool)->Result<(),String>{
    let label=webview.label().to_owned();
    let previous=VISIBLE_VIEWS.lock().unwrap_or_else(|e|e.into_inner()).insert(label.clone(),visible);
    if previous==Some(visible){return Ok(());}
    let handle=app.clone();
    webview.with_webview(move|platform|unsafe{
        if wants_visible(&label)!=visible{return;}
        let Ok(core)=platform.controller().CoreWebView2().and_then(|core|core.cast::<ICoreWebView2_3>())else{
            let _=handle.emit("webai:lifecycle",serde_json::json!({"view":label,"state":"unsupported"}));return;
        };
        if visible {
            let state=if core.Resume().is_ok(){"active"}else{"resumeFailed"};
            let _=handle.emit("webai:lifecycle",serde_json::json!({"view":label,"state":state}));
        }else{
            let completed_core=core.clone();let completed_label=label.clone();let completed_app=handle.clone();
            let completed=TrySuspendCompletedHandler::create(Box::new(move|result,suspended|{
                // Resume can overtake the asynchronous suspension completion.
                let state=if wants_visible(&completed_label){let _=completed_core.Resume();"active"}
                    else if result.is_ok()&&suspended{"suspended"}else{"deferred"};
                let _=completed_app.emit("webai:lifecycle",serde_json::json!({"view":completed_label,"state":state}));Ok(())
            }));
            if core.TrySuspend(&completed).is_err(){let _=handle.emit("webai:lifecycle",serde_json::json!({"view":label,"state":"deferred"}));}
        }
    }).map_err(|e|e.to_string())
}
fn hide_views(app:&AppHandle,except:Option<&str>)->Result<(),String>{
    for service in ["chatgpt","openai","claude","gemini","deepseek","grok","qwen"]{if except==Some(service){continue;}if let Some(webview)=app.get_webview(&format!("web-ai-{service}")){webview.hide().map_err(|e|e.to_string())?;view_activity(app,&webview,false)?;}}
    Ok(())
}
pub fn hide(app:&AppHandle,word:u64)->Result<(),String>{
    if !accept_word(word){return Ok(());}
    hide_views(app,None)?;
    app.emit("webai:active",false).map_err(|e|e.to_string())
}
pub fn embed(app:&AppHandle,service:&str,x:f64,y:f64,width:f64,height:f64,focus:bool,word:u64)->Result<(),String>{
    if ![x,y,width,height].iter().all(|n|n.is_finite())||width<=0.||height<=0.{return Err("Invalid AI view bounds".into());}
    let url=service_url(service)?;
    if !accept_word(word){return Ok(());}
    let is_popped=popped().as_deref()==Some(service);
    hide_views(app,if is_popped{None}else{Some(service)})?;
    if is_popped{return Ok(());}
    let label=format!("web-ai-{service}");
    let webview=if let Some(view)=app.get_webview(&label){view}else{
        let window=app.get_window("main").ok_or("Main window is unavailable")?;
        window.add_child(tauri::webview::WebviewBuilder::new(&label,WebviewUrl::External(url)),LogicalPosition::new(x,y),LogicalSize::new(width,height)).map_err(|e|e.to_string())?
    };
    webview.set_position(LogicalPosition::new(x,y)).map_err(|e|e.to_string())?;
    webview.set_size(LogicalSize::new(width,height)).map_err(|e|e.to_string())?;
    view_activity(app,&webview,true)?;
    webview.show().map_err(|e|e.to_string())?;
    if focus{
        let main=app.get_window("main").ok_or("Main window is unavailable")?;
        let hwnd=main.hwnd().map_err(|e|e.to_string())?;
        crate::win::WindowManager::keyboard_focus(windows::Win32::Foundation::HWND(hwnd.0 as _),true);
        main.set_focus().map_err(|e|e.to_string())?;
        webview.set_focus().map_err(|e|e.to_string())?;
    }
    app.emit("webai:active",true).map_err(|e|e.to_string())
}
pub fn window(app:&AppHandle,service:&str)->Result<(),String>{
    let url=service_url(service)?;
    hide_views(app,None)?;
    if let Some(window)=app.get_webview_window("web-ai-window"){if popped().as_deref()!=Some(service){window.navigate(url).map_err(|e|e.to_string())?;}window.show().map_err(|e|e.to_string())?;window.set_focus().map_err(|e|e.to_string())?;}
    else{
        let window=tauri::WebviewWindowBuilder::new(app,"web-ai-window",WebviewUrl::External(url)).title("Woods Island — Web AI").inner_size(960.,760.).build().map_err(|e|e.to_string())?;
        let handle=app.clone();window.on_window_event(move|event|{if matches!(event,tauri::WindowEvent::Destroyed){*POPPED.lock().unwrap()=None;let _=handle.emit("webai:popped",Option::<String>::None);}});
    }
    *POPPED.lock().unwrap()=Some(service.to_owned());app.emit("webai:popped",service).map_err(|e|e.to_string())
}
pub fn window_close(app:&AppHandle)->Result<(),String>{if let Some(window)=app.get_webview_window("web-ai-window"){window.close().map_err(|e|e.to_string())?;}*POPPED.lock().unwrap()=None;app.emit("webai:popped",Option::<String>::None).map_err(|e|e.to_string())}
pub fn window_show(app:&AppHandle)->Result<(),String>{let window=app.get_webview_window("web-ai-window").ok_or("AI window is not open")?;window.show().map_err(|e|e.to_string())?;window.set_focus().map_err(|e|e.to_string())}

#[cfg(test)]mod tests{use super::*;#[test]fn websites_are_whitelisted(){assert!(service_url("claude").is_ok());assert!(service_url("https://attacker.test").is_err());}}
