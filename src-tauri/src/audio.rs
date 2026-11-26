//! Windows Core Audio controls and a measured WASAPI loopback spectrum.
pub mod process_loopback;
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use serde_json::{json, Value};
use std::{collections::VecDeque, sync::{Arc,atomic::{AtomicBool,Ordering}}, time::{Duration, Instant}};
use tauri::Emitter;
use windows::{core::{GUID, Interface, PCWSTR, PWSTR}, Win32::{
    Devices::FunctionDiscovery::PKEY_Device_FriendlyName,
    Foundation::RPC_E_CHANGED_MODE,
    Media::Audio::{*, Endpoints::IAudioEndpointVolume},
    System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ},
}};

const FFT_SIZE: usize = 2048;
const BAND_COUNT: usize = 24;
const BAND_EDGES: [f32; BAND_COUNT + 1] = [
    35., 48., 64., 85., 112., 148., 195., 256.,
    336., 440., 575., 750., 980., 1280., 1670., 2180.,
    2850., 3720., 4850., 6300., 8200., 10600., 13500., 16500., 19500.,
];
static SELECTED_OUTPUT: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);
static SELECTED_INPUT: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);
static SPECTRUM_PLAYING: AtomicBool = AtomicBool::new(false);
static SPECTRUM_VISIBLE: AtomicBool = AtomicBool::new(true);
static SPECTRUM_RENDERED: AtomicBool = AtomicBool::new(true);

/// Media metadata keeps running while the HUD is idle. WASAPI visualization
/// has no consumer until playback starts; recording uses its own capture path.
pub fn set_spectrum_playing(playing: bool) { SPECTRUM_PLAYING.store(playing, Ordering::Relaxed); }
pub fn set_spectrum_visible(visible: bool) { SPECTRUM_VISIBLE.store(visible, Ordering::Relaxed); }
pub fn set_spectrum_rendered(rendered: bool) { SPECTRUM_RENDERED.store(rendered, Ordering::Relaxed); }
fn spectrum_active() -> bool { SPECTRUM_PLAYING.load(Ordering::Relaxed) && SPECTRUM_VISIBLE.load(Ordering::Relaxed) && SPECTRUM_RENDERED.load(Ordering::Relaxed) }

pub fn configure(settings: &Value) {
    *SELECTED_OUTPUT.lock().unwrap() = settings["audioOutput"].as_str().filter(|s|!s.is_empty()).map(str::to_owned);
    *SELECTED_INPUT.lock().unwrap() = settings["audioInput"].as_str().filter(|s|!s.is_empty()).map(str::to_owned);
}

unsafe fn selected_device(flow: EDataFlow) -> windows::core::Result<IMMDevice> {
    let id = if flow == eCapture { SELECTED_INPUT.lock().unwrap().clone() } else { SELECTED_OUTPUT.lock().unwrap().clone() };
    let enumr = enumerator()?;
    if let Some(id) = id {
        let wide: Vec<u16> = id.encode_utf16().chain(Some(0)).collect();
        if let Ok(device) = enumr.GetDevice(PCWSTR(wide.as_ptr())) {if device.GetState()? == DEVICE_STATE_ACTIVE {return Ok(device);}}
    }
    enumr.GetDefaultAudioEndpoint(flow, eConsole)
}

unsafe fn microphones() -> windows::core::Result<Vec<IAudioEndpointVolume>> {
    let selected=SELECTED_INPUT.lock().unwrap().is_some();
    if selected {return Ok(vec![endpoint(eCapture)?]);}
    let list=enumerator()?.EnumAudioEndpoints(eCapture,DEVICE_STATE_ACTIVE)?;
    (0..list.GetCount()?).map(|i|list.Item(i)?.Activate(CLSCTX_ALL,None)).collect()
}

/// Every thread using COM owns its own balanced initialization. An existing STA
/// is usable too; RPC_E_CHANGED_MODE must not be paired with CoUninitialize.
pub struct ComApartment(bool);
/// WinRT caches agile activation factories process-wide. Keep the MTA alive
/// across short-lived workers so their final CoUninitialize cannot invalidate
/// those factories before a later IPC command reuses them.
pub struct MtaLifetime(windows::Win32::System::Com::CO_MTA_USAGE_COOKIE);
impl MtaLifetime {
    pub fn new() -> Result<Self, String> {
        unsafe { windows::Win32::System::Com::CoIncrementMTAUsage() }
            .map(Self).map_err(|e| e.to_string())
    }
}
impl Drop for MtaLifetime {
    fn drop(&mut self) {
        let _ = unsafe { windows::Win32::System::Com::CoDecrementMTAUsage(self.0) };
    }
}
pub struct WinRtApartment;
impl WinRtApartment {
    pub fn new() -> Result<Self, String> {
        unsafe { windows::Win32::System::WinRT::RoInitialize(windows::Win32::System::WinRT::RO_INIT_MULTITHREADED) }
            .map(|_| Self).map_err(|e| e.to_string())
    }
}
impl Drop for WinRtApartment {
    fn drop(&mut self) { unsafe { windows::Win32::System::WinRT::RoUninitialize() }; }
}
impl ComApartment {
    pub fn new() -> Result<Self, String> {
        let status = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if status == RPC_E_CHANGED_MODE { return Ok(Self(false)); }
        status.ok().map_err(|e| e.to_string())?;
        Ok(Self(true))
    }
}
impl Drop for ComApartment {
    fn drop(&mut self) { if self.0 { unsafe { CoUninitialize() }; } }
}

