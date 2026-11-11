use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
    DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
};
use windows::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject, GetMonitorInfoW, MonitorFromRect, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST, SetWindowRgn};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClientRect, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW, GetWindowRect, GetWindowThreadProcessId,
    SetWindowLongPtrW, SetWindowPos,
    GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST, SM_CXSCREEN,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_SHOWWINDOW,
    WS_BORDER, WS_CAPTION, WS_DLGFRAME, WS_EX_ACCEPTFILES, WS_EX_NOACTIVATE,
    WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
    WS_POPUP, WS_THICKFRAME,
};

const WM_ERASEBKGND: u32 = 0x0014;
const WM_NCCALCSIZE: u32 = 0x0083;
const WM_NCHITTEST: u32 = 0x0084;
const WM_NCPAINT: u32 = 0x0085;
const WM_NCACTIVATE: u32 = 0x0086;

const HTTRANSPARENT: isize = -1;
const HTCLIENT: isize = 1;

#[link(name = "user32")]
extern "system" {
    fn ScreenToClient(hWnd: HWND, lpPoint: *mut POINT) -> BOOL;
    fn GetDpiForWindow(hWnd: HWND) -> u32;
}

type SubclassProc = unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM, usize, usize) -> LRESULT;

#[link(name = "comctl32")]
extern "system" {
    fn SetWindowSubclass(
        hWnd: HWND,
        pfnSubclass: SubclassProc,
        uIdSubclass: usize,
        dwRefData: usize,
    ) -> BOOL;
    fn DefSubclassProc(
        hWnd: HWND,
        uMsg: u32,
        wParam: WPARAM,
        lParam: LPARAM,
    ) -> LRESULT;
}

static CURRENT_BOUNDS: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);
static CLICK_THROUGH: AtomicBool = AtomicBool::new(false);
static ISLAND_HWND: Mutex<isize> = Mutex::new(0);
static PREVIOUS_FOCUS: Mutex<isize> = Mutex::new(0);
static ISLAND_ZOOM: Mutex<f64> = Mutex::new(1.0);
static PAGE_FACTOR: Mutex<Option<f64>> = Mutex::new(None);

fn scaled_bounds(rect: (i32, i32, i32, i32), scale: f64, width: i32, height: i32) -> (i32, i32, i32, i32) {
    let (x1, y1, x2, y2) = rect;
    let left = ((x1 as f64 * scale).floor() as i32).clamp(0, width);
    let top = ((y1 as f64 * scale).floor() as i32).clamp(0, height);
    let right = ((x2 as f64 * scale).ceil() as i32).clamp(left, width);
    let bottom = ((y2 as f64 * scale).ceil() as i32).clamp(top, height);
    (left, top, right, bottom)
}

