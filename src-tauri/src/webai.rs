use tauri::{AppHandle, Emitter, Manager, WebviewUrl, PhysicalPosition, PhysicalSize, Rect};
use std::sync::{Mutex,atomic::{AtomicBool,AtomicU64,Ordering},mpsc};
use std::collections::BTreeMap;
use webview2_com::{Microsoft::Web::WebView2::Win32::{ICoreWebView2_3, COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC, COREWEBVIEW2_WEB_ERROR_STATUS}, TrySuspendCompletedHandler, NavigationStartingEventHandler, NavigationCompletedEventHandler};
use windows_core_webview::Interface;
pub mod permissions;
static POPPED:Mutex<Option<String>>=Mutex::new(None);
static LAST_WORD:AtomicU64=AtomicU64::new(0);
static VISIBLE_VIEWS:Mutex<BTreeMap<String,bool>>=Mutex::new(BTreeMap::new());
static EMBEDDED_ACTIVE:AtomicBool=AtomicBool::new(false);
static WINDOW_OPERATION:Mutex<()>=Mutex::new(());

pub fn is_embedded_active()->bool{EMBEDDED_ACTIVE.load(Ordering::Relaxed)}

fn focus_webview_controller(view:&tauri::Webview){
    let _=view.with_webview(|platform|unsafe{
        let _=platform.controller().MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
    });
}
static VIEW_STATUS:Mutex<BTreeMap<String,ViewStatus>>=Mutex::new(BTreeMap::new());
static VIEW_INSTANCE:AtomicU64=AtomicU64::new(0);
static WINDOW_PRESENTED:AtomicBool=AtomicBool::new(false);
static WINDOW_READY:Mutex<Option<(String,mpsc::Sender<Result<(),String>>)>>=Mutex::new(None);
static WINDOW_REQUEST:AtomicU64=AtomicU64::new(0);
static WINDOW_EPOCH:AtomicU64=AtomicU64::new(0);
const PROVIDER_SURFACE:&str=include_str!("../../runtime/web-ai/provider-surface.js");