unsafe fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
}
unsafe fn owned_string(value: PWSTR) -> String {
    let result = value.to_string().unwrap_or_default();
    CoTaskMemFree(Some(value.0.cast()));
    result
}
unsafe fn device_id(device: &IMMDevice) -> windows::core::Result<String> {
    Ok(owned_string(device.GetId()?))
}
unsafe fn device_name(device: &IMMDevice) -> windows::core::Result<String> {
    Ok(device.OpenPropertyStore(STGM_READ)?.GetValue(&PKEY_Device_FriendlyName)?.to_string())
}
unsafe fn endpoint(flow: EDataFlow) -> windows::core::Result<IAudioEndpointVolume> {
    selected_device(flow)?.Activate(CLSCTX_ALL, None)
}

pub fn devices(input: bool) -> Result<Vec<Value>, String> {
    let _com = ComApartment::new()?;
    unsafe {
        let flow = if input { eCapture } else { eRender };
        let enumr = enumerator().map_err(|e| e.to_string())?;
        let default = enumr.GetDefaultAudioEndpoint(flow, eConsole).ok().and_then(|d| device_id(&d).ok());
        let list = enumr.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE).map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for index in 0..list.GetCount().map_err(|e| e.to_string())? {
            let device = list.Item(index).map_err(|e| e.to_string())?;
            let id = device_id(&device).map_err(|e| e.to_string())?;
            let name = device_name(&device).unwrap_or_else(|_| id.clone());
            let selected=if input{SELECTED_INPUT.lock().unwrap().clone()}else{SELECTED_OUTPUT.lock().unwrap().clone()};
            result.push(json!({"id":id,"name":name,"default":default.as_ref()==Some(&id),"chosen":selected.as_ref()==Some(&id)}));
        }
        Ok(result)
    }
}

pub fn state() -> Result<Value, String> {
    let _com = ComApartment::new()?;
    unsafe {
        let device = selected_device(eRender).map_err(|e|e.to_string())?;
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
        let mic_muted = microphones().ok().filter(|m|!m.is_empty()).and_then(|m|m.iter().map(|v|v.GetMute().map(|b|b.as_bool())).collect::<windows::core::Result<Vec<_>>>().ok()).map(|m|m.iter().all(|b|*b));
        let chosen=SELECTED_OUTPUT.lock().unwrap().as_ref()==device_id(&device).ok().as_ref();
        Ok(json!({
            "level":volume.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())?,
            "muted":volume.GetMute().map_err(|e| e.to_string())?.as_bool(),
            "device":device_name(&device).map_err(|e| e.to_string())?,
            "deviceId":device_id(&device).map_err(|e| e.to_string())?,
            "chosen":chosen,"micMuted":mic_muted
        }))
    }
}

pub fn set_volume(level: f64) -> Result<(), String> {
    if !level.is_finite() { return Err("Некорректный уровень громкости".into()); }
    let _com = ComApartment::new()?;
    unsafe {
        let volume=endpoint(eRender).map_err(|e|e.to_string())?;
        volume.SetMasterVolumeLevelScalar(level.clamp(0.,1.) as f32,std::ptr::null()).map_err(|e|e.to_string())?;
        if level>0.{volume.SetMute(false,std::ptr::null()).map_err(|e|e.to_string())?;}
        Ok(())
    }
}
pub fn step_volume(delta: f64) -> Result<(), String> {
    let level = state()?.get("level").and_then(Value::as_f64).ok_or("Нет устройства вывода")?;
    set_volume(level + delta)
}
pub fn toggle_mute(input: bool) -> Result<(), String> {
    let _com = ComApartment::new()?;
    unsafe {
        if input {
            let microphones=microphones().map_err(|e|e.to_string())?;
            if microphones.is_empty() {return Err("Нет подключённых микрофонов".into());}
            let mute=!microphones.iter().map(|v|v.GetMute().map(|b|b.as_bool())).collect::<windows::core::Result<Vec<_>>>().map_err(|e|e.to_string())?.iter().all(|m|*m);
            for volume in microphones {volume.SetMute(mute,std::ptr::null()).map_err(|e|e.to_string())?;}
            return Ok(());
        }
        let volume = endpoint(if input { eCapture } else { eRender }).map_err(|e| e.to_string())?;
        volume.SetMute(!volume.GetMute().map_err(|e| e.to_string())?.as_bool(), std::ptr::null()).map_err(|e| e.to_string())
    }
}

