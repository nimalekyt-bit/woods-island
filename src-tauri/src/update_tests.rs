//! Real signature checks using a dedicated test key and harmless local bytes.
//! Nothing here runs an installer, creates a webview or contacts an external host.
use serde_json::{json, Value};
use std::{io::{Read, Write}, net::{Shutdown, TcpListener}, sync::{Arc, atomic::{AtomicBool, Ordering}}, thread, time::{Duration, Instant}};
use tauri::{test::{mock_builder, mock_context, noop_assets, MockRuntime}, App};
use tauri_plugin_updater::{Error, Update, UpdaterExt};

const BYTES: &[u8] = include_bytes!("../../tests/fixtures/updater/fixture.txt");
const SIGNATURE: &str = include_str!("../../tests/fixtures/updater/fixture.txt.sig");
const PUBLIC_KEY: &str = include_str!("../../tests/fixtures/updater/test-public.pub");
const WRONG_KEY: &str = include_str!("../../tests/fixtures/updater/wrong-public.pub");

fn application(public_key: &str) -> App<MockRuntime> {
    crate::updates::ensure_crypto();
    let mut context = mock_context(noop_assets());
    context.config_mut().plugins.0.insert("updater".into(), json!({
        "pubkey": public_key.trim(),
        "endpoints": ["https://updater-test.invalid/latest.json"],
        "requireSignedVersion": true,
        "allowDowngrades": false,
        // The only HTTP download used by these tests is a loopback listener.
        "dangerousInsecureTransportProtocol": true
    }));
    mock_builder().plugin(tauri_plugin_updater::Builder::new().build()).build(context).unwrap()
}

fn manifest(version: &str, url: &str) -> Value {
    json!({"version":version,"notes":"Local updater verification fixture","platforms":{
        "windows-x86_64":{"url":url,"signature":SIGNATURE.trim()}
    }})
}

fn restore(app: &App<MockRuntime>, data: Value) -> Result<Option<Update>, Error> {
    app.updater_builder().target("windows-x86_64").no_proxy().build()?.restore_update(data)
}

#[test]
fn signed_fixture_verifies_and_modified_or_truncated_bytes_are_rejected() {
    let app=application(PUBLIC_KEY);
    let update=restore(&app,manifest("9.9.0","https://updater-test.invalid/fixture.txt")).unwrap().unwrap();
    update.verify(BYTES).expect("Dedicated test signature must authenticate the exact fixture");
    let mut corrupt=BYTES.to_vec();corrupt[0]^=1;
    assert!(matches!(update.verify(&corrupt),Err(Error::Minisign(_))));
    assert!(matches!(update.verify(&BYTES[..BYTES.len()/2]),Err(Error::Minisign(_))));
    assert!(update.verify(&[]).is_err());
}

#[test]
fn inflated_manifest_version_cannot_replay_an_older_validly_signed_package() {
    let app=application(PUBLIC_KEY);
    let update=restore(&app,manifest("9.9.1","https://updater-test.invalid/fixture.txt")).unwrap().unwrap();
    match update.verify(BYTES) {
        Err(Error::SignedVersionMismatch { signed, announced }) => {
            assert_eq!(signed,"9.9.0");assert_eq!(announced,"9.9.1");
        }
        result => panic!("Expected a signed version mismatch, got {result:?}"),
    }
}

#[test]
fn another_valid_public_key_cannot_authenticate_the_release() {
    let app=application(WRONG_KEY);
    let update=restore(&app,manifest("9.9.0","https://updater-test.invalid/fixture.txt")).unwrap().unwrap();
    assert!(matches!(update.verify(BYTES),Err(Error::Minisign(_))));
}

#[test]
fn production_configuration_keeps_test_keys_and_insecure_options_out() {
    let value: Value=serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    let config: tauri_plugin_updater::Config=serde_json::from_value(value["plugins"]["updater"].clone()).unwrap();
    assert!(config.require_signed_version);assert!(!config.allow_downgrades);
    assert!(!config.dangerous_insecure_transport_protocol && !config.dangerous_accept_invalid_certs && !config.dangerous_accept_invalid_hostnames);
    assert!(!config.pubkey.trim().is_empty());assert_ne!(config.pubkey.trim(),PUBLIC_KEY.trim());assert_ne!(config.pubkey.trim(),WRONG_KEY.trim());
    assert_eq!(config.endpoints.len(),1);
    assert_eq!(config.endpoints[0].as_str(),"https://github.com/nimalekyt-bit/woods-island/releases/latest/download/latest.json");
}

