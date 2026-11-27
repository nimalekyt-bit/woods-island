#[cfg(all(test, target_env = "msvc"))]
#[link(name = "resource", kind = "static", modifiers = "-bundle")]
extern "C" {}

pub mod audio;
mod audio_mixer;
mod brightness;
mod system_load;
pub mod speech;
pub mod recorder;
pub mod agents;
pub mod documents;
pub mod network;
pub mod webai;
pub mod notifications;
pub mod telemetry;
mod file_owners;
pub mod peripherals;
pub mod steam;
pub mod notes;
pub mod ai;
mod ai_http;
pub mod capture;
pub mod everything;
pub mod system;
mod app_inventory;
pub mod clipboard;
pub mod media;
pub mod lyrics;
pub mod music_bridge;
pub mod obs;
pub mod storage;
pub mod weather;
mod weather_places;
pub mod win;
mod visibility;
pub mod pets;
pub mod updates;
pub mod watchdog;
pub mod phone;
pub mod snow_surface;
pub mod appbar;
pub mod clips;
pub mod diagnostics;
#[cfg(test)]
mod update_tests;

use clipboard::ClipboardStore;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener, Manager};
use windows::Win32::Foundation::HWND;

static ISLAND_LOW_POWER: AtomicBool = AtomicBool::new(false);
static ISLAND_FULLSCREEN: AtomicBool = AtomicBool::new(false);
static SETTINGS_VERSION: AtomicU64 = AtomicU64::new(1);

pub fn is_low_power() -> bool {
    ISLAND_LOW_POWER.load(Ordering::Relaxed)
}

pub fn is_fullscreen_active() -> bool {
    ISLAND_FULLSCREEN.load(Ordering::Relaxed)
}

fn update_low_power(tucked: bool, hidden: bool, fullscreen: bool) {
    let low = tucked || hidden || fullscreen;
    let prev = ISLAND_LOW_POWER.swap(low, Ordering::Relaxed);
    if prev && !low {
        media::notify_wake();
    }
    if prev != low { system_load::configure(); }
}

static AUX_WINDOW_BUILD: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn ensure_aux_window(app: &AppHandle, label: &str) -> Result<tauri::WebviewWindow, String> {
    let _build = AUX_WINDOW_BUILD.lock().map_err(|_| "Window creation lock poisoned")?;
    if let Some(window) = app.get_webview_window(label) { return Ok(window); }
    let config = app.config().app.windows.iter().find(|config| config.label == label).ok_or("Window configuration unavailable")?;
    let window = tauri::WebviewWindowBuilder::from_config(app, config).map_err(|e|e.to_string())?.build().map_err(|e|e.to_string())?;
    if win::WindowManager::passive_qa() { window.set_focusable(false).map_err(|e|e.to_string())?; }
    watchdog::attach_process_failed(&window);
    if label == "settings" {
        // On high-DPI screens (e.g. 4K @ 250-300%), clamp settings window cleanly inside the monitor work area.
        if let Ok(Some(monitor)) = window.current_monitor().or_else(|_| app.primary_monitor()) {
            let scale = monitor.scale_factor().max(1.0);
            let max_w = ((monitor.size().width as f64 / scale) * 0.92).floor().max(660.0);
            let max_h = ((monitor.size().height as f64 / scale) * 0.88).floor().max(480.0);
            if config.width > max_w || config.height > max_h {
                let _ = window.set_size(tauri::LogicalSize::new(config.width.min(max_w), config.height.min(max_h)));
                let _ = window.center();
            }
        }
        win::track_settings_visibility(&window)?;
    }
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
    pub is_tucked: AtomicBool,
    pub is_hidden: AtomicBool,
    pub click_through: AtomicBool,
    pub clipboard_store: ClipboardStore,
    pub settings: std::sync::Mutex<Value>,
    pub settings_target: std::sync::Mutex<Option<String>>,
    pub hotkey_errors: std::sync::Mutex<Vec<String>>,
    pub island_rect: std::sync::Mutex<IslandRect>,
    pub main_hwnd: std::sync::Mutex<Option<isize>>,
    pub active_monitor: std::sync::Mutex<Option<String>>,
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
    "hideTrayIcon": false,
    "hoverDelayMs": 150,
    "openOnHover": false,
    "collapseDelayMs": 350,
    "style": "notch",
    "snow": "auto",
    "snowFrom": "12-15",
    "snowTo": "01-15",
    "snowAmount": 100,
    "snowFall": true,
    "snowCap": true,
    "snowScreen": false,
    "garland": "off",
    "hideInFullscreen": true,
    "mediaHidden": [],
    "hideOnlyUnder": false,
    "fullscreenEdge": false,
    "releaseHotkeysInFullscreen": false,
    "captureVisible": false,
    "autoHide": false,
    "autoHideMusic": false,
    "hotkeyAutoHide": "",
    "showOnDesktop": false,
    "through": false,
    "opacityThrough": 45,
    "offsetX": 0,
    "underTaskbar": true,
    "notchBar": false,
    "notchLook": "black",
    "monitor": "",
    "monitorFollowCursor": false,
    "fullscreenMoveToOtherMonitor": false,
    "liquidSpectrum": false,
    "opacityRest": 100,
    "opacityOpen": 100,
    "scale": 100,
    "islandRadius": 100,
    "dropZoneOrder": "shelf_first",
    "theme": "dark",
    "islandColor": "",
    "shotDraw": false,
    "showClock": true,
    "clockSeconds": false,
    "clockFormat": "auto",
    "showBattery": true,
    "showPeripherals": true,
    "deviceBattery": "off",
    "deviceBatteryLow": 20,
    "loadInPill": [],
    "peripheralHidden": [],
    "peripheralLimit": 3,
    "peripheralUnknown": true,
    "peripheralCharging": true,
    "peripheralSort": "type",
    "peripheralAlerts": false,
    "peripheralLowThreshold": 20,
    "peripheralNotifyLow": true,
    "peripheralNotifyCharging": true,
    "peripheralNotifyUnplugged": true,
    "peripheralNotifyFull": true,
    "peripheralNotifyConnection": false,
    "peripheralNotifyDisconnection": false,
    "peripheralNames": "{}",
    "peripheralMuted": [],
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
    "hotkeyVoiceCommand": "",
    "hotkeyThrough": "",
    "hotkeyVpn": "",
    "hotkeyMediaPill": "",
    "hotkeyTheme": "",
    "hotkeyFullscreen": "",
    "hotkeyWebAi": "",
    "cardTime": "normal",
    "homeHidden": [],
    "tabsHidden": [],
    "liquidWith": false,
    "favoriteCharacters": [],
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
    "paletteEverything": true,
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
    "downloadsTorrents": false,
    "checkUpdates": true,
    "autoDownloadUpdates": true,
    "onboardingCompleted": false,
    "reducedMotion": "auto",
    "weatherTimezone": "",
    "weatherUtcOffset": null,
    "mascot": true,
    "character": "liquid",
    "characterMusic": "",
    "characterSize": "normal",
    "language": "auto",
    "aiBaseUrl": "http://127.0.0.1:11434/v1",
    "aiModel": "",
    "aiProxy": "",
    "sttBaseUrl": "https://api.groq.com/openai/v1",
    "sttModel": "whisper-large-v3-turbo",
    "sttLanguage": "",
    "obsidianVaultPath": "",
    "dictatePaste": false,
    "moduleWeather": true,
    "weatherCity": "",
    "weatherPlaces": "[]",
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
    let window = app.get_window("main").ok_or("Main window unavailable")?;
    let settings = state.settings.lock().unwrap().clone();
    let zoom = island_zoom(&settings);
    app.get_webview("main").ok_or("Main view unavailable")?.set_zoom(zoom).map_err(|e|e.to_string())?;
    win::WindowManager::set_zoom(zoom);
    let monitors = app.available_monitors().map_err(|e|e.to_string())?;
    let primary = app.primary_monitor().map_err(|e|e.to_string())?;
    let active_override = state.active_monitor.lock().unwrap().clone();
    let preferred = settings["monitor"].as_str().unwrap_or("");
    let monitor = active_override
        .as_deref()
        .and_then(|ov| monitors.iter().find(|m| m.name().map(|n| n == ov).unwrap_or(false)))
        .or_else(|| (!preferred.is_empty()).then(|| monitors.iter().find(|m| m.name().map(|n| n == preferred).unwrap_or(false))).flatten())
        .or(primary.as_ref())
        .or(monitors.first())
        .ok_or("Monitor unavailable")?;
    let hwnd = HWND(window.hwnd().map_err(|e|e.to_string())?.0 as _);
    win::WindowManager::position_on_monitor(hwnd, monitor.position().x, monitor.position().y, monitor.size().width as i32, monitor.size().height as i32, monitor.scale_factor(), zoom, settings["offsetX"].as_i64().unwrap_or(0).clamp(-10000,10000) as i32, settings["underTaskbar"].as_bool().unwrap_or(true), state.is_tall.load(Ordering::Relaxed));
    let rect = *state.island_rect.lock().unwrap();
    win::WindowManager::update_island_region(hwnd, if state.is_tucked.load(Ordering::Relaxed){None}else{Some((rect.x-4,0,rect.x+rect.w+4,rect.y+rect.h+6))});
    Ok(())
}