// Windows' IPolicyConfig is used by audio switchers because MMDevice's public
// API does not expose SetDefaultEndpoint. The stable IID/vtable dates to Win7.
#[repr(transparent)]
#[derive(Clone, Debug)]
pub struct IPolicyConfig(windows::core::IUnknown);
unsafe impl Interface for IPolicyConfig {
    type Vtable = IPolicyConfigVtbl;
    const IID: GUID = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
}
#[repr(C)]
pub struct IPolicyConfigVtbl {
    base: windows::core::IUnknown_Vtbl,
    preceding_methods: [usize; 10],
    set_default_endpoint: unsafe extern "system" fn(*mut std::ffi::c_void, PCWSTR, ERole) -> windows::core::HRESULT,
}
pub fn set_default(id: &str) -> Result<(), String> {
    let _com = ComApartment::new()?;
    let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        // Validate before passing an identifier into the undocumented COM API.
        enumerator().and_then(|e| e.GetDevice(PCWSTR(wide.as_ptr()))).map_err(|e| e.to_string())?;
        let config: IPolicyConfig = CoCreateInstance(&GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9), None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        for role in [eConsole, eMultimedia, eCommunications] {
            (config.vtable().set_default_endpoint)(config.as_raw(), PCWSTR(wide.as_ptr()), role).ok().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

unsafe fn player_audio_session(active_only: bool) -> Result<(IMMDevice, IAudioSessionControl), String> {
    let app = crate::media::cached_media()
        .or_else(crate::media::get_current_media)
        .and_then(|m|m["app"].as_str().map(str::to_owned))
        .ok_or("Нет активного плеера")?
        .to_lowercase();
    let aliases = ["yandex","spotify","chrome","msedge","firefox","opera","telegram","ayugram","vlc","aimp","foobar"];
    let alias = aliases.iter().find(|alias|app.contains(**alias)).copied();
    let all = enumerator().map_err(|e|e.to_string())?.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE).map_err(|e|e.to_string())?;
    for index in 0..all.GetCount().map_err(|e|e.to_string())? {
        let device = all.Item(index).map_err(|e|e.to_string())?;
        let Ok(sessions): Result<IAudioSessionManager2,_> = device.Activate(CLSCTX_ALL,None) else {continue;};
        let Ok(list) = sessions.GetSessionEnumerator() else {continue;};
        for item in 0..list.GetCount().map_err(|e|e.to_string())? {
            let control = list.GetSession(item).map_err(|e|e.to_string())?;
            if active_only && control.GetState().map_err(|e|e.to_string())? != AudioSessionStateActive {continue;}
            let extended: IAudioSessionControl2 = control.cast().map_err(|e|e.to_string())?;
            let identifier = owned_string(extended.GetSessionIdentifier().map_err(|e|e.to_string())?).to_lowercase();
            let matching=alias.map(|a|identifier.contains(a)).unwrap_or_else(||identifier.contains(&app));
            // Yandex Browser and Yandex Music share a vendor name. A music
            // player's slider must not silently change the browser's volume.
            let matching=matching && !(app.contains("yandex")&&app.contains("music")&&!identifier.contains("music"));
            if matching {
                return Ok((device, control));
            }
        }
    }
    Err("Аудиосессия выбранного плеера не найдена".into())
}
unsafe fn active_player_volume() -> Result<ISimpleAudioVolume, String> {
    player_audio_session(false)?.1.cast().map_err(|e|e.to_string())
}

/// A player can be routed by Windows to an endpoint other than the system
/// default. Follow its active session for visualization, while an explicit
/// audioOutput selection keeps priority. This never changes Windows routing.
unsafe fn loopback_device() -> windows::core::Result<IMMDevice> {
    if SELECTED_OUTPUT.lock().unwrap().is_none() {
        if let Ok((device, _)) = player_audio_session(true) {return Ok(device);}
    }
    selected_device(eRender)
}
pub fn player_volume() -> Result<Value, String> {
    let _com = ComApartment::new()?;
    unsafe {
        let volume=active_player_volume()?;
        Ok(json!({"level":volume.GetMasterVolume().map_err(|e|e.to_string())?,"muted":volume.GetMute().map_err(|e|e.to_string())?.as_bool()}))
    }
}
pub fn set_player_volume(level: Option<f64>, mute: Option<bool>) -> Result<(), String> {
    let _com = ComApartment::new()?;
    unsafe {
        let volume = active_player_volume()?;
        if let Some(level) = level {
            if !level.is_finite() { return Err("Некорректный уровень громкости".into()); }
            volume.SetMasterVolume(level.clamp(0.,1.) as f32,std::ptr::null()).map_err(|e|e.to_string())?;
            if level>0. && mute.is_none(){volume.SetMute(false,std::ptr::null()).map_err(|e|e.to_string())?;}
        }
        if let Some(mute) = mute { volume.SetMute(mute,std::ptr::null()).map_err(|e|e.to_string())?; }
    }
    Ok(())
}

struct Spectrum {
    fft: Arc<dyn Fft<f32>>,
    hann: Vec<f32>,
    samples: VecDeque<f32>,
    scratch: Vec<Complex<f32>>,
    bands: [f32; BAND_COUNT],
    peak_rms: f32,
    peak_db: f32,
}
impl Spectrum {
    fn new() -> Self {
        let hann = (0..FFT_SIZE)
            .map(|i| 0.5 - 0.5 * (2. * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32).cos())
            .collect();
        Self {
            fft: FftPlanner::<f32>::new().plan_fft_forward(FFT_SIZE),
            hann,
            samples: VecDeque::with_capacity(FFT_SIZE),
            scratch: vec![Complex::default(); FFT_SIZE],
            bands: [0.; BAND_COUNT],
            peak_rms: 0.02,
            peak_db: -42.,
        }
    }
    fn push(&mut self, value: f32) {
        if self.samples.len() == FFT_SIZE { self.samples.pop_front(); }
        self.samples.push_back(if value.is_finite() { value.clamp(-1., 1.) } else { 0. });
    }
    fn measure(&mut self, rate: u32) -> ([f32; BAND_COUNT], f32) {
        let count = self.samples.len();
        let rms = if count > 0 { (self.samples.iter().map(|s| s * s).sum::<f32>() / count as f32).sqrt() } else { 0. };
        // Exact silence needs only the same release envelope, not a 2048-bin FFT.
        if rms <= 1e-6 {
            for band in &mut self.bands { *band *= 0.65; if *band < 0.001 { *band = 0.; } }
            self.peak_rms = (self.peak_rms * 0.985).max(0.02);
            self.peak_db = (self.peak_db - 0.22).max(-42.);
            return (self.bands, 0.);
        }
        for (i, bin) in self.scratch.iter_mut().enumerate() {
            let sample = self.samples.get(i).copied().unwrap_or(0.);
            *bin = Complex::new(sample * self.hann[i], 0.);
        }
        self.fft.process(&mut self.scratch);
        let half = FFT_SIZE / 2;
        let bin_hz = rate.max(1) as f32 / FFT_SIZE as f32;
        let mut band_db = [-100f32; BAND_COUNT];
        let mut frame_peak_db = -100f32;
        for band in 0..BAND_COUNT {
            let start = ((BAND_EDGES[band] / bin_hz).floor() as usize).clamp(1, half - 1);
            let end = ((BAND_EDGES[band + 1] / bin_hz).ceil() as usize).clamp(start + 1, half);
            let mut max_mag = 0f32;
            let mut sum_sq = 0f32;
            for c in &self.scratch[start..end] {
                let m = c.norm() * 4. / FFT_SIZE as f32;
                if m > max_mag { max_mag = m; }
                sum_sq += m * m;
            }
            let rms_mag = (sum_sq / (end - start) as f32).sqrt();
            let magnitude = max_mag * 0.7 + rms_mag * 0.3;
            // Gentle perceptual tilt (+8.5 dB from bass to air) counters natural pink-noise rolloff.
            let tilt_db = (band as f32 / (BAND_COUNT - 1) as f32) * 8.5;
            let db = if magnitude > 1e-5 { 20. * magnitude.log10() + tilt_db } else { -100. };
            band_db[band] = db;
            if db > frame_peak_db { frame_peak_db = db; }
        }
        if frame_peak_db > self.peak_db {
            self.peak_db += (frame_peak_db - self.peak_db) * 0.45;
        } else {
            self.peak_db = (self.peak_db - 0.20).max(-42.).max(frame_peak_db);
        }
        let ref_db = self.peak_db.max(-42.);
        let floor_db = ref_db - 34.;
        for band in 0..BAND_COUNT {
            let raw = ((band_db[band] - floor_db) / 34.).clamp(0., 1.);
            let target = raw.powf(1.3);
            let coefficient = if target > self.bands[band] { 0.82 } else { 0.42 };
            self.bands[band] += (target - self.bands[band]) * coefficient;
            if self.bands[band] < 0.001 { self.bands[band] = 0.; }
        }
        if rms > self.peak_rms {
            self.peak_rms += (rms - self.peak_rms) * 0.38;
        } else {
            self.peak_rms = (self.peak_rms * 0.985).max(0.02);
        }
        let level = (rms / self.peak_rms.max(0.02)).clamp(0., 1.);
        (self.bands, level)
    }
}

#[derive(Clone,Copy)]
struct SampleFormat { channels:usize, bytes:usize, float:bool, block:usize, rate:u32 }
unsafe fn read_format(format:*const WAVEFORMATEX)->Result<SampleFormat,String> {
    let fmt=std::ptr::read_unaligned(format);
    let tag=fmt.wFormatTag;
    let float=if tag==0xfffe && fmt.cbSize>=22 {
        let sub_format=std::ptr::read_unaligned(format.cast::<WAVEFORMATEXTENSIBLE>()).SubFormat;
        if sub_format!=GUID::from_u128(0x00000001_0000_0010_8000_00aa00389b71) && sub_format!=GUID::from_u128(0x00000003_0000_0010_8000_00aa00389b71){return Err("WASAPI endpoint не использует PCM/Float формат".into());}
        sub_format==GUID::from_u128(0x00000003_0000_0010_8000_00aa00389b71)
    }else{
        if ![1,3].contains(&tag){return Err("WASAPI endpoint не использует PCM/Float формат".into());}
        tag==3
    };
    let bytes=usize::from(fmt.wBitsPerSample)/8;
    if fmt.nChannels==0 || fmt.nSamplesPerSec==0 || (!float && ![2,3,4].contains(&bytes)) || (float && ![4,8].contains(&bytes)) {
        return Err("Неподдерживаемый формат WASAPI".into());
    }
    if usize::from(fmt.nBlockAlign)<bytes*usize::from(fmt.nChannels) {return Err("Некорректный blockAlign WASAPI".into());}
    Ok(SampleFormat{channels:fmt.nChannels as usize,bytes,float,block:fmt.nBlockAlign as usize,rate:fmt.nSamplesPerSec})
}
fn decode_sample(data:&[u8],float:bool)->f32 {
    match (float,data.len()) {
        (true,4)=>f32::from_le_bytes(data.try_into().unwrap()),
        (true,8)=>f64::from_le_bytes(data.try_into().unwrap()) as f32,
        (false,2)=>i16::from_le_bytes(data.try_into().unwrap()) as f32/32768.,
        (false,3)=>((i32::from(data[0])|(i32::from(data[1])<<8)|(i32::from(data[2])<<16))<<8) as f32/2147483648.,
        (false,4)=>i32::from_le_bytes(data.try_into().unwrap()) as f32/2147483648.,
        _=>0.
    }
}
unsafe fn active_player_pid() -> Option<u32> {
    if let Some(pid) = crate::media::cached_media()
        .and_then(|m| m["pid"].as_u64())
        .and_then(|p| u32::try_from(p).ok())
        .filter(|p| *p != 0)
    {
        return Some(pid);
    }
    if let Ok((_, control)) = player_audio_session(true) {
        if let Ok(extended) = control.cast::<IAudioSessionControl2>() {
            if let Ok(pid) = extended.GetProcessId() {
                if pid != 0 {
                    return Some(pid);
                }
            }
        }
    }
    None
}

struct HandleGuard(windows::Win32::Foundation::HANDLE);
impl Drop for HandleGuard {
    fn drop(&mut self) {
        if !self.0.is_invalid() {
            unsafe { let _ = windows::Win32::Foundation::CloseHandle(self.0); }
        }
    }
}

unsafe fn open_process_loopback(pid: u32) -> Result<(IAudioClient, SampleFormat, HandleGuard), String> {
    let client = process_loopback::activate(pid)?;
    let fmt = WAVEFORMATEX {
        wFormatTag: 3,
        nChannels: 2,
        nSamplesPerSec: 48_000,
        nAvgBytesPerSec: 384_000,
        nBlockAlign: 8,
        wBitsPerSample: 32,
        cbSize: 0,
    };
    client
        .Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            0,
            0,
            &fmt,
            None,
        )
        .map_err(|e| e.to_string())?;
    let event = windows::Win32::System::Threading::CreateEventW(None, false, false, None)
        .map_err(|e| e.to_string())?;
    let guard = HandleGuard(event);
    client.SetEventHandle(event).map_err(|e| e.to_string())?;
    Ok((
        client,
        SampleFormat { channels: 2, bytes: 4, float: true, block: 8, rate: 48_000 },
        guard,
    ))
}

