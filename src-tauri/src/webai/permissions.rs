use std::sync::{mpsc, Arc, Mutex};
use tauri::{AppHandle, Manager};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{
    GetNonDefaultPermissionSettingsCompletedHandler, SetPermissionStateCompletedHandler,
};
use windows_core_webview::{Interface, HSTRING, PWSTR};

fn trusted_origin(origin: &str, hosts: &[String]) -> bool {
    reqwest::Url::parse(origin).ok().is_some_and(|url| {
        matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some_and(|host| {
                hosts
                    .iter()
                    .any(|allowed| host == allowed || host.ends_with(&format!(".{allowed}")))
            })
    })
}
type Pending = Arc<Mutex<(usize, Option<String>)>>;
fn complete(
    pending: &Pending,
    sender: &mpsc::Sender<Result<usize, String>>,
    total: usize,
    result: Result<(), String>,
) {
    let mut state = pending.lock().unwrap();
    if let Err(error) = result {
        state.1.get_or_insert(error);
    }
    state.0 -= 1;
    if state.0 == 0 {
        let _ = sender.send(state.1.clone().map_or(Ok(total), Err));
    }
}

pub async fn reset(app: &AppHandle, service: Option<&str>) -> Result<usize, String> {
    let services = service.map_or_else(
        || vec!["chatgpt", "gemini", "deepseek", "claude", "grok", "qwen"],
        |value| vec![value],
    );
    let mut hosts = Vec::new();
    for service in services {
        let url = super::view_url(service)?;
        hosts.push(url.host_str().ok_or("AI site has no host")?.to_owned());
    }
    // All embedded and pop-out providers use the application's shared WebView2
    // profile. Access it through main so closed providers are reset as well.
    let view = app
        .get_webview("main")
        .ok_or("WebView2 profile is not available")?;
    let (sender, receiver) = mpsc::channel();
    view.with_webview(move |platform| unsafe {
        let profile = platform
            .controller()
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_13>())
            .and_then(|core| core.Profile())
            .and_then(|profile| profile.cast::<ICoreWebView2Profile4>());
        let Ok(profile) = profile else {
            let _ = sender.send(Err(
                "WebView2 needs an update to reset site permissions".into()
            ));
            return;
        };
        let update_profile = profile.clone();
        let on_error = sender.clone();
        let handler = GetNonDefaultPermissionSettingsCompletedHandler::create(Box::new(
            move |status, collection| {
                let outcome = (|| -> Result<(), String> {
                    status.map_err(|_| "Could not read saved site permissions")?;
                    let collection = collection.ok_or("Saved permissions were not returned")?;
                    let mut count = 0;
                    collection
                        .Count(&mut count)
                        .map_err(|_| "Could not enumerate saved permissions")?;
                    if count > 1024 {
                        return Err("Too many saved permission entries".into());
                    }
                    let mut entries = Vec::new();
                    for index in 0..count {
                        let item = collection
                            .GetValueAtIndex(index)
                            .map_err(|_| "Could not read a saved permission")?;
                        let mut kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION;
                        item.PermissionKind(&mut kind)
                            .map_err(|_| "Could not read permission kind")?;
                        if ![
                            COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
                            COREWEBVIEW2_PERMISSION_KIND_CAMERA,
                            COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS,
                        ]
                        .contains(&kind)
                        {
                            continue;
                        }
                        let mut origin = PWSTR::null();
                        item.PermissionOrigin(&mut origin)
                            .map_err(|_| "Could not read permission origin")?;
                        let text = origin.to_string().unwrap_or_default();
                        windows::Win32::System::Com::CoTaskMemFree(Some(origin.0.cast()));
                        if trusted_origin(&text, &hosts) {
                            entries.push((kind, HSTRING::from(text)));
                        }
                    }
                    let total = entries.len();
                    if total == 0 {
                        let _ = sender.send(Ok(0));
                        return Ok(());
                    }
                    let pending = Arc::new(Mutex::new((total, None)));
                    for (kind, origin) in entries {
                        let state = pending.clone();
                        let reply = sender.clone();
                        let completion =
                            SetPermissionStateCompletedHandler::create(Box::new(move |status| {
                                complete(
                                    &state,
                                    &reply,
                                    total,
                                    status.map_err(|_| "Could not reset a saved permission".into()),
                                );
                                Ok(())
                            }));
                        if update_profile
                            .SetPermissionState(
                                kind,
                                &origin,
                                COREWEBVIEW2_PERMISSION_STATE_DEFAULT,
                                &completion,
                            )
                            .is_err()
                        {
                            complete(
                                &pending,
                                &sender,
                                total,
                                Err("Could not schedule permission reset".into()),
                            );
                        }
                    }
                    Ok(())
                })();
                if let Err(error) = outcome {
                    let _ = sender.send(Err(error));
                }
                Ok(())
            },
        ));
        if profile.GetNonDefaultPermissionSettings(&handler).is_err() {
            let _ = on_error.send(Err("Could not request saved permissions".into()));
        }
    })
    .map_err(|_| "Could not access the AI site profile")?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(8))
            .map_err(|_| "Site permission reset did not finish in time".to_owned())?
    })
    .await
    .map_err(|_| "Site permission reset was interrupted".to_owned())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reset_scope_cannot_cross_into_unrelated_origins() {
        let hosts = vec!["chatgpt.com".to_owned()];
        assert!(trusted_origin("https://chatgpt.com", &hosts));
        assert!(trusted_origin("https://voice.chatgpt.com", &hosts));
        for url in [
            "https://chatgpt.com.evil.test",
            "https://example.com",
            "file:///chatgpt.com",
        ] {
            assert!(!trusted_origin(url, &hosts));
        }
    }
    #[test]
    fn completion_waits_for_every_permission_and_preserves_failure() {
        let (tx, rx) = mpsc::channel();
        let pending = Arc::new(Mutex::new((2, None)));
        complete(&pending, &tx, 2, Err("failed".into()));
        assert!(rx.try_recv().is_err());
        complete(&pending, &tx, 2, Ok(()));
        assert_eq!(rx.recv().unwrap(), Err("failed".into()));
    }
}
