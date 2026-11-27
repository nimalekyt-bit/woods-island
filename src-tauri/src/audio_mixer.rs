use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    path::Path,
    sync::{mpsc, OnceLock},
    time::{Duration, Instant},
};
use windows::{
    core::Interface,
    Win32::{
        Foundation::CloseHandle,
        Media::Audio::Endpoints::IAudioMeterInformation,
        Media::Audio::*,
        System::{
            Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL},
            Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
    },
};

struct Session {
    id: String,
    name: String,
    path: Option<String>,
    volume: ISimpleAudioVolume,
    control: IAudioSessionControl,
}
unsafe fn path(pid: u32) -> Option<String> {
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buffer = vec![0u16; 32768];
    let mut count = buffer.len() as u32;
    let result = QueryFullProcessImageNameW(
        handle,
        PROCESS_NAME_WIN32,
        windows::core::PWSTR(buffer.as_mut_ptr()),
        &mut count,
    );
    let _ = CloseHandle(handle);
    result.ok()?;
    Some(String::from_utf16_lossy(&buffer[..count as usize]))
}
fn normalize_session_name(
    display: Option<String>,
    path: Option<&str>,
    pid: u32,
    system: bool,
) -> String {
    let clean_display = display.and_then(|raw| {
        let trimmed = raw.trim();
        // Windows often returns indirect DLL resource strings such as
        // "@%SystemRoot%\System32\AudioSrv.Dll,-202" for System Sounds.
        if trimmed.is_empty() || trimmed.starts_with('@') {
            None
        } else {
            Some(trimmed.to_owned())
        }
    });
    if system {
        return clean_display.unwrap_or_else(|| "System Sounds".into());
    }
    clean_display.unwrap_or_else(|| {
        path.and_then(|p| Path::new(p).file_name())
            .map(|p| crate::media::format_app_name(&p.to_string_lossy()))
            .unwrap_or_else(|| format!("Application {pid}"))
    })
}