fn surface_script(app:&AppHandle,target:&str)->String{
    let theme=app.state::<std::sync::Arc<crate::AppState>>().settings.lock().unwrap()["theme"].as_str().unwrap_or("dark").to_owned();
    format!("{}\nwindow.__woodsWebAiSurface?.apply({});",PROVIDER_SURFACE,serde_json::json!({"embedded":target=="embedded","theme":theme}))
}
fn apply_surface(app:&AppHandle,view:&tauri::Webview,target:&str)->Result<(),String>{
    use windows::Win32::{Foundation::RECT,Graphics::Gdi::{CreateRectRgn,CreateRoundRectRgn,CombineRgn,DeleteObject,GetWindowRgn,PtInRegion,SetWindowRgn,RGN_OR},UI::WindowsAndMessaging::{GetClientRect,GetWindowRect,GetParent}};
    use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2_13,COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK,COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT};
    let settings=app.state::<std::sync::Arc<crate::AppState>>().settings.lock().unwrap().clone();
    let light=settings["theme"].as_str()==Some("light");
    let scale=if target=="embedded"{settings["scale"].as_f64().unwrap_or(100.)/100.}else{1.};
    // The separate shell has a 20px frame and a 1px border. Only its bottom
    // content corners are rounded; the top must meet the browser toolbar.
    let radius=((if target=="embedded"{12.}else{19.})*scale*view.window().scale_factor().map_err(|e|e.to_string())?).round().max(1.) as i32;
    let embedded=target=="embedded";
    let label=view.label().to_owned();
    let parent=view.window().hwnd().map_err(|e|e.to_string())?.0 as isize;
    view.eval(&surface_script(app,target)).map_err(|e|e.to_string())?;
    view.with_webview(move|platform|unsafe{
        let controller=platform.controller();
        if let Ok(core)=controller.CoreWebView2(){if let Ok(core)=core.cast::<ICoreWebView2_13>(){if let Ok(profile)=core.Profile(){let _=profile.SetPreferredColorScheme(if light{COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT}else{COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK});}}}
        let mut host=Default::default();
        if controller.ParentWindow(&mut host).is_err()||host.0 as isize==parent{return;}
        let hwnd=windows::Win32::Foundation::HWND(host.0 as _);
        let mut rect=RECT::default();
        if GetClientRect(hwnd,&mut rect).is_err()||rect.right<=0||rect.bottom<=0{return;}
        let mut screen=RECT::default();
        let mut controller_bounds=Default::default();
        if GetWindowRect(hwnd,&mut screen).is_err()||controller.Bounds(&mut controller_bounds).is_err(){return;}
        let region=CreateRoundRectRgn(0,0,rect.right+1,rect.bottom+1,radius*2,radius*2);
        if !region.is_invalid(){
            if !embedded{
                let top=CreateRectRgn(0,0,rect.right+1,(radius+1).min(rect.bottom));
                if top.is_invalid(){let _=DeleteObject(region);return;}
                let combined=CombineRgn(region,region,top,RGN_OR);let _=DeleteObject(top);
                if combined.0==0{let _=DeleteObject(region);return;}
            }
            if SetWindowRgn(hwnd,region,true)==0{let _=DeleteObject(region);}
        }
        let actual=CreateRectRgn(0,0,0,0);
        let has_region=GetWindowRgn(hwnd,actual).0>0;
        let proof=SurfaceProof{theme:if light{"light"}else{"dark"}.into(),corner_radius:radius,width:rect.right,height:rect.bottom,
            hwnd:host.0 as isize,screen:[screen.left,screen.top,screen.right-screen.left,screen.bottom-screen.top],parent_matches:GetParent(hwnd).is_ok_and(|actual|actual.0 as isize==parent),controller_bounds:[controller_bounds.left,controller_bounds.top,controller_bounds.right,controller_bounds.bottom],
            corner_cut:has_region&&!PtInRegion(actual,0,0).as_bool(),bottom_corner_cut:has_region&&!PtInRegion(actual,0,rect.bottom-1).as_bool(),center_included:!has_region||PtInRegion(actual,rect.right/2,rect.bottom/2).as_bool()};
        let _=DeleteObject(actual);
        if let Some(state)=VIEW_STATUS.lock().unwrap().get_mut(&label){if (state.target=="embedded")==embedded{state.surface=Some(proof);}}
    }).map_err(|e|e.to_string())
}
pub fn refresh_surfaces(app:&AppHandle){
    let states=VIEW_STATUS.lock().unwrap().values().map(|s|(s.service.clone(),s.target.clone())).collect::<Vec<_>>();
    for (service,target) in states{if let Some(view)=app.get_webview(&format!("web-ai-{service}")){let _=apply_surface(app,&view,&target);}}
}