unsafe fn capture_session(app:&tauri::AppHandle, failed_pid: &mut Option<u32>)->Result<(),String> {
    let explicit_output = SELECTED_OUTPUT.lock().unwrap().is_some();
    let target_pid = if explicit_output { None } else { active_player_pid().filter(|pid| Some(*pid) != *failed_pid) };
    let (client, parsed, initial_id, active_pid, _event_guard) = if let Some(pid) = target_pid {
        match open_process_loopback(pid) {
            Ok((client, parsed, guard)) => {
                *failed_pid = None;
                (client, parsed, None, Some(pid), Some(guard))
            }
            Err(_) => {
                *failed_pid = Some(pid);
                let device = loopback_device().map_err(|e| e.to_string())?;
                let id = device_id(&device).map_err(|e| e.to_string())?;
                let client: IAudioClient = device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
                let format = client.GetMixFormat().map_err(|e| e.to_string())?;
                let parsed = read_format(format);
                let initialized = client.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 1_000_000, 0, format, None);
                CoTaskMemFree(Some(format.cast()));
                let parsed = parsed?;
                initialized.map_err(|e| e.to_string())?;
                (client, parsed, Some(id), None, None)
            }
        }
    } else {
        let device = loopback_device().map_err(|e| e.to_string())?;
        let id = device_id(&device).map_err(|e| e.to_string())?;
        let client: IAudioClient = device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
        let format = client.GetMixFormat().map_err(|e| e.to_string())?;
        let parsed = read_format(format);
        let initialized = client.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 1_000_000, 0, format, None);
        CoTaskMemFree(Some(format.cast()));
        let parsed = parsed?;
        initialized.map_err(|e| e.to_string())?;
        (client, parsed, Some(id), None, None)
    };
    let capture:IAudioCaptureClient=client.GetService().map_err(|e|e.to_string())?;
    client.Start().map_err(|e|e.to_string())?;
    let mut spectrum=Spectrum::new();
    let mut emitted=Instant::now();
    let mut checked=Instant::now();
    let mut received=Instant::now();
    let mut last_sample: Option<([f32; BAND_COUNT], f32)> = None;
    let mut quiet = false;
    let outcome=(||->Result<(),String>{
        loop {
            if !spectrum_active() { break; }
            std::thread::sleep(Duration::from_millis(if quiet {32} else {8}));
            while capture.GetNextPacketSize().map_err(|e|e.to_string())?>0 {
                let mut data=std::ptr::null_mut();let mut frames=0;let mut flags=0;
                capture.GetBuffer(&mut data,&mut frames,&mut flags,None,None).map_err(|e|e.to_string())?;
                if frames>0 {
                    if flags&AUDCLNT_BUFFERFLAGS_SILENT.0 as u32!=0 || data.is_null() {
                        for _ in 0..frames {spectrum.push(0.);}
                    }else{
                        let samples=std::slice::from_raw_parts(data,frames as usize*parsed.block);
                        for frame in samples.chunks_exact(parsed.block) {
                            let mono=(0..parsed.channels).map(|ch|decode_sample(&frame[ch*parsed.bytes..(ch+1)*parsed.bytes],parsed.float)).sum::<f32>()/parsed.channels as f32;
                            spectrum.push(mono);
                        }
                    }
                    received=Instant::now();
                }
                capture.ReleaseBuffer(frames).map_err(|e|e.to_string())?;
            }
            if emitted.elapsed()>=Duration::from_millis(33) {
                let sample=if received.elapsed()>Duration::from_millis(120) {
                    for _ in 0..FFT_SIZE{spectrum.push(0.);}
                    ([0.; BAND_COUNT],0.)
                } else { spectrum.measure(parsed.rate) };
                quiet=sample.1 < 0.00001;
                // The UI uses bandsAt to distinguish live audio from a stopped capture.
                // Keep steady nonzero signals fresh; only deduplicate complete silence.
                if sample != ([0.; BAND_COUNT],0.) || last_sample != Some(sample) {
                    let _=app.emit("media:bands",sample.0);let _=app.emit("media:level",sample.1);
                    last_sample=Some(sample);
                }
                emitted=Instant::now();
            }
            if checked.elapsed()>=Duration::from_secs(2) {
                let explicit = SELECTED_OUTPUT.lock().unwrap().is_some();
                if let Some(pid) = active_pid {
                    if explicit || active_player_pid() != Some(pid) { break; }
                } else if let Some(ref id) = initial_id {
                    if !explicit && active_player_pid().is_some_and(|pid| Some(pid) != *failed_pid) { break; }
                    let current=loopback_device().map_err(|e|e.to_string())?;
                    if device_id(&current).map_err(|e|e.to_string())?!=*id {break;}
                }
                checked=Instant::now();
            }
        }
        Ok(())
    })();
    let _=client.Stop();
    outcome
}

