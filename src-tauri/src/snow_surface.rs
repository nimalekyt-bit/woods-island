//! One non-activating, click-through snow surface on the island's monitor.
//! Native visibility changes only at state transitions; geometry never shows it.
#[path = "surface_monitor.rs"]
mod surface_monitor;
use chrono::{Datelike, Local, NaiveDate};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Condvar, Mutex, OnceLock,
};
use std::time::{Duration, Instant};
use surface_monitor::Monitor as Geometry;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow};
use windows::Win32::{
    Foundation::HWND,
    Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND},
    UI::WindowsAndMessaging::{
        GetWindowLongPtrW, IsWindowVisible, SetWindowLongPtrW, SetWindowPos, ShowWindow,
        GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
        SWP_NOSIZE, SW_HIDE, SW_SHOWNOACTIVATE, WS_BORDER, WS_CAPTION, WS_DLGFRAME,
        WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_MAXIMIZEBOX,
        WS_MINIMIZEBOX, WS_POPUP, WS_THICKFRAME,
    },
};

pub const LABEL: &str = "snow-screen";
static SERVICE: OnceLock<Arc<Service>> = OnceLock::new();
struct Service {
    app: AppHandle,
    owner: Arc<crate::AppState>,
    stopped: AtomicBool,
    wake: (Mutex<bool>, Condvar),
    surface: Mutex<Surface>,
}
struct Surface {
    snapshot: Value,
    geometry: Option<Geometry>,
    visible: bool,
    creation_after: Instant,
    fullscreen_hits: u8,
}
#[derive(Debug, PartialEq)]
struct Options {
    selected: bool,
    screen: bool,
    amount: f64,
    motion: &'static str,
}
fn recurring_day(value: Option<&str>, fallback: u32) -> u32 {
    let Some(value) = value else {
        return fallback;
    };
    let Some((month, day)) = value.trim().split_once('-') else {
        return fallback;
    };
    if month.is_empty() || month.len() > 2 || day.is_empty() || day.len() > 2 {
        return fallback;
    }
    let (Ok(month), Ok(day)) = (month.parse::<u32>(), day.parse::<u32>()) else {
        return fallback;
    };
    NaiveDate::from_ymd_opt(2000, month, day)
        .map(|date| date.month() * 100 + date.day())
        .unwrap_or(fallback)
}
fn date_active(settings: &Value, date: NaiveDate) -> bool {
    let start = recurring_day(settings["snowFrom"].as_str(), 1215);
    let end = recurring_day(settings["snowTo"].as_str(), 115);
    let day = date.month() * 100 + date.day();
    if start <= end {
        day >= start && day <= end
    } else {
        day >= start || day <= end
    }
}
fn options(settings: &Value, date: NaiveDate) -> Options {
    Options {
        selected: match settings["snow"].as_str() {
            Some("on") => true,
            Some("off") => false,
            _ => date_active(settings, date),
        },
        screen: settings["snowScreen"] == true,
        amount: settings["snowAmount"]
            .as_f64()
            .filter(|value| value.is_finite())
            .unwrap_or(100.)
            .clamp(25., 300.),
        motion: match settings["reducedMotion"].as_str() {
            Some("full") => "full",
            Some("reduce") => "reduce",
            _ => "auto",
        },
    }
}
fn monitor(_app: &AppHandle, settings: &Value) -> Result<Geometry, String> {
    let name = settings["monitor"].as_str().unwrap_or_default();
    surface_monitor::selected(name)
}
fn build(app: &AppHandle) -> Result<WebviewWindow, String> {
    let window = tauri::WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("snow.html".into()))
        .title("Woods Island — снег")
        .visible(false)
        .focused(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .disable_drag_drop_handler()
        .build()
        .map_err(|error| error.to_string())?;
    let configured = (|| -> Result<(), String> {
        window
            .set_focusable(false)
            .map_err(|error| error.to_string())?;
        window
            .set_ignore_cursor_events(true)
            .map_err(|error| error.to_string())?;
        let hwnd = HWND(window.hwnd().map_err(|error| error.to_string())?.0 as _);
        unsafe {
            let no_round: i32 = DWMWCP_DONOTROUND.0;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &no_round as *const _ as _,
                std::mem::size_of::<i32>() as u32,
            );
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let clean_style = (style
                & !(WS_CAPTION.0 as isize
                    | WS_BORDER.0 as isize
                    | WS_DLGFRAME.0 as isize
                    | WS_THICKFRAME.0 as isize
                    | WS_MINIMIZEBOX.0 as isize
                    | WS_MAXIMIZEBOX.0 as isize))
                | WS_POPUP.0 as isize;
            SetWindowLongPtrW(hwnd, GWL_STYLE, clean_style);
            let old = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(
                hwnd,
                GWL_EXSTYLE,
                old | WS_EX_TRANSPARENT.0 as isize
                    | WS_EX_NOACTIVATE.0 as isize
                    | WS_EX_TOOLWINDOW.0 as isize
                    | WS_EX_TOPMOST.0 as isize,
            );
            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
        Ok(())
    })();
    if let Err(error) = configured {
        let _ = window.close();
        return Err(error);
    }
    Ok(window)
}
fn apply(service: &Service) {
    if service.stopped.load(Ordering::SeqCst) {
        return;
    }
    let Ok(settings) = service
        .owner
        .settings
        .try_lock()
        .map(|settings| settings.clone())
    else {
        return;
    };
    let options = options(&settings, Local::now().date_naive());
    let tucked = service.owner.is_tucked.load(Ordering::SeqCst);
    let explicitly_hidden = service.owner.is_hidden.load(Ordering::SeqCst);
    let geometry = monitor(&service.app, &settings);
    let mut reason = if !options.selected {
        "date"
    } else if !options.screen {
        "setting"
    } else if options.motion == "reduce" {
        "motion"
    } else if tucked {
        "tucked"
    } else if explicitly_hidden {
        "hidden"
    } else {
        "enabled"
    };
    let mut enabled = reason == "enabled";
    let mut error = None;
    let geometry = match geometry {
        Ok(geometry) => Some(geometry),
        Err(failure) => {
            enabled = false;
            reason = "monitor";
            error = Some(failure);
            None
        }
    };
    if enabled {
        if let Ok(hwnd) = service.owner.main_hwnd.try_lock() {
            let main_hwnd = HWND(hwnd.unwrap_or(0) as _);
            if !crate::win::WindowManager::passive_qa()
                && hwnd.is_some_and(|hwnd| !unsafe { IsWindowVisible(HWND(hwnd as _)) }.as_bool())
            {
                enabled = false;
                reason = "hidden";
            } else if geometry
                .as_ref()
                .is_some_and(|monitor| surface_monitor::fullscreen(monitor, main_hwnd))
            {
                // Require 2 consecutive detections so transient focus switches never blink snow.
                let hits = {
                    let mut surface = service
                        .surface
                        .lock()
                        .unwrap_or_else(|failure| failure.into_inner());
                    surface.fullscreen_hits = surface.fullscreen_hits.saturating_add(1);
                    surface.fullscreen_hits
                };
                if hits >= 2 || crate::win::WindowManager::passive_qa() {
                    enabled = false;
                    reason = "fullscreen";
                }
            } else {
                service
                    .surface
                    .lock()
                    .unwrap_or_else(|failure| failure.into_inner())
                    .fullscreen_hits = 0;
            }
        } else {
            return;
        }
    } else {
        service
            .surface
            .lock()
            .unwrap_or_else(|failure| failure.into_inner())
            .fullscreen_hits = 0;
    }
    let (old_geometry, was_visible, creation_after) = {
        let surface = service
            .surface
            .lock()
            .unwrap_or_else(|failure| failure.into_inner());
        (
            surface.geometry.clone(),
            surface.visible,
            surface.creation_after,
        )
    };
    let mut window = service.app.get_webview_window(LABEL);
    let mut created_window = false;
    let mut applied_geometry = old_geometry.clone();
    if enabled && window.is_none() {
        if Instant::now() < creation_after {
            enabled = false;
            reason = "retry";
        } else {
            match build(&service.app) {
                Ok(created) => {
                    window = Some(created);
                    created_window = true;
                }
                Err(failure) => {
                    enabled = false;
                    reason = "surface";
                    error = Some(failure);
                    service
                        .surface
                        .lock()
                        .unwrap_or_else(|failure| failure.into_inner())
                        .creation_after = Instant::now() + Duration::from_secs(10);
                }
            }
        }
    }
    let mut visible = was_visible && window.is_some();
    if let Some(window) = &window {
        if created_window || geometry != old_geometry {
            if let Some(geometry) = &geometry {
                // Use Tauri's position + size APIs so WebView2's controller bounds match the full monitor.
                let positioned = window
                    .set_position(PhysicalPosition::new(geometry.left, geometry.top))
                    .and_then(|()| {
                        window.set_size(PhysicalSize::new(
                            geometry.width.max(1) as u32,
                            geometry.height.max(1) as u32,
                        ))
                    })
                    .map_err(|error| error.to_string())
                    .and_then(|()| {
                        window
                            .hwnd()
                            .map_err(|error| error.to_string())
                            .and_then(|hwnd| unsafe {
                                SetWindowPos(
                                    HWND(hwnd.0 as _),
                                    HWND_TOPMOST,
                                    geometry.left,
                                    geometry.top,
                                    geometry.width,
                                    geometry.height,
                                    SWP_NOACTIVATE,
                                )
                                .map_err(|error| error.to_string())
                            })
                    });
                match positioned {
                    Ok(()) => applied_geometry = Some(geometry.clone()),
                    Err(failure) => {
                        enabled = false;
                        reason = "geometry";
                        error = Some(failure);
                    }
                }
            }
        }
        let may_show = enabled && !crate::win::WindowManager::passive_qa();
        if enabled && !may_show {
            reason = "qa";
        }
        if may_show != visible {
            // Show with SW_SHOWNOACTIVATE so the fullscreen overlay never flashes or steals focus.
            let result = window.hwnd().map_err(|error| error.to_string()).map(|hwnd| {
                let snow_hwnd = HWND(hwnd.0 as _);
                unsafe {
                    let _ = ShowWindow(
                        snow_hwnd,
                        if may_show { SW_SHOWNOACTIVATE } else { SW_HIDE },
                    );
                    if may_show {
                        // Place snow below the main island window when available so the island stays on top.
                        let z_after = service
                            .owner
                            .main_hwnd
                            .try_lock()
                            .ok()
                            .and_then(|guard| *guard)
                            .filter(|raw| *raw != 0)
                            .map(|raw| HWND(raw as _))
                            .unwrap_or(HWND_TOPMOST);
                        let _ = SetWindowPos(
                            snow_hwnd,
                            z_after,
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                    }
                }
            });
            match result {
                Ok(()) => visible = may_show,
                Err(failure) => {
                    enabled = false;
                    reason = "visibility";
                    error = Some(failure);
                }
            }
        }
    }
    let mut next = json!({"enabled":enabled,"visible":visible,"amount":options.amount,"motion":options.motion,"reason":reason,
        "error":error,"monitor":geometry.as_ref().map(|geometry|geometry.name.clone()),
        "left":geometry.as_ref().map(|geometry|geometry.left),"top":geometry.as_ref().map(|geometry|geometry.top),
        "width":geometry.as_ref().map(|geometry|geometry.width),"height":geometry.as_ref().map(|geometry|geometry.height),
        "scale":geometry.as_ref().map(|geometry|geometry.scale)});
    let changed = {
        let mut surface = service
            .surface
            .lock()
            .unwrap_or_else(|failure| failure.into_inner());
        let revision = surface.snapshot["revision"].as_u64().unwrap_or(0);
        next["revision"] = json!(revision);
        if next == surface.snapshot {
            false
        } else {
            next["revision"] = json!(revision.saturating_add(1));
            surface.snapshot = next.clone();
            surface.visible = visible;
            surface.geometry = if window.is_some() {
                applied_geometry
            } else {
                None
            };
            true
        }
    };
    if changed {
        let _ = service.app.emit_to(LABEL, "snow:state", next);
    }
}
fn wake(service: &Service) {
    if service.stopped.load(Ordering::SeqCst) {
        return;
    }
    let (lock, cvar) = &service.wake;
    let mut dirty = lock.lock().unwrap_or_else(|e| e.into_inner());
    *dirty = true;
    cvar.notify_one();
}
/// Call in setup after AppState/main HWND exist. No surface is created until enabled.
/// Runs WebviewWindowBuilder::build() strictly off the main UI thread to prevent
/// Tauri 2 / WebView2 re-entrant main-thread deadlocks on Windows.
pub fn start(app: AppHandle, owner: Arc<crate::AppState>) -> bool {
    let service = Arc::new(Service {
        app,
        owner,
        stopped: AtomicBool::new(false),
        wake: (Mutex::new(true), Condvar::new()),
        surface: Mutex::new(Surface {
            snapshot: json!({"enabled":false,"visible":false,"amount":100,"motion":"auto","revision":0,"reason":"starting"}),
            geometry: None,
            visible: false,
            creation_after: Instant::now(),
            fullscreen_hits: 0,
        }),
    });
    if SERVICE.set(service.clone()).is_err() {
        return false;
    }
    std::thread::Builder::new()
        .name("woods-snow-surface".into())
        .spawn(move || {
            let (lock, cvar) = &service.wake;
            while !service.stopped.load(Ordering::SeqCst) {
                apply(&service);
                let guard = lock.lock().unwrap_or_else(|e| e.into_inner());
                if *guard {
                    let mut dirty = guard;
                    *dirty = false;
                    continue;
                }
                let (mut dirty, _) = cvar
                    .wait_timeout(guard, Duration::from_millis(500))
                    .unwrap_or_else(|e| e.into_inner());
                *dirty = false;
            }
        })
        .is_ok()
}
/// Settings, real tucked-state and native resume/display changes can request early refresh.
pub fn refresh() {
    if let Some(service) = SERVICE.get() {
        wake(service);
    }
}
pub fn set_island_visible(_visible: bool) {
    refresh();
}
pub fn state() -> Value {
    SERVICE.get().map(|service|service.surface.lock().unwrap_or_else(|failure|failure.into_inner()).snapshot.clone())
        .unwrap_or_else(||json!({"enabled":false,"visible":false,"amount":100,"motion":"auto","revision":0,"reason":"disabled"}))
}
/// Call before other shutdown work; it never waits for the app's event loop.
pub fn stop() {
    if let Some(service) = SERVICE.get() {
        service.stopped.store(true, Ordering::SeqCst);
        let (lock, cvar) = &service.wake;
        let mut dirty = lock.lock().unwrap_or_else(|e| e.into_inner());
        *dirty = true;
        cvar.notify_all();
        drop(dirty);
        if let Some(window) = service.app.get_webview_window(LABEL) {
            let _ = window.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_calendar_matches_repeating_ranges_and_invalid_day_fallbacks() {
        let settings = json!({"snowFrom":"12-15","snowTo":"01-15"});
        for (month, day, expected) in [
            (12, 14, false),
            (12, 15, true),
            (1, 15, true),
            (1, 16, false),
        ] {
            assert_eq!(
                date_active(
                    &settings,
                    NaiveDate::from_ymd_opt(2026, month, day).unwrap()
                ),
                expected
            );
        }
        assert_eq!(recurring_day(Some("02-29"), 115), 229);
        assert_eq!(recurring_day(Some("02-30"), 115), 115);
        assert_eq!(recurring_day(Some("13-01"), 1215), 1215);
    }
    #[test]
    fn screen_snow_does_not_depend_on_local_fall_and_keeps_motion_override() {
        let settings = json!({"snow":"on","snowScreen":true,"snowFall":false,"snowAmount":900,"reducedMotion":"full"});
        let result = options(&settings, NaiveDate::from_ymd_opt(2026, 7, 1).unwrap());
        assert!(result.selected && result.screen);
        assert_eq!(result.amount, 300.);
        assert_eq!(result.motion, "full");
        assert_eq!(
            options(
                &json!({"snow":"off","snowScreen":true}),
                NaiveDate::from_ymd_opt(2026, 12, 20).unwrap()
            )
            .selected,
            false
        );
    }
}
