pub mod audio;
pub mod speech;
pub mod recorder;
pub mod agents;
pub mod documents;
pub mod network;
pub mod webai;
pub mod notifications;
pub mod telemetry;
pub mod steam;
pub mod notes;
pub mod ai;
pub mod capture;
pub mod system;
pub mod clipboard;
pub mod media;
pub mod lyrics;
pub mod music_bridge;
pub mod obs;
pub mod storage;
pub mod weather;
pub mod win;

use clipboard::ClipboardStore;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::HWND;

static AUX_WINDOW_BUILD: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn ensure_aux_window(app: &AppHandle, label: &str) -> Result<tauri::WebviewWindow, String> {
    let _build = AUX_WINDOW_BUILD.lock().map_err(|_| "Window creation lock poisoned")?;
    if let Some(window) = app.get_webview_window(label) { return Ok(window); }
    let config = app.config().app.windows.iter().find(|config| config.label == label).ok_or("Window configuration unavailable")?;
    let window = tauri::WebviewWindowBuilder::from_config(app, config).map_err(|e|e.to_string())?.build().map_err(|e|e.to_string())?;
    if win::WindowManager::passive_qa() { window.set_focusable(false).map_err(|e|e.to_string())?; }
    // Auxiliary windows close normally, releasing their renderer. Reopening creates
    // them from the same configuration; persisted settings and the image source remain native.
    Ok(window)
}

#[derive(Clone, Copy, Debug)]
pub struct IslandRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub expanded: bool,
}

pub struct AppState {
    pub is_expanded: AtomicBool,
    pub is_tall: AtomicBool,
    pub click_through: AtomicBool,
    pub clipboard_store: ClipboardStore,
    pub settings: std::sync::Mutex<Value>,
    pub settings_target: std::sync::Mutex<Option<String>>,
    pub hotkey_errors: std::sync::Mutex<Vec<String>>,
    pub island_rect: std::sync::Mutex<IslandRect>,
    pub main_hwnd: std::sync::Mutex<Option<isize>>,
    pub controls: std::sync::Mutex<Value>,
    pub launcher_groups: std::sync::Mutex<String>,
    pub launcher_hotkeys: std::sync::Mutex<String>,
    pub timer_data: std::sync::Mutex<String>,
    pub reminders_data: std::sync::Mutex<String>,
    pub note_data: std::sync::Mutex<String>,
    pub note_folders_data: std::sync::Mutex<String>,
    pub chat_data: std::sync::Mutex<String>,
    pub shelf_items: std::sync::Mutex<Vec<Value>>,
    pub launcher_items: std::sync::Mutex<Vec<Value>>,
}

fn default_settings() -> Value {
    serde_json::from_str(r###"{
    "autostart": true,
    "hoverDelayMs": 150,
    "openOnHover": false,
    "collapseDelayMs": 350,
    "style": "notch",
    "hideInFullscreen": true,
    "captureVisible": false,
    "autoHide": false,
    "showOnDesktop": false,
    "through": false,
    "opacityThrough": 45,
    "offsetX": 0,
    "underTaskbar": true,
    "monitor": "",
    "liquidSpectrum": false,
    "opacityRest": 100,
    "opacityOpen": 100,
    "scale": 100,
    "theme": "dark",
    "islandColor": "",
    "shotDraw": false,
    "showClock": true,
    "clockSeconds": false,
    "clockFormat": "auto",
    "showBattery": true,
    "mediaPill": "normal",
    "lyrics": false,
    "lyricsInPlayer": true,
    "lyricsInHome": true,
    "homePlayer": "soft",
    "alertSound": "",
    "downloadsInPill": "full",
    "gpuAcceleration": true,
    "pasteOnClick": true,
    "hotkeyToggle": "Ctrl+Alt+I",
    "hotkeyArea": "Ctrl+Alt+S",
    "hotkeyScreen": "Ctrl+Alt+Shift+S",
    "hotkeyOcr": "Ctrl+Alt+O",
    "hotkeyClipboard": "Ctrl+Alt+V",
    "hotkeyPlainPaste": "Ctrl+Alt+Shift+V",
    "hotkeyMic": "Ctrl+Alt+M",
    "hotkeyColor": "Ctrl+Alt+C",
    "hotkeyQr": "Ctrl+Alt+Q",
    "hotkeyPalette": "Alt+Space",
    "hotkeyRecord": "Ctrl+Alt+R",
    "hotkeyChat": "Ctrl+Alt+A",
    "hotkeyDictate": "Ctrl+Alt+D",
    "hotkeyThrough": "",
    "hotkeyVpn": "",
    "hotkeyMediaPill": "",
    "hotkeyTheme": "",
    "hotkeyWebAi": "",
    "cardTime": "normal",
    "homeHidden": [],
    "tabsHidden": [],
    "liquidWith": false,
    "recordFormat": "mp4",
    "recordingFps": 30,
    "recordingSound": "system",
    "recordingQuality": "normal",
    "clipLimit": 200,
    "clipExcludedApps": ["KeePass.exe", "KeePassXC.exe", "1Password.exe", "Bitwarden.exe"],
    "screenshotDir": "",
    "recordingDir": "",
    "uploadService": "",
    "uploadKey": "",
    "showNotifications": false,
    "notifyMuted": [],
    "paletteFiles": true,
    "paletteFolders": [],
    "hideForApps": [],
    "keepForApps": [],
    "hideForAppsMode": "hide",
    "searchEngine": "auto",
    "searchUrl": "",
    "moduleMedia": true,
    "moduleShelf": true,
    "moduleLauncher": true,
    "moduleControls": true,
    "controlsNet": "auto",
    "vpnCustomName": "",
    "vpnCustomOn": "",
    "vpnCustomOff": "",
    "vpnCustomAdmin": false,
    "audioOutput": "",
    "audioInput": "",
    "showVolume": true,
    "showLayout": true,
    "layoutInPill": false,
    "desktopInPill": false,
    "showCaps": true,
    "showDownloads": true,
    "steamDownloads": true,
    "obsStatus": false,
    "obsPort": 4455,
    "agentsStatus": true,
    "agentsAsk": true,
    "showPrivacy": true,
    "showVpn": true,
    "vpnLookupIp": true,
    "downloadsDir": "",
    "downloadsIgnore": [],
    "checkUpdates": true,
    "mascot": true,
    "character": "liquid",
    "characterMusic": "",
    "characterSize": "normal",
    "language": "auto",
    "aiBaseUrl": "http://127.0.0.1:11434/v1",
    "aiModel": "",
    "sttBaseUrl": "https://api.groq.com/openai/v1",
    "sttModel": "whisper-large-v3-turbo",
    "sttLanguage": "",
    "obsidianVaultPath": "<OBSIDIAN_VAULT>",
    "dictatePaste": false,
    "moduleWeather": true,
    "weatherCity": "",
    "weatherLat": 0,
    "weatherLon": 0,
    "weatherUnits": "metric",
    "showWeather": true,
    "weatherAlerts": true
}"###).expect("Valid default settings JSON")
}

fn island_zoom(settings: &Value) -> f64 {
    (settings["scale"].as_f64().unwrap_or(100.0) / 100.0).clamp(0.8, 2.0)
}

fn apply_island_geometry(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window unavailable")?;
    let settings = state.settings.lock().unwrap().clone();
    let zoom = island_zoom(&settings);
    window.set_zoom(zoom).map_err(|e|e.to_string())?;
    win::WindowManager::set_zoom(zoom);
    let monitors = app.available_monitors().map_err(|e|e.to_string())?;
    let primary = app.primary_monitor().map_err(|e|e.to_string())?;
    let name = settings["monitor"].as_str().unwrap_or("");
    let monitor = monitors.iter().find(|m|m.name().map(|n|n==name).unwrap_or(false)).or(primary.as_ref()).or(monitors.first()).ok_or("Monitor unavailable")?;
    let hwnd = HWND(window.hwnd().map_err(|e|e.to_string())?.0 as _);
    win::WindowManager::position_on_monitor(hwnd, monitor.position().x, monitor.position().y, monitor.size().width as i32, monitor.scale_factor(), zoom, settings["offsetX"].as_i64().unwrap_or(0).clamp(-10000,10000) as i32, settings["underTaskbar"].as_bool().unwrap_or(true), state.is_tall.load(Ordering::Relaxed));
    let rect = *state.island_rect.lock().unwrap();
    win::WindowManager::update_island_region(hwnd, Some((rect.x-4,0,rect.x+rect.w+4,rect.y+rect.h+6)));
    Ok(())
}

fn start_cursor_loop(app: AppHandle, state: Arc<AppState>) {
    // The acceptance runner supplies its own hover/click events. Real desktop
    // clicks and fullscreen changes must not collapse its cards mid-assertion.
    if win::WindowManager::passive_qa() { return; }
    std::thread::spawn(move || {
        let mut is_hovered = false;
        let mut is_edge = false;
        let mut mouse_down = false;
        let mut last_context = Value::Null;
        let mut last_check = std::time::Instant::now() - std::time::Duration::from_secs(1);
        let mut geometry_key = String::new();

        loop {
            std::thread::sleep(std::time::Duration::from_millis(25));

            let hwnd_val = *state.main_hwnd.lock().unwrap();
            let hwnd = match hwnd_val {
                Some(h) if h != 0 => windows::Win32::Foundation::HWND(h as _),
                _ => continue,
            };

            let rect = *state.island_rect.lock().unwrap();

            let (cursor_x, cursor_y) = match win::WindowManager::get_cursor_pos() {
                Some(pos) => pos,
                None => continue,
            };

            let win_rect = match win::WindowManager::get_window_rect(hwnd) {
                Some(r) => r,
                None => continue,
            };

            let scale = win::WindowManager::effective_scale(hwnd);
            let rel_x = ((cursor_x - win_rect.left) as f64 / scale).round() as i32;
            let rel_y = ((cursor_y - win_rect.top) as f64 / scale).round() as i32;

            let pad_x = 4;
            let pad_bottom = 6;
            let inside_pill = (rel_x >= (rect.x - pad_x) && rel_x <= (rect.x + rect.w + pad_x))
                && (rel_y >= 0 && rel_y <= (rect.y + rect.h + pad_bottom));

            // Cursor touching top 3 pixels near island activates edge unfold
            let at_top_edge = rel_y >= -2 && rel_y <= 3 && (rel_x >= (rect.x - 20) && rel_x <= (rect.x + rect.w + 20));

            if rel_x > -150 && rel_x < 910 && rel_y > -100 && rel_y < 580 {
                let _ = app.emit("cursor:near", [(rel_x - 380) as f64, rel_y as f64]);
            }
            let down = unsafe { windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(0x01) < 0 };
            if down && !mouse_down && !inside_pill && rect.expanded { let _ = app.emit("outside-click", ()); }
            mouse_down = down;

            if inside_pill != is_hovered {
                is_hovered = inside_pill;
                let _ = app.emit("hover", is_hovered);
            }

            if at_top_edge != is_edge {
                is_edge = at_top_edge;
                let _ = app.emit("island:edge", is_edge);
            }
            if last_check.elapsed() >= std::time::Duration::from_millis(500) {
                last_check = std::time::Instant::now();
                let context = win::WindowManager::system_context(hwnd);
                let settings = state.settings.lock().unwrap().clone();
                let context_key = json!([context,settings["hideInFullscreen"],settings["hideForApps"],settings["keepForApps"]]);
                if context_key != last_context {
                    let executable = context["executable"].as_str().unwrap_or("");
                    let matches = |key: &str| settings[key].as_array().map(|items| items.iter().filter_map(Value::as_str).any(|p|p.eq_ignore_ascii_case(executable))).unwrap_or(false);
                    let full = context["fullscreen"].as_bool().unwrap_or(false) && settings["hideInFullscreen"].as_bool().unwrap_or(true);
                    let _ = app.emit("fullscreen", full);
                    let _ = app.emit("island:shy", full || matches("hideForApps"));
                    let _ = app.emit("island:keep", matches("keepForApps"));
                    let _ = app.emit("island:desktop", context["desktop"].as_bool().unwrap_or(false));
                    last_context = context_key;
                }
                let monitors = app.available_monitors().unwrap_or_default();
                let name = settings["monitor"].as_str().unwrap_or("");
                let chosen = monitors.iter().find(|m|m.name().map(|n|n==name).unwrap_or(false));
                let primary = app.primary_monitor().ok().flatten();
                if let Some(monitor) = chosen.or(primary.as_ref()).or(monitors.first()) {
                    let key = format!("{}|{}|{}|{}|{:?}|{:?}|{}", settings["scale"], settings["monitor"], settings["offsetX"], settings["underTaskbar"], monitor.position(), monitor.size(), monitor.scale_factor());
                    if key != geometry_key {
                        geometry_key = key;
                        if let Err(e) = apply_island_geometry(&app, &state) { app_log(&format!("Island geometry: {e}")); }
                    }
                }
            }
        }
    });
}

