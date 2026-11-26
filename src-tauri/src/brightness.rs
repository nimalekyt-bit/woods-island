use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::sync::{mpsc, OnceLock};
use std::time::{Duration, Instant};
use windows::Win32::{
    Devices::Display::*,
    Foundation::{BOOL, LPARAM, RECT},
    Graphics::Gdi::*,
};

struct Monitor {
    id: String,
    name: String,
    physical: PHYSICAL_MONITOR,
    min: u32,
    max: u32,
    level: u32,
    method: BrightnessMethod,
}
#[derive(Clone, Copy)]
enum BrightnessMethod {
    Monitor,
    Vcp,
    Unavailable,
}
impl Drop for Monitor {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyPhysicalMonitors(&[self.physical]);
        }
    }
}
impl Monitor {
    fn value(&self) -> Value {
        json!({"id":self.id,"name":self.name,"level":if matches!(self.method,BrightnessMethod::Unavailable){Value::Null}else{json!(self.level)}})
    }
    fn refresh(&mut self) -> bool {
        let Some((method, min, current, max)) = read_brightness(self.physical) else {
            return false;
        };
        self.method = method;
        self.min = min;
        self.max = max;
        self.level = percentage(min, current, max).unwrap_or(0);
        true
    }
    fn write(&mut self, percent: f64) -> Result<(), String> {
        let raw = physical_level(percent, self.min, self.max)?;
        let accepted = unsafe {
            match self.method {
                BrightnessMethod::Monitor => {
                    SetMonitorBrightness(self.physical.hPhysicalMonitor, raw) != 0
                }
                BrightnessMethod::Vcp => {
                    SetVCPFeature(self.physical.hPhysicalMonitor, 0x10, raw) != 0
                }
                BrightnessMethod::Unavailable => false,
            }
        };
        if !accepted {
            return Err("The monitor did not accept this brightness".into());
        }
        self.level = percentage(self.min, raw, self.max).unwrap_or(0);
        Ok(())
    }
}
fn read_brightness(physical: PHYSICAL_MONITOR) -> Option<(BrightnessMethod, u32, u32, u32)> {
    let (mut min, mut current, mut max) = (0, 0, 0);
    unsafe {
        if GetMonitorBrightness(physical.hPhysicalMonitor, &mut min, &mut current, &mut max) != 0
            && max > min
        {
            return Some((BrightnessMethod::Monitor, min, current, max));
        }
        // Some displays expose luminance VCP 0x10 without advertising the
        // high-level Windows brightness capability. Use the same DDC/CI channel.
        if GetVCPFeatureAndVCPFeatureReply(
            physical.hPhysicalMonitor,
            0x10,
            None,
            &mut current,
            Some(&mut max),
        ) != 0
            && max > 0
        {
            return Some((BrightnessMethod::Vcp, 0, current, max));
        }
    }
    None
}
fn percentage(min: u32, current: u32, max: u32) -> Option<u32> {
    (max > min).then(|| {
        ((current.saturating_sub(min).min(max - min) as f64) / (max - min) as f64 * 100.).round()
            as u32
    })
}
fn physical_level(percent: f64, min: u32, max: u32) -> Result<u32, String> {
    if !percent.is_finite() || !(0.0..=100.0).contains(&percent) || max <= min {
        return Err("Invalid monitor brightness".into());
    }
    Ok(min + ((max - min) as f64 * percent / 100.).round() as u32)
}
fn monitor_names() -> BTreeMap<String, String> {
    let mut names = BTreeMap::new();
    unsafe {
        // EDID names distinguish two displays even when both physical monitor
        // descriptions are the generic Windows "PnP Monitor" label.
        for _ in 0..3 {
            let (mut paths_count, mut modes_count) = (0, 0);
            if GetDisplayConfigBufferSizes(
                QDC_ONLY_ACTIVE_PATHS,
                &mut paths_count,
                &mut modes_count,
            )
            .0 != 0
                || paths_count > 64
                || modes_count > 256
            {
                break;
            }
            let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); paths_count as usize];
            let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); modes_count as usize];
            let result = QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut paths_count,
                paths.as_mut_ptr(),
                &mut modes_count,
                modes.as_mut_ptr(),
                None,
            );
            if result.0 == 122 {
                continue;
            } // Display topology changed between the two calls.
            if result.0 != 0 {
                break;
            }
            for path in paths.into_iter().take(paths_count as usize) {
                let mut source = DISPLAYCONFIG_SOURCE_DEVICE_NAME::default();
                source.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
                    r#type: DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
                    size: std::mem::size_of_val(&source) as u32,
                    adapterId: path.sourceInfo.adapterId,
                    id: path.sourceInfo.id,
                };
                let mut target = DISPLAYCONFIG_TARGET_DEVICE_NAME::default();
                target.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
                    r#type: DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
                    size: std::mem::size_of_val(&target) as u32,
                    adapterId: path.targetInfo.adapterId,
                    id: path.targetInfo.id,
                };
                if DisplayConfigGetDeviceInfo(&mut source.header) != 0
                    || DisplayConfigGetDeviceInfo(&mut target.header) != 0
                {
                    continue;
                }
                let text = |value: &[u16]| {
                    String::from_utf16_lossy(
                        &value[..value.iter().position(|c| *c == 0).unwrap_or(value.len())],
                    )
                };
                let name = text(&target.monitorFriendlyDeviceName);
                if !name.is_empty() {
                    names.entry(text(&source.viewGdiDeviceName)).or_insert(name);
                }
            }
            break;
        }
    }
    names
}
unsafe extern "system" fn collect_monitor(
    monitor: HMONITOR,
    _: HDC,
    _: *mut RECT,
    data: LPARAM,
) -> BOOL {
    let monitors = &mut *(data.0 as *mut Vec<Monitor>);
    if monitors.len() >= 16 {
        return BOOL(0);
    }
    let mut count = 0;
    if GetNumberOfPhysicalMonitorsFromHMONITOR(monitor, &mut count).is_err()
        || count == 0
        || count > 32
    {
        return BOOL(1);
    }
    let mut physical = vec![PHYSICAL_MONITOR::default(); count as usize];
    if GetPhysicalMonitorsFromHMONITOR(monitor, &mut physical).is_err() {
        return BOOL(1);
    }
    let mut info = MONITORINFOEXW::default();
    info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    let _ = GetMonitorInfoW(monitor, (&mut info as *mut MONITORINFOEXW).cast());
    let device = String::from_utf16_lossy(
        &info.szDevice[..info
            .szDevice
            .iter()
            .position(|c| *c == 0)
            .unwrap_or(info.szDevice.len())],
    );
    for (index, physical) in physical.into_iter().enumerate() {
        let (method, min, current, max) =
            read_brightness(physical).unwrap_or((BrightnessMethod::Unavailable, 0, 0, 0));
        let text = physical.szPhysicalMonitorDescription;
        let name = String::from_utf16_lossy(
            &text[..text.iter().position(|c| *c == 0).unwrap_or(text.len())],
        );
        monitors.push(Monitor {
            id: format!("{device}:{index}"),
            name: if name.is_empty() {
                device.clone()
            } else {
                name
            },
            physical,
            min,
            max,
            level: percentage(min, current, max).unwrap_or(0),
            method,
        });
    }
    BOOL(1)
}
fn enumerate() -> Vec<Monitor> {
    let mut monitors = Vec::<Monitor>::new();
    unsafe {
        let _ = EnumDisplayMonitors(
            None,
            None,
            Some(collect_monitor),
            LPARAM(&mut monitors as *mut _ as isize),
        );
    }
    let names = monitor_names();
    for monitor in &mut monitors {
        if let Some((device, "0")) = monitor.id.rsplit_once(':') {
            if let Some(name) = names.get(device) {
                monitor.name = name.clone();
            }
        }
    }
    monitors
}
type Reply = mpsc::Sender<Result<Vec<Value>, String>>;
enum Request {
    List(Reply),
    Set(String, f64, Instant, Reply),
}
static WORKER: OnceLock<Result<mpsc::SyncSender<Request>, String>> = OnceLock::new();
fn worker() -> Result<&'static mpsc::SyncSender<Request>, String> {
    WORKER.get_or_init(||{
        let (sender,receiver)=mpsc::sync_channel::<Request>(16);
        std::thread::Builder::new().name("woods-brightness".into()).spawn(move||{
            let mut monitors=Vec::<Monitor>::new();let mut checked=Instant::now()-Duration::from_secs(60);
            loop {
                let request=match receiver.recv_timeout(Duration::from_secs(15)) {Ok(r)=>r,Err(mpsc::RecvTimeoutError::Timeout)=>{monitors.clear();continue;},Err(_)=>break};
                if let Request::Set(_,_,deadline,ref reply)=request {if Instant::now()>=deadline{let _=reply.send(Err("Monitor controls expired before the monitor responded".into()));continue;}}
                let fresh=monitors.is_empty() || checked.elapsed()>=Duration::from_secs(10);
                if fresh {monitors=enumerate();checked=Instant::now();}
                match request {
                    Request::List(reply)=>{
                        if !fresh {for monitor in &mut monitors {if !monitor.refresh(){monitor.method=BrightnessMethod::Unavailable;}}}
                        let _=reply.send(Ok(monitors.iter().map(Monitor::value).collect()));
                    }
                    Request::Set(id,percent,deadline,reply)=>{
                        if Instant::now()>=deadline{let _=reply.send(Err("Monitor controls expired before the monitor responded".into()));continue;}
                        let selected=monitors.iter_mut().filter(|m|m.id==id || id=="all"&&!matches!(m.method,BrightnessMethod::Unavailable)).collect::<Vec<_>>();
                        let mut changed=0;let mut failed=0;
                        for monitor in selected {
                            match monitor.write(percent) {
                                Ok(())=>{changed+=1;},
                                _=>failed+=1,
                            }
                        }
                        let result=if changed==0 {Err("No supported monitor accepted this brightness".into())}
                            else if failed>0 {Err("Some monitors did not accept this brightness; refresh the controls".into())}
                            else {Ok(monitors.iter().map(Monitor::value).collect())};
                        let _=reply.send(result);
                    }
                }
            }
        }).map_err(|_|"Could not start monitor controls".to_owned())?;
        Ok(sender)
    }).as_ref().map_err(Clone::clone)
}
fn request(make: impl FnOnce(Reply) -> Request) -> Result<Vec<Value>, String> {
    let (sender, receiver) = mpsc::channel();
    worker()?
        .try_send(make(sender))
        .map_err(|_| "Monitor controls are busy")?;
    receiver
        .recv_timeout(Duration::from_secs(4))
        .map_err(|_| "The monitor did not respond in time")?
}
pub fn list() -> Result<Vec<Value>, String> {
    request(Request::List)
}
pub fn set(id: &str, level: f64) -> Result<Vec<Value>, String> {
    physical_level(level, 0, 100)?;
    if id.is_empty() || id.len() > 256 {
        return Err("Invalid monitor".into());
    }
    request(|reply| {
        Request::Set(
            id.to_owned(),
            level,
            Instant::now() + Duration::from_secs(4),
            reply,
        )
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn physical_ranges_are_normalized_without_overflow_or_fabricated_capabilities() {
        assert_eq!(percentage(20, 70, 120), Some(50));
        assert_eq!(physical_level(50., 20, 120).unwrap(), 70);
        assert_eq!(percentage(10, 0, 110), Some(0));
        assert_eq!(percentage(0, 500, 100), Some(100));
        assert_eq!(percentage(10, 10, 10), None);
        for value in [-1., 101., f64::NAN] {
            assert!(physical_level(value, 0, 100).is_err());
        }
    }
}
