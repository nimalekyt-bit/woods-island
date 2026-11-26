//! Shell-owned work-area reservation and a non-activating Woods notch strip.
//! Only ABM_NEW/QUERYPOS/SETPOS/REMOVE are used; no global work-area overwrite.
#[path = "surface_monitor.rs"]
mod surface_monitor;
#[path = "appbar_wallpaper.rs"]
mod wallpaper;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    Arc, Mutex, OnceLock,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use windows::{
    core::{w, PCSTR},
    Win32::{
        Foundation::{BOOL, COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, RECT, WPARAM},
        Graphics::Gdi::{
            BeginPaint, EndPaint, FillRect, GetStockObject, InvalidateRect, StretchDIBits,
            BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLACK_BRUSH, DIB_RGB_COLORS, HBRUSH, PAINTSTRUCT,
            SRCCOPY,
        },
        System::LibraryLoader::{GetModuleHandleW, GetProcAddress},
        UI::{
            Shell::{
                SHAppBarMessage, ABE_TOP, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETPOS, APPBARDATA,
            },
            WindowsAndMessaging::{
                CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
                GetWindowLongPtrW, PostMessageW, PostQuitMessage, RegisterClassW,
                RegisterWindowMessageW, SendMessageTimeoutW, SetLayeredWindowAttributes, SetTimer,
                SetWindowLongPtrW, SetWindowPos, ShowWindow, TranslateMessage, CREATESTRUCTW,
                GWLP_USERDATA, HWND_TOPMOST, LWA_ALPHA, MSG, SMTO_ABORTIFHUNG, SMTO_BLOCK,
                SWP_NOACTIVATE, SW_HIDE, SW_SHOWNOACTIVATE, WM_CLOSE, WM_DESTROY, WM_DISPLAYCHANGE,
                WM_DPICHANGED, WM_ERASEBKGND, WM_NCCREATE, WM_NCDESTROY, WM_NCHITTEST, WM_PAINT,
                WM_POWERBROADCAST, WM_TIMER, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
                WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
            },
        },
    },
};
const UPDATE: u32 = 0x8000 + 120;
const SHELL_NOTICE: u32 = UPDATE + 1;
type GeometryCallback = fn(&AppHandle, &crate::AppState) -> Result<(), String>;
static SERVICE: OnceLock<Arc<Service>> = OnceLock::new();
struct Service {
    app: AppHandle,
    owner: Arc<crate::AppState>,
    on_geometry: GeometryCallback,
    hwnd: AtomicIsize,
    stopped: AtomicBool,
    dirty: AtomicBool,
    pill_height: Mutex<f64>,
    snapshot: Mutex<Value>,
    loading: AtomicBool,
    paint: Mutex<Paint>,
}
#[derive(Clone, PartialEq, Debug)]
struct Config {
    monitor: surface_monitor::Monitor,
    height: i32,
    look: &'static str,
}
#[derive(Clone, PartialEq, Eq)]
struct PaintKey {
    monitor: (i32, i32, i32, i32),
    strip: (i32, i32, i32, i32),
}
struct Paint {
    key: Option<PaintKey>,
    bitmap: Option<wallpaper::Bitmap>,
    error: Option<String>,
    at: Instant,
}
struct Native {
    registered: bool,
    rect: Option<(i32, i32, i32, i32)>,
    visible: bool,
    config: Option<Config>,
    glass: bool,
}
struct WindowData {
    service: Arc<Service>,
    native: Mutex<Native>,
    applying: AtomicBool,
    taskbar_created: u32,
}
fn height(value: f64, scale: f64, zoom: f64, capsule: bool) -> i32 {
    let value = if value.is_finite() {
        value.clamp(16., 200.)
    } else {
        32.
    };
    ((value + if capsule { 8. } else { 0. }) * scale.clamp(1., 8.) * zoom.clamp(0.8, 2.)).ceil()
        as i32
}
fn config(service: &Service, settings: &Value) -> Result<Config, String> {
    let monitor = surface_monitor::selected(settings["monitor"].as_str().unwrap_or_default())?;
    let value = *service
        .pill_height
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let zoom = settings["scale"]
        .as_f64()
        .filter(|value| value.is_finite())
        .unwrap_or(100.)
        .clamp(80., 200.)
        / 100.;
    Ok(Config {
        height: height(value, monitor.scale, zoom, settings["style"] == "capsule")
            .min((monitor.height - 1).max(1)),
        monitor,
        look: match settings["notchLook"].as_str() {
            Some("glass") => "glass",
            Some("wallpaper") => "wallpaper",
            _ => "black",
        },
    })
}
fn bar_data(hwnd: HWND) -> APPBARDATA {
    APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        hWnd: hwnd,
        uCallbackMessage: SHELL_NOTICE,
        uEdge: ABE_TOP,
        ..Default::default()
    }
}
fn reserve(hwnd: HWND, config: &Config) -> Result<(i32, i32, i32, i32), String> {
    let mut data = bar_data(hwnd);
    data.rc = RECT {
        left: config.monitor.left,
        top: config.monitor.top,
        right: config.monitor.left + config.monitor.width,
        bottom: config.monitor.top + config.height,
    };
    unsafe {
        SHAppBarMessage(ABM_QUERYPOS, &mut data);
    }
    data.rc.bottom = data.rc.top + config.height;
    Ok((data.rc.left, data.rc.top, data.rc.right, data.rc.bottom))
}
fn glass(hwnd: HWND, on: bool) -> bool {
    #[repr(C)]
    struct Accent {
        state: u32,
        flags: u32,
        color: u32,
        animation: u32,
    }
    #[repr(C)]
    struct Data {
        attribute: u32,
        policy: *mut Accent,
        size: usize,
    }
    unsafe {
        let Ok(module) = GetModuleHandleW(w!("user32.dll")) else {
            return false;
        };
        let Some(address) =
            GetProcAddress(module, PCSTR(b"SetWindowCompositionAttribute\0".as_ptr()))
        else {
            return false;
        };
        let function: unsafe extern "system" fn(HWND, *mut Data) -> BOOL =
            std::mem::transmute(address);
        let mut accent = Accent {
            state: if on { 3 } else { 0 },
            flags: 2,
            color: 0x99202020,
            animation: 0,
        };
        let mut data = Data {
            attribute: 19,
            policy: &mut accent,
            size: std::mem::size_of::<Accent>(),
        };
        function(hwnd, &mut data).as_bool()
    }
}
fn wallpaper(service: &Arc<Service>, key: PaintKey) {
    {
        let paint = service
            .paint
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if paint.key.as_ref() == Some(&key) && paint.at.elapsed() < Duration::from_secs(30) {
            return;
        }
    }
    if service.loading.swap(true, Ordering::SeqCst) {
        return;
    }
    let worker = service.clone();
    if std::thread::Builder::new()
        .name("woods-notch-wallpaper".into())
        .spawn(move || {
            let result = wallpaper::load(key.monitor, key.strip);
            if !worker.stopped.load(Ordering::SeqCst) {
                let mut paint = worker
                    .paint
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if paint.key.as_ref() != Some(&key) {
                    paint.bitmap = None;
                }
                match result {
                    Ok(bitmap) => {
                        paint.bitmap = Some(bitmap);
                        paint.error = None;
                    }
                    Err(error) => paint.error = Some(error),
                }
                paint.key = Some(key);
                paint.at = Instant::now();
            }
            worker.loading.store(false, Ordering::SeqCst);
            post(&worker);
        })
        .is_err()
    {
        service.loading.store(false, Ordering::SeqCst);
    }
}
fn publish(
    data: &WindowData,
    config: Option<&Config>,
    reason: &str,
    error: Option<String>,
    notify_geometry: bool,
) {
    let native = data
        .native
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let paint = data
        .service
        .paint
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let mut next = json!({"active":native.registered,"visible":native.visible,"reason":reason,"error":error,
        "look":config.map(|config|config.look),"glassSupported":native.glass,"wallpaperAvailable":paint.bitmap.is_some(),
        "wallpaperError":paint.error,"wallpaperLoading":data.service.loading.load(Ordering::SeqCst),"rect":native.rect,"monitor":config.map(|config|config.monitor.name.clone()),
        "monitorLeft":config.map(|config|config.monitor.left),"monitorTop":config.map(|config|config.monitor.top),"height":config.map(|config|config.height)});
    drop(paint);
    drop(native);
    let changed = {
        let mut snapshot = data
            .service
            .snapshot
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let revision = snapshot["revision"].as_u64().unwrap_or(0);
        next["revision"] = json!(revision);
        if *snapshot == next {
            false
        } else {
            next["revision"] = json!(revision.saturating_add(1));
            *snapshot = next.clone();
            true
        }
    };
    if changed {
        let _ = data.service.app.emit("appbar:state", next);
    }
    if notify_geometry {
        let service = data.service.clone();
        let app = service.app.clone();
        let _ = app.run_on_main_thread(move || {
            if !service.stopped.load(Ordering::SeqCst) {
                if let Err(error) = (service.on_geometry)(&service.app, &service.owner) {
                    crate::app_log(&format!("Notch geometry: {error}"));
                }
            }
        });
    }
}
fn remove(hwnd: HWND, data: &WindowData) -> bool {
    let (registered, visible) = {
        let mut native = data
            .native
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let before = (native.registered, native.visible);
        native.registered = false;
        native.visible = false;
        native.rect = None;
        native.config = None;
        before
    };
    if registered {
        unsafe {
            SHAppBarMessage(ABM_REMOVE, &mut bar_data(hwnd));
        }
    }
    if visible {
        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
        }
    }
    registered
}
fn apply(hwnd: HWND, data: &WindowData) {
    if data.applying.swap(true, Ordering::SeqCst) {
        return;
    }
    struct Unlock<'a>(&'a AtomicBool);
    impl Drop for Unlock<'_> {
        fn drop(&mut self) {
            self.0.store(false, Ordering::SeqCst);
        }
    }
    let _unlock = Unlock(&data.applying);
    if data.service.stopped.load(Ordering::SeqCst) {
        let changed = remove(hwnd, data);
        publish(data, None, "stopped", None, changed);
        return;
    }
    let Ok(settings) = data
        .service
        .owner
        .settings
        .try_lock()
        .map(|settings| settings.clone())
    else {
        return;
    };
    if settings["notchBar"] != true {
        let changed = remove(hwnd, data);
        publish(data, None, "setting", None, changed);
        return;
    }
    let config = match config(&data.service, &settings) {
        Ok(config) => config,
        Err(error) => {
            let changed = remove(hwnd, data);
            publish(data, None, "monitor", Some(error), changed);
            return;
        }
    };
    // Ordinary passive acceptance must never change the owner's desktop work area.
    if crate::win::WindowManager::passive_qa() {
        let changed = remove(hwnd, data);
        publish(data, Some(&config), "qa", None, changed);
        return;
    }
    let (registered, old_rect, old_config, was_visible) = {
        let native = data
            .native
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        (
            native.registered,
            native.rect,
            native.config.clone(),
            native.visible,
        )
    };
    let dirty = data.service.dirty.swap(false, Ordering::SeqCst);
    if !registered {
        if unsafe { SHAppBarMessage(ABM_NEW, &mut bar_data(hwnd)) } == 0 {
            publish(
                data,
                Some(&config),
                "registration",
                Some("Notch registration failed".into()),
                false,
            );
            return;
        }
        data.native
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .registered = true;
    }
    let mut rect = old_rect;
    let mut geometry_changed = false;
    if !registered || dirty || old_config.as_ref() != Some(&config) {
        match reserve(hwnd, &config) {
            Ok(position) => {
                if old_rect != Some(position) {
                    let mut shell = bar_data(hwnd);
                    shell.rc = RECT {
                        left: position.0,
                        top: position.1,
                        right: position.2,
                        bottom: position.3,
                    };
                    unsafe {
                        SHAppBarMessage(ABM_SETPOS, &mut shell);
                    }
                    let position = (shell.rc.left, shell.rc.top, shell.rc.right, shell.rc.bottom);
                    if unsafe {
                        SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            position.0,
                            position.1,
                            position.2 - position.0,
                            position.3 - position.1,
                            SWP_NOACTIVATE,
                        )
                    }
                    .is_err()
                    {
                        let changed = remove(hwnd, data);
                        publish(
                            data,
                            Some(&config),
                            "geometry",
                            Some("Notch position failed".into()),
                            changed,
                        );
                        return;
                    }
                    rect = Some(position);
                    geometry_changed = true;
                }
            }
            Err(error) => {
                let changed = remove(hwnd, data);
                publish(data, Some(&config), "geometry", Some(error), changed);
                return;
            }
        }
    }
    let look_changed = old_config.as_ref().map(|old| old.look) != Some(config.look);
    let glass_supported = if look_changed {
        let supported = glass(hwnd, config.look == "glass");
        unsafe {
            let _ = SetLayeredWindowAttributes(
                hwnd,
                COLORREF(0),
                if config.look == "glass" { 190 } else { 255 },
                LWA_ALPHA,
            );
        }
        supported && config.look == "glass"
    } else {
        data.native
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .glass
    };
    let island = data
        .service
        .owner
        .main_hwnd
        .try_lock()
        .ok()
        .and_then(|hwnd| *hwnd)
        .unwrap_or(0);
    let hidden = data.service.owner.is_hidden.load(Ordering::SeqCst)
        || data.service.owner.is_tucked.load(Ordering::SeqCst);
    let fullscreen = surface_monitor::fullscreen(&config.monitor, HWND(island as _));
    let visible = !hidden && !fullscreen;
    if visible != was_visible {
        unsafe {
            let _ = ShowWindow(hwnd, if visible { SW_SHOWNOACTIVATE } else { SW_HIDE });
        }
    }
    {
        let mut native = data
            .native
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        native.rect = rect;
        native.visible = visible;
        native.config = Some(config.clone());
        native.glass = glass_supported;
    }
    if config.look == "wallpaper" {
        if let Some(strip) = rect {
            wallpaper(
                &data.service,
                PaintKey {
                    monitor: (
                        config.monitor.left,
                        config.monitor.top,
                        config.monitor.left + config.monitor.width,
                        config.monitor.top + config.monitor.height,
                    ),
                    strip,
                },
            );
        }
    }
    if look_changed || geometry_changed {
        unsafe {
            let _ = InvalidateRect(hwnd, None, true);
        }
    }
    publish(
        data,
        Some(&config),
        if fullscreen {
            "fullscreen"
        } else if hidden {
            "hidden"
        } else {
            "enabled"
        },
        None,
        geometry_changed || !registered,
    );
}
unsafe fn paint(hwnd: HWND, data: &WindowData) {
    let mut paint = PAINTSTRUCT::default();
    let hdc = BeginPaint(hwnd, &mut paint);
    FillRect(hdc, &paint.rcPaint, HBRUSH(GetStockObject(BLACK_BRUSH).0));
    let native = data
        .native
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if native
        .config
        .as_ref()
        .is_some_and(|config| config.look == "wallpaper")
    {
        let image = data
            .service
            .paint
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let (Some(bitmap), Some(key), Some(rect)) = (&image.bitmap, &image.key, native.rect) {
            if key.strip == rect {
                let header = BITMAPINFO {
                    bmiHeader: BITMAPINFOHEADER {
                        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                        biWidth: bitmap.width,
                        biHeight: -bitmap.height,
                        biPlanes: 1,
                        biBitCount: 32,
                        biCompression: BI_RGB.0,
                        ..Default::default()
                    },
                    ..Default::default()
                };
                StretchDIBits(
                    hdc,
                    0,
                    0,
                    bitmap.width,
                    bitmap.height,
                    0,
                    0,
                    bitmap.width,
                    bitmap.height,
                    Some(bitmap.bgra.as_ptr().cast()),
                    &header,
                    DIB_RGB_COLORS,
                    SRCCOPY,
                );
            }
        }
    }
    let _ = EndPaint(hwnd, &paint);
}
unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if message == WM_NCCREATE {
        let create = &*(lparam.0 as *const CREATESTRUCTW);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, create.lpCreateParams as isize);
        return LRESULT(1);
    }
    let pointer = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const WindowData;
    if !pointer.is_null() {
        let data = &*pointer;
        if data.taskbar_created != 0 && message == data.taskbar_created {
            let mut native = data
                .native
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            native.registered = false;
            native.rect = None;
            native.config = None;
            drop(native);
            data.service.dirty.store(true, Ordering::SeqCst);
            post(&data.service);
            return LRESULT(0);
        }
        match message {
            WM_NCHITTEST => return LRESULT(-1),
            WM_ERASEBKGND => return LRESULT(1),
            WM_PAINT => {
                paint(hwnd, data);
                return LRESULT(0);
            }
            UPDATE => {
                apply(hwnd, data);
                if data
                    .native
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .config
                    .as_ref()
                    .is_some_and(|config| config.look == "wallpaper")
                {
                    let _ = InvalidateRect(hwnd, None, false);
                }
                return LRESULT(0);
            }
            WM_TIMER => {
                apply(hwnd, data);
                return LRESULT(0);
            }
            SHELL_NOTICE | WM_DISPLAYCHANGE | WM_DPICHANGED => {
                data.service.dirty.store(true, Ordering::SeqCst);
                return LRESULT(0);
            }
            WM_POWERBROADCAST if matches!(wparam.0, 7 | 18) => {
                data.service.dirty.store(true, Ordering::SeqCst);
                return LRESULT(1);
            }
            WM_CLOSE => {
                let changed = remove(hwnd, data);
                publish(data, None, "stopped", None, changed);
                let _ = DestroyWindow(hwnd);
                return LRESULT(0);
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                return LRESULT(0);
            }
            WM_NCDESTROY => {
                let _ = data.service.hwnd.compare_exchange(
                    hwnd.0 as isize,
                    0,
                    Ordering::SeqCst,
                    Ordering::SeqCst,
                );
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            }
            _ => {}
        }
    }
    DefWindowProcW(hwnd, message, wparam, lparam)
}
fn post(service: &Service) {
    let value = service.hwnd.load(Ordering::SeqCst);
    if value != 0 && !service.stopped.load(Ordering::SeqCst) {
        unsafe {
            let _ = PostMessageW(HWND(value as _), UPDATE, WPARAM(0), LPARAM(0));
        }
    }
}
pub fn start(app: AppHandle, owner: Arc<crate::AppState>, on_geometry: GeometryCallback) -> bool {
    let service = Arc::new(Service {
        app,
        owner,
        on_geometry,
        hwnd: AtomicIsize::new(0),
        stopped: AtomicBool::new(false),
        dirty: AtomicBool::new(true),
        pill_height: Mutex::new(32.),
        snapshot: Mutex::new(
            json!({"active":false,"visible":false,"revision":0,"reason":"starting"}),
        ),
        loading: AtomicBool::new(false),
        paint: Mutex::new(Paint {
            key: None,
            bitmap: None,
            error: None,
            at: Instant::now(),
        }),
    });
    if SERVICE.set(service.clone()).is_err() {
        return false;
    }
    std::thread::Builder::new()
        .name("woods-notch-strip".into())
        .spawn(move || unsafe {
            let instance = match GetModuleHandleW(None) {
                Ok(module) => HINSTANCE(module.0),
                Err(error) => {
                    crate::app_log(&format!("Notch window: {error}"));
                    return;
                }
            };
            let class = WNDCLASSW {
                lpfnWndProc: Some(window_proc),
                hInstance: instance,
                lpszClassName: w!("WoodsIslandReservedStrip"),
                ..Default::default()
            };
            if RegisterClassW(&class) == 0 {
                crate::app_log("Notch window class unavailable");
                return;
            }
            let data = Box::new(WindowData {
                service: service.clone(),
                native: Mutex::new(Native {
                    registered: false,
                    rect: None,
                    visible: false,
                    config: None,
                    glass: false,
                }),
                applying: AtomicBool::new(false),
                taskbar_created: RegisterWindowMessageW(w!("TaskbarCreated")),
            });
            let hwnd = match CreateWindowExW(
                WS_EX_LAYERED
                    | WS_EX_NOACTIVATE
                    | WS_EX_TOOLWINDOW
                    | WS_EX_TOPMOST
                    | WS_EX_TRANSPARENT,
                w!("WoodsIslandReservedStrip"),
                w!("Woods Island — вырез"),
                WS_POPUP,
                0,
                0,
                1,
                1,
                None,
                None,
                instance,
                Some((&*data as *const WindowData).cast()),
            ) {
                Ok(hwnd) => hwnd,
                Err(error) => {
                    crate::app_log(&format!("Notch window: {error}"));
                    return;
                }
            };
            service.hwnd.store(hwnd.0 as isize, Ordering::SeqCst);
            if SetTimer(hwnd, 1, 500, None) == 0 {
                crate::app_log("Notch timer unavailable");
                let _ = DestroyWindow(hwnd);
                return;
            }
            apply(hwnd, &data);
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).0 > 0 {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            remove(hwnd, &data);
            let _ = DestroyWindow(hwnd);
        })
        .is_ok()
}
pub fn refresh() {
    if let Some(service) = SERVICE.get() {
        service.dirty.store(true, Ordering::SeqCst);
        post(service);
    }
}
pub fn set_pill_height(value: f64) {
    if let Some(service) = SERVICE.get() {
        let value = if value.is_finite() {
            value.clamp(16., 200.)
        } else {
            32.
        };
        let changed = {
            let mut previous = service
                .pill_height
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if (*previous - value).abs() < 0.5 {
                false
            } else {
                *previous = value;
                true
            }
        };
        if changed {
            refresh();
        }
    }
}
pub fn state() -> Value {
    SERVICE
        .get()
        .map(|service| {
            service
                .snapshot
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .clone()
        })
        .unwrap_or_else(|| json!({"active":false,"visible":false,"revision":0,"reason":"disabled"}))
}
pub fn dock_top(left: i32, top: i32) -> Option<i32> {
    let snapshot = state();
    if snapshot["active"] == true
        && snapshot["monitorLeft"] == left
        && snapshot["monitorTop"] == top
    {
        snapshot["rect"]
            .as_array()?
            .get(1)?
            .as_i64()
            .and_then(|value| i32::try_from(value).ok())
    } else {
        None
    }
}
pub fn stop() {
    if let Some(service) = SERVICE.get() {
        service.stopped.store(true, Ordering::SeqCst);
        let value = service.hwnd.load(Ordering::SeqCst);
        if value != 0 {
            unsafe {
                let _ = SendMessageTimeoutW(
                    HWND(value as _),
                    WM_CLOSE,
                    WPARAM(0),
                    LPARAM(0),
                    SMTO_ABORTIFHUNG | SMTO_BLOCK,
                    1000,
                    None,
                );
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reserved_strip_height_is_finite_bounded_and_follows_resting_pill_dpi_and_zoom() {
        assert_eq!(height(32., 1., 1., false), 32);
        assert_eq!(height(32., 2., 1.25, true), 100);
        assert_eq!(height(f64::NAN, 1., 1., false), 32);
        assert_eq!(height(900., 1., 1., false), 200);
        assert_eq!(height(140., 2., 1.5, true), 444);
    }
}