/* ==========================================================================
   AUTHENTIC ISLAND IPC COMMAND HANDLERS (100% 1-TO-1 FIDELITY)
   ========================================================================== */

/// Called on app startup to initialize the entire frontend Zustand store
#[tauri::command]
async fn bootstrap(state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||{app_log("bootstrap worker entered");let result={let telemetry=telemetry::snapshot();json!({"settings":state.settings.lock().unwrap().clone(),"shelf":shelf_snapshot(&state),"launcher":state.launcher_items.lock().unwrap().clone(),"media":media::get_current_media(),"cover":media::get_current_cover(),"hotkeyErrors":state.hotkey_errors.lock().unwrap().clone(),"audio":audio::state().ok(),"privacy":telemetry["privacy"],"downloads":telemetry::downloads_snapshot(),"vpn":null,"update":null,"version":env!("CARGO_PKG_VERSION"),"capsLock":telemetry["capsLock"],"layout":telemetry["layout"],"license":license_status(),"trialOver":false,"news":news_get(),"battery":telemetry["battery"]})};app_log("bootstrap worker completed");result}).await.map_err(|e|e.to_string())}

#[tauri::command]
fn report_page_scale(width: Option<f64>, state: tauri::State<'_, Arc<AppState>>) {
    if width.map(|w|w.is_finite()&&w>0.0).unwrap_or(false) {
        if let Some(value) = *state.main_hwnd.lock().unwrap() {
            win::WindowManager::report_page_width(HWND(value as _), width.unwrap());
            let rect = *state.island_rect.lock().unwrap();
            win::WindowManager::update_island_region(HWND(value as _),Some((rect.x-4,0,rect.x+rect.w+4,rect.y+rect.h+6)));
        }
    }
}

#[tauri::command]
fn report_island_rect(
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    expanded: bool,
    tucked: bool,
    through: bool,
    state: tauri::State<'_, Arc<AppState>>,
) {
    if ![x,y,w,h].iter().all(|v|v.is_finite()) || w<0.0 || h<0.0 { return; }
    let mut rect = state.island_rect.lock().unwrap();
    rect.x = x.floor() as i32;
    rect.y = y.floor() as i32;
    rect.w = w.ceil() as i32;
    rect.h = h.ceil() as i32;
    rect.expanded = expanded;
    state.is_expanded.store(expanded, Ordering::Relaxed);
    state.click_through.store(through, Ordering::Relaxed);
    win::WindowManager::set_click_through(through);

    if let Some(hwnd_val) = *state.main_hwnd.lock().unwrap() {
        if hwnd_val != 0 {
            let hwnd = windows::Win32::Foundation::HWND(hwnd_val as _);
            let pad_x = 4;
            let pad_bottom = 6;
            let x1 = (rect.x - pad_x).max(0);
            let y1 = 0;
            let x2 = rect.x + rect.w + pad_x;
            let y2 = rect.y + rect.h + pad_bottom;
            win::WindowManager::update_island_region(hwnd, if tucked && y2<=0 {None}else{Some((x1, y1, x2, y2))});
        }
    }
}

#[tauri::command]
fn web_ai_popped()->Option<String>{webai::popped()}

#[tauri::command]
fn web_ai_open(service:Option<String>,app:AppHandle)->Result<bool,String>{webai::open(&app,service.as_deref()).map(|_|true)}

#[tauri::command]
async fn web_ai_embed(service:Option<String>,x:Option<f64>,y:Option<f64>,width:Option<f64>,height:Option<f64>,focus:Option<bool>,word:Option<u64>,app:AppHandle)->Result<bool,String>{webai::embed(&app,&service.ok_or("AI service is required")?,x.unwrap_or(0.),y.unwrap_or(0.),width.unwrap_or(0.),height.unwrap_or(0.),focus.unwrap_or(false),word.unwrap_or(0)).map(|_|true)}

#[tauri::command]
fn web_ai_hide(word:Option<u64>,app:AppHandle)->Result<bool,String>{webai::hide(&app,word.unwrap_or(0)).map(|_|true)}

#[tauri::command]
fn web_ai_browser(service:Option<String>)->Result<bool,String>{webai::browser(&service.ok_or("AI service is required")?).map(|_|true)}

#[tauri::command]
async fn web_ai_window(service:Option<String>,app:AppHandle)->Result<bool,String>{webai::window(&app,&service.ok_or("AI service is required")?).map(|_|true)}

#[tauri::command]
fn web_ai_window_close(app:AppHandle)->Result<bool,String>{webai::window_close(&app).map(|_|true)}

#[tauri::command]
fn web_ai_window_show(app:AppHandle)->Result<bool,String>{webai::window_show(&app).map(|_|true)}

#[tauri::command]
fn agents_now()->Vec<Value>{agents::current()}

#[tauri::command]
fn agents_connect(agent:Option<String>,on:Option<bool>,beside:Option<bool>)->Result<Value,String>{agents::connect(agent.as_deref().ok_or("Agent is required")?,on.unwrap_or(false),beside.unwrap_or(false))}

#[tauri::command]
fn agents_connections()->Value{agents::connections()}

#[tauri::command]
fn agents_answer(id:Option<String>,verdict:Option<String>,answers:Option<Value>)->Result<bool,String>{agents::answer(id.as_deref().ok_or("Question ID is required")?,verdict.as_deref().ok_or("Verdict is required")?,answers)}

#[tauri::command]
fn runs_as_admin()->bool{unsafe{windows::Win32::UI::Shell::IsUserAnAdmin().as_bool()}}

#[tauri::command]
fn news_told()->Result<bool,String>{storage::save_json_file("news.json",&json!({"told":true,"version":env!("CARGO_PKG_VERSION")})).map(|_|true)}

#[tauri::command]
fn news_get()->Value{json!({"version":env!("CARGO_PKG_VERSION"),"from":env!("CARGO_PKG_VERSION"),"told":true})}

#[tauri::command]
fn license_status()->Value{json!({"pro":true,"source":"free","serial":"","trialDaysLeft":null})}

#[tauri::command]
fn license_activate(key:Option<String>)->Value{let _=key;license_status()}

#[tauri::command]
fn license_remove()->Value{license_status()}