fn group_id(path: Option<&str>, pid: u32, system: bool) -> String {
    if system {
        return "system".into();
    }
    path.map(|p| format!("app:{:x}", Sha256::digest(p.to_lowercase().as_bytes())))
        .unwrap_or_else(|| format!("pid:{pid}"))
}
unsafe fn sessions() -> Result<Vec<Session>, String> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        .map_err(|_| "Windows audio is unavailable")?;
    let devices = enumerator
        .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
        .map_err(|_| "Could not read audio outputs")?;
    let mut sessions = Vec::new();
    for index in 0..devices
        .GetCount()
        .map_err(|_| "Could not list audio outputs")?
        .min(32)
    {
        let device = devices
            .Item(index)
            .map_err(|_| "Audio output disappeared")?;
        let Ok(manager): Result<IAudioSessionManager2, _> = device.Activate(CLSCTX_ALL, None)
        else {
            continue;
        };
        let Ok(list) = manager.GetSessionEnumerator() else {
            continue;
        };
        for index in 0..list.GetCount().unwrap_or(0).min(256) {
            let Ok(control) = list.GetSession(index) else {
                continue;
            };
            if control.GetState().ok() == Some(AudioSessionStateExpired) {
                continue;
            }
            let Ok(extended) = control.cast::<IAudioSessionControl2>() else {
                continue;
            };
            let Ok(volume) = control.cast::<ISimpleAudioVolume>() else {
                continue;
            };
            let pid = extended.GetProcessId().unwrap_or(0);
            let system = extended.IsSystemSoundsSession() == windows::core::HRESULT(0);
            let path = if system { None } else { path(pid) };
            let display = control
                .GetDisplayName()
                .ok()
                .and_then(|name| {
                    let text = name.to_string().ok();
                    CoTaskMemFree(Some(name.0.cast()));
                    text
                })
                .filter(|name| !name.trim().is_empty());
            let name = normalize_session_name(display, path.as_deref(), pid, system);
            sessions.push(Session {
                id: group_id(path.as_deref(), pid, system),
                name,
                path,
                volume,
                control,
            });
        }
    }
    Ok(sessions)
}
fn list_sessions(sessions: &[Session]) -> Vec<Value> {
    let mut groups = BTreeMap::<String, (Value, usize, f64, bool)>::new();
    for session in sessions {
        let Ok(level) = (unsafe { session.volume.GetMasterVolume() }) else {
            continue;
        };
        let muted = unsafe { session.volume.GetMute() }
            .map(|v| v.as_bool())
            .unwrap_or(false);
        let playing = unsafe { session.control.GetState() }.ok() == Some(AudioSessionStateActive);
        let peak = unsafe {
            session
                .control
                .cast::<IAudioMeterInformation>()
                .ok()
                .and_then(|meter| meter.GetPeakValue().ok())
                .unwrap_or(0.)
                .clamp(0., 1.)
        };
        let entry=groups.entry(session.id.clone()).or_insert_with(||(json!({"id":session.id,"name":session.name,"icon":session.path.as_deref().and_then(crate::system::icon),"volume":level,"muted":muted,"playing":playing,"peak":peak}),0,0.,true));
        entry.1 += 1;
        entry.2 += level as f64;
        entry.3 &= muted;
        entry.0["playing"] = json!(entry.0["playing"] == true || playing);
        entry.0["peak"] = json!(entry.0["peak"].as_f64().unwrap_or(0.).max(peak as f64));
    }
    let mut values = groups
        .into_values()
        .map(|(mut value, count, total, muted)| {
            value["volume"] = json!(total / count as f64);
            value["muted"] = json!(muted);
            value["sessions"] = json!(count);
            value
        })
        .collect::<Vec<_>>();
    values.sort_by(|a, b| {
        b["playing"]
            .as_bool()
            .cmp(&a["playing"].as_bool())
            .then(a["name"].as_str().cmp(&b["name"].as_str()))
    });
    values
}
fn set_sessions(
    sessions: &[Session],
    id: &str,
    level: Option<f64>,
    mute: Option<bool>,
) -> Result<bool, String> {
    if id.len() > 80
        || id.is_empty()
        || level.is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
    {
        return Err("Invalid application volume".into());
    }
    let mut changed = 0;
    let mut failed = false;
    for session in sessions.iter().filter(|session| session.id == id) {
        let result = (|| unsafe {
            if let Some(value) = level {
                session
                    .volume
                    .SetMasterVolume(value as f32, std::ptr::null())?;
                if value > 0. && mute.is_none() {
                    session.volume.SetMute(false, std::ptr::null())?;
                }
            }
            if let Some(value) = mute {
                session.volume.SetMute(value, std::ptr::null())?;
            }
            Ok::<_, windows::core::Error>(())
        })();
        if result.is_ok() {
            changed += 1;
        } else {
            failed = true;
        }
    }
    if failed {
        return Err(
            "Some application audio sessions could not be changed; refresh the mixer".into(),
        );
    }
    if changed == 0 {
        return Err("This application no longer has an audio session".into());
    }
    Ok(true)
}
enum Request {
    List(bool, mpsc::Sender<Result<Vec<Value>, String>>),
    Set(
        String,
        Option<f64>,
        Option<bool>,
        mpsc::Sender<Result<bool, String>>,
    ),
}
static WORKER: OnceLock<Result<mpsc::SyncSender<Request>, String>> = OnceLock::new();
fn worker() -> Result<&'static mpsc::SyncSender<Request>, String> {
    WORKER
        .get_or_init(|| {
            let (sender, receiver) = mpsc::sync_channel::<Request>(16);
            std::thread::Builder::new()
                .name("woods-audio-mixer".into())
                .spawn(move || {
                    let apartment = crate::audio::ComApartment::new();
                    let mut cached = None;
                    let mut checked = Instant::now() - Duration::from_secs(10);
                    loop {
                        let request = match receiver.recv_timeout(Duration::from_secs(2)) {
                            Ok(request) => request,
                            Err(mpsc::RecvTimeoutError::Timeout) => {
                                cached = None;
                                continue;
                            }
                            Err(_) => break,
                        };
                        let force =
                            matches!(request, Request::List(true, _) | Request::Set(_, _, _, _));
                        let result = if let Err(error) = &apartment {
                            Err(error.clone())
                        } else if cached.is_none()
                            || force
                            || checked.elapsed() >= Duration::from_secs(3)
                        {
                            match unsafe { sessions() } {
                                Ok(value) => {
                                    cached = Some(value);
                                    checked = Instant::now();
                                    Ok(())
                                }
                                Err(error) => Err(error),
                            }
                        } else {
                            Ok(())
                        };
                        match request {
                            Request::List(_, reply) => {
                                let _ = reply
                                    .send(result.map(|_| list_sessions(cached.as_ref().unwrap())));
                            }
                            Request::Set(id, level, mute, reply) => {
                                let _ = reply.send(result.and_then(|_| {
                                    set_sessions(cached.as_ref().unwrap(), &id, level, mute)
                                }));
                            }
                        }
                    }
                })
                .map_err(|_| "Could not start application audio controls".to_owned())?;
            Ok(sender)
        })
        .as_ref()
        .map_err(Clone::clone)
}
pub fn list(force: bool) -> Result<Vec<Value>, String> {
    let (sender, receiver) = mpsc::channel();
    worker()?
        .try_send(Request::List(force, sender))
        .map_err(|_| "Audio controls are busy")?;
    receiver
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| "Audio controls did not respond in time")?
}
pub fn set(id: &str, level: Option<f64>, mute: Option<bool>) -> Result<bool, String> {
    if id.len() > 80
        || id.is_empty()
        || level.is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
    {
        return Err("Invalid application volume".into());
    }
    let (sender, receiver) = mpsc::channel();
    worker()?
        .try_send(Request::Set(id.to_owned(), level, mute, sender))
        .map_err(|_| "Audio controls are busy")?;
    receiver
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| "Audio controls did not respond in time")?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Requires a real Windows render device; run explicitly during native QA"]
    fn volume_and_mute_change_only_the_owned_silent_test_session() {
        let _com=crate::audio::ComApartment::new().unwrap();
        unsafe {
            let enumerator:IMMDeviceEnumerator=CoCreateInstance(&MMDeviceEnumerator,None,CLSCTX_ALL).unwrap();
            let device=enumerator.GetDefaultAudioEndpoint(eRender,eConsole).unwrap();
            let client:IAudioClient=device.Activate(CLSCTX_ALL,None).unwrap();
            let format=client.GetMixFormat().unwrap();
            let session=windows::core::GUID::from_u128(0x534b6f8acd9f4aac0000000000000000u128|((crate::media::now_ms() as u128)<<32)|std::process::id() as u128);
            let result=client.Initialize(AUDCLNT_SHAREMODE_SHARED,0,1_000_000,0,format,Some(&session));CoTaskMemFree(Some(format.cast()));result.unwrap();
            let volume:ISimpleAudioVolume=client.GetService().unwrap();
            struct Restore(ISimpleAudioVolume,f32,bool);
            impl Drop for Restore {fn drop(&mut self){unsafe{let _=self.0.SetMasterVolume(self.1,std::ptr::null());let _=self.0.SetMute(self.2,std::ptr::null());}}}
            let _restore=Restore(volume.clone(),volume.GetMasterVolume().unwrap(),volume.GetMute().unwrap().as_bool());
            let executable=std::env::current_exe().unwrap().to_string_lossy().into_owned();
            let id=group_id(Some(&executable),std::process::id(),false);
            let apps=list(true).unwrap();assert!(apps.iter().any(|app|app["id"]==id),"The owned silent session must be enumerable");
            assert!(set(&id,Some(0.25),Some(true)).unwrap());
            assert!((volume.GetMasterVolume().unwrap()-0.25).abs()<0.001);assert!(volume.GetMute().unwrap().as_bool());
            let apps=list(false).unwrap();let app=apps.iter().find(|app|app["id"]==id).unwrap();assert!((app["volume"].as_f64().unwrap()-0.25).abs()<0.001);assert_eq!(app["muted"],true);
            assert!(set(&id,Some(0.75),Some(false)).unwrap());assert!((volume.GetMasterVolume().unwrap()-0.75).abs()<0.001);assert!(!volume.GetMute().unwrap().as_bool());
            // IAudioClient is never started, so this produces no sound.
        }
    }
    #[test]
    fn groups_use_full_executable_identity_and_never_expose_paths() {
        assert_eq!(
            group_id(Some("C:\\Program Files\\App.exe"), 1, false),
            group_id(Some("c:\\program files\\app.exe"), 2, false)
        );
        assert_ne!(
            group_id(Some("C:\\one\\App.exe"), 1, false),
            group_id(Some("C:\\two\\App.exe"), 2, false)
        );
        assert_eq!(group_id(None, 0, true), "system");
        assert_eq!(group_id(None, 42, false), "pid:42");
    }
    #[test]
    fn normalizes_windows_indirect_system_sounds_name() {
        assert_eq!(
            normalize_session_name(
                Some("@%SystemRoot%\\System32\\AudioSrv.Dll,-202".into()),
                None,
                0,
                true
            ),
            "System Sounds"
        );
        assert_eq!(
            normalize_session_name(
                Some("@%SystemRoot%\\System32\\AudioSrv.Dll,-202".into()),
                Some("C:\\Apps\\Spotify.exe"),
                1234,
                false
            ),
            "Spotify"
        );
        assert_eq!(
            normalize_session_name(Some("Microsoft Edge".into()), None, 10, false),
            "Microsoft Edge"
        );
    }
}
