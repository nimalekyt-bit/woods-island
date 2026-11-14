//! Offline release gate: authenticate the exact packaged Setup bytes.
//! Uses MockRuntime, never launches the application or installer, and makes no requests.
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri_plugin_updater::UpdaterExt;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    if arguments.len()!=2 { return Err("Usage: verify-update-package <latest.json> <Woods-Island-version-windows-x64-Setup.exe>".into()); }
    let manifest_path=PathBuf::from(&arguments[0]);let package_path=PathBuf::from(&arguments[1]);
    let manifest: Value=serde_json::from_slice(&fs::read(&manifest_path)?)?;
    let configuration: Value=serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let version=manifest["version"].as_str().ok_or("Manifest version is missing")?;
    if configuration["version"].as_str()!=Some(version) { return Err("Manifest version does not match the built application".into()); }
    let expected_name=format!("Woods-Island-{version}-windows-x64-Setup.exe");
    if package_path.file_name().and_then(|s|s.to_str())!=Some(expected_name.as_str()) { return Err("Setup filename does not match the manifest version".into()); }
    let updater_configuration=configuration["plugins"]["updater"].clone();
    if updater_configuration["requireSignedVersion"]!=true || updater_configuration["pubkey"].as_str().is_none_or(str::is_empty) {
        return Err("Production configuration must have a public key and require signed versions".into());
    }
    if updater_configuration["allowDowngrades"]==true || updater_configuration["dangerousAcceptInvalidCerts"]==true || updater_configuration["dangerousAcceptInvalidHostnames"]==true || updater_configuration["dangerousInsecureTransportProtocol"]==true {
        return Err("Production update verification must not relax downgrade or transport guards".into());
    }
    let mut context=mock_context(noop_assets());
    context.config_mut().plugins.0.insert("updater".into(),updater_configuration);
    let app=mock_builder().plugin(tauri_plugin_updater::Builder::new().build()).build(context)?;
    let updater=app.updater_builder().target("windows-x86_64").no_proxy().build()?;
    let update=updater.restore_update(manifest.clone())?.ok_or("Manifest does not describe a newer version")?;
    let expected_url=format!("https://github.com/nimalekyt-bit/woods-island/releases/download/v{version}/{expected_name}");
    if update.download_url.as_str()!=expected_url { return Err("Manifest download URL does not match the official versioned Setup asset".into()); }
    let metadata=fs::metadata(&package_path)?;
    if !metadata.is_file() || metadata.len()<2 || metadata.len()>256*1024*1024 { return Err("Setup size is outside the allowed bounds".into()); }
    let bytes=fs::read(package_path)?;
    if !bytes.starts_with(b"MZ") { return Err("Setup is not a Windows executable".into()); }
    update.verify(&bytes)?;
    println!("Verified signed Woods Island {version} Setup: {} bytes",bytes.len());
    Ok(())
}