fn start_cursor_loop(app: AppHandle, state: Arc<AppState>) {
    // The acceptance runner supplies its own hover/click events. Real desktop
    // clicks and fullscreen changes must not collapse its cards mid-assertion.
    if win::WindowManager::passive_qa() { return; }
    let _ = std::thread::Builder::new().name("woods-cursor-loop".into()).spawn(move || {
        let mut is_hovered = false;
        let mut is_edge = false;
        let mut mouse_down = false;
        let mut last_near: Option<(i32, i32)> = None;
        let mut unfolded_anchor: Option<visibility::Bounds> = None;
        let mut last_context = Value::Null;
        let mut last_check = std::time::Instant::now() - std::time::Duration::from_secs(1);
        let mut last_monitor_check = std::time::Instant::now() - std::time::Duration::from_secs(10);
        let mut cached_settings = state.settings.lock().unwrap().clone();
        let mut cached_settings_ver = SETTINGS_VERSION.load(Ordering::Relaxed);
        let mut geometry_key = String::new();
        let mut last_scale_factor: f64 = 0.0;
        let mut last_monitor_name: Option<String> = None;
        let mut last_monitor_x: i32 = 0;
        let mut pending_cursor_monitor: Option<String> = None;
        let mut allow_edge = false;

        loop {
            let tucked = state.is_tucked.load(Ordering::Relaxed);
            let hidden = state.is_hidden.load(Ordering::Relaxed);
            let sleep_ms = if (tucked || hidden) && !allow_edge { 100 } else { 25 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));

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
            let inside_pill = rect.y + rect.h > 0 && (rel_x >= (rect.x - pad_x) && rel_x <= (rect.x + rect.w + pad_x))
                && (rel_y >= 0 && rel_y <= (rect.y + rect.h + pad_bottom));

            // Cursor touching top 3 pixels near island activates edge unfold
            let at_top_edge = rel_y >= -2 && rel_y <= 3 && (rel_x >= (rect.x - 20) && rel_x <= (rect.x + rect.w + 20));

            let canvas_css_w = (win_rect.right - win_rect.left) as f64 / scale;
            let canvas_css_h = (win_rect.bottom - win_rect.top) as f64 / scale;
            if !tucked
                && !hidden
                && (rel_x as f64) > -150.0
                && (rel_x as f64) < canvas_css_w + 150.0
                && (rel_y as f64) > -100.0
                && (rel_y as f64) < canvas_css_h + 100.0
            {
                if last_near != Some((rel_x, rel_y)) {
                    last_near = Some((rel_x, rel_y));
                    let canvas_center = canvas_css_w / 2.0;
                    // Target only "main" so hidden overlay / settings never receive 40Hz ExecuteScript churn.
                    let _ = app.emit_to("main", "cursor:near", [rel_x as f64 - canvas_center, rel_y as f64]);
                }
            } else {
                last_near = None;
            }
            if rect.expanded {
                let down = unsafe { windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(0x01) < 0 };
                if down && !mouse_down && !inside_pill && !win::WindowManager::qa_input_disabled() { let _ = app.emit_to("main", "outside-click", ()); }
                mouse_down = down;
            } else {
                mouse_down = false;
            }

            let click_through = state.click_through.load(Ordering::Relaxed);
            let effective_inside = inside_pill && !click_through;
            win::WindowManager::set_hover_passthrough(!effective_inside);
            if effective_inside != is_hovered {
                is_hovered = effective_inside;
                let _ = app.emit_to("main", "hover", is_hovered);
            }

            let at_top_edge = at_top_edge && allow_edge;
            if at_top_edge != is_edge {
                is_edge = at_top_edge;
                let _ = app.emit_to("main", "island:edge", is_edge);
            }
            let check_interval = if (tucked || hidden) && ISLAND_FULLSCREEN.load(Ordering::Relaxed) {
                std::time::Duration::from_millis(800)
            } else {
                std::time::Duration::from_millis(500)
            };
            if last_check.elapsed() >= check_interval {
                last_check = std::time::Instant::now();
                let current_ver = SETTINGS_VERSION.load(Ordering::Relaxed);
                let settings_changed = current_ver != cached_settings_ver;
                if settings_changed {
                    cached_settings = state.settings.lock().unwrap().clone();
                    cached_settings_ver = current_ver;
                }
                let settings = &cached_settings;
                if !win::WindowManager::passive_qa()
                    && !hidden
                    && !capture::is_capturing()
                    && !unsafe { windows::Win32::UI::WindowsAndMessaging::IsWindowVisible(hwnd) }.as_bool()
                {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = apply_island_geometry(&app, &state);
                    }
                }
                let mut context = win::WindowManager::system_context(hwnd);
                let recording_until=HOTKEY_RECORDING_UNTIL.load(Ordering::Relaxed);
                if recording_until>0 && (media::now_ms()>=recording_until || !settings_is_foreground(&app)) {
                    HOTKEY_RECORDING_UNTIL.store(0,Ordering::Relaxed);let errors=register_hotkeys(&app,settings);*state.hotkey_errors.lock().unwrap()=errors;
                }
                let top = if settings["style"] == "capsule" { 8 } else { 0 };
                let local = visibility::unfolded_bounds(visibility::Bounds { left:rect.x, top, right:rect.x+rect.w, bottom:top+rect.h.max(1) }, tucked, &mut unfolded_anchor);
                let anchor = visibility::Bounds { left:win_rect.left+(local.left as f64*scale).round() as i32, top:win_rect.top+(local.top as f64*scale).round() as i32, right:win_rect.left+(local.right as f64*scale).round() as i32, bottom:win_rect.top+(local.bottom as f64*scale).round() as i32 };
                context["under"]=json!(visibility::Bounds::from_json(&context["bounds"]).is_some_and(|window|anchor.intersects(window)));
                let follow_cursor = settings["monitorFollowCursor"].as_bool().unwrap_or(false);
                let fullscreen_move = settings["fullscreenMoveToOtherMonitor"].as_bool().unwrap_or(false);
                let fs_monitor_bounds = visibility::Bounds::from_json(&context["fullscreenMonitor"]);
                let dpi_dirty = win::WindowManager::take_dpi_dirty();
                if dpi_dirty || settings_changed || follow_cursor || fullscreen_move || last_monitor_check.elapsed() >= std::time::Duration::from_secs(3) {
                    last_monitor_check = std::time::Instant::now();
                    let monitors = app.available_monitors().unwrap_or_default();
                    let primary = app.primary_monitor().ok().flatten();
                    let descs: Vec<visibility::MonitorDescriptor> = monitors.iter().map(|m| {
                        let is_primary = primary.as_ref().map(|p| p.position() == m.position() && p.name() == m.name()).unwrap_or(false);
                        visibility::MonitorDescriptor {
                            name: m.name().cloned().unwrap_or_default(),
                            left: m.position().x,
                            top: m.position().y,
                            width: m.size().width as i32,
                            height: m.size().height as i32,
                            primary: is_primary,
                        }
                    }).collect();
                    let preferred = settings["monitor"].as_str().unwrap_or("");
                    if let Some(target_idx) = visibility::select_target_monitor(
                        &descs,
                        preferred,
                        follow_cursor,
                        Some((cursor_x, cursor_y)),
                        fullscreen_move,
                        fs_monitor_bounds,
                        rect.expanded,
                    ) {
                        let target_name = descs[target_idx].name.clone();
                        let current_active = state.active_monitor.lock().unwrap().clone();
                        let evacuated = fullscreen_move && fs_monitor_bounds.is_some_and(|fs| descs[target_idx].bounds() != fs);
                        // For follow-cursor-only switches, require 1 consecutive 500ms tick so brushing a screen edge doesn't jitter.
                        let should_switch = if current_active.as_deref() == Some(target_name.as_str()) {
                            pending_cursor_monitor = None;
                            true
                        } else if !follow_cursor || evacuated || dpi_dirty || settings_changed || current_active.is_none() {
                            pending_cursor_monitor = None;
                            true
                        } else if pending_cursor_monitor.as_deref() == Some(target_name.as_str()) {
                            pending_cursor_monitor = None;
                            true
                        } else {
                            pending_cursor_monitor = Some(target_name.clone());
                            false
                        };
                        if should_switch {
                            if !follow_cursor && !fullscreen_move {
                                *state.active_monitor.lock().unwrap() = None;
                            } else {
                                *state.active_monitor.lock().unwrap() = Some(target_name.clone());
                            }
                            let monitor = &monitors[target_idx];
                            if evacuated {
                                // Island moved onto a free monitor, so it is no longer covered by the fullscreen app.
                                context["fullscreen"] = json!(false);
                            }
                            let key = format!("{}|{}|{}|{}|{}|{:?}|{:?}|{}", settings["scale"], settings["monitor"], target_name, settings["offsetX"], settings["underTaskbar"], monitor.position(), monitor.size(), monitor.scale_factor());
                            if dpi_dirty || key != geometry_key {
                                let moved_monitor = last_monitor_name
                                    .as_deref()
                                    .is_some_and(|prev| prev != target_name.as_str());
                                let move_dir = if monitor.position().x >= last_monitor_x { "right" } else { "left" };
                                last_monitor_name = Some(target_name.clone());
                                last_monitor_x = monitor.position().x;
                                geometry_key = key;
                                let scale_changed = last_scale_factor > 0.0 && (monitor.scale_factor() - last_scale_factor).abs() > 0.01;
                                last_scale_factor = monitor.scale_factor();
                                if moved_monitor && !tucked && !hidden {
                                    let _ = app.emit_to("main", "island:monitor-move", json!({"phase": "leave", "direction": move_dir}));
                                    std::thread::sleep(std::time::Duration::from_millis(145));
                                }
                                if let Err(e) = apply_island_geometry(&app, &state) {
                                    app_log(&format!("Island geometry: {e}"));
                                } else {
                                    if dpi_dirty || scale_changed {
                                        let _ = app.emit_to("main", "island:dpi-changed", monitor.scale_factor());
                                    }
                                    if moved_monitor && !tucked && !hidden {
                                        let _ = app.emit_to("main", "island:monitor-move", json!({"phase": "arrive", "direction": move_dir}));
                                    }
                                }
                            }
                        }
                    }
                }
                let policy=visibility::resolve(settings,&context);
                allow_edge=policy.edge;
                let fs_now = context["fullscreen"].as_bool().unwrap_or(false);
                ISLAND_FULLSCREEN.store(fs_now, Ordering::Relaxed);
                update_low_power(tucked, hidden, fs_now && policy.fullscreen);
                let suspend=fs_now&&settings["releaseHotkeysInFullscreen"].as_bool().unwrap_or(false);
                if FULLSCREEN_SHORTCUTS.swap(suspend,Ordering::Relaxed)!=suspend {let errors=register_hotkeys(&app,settings);*state.hotkey_errors.lock().unwrap()=errors;}
                let context_key = json!([context,settings["hideInFullscreen"],settings["hideForApps"],settings["keepForApps"],settings["hideOnlyUnder"],settings["fullscreenEdge"]]);
                if context_key != last_context {
                    let _ = app.emit_to("main", "fullscreen", policy.fullscreen);
                    let _ = app.emit_to("main", "island:shy", policy.shy);
                    let _ = app.emit_to("main", "island:keep", policy.keep);
                    let _ = app.emit_to("main", "island:desktop", policy.desktop);
                    last_context = context_key;
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
async fn bootstrap(state:tauri::State<'_, Arc<AppState>>)->Result<Value,String>{let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||{app_log("bootstrap worker entered");let result={let telemetry=telemetry::snapshot();json!({"settings":state.settings.lock().unwrap().clone(),"shelf":shelf_snapshot(&state),"launcher":state.launcher_items.lock().unwrap().clone(),"media":media::get_current_media(),"cover":media::get_current_cover(),"hotkeyErrors":state.hotkey_errors.lock().unwrap().clone(),"audio":audio::state().ok(),"privacy":telemetry["privacy"],"downloads":telemetry::downloads_snapshot(),"vpn":null,"update":null,"version":env!("CARGO_PKG_VERSION"),"capsLock":telemetry["capsLock"],"layout":telemetry["layout"],"license":license_status(),"recoveryWarnings":storage::recovery_warnings(),"clipboardTemporary":state.clipboard_store.is_temporary(),"clipboardPreviewLimit":clipboard::PREVIEW_LIMIT,"trialOver":false,"news":news_get(),"battery":telemetry["battery"],"vdesk":telemetry["vdesk"]})};app_log("bootstrap worker completed");result}).await.map_err(|e|e.to_string())}

#[tauri::command]
async fn pets_catalog()->Result<Value,String>{tauri::async_runtime::spawn_blocking(||pets::import_profile(&storage::get_storage_dir(),false)).await.map_err(|e|e.to_string())}
#[tauri::command]
async fn pets_import_codex(app:AppHandle)->Result<Value,String>{let result=tauri::async_runtime::spawn_blocking(||pets::import_profile(&storage::get_storage_dir(),true)).await.map_err(|e|e.to_string())?;let _=app.emit("pets:changed",&result);Ok(result)}
#[tauri::command]
async fn pets_asset(id:String)->Result<String,String>{tauri::async_runtime::spawn_blocking(move||pets::load_asset(&storage::get_storage_dir(),&id)).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn report_page_scale(width: Option<f64>, state: tauri::State<'_, Arc<AppState>>) {
    if width.map(|w|w.is_finite()&&w>0.0).unwrap_or(false) {
        if let Some(value) = *state.main_hwnd.lock().unwrap() {
            win::WindowManager::report_page_width(HWND(value as _), width.unwrap());
            let rect = *state.island_rect.lock().unwrap();
            win::WindowManager::update_island_region(HWND(value as _),if rect.y+rect.h<=0{None}else{Some((rect.x-4,0,rect.x+rect.w+4,rect.y+rect.h+6))});
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
    attachment_right: Option<f64>,
    attachment_bottom: Option<f64>,
    settling: Option<bool>,
    state: tauri::State<'_, Arc<AppState>>,
) -> Value {
    if ![x,y,w,h].iter().all(|v|v.is_finite()) || w<0.0 || h<0.0 { return Value::Null; }
    let right = win::safe_visual_inset(attachment_right);
    let bottom = win::safe_visual_inset(attachment_bottom);
    let hwnd_value = *state.main_hwnd.lock().unwrap();
    let canvas = hwnd_value.filter(|value| *value != 0).map(|value| {
        win::WindowManager::ensure_attachment_canvas(windows::Win32::Foundation::HWND(value as _), right, bottom)
    });
    let mut rect = state.island_rect.lock().unwrap();
    rect.x = (x + canvas.as_ref().map(|canvas| canvas.shift_x).unwrap_or(0.0)).floor() as i32;
    rect.y = y.floor() as i32;
    rect.w = w.ceil() as i32;
    rect.h = h.ceil() as i32;
    rect.expanded = expanded;
    let actually_tucked=tucked&&rect.y+rect.h<=0;
    if state.is_tucked.swap(actually_tucked,Ordering::Relaxed)!=actually_tucked{
        snow_surface::set_island_visible(!actually_tucked);
        update_low_power(actually_tucked, state.is_hidden.load(Ordering::Relaxed), ISLAND_FULLSCREEN.load(Ordering::Relaxed));
    }
    state.is_expanded.store(expanded, Ordering::Relaxed);
    state.click_through.store(through, Ordering::Relaxed);
    win::WindowManager::set_click_through(through);

    if let Some(hwnd_val) = hwnd_value {
        if hwnd_val != 0 {
            let hwnd = windows::Win32::Foundation::HWND(hwnd_val as _);
            let pad_x = 4;
            let pad_bottom = 6;
            let x1 = (rect.x - pad_x).max(0);
            let y1 = 0;
            let x2 = rect.x + rect.w + pad_x;
            let y2 = rect.y + rect.h + pad_bottom;
            win::WindowManager::update_island_region_ex(
                hwnd,
                if tucked && rect.y+rect.h<=0 {None}else{Some((x1, y1, x2, y2))},
                right,
                bottom,
                settling.unwrap_or(true),
            );
        }
    }
    canvas.map(|canvas| json!({"layoutViewportHeight":canvas.layout_height,"canvasOverscanWidth":canvas.overscan_width,"canvasOverscanBottom":canvas.overscan_bottom})).unwrap_or(Value::Null)
}

#[tauri::command]
fn web_ai_popped()->Option<String>{webai::popped()}

#[tauri::command]
fn web_ai_open(service:Option<String>,app:AppHandle)->Result<bool,String>{webai::open(&app,service.as_deref()).map(|_|true)}

#[tauri::command]
async fn web_ai_embed(service:Option<String>,x:Option<f64>,y:Option<f64>,width:Option<f64>,height:Option<f64>,focus:Option<bool>,word:Option<u64>,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::embed(&app,&service.ok_or("AI service is required")?,x.unwrap_or(0.),y.unwrap_or(0.),width.unwrap_or(0.),height.unwrap_or(0.),focus.unwrap_or(false),word.unwrap_or(0)).map(|_|true)).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn web_ai_hide(word:Option<u64>,app:AppHandle)->Result<bool,String>{webai::hide(&app,word.unwrap_or(0)).map(|_|true)}

#[tauri::command]
fn web_ai_browser(service:Option<String>)->Result<bool,String>{webai::browser(&service.ok_or("AI service is required")?).map(|_|true)}

#[tauri::command]
async fn web_ai_window(service:Option<String>,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::window(&app,&service.ok_or("AI service is required")?).map(|_|true)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn web_ai_status(app:AppHandle)->Value{webai::status_live(&app).await}

#[tauri::command]
async fn web_ai_window_attach(service:String,x:f64,y:f64,width:f64,height:f64,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::window_attach(&app,&service,x,y,width,height).map(|_|true)).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn web_ai_reload(service:String,target:String,app:AppHandle)->Result<bool,String>{webai::reload(&app,&service,&target).map(|_|true)}

#[tauri::command]
async fn web_ai_window_close(return_to_pill:Option<bool>,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::window_close(&app,return_to_pill.unwrap_or(false)).map(|_|true)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn web_ai_window_present(service:String,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::window_present(&app,&service).map(|_|true)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn web_ai_window_reveal(service:String,navigation:u64,app:AppHandle)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||webai::window_reveal(&app,&service,navigation)).await.map_err(|e|e.to_string())?}

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
async fn whatsnew_clip(version:String,name:String,lang:String)->Result<Vec<u8>,String>{
 clips::fetch(&version,&name,&lang).await
}

#[tauri::command]
fn page_pong(webview:tauri::Webview,sequence:u64,ready:bool)->bool{watchdog::page_pong(&webview,sequence,ready)}

#[tauri::command]
fn watchdog_status(app:AppHandle)->Value{watchdog::status(&app)}

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
 let Some(mut patch)=settings else{return Vec::new();};if !patch.is_object(){return vec!["Settings must be an object".into()];}
 if let Some(key)=patch.get("uploadKey").and_then(Value::as_str){if let Err(error)=storage::save_secret("upload",key){return vec![error];}}
 patch.as_object_mut().unwrap().remove("uploadKey");
 if let Some(raw)=patch["aiProxy"].as_str(){match ai_http::proxy(raw){Ok((public,secret))=>{if let Err(error)=storage::save_secret("ai-proxy",&secret){return vec![error];}patch["aiProxy"]=json!(public);},Err(error)=>return vec![error]}}
 let mut warnings=Vec::new();let (before,updated)={
   let mut saved=state.settings.lock().unwrap();let before=saved.clone();let mut updated=before.clone();
   merge_settings(&mut updated,&patch);weather_places::remember(&before,&mut updated);
   if let Err(e)=storage::save_json_file("settings.json",&updated){return vec![e];}
   *saved=updated.clone();SETTINGS_VERSION.fetch_add(1,Ordering::Relaxed);(before,updated)
 };
 if patch["audioOutput"].is_string() || patch["audioInput"].is_string() {audio::configure(&updated);}
 if patch["loadInPill"].is_array() {system_load::configure();}
 if patch["mediaHidden"].is_array() {media::configure(&updated);}
 if patch["agentsAsk"].is_boolean(){agents::configure(updated["agentsAsk"]!=false);}
 if patch.as_object().unwrap().keys().any(|key|key.starts_with("vpnCustom")||key=="showVpn") {network::configure_vpn(&updated);}
 if patch["captureVisible"].is_boolean() {if let Some(window)=app.get_window("main"){if let Err(e)=window.set_content_protected(!updated["captureVisible"].as_bool().unwrap_or(false)){warnings.push(e.to_string());}}}
 if patch.as_object().unwrap().keys().any(|k|["scale","monitor","offsetX","underTaskbar","notchBar","style"].contains(&k.as_str())) {if let Err(e)=apply_island_geometry(&app,&state){warnings.push(e);}}
 if patch.as_object().unwrap().keys().any(|key|key.starts_with("snow")||["garland","reducedMotion","monitor"].contains(&key.as_str())){snow_surface::refresh();}
 if patch.as_object().unwrap().keys().any(|key|["notchBar","notchLook","monitor","scale","style","underTaskbar","offsetX"].contains(&key.as_str())){appbar::refresh();}
 if let Some(on)=patch["autostart"].as_bool(){if std::env::var_os("WOODS_ISLAND_DATA_DIR").is_none(){if let Err(e)=system::autostart(on){warnings.push(e);}}}
 if let Some(hide_tray)=patch["hideTrayIcon"].as_bool(){if let Some(tray)=app.tray_by_id("woods-tray"){let _=tray.set_visible(!hide_tray);}}
 if patch.as_object().unwrap().keys().any(|k|k.starts_with("hotkey")||k=="showVpn"){warnings.extend(register_hotkeys(&app,&updated));}
 if patch["through"].is_boolean(){let on=updated["through"].as_bool().unwrap_or(false);state.click_through.store(on,Ordering::Relaxed);win::WindowManager::set_click_through(on);}
 if ["weatherCity","weatherLat","weatherLon","weatherUnits","weatherUtcOffset","weatherTimezone"].iter().any(|key|before[*key]!=updated[*key]){
   let weather_settings=updated.clone();let weather_app=app.clone();let weather_state=state.inner().clone();
   tauri::async_runtime::spawn(async move{if !weather_settings["weatherCity"].as_str().unwrap_or_default().is_empty(){let result=weather::forecast(&weather_settings,false).await;let current=weather_state.settings.lock().unwrap().clone();if ["weatherCity","weatherLat","weatherLon","weatherUnits","weatherUtcOffset","weatherTimezone"].iter().any(|key|current[*key]!=weather_settings[*key]){return;}match result{Ok(data)=>{let _=weather_app.emit("weather:update",data);},Err(error)=>{let _=weather_app.emit("weather:error",error);}}}});
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
async fn shelf_list(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<Value>,String> {
    let state=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move||shelf_snapshot(&state)).await.map_err(|error|error.to_string())
}

fn shelf_snapshot(state: &AppState) -> Vec<Value> {
    let saved=state.shelf_items.lock().unwrap().clone();
    saved.into_iter().map(|mut item| {
        if let Some(path) = item["path"].as_str() {
            let details = phone::shelf_item(std::path::Path::new(path));
            for key in ["exists","size","name","icon","preview","isDir","kind"]{item[key]=details[key].clone();}
        }
        item
    }).collect()
}

#[tauri::command]
async fn shelf_add(paths:Option<Vec<String>>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{
 let state=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||{
   let paths=paths.unwrap_or_default();
   for path in &paths{if !std::path::Path::new(path).exists(){return Err(format!("File does not exist: {path}"));}}
   let fresh=paths.iter().map(|path|phone::shelf_item(std::path::Path::new(path))).collect::<Vec<_>>();
   let mut items=state.shelf_items.lock().unwrap();let before=items.clone();
   for mut value in fresh{
     if items.iter().any(|item|item["path"]==value["path"]){continue;}
     value["id"]=json!(new_item_id("shelf"));value["added"]=json!(media::now_ms());value["fromPhone"]=json!(false);items.push(value);
   }
   if let Err(error)=storage::save_json_file("shelf.json",&json!(*items)){*items=before;return Err(error);}
   let snapshot=items.clone();drop(items);let _=app.emit("shelf:changed",&snapshot);Ok(snapshot)
 }).await.map_err(|error|error.to_string())?
}

fn phone_value(state:phone::PhoneState)->Result<Value,String>{serde_json::to_value(state).map_err(|error|error.to_string())}
#[tauri::command]
async fn phone_start()->Result<Value,String>{phone_value(phone::phone_start().await?)}
#[tauri::command]
async fn phone_state()->Result<Value,String>{tauri::async_runtime::spawn_blocking(||phone::phone_state().and_then(phone_value)).await.map_err(|e|e.to_string())?}
#[tauri::command]
fn phone_stop()->Result<Value,String>{phone_value(phone::phone_stop()?)}
#[tauri::command]
fn phone_renew()->Result<Value,String>{phone_value(phone::phone_renew()?)}
#[tauri::command]
fn phone_allow(id:Option<String>)->Result<Value,String>{phone_value(phone::phone_allow(id)?)}
#[tauri::command]
fn phone_deny(id:String)->Result<Value,String>{phone_value(phone::phone_deny(id)?)}
#[tauri::command]
async fn phone_send(paths:Option<Vec<String>>)->Result<Value,String>{phone_value(phone::phone_send(paths.unwrap_or_default()).await?)}
#[tauri::command]
fn phone_unsend(id:String)->Result<Value,String>{phone_value(phone::phone_unsend(id)?)}
#[tauri::command]
async fn phone_firewall()->Result<Value,String>{phone_value(phone::phone_firewall().await?)}

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
    let additions = tauri::async_runtime::spawn_blocking(move || paths.unwrap_or_default().into_iter().map(|path|{
        let mut value=system::app_item(&path)?;
        value["icon"]=json!(system::icon(&path));
        Ok(value)
    }).collect::<Result<Vec<_>,String>>()).await.map_err(|e|e.to_string())??;
    let mut items=state.launcher_items.lock().unwrap();
    let mut updated=items.clone();
    for mut value in additions {if updated.iter().any(|item|item["path"]==value["path"]){continue;}value["id"]=json!(new_item_id("launcher"));updated.push(value);}
    storage::save_json_file("launcher.json",&json!(updated))?;
    *items=updated;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())
}

/// Repair older launcher entries outside the UI thread, preserving manual icons
/// and edits made while Windows is resolving a shortcut.
fn hydrate_launcher_icons(app:&AppHandle,state:&AppState) {
    let snapshot=state.launcher_items.lock().unwrap().clone();
    let found=snapshot.iter().filter(|item|!item["icon"].is_string()).filter_map(|item|{
        let path=item["path"].as_str()?;
        if path.starts_with("http://")||path.starts_with("https://"){return None;}
        system::icon(path).map(|icon|(item["id"].clone(),path.to_owned(),icon))
    }).collect::<Vec<_>>();
    if found.is_empty(){return;}
    let mut items=state.launcher_items.lock().unwrap();let mut updated=items.clone();
    for (id,path,icon) in found {
        if let Some(item)=updated.iter_mut().find(|item|item["id"]==id&&item["path"]==path&&!item["icon"].is_string()) {item["icon"]=json!(icon);}
    }
    if updated!=*items&&storage::save_json_file("launcher.json",&json!(updated)).is_ok(){
        *items=updated;let _=app.emit("launcher:changed",items.clone());
    }
}

#[tauri::command]
fn launcher_add_link(link:Option<String>,name:Option<String>,icon:Option<Value>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let link=link.ok_or("URL is required")?;let url=reqwest::Url::parse(&link).map_err(|_|"Invalid URL")?;if !["http","https"].contains(&url.scheme()){return Err("Launcher links must use HTTP or HTTPS".into());}let mut items=state.launcher_items.lock().unwrap();items.push(json!({"id":new_item_id("link"),"path":link,"name":name.filter(|s|!s.trim().is_empty()).unwrap_or_else(||url.host_str().unwrap_or("Website").into()),"icon":icon.and_then(|v|v["data"].as_str().map(str::to_owned))}));storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn launcher_edit_link(id:Option<String>,link:Option<String>,name:Option<String>,icon:Option<Value>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let id=id.ok_or("Item ID is required")?;let link=link.ok_or("URL is required")?;let url=reqwest::Url::parse(&link).map_err(|_|"Invalid URL")?;if !["http","https"].contains(&url.scheme()){return Err("Launcher links must use HTTP or HTTPS".into());}let mut items=state.launcher_items.lock().unwrap();let item=items.iter_mut().find(|i|i["id"]==json!(id)).ok_or("Launcher item no longer exists")?;item["path"]=json!(link);if let Some(name)=name{item["name"]=json!(name);}if let Some(icon)=icon{if icon["kind"]!=json!("keep"){item["icon"]=icon["data"].clone();}}storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

#[tauri::command]
fn launcher_remove(id:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{let target=id.ok_or("Item ID is required")?;let mut items=state.launcher_items.lock().unwrap();items.retain(|item|item["id"].as_str()!=Some(&target));storage::save_json_file("launcher.json",&json!(*items))?;let _=app.emit("launcher:changed",items.clone());Ok(items.clone())}

fn reorder_launcher_vec(items: &[Value], ids: &[String]) -> Vec<Value> {
    let mut reordered = Vec::with_capacity(items.len());
    let mut used = std::collections::HashSet::new();
    for id in ids {
        if let Some(idx) = items.iter().position(|item| item["id"].as_str() == Some(id.as_str()) || item["id"].as_i64().map(|n| n.to_string()) == Some(id.clone())) {
            if used.insert(idx) {
                reordered.push(items[idx].clone());
            }
        }
    }
    for (idx, item) in items.iter().enumerate() {
        if used.insert(idx) {
            reordered.push(item.clone());
        }
    }
    reordered
}

#[tauri::command]
fn launcher_reorder(ids:Option<Vec<String>>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<Vec<Value>,String>{
    let order = ids.ok_or("Order list is required")?;
    let mut items = state.launcher_items.lock().unwrap();
    let updated = reorder_launcher_vec(&items, &order);
    storage::save_json_file("launcher.json", &json!(updated))?;
    *items = updated;
    let _ = app.emit("launcher:changed", items.clone());
    Ok(items.clone())
}

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
async fn audio_mixer_get(refresh:Option<bool>) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move||audio_mixer::list(refresh.unwrap_or(false))).await.map_err(|_|"Audio controls were interrupted".to_owned())?
}

#[tauri::command]
async fn audio_mixer_set(id: String, level: Option<f64>, mute: Option<bool>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || audio_mixer::set(&id,level,mute)).await.map_err(|_|"Audio controls were interrupted".to_owned())?
}

#[tauri::command]
async fn brightness_get() -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(brightness::list).await.map_err(|_|"Monitor controls were interrupted".to_owned())?
}

#[tauri::command]
async fn brightness_set(id: String, level: f64) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || brightness::set(&id,level)).await.map_err(|_|"Monitor controls were interrupted".to_owned())?
}

#[tauri::command]
fn system_load_get() -> Value {system_load::request()}

#[tauri::command]
fn system_load_status() -> Value {system_load::status()}

#[tauri::command]
async fn task_manager_open()->Result<bool,String> {
    tauri::async_runtime::spawn_blocking(||{
        let mut directory=[0u16;32768];
        let count=unsafe{windows::Win32::System::SystemInformation::GetSystemDirectoryW(Some(&mut directory))} as usize;
        if count==0||count>=directory.len(){return Err("Could not locate Windows Task Manager".to_owned());}
        let path=format!("{}\\Taskmgr.exe",String::from_utf16_lossy(&directory[..count]));
        system::open_path(&path,false,false).map(|_|true)
    }).await.map_err(|_|"Could not open Windows Task Manager".to_owned())?
}

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
    if let Some(window) = app.get_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        if let Ok(hwnd) = window.hwnd() { win::WindowManager::keyboard_focus(HWND(hwnd.0 as _),true); }
        if !win::WindowManager::passive_qa() { let _ = window.set_focus(); }
    }
}

#[tauri::command]
fn release_focus(app: AppHandle) {
    if let Some(window) = app.get_window("main") {
        if let Ok(hwnd) = window.hwnd() {
            win::WindowManager::keyboard_focus(HWND(hwnd.0 as _),false);
        }
    }
}

#[tauri::command]
async fn clip_list(query:Option<String>,state:tauri::State<'_,Arc<AppState>>)->Result<Vec<Value>,String>{let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||{let limit=state.settings.lock().unwrap()["clipLimit"].as_u64().unwrap_or(200).clamp(1,5000) as usize;state.clipboard_store.list_previews(limit,query.as_deref())}).await.map_err(|e|e.to_string())?}

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
fn clip_text(id: i64, state: tauri::State<'_, Arc<AppState>>) -> Result<String, String> {
    let item = state.clipboard_store.get_item(id).map_err(|e|e.to_string())?;
    if item.item_type != "text" { return Err("This clipboard entry is not text".into()); }
    Ok(item.content)
}

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
async fn media_pick(id:Option<String>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{let id=id.filter(|s|!s.is_empty());if let Some(id)=id.as_ref(){if !media::get_media_sources().iter().any(|source|source["id"].as_str()==Some(id)&&source["hidden"]!=true){return Err("Media source is hidden or no longer exists".into());}}media::set_picked_source(id);Ok(true)}).await.map_err(|e|e.to_string())?}

#[tauri::command]
fn media_rename(app_id:Option<String>,name:Option<String>)->Result<bool,String>{let id=app_id.ok_or("Media source ID is required")?;let name=name.unwrap_or_default();let mut names=storage::load_json_file("media_names.json").unwrap_or(json!({}));let map=names.as_object_mut().ok_or("Invalid media name store")?;if name.trim().is_empty(){map.remove(&id);}else{map.insert(id,json!(name.trim()));}storage::save_json_file("media_names.json",&names)?;media::invalidate_names_cache();Ok(true)}

#[tauri::command]
async fn media_seek(ms:Option<u64>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{if media::media_seek(ms.ok_or("Playback position is required")?){Ok(true)}else{Err("The active player does not allow seeking".into())}}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn media_cover_recover(key:String,failed_cover:String,app:AppHandle)->bool {media::recover_cover(&app,key,failed_cover).await}

#[tauri::command]
async fn lyrics_get(artist: Option<String>, title: Option<String>, album: Option<String>, duration_ms: Option<u64>) -> Result<Value, String> {
    lyrics::get(artist.unwrap_or_default(), title.unwrap_or_default(), album.unwrap_or_default(), duration_ms).await
}

#[tauri::command]
async fn player_volume()->Result<Value,String>{tauri::async_runtime::spawn_blocking(move||{audio::player_volume()}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn player_volume_set(level:Option<f64>,mute:Option<bool>)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||{audio::set_player_volume(level,mute).map(|_|true)}).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn audio_devices()->Result<Vec<Value>,String>{tauri::async_runtime::spawn_blocking(||audio::devices(false)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn audio_inputs()->Result<Vec<Value>,String>{tauri::async_runtime::spawn_blocking(||audio::devices(true)).await.map_err(|e|e.to_string())?}

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
fn peripherals_get()->Value{peripherals::snapshot()}

#[tauri::command]
fn peripherals_refresh(){peripherals::request_refresh();}

#[tauri::command]
async fn peripherals_g435_measure(id:String,allow_audio_pause:bool,app:AppHandle)->Result<Value,String>{
    tauri::async_runtime::spawn_blocking(move||peripherals::measure_g435(&id,allow_audio_pause,&app)).await.map_err(|_|"g435Io".to_string())?
}

#[tauri::command]
async fn bt_switch(id:Option<String>,on:Option<bool>)->Result<bool,String>{let id=id.ok_or("Bluetooth device ID is required")?;tauri::async_runtime::spawn_blocking(move||network::bt_switch(&id,on.unwrap_or(true))).await.map_err(|e|e.to_string())?.map(|_|true)}

#[tauri::command]
async fn vpn_chip(app:AppHandle)->Result<bool,String>{if app.state::<Arc<AppState>>().settings.lock().unwrap()["showVpn"]==false{return Ok(false);}let profiles=tauri::async_runtime::spawn_blocking(network::vpn_profiles).await.map_err(|e|e.to_string())?;let available:Vec<_>=profiles.iter().filter(|p|p["ready"]==json!(true)).collect();if available.is_empty(){return Err("No supported VPN connection is installed".into());}if let Some(profile)=available.iter().find(|p|p["on"]==json!(true)){let id=profile["id"].as_str().unwrap_or_default().to_owned();tauri::async_runtime::spawn_blocking(move||network::vpn_toggle(&id,false)).await.map_err(|e|e.to_string())??;vpn_refresh(app).await?;return Ok(false);}if available.len()==1 && available[0]["onSource"]!="command"{let id=available[0]["id"].as_str().unwrap_or_default().to_owned();tauri::async_runtime::spawn_blocking(move||network::vpn_toggle(&id,true)).await.map_err(|e|e.to_string())??;vpn_refresh(app).await?;return Ok(false);}let _=app.emit("vpn:choose",());Ok(true)}

#[tauri::command]
async fn vpn_refresh(app:AppHandle)->Result<Value,String>{
    let state=app.state::<Arc<AppState>>();
    let settings=state.settings.lock().unwrap().clone();
    if settings["showVpn"]==false{let _=app.emit("vpn:update",Value::Null);return Ok(Value::Null);}
    let profiles=tauri::async_runtime::spawn_blocking(network::vpn_profiles).await.map_err(|e|e.to_string())?;
    let initial=network::vpn_summary(&profiles);let mut country=None;
    if settings["vpnLookupIp"]!=false {
        let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build().map_err(|_|"Could not check VPN location".to_owned())?;
        if let Ok(response)=client.get("https://api.country.is").send().await {
            if let Ok(data)=response.json::<Value>().await{country=Some(data);}
        }
    }
    let profiles=tauri::async_runtime::spawn_blocking(network::vpn_profiles).await.map_err(|e|e.to_string())?;
    let mut payload=network::vpn_summary(&profiles);
    let latest=state.settings.lock().unwrap().clone();
    if latest["showVpn"]==false{let _=app.emit("vpn:update",Value::Null);return Ok(Value::Null);}
    // A response for the previous tunnel or a disabled IP lookup cannot win.
    if latest["vpnLookupIp"]!=false&&initial["active"]==payload["active"]&&initial["via"]==payload["via"] {
        if let Some(data)=country {
            if data["ip"].as_str().is_some_and(|ip|ip.parse::<std::net::IpAddr>().is_ok())&&data["country"].as_str().is_some_and(|code|code.len()==2&&code.bytes().all(|c|c.is_ascii_uppercase())) {
                payload["ip"]=data["ip"].clone();payload["country"]=data["country"].clone();payload["countryCode"]=data["country"].clone();
            }
        }
    }
    let _=app.emit("vpn:update",&payload);Ok(payload)
}

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
fn auto_hide_toggle(app: AppHandle, state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    let mut settings = state.settings.lock().unwrap();
    let on = !settings["autoHide"].as_bool().unwrap_or(false);
    let mut updated = settings.clone();
    updated["autoHide"] = json!(on);
    storage::save_json_file("settings.json", &updated)?;
    *settings = updated.clone();
    SETTINGS_VERSION.fetch_add(1, Ordering::Relaxed);
    drop(settings);
    let _ = app.emit("settings:changed", updated);
    Ok(on)
}

#[tauri::command]
async fn web_ai_permissions_reset(service: Option<String>, app: AppHandle) -> Result<u32, String> {
    let result=webai::permissions::reset(&app,service.as_deref()).await;
    result.map(|count|count as u32).map_err(|_|ai_http::text(&app.state::<Arc<AppState>>().settings.lock().unwrap(),
        "Не удалось сбросить разрешения сайта. Проверь, что WebView2 обновлён, и попробуй ещё раз.",
        "Could not reset site permissions. Update WebView2 and try again."))
}

#[tauri::command]
fn hover(state:Option<bool>,app:AppHandle)->bool{let _=app.emit("hover",state.unwrap_or(false));true}

#[tauri::command]
fn island_tall(on:Option<bool>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{state.is_tall.store(on.unwrap_or(false),Ordering::Relaxed);apply_island_geometry(&app,&state).map(|_|true)}

#[tauri::command]
fn set_island_hidden(hidden:Option<bool>,app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Result<bool,String>{let window=app.get_window("main").ok_or("Main window unavailable")?;let hidden=hidden.unwrap_or(false);if hidden{window.hide()}else{window.show()}.map_err(|e|e.to_string())?;state.is_hidden.store(hidden,Ordering::Relaxed);snow_surface::refresh();appbar::refresh();Ok(true)}

#[tauri::command]
fn snow_state()->Value{snow_surface::state()}

#[tauri::command]
fn notch_pill(height:f64){appbar::set_pill_height(height);}

#[tauri::command]
fn notch_state()->Value{appbar::state()}

#[tauri::command]
fn fullscreen(state:tauri::State<'_, Arc<AppState>>)->bool{state.main_hwnd.lock().unwrap().map(|h|win::WindowManager::system_context(HWND(h as _))["fullscreen"].as_bool().unwrap_or(false)).unwrap_or(false)}

#[tauri::command]
fn fullscreen_hide_toggle(app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Result<bool,String>{
 let on=!state.settings.lock().unwrap()["hideInFullscreen"].as_bool().unwrap_or(true);
 let _=settings_set(Some(json!({"hideInFullscreen":on})),app,state);
 Ok(on)
}

#[tauri::command]
fn hotkeys_check(app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Vec<String>{use tauri_plugin_global_shortcut::{GlobalShortcutExt,Shortcut};let settings=state.settings.lock().unwrap().clone();let settings=visibility::shortcut_settings(&settings,false);settings.as_object().into_iter().flatten().filter(|(k,_)|k.starts_with("hotkey")).filter_map(|(_,v)|v.as_str()).filter(|s|!s.is_empty()).filter_map(|s|match s.parse::<Shortcut>(){Ok(shortcut)if app.global_shortcut().is_registered(shortcut)=>None,_=>Some(format!("Shortcut unavailable: {s}"))}).collect()}

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

fn restore_island_visible(app: &AppHandle, state: &Arc<AppState>, toggle: bool) {
    state.is_hidden.store(false, Ordering::Relaxed);
    state.is_tucked.store(false, Ordering::Relaxed);
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
    }
    let _ = apply_island_geometry(app, state);
    snow_surface::refresh();
    appbar::refresh();
    if toggle {
        let _ = app.emit("island:toggle", json!({}));
    }
}

fn setup_tray(app: &AppHandle, state: Arc<AppState>) {
    if win::WindowManager::passive_qa() { return; }
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    let lang = state.settings.lock().unwrap()["language"].as_str().unwrap_or("auto").to_owned();
    let en = lang == "en";
    let t = |ru: &'static str, english: &'static str| if en { english } else { ru };
    let Ok(open_item) = MenuItemBuilder::with_id("open", t("Открыть остров", "Open the island")).build(app) else { return; };
    let Ok(settings_item) = MenuItemBuilder::with_id("settings", t("Настройки", "Settings")).build(app) else { return; };
    let Ok(updates_item) = MenuItemBuilder::with_id("updates", t("Проверить обновления", "Check for updates")).build(app) else { return; };
    let Ok(restart_item) = MenuItemBuilder::with_id("restart", t("Перезапустить остров", "Restart the island")).build(app) else { return; };
    let Ok(quit_item) = MenuItemBuilder::with_id("quit", t("Выход", "Quit")).build(app) else { return; };
    let Ok(menu) = MenuBuilder::new(app)
        .item(&open_item)
        .item(&settings_item)
        .item(&updates_item)
        .separator()
        .item(&restart_item)
        .item(&quit_item)
        .build() else { return; };
    let mut builder = TrayIconBuilder::with_id("woods-tray")
        .tooltip("Woods Island")
        .menu(&menu)
        .show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    let click_state = state.clone();
    let hide_tray = state.settings.lock().unwrap()["hideTrayIcon"].as_bool().unwrap_or(false);
    let menu_state = state;
    if let Ok(tray) = builder
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                restore_island_visible(tray.app_handle(), &click_state, true);
            }
        })
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => restore_island_visible(app, &menu_state, true),
            "settings" => {
                let app_handle = app.clone();
                let st = menu_state.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(win) = tauri::async_runtime::spawn_blocking(move || ensure_aux_window(&app_handle, "settings")).await.unwrap_or_else(|e| Err(e.to_string())) {
                        let _ = win.unminimize();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                    let _ = st;
                });
            }
            "updates" => {
                *menu_state.settings_target.lock().unwrap() = Some("updates".into());
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(win) = tauri::async_runtime::spawn_blocking(move || ensure_aux_window(&app_handle, "settings")).await.unwrap_or_else(|e| Err(e.to_string())) {
                        let _ = win.unminimize();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                });
            }
            "restart" => { let _ = restart_island(app.clone()); }
            "quit" => { finalize_background(app); app.exit(0); }
            _ => {}
        })
        .build(app) {
        if hide_tray {
            let _ = tray.set_visible(false);
        }
    }
}

fn finalize_background(app:&AppHandle){
 watchdog::stop(app);
 appbar::stop();
 snow_surface::stop();
 phone::shutdown();
 speech::cancel(app);
 match recorder::finalize_active(){Ok(Some(result))=>{let _=app.emit("record:done",result);},Ok(None)=>{},Err(error)=>{let _=app.emit("record:done",Value::Null);let _=app.emit("capture:error",error);}}
}

#[tauri::command]
fn restart_island(app:AppHandle)->bool{finalize_background(&app);app.restart()}

#[tauri::command]
async fn update_check(app:AppHandle)->Result<Option<Value>,String>{updates::check(app).await}

fn start_update_monitor(app: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        // Isolated acceptance runs never check or install production updates.
        if win::WindowManager::passive_qa() { return; }
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        loop {
            if state.settings.lock().unwrap()["checkUpdates"].as_bool().unwrap_or(true) {
                match update_check(app.clone()).await {
                    Ok(Some(_)) => {
                        let download=state.settings.lock().unwrap()["autoDownloadUpdates"].as_bool().unwrap_or(true);
                        if download && updates::status()["canInstall"]==true && updates::status()["status"]=="available" { let _=updates::download(app.clone()).await; }
                    }
                    Ok(None) => {}
                    Err(error) => app_log(&format!("Update check: {error}")),
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(6 * 60 * 60)).await;
        }
    });
}

#[tauri::command]
async fn update_install(app:AppHandle)->Result<bool,String>{updates::install(app).await}

#[tauri::command]
async fn update_status(app:AppHandle)->Value{
    let _=tauri::async_runtime::spawn_blocking(move || updates::restore(&app)).await;
    updates::status()
}
#[tauri::command]
async fn update_download(app:AppHandle)->Result<bool,String>{updates::download(app).await}
#[tauri::command]
fn update_cancel()->bool{updates::cancel()}
#[tauri::command]
fn upload_key_status()->bool{storage::load_secret("upload").is_some_and(|key|!key.is_empty())}
#[tauri::command]
fn upload_key_set(key:String)->Result<bool,String>{storage::save_secret("upload",key.trim())?;Ok(!key.trim().is_empty())}
#[tauri::command]
async fn diagnostics_summary(state:tauri::State<'_,Arc<AppState>>)->Result<Value,String>{let state=state.inner().clone();tauri::async_runtime::spawn_blocking(move||diagnostics::summary(&state)).await.map_err(|_|"Diagnostics unavailable".into())}

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
 let vault=state.settings.lock().unwrap()["obsidianVaultPath"].as_str().unwrap_or("").to_owned();
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
fn capture_start(mode:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{
    let mode=mode.unwrap_or_else(||"area".into());
    let rect=capture::screen_rect();
    let mut visibility=capture::hide_main(&app);
    std::thread::sleep(std::time::Duration::from_millis(70));
    let image=capture::screenshot(rect)?;
    let shared=capture::set_frame(image);
    if mode=="screen"{
        let settings=state.settings.lock().unwrap().clone();
        let result=capture::save(shared.as_ref(),&settings)?;
        let encoded=capture::data_url(shared.as_ref())?;
        capture::clear_frame();
        let _=clipboard::set_png(&encoded);
        let _=app.emit("capture:done",result);
        if let Some(main)=app.get_window("main"){let _=main.show();}
        return Ok(true);
    }
    let overlay=app.get_webview_window("overlay").ok_or("Capture overlay is unavailable")?;
    let pos=tauri::PhysicalPosition::new(rect.left,rect.top);
    let size=tauri::PhysicalSize::new((rect.right-rect.left) as u32,(rect.bottom-rect.top) as u32);
    // On mixed-DPI 4K multi-monitor layouts, moving across monitors triggers WM_DPICHANGED
    // which can rescale the window; applying position + size twice guarantees exact physical coverage.
    overlay.set_position(pos).map_err(|e|e.to_string())?;
    overlay.set_size(size).map_err(|e|e.to_string())?;
    let _=overlay.set_position(pos);
    let _=overlay.set_size(size);
    let frame=capture::data_url(shared.as_ref())?;
    let _=app.emit_to("overlay","overlay:start",json!({"mode":mode,"frame":frame,"below":0}));
    overlay.show().map_err(|e|e.to_string())?;
    if !win::WindowManager::passive_qa(){overlay.set_focus().map_err(|e|e.to_string())?;}
    visibility.keep_hidden();
    Ok(true)
}

static OVERLAY_TOKEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
static OVERLAY_LEAVE: std::sync::Mutex<Option<(u64, std::sync::mpsc::Sender<()>)>> = std::sync::Mutex::new(None);

fn hide_overlay_cleanly(app: &AppHandle) {
    let Some(overlay) = app.get_webview_window("overlay") else { return; };
    if overlay.is_visible().unwrap_or(false) {
        let token = OVERLAY_TOKEN.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = std::sync::mpsc::channel();
        *OVERLAY_LEAVE.lock().unwrap() = Some((token, tx));
        let _ = app.emit_to("overlay", "overlay:leave", token);
        let _ = rx.recv_timeout(std::time::Duration::from_millis(140));
        let mut guard = OVERLAY_LEAVE.lock().unwrap();
        if guard.as_ref().is_some_and(|(id, _)| *id == token) { *guard = None; }
    }
    let _ = overlay.hide();
}

#[tauri::command]
async fn overlay_left(token: u64) -> bool {
    let sender = {
        let mut guard = OVERLAY_LEAVE.lock().unwrap();
        if guard.as_ref().is_some_and(|(id, _)| *id == token) { guard.take().map(|(_, tx)| tx) } else { None }
    };
    if let Some(tx) = sender { let _ = tx.send(()); true } else { false }
}

#[tauri::command]
fn capture_cancel(app:AppHandle)->bool{capture::clear_frame();hide_overlay_cleanly(&app);if let Some(w)=app.get_window("main"){let _=w.show();}true}

#[tauri::command]
fn capture_region(x:Option<f64>,y:Option<f64>,w:Option<f64>,h:Option<f64>,mode:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),w.unwrap_or(1.),h.unwrap_or(1.))?;hide_overlay_cleanly(&app);std::thread::sleep(std::time::Duration::from_millis(40));let result:Result<Value,String>=(||{let image=capture::selected_image(rect)?;let settings=state.settings.lock().unwrap().clone();match mode.as_deref().unwrap_or("area"){"ocr"=>{let saved=capture::save(&image,&settings)?;let text=capture::ocr(std::path::Path::new(saved["path"].as_str().unwrap()))?;let _=clipboard::set_text(&text);Ok(json!({"kind":"ocr","text":text}))},"qr"=>{let text=capture::qr(&image)?;let url=reqwest::Url::parse(&text).ok().filter(|u|["http","https"].contains(&u.scheme())).map(|u|u.to_string());Ok(json!({"kind":"qr","text":text,"url":url}))},_=>{let saved=capture::save(&image,&settings)?;clipboard::set_png(&capture::data_url(&image)?)?;Ok(saved)}}})();capture::clear_frame();if let Some(main)=app.get_window("main"){let _=main.show();}match result{Ok(payload)=>{let _=app.emit("capture:done",payload);Ok(true)},Err(error)=>{let _=app.emit("capture:error",&error);Err(error)}}}

#[tauri::command]
fn capture_region_drawn(x:Option<f64>,y:Option<f64>,w:Option<f64>,h:Option<f64>,drawing:Option<String>,app:AppHandle,state:tauri::State<'_, Arc<AppState>>)->Result<bool,String>{
 let Some(drawing)=drawing else{return capture_region(x,y,w,h,Some("area".into()),app,state);};
 use base64::Engine;let encoded=drawing.split_once(',').ok_or("Invalid annotation image")?.1;let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?;let annotated=image::load_from_memory(&bytes).map_err(|e|e.to_string())?.into_rgba8();
 let rect=capture::region(x.unwrap_or(0.),y.unwrap_or(0.),w.unwrap_or(1.),h.unwrap_or(1.))?;hide_overlay_cleanly(&app);std::thread::sleep(std::time::Duration::from_millis(40));
 let mut image=capture::selected_image(rect)?;capture::clear_frame();let drawing=image::imageops::resize(&annotated,image.width(),image.height(),image::imageops::FilterType::Lanczos3);image::imageops::overlay(&mut image,&drawing,0,0);
 let settings=state.settings.lock().unwrap().clone();let result=capture::save(&image,&settings)?;clipboard::set_png(&capture::data_url(&image)?)?;let _=app.emit("capture:done",result);if let Some(main)=app.get_window("main"){let _=main.show();}Ok(true)
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
 let path=path.ok_or("Image path is required")?;let settings=state.settings.lock().unwrap().clone();let service=settings["uploadService"].as_str().unwrap_or_default();let key=storage::load_secret("upload").filter(|s|!s.is_empty()).ok_or("Set your image-upload API key in settings")?;
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
async fn everything_status() -> Value {
    tauri::async_runtime::spawn_blocking(|| json!({ "available": everything::is_available() }))
        .await
        .unwrap_or_else(|_| json!({ "available": false }))
}

#[tauri::command]
async fn files_search(query: Option<String>, app: AppHandle) -> Vec<Value> {
    let state = app.state::<Arc<AppState>>();
    let (use_everything, folders) = {
        let s = state.settings.lock().unwrap();
        let ev = s["paletteEverything"].as_bool().unwrap_or(true);
        let dirs = s["paletteFolders"]
            .as_array()
            .map(|list| list.iter().filter_map(Value::as_str).map(str::to_owned).collect::<Vec<_>>())
            .unwrap_or_default();
        (ev, dirs)
    };
    let q = query.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        if use_everything {
            if let Some(results) = everything::search(&q, 50) {
                return results;
            }
        }
        system::search_files(&q, &folders)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn files_warm()->bool{tauri::async_runtime::spawn_blocking(|| !system::apps().is_empty()).await.unwrap_or(false)}

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
async fn notifications_icon(aumid:String)->Result<Option<String>,String>{tauri::async_runtime::spawn_blocking(move||notifications::icon(&aumid)).await.map_err(|error|error.to_string())}

#[tauri::command]
async fn palette_apps()->Vec<Value>{tauri::async_runtime::spawn_blocking(system::apps).await.unwrap_or_default()}
#[tauri::command]
async fn installed_browsers()->Vec<String>{tauri::async_runtime::spawn_blocking(app_inventory::browsers).await.unwrap_or_default()}
#[tauri::command]
async fn open_programs()->Vec<Value>{tauri::async_runtime::spawn_blocking(app_inventory::open_programs).await.unwrap_or_default()}

#[tauri::command]
async fn palette_recent()->Vec<Value>{tauri::async_runtime::spawn_blocking(system::recent).await.unwrap_or_default()}

#[tauri::command]
async fn palette_icon(path:Option<String>)->Option<String>{let path=path?;tauri::async_runtime::spawn_blocking(move||system::icon(&path)).await.ok().flatten()}

pub(crate) fn run_power_action(action: &str) -> bool {
    power_action(Some(action.to_owned()))
}

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
async fn ai_key_status()->bool{tauri::async_runtime::spawn_blocking(||storage::load_secret("ai").map(|s|!s.is_empty()).unwrap_or(false)).await.unwrap_or(false)}
#[tauri::command]
fn ai_proxy_set(proxy:String,app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->Result<bool,String>{
 ai_http::proxy(&proxy).map_err(|_|ai_http::text(&state.settings.lock().unwrap(),"Укажи адрес HTTP или SOCKS5-прокси без пути и параметров.","Enter an HTTP or SOCKS5 proxy address without a path or query."))?;
 let warnings=settings_set(Some(json!({"aiProxy":proxy})),app,state);if warnings.is_empty(){Ok(true)}else{Err(warnings.join("\n"))}
}

#[tauri::command]
async fn ai_test(state:tauri::State<'_, Arc<AppState>>)->Result<String,String>{let settings=state.settings.lock().unwrap().clone();let models=ai::models(&settings).await?;Ok(format!("{} models available",models.len()))}

#[tauri::command]
fn stt_key_set(key:Option<String>)->Result<bool,String>{let key=key.unwrap_or_default();storage::save_secret("stt",&key).map(|_|!key.is_empty())}

#[tauri::command]
async fn stt_key_status()->bool{tauri::async_runtime::spawn_blocking(||storage::load_secret("stt").map(|s|!s.is_empty()).unwrap_or(false)).await.unwrap_or(false)}

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
fn merge_settings(target: &mut Value, patch: &Value) {
    let (Some(target), Some(patch)) = (target.as_object_mut(), patch.as_object()) else { return; };
    for (key, value) in patch {
        let Some(existing) = target.get(key) else { continue; };
        let valid = if key == "weatherUtcOffset" {
            value.is_null() || value.as_i64().is_some_and(|n| (-86399..=86399).contains(&n))
        } else {
            (existing.is_boolean() && value.is_boolean()) || (existing.is_number() && value.is_number())
                || (existing.is_string() && value.is_string()) || (existing.is_array() && value.is_array())
                || (existing.is_object() && value.is_object())
        };
        if valid { target.insert(key.clone(), value.clone()); }
    }
}
#[cfg(test)]
#[test]
fn optional_weather_offset_can_be_reset_without_accepting_invalid_settings() {
    let mut settings=default_settings();
    merge_settings(&mut settings,&json!({"weatherUtcOffset":3600,"autostart":"wrong","unknown":true}));
    assert_eq!(settings["weatherUtcOffset"],3600);assert_eq!(settings["autostart"],true);assert!(settings["unknown"].is_null());
    merge_settings(&mut settings,&json!({"weatherUtcOffset":999999}));assert_eq!(settings["weatherUtcOffset"],3600);
    merge_settings(&mut settings,&json!({"weatherUtcOffset":null}));assert!(settings["weatherUtcOffset"].is_null());
}
static FULLSCREEN_SHORTCUTS:AtomicBool=AtomicBool::new(false);
static HOTKEY_RECORDING_UNTIL:std::sync::atomic::AtomicU64=std::sync::atomic::AtomicU64::new(0);
fn settings_is_foreground(app:&AppHandle)->bool{app.get_webview_window("settings").and_then(|window|window.hwnd().ok()).is_some_and(|hwnd|unsafe{windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize==hwnd.0 as isize})}
#[tauri::command]
fn hotkeys_recording(on:bool,app:AppHandle,state:tauri::State<'_,Arc<AppState>>)->bool{
 if win::WindowManager::passive_qa(){return true;}
 if on&&!settings_is_foreground(&app){return false;}
 let next=if on{media::now_ms()+15000}else{0};let previous=HOTKEY_RECORDING_UNTIL.swap(next,Ordering::Relaxed);
 if !on||previous==0||previous<=media::now_ms(){let errors=register_hotkeys(&app,&state.settings.lock().unwrap());*state.hotkey_errors.lock().unwrap()=errors;}
 true
}
fn register_hotkeys(app:&AppHandle,settings:&Value)->Vec<String>{
 if win::WindowManager::passive_qa() { return Vec::new(); }
 let filtered=visibility::shortcut_settings(settings,FULLSCREEN_SHORTCUTS.load(Ordering::Relaxed));let settings=&filtered;
 use tauri_plugin_global_shortcut::{GlobalShortcutExt,Shortcut,ShortcutState};let manager=app.global_shortcut();let _=manager.unregister_all();let mut errors=Vec::new();
 if HOTKEY_RECORDING_UNTIL.load(Ordering::Relaxed)>media::now_ms(){return errors;}
 for(key,value)in settings.as_object().into_iter().flatten(){if !key.starts_with("hotkey"){continue;}let Some(text)=value.as_str().filter(|s|!s.is_empty())else{continue;};let shortcut=match text.parse::<Shortcut>(){Ok(s)=>s,Err(_)=>{errors.push(format!("Invalid shortcut: {text}"));continue;}};let key=key.clone();if let Err(error)=manager.on_shortcut(shortcut,move|app,_,event|{if event.state==ShortcutState::Pressed{handle_hotkey(app,&key);}}){errors.push(format!("{text}: {error}"));}}

 if FULLSCREEN_SHORTCUTS.load(Ordering::Relaxed) {return errors;}
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
 "hotkeyAutoHide"=>{if let Err(error)=auto_hide_toggle(app.clone(),state){let _=app.emit("island:warn",error);}},
 "hotkeyFullscreen"=>{let on=!state.settings.lock().unwrap()["hideInFullscreen"].as_bool().unwrap_or(true);let _=settings_set(Some(json!({"hideInFullscreen":on})),app.clone(),state);},
 "hotkeyPalette"=>{take_focus(app.clone());let _=app.emit("island:palette",());},"hotkeyToggle"=>{let _=app.emit("island:toggle",json!({}));},"hotkeyClipboard"=>{let _=app.emit("island:toggle",json!({"tab":"clipboard"}));},"hotkeyChat"=>{let _=app.emit("island:toggle",json!({"tab":"chat"}));},
 "hotkeyArea"|"hotkeyScreen"|"hotkeyOcr"|"hotkeyQr"|"hotkeyColor"|"hotkeyRecord"=>{let mode=match key{"hotkeyScreen"=>"screen","hotkeyOcr"=>"ocr","hotkeyQr"=>"qr","hotkeyColor"=>"color","hotkeyRecord"=>"record",_=>"area"};let _=capture_start(Some(mode.into()),app.clone(),state);},
 "hotkeyPlainPaste"=>{if let Some(text)=clip_current_text(){let _=clipboard::paste_to_focused_window(&text);}},"hotkeyMic"=>{let _=audio::toggle_mute(true);},"hotkeyThrough"=>{let _=through_toggle(app.clone(),state);},"hotkeyTheme"=>{let mut settings=state.settings.lock().unwrap();let next=if settings["theme"]==json!("dark"){"light"}else{"dark"};settings["theme"]=json!(next);let _=storage::save_json_file("settings.json",&settings);let _=app.emit("settings:changed",settings.clone());},
 "hotkeyMediaPill"=>{let mut settings=state.settings.lock().unwrap();let kinds=["normal","title","player","lyrics"];let current=settings["mediaPill"].as_str().unwrap_or("normal");let next=kinds[(kinds.iter().position(|s|*s==current).unwrap_or(0)+1)%kinds.len()];settings["mediaPill"]=json!(next);let _=storage::save_json_file("settings.json",&settings);let _=app.emit("settings:changed",settings.clone());},
 "hotkeyDictate"=>{let _=speech::toggle(app.clone(),state.settings.lock().unwrap().clone(),None);},
 "hotkeyVoiceCommand"=>{if let Err(error)=speech::toggle(app.clone(),state.settings.lock().unwrap().clone(),Some("command".into())){let _=app.emit("dictation:error",error);}},
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
    static LOG_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _guard = LOG_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    let app_dir = storage::get_storage_dir();
    let log_path = app_dir.join("app.log");
    if std::fs::metadata(&log_path).is_ok_and(|meta| meta.len() > 2 * 1024 * 1024) {
        let _ = std::fs::rename(&log_path, app_dir.join("app.previous.log"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
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
    let clipboard_store = ClipboardStore::open_resilient(db_path).expect("Unable to initialize temporary clipboard");
    app_log("step 2: clipboard db OK");

    let mut loaded_settings = default_settings();
    if let Some(saved) = storage::load_json_file("settings.json") {
        loaded_settings["onboardingCompleted"]=json!(true);
        merge_settings(&mut loaded_settings, &saved);
    }
    if storage::migrate_upload_key(&mut loaded_settings).is_err() {
        storage::warn("Не удалось перенести ключ загрузки изображений. Исходные настройки сохранены.");
        loaded_settings.as_object_mut().unwrap().remove("uploadKey");
    }
    audio::configure(&loaded_settings);
    media::configure(&loaded_settings);
    network::configure_vpn(&loaded_settings);
    agents::configure(loaded_settings["agentsAsk"]!=false);
    let mut browser_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    if loaded_settings["gpuAcceleration"]==false {
        if !browser_args.contains("--disable-gpu") {
            browser_args = format!("{browser_args} --disable-gpu").trim().to_string();
        }
    } else if !browser_args.contains("SkiaGraphite") {
        // Edge WebView2's Skia Graphite (Dawn D3D12) compiles HLSL PSOs synchronously on first draw
        // (130-390ms freezes on first open/tab switches and 100ms+ stalls on window resize).
        // Ganesh (ANGLE D3D11) keeps hardware GPU compositing with locked 6ms frame times.
        browser_args = format!("{browser_args} --disable-features=SkiaGraphite").trim().to_string();
    }
    if !browser_args.is_empty() {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", browser_args);
    }
    // WinRT radio discovery requires MTA; the window thread belongs to OLE/STA.
    let loaded_controls = std::thread::spawn(system::controls).join()
        .unwrap_or_else(|_| json!({"wifi":null,"bluetooth":null,"dark":null,"ethernet":null,"vpns":[]}));

    let loaded_launcher_groups = storage::load_string_file("launcher_groups.json", "[]");
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
        is_tucked: AtomicBool::new(false),
        is_hidden: AtomicBool::new(false),
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
        active_monitor: std::sync::Mutex::new(None),
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .setup(move |app| {
            app_log("setup hook executing");
            phone::initialize(app.handle().clone(),state_clone.clone());
            let surface_app=app.handle().clone();
            app.listen("settings:changed",move |_|{let app=surface_app.clone();tauri::async_runtime::spawn_blocking(move||webai::refresh_surfaces(&app));});
            if let Some(window) = app.get_window("main") {
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
                    if let Some(main_webview) = app.get_webview_window("main") {
                        watchdog::attach_process_failed(&main_webview);
                    }
                    watchdog::start(app.handle().clone(), hwnd_val);
                    snow_surface::start(app.handle().clone(),state_clone.clone());
                    appbar::start(app.handle().clone(),state_clone.clone(),apply_island_geometry);
                    if !win::WindowManager::passive_qa() {
                        setup_tray(app.handle(), state_clone.clone());
                    }
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
            if !(win::WindowManager::passive_qa() && std::env::var("WOODS_QA_SKIP_CLIPBOARD").as_deref()==Ok("1")) {
                clipboard::start_watcher(app.handle().clone(), state_clone.clone());
            }
            obs::start_loop(app.handle().clone(), state_clone.clone());
            agents::start(app.handle().clone());
            start_update_monitor(app.handle().clone(), state_clone.clone());
            notifications::start(app.handle().clone(), state_clone.clone());
            telemetry::start(app.handle().clone(), state_clone.clone());
            peripherals::start(app.handle().clone(), state_clone.clone());
            network::start_controls_monitor(app.handle().clone(), state_clone.clone());
            system_load::start(app.handle().clone(),state_clone.clone());
            let icon_app=app.handle().clone();let icon_state=state_clone.clone();
            tauri::async_runtime::spawn_blocking(move||hydrate_launcher_icons(&icon_app,&icon_state));
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
            page_pong,
            watchdog_status,
            snow_state,
            notch_pill,
            notch_state,
            bootstrap,
            pets_catalog, pets_import_codex, pets_asset,
            report_page_scale,
            report_island_rect,
            web_ai_popped,
            web_ai_open,
            web_ai_embed,
            web_ai_hide,
            web_ai_browser,
            web_ai_window,
            web_ai_status,
            web_ai_window_attach,
            web_ai_window_present,
            web_ai_window_reveal,
            web_ai_reload,
            web_ai_window_close,
            web_ai_window_show,
            agents_now,
            agents_connect,
            agents_connections,
            agents_answer,
            runs_as_admin,
            news_told,
            news_get,
            whatsnew_clip,
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
            phone_start,
            phone_state,
            phone_stop,
            phone_renew,
            phone_allow,
            phone_deny,
            phone_send,
            phone_unsend,
            phone_firewall,
            launcher_list,
            launcher_add,
            launcher_add_link,
            launcher_edit_link,
            launcher_remove,
            launcher_reorder,
            launcher_launch,
            launcher_link_icon,
            launcher_pick_icon,
            launcher_groups_get,
            launcher_groups_set,
            launcher_hotkeys_get,
            launcher_hotkeys_set,
            controls_get,
            audio_mixer_get,
            audio_mixer_set,
            brightness_get,
            brightness_set,
            system_load_get,
            system_load_status,
            task_manager_open,
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
            clip_text,
            clip_set_text,
            clip_set_png,
            media_control,
            media_sources,
            media_pick,
            media_rename,
            media_seek,
            media_cover_recover,
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
            peripherals_get,
            peripherals_refresh,
            peripherals_g435_measure,
            bt_switch,
            vpn_chip,
            vpn_refresh,
            vpn_toggle_now,
            theme_flip,
            through_toggle,
            auto_hide_toggle,
            web_ai_permissions_reset,
            hover,
            island_tall,
            set_island_hidden,
            fullscreen,
            fullscreen_hide_toggle,
            hotkeys_check,
            hotkeys_recording,
            open_settings,
            open_path,
            open_captures,
            run_shell,
            quit,
            restart_island,
            update_check,
            update_install,
            update_status,
            update_download,
            update_cancel,
            upload_key_status,
            upload_key_set,
            diagnostics_summary,
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
            overlay_left,
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
            everything_status,
            files_search,
            files_warm,
            attach_data,
            attach_paths,
            attach_pick,
            attachments_prune,
            notifications_access,
            notifications_request,
            notifications_icon,
            palette_apps,
            installed_browsers,
            open_programs,
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
            ai_proxy_set,
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
            tauri::RunEvent::MainEventsCleared => {}
            tauri::RunEvent::TrayIconEvent(tauri::tray::TrayIconEvent::Move { .. }) => {}
            tauri::RunEvent::Exit => {
                app_log("RunEvent: Exit");
            }
            _ => {}
        }
    });
}
