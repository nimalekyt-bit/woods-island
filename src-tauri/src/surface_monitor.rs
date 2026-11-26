//! Native monitor/window facts for decorative surfaces; no UI-thread round trip.
use windows::Win32::{
    Foundation::{BOOL, HWND, LPARAM, RECT},
    Graphics::{
        Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS},
        Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW},
    },
    UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic,
        IsWindowVisible, MONITORINFOF_PRIMARY,
    },
};
#[link(name = "shcore")]
extern "system" {
    fn GetDpiForMonitor(monitor: HMONITOR, kind: i32, x: *mut u32, y: *mut u32) -> i32;
}
#[derive(Clone, PartialEq, Debug)]
pub struct Monitor {
    pub name: String,
    pub handle: isize,
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
    pub scale: f64,
    pub primary: bool,
}
unsafe extern "system" fn collect(
    handle: HMONITOR,
    _hdc: HDC,
    _rect: *mut RECT,
    data: LPARAM,
) -> BOOL {
    let mut info = MONITORINFOEXW::default();
    info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    if GetMonitorInfoW(
        handle,
        (&mut info as *mut MONITORINFOEXW).cast::<MONITORINFO>(),
    )
    .as_bool()
    {
        let rect = info.monitorInfo.rcMonitor;
        if rect.right > rect.left && rect.bottom > rect.top {
            let end = info
                .szDevice
                .iter()
                .position(|value| *value == 0)
                .unwrap_or(info.szDevice.len());
            let (mut x, mut y) = (96, 96);
            if GetDpiForMonitor(handle, 0, &mut x, &mut y) != 0 {
                x = 96;
            }
            (&mut *(data.0 as *mut Vec<Monitor>)).push(Monitor {
                name: String::from_utf16_lossy(&info.szDevice[..end]),
                handle: handle.0 as isize,
                left: rect.left,
                top: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
                scale: x.max(96) as f64 / 96.,
                primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
            });
        }
    }
    BOOL(1)
}
pub fn selected(name: &str) -> Result<Monitor, String> {
    let mut found = Vec::<Monitor>::new();
    if !unsafe {
        EnumDisplayMonitors(
            None,
            None,
            Some(collect),
            LPARAM((&mut found as *mut Vec<Monitor>) as isize),
        )
    }
    .as_bool()
    {
        return Err("Monitor inventory unavailable".into());
    }
    found
        .iter()
        .find(|monitor| monitor.name == name)
        .or_else(|| found.iter().find(|monitor| monitor.primary))
        .or(found.first())
        .cloned()
        .ok_or_else(|| "Monitor unavailable".into())
}
pub fn fullscreen(monitor: &Monitor, island: HWND) -> bool {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.0.is_null()
            || foreground == island
            || !IsWindowVisible(foreground).as_bool()
            || IsIconic(foreground).as_bool()
        {
            return false;
        }
        // Never treat any window of our own process (snow overlay, settings, Web AI) as fullscreen.
        let mut fg_pid = 0u32;
        GetWindowThreadProcessId(foreground, Some(&mut fg_pid));
        if fg_pid == std::process::id() {
            return false;
        }
        let mut class = [0u16; 256];
        let end = GetClassNameW(foreground, &mut class).max(0) as usize;
        let class = String::from_utf16_lossy(&class[..end]);
        if class == "Progman" || class == "WorkerW" {
            return false;
        }
        let mut cloaked = 0u32;
        if DwmGetWindowAttribute(
            foreground,
            DWMWA_CLOAKED,
            (&mut cloaked as *mut u32).cast(),
            std::mem::size_of::<u32>() as u32,
        )
        .is_ok()
            && cloaked != 0
        {
            return false;
        }
        let mut rect = RECT::default();
        if DwmGetWindowAttribute(
            foreground,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            (&mut rect as *mut RECT).cast(),
            std::mem::size_of::<RECT>() as u32,
        )
        .is_err()
            && GetWindowRect(foreground, &mut rect).is_err()
        {
            return false;
        }
        covers(
            (rect.left, rect.top, rect.right, rect.bottom),
            (
                monitor.left,
                monitor.top,
                monitor.left + monitor.width,
                monitor.top + monitor.height,
            ),
        )
    }
}
fn covers(window: (i32, i32, i32, i32), monitor: (i32, i32, i32, i32)) -> bool {
    window.0 <= monitor.0 && window.1 <= monitor.1 && window.2 >= monitor.2 && window.3 >= monitor.3
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fullscreen_covers_the_selected_monitor_without_confusing_negative_origins_or_taskbars() {
        let left = (-1920, 0, 0, 1080);
        assert!(covers(left, left));
        assert!(!covers((0, 0, 1920, 1080), left));
        assert!(!covers((-1920, 0, 0, 1040), left));
        assert!(covers((-1928, -8, 8, 1088), left));
    }
}