#[derive(Clone,serde::Serialize)]
struct SurfaceProof { theme:String,corner_radius:i32,width:i32,height:i32,corner_cut:bool,bottom_corner_cut:bool,center_included:bool,hwnd:isize,screen:[i32;4],parent_matches:bool,controller_bounds:[i32;4] }
#[derive(Clone,serde::Serialize)]
struct ViewStatus { service:String, target:String, phase:String, code:Option<i32>, navigation:u64, #[serde(skip)] instance:u64, #[serde(skip)] revealed_navigation:Option<u64>, #[serde(skip_serializing_if="Option::is_none")] surface:Option<SurfaceProof> }
pub fn status()->serde_json::Value { serde_json::json!(VIEW_STATUS.lock().unwrap().values().cloned().collect::<Vec<_>>()) }
// Surface application is asynchronous. Its cached proof may describe an earlier
// size or parent, so acceptance reads current controller/HWND data on the UI thread.
pub async fn status_live(app:&AppHandle)->serde_json::Value{
    use windows::Win32::{Foundation::RECT,Graphics::Gdi::{CreateRectRgn,DeleteObject,GetWindowRgn,PtInRegion},UI::WindowsAndMessaging::{GetClientRect,GetWindowRect,GetParent}};
    let settings=app.state::<std::sync::Arc<crate::AppState>>().settings.lock().unwrap().clone();
    let mut states=VIEW_STATUS.lock().unwrap().values().cloned().collect::<Vec<_>>();
    for state in &mut states{
        let Some(view)=app.get_webview(&format!("web-ai-{}",state.service))else{continue;};
        let Ok(parent)=view.window().hwnd().map(|hwnd|hwnd.0 as isize)else{continue;};
        let factor=view.window().scale_factor().unwrap_or(1.)*if state.target=="embedded"{settings["scale"].as_f64().unwrap_or(100.)/100.}else{1.};
        let radius=((if state.target=="embedded"{12.}else{19.})*factor).round().max(1.) as i32;
        let theme=if settings["theme"].as_str()==Some("light"){"light"}else{"dark"}.to_owned();
        let (sender,receiver)=mpsc::channel();
        if view.with_webview(move|platform|unsafe{
            let controller=platform.controller();let mut host=Default::default();
            if controller.ParentWindow(&mut host).is_err()||host.0 as isize==parent{let _=sender.send(None);return;}
            let hwnd=windows::Win32::Foundation::HWND(host.0 as _);
            let mut rect=RECT::default();let mut screen=RECT::default();let mut bounds=Default::default();
            if GetClientRect(hwnd,&mut rect).is_err()||GetWindowRect(hwnd,&mut screen).is_err()||controller.Bounds(&mut bounds).is_err(){let _=sender.send(None);return;}
            let region=CreateRectRgn(0,0,0,0);let has_region=GetWindowRgn(hwnd,region).0>0;
            let proof=SurfaceProof{theme,corner_radius:radius,width:rect.right,height:rect.bottom,hwnd:host.0 as isize,
                screen:[screen.left,screen.top,screen.right-screen.left,screen.bottom-screen.top],parent_matches:GetParent(hwnd).is_ok_and(|actual|actual.0 as isize==parent),controller_bounds:[bounds.left,bounds.top,bounds.right,bounds.bottom],
                corner_cut:has_region&&!PtInRegion(region,0,0).as_bool(),bottom_corner_cut:has_region&&!PtInRegion(region,0,rect.bottom-1).as_bool(),center_included:!has_region||PtInRegion(region,rect.right/2,rect.bottom/2).as_bool()};
            let _=DeleteObject(region);let _=sender.send(Some(proof));
        }).is_err(){continue;}
        if let Ok(Ok(Some(proof)))=tauri::async_runtime::spawn_blocking(move||receiver.recv_timeout(std::time::Duration::from_secs(2))).await{state.surface=Some(proof);}
    }
    serde_json::json!(states)
}
fn publish(app:&AppHandle,label:&str,phase:&str,code:Option<i32>,navigation:Option<u64>){
    publish_for(app,label,phase,code,navigation,None)
}
fn publish_for(app:&AppHandle,label:&str,phase:&str,code:Option<i32>,navigation:Option<u64>,instance:Option<u64>){
    let event={let mut states=VIEW_STATUS.lock().unwrap();let Some(state)=states.get_mut(label)else{return;};
        if instance.is_some_and(|id|id!=state.instance){return;}
        if let Some(id)=navigation{if id<state.navigation{return;}state.navigation=id;}
        state.phase=phase.into();state.code=code;if phase!="loaded"{state.revealed_navigation=None;}state.clone()};
    let _=app.emit("webai:status",event);
}
fn observe_navigation(app:&AppHandle,view:&tauri::Webview,service:&str,target:&str,url:reqwest::Url)->Result<(),String>{
    let label=view.label().to_owned();
    let instance=VIEW_INSTANCE.fetch_add(1,Ordering::SeqCst)+1;
    VIEW_STATUS.lock().unwrap().insert(label.clone(),ViewStatus{service:service.into(),target:target.into(),phase:"loading".into(),code:None,navigation:0,instance,revealed_navigation:None,surface:None});
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
                let current=VIEW_STATUS.lock().unwrap().get(&completed_label).map(|s|(s.navigation,s.instance,s.target.clone(),s.revealed_navigation));
                if !current.as_ref().is_some_and(|(navigation,current_instance,_,_)|*navigation==id&&*current_instance==instance){return Ok(());}
                let mut success=windows_core_webview::BOOL(0);let _=args.IsSuccess(&mut success);
                let mut code=COREWEBVIEW2_WEB_ERROR_STATUS(0);let _=args.WebErrorStatus(&mut code);
                // The local shell fades out before revealing a loaded window page.
                // Embedded pages keep their existing immediate presentation.
                let can_present=current.as_ref().is_some_and(|(_,_,target,revealed)|target!="window"||*revealed==Some(id));
                if success.as_bool(){if let Some((_,_,target,_))=current.as_ref(){if let Some(view)=completed_app.get_webview(&completed_label){let _=apply_surface(&completed_app,&view,target);}}}
                let _=controller.SetIsVisible(success.as_bool()&&can_present&&wants_visible(&completed_label));
                publish_for(&completed_app,&completed_label,if success.as_bool(){"loaded"}else{"error"},if success.as_bool(){None}else{Some(code.0)},Some(id),Some(instance));
                // Controller visibility alone cannot reveal a child HWND that
                // was hidden while loading or reparenting.
                if let Some(view)=completed_app.get_webview(&completed_label){
                    let reveal = success.as_bool()&&can_present&&wants_visible(&completed_label);
                    let _=if reveal{view.show()}else{view.hide()};
                    if reveal && !crate::win::WindowManager::passive_qa() {
                        if let Ok(parent_hwnd) = view.window().hwnd() {
                            let fg = windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow();
                            if fg.0 as isize == parent_hwnd.0 as isize {
                                let _ = controller.MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
                            }
                        }
                    }
                }
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

// DOM bounds are CSS pixels. The island WebView has its own UI zoom on top
// of monitor DPI; the separate shell uses only monitor DPI. Pass the entire
// physical rectangle so Wry never reads coordinates from the previous parent
// between set_position and set_size after reparenting a child WebView.
fn css_bounds(window:&tauri::Window,x:f64,y:f64,width:f64,height:f64)->Result<Rect,String>{
    checked_bounds(x,y,width,height)?;
    let factor=if window.label()=="main"{
        crate::win::WindowManager::effective_scale(windows::Win32::Foundation::HWND(window.hwnd().map_err(|e|e.to_string())?.0 as _))
    }else{window.scale_factor().map_err(|e|e.to_string())?};
    let values=[x,y,width,height].map(|value|(value*factor).round());
    if values.iter().any(|value|!value.is_finite()||*value>i32::MAX as f64){return Err("AI view bounds exceed native coordinates".into());}
    Ok(Rect{position:PhysicalPosition::new(values[0] as i32,values[1] as i32).into(),size:PhysicalSize::new(values[2].max(1.) as u32,values[3].max(1.) as u32).into()})
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
    for service in ["chatgpt","openai","claude","gemini","deepseek","grok","qwen"]{if except==Some(service){continue;}if let Some(webview)=app.get_webview(&format!("web-ai-{service}")){if webview.window().label()!="main"{continue;}webview.hide().map_err(|e|e.to_string())?;view_activity(app,&webview,false)?;}}
    Ok(())
}
fn show_view(app:&AppHandle,view:&tauri::Webview)->Result<(),String>{
    view_activity(app,view,true)?;
    let loaded=VIEW_STATUS.lock().unwrap().get(view.label()).is_some_and(|s|s.phase=="loaded"&&(s.target!="window"||s.revealed_navigation==Some(s.navigation)));
    if loaded {view.show()}else{view.hide()}.map_err(|e|e.to_string())
}
fn hide_pop_views(app:&AppHandle,except:Option<&str>)->Result<(),String>{
    for service in ["chatgpt","openai","claude","gemini","deepseek","grok","qwen"]{if except==Some(service){continue;}
        if let Some(view)=app.get_webview(&format!("web-ai-{service}")){if view.window().label()!="web-ai-window"{continue;}view.hide().map_err(|e|e.to_string())?;view_activity(app,&view,false)?;}
    }Ok(())
}
pub fn hide(app:&AppHandle,word:u64)->Result<(),String>{
    if !accept_word(word){return Ok(());}
    EMBEDDED_ACTIVE.store(false,Ordering::SeqCst);
    hide_views(app,None)?;
    if let Some(main)=app.get_window("main"){
        if let Ok(hwnd)=main.hwnd(){
            crate::win::WindowManager::set_activatable(windows::Win32::Foundation::HWND(hwnd.0 as _),false);
        }
    }
    app.emit("webai:active",false).map_err(|e|e.to_string())
}
pub fn embed(app:&AppHandle,service:&str,x:f64,y:f64,width:f64,height:f64,focus:bool,word:u64)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();
    checked_bounds(x,y,width,height)?;
    let url=view_url(service)?;
    if !accept_word(word){return Ok(());}
    let is_popped=popped().as_deref()==Some(service);
    hide_views(app,if is_popped{None}else{Some(service)})?;
    if is_popped{
        EMBEDDED_ACTIVE.store(false,Ordering::SeqCst);
        if let Some(main)=app.get_window("main"){if let Ok(hwnd)=main.hwnd(){crate::win::WindowManager::set_activatable(windows::Win32::Foundation::HWND(hwnd.0 as _),false);}}
        return Ok(());
    }
    let main=app.get_window("main").ok_or("Main window is unavailable")?;
    let bounds=css_bounds(&main,x,y,width,height)?;
    let label=format!("web-ai-{service}");
    let webview=if let Some(view)=app.get_webview(&label){
        let main=app.get_window("main").ok_or("Main window is unavailable")?;
        retarget(app,&view,&main,"embedded")?;view
    }else{
        let window=app.get_window("main").ok_or("Main window is unavailable")?;
        let view=window.add_child(tauri::webview::WebviewBuilder::new(&label,WebviewUrl::External(reqwest::Url::parse("about:blank").unwrap())).initialization_script(surface_script(app,"embedded")).focused(false),bounds.position,bounds.size).map_err(|e|e.to_string())?;
        view.hide().map_err(|e|e.to_string())?;
        observe_navigation(app,&view,service,"embedded",url)?;view
    };
    webview.set_bounds(bounds).map_err(|e|e.to_string())?;
    apply_surface(app,&webview,"embedded")?;
    if !accept_word(word){webview.hide().map_err(|e|e.to_string())?;return view_activity(app,&webview,false);}
    show_view(app,&webview)?;
    EMBEDDED_ACTIVE.store(true,Ordering::SeqCst);
    if !crate::win::WindowManager::passive_qa(){
        let main=app.get_window("main").ok_or("Main window is unavailable")?;
        let hwnd=main.hwnd().map_err(|e|e.to_string())?;
        let raw_hwnd=windows::Win32::Foundation::HWND(hwnd.0 as _);
        // Allow clicking inside the embedded child WebView2 to activate the
        // parent island window so keyboard input works reliably even when the
        // chat tab was opened via mouse click (focus == false).
        crate::win::WindowManager::set_activatable(raw_hwnd,true);
        if focus {
            crate::win::WindowManager::keyboard_focus(raw_hwnd,true);
            main.set_focus().map_err(|e|e.to_string())?;
            webview.set_focus().map_err(|e|e.to_string())?;
            focus_webview_controller(&webview);
        }
    }
    app.emit("webai:active",true).map_err(|e|e.to_string())
}
fn retarget(app:&AppHandle,view:&tauri::Webview,window:&tauri::Window,target:&str)->Result<(),String>{
    if view.window().label()==window.label()&&VIEW_STATUS.lock().unwrap().get(view.label()).is_some_and(|s|s.target==target){return Ok(());}
    if view.window().label()!=window.label(){
        let previous=view.window();
        view.hide().map_err(|e|e.to_string())?;
        if let Err(error)=view.reparent(window){let _=view.reparent(&previous);let _=show_view(app,view);return Err(error.to_string());}
    }
    let state={let mut states=VIEW_STATUS.lock().unwrap();let Some(state)=states.get_mut(view.label())else{return Err("AI view status unavailable".into());};state.target=target.into();state.revealed_navigation=None;state.clone()};
    app.emit("webai:status",state).map_err(|e|e.to_string())
}
fn reduced_motion(app:&AppHandle)->bool{
    let preference=app.state::<std::sync::Arc<crate::AppState>>().settings.lock().unwrap()["reducedMotion"].as_str().unwrap_or("auto").to_owned();
    if preference=="reduce"{return true;}if preference=="full"{return false;}
    let mut enabled=windows::Win32::Foundation::BOOL(1);
    unsafe{let _=windows::Win32::UI::WindowsAndMessaging::SystemParametersInfoW(windows::Win32::UI::WindowsAndMessaging::SPI_GETCLIENTAREAANIMATION,0,Some((&mut enabled as *mut windows::Win32::Foundation::BOOL).cast()),windows::Win32::UI::WindowsAndMessaging::SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0));}
    !enabled.as_bool()
}
fn alpha_at(progress:f64,show:bool)->u8{
    let p=progress.clamp(0.,1.);let ease=p*p*(3.-2.*p);
    ((if show{ease}else{1.-ease})*255.).round() as u8
}
fn fade_window(app:&AppHandle,window:&tauri::Window,service:&str,show:bool,reduce:bool)->Result<(),String>{
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowLongPtrW,SetWindowLongPtrW,SetLayeredWindowAttributes,GetLayeredWindowAttributes,GWL_EXSTYLE,WS_EX_LAYERED,LWA_ALPHA};
    let passive=crate::win::WindowManager::passive_qa();
    let target=if show{"window"}else{"pill"};
    let duration=if reduce{0}else{200};
    let _=app.emit("webai:transition",serde_json::json!({"service":service,"target":target,"phase":"begin","duration":duration,"passive":passive}));
    if reduce{
        if !passive{if show{window.show()}else{window.hide()}.map_err(|e|e.to_string())?;}
        let _=app.emit("webai:transition",serde_json::json!({"service":service,"target":target,"phase":"end","duration":0,"passive":passive}));return Ok(());
    }
    let raw=window.hwnd().map_err(|e|e.to_string())?;let hwnd=windows::Win32::Foundation::HWND(raw.0 as _);
    let original=unsafe{GetWindowLongPtrW(hwnd,GWL_EXSTYLE)};
    unsafe{SetWindowLongPtrW(hwnd,GWL_EXSTYLE,original|WS_EX_LAYERED.0 as isize);}
    let result:Result<(),String>=(||{
        unsafe{SetLayeredWindowAttributes(hwnd,windows::Win32::Foundation::COLORREF(0),if show{0}else{255},LWA_ALPHA).map_err(|e|e.to_string())?;}
        if show&&!passive{window.show().map_err(|e|e.to_string())?;}
        let start=std::time::Instant::now();
        loop{
            let elapsed=start.elapsed().as_secs_f64()*1000.;let alpha=alpha_at(elapsed/duration as f64,show);
            let mut measured=0;
            unsafe{SetLayeredWindowAttributes(hwnd,windows::Win32::Foundation::COLORREF(0),alpha,LWA_ALPHA).map_err(|e|e.to_string())?;GetLayeredWindowAttributes(hwnd,None,Some(&mut measured),None).map_err(|e|e.to_string())?;}
            if passive{let _=app.emit("webai:transition",serde_json::json!({"service":service,"target":target,"phase":"frame","ms":elapsed,"alpha":measured,"passive":true}));}
            if elapsed>=duration as f64{break;}
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
        if !show{window.hide().map_err(|e|e.to_string())?;}Ok(())
    })();
    // Always restore opacity and only the layered bit we introduced, even when
    // the window closes during the animation. Other native style changes remain.
    unsafe{let _=SetLayeredWindowAttributes(hwnd,windows::Win32::Foundation::COLORREF(0),255,LWA_ALPHA);if original&WS_EX_LAYERED.0 as isize==0{let now=GetWindowLongPtrW(hwnd,GWL_EXSTYLE);SetWindowLongPtrW(hwnd,GWL_EXSTYLE,now&!(WS_EX_LAYERED.0 as isize));}}
    if result.is_err(){
        let _=app.emit("webai:transition",serde_json::json!({"service":service,"target":target,"phase":"fallback","duration":0,"passive":passive}));
        if !passive{if show{window.show()}else{window.hide()}.map_err(|e|e.to_string())?;}
        return Ok(());
    }
    let _=app.emit("webai:transition",serde_json::json!({"service":service,"target":target,"phase":"end","duration":duration,"passive":passive}));result
}
pub fn window(app:&AppHandle,service:&str)->Result<(),String>{
    service_url(service)?;
    if WINDOW_PRESENTED.load(Ordering::SeqCst)&&popped().as_deref()==Some(service){return window_show(app);}
    let operation=WINDOW_OPERATION.lock().unwrap();
    let request=WINDOW_REQUEST.fetch_add(1,Ordering::SeqCst)+1;
    EMBEDDED_ACTIVE.store(false,Ordering::SeqCst);
    hide_views(app,None)?;hide_pop_views(app,Some(service))?;
    if let Some(main)=app.get_window("main"){if let Ok(hwnd)=main.hwnd(){crate::win::WindowManager::set_activatable(windows::Win32::Foundation::HWND(hwnd.0 as _),false);}}
    let (sender,receiver)=mpsc::channel();
    if let Some((_,old))=WINDOW_READY.lock().unwrap().replace((service.into(),sender)){let _=old.send(Err("AI window request superseded".into()));}
    *POPPED.lock().unwrap()=Some(service.into());
    let prepared:Result<(),String>=(||{if app.get_window("web-ai-window").is_none(){
        let built=tauri::WebviewWindowBuilder::new(app,"web-ai-window",WebviewUrl::App("web-ai.html".into())).title("Woods Island — AI").inner_size(960.,760.).min_inner_size(560.,420.).visible(false).focused(false).build();
        let window=built.map_err(|e|e.to_string())?;
        if crate::win::WindowManager::passive_qa(){window.set_focusable(false).map_err(|e|e.to_string())?;}
        let epoch=WINDOW_EPOCH.fetch_add(1,Ordering::SeqCst)+1;
        let handle=app.clone();window.on_window_event(move|event|match event{
            tauri::WindowEvent::CloseRequested{api,..}=>{api.prevent_close();let app=handle.clone();tauri::async_runtime::spawn_blocking(move||{let _=window_close(&app,false);});}
            tauri::WindowEvent::Destroyed=>{
                if WINDOW_EPOCH.load(Ordering::SeqCst)!=epoch{return;}
                WINDOW_PRESENTED.store(false,Ordering::SeqCst);*POPPED.lock().unwrap()=None;
                if let Some((_,sender))=WINDOW_READY.lock().unwrap().take(){let _=sender.send(Err("AI window closed".into()));}
                VIEW_STATUS.lock().unwrap().retain(|_,state|state.target!="window");
                let _=handle.emit("webai:popped",Option::<String>::None);
            },_=>{}
        });
    }
    app.emit("webai:window-service",service).map_err(|e|e.to_string())})();
    drop(operation);
    let result=prepared.and_then(|_|match receiver.recv_timeout(std::time::Duration::from_secs(8)){
        Ok(result)=>result,Err(_)=>Err("AI window did not finish preparing. Please try again.".into())
    });
    if result.is_err()&&WINDOW_REQUEST.load(Ordering::SeqCst)==request{
        let _=window_close(app,false);let _=open(app,Some(service));
    }
    result
}
pub fn window_attach(app:&AppHandle,service:&str,x:f64,y:f64,width:f64,height:f64)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();checked_bounds(x,y,width,height)?;let url=view_url(service)?;
    if popped().as_deref()!=Some(service){return Ok(());}
    hide_pop_views(app,Some(service))?;
    let window=app.get_window("web-ai-window").ok_or("AI window is not open")?;
    let bounds=css_bounds(&window,x,y,width,height)?;
    let label=format!("web-ai-{service}");
    let view=if let Some(view)=app.get_webview(&label){retarget(app,&view,&window,"window")?;view}else{
        let view=window.add_child(tauri::webview::WebviewBuilder::new(&label,WebviewUrl::External(reqwest::Url::parse("about:blank").unwrap())).initialization_script(surface_script(app,"window")).focused(false),bounds.position,bounds.size).map_err(|e|e.to_string())?;
        view.hide().map_err(|e|e.to_string())?;observe_navigation(app,&view,service,"window",url)?;view
    };
    view.set_bounds(bounds).map_err(|e|e.to_string())?;apply_surface(app,&view,"window")?;show_view(app,&view)
}
pub fn window_present(app:&AppHandle,service:&str)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();
    if popped().as_deref()!=Some(service){return Err("AI service changed before presentation".into());}
    let window=app.get_window("web-ai-window").ok_or("AI window is not open")?;
    let result=(||{
        if !WINDOW_PRESENTED.load(Ordering::SeqCst){fade_window(app,&window,service,true,reduced_motion(app))?;WINDOW_PRESENTED.store(true,Ordering::SeqCst);}
        if !crate::win::WindowManager::passive_qa(){window.set_focus().map_err(|e|e.to_string())?;if let Some(view)=app.get_webview(&format!("web-ai-{service}")){let _=view.set_focus();}}
        app.emit("webai:popped",service).map_err(|e|e.to_string())
    })();
    let pending={let mut ready=WINDOW_READY.lock().unwrap();if ready.as_ref().is_some_and(|(s,_)|s==service){ready.take()}else{None}};
    if let Some((_,sender))=pending{let _=sender.send(result.clone());}result
}
pub fn window_reveal(app:&AppHandle,service:&str,navigation:u64)->Result<bool,String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();service_url(service)?;
    if popped().as_deref()!=Some(service){return Ok(false);}
    let label=format!("web-ai-{service}");
    let Some(view)=app.get_webview(&label)else{return Ok(false);};
    if view.window().label()!="web-ai-window"{return Ok(false);}
    let instance=VIEW_STATUS.lock().unwrap().get(&label).map(|state|state.instance);
    let (sender,receiver)=mpsc::channel();
    let reveal_view=view.clone();
    view.with_webview(move|platform|unsafe{
        let allow={let mut states=VIEW_STATUS.lock().unwrap();states.get_mut(&label).is_some_and(|state|{
            if Some(state.instance)==instance&&state.target=="window"&&state.phase=="loaded"&&state.navigation==navigation&&wants_visible(&label){state.revealed_navigation=Some(navigation);true}else{false}
        })};
        let result=if allow{platform.controller().SetIsVisible(true).map_err(|error|error.to_string()).and_then(|_|reveal_view.show().map(|_|true).map_err(|error|error.to_string()))}else{Ok(false)};
        let _=sender.send(result);
    }).map_err(|error|error.to_string())?;
    receiver.recv_timeout(std::time::Duration::from_secs(2)).map_err(|_|"AI page presentation timed out".to_owned())?
}
pub fn reload(app:&AppHandle,service:&str,target:&str)->Result<(),String>{
    service_url(service)?;if !["embedded","window"].contains(&target){return Err("Invalid AI target".into());}
    let label=format!("web-ai-{service}");let view=app.get_webview(&label).ok_or("AI view is not open")?;
    let expected=if target=="window"{"web-ai-window"}else{"main"};if view.window().label()!=expected{return Err("AI view is in another window".into());}
    view.hide().map_err(|e|e.to_string())?;publish(app,&label,"loading",None,None);view.reload().map_err(|e|e.to_string())
}
pub fn window_close(app:&AppHandle,return_to_pill:bool)->Result<(),String>{
    let _operation=WINDOW_OPERATION.lock().unwrap();let service=popped();
    WINDOW_REQUEST.fetch_add(1,Ordering::SeqCst);
    if let Some(window)=app.get_window("web-ai-window"){
        if WINDOW_PRESENTED.load(Ordering::SeqCst){fade_window(app,&window,service.as_deref().unwrap_or("gemini"),false,reduced_motion(app))?;}
        let moved:Result<(),String>=(||{let main=app.get_window("main").ok_or("Main window is unavailable")?;
        for id in ["chatgpt","openai","claude","gemini","deepseek","grok","qwen"]{
            if let Some(view)=app.get_webview(&format!("web-ai-{id}")){if view.window().label()=="web-ai-window"{view.hide().map_err(|e|e.to_string())?;view_activity(app,&view,false)?;retarget(app,&view,&main,"embedded")?;}}
        }
        window.destroy().map_err(|e|e.to_string())})();
        if let Err(error)=moved{
            if let Some(service)=service.as_deref(){if let Some(view)=app.get_webview(&format!("web-ai-{service}")){let _=retarget(app,&view,&window,"window");let _=show_view(app,&view);}}
            let _=fade_window(app,&window,service.as_deref().unwrap_or("gemini"),true,reduced_motion(app));
            return Err(error);
        }
    }
    WINDOW_PRESENTED.store(false,Ordering::SeqCst);*POPPED.lock().unwrap()=None;
    if let Some((_,sender))=WINDOW_READY.lock().unwrap().take(){let _=sender.send(Err("AI window closed".into()));}
    app.emit("webai:popped",Option::<String>::None).map_err(|e|e.to_string())?;
    if return_to_pill{if let Some(service)=service{open(app,Some(&service))?;}}Ok(())
}
pub fn window_show(app:&AppHandle)->Result<(),String>{
    let window=app.get_window("web-ai-window").ok_or("AI window is not open")?;
    if !crate::win::WindowManager::passive_qa(){window.show().map_err(|e|e.to_string())?;window.set_focus().map_err(|e|e.to_string())?;}Ok(())
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn websites_are_whitelisted(){assert!(service_url("claude").is_ok());assert!(service_url("https://attacker.test").is_err());}
    #[test]fn fade_has_exact_endpoints_and_monotonic_alpha(){
        assert_eq!(alpha_at(-1.,true),0);assert_eq!(alpha_at(2.,true),255);
        assert_eq!(alpha_at(0.,false),255);assert_eq!(alpha_at(1.,false),0);
        let mut previous=0;
        for frame in 0..=200{let alpha=alpha_at(frame as f64/200.,true);assert!(alpha>=previous);assert!((alpha_at(frame as f64/200.,false) as i16-(255-alpha) as i16).abs()<=1);previous=alpha;}
    }
}