unsafe extern "system" fn island_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _ref_data: usize,
) -> LRESULT {
    match msg {
        WM_NCCALCSIZE => {
            // When wParam is TRUE, returning 0 removes all non-client frame (titlebar, borders).
            // Zero caption pixels will ever be drawn by DWM across all island states.
            if wparam.0 != 0 {
                return LRESULT(0);
            }
        }
        WM_NCHITTEST => {
            // If click-through mode is active, clicks always pass through to desktop/windows behind.
            if CLICK_THROUGH.load(Ordering::Relaxed) {
                return LRESULT(HTTRANSPARENT);
            }

            let x = (lparam.0 & 0xFFFF) as i16 as i32;
            let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
            let mut pt = POINT { x, y };
            let _ = ScreenToClient(hwnd, &mut pt);

            let bounds = CURRENT_BOUNDS.lock().unwrap();
            if let Some((x1, y1, x2, y2)) = *bounds {
                if pt.x >= x1 && pt.x < x2 && pt.y >= y1 && pt.y < y2 {
                    return LRESULT(HTCLIENT);
                }
            }
            return LRESULT(HTTRANSPARENT);
        }
        WM_NCPAINT => {
            // Suppress non-client painting
            return LRESULT(0);
        }
        WM_NCACTIVATE => {
            // Prevent titlebar repaint on window activation/deactivation
            return LRESULT(1);
        }
        WM_ERASEBKGND => {
            // Suppress background erasing
            return LRESULT(1);
        }
        _ => {}
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub struct WindowManager;

impl WindowManager {
    pub fn passive_qa() -> bool {
        std::env::var("WOODS_ISLAND_PASSIVE_QA").as_deref() == Ok("1")
    }

    pub fn keyboard_focus(hwnd: HWND, active: bool) {
        if Self::passive_qa() { return; }
        unsafe {
            if active {
                let foreground = GetForegroundWindow();
                if foreground != hwnd && !foreground.0.is_null() { *PREVIOUS_FOCUS.lock().unwrap()=foreground.0 as isize; }
            }
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, if active { style & !(WS_EX_NOACTIVATE.0 as isize) } else { style | WS_EX_NOACTIVATE.0 as isize });
            if !active {
                let previous=std::mem::take(&mut *PREVIOUS_FOCUS.lock().unwrap());
                if previous!=0 { let _=windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow(HWND(previous as _)); }
            }
        }
    }
    pub fn scale_factor(hwnd: HWND) -> f64 {
        unsafe { (GetDpiForWindow(hwnd).max(96) as f64) / 96.0 }
    }

    pub fn set_zoom(zoom: f64) {
        *ISLAND_ZOOM.lock().unwrap() = zoom;
        *PAGE_FACTOR.lock().unwrap() = None;
        *CURRENT_BOUNDS.lock().unwrap() = None;
    }

    pub fn effective_scale(hwnd: HWND) -> f64 {
        PAGE_FACTOR.lock().unwrap().unwrap_or_else(|| Self::scale_factor(hwnd) * *ISLAND_ZOOM.lock().unwrap())
    }

    pub fn report_page_width(hwnd: HWND, width: f64) {
        if !width.is_finite() || width <= 0.0 { return; }
        let mut client = RECT::default();
        if unsafe { GetClientRect(hwnd, &mut client) }.is_ok() && client.right > 0 {
            *PAGE_FACTOR.lock().unwrap() = Some(client.right as f64 / width);
        }
    }

    /// Read-only diagnostics for the developer acceptance harness.
    pub fn diagnostics(hwnd: HWND) -> serde_json::Value {
        unsafe {
            let mut client = RECT::default();
            let _ = GetClientRect(hwnd, &mut client);
            let rect = Self::get_window_rect(hwnd).unwrap_or_default();
            let zoom = *ISLAND_ZOOM.lock().unwrap();
            let page_factor = Self::effective_scale(hwnd);
            let mut capture_affinity = 0u32;
            let _ = windows::Win32::UI::WindowsAndMessaging::GetWindowDisplayAffinity(hwnd, &mut capture_affinity);
            serde_json::json!({
                "style": GetWindowLongPtrW(hwnd, GWL_STYLE) as u64,
                "exStyle": GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u64,
                "dpi": GetDpiForWindow(hwnd),
                "scale": Self::scale_factor(hwnd),
                "zoom": zoom,
                "pageFactor": page_factor,
                "captureAffinity": capture_affinity,
                "width": client.right, "height": client.bottom,
                "left": rect.left, "top": rect.top,
                "bounds": *CURRENT_BOUNDS.lock().unwrap(),
                "through": CLICK_THROUGH.load(Ordering::Relaxed),
                "inputTransparent": GetWindowLongPtrW(hwnd, GWL_EXSTYLE) & WS_EX_TRANSPARENT.0 as isize != 0
            })
        }
    }

    /// Foreground state used by auto-hide; compare with its monitor, including negative origins.
    pub fn system_context(island: HWND) -> serde_json::Value {
        unsafe {
            let foreground = GetForegroundWindow();
            let mut pid = 0;
            GetWindowThreadProcessId(foreground, Some(&mut pid));
            let mut fullscreen = false;
            let mut desktop = false;
            let mut executable = String::new();
            if !foreground.0.is_null() && foreground != island {
                let mut class_name = [0u16; 256];
                let size = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(foreground, &mut class_name);
                let class_name = String::from_utf16_lossy(&class_name[..size.max(0) as usize]);
                desktop = class_name == "Progman" || class_name == "WorkerW";
                let monitor = MonitorFromWindow(foreground, MONITOR_DEFAULTTONEAREST);
                let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
                if !desktop && GetMonitorInfoW(monitor, &mut info).as_bool() {
                    if let Some(rect) = Self::get_window_rect(foreground) {
                        let m = info.rcMonitor;
                        fullscreen = rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom;
                    }
                }
                use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
                if let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                    let mut buffer = [0u16; 32768];
                    let mut len = buffer.len() as u32;
                    if QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, windows::core::PWSTR(buffer.as_mut_ptr()), &mut len).is_ok() {
                        executable = std::path::Path::new(&String::from_utf16_lossy(&buffer[..len as usize])).file_name().map(|p|p.to_string_lossy().into_owned()).unwrap_or_default();
                    }
                    let _ = windows::Win32::Foundation::CloseHandle(process);
                }
            }
            serde_json::json!({"fullscreen": fullscreen, "desktop": desktop, "executable": executable, "pid": pid})
        }
    }

    /// Geometry uses physical pixels; monitor selection is provided by Tauri's real inventory.
    pub fn position_on_monitor(hwnd: HWND, left: i32, top: i32, width: i32, scale: f64, zoom: f64, offset_x: i32, below_taskbar: bool, tall: bool) {
        unsafe {
            let canvas_w = (760.0 * scale * zoom).round() as i32;
            let mut canvas_h = (480.0 * scale * zoom).round() as i32;
            let mut y = top;
            let target = RECT {left,top,right:left+width,bottom:top+canvas_h};
            let monitor = MonitorFromRect(&target, MONITOR_DEFAULTTONEAREST);
            let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
            if GetMonitorInfoW(monitor, &mut info).as_bool() && info.rcMonitor.left == left && info.rcMonitor.top == top {
                if below_taskbar { y = info.rcWork.top; }
                if tall { canvas_h = (info.rcMonitor.bottom - y).max(canvas_h); }
            }
            let x = left + (width - canvas_w) / 2 + (offset_x as f64 * scale).round() as i32;
            let _ = SetWindowPos(hwnd, HWND_TOPMOST, x, y, canvas_w, canvas_h, SWP_NOACTIVATE | SWP_FRAMECHANGED);
            // A DPI or geometry change invalidates cached region coordinates.
            *CURRENT_BOUNDS.lock().unwrap() = None;
            *PAGE_FACTOR.lock().unwrap() = None;
        }
    }

    /// Configures the Dynamic Island window:
    /// - Strips all standard frame, caption, border, and maximize/minimize styles
    /// - Sets WS_POPUP to guarantee zero DWM caption bar
    /// - Installs Win32 Subclass procedure:
    ///     * WM_NCCALCSIZE returns 0 -> Complete eradication of caption/titlebar in all modes
    ///     * WM_NCHITTEST returns HTCLIENT inside island, HTTRANSPARENT outside -> 100% desktop click pass-through
    /// - Sets DWM caption & border color to NONE (0xFFFFFFFE)
    /// - Keeps the transparent WebView surface without extending DWM glass
    /// - Always on top
    /// - Does not steal focus (WS_EX_NOACTIVATE)
    /// - Taskbar visibility is managed by Tauri's skipTaskbar setting
    /// - Accepts file drag & drop (WS_EX_ACCEPTFILES)
    pub fn setup_island_window(hwnd: HWND, width: i32, height: i32) {
        if std::env::var("WOODS_SAFE_WIN").is_ok() {
            return;
        }
        unsafe {
            // Enable immersive dark mode
            let dark_mode: i32 = 1;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                &dark_mode as *const _ as _,
                std::mem::size_of::<i32>() as u32,
            );

            // Eliminate any DWM caption & border color (set to DWMWA_COLOR_NONE = 0xFFFFFFFE)
            let color_none: u32 = 0xFFFFFFFE;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_CAPTION_COLOR,
                &color_none as *const _ as _,
                std::mem::size_of::<u32>() as u32,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &color_none as *const _ as _,
                std::mem::size_of::<u32>() as u32,
            );

            // Do not round the outer OS frame (the island draws its own fluid curves)
            let no_round: i32 = DWMWCP_DONOTROUND.0;
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &no_round as *const _ as _,
                std::mem::size_of::<i32>() as u32,
            );

            // Strip WS_CAPTION, WS_BORDER, WS_THICKFRAME, WS_MINIMIZEBOX, WS_MAXIMIZEBOX
            // and add WS_POPUP
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let clean_style = (style & !(WS_CAPTION.0 as isize 
                | WS_BORDER.0 as isize 
                | WS_DLGFRAME.0 as isize 
                | WS_THICKFRAME.0 as isize 
                | WS_MINIMIZEBOX.0 as isize 
                | WS_MAXIMIZEBOX.0 as isize))
                | (WS_POPUP.0 as isize);
            SetWindowLongPtrW(hwnd, GWL_STYLE, clean_style);

            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let new_ex_style = ex_style 
                | (WS_EX_NOACTIVATE.0 as isize)
                | (WS_EX_TOPMOST.0 as isize)
                | (WS_EX_ACCEPTFILES.0 as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style);

            // Install subclass procedure
            let _ = SetWindowSubclass(hwnd, island_subclass_proc, 1001, 0);

            // Center docked at the top edge of the primary monitor
            let scale = Self::scale_factor(hwnd);
            let physical_width = (width as f64 * scale).round() as i32;
            let physical_height = (height as f64 * scale).round() as i32;
            let screen_w = GetSystemMetrics(SM_CXSCREEN);
            let pos_x = (screen_w - physical_width) / 2;
            let pos_y = 0;
            
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                pos_x,
                pos_y,
                physical_width,
                physical_height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
            ).ok();

            // Set initial pill region: centered around x=240..520, y=0..46
            *ISLAND_HWND.lock().unwrap() = hwnd.0 as isize;
            Self::update_island_region(hwnd, Some((240, 0, 520, 46)));
        }
    }

    /// Sets whether click-through mode is active
    pub fn set_click_through(through: bool) {
        if CLICK_THROUGH.swap(through, Ordering::Relaxed) == through { return; }
        let value = *ISLAND_HWND.lock().unwrap();
        if value != 0 {
            unsafe {
                let hwnd = HWND(value as _);
                let old = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                let next = if through {old | WS_EX_TRANSPARENT.0 as isize} else {old & !(WS_EX_TRANSPARENT.0 as isize)};
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
            }
        }
    }

    /// Clip only the empty canvas, with space for antialiasing, ears and shadows.
    /// The rectangle follows the actual animated DOM size, never a rounded GDI
    /// substitute for the liquid contour. Hover never changes WebView styles.
    pub fn update_island_region(hwnd: HWND, rect: Option<(i32, i32, i32, i32)>) {
        unsafe {
            let next = match rect {
                Some((x1, y1, x2, y2)) => {
                    let mut client = RECT::default();
                    if GetClientRect(hwnd, &mut client).is_err() { return; }
                    let scale = Self::effective_scale(hwnd);
                    let (rx1, ry1, rx2, ry2) = scaled_bounds((x1, y1, x2, y2), scale, client.right.max(0), client.bottom.max(0));
                    Some((rx1, ry1, rx2, ry2))
                }
                None => None,
            };
            let mut bounds = CURRENT_BOUNDS.lock().unwrap();
            if *bounds == next {return;}
            *bounds = next;
            drop(bounds);
            let pad = (24.0 * Self::effective_scale(hwnd)).ceil() as i32;
            let region = match next {
                Some((left,top,right,bottom)) => CreateRectRgn((left-pad).max(0),(top-pad).max(0),right+pad,bottom+pad),
                None => CreateRectRgn(0,0,0,0),
            };
            if SetWindowRgn(hwnd, region, true) == 0 {let _ = DeleteObject(region);}
        }
    }

    /// Returns current cursor position in screen coordinates
    pub fn get_cursor_pos() -> Option<(i32, i32)> {
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut pt).is_ok() {
                Some((pt.x, pt.y))
            } else {
                None
            }
        }
    }

    /// Returns the window rect in screen coordinates
    pub fn get_window_rect(hwnd: HWND) -> Option<RECT> {
        unsafe {
            let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            if GetWindowRect(hwnd, &mut rect).is_ok() {
                Some(rect)
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::scaled_bounds;

    #[test]
    fn css_bounds_follow_monitor_dpi() {
        assert_eq!(scaled_bounds((240, 0, 520, 46), 1.25, 950, 600), (300, 0, 650, 58));
        assert_eq!(scaled_bounds((240, 0, 520, 46), 2.0, 1520, 960), (480, 0, 1040, 92));
    }

    #[test]
    fn off_canvas_bounds_are_clamped_without_inverting() {
        assert_eq!(scaled_bounds((-10, -5, 900, 800), 1.0, 760, 480), (0, 0, 760, 480));
        assert_eq!(scaled_bounds((900, 600, -1, -1), 1.0, 760, 480), (760, 480, 760, 480));
    }
}
