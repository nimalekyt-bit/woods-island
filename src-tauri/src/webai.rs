use tauri::{AppHandle, Emitter, Manager, WebviewUrl, LogicalPosition, LogicalSize};
use std::sync::{Mutex,atomic::{AtomicU64,Ordering}};
use std::collections::BTreeMap;
use webview2_com::{Microsoft::Web::WebView2::Win32::{ICoreWebView2_3, COREWEBVIEW2_WEB_ERROR_STATUS}, TrySuspendCompletedHandler, NavigationStartingEventHandler, NavigationCompletedEventHandler};
use windows_core_webview::Interface;
static POPPED:Mutex<Option<String>>=Mutex::new(None);
static LAST_WORD:AtomicU64=AtomicU64::new(0);
static VISIBLE_VIEWS:Mutex<BTreeMap<String,bool>>=Mutex::new(BTreeMap::new());
static WINDOW_OPERATION:Mutex<()>=Mutex::new(());
static VIEW_STATUS:Mutex<BTreeMap<String,ViewStatus>>=Mutex::new(BTreeMap::new());
static VIEW_INSTANCE:AtomicU64=AtomicU64::new(0);

#[derive(Clone,serde::Serialize)]
struct ViewStatus { service:String, target:String, phase:String, code:Option<i32>, navigation:u64, #[serde(skip)] instance:u64 }
pub fn status()->serde_json::Value { serde_json::json!(VIEW_STATUS.lock().unwrap().values().cloned().collect::<Vec<_>>()) }
fn publish(app:&AppHandle,label:&str,phase:&str,code:Option<i32>,navigation:Option<u64>){
    publish_for(app,label,phase,code,navigation,None)
}
fn publish_for(app:&AppHandle,label:&str,phase:&str,code:Option<i32>,navigation:Option<u64>,instance:Option<u64>){
    let event={let mut states=VIEW_STATUS.lock().unwrap();let Some(state)=states.get_mut(label)else{return;};
        if instance.is_some_and(|id|id!=state.instance){return;}
        if let Some(id)=navigation{if id<state.navigation{return;}state.navigation=id;}
        state.phase=phase.into();state.code=code;state.clone()};
    let _=app.emit("webai:status",event);
}
fn observe_navigation(app:&AppHandle,view:&tauri::Webview,service:&str,target:&str,url:reqwest::Url)->Result<(),String>{
    let label=view.label().to_owned();
    let instance=VIEW_INSTANCE.fetch_add(1,Ordering::SeqCst)+1;
    VIEW_STATUS.lock().unwrap().insert(label.clone(),ViewStatus{service:service.into(),target:target.into(),phase:"loading".into(),code:None,navigation:0,instance});
    publish(app,&label,"loading",None,None);
    let handle=app.clone();
    view.with_webview(move|platform|unsafe{
        let Ok(core)=platform.controller().CoreWebView2()else{publish_for(&handle,&label,"error",Some(-1),None,Some(instance));return;};
        let start_app=handle.clone();let start_label=label.clone();
        let starting=NavigationStartingEventHandler::create(Box::new(move|_,args|{
            if let Some(args)=args{let mut id=0;let _=args.NavigationId(&mut id);publish_for(&start_app,&start_label,"loading",None,Some(id),Some(instance));}Ok(())
        }));
        let completed_app=handle.clone();let completed_label=label.clone();let controller=platform.controller();
        let completed=NavigationCompletedEventHandler::create(Box::new(move|_,args|{
            if let Some(args)=args{
                let mut id=0;let _=args.NavigationId(&mut id);
                let current=VIEW_STATUS.lock().unwrap().get(&completed_label).map(|s|(s.navigation,s.instance));
                if current!=Some((id,instance)){return Ok(());}
                let mut success=windows_core_webview::BOOL(0);let _=args.IsSuccess(&mut success);
                let mut code=COREWEBVIEW2_WEB_ERROR_STATUS(0);let _=args.WebErrorStatus(&mut code);
                let _=controller.SetIsVisible(success.as_bool()&&wants_visible(&completed_label));
                publish_for(&completed_app,&completed_label,if success.as_bool(){"loaded"}else{"error"},if success.as_bool(){None}else{Some(code.0)},Some(id),Some(instance));
            }Ok(())
        }));
        let mut start_token=0;let mut completed_token=0;
        if core.add_NavigationStarting(&starting,&mut start_token).is_err()||core.add_NavigationCompleted(&completed,&mut completed_token).is_err(){publish_for(&handle,&label,"error",Some(-1),None,Some(instance));return;}
        let wide:Vec<u16>=url.as_str().encode_utf16().chain(Some(0)).collect();
        if core.Navigate(windows_core_webview::PCWSTR(wide.as_ptr())).is_err(){publish_for(&handle,&label,"error",Some(-1),None,Some(instance));}
    }).map_err(|e|e.to_string())
}

fn view_url(service:&str)->Result<reqwest::Url,String>{
    let real=service_url(service)?;
    // Only isolated passive acceptance may use a loopback fixture. Normal users
    // always navigate to the whitelisted provider URL.
    if crate::win::WindowManager::passive_qa(){if let Ok(base)=std::env::var("WOODS_ISLAND_WEBAI_TEST_URL"){
        let mut url=reqwest::Url::parse(&base).map_err(|e|e.to_string())?;
        if url.scheme()!="http"||url.host_str()!=Some("127.0.0.1"){return Err("AI test URL must use IPv4 loopback HTTP".into());}
        url.set_path(&format!("/{service}"));return Ok(url);
    }}Ok(real)
}
fn checked_bounds(x:f64,y:f64,width:f64,height:f64)->Result<(),String>{
    if ![x,y,width,height].iter().all(|n|n.is_finite())||x<0.||y<0.||width<=0.||height<=0.{Err("Invalid AI view bounds".into())}else{Ok(())}
}

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
fn show_view(app:&AppHandle,view:&tauri::Webview)->Result<(),String>{
    view_activity(app,view,true)?;
    let loaded=VIEW_STATUS.lock().unwrap().get(view.label()).is_some_and(|s|s.phase=="loaded");
    if loaded {view.show()}else{view.hide()}.map_err(|e|e.to_string())
}
fn hide_pop_views(app:&AppHandle,except:Option<&str>)->Result<(),String>{
    for service in ["chatgpt","openai","claude","gemini","deepseek","grok","qwen"]{if except==Some(service){continue;}
        if let Some(view)=app.get_webview(&format!("web-ai-pop-{service}")){view.hide().map_err(|e|e.to_string())?;view_activity(app,&view,false)?;}
    }Ok(())
}
pub fn hide(app:&AppHandle,word:u64)->Result<(),String>{
    if !accept_word(word){return Ok(());}
    hide_views(app,None)?;
    app.emit("webai:active",false).map_err(|e|e.to_string())
}
pub fn embed(app:&AppHandle,service:&str,x:f64,y:f64,width:f64,height:f64,focus:bool,word:u64)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();
    checked_bounds(x,y,width,height)?;
    let url=view_url(service)?;
    if !accept_word(word){return Ok(());}
    let is_popped=popped().as_deref()==Some(service);
    hide_views(app,if is_popped{None}else{Some(service)})?;
    if is_popped{return Ok(());}
    let label=format!("web-ai-{service}");
    let webview=if let Some(view)=app.get_webview(&label){view}else{
        let window=app.get_window("main").ok_or("Main window is unavailable")?;
        let view=window.add_child(tauri::webview::WebviewBuilder::new(&label,WebviewUrl::External(reqwest::Url::parse("about:blank").unwrap())).focused(false),LogicalPosition::new(x,y),LogicalSize::new(width,height)).map_err(|e|e.to_string())?;
        view.hide().map_err(|e|e.to_string())?;
        observe_navigation(app,&view,service,"embedded",url)?;view
    };
    webview.set_position(LogicalPosition::new(x,y)).map_err(|e|e.to_string())?;
    webview.set_size(LogicalSize::new(width,height)).map_err(|e|e.to_string())?;
    if !accept_word(word){webview.hide().map_err(|e|e.to_string())?;return view_activity(app,&webview,false);}
    show_view(app,&webview)?;
    if focus&&!crate::win::WindowManager::passive_qa(){
        let main=app.get_window("main").ok_or("Main window is unavailable")?;
        let hwnd=main.hwnd().map_err(|e|e.to_string())?;
        crate::win::WindowManager::keyboard_focus(windows::Win32::Foundation::HWND(hwnd.0 as _),true);
        main.set_focus().map_err(|e|e.to_string())?;
        webview.set_focus().map_err(|e|e.to_string())?;
    }
    app.emit("webai:active",true).map_err(|e|e.to_string())
}
pub fn window(app:&AppHandle,service:&str)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();
    service_url(service)?;
    hide_views(app,None)?;
    hide_pop_views(app,Some(service))?;
    if let Some(window)=app.get_window("web-ai-window"){window.show().map_err(|e|e.to_string())?;if !crate::win::WindowManager::passive_qa(){window.set_focus().map_err(|e|e.to_string())?;}}
    else{
        let passive=crate::win::WindowManager::passive_qa();
        let window=tauri::WebviewWindowBuilder::new(app,"web-ai-window",WebviewUrl::App("web-ai.html".into())).title("Woods Island — Web AI").inner_size(960.,760.).min_inner_size(560.,420.).focused(!passive).build().map_err(|e|e.to_string())?;
        if passive{window.set_focusable(false).map_err(|e|e.to_string())?;}
        let handle=app.clone();window.on_window_event(move|event|{if matches!(event,tauri::WindowEvent::Destroyed){
            *POPPED.lock().unwrap()=None;
            VIEW_STATUS.lock().unwrap().retain(|_,s|s.target!="window");
            VISIBLE_VIEWS.lock().unwrap().retain(|label,_|!label.starts_with("web-ai-pop-"));
            let _=handle.emit("webai:popped",Option::<String>::None);
        }});
    }
    *POPPED.lock().unwrap()=Some(service.to_owned());app.emit("webai:popped",service).map_err(|e|e.to_string())
}
pub fn window_attach(app:&AppHandle,service:&str,x:f64,y:f64,width:f64,height:f64)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();checked_bounds(x,y,width,height)?;let url=view_url(service)?;
    if popped().as_deref()!=Some(service){return Ok(());}
    hide_pop_views(app,Some(service))?;
    let label=format!("web-ai-pop-{service}");
    let view=if let Some(view)=app.get_webview(&label){view}else{
        let window=app.get_window("web-ai-window").ok_or("AI window is not open")?;
        let view=window.add_child(tauri::webview::WebviewBuilder::new(&label,WebviewUrl::External(reqwest::Url::parse("about:blank").unwrap())).focused(false),LogicalPosition::new(x,y),LogicalSize::new(width,height)).map_err(|e|e.to_string())?;
        view.hide().map_err(|e|e.to_string())?;observe_navigation(app,&view,service,"window",url)?;view
    };
    view.set_position(LogicalPosition::new(x,y)).map_err(|e|e.to_string())?;view.set_size(LogicalSize::new(width,height)).map_err(|e|e.to_string())?;
    show_view(app,&view)
}
pub fn reload(app:&AppHandle,service:&str,target:&str)->Result<(),String>{
    service_url(service)?;
    let prefix=match target{"embedded"=>"web-ai-","window"=>"web-ai-pop-",_=>return Err("Invalid AI target".into())};
    let label=format!("{prefix}{service}");let view=app.get_webview(&label).ok_or("AI view is not open")?;
    view.hide().map_err(|e|e.to_string())?;publish(app,&label,"loading",None,None);view.reload().map_err(|e|e.to_string())
}
pub fn window_close(app:&AppHandle)->Result<(),String>{if let Some(window)=app.get_window("web-ai-window"){window.close().map_err(|e|e.to_string())?;}*POPPED.lock().unwrap()=None;app.emit("webai:popped",Option::<String>::None).map_err(|e|e.to_string())}
pub fn window_show(app:&AppHandle)->Result<(),String>{let window=app.get_window("web-ai-window").ok_or("AI window is not open")?;window.show().map_err(|e|e.to_string())?;if !crate::win::WindowManager::passive_qa(){window.set_focus().map_err(|e|e.to_string())?;}Ok(())}

#[cfg(test)]mod tests{use super::*;#[test]fn websites_are_whitelisted(){assert!(service_url("claude").is_ok());assert!(service_url("https://attacker.test").is_err());}}
