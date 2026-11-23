//! Windows process-tree loopback, independent of the default endpoint or virtual mixer routing.
use std::{mem::ManuallyDrop, sync::mpsc, time::Duration};
use windows::{core::{implement, Interface, PROPVARIANT, HRESULT}, Win32::Media::Audio::{
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation, IActivateAudioInterfaceCompletionHandler,
    IActivateAudioInterfaceCompletionHandler_Impl, IAudioClient,
    AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_PARAMS_0, AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
    VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
}};
use windows::Win32::System::Com::{CoGetApartmentType, APTTYPE, APTTYPEQUALIFIER, APTTYPE_MTA};

struct MtaClient(IAudioClient);
// Activation and completion are checked to share the process-wide MTA. IAudioClient's
// process-loopback implementation has no registered proxy, so it cannot use AgileReference.
unsafe impl Send for MtaClient {}

fn require_mta() -> Result<(), String> {
    let mut apartment = APTTYPE::default();
    let mut qualifier = APTTYPEQUALIFIER::default();
    unsafe { CoGetApartmentType(&mut apartment, &mut qualifier) }.map_err(|e| e.to_string())?;
    if apartment != APTTYPE_MTA { return Err("Захват звука плеера требует COM MTA".into()); }
    Ok(())
}

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct Completion {
    sender: mpsc::Sender<Result<MtaClient, String>>,
    // Keep the activation blob alive even when the caller's bounded wait expires.
    _params: Box<AUDIOCLIENT_ACTIVATION_PARAMS>,
}

impl IActivateAudioInterfaceCompletionHandler_Impl for Completion_Impl {
    fn ActivateCompleted(&self, operation: Option<&IActivateAudioInterfaceAsyncOperation>) -> windows::core::Result<()> {
        let result = (|| -> Result<MtaClient, String> {
            require_mta()?;
            let operation = operation.ok_or("Windows не вернула операцию захвата")?;
            let mut status = HRESULT(0);
            let mut interface = None;
            unsafe { operation.GetActivateResult(&mut status, &mut interface) }.map_err(|e| e.to_string())?;
            status.ok().map_err(|e| e.to_string())?;
            let client: IAudioClient = interface.ok_or("Windows не вернула аудиоклиент")?.cast().map_err(|e| e.to_string())?;
            Ok(MtaClient(client))
        })();
        // A timed-out caller drops its receiver; COM still releases the completed operation normally.
        let _ = self.sender.send(result);
        Ok(())
    }
}

pub fn activate(pid: u32) -> Result<IAudioClient, String> {
    if pid == 0 { return Err("Для захвата нужен процесс плеера".into()); }
    require_mta()?;
    let params = Box::new(AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 { ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
            TargetProcessId: pid,
            ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
        } },
    });
    let (sender, receiver) = mpsc::channel();
    let pointer = (&*params as *const AUDIOCLIENT_ACTIVATION_PARAMS).cast::<u8>();
    let completion: IActivateAudioInterfaceCompletionHandler = Completion { sender, _params: params }.into();
    let mut raw = unsafe { std::mem::zeroed::<windows::core::imp::PROPVARIANT>() };
    raw.Anonymous.Anonymous.vt = 65; // VT_BLOB
    raw.Anonymous.Anonymous.Anonymous.blob = windows::core::imp::BLOB {
        cbSize: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
        pBlobData: pointer.cast_mut(),
    };
    // PROPVARIANT must not free a blob owned by the completion object.
    let variant = ManuallyDrop::new(unsafe { PROPVARIANT::from_raw(raw) });
    let _operation = unsafe { ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, &IAudioClient::IID, Some(&*variant), &completion) }.map_err(|e| e.to_string())?;
    Ok(receiver.recv_timeout(Duration::from_secs(3)).map_err(|_| "Windows не ответила на запрос звука плеера".to_owned())??.0)
}