#[tauri::command]
fn settings_get(state: tauri::State<'_, Arc<AppState>>) -> Value {
    app_log("settings_get invoked");
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn settings_set(settings:Option<Value>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Vec<String>{
 let Some(patch)=settings else{return Vec::new();};if !patch.is_object(){return vec!["Settings must be an object".into()];}
 let mut warnings=Vec::new();let before=state.settings.lock().unwrap().clone();let updated={let mut value=before.clone();merge_settings(&mut value,&patch);value};
 if let Err(e)=storage::save_json_file("settings.json",&updated){return vec![e];}*state.settings.lock().unwrap()=updated.clone();
 if patch["audioOutput"].is_string() || patch["audioInput"].is_string() {audio::configure(&updated);}
 if patch.as_object().unwrap().keys().any(|key|key.starts_with("vpnCustom")) {network::configure_vpn(&updated);}
 if patch["captureVisible"].is_boolean() {if let Some(window)=app.get_webview_window("main"){if let Err(e)=window.set_content_protected(!updated["captureVisible"].as_bool().unwrap_or(false)){warnings.push(e.to_string());}}}
 if patch.as_object().unwrap().keys().any(|k|["scale","monitor","offsetX","underTaskbar"].contains(&k.as_str())) {if let Err(e)=apply_island_geometry(&app,&state){warnings.push(e);}}
 if let Some(on)=patch["autostart"].as_bool(){if std::env::var_os("WOODS_ISLAND_DATA_DIR").is_none(){if let Err(e)=system::autostart(on){warnings.push(e);}}}
 if patch.as_object().unwrap().keys().any(|k|k.starts_with("hotkey")){warnings.extend(register_hotkeys(&app,&updated));}
 if patch["through"].is_boolean(){let on=updated["through"].as_bool().unwrap_or(false);state.click_through.store(on,Ordering::Relaxed);win::WindowManager::set_click_through(on);}
 if ["weatherCity","weatherLat","weatherLon","weatherUnits","weatherUtcOffset"].iter().any(|key|before[*key]!=updated[*key]){
   let weather_settings=updated.clone();let weather_app=app.clone();let weather_state=state.inner().clone();
   tauri::async_runtime::spawn(async move{if !weather_settings["weatherCity"].as_str().unwrap_or_default().is_empty(){let result=weather::forecast(&weather_settings,false).await;let current=weather_state.settings.lock().unwrap().clone();if ["weatherCity","weatherLat","weatherLon","weatherUnits","weatherUtcOffset"].iter().any(|key|current[*key]!=weather_settings[*key]){return;}match result{Ok(data)=>{let _=weather_app.emit("weather:update",data);},Err(error)=>{let _=weather_app.emit("weather:error",error);}}}});
 }
 *state.hotkey_errors.lock().unwrap()=warnings.clone();let _=app.emit("settings:changed",updated);warnings
}

#[tauri::command]
fn settings_target(state: tauri::State<'_, Arc<AppState>>) -> Option<String> {
    state.settings_target.lock().unwrap().clone()
}

#[tauri::command]
fn monitors_list(app:AppHandle)->Vec<Value>{let primary=app.primary_monitor().ok().flatten();app.available_monitors().unwrap_or_default().into_iter().map(|m|{let is_primary=primary.as_ref().map(|p|p.position()==m.position()&&p.name()==m.name()).unwrap_or(false);json!({"name":m.name().cloned().unwrap_or_default(),"left":m.position().x,"top":m.position().y,"width":m.size().width,"height":m.size().height,"primary":is_primary,"scale":m.scale_factor()})}).collect()}

#[tauri::command]
fn shelf_list(state: tauri::State<'_, Arc<AppState>>) -> Vec<Value> {
    shelf_snapshot(&state)
}

fn shelf_snapshot(state: &AppState) -> Vec<Value> {
    state.shelf_items.lock().unwrap().iter().cloned().map(|mut item| {
        if let Some(path) = item["path"].as_str() {
            let details = system::item(std::path::Path::new(path));
            item["exists"] = details["exists"].clone();
            item["size"] = details["size"].clone();
        }
        item
    }).collect()
}

#[tauri::command]
fn shelf_add(paths:Option<Vec<String>>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let mut items=state.shelf_items.lock().unwrap();for path in paths.unwrap_or_default(){let p=std::path::Path::new(&path);if !p.exists(){return Err(format!("File does not exist: {path}"));}if items.iter().any(|item|item["path"].as_str()==Some(&path)){continue;}let mut value=system::item(p);value["id"]=json!(new_item_id("shelf"));items.push(value);}storage::save_json_file("shelf.json",&json!(*items))?;let _=app.emit("shelf:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn shelf_remove(id:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let target=id.ok_or("Item ID is required")?;let mut items=state.shelf_items.lock().unwrap();items.retain(|item|item["id"].as_str()!=Some(&target));storage::save_json_file("shelf.json",&json!(*items))?;let _=app.emit("shelf:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn shelf_clear(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let mut items=state.shelf_items.lock().unwrap();items.clear();storage::save_json_file("shelf.json",&json!([]))?;let _=app.emit("shelf:changed",json!([]));Ok(vec![])}

#[tauri::command]
fn launcher_list(state: tauri::State<'_, Arc<AppState>>) -> Vec<Value> {
    state.launcher_items.lock().unwrap().clone()
}

#[tauri::command]
async fn launcher_add(paths:Option<Vec<String>>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{
    let additions = tauri::async_runtime::spawn_blocking(move || paths.unwrap_or_default().into_iter().map(|path|system::app_item(&path)).collect::<Result<Vec<_>,String>>()).await.map_err(|e|e.to_string())??;
    let mut items=state.launcher_items.lock().unwrap();
    let mut updated=items.clone();
    for mut value in additions {if updated.iter().any(|item|item["path"]==value["path"]){continue;}value["id"]=json!(new_item_id("launcher"));updated.push(value);}
    storage::save_json_file("launcher.json",&json!(updated))?;
    *items=updated;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())
}

#[tauri::command]
fn launcher_add_link(link:Option<String>,name:Option<String>,icon:Option<Value>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let link=link.ok_or("URL is required")?;let url=reqwest::Url::parse(&link).map_err(|_|"Invalid URL")?;if !["http","https"].contains(&url.scheme()){return Err("Launcher links must use HTTP or HTTPS".into());}let mut items=state.launcher_items.lock().unwrap();items.push(json!({"id":new_item_id("link"),"path":link,"name":name.filter(|s|!s.trim().is_empty()).unwrap_or_else(||url.host_str().unwrap_or("Website").into()),"icon":icon.and_then(|v|v["data"].as_str().map(str::to_owned))}));storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn launcher_edit_link(id:Option<String>,link:Option<String>,name:Option<String>,icon:Option<Value>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let id=id.ok_or("Item ID is required")?;let link=link.ok_or("URL is required")?;let url=reqwest::Url::parse(&link).map_err(|_|"Invalid URL")?;if !["http","https"].contains(&url.scheme()){return Err("Launcher links must use HTTP or HTTPS".into());}let mut items=state.launcher_items.lock().unwrap();let item=items.iter_mut().find(|i|i["id"]==json!(id)).ok_or("Launcher item no longer exists")?;item["path"]=json!(link);if let Some(name)=name{item["name"]=json!(name);}if let Some(icon)=icon{if icon["kind"]!=json!("keep"){item["icon"]=icon["data"].clone();}}storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn launcher_remove(id:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let target=id.ok_or("Item ID is required")?;let mut items=state.launcher_items.lock().unwrap();items.retain(|item|item["id"].as_str()!=Some(&target));storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn launcher_launch(id:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let id=id.ok_or("Item ID is required")?;let item=state.launcher_items.lock().unwrap().iter().find(|i|i["id"]==json!(id)).cloned().ok_or("Launcher item no longer exists")?;system::open_path(item["path"].as_str().ok_or("Invalid launcher path")?,false,false).map(|_|true)}

#[tauri::command]
fn launcher_link_icon(link:Option<String>)->Option<String>{let url=reqwest::Url::parse(link.as_deref()?).ok()?;Some(format!("{}://{}/favicon.ico",url.scheme(),url.host_str()?))}

#[tauri::command]
fn launcher_pick_icon()->Result<Option<String>,String>{let paths=system::pick_files()?;let Some(path)=paths.first()else{return Ok(None);};let image=image::open(path).map_err(|e|e.to_string())?.into_rgba8();capture::data_url(&image).map(Some)}

#[tauri::command]
fn launcher_groups_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.launcher_groups.lock().unwrap().clone()
}

#[tauri::command]
fn launcher_groups_set(json:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=json.ok_or("Data is required")?;serde_json::from_str::<Value>(&data).map_err(|e|e.to_string())?;storage::save_string_file("launcher_groups.json",&data)?;*state.launcher_groups.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn launcher_hotkeys_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.launcher_hotkeys.lock().unwrap().clone()
}

#[tauri::command]
fn launcher_hotkeys_set(json:Option<String>,app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Result<Vec<String>,String>{let data=json.ok_or("Hotkey map is required")?;let value:Value=serde_json::from_str(&data).map_err(|e|e.to_string())?;let object=value.as_object().ok_or("Hotkey map must be an object")?;if !object.values().all(Value::is_string){return Err("Hotkey values must be strings".into());}storage::save_string_file("launcher_hotkeys.json",&data)?;*state.launcher_hotkeys.lock().unwrap()=data;let errors=register_hotkeys(&app,&state.settings.lock().unwrap().clone());*state.hotkey_errors.lock().unwrap()=errors.clone();Ok(errors)}

#[tauri::command]
fn controls_get(state:tauri::State<'_, Arc<AppState>>)->Value{state.controls.lock().unwrap().clone()}

#[tauri::command]
async fn controls_set(what:Option<String>,on:Option<bool>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||{let what=what.ok_or("Control is required")?;let on=on.ok_or("Control state is required")?;let what=what.strip_prefix("vpn:").unwrap_or(&what);match what{"wifi"=>system::radio_set(windows::Devices::Radios::RadioKind::WiFi,on)?,"bluetooth"=>system::radio_set(windows::Devices::Radios::RadioKind::Bluetooth,on)?,"ethernet"=>system::open_path("ms-settings:network-ethernet",false,false)?,"dark"|"theme"|"darkTheme"=>{let current=system::controls();if current["dark"].as_bool()!=Some(on)&&!theme_flip(){return Err("Cannot change Windows theme".into());}},key if key.starts_with("app:")||key.starts_with("ras:")||key.starts_with("service:")=>network::vpn_toggle(key,on)?,_=>return Err("This control is not available on this computer".into())}let mut current=system::controls();current["vpns"]=json!(network::vpn_profiles());*state.controls.lock().unwrap()=current.clone();let _=app.emit("controls:changed",&current);Ok(current)}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn obs_state(state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let port=state.settings.lock().unwrap()["obsPort"].as_u64().unwrap_or(4455) as u16;Ok(obs::state(port).await)}

#[tauri::command]
fn obs_password_set(password:Option<String>)->Result<bool,String>{storage::save_secret("obs",&password.unwrap_or_default()).map(|_|true)}

#[tauri::command]
fn obs_password_status()->bool{storage::load_secret("obs").map(|s|!s.is_empty()).unwrap_or(false)}

#[tauri::command]
async fn weather_get(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let settings=state.settings.lock().unwrap().clone();if settings["weatherCity"].as_str().unwrap_or_default().is_empty(){return Ok(Value::Null);}Ok(match weather::forecast(&settings,false).await{Ok(data)=>{let _=app.emit("weather:update",&data);data},Err(error)=>{let _=app.emit("weather:error",error);Value::Null}})}

#[tauri::command]
async fn weather_refresh(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let settings=state.settings.lock().unwrap().clone();let data=weather::forecast(&settings,true).await?;let _=app.emit("weather:update",&data);Ok(data)}

#[tauri::command]
async fn weather_search(query: Option<String>) -> Vec<Value> {
    weather::search_cities(&query.unwrap_or_default()).await
}

#[tauri::command]
async fn rates()->Result<Value,String>{weather::rates().await}

#[tauri::command]
fn take_focus(app: AppHandle) {
    if win::WindowManager::passive_qa() { return; }
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(hwnd) = window.hwnd() { win::WindowManager::keyboard_focus(HWND(hwnd.0 as _),true); }
        if !win::WindowManager::passive_qa() { let _ = window.set_focus(); }
    }
}

#[tauri::command]
fn release_focus(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(hwnd) = window.hwnd() {
            win::WindowManager::keyboard_focus(HWND(hwnd.0 as _),false);
        }
    }
}

#[tauri::command]
fn clip_list(query:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Vec<Value>{let limit=state.settings.lock().unwrap()["clipLimit"].as_u64().unwrap_or(200).clamp(1,5000) as usize;state.clipboard_store.get_items(limit).unwrap_or_default().into_iter().filter(|item|query.as_ref().map(|q|item.content.to_lowercase().contains(&q.to_lowercase())).unwrap_or(true)).map(|item|{let mut val=json!({"id":item.id,"text":item.content,"preview":item.content,"kind":item.item_type,"pinned":item.pinned,"time":item.created_at});if item.item_type=="files"{if let Ok(paths)=serde_json::from_str::<Vec<String>>(&item.content){val["preview"]=json!(paths.join("\n"));}}if item.item_type=="image"{use base64::Engine;if let Some(encoded)=item.content.split_once(',').map(|(_,data)|data){if let Ok(bytes)=base64::engine::general_purpose::STANDARD.decode(encoded){if let Ok(img)=image::load_from_memory(&bytes){let path=storage::get_storage_dir().join(format!("clipboard-{}.png",item.id));if !path.exists(){let _=std::fs::write(&path,&bytes);}val["imagePath"]=json!(path.to_string_lossy());val["thumb"]=json!(item.content);val["width"]=json!(img.width());val["height"]=json!(img.height());}}}}val}).collect()}

#[tauri::command]
fn clip_paste(id:i64,paste:Option<bool>,state:tauri::State<'_, Arc<AppState>>)->Result<(),String>{let item=state.clipboard_store.get_item(id).map_err(|e|e.to_string())?;if item.item_type=="files"{let paths:Vec<String>=serde_json::from_str(&item.content).map_err(|e|e.to_string())?;clipboard::set_files(&paths)?;if paste.unwrap_or(true){clipboard::paste_current()?;}Ok(())}else if item.item_type=="image"{clipboard::set_png(&item.content)?;if paste.unwrap_or(true){clipboard::paste_current()?;}Ok(())}else if paste.unwrap_or(true){clipboard::paste_to_focused_window(&item.content)}else{clipboard::set_text(&item.content)}}

#[tauri::command]
fn clip_pin(id:i64,pinned:Option<bool>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<(),String>{if let Some(pinned)=pinned{state.clipboard_store.set_pin(id,pinned)}else{state.clipboard_store.toggle_pin(id)}.map_err(|e|e.to_string())?;let _=app.emit("clipboard:new",json!({"own":true,"again":true}));Ok(())}

#[tauri::command]
fn clip_delete(id:i64,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<(),String>{state.clipboard_store.delete_item(id).map_err(|e|e.to_string())?;let _=app.emit("clipboard:new",json!({"own":true,"again":true}));Ok(())}

#[tauri::command]
fn clip_clear(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<(),String>{state.clipboard_store.clear_unpinned().map_err(|e|e.to_string())?;let _=app.emit("clipboard:new",json!({"own":true,"again":true}));Ok(())}

#[tauri::command]
fn clip_current_text()->Option<String>{arboard::Clipboard::new().ok()?.get_text().ok()}

#[tauri::command]
fn clip_set_text(text:Option<String>)->Result<bool,String>{clipboard::set_text(&text.ok_or("Text is required")?).map(|_|true)}

#[tauri::command]
fn clip_set_png(data_url:Option<String>)->Result<bool,String>{clipboard::set_png(&data_url.ok_or("Image is required")?).map(|_|true)}

#[tauri::command]
async fn media_control(action:Option<String>,playing:Option<bool>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{let action=action.ok_or("Media action is required")?;let action=if action=="toggle"{playing.map(|on|if on{"play"}else{"pause"}).unwrap_or("toggle")}else{&action};if media::media_control(action){Ok(true)}else{Err("The active media player could not perform this action".into())}}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn media_sources()->Vec<Value>{tauri::async_runtime::spawn_blocking(move||{
    media::get_media_sources()
}).await.unwrap_or_default()}

#[tauri::command]
async fn media_pick(id:Option<String>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{let id=id.filter(|s|!s.is_empty());if let Some(id)=id.as_ref(){if !media::get_media_sources().iter().any(|source|source["id"].as_str()==Some(id)){return Err("Media source no longer exists".into());}}media::set_picked_source(id);Ok(true)}).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn media_rename(app_id:Option<String>,name:Option<String>)->Result<bool,String>{let id=app_id.ok_or("Media source ID is required")?;let name=name.unwrap_or_default();let mut names=storage::load_json_file("media_names.json").unwrap_or(json!({}));let map=names.as_object_mut().ok_or("Invalid media name store")?;if name.trim().is_empty(){map.remove(&id);}else{map.insert(id,json!(name.trim()));}storage::save_json_file("media_names.json",&names).map(|_|true)}

#[tauri::command]
async fn media_seek(ms:Option<u64>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{if media::media_seek(ms.ok_or("Playback position is required")?){Ok(true)}else{Err("The active player does not allow seeking".into())}}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn lyrics_get(artist: Option<String>, title: Option<String>, album: Option<String>, duration_ms: Option<u64>) -> Result<Value, String> {
    lyrics::get(artist.unwrap_or_default(), title.unwrap_or_default(), album.unwrap_or_default(), duration_ms).await
}

#[tauri::command]
async fn player_volume()->Result<Value,String>{tauri::async_runtime::spawn_blocking(move||{audio::player_volume()}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn player_volume_set(level:Option<f64>,mute:Option<bool>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{audio::set_player_volume(level,mute).map(|_|true)}).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn audio_devices()->Result<Vec<Value>,String>{audio::devices(false)}

#[tauri::command]
fn audio_inputs()->Result<Vec<Value>,String>{audio::devices(true)}

#[tauri::command]
fn audio_set_default(id:Option<String>)->Result<bool,String>{audio::set_default(&id.ok_or("Device ID is required")?).map(|_|true)}

#[tauri::command]
fn volume_set(level:Option<f64>)->Result<bool,String>{audio::set_volume(level.ok_or("Volume is required")?).map(|_|true)}

#[tauri::command]
fn volume_step(delta:Option<f64>)->Result<bool,String>{audio::step_volume(delta.ok_or("Volume delta is required")?).map(|_|true)}

#[tauri::command]
fn volume_mute_toggle()->Result<bool,String>{audio::toggle_mute(false).map(|_|true)}

#[tauri::command]
fn mic_toggle()->Result<bool,String>{audio::toggle_mute(true).map(|_|true)}

#[tauri::command]
async fn wifi_networks()->Result<Vec<Value>,String>{tauri::async_runtime::spawn_blocking(network::wifi_networks).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn wifi_join(ssid:Option<String>,password:Option<String>)->Result<Value,String>{let ssid=ssid.ok_or("Network SSID is required")?;tauri::async_runtime::spawn_blocking(move||network::wifi_join(&ssid,password.as_deref())).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn wifi_leave()->Result<bool,String>{tauri::async_runtime::spawn_blocking(network::wifi_leave).await.map_err(|e|e.to_string())?.map(|_|true)}

#[tauri::command]
async fn bt_devices()->Vec<Value>{tauri::async_runtime::spawn_blocking(network::bt_devices).await.unwrap_or_default()}

#[tauri::command]
async fn bt_switch(id:Option<String>,on:Option<bool>)->Result<bool,String>{let id=id.ok_or("Bluetooth device ID is required")?;tauri::async_runtime::spawn_blocking(move||network::bt_switch(&id,on.unwrap_or(true))).await.map_err(|e|e.to_string())?.map(|_|true)}

#[tauri::command]
async fn vpn_chip(app:AppHandle)->Result<bool,String>{let profiles=tauri::async_runtime::spawn_blocking(network::vpn_profiles).await.map_err(|e|e.to_string())?;let available:Vec<_>=profiles.iter().filter(|p|p["ready"]==json!(true)).collect();if available.is_empty(){return Err("No supported VPN connection is installed".into());}if let Some(profile)=available.iter().find(|p|p["on"]==json!(true)){let id=profile["id"].as_str().unwrap_or_default().to_owned();tauri::async_runtime::spawn_blocking(move||network::vpn_toggle(&id,false)).await.map_err(|e|e.to_string())??;vpn_refresh(app).await?;return Ok(false);}if available.len()==1{let id=available[0]["id"].as_str().unwrap_or_default().to_owned();tauri::async_runtime::spawn_blocking(move||network::vpn_toggle(&id,true)).await.map_err(|e|e.to_string())??;vpn_refresh(app).await?;return Ok(false);}let _=app.emit("vpn:choose",());Ok(true)}

#[tauri::command]
async fn vpn_refresh(app:AppHandle)->Result<Value,String>{let profiles=tauri::async_runtime::spawn_blocking(network::vpn_profiles).await.map_err(|e|e.to_string())?;let active=profiles.iter().find(|v|v["on"]==json!(true));let mut payload=json!({"active":active.is_some(),"via":active.and_then(|v|v["name"].as_str()),"ip":null,"country":null,"countryCode":null});let lookup=app.state::<Arc<AppState>>().settings.lock().unwrap()["vpnLookupIp"].as_bool().unwrap_or(true);if lookup{let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build().map_err(|e|e.to_string())?;if let Ok(response)=client.get("https://api.country.is").send().await{if let Ok(data)=response.json::<Value>().await{payload["ip"]=data["ip"].clone();payload["country"]=data["country"].clone();payload["countryCode"]=data["country"].clone();}}}let _=app.emit("vpn:update",&payload);Ok(payload)}

#[tauri::command]
async fn vpn_toggle_now(app:AppHandle)->Result<bool,String>{vpn_chip(app).await}

#[tauri::command]
fn theme_flip() -> bool {
    use windows::Win32::System::Registry::{
        RegOpenKeyExW, RegSetValueExW, RegQueryValueExW, RegCloseKey,
        HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SendMessageTimeoutW, HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG,
    };
    use windows::core::w;

    unsafe {
        let subkey = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ | KEY_WRITE, &mut hkey).is_ok() {
            let mut current: u32 = 0;
            let mut size = 4u32;
            let val_name = w!("AppsUseLightTheme");
            if RegQueryValueExW(hkey, val_name, None, None, Some(&mut current as *mut _ as _), Some(&mut size)).is_err() { let _=RegCloseKey(hkey);return false; }
            
            let new_val: u32 = if current == 0 { 1 } else { 0 };
            let val_bytes = new_val.to_ne_bytes();
            if RegSetValueExW(hkey, val_name, 0, REG_DWORD, Some(&val_bytes)).is_err() { let _=RegCloseKey(hkey);return false; }
            let sys_name = w!("SystemUsesLightTheme");
            if RegSetValueExW(hkey, sys_name, 0, REG_DWORD, Some(&val_bytes)).is_err() { let _=RegCloseKey(hkey);return false; }
            let _ = RegCloseKey(hkey);

            let param = w!("ImmersiveColorSet");
            let mut result = 0usize;
            let _ = SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                windows::Win32::Foundation::WPARAM(0),
                windows::Win32::Foundation::LPARAM(param.as_ptr() as isize),
                SMTO_ABORTIFHUNG,
                1000,
                Some(&mut result),
            );
            return true;
        }
    }
    false
}

#[tauri::command]
fn through_toggle(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let on=!state.click_through.load(Ordering::Relaxed);win::WindowManager::set_click_through(on);state.click_through.store(on,Ordering::Relaxed);let mut settings=state.settings.lock().unwrap();settings["through"]=json!(on);storage::save_json_file("settings.json",&settings)?;let _=app.emit("settings:changed",settings.clone());Ok(on)}

#[tauri::command]
fn hover(state:Option<bool>,app:AppHandle)->bool{let _=app.emit("hover",state.unwrap_or(false));true}

#[tauri::command]
fn island_tall(on:Option<bool>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{state.is_tall.store(on.unwrap_or(false),Ordering::Relaxed);apply_island_geometry(&app,&state).map(|_|true)}

#[tauri::command]
fn set_island_hidden(hidden:Option<bool>,app:AppHandle)->Result<bool,String>{let window=app.get_webview_window("main").ok_or("Main window unavailable")?;if hidden.unwrap_or(false){window.hide()}else{window.show()}.map(|_|true).map_err(|e|e.to_string())}

#[tauri::command]
fn fullscreen(state:tauri::State<'_, Arc<AppState>>)->bool{state.main_hwnd.lock().unwrap().map(|h|win::WindowManager::system_context(HWND(h as _))["fullscreen"].as_bool().unwrap_or(false)).unwrap_or(false)}

#[tauri::command]
fn hotkeys_check(app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Vec<String>{use tauri_plugin_global_shortcut::{GlobalShortcutExt,Shortcut};let settings=state.settings.lock().unwrap().clone();settings.as_object().into_iter().flatten().filter(|(k,_)|k.starts_with("hotkey")).filter_map(|(_,v)|v.as_str()).filter(|s|!s.is_empty()).filter_map(|s|match s.parse::<Shortcut>(){Ok(shortcut)if app.global_shortcut().is_registered(shortcut)=>None,_=>Some(format!("Shortcut unavailable: {s}"))}).collect()}

#[tauri::command]
async fn open_settings(section: Option<String>, app: AppHandle, state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    app_log(&format!("open_settings entered with section: {:?}", section));
    if let Some(sec) = &section {
        *state.settings_target.lock().unwrap() = Some(sec.clone());
    }

    let window_app = app.clone();
    let window = tauri::async_runtime::spawn_blocking(move || ensure_aux_window(&window_app, "settings")).await.map_err(|e|e.to_string())??;
        app_log("showing settings window");
        let _ = window.unminimize();
        let _ = window.show();
        if !win::WindowManager::passive_qa() { let _ = window.set_focus(); }
        if let Some(sec) = section {
            let _ = app.emit("settings:goto", sec);
        }
        Ok(true)
}

#[tauri::command]
fn open_path(path:Option<String>,reveal:Option<bool>,elevated:Option<bool>)->Result<bool,String>{system::open_path(&path.ok_or("Path is required")?,reveal.unwrap_or(false),elevated.unwrap_or(false)).map(|_|true)}

#[tauri::command]
fn open_captures(kind:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let settings=state.settings.lock().unwrap().clone();let path=capture::output_dir(&settings,kind.as_deref().unwrap_or("screenshot"))?;system::open_path(&path.to_string_lossy(),false,false).map(|_|true)}

#[tauri::command]
fn run_shell(shell:Option<String>,command:Option<String>)->Result<bool,String>{system::run_shell(&shell.unwrap_or_default(),&command.ok_or("Command is required")?).map(|_|true)}

#[tauri::command]
fn quit(app: AppHandle) {
    app_log("quit command invoked by frontend!");
    finalize_background(&app);
    app.exit(0);
}

fn finalize_background(app:&AppHandle){
 speech::cancel(app);
 match recorder::finalize_active(){Ok(Some(result))=>{let _=app.emit("record:done",result);},Ok(None)=>{},Err(error)=>{let _=app.emit("record:done",Value::Null);let _=app.emit("capture:error",error);}}
}

#[tauri::command]
fn restart_island(app:AppHandle)->bool{finalize_background(&app);app.restart()}

#[tauri::command]
async fn update_check()->Result<Option<Value>,String>{let response=reqwest::Client::builder().user_agent("WoodsIsland").timeout(std::time::Duration::from_secs(8)).build().map_err(|e|e.to_string())?.get("https://api.github.com/repos/nimalekyt-bit/woods-island/releases/latest").send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;let data:Value=response.json().await.map_err(|e|e.to_string())?;let version=data["tag_name"].as_str().ok_or("Release tag is missing")?.trim_start_matches('v');let parts=|version:&str|->Result<Vec<u64>,String>{let mut nums=version.split('.').map(|s|s.parse::<u64>().map_err(|_|"Invalid release version".to_owned())).collect::<Result<Vec<_>,_>>()?;nums.resize(3,0);Ok(nums)};if parts(version)?<=parts(env!("CARGO_PKG_VERSION"))?{return Ok(None);}let url=data["html_url"].as_str().ok_or("Release URL is missing")?;if !url.starts_with("https://github.com/nimalekyt-bit/woods-island/"){return Err("Invalid release URL".into());}Ok(Some(json!({"version":version,"current":env!("CARGO_PKG_VERSION"),"url":data["html_url"]})))}

fn start_update_monitor(app: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        // The passive test process never contacts the owner's private repository.
        if win::WindowManager::passive_qa() { return; }
        loop {
            if state.settings.lock().unwrap()["checkUpdates"].as_bool().unwrap_or(true) {
                match update_check().await {
                    Ok(Some(info)) => { let _ = app.emit("update:available", info); }
                    Ok(None) => {}
                    Err(error) => app_log(&format!("Update check: {error}")),
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(6 * 60 * 60)).await;
        }
    });
}

#[tauri::command]
fn update_install()->Result<bool,String>{system::open_path("https://github.com/nimalekyt-bit/woods-island/releases",false,false).map(|_|true)}

#[tauri::command]
fn timer_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.timer_data.lock().unwrap().clone()
}

#[tauri::command]
fn timer_set(json:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=json.ok_or("Data is required")?;serde_json::from_str::<Value>(&data).map_err(|e|e.to_string())?;storage::save_string_file("timer.json",&data)?;*state.timer_data.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn reminders_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.reminders_data.lock().unwrap().clone()
}

#[tauri::command]
fn reminders_set(json:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=json.ok_or("Data is required")?;serde_json::from_str::<Value>(&data).map_err(|e|e.to_string())?;storage::save_string_file("reminders.json",&data)?;*state.reminders_data.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn note_folders_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.note_folders_data.lock().unwrap().clone()
}

#[tauri::command]
fn note_folders_set(json:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=json.ok_or("Data is required")?;serde_json::from_str::<Value>(&data).map_err(|e|e.to_string())?;storage::save_string_file("note_folders.json",&data)?;*state.note_folders_data.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn note_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.note_data.lock().unwrap().clone()
}

#[tauri::command]
fn note_set(text:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=text.ok_or("Data is required")?;storage::save_string_file("notes.json",&data)?;*state.note_data.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn note_export(id:Option<String>,title:Option<String>,text:Option<String>,state:tauri::State<'_,Arc<AppState>>)->Result<Value,String>{
 let folders=state.note_folders_data.lock().unwrap().clone();
 let current=state.note_data.lock().unwrap().clone();
 let (title,text)=notes::selected(id.as_deref(),title,text,&folders,&current)?;
 let vault=state.settings.lock().unwrap()["obsidianVaultPath"].as_str().unwrap_or("<OBSIDIAN_VAULT>").to_owned();
 notes::export(std::path::Path::new(&vault),&title,&text)
}

#[tauri::command]
fn chat_get(state: tauri::State<'_, Arc<AppState>>) -> String {
    state.chat_data.lock().unwrap().clone()
}

#[tauri::command]
fn chat_set(json:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let data=json.ok_or("Data is required")?;serde_json::from_str::<Value>(&data).map_err(|e|e.to_string())?;storage::save_string_file("chat.json",&data)?;*state.chat_data.lock().unwrap()=data;Ok(true)}

#[tauri::command]
fn color_history()->Vec<String>{storage::load_json_file("colors.json").and_then(|v|v.as_array().cloned()).unwrap_or_default().iter().filter_map(|v|v.as_str().map(str::to_owned)).collect()}

#[tauri::command]
fn color_pick(x:Option<f64>,y:Option<f64>,app:AppHandle)->Result<String,String>{let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),0.00001,0.00001)?;let image=capture::screenshot(windows::Win32::Foundation::RECT{left:rect.left,top:rect.top,right:rect.left+1,bottom:rect.top+1})?;let p=image.get_pixel(0,0);let hex=format!("#{:02X}{:02X}{:02X}",p[0],p[1],p[2]);let mut history=color_history();history.retain(|h|h!=&hex);history.insert(0,hex.clone());history.truncate(12);storage::save_json_file("colors.json",&json!(history))?;let _=app.emit("capture:done",json!({"kind":"color","hex":hex,"rgb":[p[0],p[1],p[2]],"history":history}));Ok(hex)}

#[tauri::command]
fn color_patch(x:Option<f64>,y:Option<f64>,radius:Option<f64>)->Result<Value,String>{let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),0.00001,0.00001)?;let r=radius.unwrap_or(5.).round().clamp(1.,16.) as i32;let bounds=capture::screen_rect();let left=(rect.left-r).max(bounds.left);let top=(rect.top-r).max(bounds.top);let right=(rect.left+r+1).min(bounds.right);let bottom=(rect.top+r+1).min(bounds.bottom);let image=capture::selected_image(windows::Win32::Foundation::RECT{left,top,right,bottom})?;Ok(json!({"dataUrl":capture::data_url(&image)?,"width":image.width(),"height":image.height()}))}

#[tauri::command]
fn picker_size()->Value{let rect=capture::screen_rect();json!([rect.right-rect.left,rect.bottom-rect.top])}

#[tauri::command]
fn pick_sound()->Result<Option<String>,String>{system::pick_files().map(|files|files.first().cloned())}

#[tauri::command]
fn chime(sound:Option<String>,state:tauri::State<'_, Arc<AppState>>)->bool{let sound=sound.or_else(||state.settings.lock().unwrap()["alertSound"].as_str().map(str::to_owned));play_chime(sound.as_deref())}

#[tauri::command]
fn chime_try(sound:Option<String>)->bool{play_chime(sound.as_deref())}

#[tauri::command]
fn capture_start(mode:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let mode=mode.unwrap_or_else(||"area".into());let rect=capture::screen_rect();let mut visibility=capture::hide_main(&app);std::thread::sleep(std::time::Duration::from_millis(70));let image=capture::screenshot(rect)?;capture::set_frame(&image);if mode=="screen"{let settings=state.settings.lock().unwrap().clone();let result=capture::save(&image,&settings)?;capture::clear_frame();let _=clipboard::set_png(&capture::data_url(&image)?);let _=app.emit("capture:done",result);if let Some(main)=app.get_webview_window("main"){let _=main.show();}return Ok(true);}let overlay=app.get_webview_window("overlay").ok_or("Capture overlay is unavailable")?;overlay.set_position(tauri::PhysicalPosition::new(rect.left,rect.top)).map_err(|e|e.to_string())?;overlay.set_size(tauri::PhysicalSize::new((rect.right-rect.left) as u32,(rect.bottom-rect.top) as u32)).map_err(|e|e.to_string())?;let frame=capture::data_url(&image)?;let _=app.emit_to("overlay","overlay:start",json!({"mode":mode,"frame":frame,"below":0}));overlay.show().map_err(|e|e.to_string())?;if !win::WindowManager::passive_qa(){overlay.set_focus().map_err(|e|e.to_string())?;}visibility.keep_hidden();Ok(true)}

#[tauri::command]
fn capture_cancel(app:AppHandle)->bool{capture::clear_frame();if let Some(w)=app.get_webview_window("overlay"){let _=w.hide();}if let Some(w)=app.get_webview_window("main"){let _=w.show();}true}

#[tauri::command]
fn capture_region(x:Option<f64>,y:Option<f64>,w:Option<f64>,h:Option<f64>,mode:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),w.unwrap_or(1.),h.unwrap_or(1.))?;if let Some(overlay)=app.get_webview_window("overlay"){let _=overlay.hide();}std::thread::sleep(std::time::Duration::from_millis(70));let result:Result<Value,String>=(||{let image=capture::selected_image(rect)?;let settings=state.settings.lock().unwrap().clone();match mode.as_deref().unwrap_or("area"){"ocr"=>{let saved=capture::save(&image,&settings)?;let text=capture::ocr(std::path::Path::new(saved["path"].as_str().unwrap()))?;let _=clipboard::set_text(&text);Ok(json!({"kind":"ocr","text":text}))},"qr"=>{let text=capture::qr(&image)?;let url=reqwest::Url::parse(&text).ok().filter(|u|["http","https"].contains(&u.scheme())).map(|u|u.to_string());Ok(json!({"kind":"qr","text":text,"url":url}))},_=>{let saved=capture::save(&image,&settings)?;clipboard::set_png(&capture::data_url(&image)?)?;Ok(saved)}}})();capture::clear_frame();if let Some(main)=app.get_webview_window("main"){let _=main.show();}match result{Ok(payload)=>{let _=app.emit("capture:done",payload);Ok(true)},Err(error)=>{let _=app.emit("capture:error",&error);Err(error)}}}

#[tauri::command]
fn capture_region_drawn(x:Option<f64>,y:Option<f64>,w:Option<f64>,h:Option<f64>,drawing:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{
 let Some(drawing)=drawing else{return capture_region(x,y,w,h,Some("area".into()),app,state);};
 use base64::Engine;let encoded=drawing.split_once(',').ok_or("Invalid annotation image")?.1;let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?;let annotated=image::load_from_memory(&bytes).map_err(|e|e.to_string())?.into_rgba8();
 let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),w.unwrap_or(1.),h.unwrap_or(1.))?;if let Some(overlay)=app.get_webview_window("overlay"){let _=overlay.hide();}std::thread::sleep(std::time::Duration::from_millis(70));
 let mut image=capture::selected_image(rect)?;capture::clear_frame();let drawing=image::imageops::resize(&annotated,image.width(),image.height(),image::imageops::FilterType::Lanczos3);image::imageops::overlay(&mut image,&drawing,0,0);
 let settings=state.settings.lock().unwrap().clone();let result=capture::save(&image,&settings)?;clipboard::set_png(&capture::data_url(&image)?)?;let _=app.emit("capture:done",result);if let Some(main)=app.get_webview_window("main"){let _=main.show();}Ok(true)
}

#[tauri::command]
fn prtsc_taken()->bool{use windows::Win32::System::Registry::*;let mut enabled=0u32;let mut size=4u32;unsafe{let status=RegGetValueW(HKEY_CURRENT_USER,windows::core::w!("Control Panel\\Keyboard"),windows::core::w!("PrintScreenKeyForSnippingEnabled"),RRF_RT_REG_DWORD,None,Some((&mut enabled as *mut u32).cast()),Some(&mut size));status.is_ok()&&enabled!=0}}

#[tauri::command]
fn record_start(app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{capture_start(Some("record".into()),app,state)}

#[tauri::command]
fn record_begin(x:Option<f64>,y:Option<f64>,w:Option<f64>,h:Option<f64>,format:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{capture_cancel(app.clone());let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),w.unwrap_or(1.),h.unwrap_or(1.))?;let settings=state.settings.lock().unwrap().clone();let result=recorder::begin(rect,&format.unwrap_or_else(||"mp4".into()),&settings);match result{Ok(payload)=>{let _=app.emit("record:started",payload);Ok(true)},Err(error)=>{let _=app.emit("capture:error",&error);Err(error)}}}

#[tauri::command]
fn record_stop(app:AppHandle)->Result<bool,String>{match recorder::stop(){Ok(payload)=>{if let Some(path)=payload["path"].as_str(){if let Err(error)=clipboard::set_files(&[path.to_owned()]){let _=app.emit("island:warn",error);}}let _=app.emit("record:done",payload);Ok(true)},Err(error)=>{let _=app.emit("record:done",Value::Null);let _=app.emit("capture:error",&error);Err(error)}}}

#[tauri::command]
async fn ocr_file(path:Option<String>)->Result<String,String>{tauri::async_runtime::spawn_blocking(move||{capture::ocr(std::path::Path::new(&path.ok_or("Image path is required")?))}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn upload_image(path:Option<String>,state:tauri::State<'_,Arc<AppState>>)->Result<String,String>{
 let path=path.ok_or("Image path is required")?;let settings=state.settings.lock().unwrap().clone();let service=settings["uploadService"].as_str().unwrap_or_default();let key=settings["uploadKey"].as_str().filter(|s|!s.is_empty()).ok_or("Set your image-upload API key in settings")?;
 let bytes=std::fs::read(&path).map_err(|e|e.to_string())?;if bytes.len()>20*1024*1024{return Err("Image exceeds 20 MB".into());}image::load_from_memory(&bytes).map_err(|e|e.to_string())?;let name=std::path::Path::new(&path).file_name().unwrap_or_default().to_string_lossy().into_owned();
 let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(45)).build().map_err(|e|e.to_string())?;
 let request=match service{"imgur"=>{let form=reqwest::multipart::Form::new().part("image",reqwest::multipart::Part::bytes(bytes).file_name(name));client.post("https://api.imgur.com/3/image").header("Authorization",format!("Client-ID {key}")).multipart(form)},"imgbb"=>{let form=reqwest::multipart::Form::new().text("key",key.to_owned()).part("image",reqwest::multipart::Part::bytes(bytes).file_name(name));client.post("https://api.imgbb.com/1/upload").multipart(form)},_=>return Err("Choose a supported image-upload service in settings".into())};
 let response=request.send().await.map_err(|_|"Image-upload connection failed")?;if !response.status().is_success(){return Err(format!("Image-upload service returned HTTP {}",response.status()));}let data:Value=response.json().await.map_err(|_|"Invalid image-upload response")?;
 let url=if service=="imgur"{data["data"]["link"].as_str()}else{data["data"]["url"].as_str()}.ok_or("Image-upload service returned no image URL")?.to_owned();clipboard::set_text(&url)?;Ok(url)
}

#[tauri::command]
async fn editor_open(path:Option<String>,app:AppHandle)->Result<bool,String>{
    let path = path.ok_or("Image path is required")?;
    let window_app = app.clone();
    let window = tauri::async_runtime::spawn_blocking(move || {
        capture::editor_open(std::path::Path::new(&path))?;
        let existed = window_app.get_webview_window("editor").is_some();
        let window = ensure_aux_window(&window_app, "editor")?;
        if existed { window.eval("location.reload()").map_err(|e|e.to_string())?; }
        Ok::<_,String>(window)
    }).await.map_err(|e|e.to_string())??;
    window.show().map_err(|e|e.to_string())?;
    if !win::WindowManager::passive_qa(){window.set_focus().map_err(|e|e.to_string())?;}
    Ok(true)
}

#[tauri::command]
fn editor_save(data_url:Option<String>,copy:Option<bool>)->Result<bool,String>{capture::editor_save(&data_url.ok_or("Image is required")?,copy.unwrap_or(false)).map(|_|true)}

#[tauri::command]
fn editor_image()->Result<Value,String>{capture::editor_image().map(|url|json!({"dataUrl":url}))}

#[tauri::command]
fn files_held()->Vec<Value>{system::recent()}

#[tauri::command]
fn files_search(query:Option<String>,state:tauri::State<'_, Arc<AppState>>)->Vec<Value>{let folders=state.settings.lock().unwrap()["paletteFolders"].as_array().map(|a|a.iter().filter_map(|s|s.as_str().map(str::to_owned)).collect::<Vec<_>>()).unwrap_or_default();system::search_files(&query.unwrap_or_default(),&folders)}

#[tauri::command]
fn files_warm()->bool{!system::apps().is_empty()}

#[tauri::command]
fn attach_data(name:Option<String>,data:Option<String>)->Result<Value,String>{ai::attachment_data(&name.ok_or("Attachment name is required")?,&data.ok_or("Attachment data is required")?)}

#[tauri::command]
fn attach_paths(paths:Option<Vec<String>>)->Value{ai::attachment_paths(&paths.unwrap_or_default())}

#[tauri::command]
fn attach_pick()->Result<Value,String>{system::pick_files().map(|paths|ai::attachment_paths(&paths))}

#[tauri::command]
fn attachments_prune(keep:Option<Vec<String>>)->Result<bool,String>{ai::prune(&keep.unwrap_or_default()).map(|_|true)}

#[tauri::command]
async fn notifications_access()->Result<String,String>{tauri::async_runtime::spawn_blocking(move||{notifications::status()}).await.map_err(|e|e.to_string())}

#[tauri::command]
async fn notifications_request()->Result<String,String>{tauri::async_runtime::spawn_blocking(notifications::request).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn palette_apps()->Vec<Value>{tauri::async_runtime::spawn_blocking(system::apps).await.unwrap_or_default()}

#[tauri::command]
fn palette_recent()->Vec<Value>{system::recent()}

#[tauri::command]
async fn palette_icon(path:Option<String>)->Option<String>{let path=path?;tauri::async_runtime::spawn_blocking(move||system::icon(&path)).await.ok().flatten()}

#[tauri::command]
fn power_action(action: Option<String>) -> bool {
    let act = action.unwrap_or_default().to_lowercase();
    match act.as_str() {
        "lock" => {
            std::process::Command::new("rundll32.exe")
                .args(["user32.dll,LockWorkStation"])
                .spawn()
                .is_ok()
        }
        "sleep" => {
            std::process::Command::new("rundll32.exe")
                .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                .spawn()
                .is_ok()
        }
        "restart" => {
            std::process::Command::new("shutdown.exe")
                .args(["/r", "/t", "0"])
                .spawn()
                .is_ok()
        }
        "shutdown" => {
            std::process::Command::new("shutdown.exe")
                .args(["/s", "/t", "0"])
                .spawn()
                .is_ok()
        }
        _ => false,
    }
}

#[tauri::command]
fn power_schedule(restart:Option<bool>,seconds:Option<u64>)->Result<bool,String>{let mut cmd=system::command("shutdown.exe");if let Some(seconds)=seconds{cmd.args([if restart.unwrap_or(false){"/r"}else{"/s"},"/t",&seconds.min(86400).to_string()]);}else{cmd.arg("/a");}cmd.status().map(|s|s.success()).map_err(|e|e.to_string())}

#[tauri::command]
fn dictate_toggle(target:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{speech::toggle(app,state.settings.lock().unwrap().clone(),target)}

#[tauri::command]
fn dictate_cancel(app:AppHandle)->bool{speech::cancel(&app)}

#[tauri::command]
async fn ai_models(state:tauri::State<'_, Arc<AppState>>)->Result<Vec<String>,String>{let settings=state.settings.lock().unwrap().clone();ai::models(&settings).await.map(|items|items.iter().filter_map(|m|m["id"].as_str().map(str::to_owned)).collect())}

#[tauri::command]
fn ai_chat(id:Option<u64>,messages:Option<Vec<Value>>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let id=id.ok_or("Request ID is required")?;ai::start(app,id,state.settings.lock().unwrap().clone(),messages.unwrap_or_default());Ok(true)}

#[tauri::command]
fn ai_run(id:Option<u64>,system:Option<String>,prompt:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let id=id.ok_or("Request ID is required")?;let messages=vec![json!({"role":"system","content":system.unwrap_or_default()}),json!({"role":"user","content":prompt.unwrap_or_default()})];ai::start(app,id,state.settings.lock().unwrap().clone(),messages);Ok(true)}

#[tauri::command]
fn ai_cancel(id:Option<u64>)->bool{id.map(ai::cancel).unwrap_or(false)}

#[tauri::command]
fn ai_key_set(key:Option<String>)->Result<bool,String>{let key=key.unwrap_or_default();storage::save_secret("ai",&key).map(|_|!key.is_empty())}

#[tauri::command]
fn ai_key_status()->bool{storage::load_secret("ai").map(|s|!s.is_empty()).unwrap_or(false)}

#[tauri::command]
async fn ai_test(state:tauri::State<'_, Arc<AppState>>)->Result<String,String>{let settings=state.settings.lock().unwrap().clone();let models=ai::models(&settings).await?;Ok(format!("{} models available",models.len()))}

#[tauri::command]
fn stt_key_set(key:Option<String>)->Result<bool,String>{let key=key.unwrap_or_default();storage::save_secret("stt",&key).map(|_|!key.is_empty())}

#[tauri::command]
fn stt_key_status()->bool{storage::load_secret("stt").map(|s|!s.is_empty()).unwrap_or(false)}

#[tauri::command]
async fn stt_test(state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let settings=state.settings.lock().unwrap().clone();speech::test(&settings).await}

#[tauri::command]
fn click(app:AppHandle){let _=app.emit("island:toggle",json!({}));}

#[tauri::command]
fn clipboard(app:AppHandle){let _=app.emit("island:toggle",json!({"tab":"clipboard"}));}

#[tauri::command]
fn text(app:AppHandle){let _=app.emit("island:toggle",json!({"tab":"text"}));}

#[tauri::command]
fn chat(app:AppHandle){let _=app.emit("island:toggle",json!({"tab":"chat"}));}

#[tauri::command]
fn note(app:AppHandle){let _=app.emit("island:toggle",json!({"tab":"note"}));}


static ITEM_SEQUENCE:std::sync::atomic::AtomicU64=std::sync::atomic::AtomicU64::new(0);
fn new_item_id(prefix:&str)->String{format!("{}-{}-{}",prefix,media::now_ms(),ITEM_SEQUENCE.fetch_add(1,Ordering::Relaxed))}
fn merge_settings(target:&mut Value,patch:&Value){if let(Some(target),Some(patch))=(target.as_object_mut(),patch.as_object()){for(key,value)in patch{if let Some(existing)=target.get(key){let valid=(existing.is_boolean()&&value.is_boolean())||(existing.is_number()&&value.is_number())||(existing.is_string()&&value.is_string())||(existing.is_array()&&value.is_array())||(existing.is_object()&&value.is_object());if valid{target.insert(key.clone(),value.clone());}}}}}
fn register_hotkeys(app:&AppHandle,settings:&Value)->Vec<String>{
 if win::WindowManager::passive_qa() { return Vec::new(); }
 use tauri_plugin_global_shortcut::{GlobalShortcutExt,Shortcut,ShortcutState};let manager=app.global_shortcut();let _=manager.unregister_all();let mut errors=Vec::new();
 for(key,value)in settings.as_object().into_iter().flatten(){if !key.starts_with("hotkey"){continue;}let Some(text)=value.as_str().filter(|s|!s.is_empty())else{continue;};let shortcut=match text.parse::<Shortcut>(){Ok(s)=>s,Err(_)=>{errors.push(format!("Invalid shortcut: {text}"));continue;}};let key=key.clone();if let Err(error)=manager.on_shortcut(shortcut,move|app,_,event|{if event.state==ShortcutState::Pressed{handle_hotkey(app,&key);}}){errors.push(format!("{text}: {error}"));}}

 let launcher:Value=serde_json::from_str(&storage::load_string_file("launcher_hotkeys.json","{}")).unwrap_or(json!({}));
 for (id,value) in launcher.as_object().into_iter().flatten(){
    let Some(text)=value.as_str().filter(|s|!s.is_empty())else{continue;};
    let shortcut=match text.parse::<Shortcut>(){Ok(shortcut)=>shortcut,Err(_)=>{errors.push(format!("Invalid launcher shortcut: {text}"));continue;}};
    if manager.is_registered(shortcut){errors.push(format!("Duplicate shortcut: {text}"));continue;}
    let id=id.clone();if let Err(error)=manager.on_shortcut(shortcut,move|app,_,event|{if event.state==ShortcutState::Pressed{if let Err(error)=launcher_launch(Some(id.clone()),app.state::<Arc<AppState>>()){let _=app.emit("island:warn",error);}}}){errors.push(format!("{text}: {error}"));}
 }
 errors
}
fn handle_hotkey(app:&AppHandle,key:&str){let state=app.state::<Arc<AppState>>();match key{
 "hotkeyPalette"=>{let _=app.emit("island:palette",());},"hotkeyToggle"=>{let _=app.emit("island:toggle",json!({}));},"hotkeyClipboard"=>{let _=app.emit("island:toggle",json!({"tab":"clipboard"}));},"hotkeyChat"=>{let _=app.emit("island:toggle",json!({"tab":"chat"}));},
 "hotkeyArea"|"hotkeyScreen"|"hotkeyOcr"|"hotkeyQr"|"hotkeyColor"|"hotkeyRecord"=>{let mode=match key{"hotkeyScreen"=>"screen","hotkeyOcr"=>"ocr","hotkeyQr"=>"qr","hotkeyColor"=>"color","hotkeyRecord"=>"record",_=>"area"};let _=capture_start(Some(mode.into()),app.clone(),state);},
 "hotkeyPlainPaste"=>{if let Some(text)=clip_current_text(){let _=clipboard::paste_to_focused_window(&text);}},"hotkeyMic"=>{let _=audio::toggle_mute(true);},"hotkeyThrough"=>{let _=through_toggle(app.clone(),state);},"hotkeyTheme"=>{let mut settings=state.settings.lock().unwrap();let next=if settings["theme"]==json!("dark"){"light"}else{"dark"};settings["theme"]=json!(next);let _=storage::save_json_file("settings.json",&settings);let _=app.emit("settings:changed",settings.clone());},
 "hotkeyMediaPill"=>{let mut settings=state.settings.lock().unwrap();let kinds=["normal","title","player","lyrics"];let current=settings["mediaPill"].as_str().unwrap_or("normal");let next=kinds[(kinds.iter().position(|s|*s==current).unwrap_or(0)+1)%kinds.len()];settings["mediaPill"]=json!(next);let _=storage::save_json_file("settings.json",&settings);let _=app.emit("settings:changed",settings.clone());},
 "hotkeyDictate"=>{let _=speech::toggle(app.clone(),state.settings.lock().unwrap().clone(),None);},
 "hotkeyVpn"=>{let app=app.clone();tauri::async_runtime::spawn(async move{let _=vpn_toggle_now(app).await;});},
 "hotkeyWebAi"=>{let _=webai::open(app,None);},
 _=>{let _=app.emit("island:warn","This shortcut integration is unavailable");}}}
fn play_chime(sound:Option<&str>)->bool{if let Some(path)=sound.filter(|s|!s.is_empty()){let path:Vec<u16>=path.encode_utf16().chain(Some(0)).collect();unsafe{windows::Win32::Media::Audio::PlaySoundW(windows::core::PCWSTR(path.as_ptr()),None,windows::Win32::Media::Audio::SND_ASYNC|windows::Win32::Media::Audio::SND_FILENAME).as_bool()}}else{unsafe{windows::Win32::Media::Audio::PlaySoundW(windows::core::w!("SystemNotification"),None,windows::Win32::Media::Audio::SND_ASYNC|windows::Win32::Media::Audio::SND_ALIAS).as_bool()}}}

#[tauri::command]
fn window_diagnostics(snapshot:Option<bool>,state:tauri::State<'_, Arc<AppState>>)->Value{
    let handle = *state.main_hwnd.lock().unwrap();
    let Some(handle) = handle else { return Value::Null; };
    let hwnd = HWND(handle as _);
    let mut diagnostics = win::WindowManager::diagnostics(hwnd);
    if snapshot.unwrap_or(false) {
        if let Some(rect) = win::WindowManager::get_window_rect(hwnd) {
            match capture::screenshot(rect).and_then(|image| capture::data_url(&image)) {
                Ok(image) => diagnostics["snapshot"] = json!(image),
                Err(error) => diagnostics["snapshotError"] = json!(error),
            }
        }
    }
    diagnostics
}

/* ==========================================================================
   APPLICATION ENTRYPOINT
   ========================================================================== */

pub fn app_log(msg: &str) {
    use std::io::Write;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let app_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(app_dir.join("app.log")) {
        let _ = writeln!(f, "[+{}] {}", ts, msg);
    }
}

pub fn run() {
    std::panic::set_hook(Box::new(|info| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            *s
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.as_str()
        } else {
            "non-string payload"
        };
        app_log(&format!("FATAL PANIC: {} at {:?}", payload, info.location()));
    }));
    app_log("run() entered");
    let _mta_lifetime = audio::MtaLifetime::new().expect("Cannot keep Windows MTA alive");

    // Single instance protection via named mutex in user local session
    let mutex_name = if win::WindowManager::passive_qa() {
        use std::hash::{Hash,Hasher};let mut hash=std::collections::hash_map::DefaultHasher::new();storage::get_storage_dir().hash(&mut hash);format!("Local\\WoodsIslandQA{:x}",hash.finish())
    }else{"Local\\WoodsIslandSingleInstance".into()};
    let mutex_name:Vec<u16>=mutex_name.encode_utf16().chain(Some(0)).collect();
    let mutex = unsafe { windows::Win32::System::Threading::CreateMutexW(None, true, windows::core::PCWSTR(mutex_name.as_ptr())) };
    if let Ok(_m) = mutex {
        let err = unsafe { windows::Win32::Foundation::GetLastError() };
        if err == windows::Win32::Foundation::ERROR_ALREADY_EXISTS {
            if win::WindowManager::passive_qa() {return;}
            app_log("Instance already running. Focusing settings window and exiting second instance cleanly.");
            unsafe {
                let win_name = windows::core::w!("Woods Island — настройки");
                if let Ok(hwnd) = windows::Win32::UI::WindowsAndMessaging::FindWindowW(None, win_name) {
                    if !hwnd.0.is_null() {
                        let _ = windows::Win32::UI::WindowsAndMessaging::ShowWindow(hwnd, windows::Win32::UI::WindowsAndMessaging::SW_SHOW);
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow(hwnd);
                    }
                }
            }
            return;
        }
    }
    app_log("step 1: mutex OK");

    let app_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let db_path = storage::get_storage_dir().join("woods_island.db");
    let old_db = app_dir.join("woods_island.db");
    if !db_path.exists() && old_db.exists() && std::env::var_os("WOODS_ISLAND_DATA_DIR").is_none() { let _ = std::fs::copy(old_db, &db_path); }
    let clipboard_store = ClipboardStore::new(db_path).expect("Failed to open clipboard SQLite db");
    app_log("step 2: clipboard db OK");

    let mut loaded_settings = default_settings();
    if let Some(saved) = storage::load_json_file("settings.json") { merge_settings(&mut loaded_settings, &saved); }
    audio::configure(&loaded_settings);
    network::configure_vpn(&loaded_settings);
    if loaded_settings["gpuAcceleration"]==false {
        let arguments=std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", format!("{arguments} --disable-gpu"));
    }
    // WinRT radio discovery requires MTA; the window thread belongs to OLE/STA.
    let loaded_controls = std::thread::spawn(system::controls).join()
        .unwrap_or_else(|_| json!({"wifi":null,"bluetooth":null,"dark":null,"ethernet":null,"vpns":[]}));

    let loaded_launcher_groups = storage::load_string_file("launcher_groups.json", "{}");
    let loaded_launcher_hotkeys = storage::load_string_file("launcher_hotkeys.json", "{}");
    let loaded_timer = storage::load_string_file("timer.json", "");
    let loaded_reminders = storage::load_string_file("reminders.json", "[]");
    let loaded_notes = storage::load_string_file("notes.json", "");
    let loaded_note_folders = storage::load_string_file("note_folders.json", "{}");
    let loaded_chat = storage::load_string_file("chat.json", "[]");
    app_log("step 3: storage files loaded OK");

    let state = Arc::new(AppState {
        is_expanded: AtomicBool::new(false),
        is_tall: AtomicBool::new(false),
        click_through: AtomicBool::new(false),
        clipboard_store,
        settings: std::sync::Mutex::new(loaded_settings),
        settings_target: std::sync::Mutex::new(None),
        hotkey_errors: std::sync::Mutex::new(Vec::new()),
        island_rect: std::sync::Mutex::new(IslandRect {
            x: 270,
            y: 0,
            w: 220,
            h: 42,
            expanded: false,
        }),
        main_hwnd: std::sync::Mutex::new(None),
        controls: std::sync::Mutex::new(loaded_controls),
        launcher_groups: std::sync::Mutex::new(loaded_launcher_groups),
        launcher_hotkeys: std::sync::Mutex::new(loaded_launcher_hotkeys),
        timer_data: std::sync::Mutex::new(loaded_timer),
        reminders_data: std::sync::Mutex::new(loaded_reminders),
        note_data: std::sync::Mutex::new(loaded_notes),
        note_folders_data: std::sync::Mutex::new(loaded_note_folders),
        chat_data: std::sync::Mutex::new(loaded_chat),
        shelf_items: std::sync::Mutex::new(storage::load_json_file("shelf.json").and_then(|v|v.as_array().cloned()).unwrap_or_default()),
        launcher_items: std::sync::Mutex::new(storage::load_json_file("launcher.json").and_then(|v|v.as_array().cloned()).unwrap_or_default()),
    });
    app_log("step 3.5: AppState Arc created OK");

    let state_clone = state.clone();
    app_log("step 4: calling tauri::Builder::default()");
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_drag::init())
        .manage(state)
        .setup(move |app| {
            app_log("setup hook executing");
            if let Some(window) = app.get_webview_window("main") {
                app_log("found main webview window");
                let _win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        app_log("main window CloseRequested prevented");
                    }
                });
                if let Ok(hwnd) = window.hwnd() {
                    app_log(&format!("main hwnd: {:?}", hwnd.0));
                    let hwnd_val = hwnd.0 as isize;
                    *state_clone.main_hwnd.lock().unwrap() = Some(hwnd_val);
                    if win::WindowManager::passive_qa() { window.set_focusable(false)?; }
                    win::WindowManager::setup_island_window(windows::Win32::Foundation::HWND(hwnd.0 as _), 760, 480);
                    app_log("setup_island_window completed");
                    window.set_content_protected(!state_clone.settings.lock().unwrap()["captureVisible"].as_bool().unwrap_or(false))?;
                    apply_island_geometry(app.handle(), &state_clone).map_err(std::io::Error::other)?;
                }
            }
            for win_label in ["overlay"] {
                if let Some(w) = app.get_webview_window(win_label) {
                    if win::WindowManager::passive_qa() {
                        w.set_focusable(false)?;
                    }
                    app_log(&format!("configuring close prevention for window: {}", win_label));
                    let win_clone = w.clone();
                    w.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = win_clone.hide();
                        }
                    });
                }
            }
            clipboard::start_watcher(app.handle().clone(), state_clone.clone());
            obs::start_loop(app.handle().clone(), state_clone.clone());
            agents::start(app.handle().clone());
            start_update_monitor(app.handle().clone(), state_clone.clone());
            notifications::start(app.handle().clone(), state_clone.clone());
            telemetry::start(app.handle().clone(), state_clone.clone());
            network::start_controls_monitor(app.handle().clone(), state_clone.clone());
            let hotkey_errors = register_hotkeys(app.handle(), &state_clone.settings.lock().unwrap().clone());
            *state_clone.hotkey_errors.lock().unwrap()=hotkey_errors.clone();
            if !hotkey_errors.is_empty() { app_log("Some global shortcuts could not be registered"); }
            start_cursor_loop(app.handle().clone(), state_clone);
            app_log("start_cursor_loop launched");
            media::start_media_loop(app.handle().clone());
            app_log("start_media_loop launched");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_diagnostics,
            bootstrap,
            report_page_scale,
            report_island_rect,
            web_ai_popped,
            web_ai_open,
            web_ai_embed,
            web_ai_hide,
            web_ai_browser,
            web_ai_window,
            web_ai_window_close,
            web_ai_window_show,
            agents_now,
            agents_connect,
            agents_connections,
            agents_answer,
            runs_as_admin,
            news_told,
            news_get,
            license_status,
            license_activate,
            license_remove,
            settings_get,
            settings_set,
            settings_target,
            monitors_list,
            shelf_list,
            shelf_add,
            shelf_remove,
            shelf_clear,
            launcher_list,
            launcher_add,
            launcher_add_link,
            launcher_edit_link,
            launcher_remove,
            launcher_launch,
            launcher_link_icon,
            launcher_pick_icon,
            launcher_groups_get,
            launcher_groups_set,
            launcher_hotkeys_get,
            launcher_hotkeys_set,
            controls_get,
            controls_set,
            obs_state,
            obs_password_set,
            obs_password_status,
            weather_get,
            weather_refresh,
            weather_search,
            rates,
            take_focus,
            release_focus,
            clip_list,
            clip_paste,
            clip_pin,
            clip_delete,
            clip_clear,
            clip_current_text,
            clip_set_text,
            clip_set_png,
            media_control,
            media_sources,
            media_pick,
            media_rename,
            media_seek,
            lyrics_get,
            player_volume,
            player_volume_set,
            audio_devices,
            audio_inputs,
            audio_set_default,
            volume_set,
            volume_step,
            volume_mute_toggle,
            mic_toggle,
            wifi_networks,
            wifi_join,
            wifi_leave,
            bt_devices,
            bt_switch,
            vpn_chip,
            vpn_refresh,
            vpn_toggle_now,
            theme_flip,
            through_toggle,
            hover,
            island_tall,
            set_island_hidden,
            fullscreen,
            hotkeys_check,
            open_settings,
            open_path,
            open_captures,
            run_shell,
            quit,
            restart_island,
            update_check,
            update_install,
            timer_get,
            timer_set,
            reminders_get,
            reminders_set,
            note_folders_get,
            note_folders_set,
            note_export,
            note_get,
            note_set,
            chat_get,
            chat_set,
            color_history,
            color_pick,
            color_patch,
            picker_size,
            pick_sound,
            chime,
            chime_try,
            capture_start,
            capture_cancel,
            capture_region,
            capture_region_drawn,
            prtsc_taken,
            record_start,
            record_begin,
            record_stop,
            ocr_file,
            upload_image,
            editor_open,
            editor_save,
            editor_image,
            files_held,
            files_search,
            files_warm,
            attach_data,
            attach_paths,
            attach_pick,
            attachments_prune,
            notifications_access,
            notifications_request,
            palette_apps,
            palette_recent,
            palette_icon,
            power_action,
            power_schedule,
            dictate_toggle,
            dictate_cancel,
            ai_models,
            ai_chat,
            ai_run,
            ai_cancel,
            ai_key_set,
            ai_key_status,
            ai_test,
            stt_key_set,
            stt_key_status,
            stt_test,
            click,
            clipboard,
            text,
            chat,
            note
        ]);
    app_log("step 5: about to call .build()");
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building Woods Island application");
    app_log("step 6: .build() succeeded, about to call .run()");
    app.run(|_app, event| {
        match &event {
            tauri::RunEvent::Ready => {
                app_log("RunEvent::Ready received!");
            }
            tauri::RunEvent::ExitRequested { api, code, .. } => {
                app_log(&format!("RunEvent::ExitRequested with code {:?}", code));
                if code.is_none() { api.prevent_exit(); } else { finalize_background(_app); }
            }
            _ => {
                app_log(&format!("RunEvent: {:?}", event));
            }
        }
    });
}