unsafe fn state_with_enumerator(
    enumr: &IMMDeviceEnumerator,
    name_cache: &mut std::collections::HashMap<String, String>,
) -> Result<Value, String> {
    let selected_out = SELECTED_OUTPUT.lock().unwrap().clone();
    let device = if let Some(ref id) = selected_out {
        let wide: Vec<u16> = id.encode_utf16().chain(Some(0)).collect();
        match enumr.GetDevice(PCWSTR(wide.as_ptr())) {
            Ok(dev) if dev.GetState().ok() == Some(DEVICE_STATE_ACTIVE) => dev,
            _ => enumr.GetDefaultAudioEndpoint(eRender, eConsole).map_err(|e| e.to_string())?,
        }
    } else {
        enumr.GetDefaultAudioEndpoint(eRender, eConsole).map_err(|e| e.to_string())?
    };
    let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
    let id = device_id(&device).map_err(|e| e.to_string())?;
    let name = if let Some(cached) = name_cache.get(&id) {
        cached.clone()
    } else {
        let resolved = device_name(&device).map_err(|e| e.to_string())?;
        if name_cache.len() >= 32 { name_cache.clear(); }
        name_cache.insert(id.clone(), resolved.clone());
        resolved
    };
    let selected_in = SELECTED_INPUT.lock().unwrap().clone();
    let mic_muted = if let Some(ref in_id) = selected_in {
        let wide: Vec<u16> = in_id.encode_utf16().chain(Some(0)).collect();
        let dev = enumr.GetDevice(PCWSTR(wide.as_ptr())).ok()
            .filter(|d| d.GetState().ok() == Some(DEVICE_STATE_ACTIVE))
            .or_else(|| enumr.GetDefaultAudioEndpoint(eCapture, eConsole).ok());
        dev.and_then(|d| d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).ok())
            .and_then(|v| v.GetMute().ok().map(|b| b.as_bool()))
    } else {
        enumr.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE).ok().and_then(|list| {
            let count = list.GetCount().ok()?;
            if count == 0 { return None; }
            let mut all_muted = true;
            for i in 0..count {
                let v: IAudioEndpointVolume = list.Item(i).ok()?.Activate(CLSCTX_ALL, None).ok()?;
                if !v.GetMute().ok()?.as_bool() {
                    all_muted = false;
                    break;
                }
            }
            Some(all_muted)
        })
    };
    let chosen = selected_out.as_ref() == Some(&id);
    Ok(json!({
        "level": volume.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())?,
        "muted": volume.GetMute().map_err(|e| e.to_string())?.as_bool(),
        "device": name,
        "deviceId": id,
        "chosen": chosen,
        "micMuted": mic_muted
    }))
}