#[test]
fn compact_cache_restores_offline_even_when_release_notes_are_large() {
    let app=application(PUBLIC_KEY);
    let mut data=manifest("9.9.0","https://updater-test.invalid/fixture.txt");
    data["notes"]=json!("large release notes".repeat(20000));
    let update=restore(&app,data).unwrap().unwrap();
    let compact=crate::updates::cached_manifest(&update);
    assert!(serde_json::to_vec(&compact).unwrap().len()<4096);
    assert!(compact.get("notes").is_none());
    restore(&app,compact).unwrap().unwrap().verify(BYTES).unwrap();
}

#[test]
fn old_and_current_versions_are_not_updates_and_wrong_target_is_rejected() {
    let app=application(PUBLIC_KEY); // mock_context has version 0.1.0.
    for version in ["0.0.9","0.1.0"] {
        assert!(restore(&app,manifest(version,"https://updater-test.invalid/fixture.txt")).unwrap().is_none());
    }
    let mut other=manifest("9.9.0","https://updater-test.invalid/fixture.txt");
    let platform=other["platforms"].as_object_mut().unwrap().remove("windows-x86_64").unwrap();
    other["platforms"]["windows-aarch64"]=platform;
    assert!(matches!(restore(&app,other),Err(Error::TargetNotFound(target)) if target=="windows-x86_64"));
    assert!(matches!(restore(&app,manifest("../9.9.0","https://updater-test.invalid/fixture.txt")),Err(Error::Serialization(_))));
}

// One bounded request per listener; no persistent server or GUI process survives.
fn serve_once(body: Vec<u8>, declared_length: usize) -> (String, thread::JoinHandle<()>) {
    let listener=TcpListener::bind("127.0.0.1:0").unwrap();
    let address=listener.local_addr().unwrap();listener.set_nonblocking(true).unwrap();
    let handle=thread::spawn(move||{
        let deadline=Instant::now()+Duration::from_secs(5);
        let (mut stream,peer)=loop {
            match listener.accept() {
                Ok(connection)=>break connection,
                Err(error) if error.kind()==std::io::ErrorKind::WouldBlock => {
                    assert!(Instant::now()<deadline,"No loopback download request arrived");
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error)=>panic!("Loopback listener failed: {error}"),
            }
        };
        assert!(peer.ip().is_loopback());
        stream.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        stream.set_write_timeout(Some(Duration::from_secs(2))).unwrap();
        let mut request=[0;4096];let count=stream.read(&mut request).unwrap();
        assert!(std::str::from_utf8(&request[..count]).unwrap().starts_with("GET /fixture.txt "));
        write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {declared_length}\r\nConnection: close\r\n\r\n").unwrap();
        stream.write_all(&body).unwrap();stream.flush().unwrap();stream.shutdown(Shutdown::Write).unwrap();
    });
    (format!("http://{address}/fixture.txt"),handle)
}

#[tokio::test]
async fn incomplete_http_transfer_is_rejected_before_download_completion() {
    let app=application(PUBLIC_KEY);
    let (url,server)=serve_once(BYTES[..BYTES.len()/2].to_vec(),BYTES.len());
    let mut update=restore(&app,manifest("9.9.0",&url)).unwrap().unwrap();update.timeout=Some(Duration::from_secs(3));
    let finished=Arc::new(AtomicBool::new(false));let flag=finished.clone();
    let outcome=update.download(|_,_|{},move||{flag.store(true,Ordering::Relaxed);}).await;
    server.join().unwrap();
    assert!(matches!(outcome,Err(Error::Reqwest(_))),"Truncated Content-Length must be a transfer error");
    assert!(!finished.load(Ordering::Relaxed));
}

#[tokio::test]
async fn short_but_http_complete_response_still_fails_signature_verification() {
    let app=application(PUBLIC_KEY);let short=BYTES[..BYTES.len()/2].to_vec();
    let (url,server)=serve_once(short.clone(),short.len());
    let mut update=restore(&app,manifest("9.9.0",&url)).unwrap().unwrap();update.timeout=Some(Duration::from_secs(3));
    let outcome=update.download(|_,_|{},||{}).await;server.join().unwrap();
    assert!(matches!(outcome,Err(Error::Minisign(_))),"A complete HTTP body is not proof of an authentic package");
}
