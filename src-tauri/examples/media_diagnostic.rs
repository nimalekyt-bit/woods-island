// Read-only: never controls the player, keyboard, mouse or window focus.
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager as Manager;
fn main() -> anyhow::Result<()> {
    let _com = woods_island_lib::audio::ComApartment::new().map_err(anyhow::Error::msg)?;
    let manager = Manager::RequestAsync()?.get()?;
    for _ in 0..4 {
        let sessions = manager.GetSessions()?;
        println!("sessions={}", sessions.Size()?);
        for session in &sessions {
            let properties = session.TryGetMediaPropertiesAsync()?.get()?;
            println!("app={} title={} artist={} status={:?}", session.SourceAppUserModelId()?, properties.Title()?, properties.Artist()?, session.GetPlaybackInfo()?.PlaybackStatus()?);
        }
        let media = woods_island_lib::media::get_current_media();
        println!("backend={}", media.map(|mut m| {m["cover"]=serde_json::json!(m["cover"].as_str().map(|s|s.len()));m}).unwrap_or(serde_json::Value::Null));
        std::thread::sleep(std::time::Duration::from_millis(1000));
    }
    Ok(())
}