pub fn start_loopback(app:tauri::AppHandle) {
    let controls_app=app.clone();
    let _ = std::thread::Builder::new().name("woods-audio-state".into()).spawn(move||{
        let Ok(_com) = ComApartment::new() else { return; };
        let mut cached_enumr: Option<IMMDeviceEnumerator> = None;
        let mut name_cache = std::collections::HashMap::<String, String>::new();
        let mut previous=Value::Null;
        loop {
            if cached_enumr.is_none() {
                cached_enumr = unsafe { enumerator().ok() };
            }
            if let Some(ref enumr) = cached_enumr {
                match unsafe { state_with_enumerator(enumr, &mut name_cache) } {
                    Ok(current) => {
                        if current != previous {
                            let mic_changed = previous.get("micMuted") != current.get("micMuted");
                            let device_changed = previous.get("deviceId") != current.get("deviceId");
                            let reason = if previous.is_null() {
                                "initial"
                            } else if mic_changed {
                                "mic"
                            } else if device_changed {
                                "device"
                            } else {
                                "volume"
                            };
                            let _ = controls_app.emit("audio:state", json!({"state": current, "reason": reason}));
                            previous = current;
                        }
                    }
                    Err(_) => {
                        cached_enumr = None;
                    }
                }
            }
            let sleep_ms = if crate::is_low_power() { 1000 } else { 350 };
            std::thread::sleep(Duration::from_millis(sleep_ms));
        }
    });
    let _ = std::thread::Builder::new().name("woods-audio-spectrum".into()).spawn(move||{
        let _com=match ComApartment::new(){Ok(c)=>c,Err(e)=>{let _=app.emit("audio:error",e);return;}};
        let mut failed_pid: Option<u32> = None;
        loop {
            if !spectrum_active() { std::thread::sleep(Duration::from_millis(250)); continue; }
            let outcome=unsafe{capture_session(&app, &mut failed_pid)};
            let failed=outcome.is_err();
            if let Err(error)=outcome {let _=app.emit("audio:error",error);}
            let _=app.emit("media:bands",[0.; BAND_COUNT]);let _=app.emit("media:level",0.);
            if failed { std::thread::sleep(Duration::from_secs(1)); }
        }
    });
}

/// Capture mono samples from the input endpoint or the system loopback. Device
/// positions insert missing silence, preserving timing when Windows omits quiet
/// loopback packets. Callbacks can stream to disk instead of accumulating RAM.
pub fn capture_pcm(
    input: bool, stop: &AtomicBool, max_seconds:u64,
    mut initialize: impl FnMut(u32)->Result<(),String>,
    samples: impl FnMut(&[f32])->Result<(),String>,
) -> Result<(),String> {
    capture_pcm_channels(input,stop,max_seconds,1,|rate,_|initialize(rate),samples)
}

pub fn capture_pcm_channels(
    input: bool, stop: &AtomicBool, max_seconds:u64, preferred_channels:u16,
    mut initialize: impl FnMut(u32,u16)->Result<(),String>,
    mut samples: impl FnMut(&[f32])->Result<(),String>,
) -> Result<(),String> {
    let _com=ComApartment::new()?;
    unsafe {
        let flow=if input{eCapture}else{eRender};
        let device=selected_device(flow).map_err(|e|e.to_string())?;
        let client:IAudioClient=device.Activate(CLSCTX_ALL,None).map_err(|e|e.to_string())?;
        let format=client.GetMixFormat().map_err(|e|e.to_string())?;
        let parsed=read_format(format);
        let initialized=client.Initialize(AUDCLNT_SHAREMODE_SHARED,if input{0}else{AUDCLNT_STREAMFLAGS_LOOPBACK},1_000_000,0,format,None);
        CoTaskMemFree(Some(format.cast()));
        let parsed=parsed?;initialized.map_err(|e|e.to_string())?;
        let channels=if preferred_channels>=2 && parsed.channels>=2 {2}else{1};
        initialize(parsed.rate,channels)?;
        let capture:IAudioCaptureClient=client.GetService().map_err(|e|e.to_string())?;
        client.Start().map_err(|e|e.to_string())?;
        let began=Instant::now();let mut emitted_frames=0u64;let mut first_position=None;
        let outcome=(||->Result<(),String>{
            while !stop.load(Ordering::SeqCst) && began.elapsed().as_secs()<max_seconds {
                std::thread::sleep(Duration::from_millis(10));
                while capture.GetNextPacketSize().map_err(|e|e.to_string())?>0 {
                    let mut data=std::ptr::null_mut();let mut frames=0;let mut flags=0;let mut position=0;
                    capture.GetBuffer(&mut data,&mut frames,&mut flags,Some(&mut position),None).map_err(|e|e.to_string())?;
                    let packet_result=(||->Result<(),String>{
                        let start=*first_position.get_or_insert_with(||position.saturating_sub((began.elapsed().as_secs_f64()*parsed.rate as f64) as u64));
                        let expected=position.saturating_sub(start);
                        if expected>emitted_frames && expected-emitted_frames < parsed.rate as u64*60 {
                            let silence=vec![0.;(expected-emitted_frames) as usize*channels as usize];samples(&silence)?;emitted_frames=expected;
                        }
                        let mut output=vec![0.;frames as usize*channels as usize];
                        if flags&AUDCLNT_BUFFERFLAGS_SILENT.0 as u32==0 && !data.is_null() {
                            let bytes=std::slice::from_raw_parts(data,frames as usize*parsed.block);
                            for (index,frame) in bytes.chunks_exact(parsed.block).enumerate() {
                                if channels==2 {
                                    for channel in 0..2 {output[index*2+channel]=decode_sample(&frame[channel*parsed.bytes..(channel+1)*parsed.bytes],parsed.float);}
                                }else{output[index]=(0..parsed.channels).map(|ch|decode_sample(&frame[ch*parsed.bytes..(ch+1)*parsed.bytes],parsed.float)).sum::<f32>()/parsed.channels as f32;}
                            }
                        }
                        samples(&output)?;emitted_frames+=u64::from(frames);Ok(())
                    })();
                    capture.ReleaseBuffer(frames).map_err(|e|e.to_string())?;packet_result?;
                }
            }
            let expected=(began.elapsed().as_secs_f64()*parsed.rate as f64) as u64;
            if expected>emitted_frames {samples(&vec![0.;(expected-emitted_frames).min(parsed.rate as u64*60) as usize*channels as usize])?;}
            Ok(())
        })();
        let _=client.Stop();outcome
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn silence_has_zero_spectrum_and_level(){let mut s=Spectrum::new();for _ in 0..FFT_SIZE{s.push(0.);}let(b,l)=s.measure(48000);assert_eq!(b,[0.; BAND_COUNT]);assert_eq!(l,0.);}
    #[test] fn sine_is_measured_in_its_frequency_band(){
        let mut s=Spectrum::new();
        for i in 0..FFT_SIZE{s.push((2.*std::f32::consts::PI*1000.*i as f32/48000.).sin()*0.5);}
        let(b,l)=s.measure(48000);
        let dominant=b.iter().enumerate().max_by(|a,b|a.1.total_cmp(b.1)).unwrap().0;
        assert_eq!(dominant,12,"1000 Hz falls in band 12 (980..1280 Hz)");
        assert!(b[dominant]>0.7 && l>0.5 && l<=1.);
    }
    #[test] fn bass_and_treble_separate_cleanly_at_normal_volume(){
        let mut bass=Spectrum::new();
        for i in 0..FFT_SIZE{bass.push((2.*std::f32::consts::PI*95.*i as f32/48000.).sin()*0.08);}
        let (bb,bl)=bass.measure(48000);
        let bass_idx=bb.iter().enumerate().max_by(|a,b|a.1.total_cmp(b.1)).unwrap().0;
        assert!(bass_idx<=4 && bb[bass_idx]>0.6 && bl>0.5,"Quiet bass should still register strongly via adaptive gain");
        let mut treble=Spectrum::new();
        for i in 0..FFT_SIZE{treble.push((2.*std::f32::consts::PI*6800.*i as f32/48000.).sin()*0.08);}
        let (tb,tl)=treble.measure(48000);
        let treble_idx=tb.iter().enumerate().max_by(|a,b|a.1.total_cmp(b.1)).unwrap().0;
        assert!(treble_idx>=18 && tb[treble_idx]>0.6 && tl>0.5,"Quiet treble should register cleanly via tilt + adaptive gain");
    }
    #[test] fn sample_formats_preserve_sign(){assert_eq!(decode_sample(&[0,128],false),-1.);assert_eq!(decode_sample(&[0,0,128],false),-1.);assert_eq!(decode_sample(&1f32.to_le_bytes(),true),1.);}
    #[test] fn invalid_samples_never_poison_spectrum(){let mut s=Spectrum::new();s.push(f32::NAN);s.push(f32::INFINITY);let(b,l)=s.measure(48000);assert!(b.iter().all(|v|v.is_finite()));assert!(l.is_finite());}
    #[test] fn silence_releases_previous_bands_without_fft(){let mut s=Spectrum::new();s.bands=[1.; BAND_COUNT];for _ in 0..FFT_SIZE{s.push(0.);}let(b,l)=s.measure(48000);assert_eq!(b,[0.65; BAND_COUNT]);assert_eq!(l,0.);for _ in 0..24{s.measure(48000);}assert_eq!(s.bands,[0.; BAND_COUNT]);}
}
