use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use serde_json::{json, Value};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, KEYEVENTF_KEYUP, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
    VK_VOLUME_DOWN, VK_VOLUME_MUTE, VK_VOLUME_UP,
};

static PICKED_APP_ID: Mutex<Option<String>> = Mutex::new(None);
static LAST_COVER_CACHE: Mutex<Option<(String, String)>> = Mutex::new(None); // (key, cover_url)
static PLAYBACK_TRACKER: Mutex<Option<PlaybackProgress>> = Mutex::new(None);

#[derive(Clone, Debug)]
struct PlaybackProgress {
    key: String,
    base_pos_ms: u64,
    last_tick: u64,
    duration_ms: u64,
    playing: bool,
    raw_pos_ms: u64,
    timeline_at: i64,
}

impl PlaybackProgress {
    fn advance(&mut self, raw: u64, duration: u64, timeline_at: i64, now: u64, playing: bool) -> u64 {
        // Many players publish the timeline only on seeks or play/pause. A
        // repeated raw position is an anchor, not a command to rewind.
        if raw != self.raw_pos_ms || (timeline_at != 0 && timeline_at != self.timeline_at) {
            self.base_pos_ms = raw;
        } else if self.playing {
            self.base_pos_ms = self.base_pos_ms.saturating_add(now.saturating_sub(self.last_tick));
        }
        if duration > 0 { self.base_pos_ms = self.base_pos_ms.min(duration); }
        self.raw_pos_ms = raw;
        self.duration_ms = duration;
        self.timeline_at = timeline_at;
        self.last_tick = now;
        self.playing = playing;
        self.base_pos_ms
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn format_app_name(app_id: &str) -> String {
    if let Some(name)=crate::storage::load_json_file("media_names.json").and_then(|v|v[app_id].as_str().map(str::to_owned)) {return name;}
    let lower = app_id.to_lowercase();
    if lower.contains("yandex") {
        "Яндекс Музыка".to_string()
    } else if lower.contains("ayugram") {
        "Telegram (AyuGram)".to_string()
    } else if lower.contains("telegram") {
        "Telegram".to_string()
    } else if lower.contains("operagx") || lower.contains("opera gx") || lower.contains("operasoftware") {
        "Opera GX".to_string()
    } else if lower.contains("chrome") {
        "Google Chrome".to_string()
    } else if lower.contains("msedge") || lower.contains("edge") {
        "Microsoft Edge".to_string()
    } else if lower.contains("spotify") {
        "Spotify".to_string()
    } else if lower.contains("vk") {
        "VK Музыка".to_string()
    } else if lower.contains("aimp") {
        "AIMP".to_string()
    } else if lower.contains("foobar") {
        "Foobar2000".to_string()
    } else {
        let parts: Vec<&str> = app_id.split(['.', '\\', '/']).collect();
        for part in &parts {
            if !part.is_empty() && part.len() < 30 && !part.chars().all(|c| c.is_ascii_hexdigit()) {
                return part.to_string();
            }
        }
        app_id.to_string()
    }
}

pub fn get_manager() -> Option<GlobalSystemMediaTransportControlsSessionManager> {
    let _com = crate::audio::ComApartment::new().ok()?;
    match GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|operation|operation.get()) {
        Ok(manager) => Some(manager),
        Err(error) => { crate::app_log(&format!("GSMTC manager: {error}")); None },
    }
}

pub fn get_active_session(
    mgr: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let picked = PICKED_APP_ID.lock().ok().and_then(|p| p.clone());
    
    if let Ok(sessions) = mgr.GetSessions() {
        // 1. Prioritize user picked session
        if let Some(target) = picked {
            for session in &sessions {
                if session.SourceAppUserModelId().unwrap_or_default().to_string() == target {
                    return Some(session);
                }
            }
        }

        // 2. Default current session if Playing
        if let Ok(current) = mgr.GetCurrentSession() {
            if let Ok(playback) = current.GetPlaybackInfo() {
                if let Ok(status) = playback.PlaybackStatus() {
                    if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
                        return Some(current);
                    }
                }
            }
        }

        // 3. Find any session that is currently Playing
        for session in &sessions {
            if let Ok(playback) = session.GetPlaybackInfo() {
                if let Ok(status) = playback.PlaybackStatus() {
                    if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
                        return Some(session);
                    }
                }
            }
        }

        // 4. Fallback to default current session
        if let Ok(current) = mgr.GetCurrentSession() {
            return Some(current);
        }

        // 5. Fallback to first session with non-empty title
        for session in &sessions {
            if let Ok(prop_op) = session.TryGetMediaPropertiesAsync() {
                if let Ok(props) = prop_op.get() {
                    if let Ok(title) = props.Title() {
                        if !title.is_empty() {
                            return Some(session);
                        }
                    }
                }
            }
        }
    }

    None
}

/// Attempts to read the thumbnail image from GSMTC stream
fn read_stream_thumbnail(session: &GlobalSystemMediaTransportControlsSession) -> Option<String> {
    let prop_op = session.TryGetMediaPropertiesAsync().ok()?;
    let props = prop_op.get().ok()?;
    let thumb_ref = props.Thumbnail().ok()?;
    let stream_op = thumb_ref.OpenReadAsync().ok()?;
    let stream = stream_op.get().ok()?;
    let raw_size = stream.Size().ok()?;
    if raw_size == 0 || raw_size > 10 * 1024 * 1024 {
        return None;
    }
    let size = raw_size as u32;

    let input_stream = stream.GetInputStreamAt(0).ok()?;
    let reader = DataReader::CreateDataReader(&input_stream).ok()?;
    let load_op = reader.LoadAsync(size).ok()?;
    let loaded = load_op.get().ok()?;
    if loaded == 0 {
        return None;
    }

    let mut buf = vec![0u8; loaded as usize];
    reader.ReadBytes(&mut buf).ok()?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    let mime = stream.ContentType().ok().map(|s| s.to_string()).filter(|s|s.starts_with("image/")).unwrap_or_else(|| {
        if buf.starts_with(&[137,80,78,71]) {"image/png".into()} else {"image/jpeg".into()}
    });
    Some(format!("data:{};base64,{}", mime, b64))
}

/// Fallback online cover fetcher using iTunes Search API
async fn fetch_online_artwork(artist: &str, title: &str) -> Option<String> {
    let term = format!("{} {}", artist, title);
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&term)
    );

    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (Mozilla/5.0)")
        .timeout(std::time::Duration::from_millis(2000))
        .build()
        .ok()?;

    let resp = client.get(&url).send().await.ok()?;
    let data = resp.json::<Value>().await.ok()?;
    let results = data.get("results")?.as_array()?;
    if let Some(first) = results.first() {
        if let Some(art) = first.get("artworkUrl100").and_then(|v| v.as_str()) {
            // Replace with 600x600 for sharp Hi-Fi artwork
            let hd = art.replace("100x100bb", "600x600bb");
            return Some(hd);
        }
    }

    None
}

pub fn get_current_media() -> Option<Value> {
    let bridge=crate::music_bridge::current();
    let picked=PICKED_APP_ID.lock().unwrap().clone();
    let current=if bridge.is_some() && (picked.as_deref()==Some(crate::music_bridge::APP_ID) || (picked.is_none() && bridge.as_ref().map(|m|m["playing"]==true).unwrap_or(false))) {bridge} else {read_current_media().or(bridge)};
    if current.is_none(){
        *PLAYBACK_TRACKER.lock().unwrap()=None;
        *LAST_COVER_CACHE.lock().unwrap()=None;
    }
    current
}

fn read_current_media() -> Option<Value> {
    let _com = crate::audio::ComApartment::new().ok()?;
    let mgr = get_manager()?;
    let session = get_active_session(&mgr)?;
    
    let app_id = session.SourceAppUserModelId().unwrap_or_default().to_string();
    let app_name = format_app_name(&app_id);

    let prop_op = session.TryGetMediaPropertiesAsync().ok()?;
    let props = prop_op.get().ok()?;
    
    let title = props.Title().unwrap_or_default().to_string();
    if title.is_empty() {
        return None;
    }
    
    let artist = props.Artist().unwrap_or_default().to_string();
    let album = props.AlbumTitle().unwrap_or_default().to_string();

    let mut is_playing = false;
    if let Ok(playback) = session.GetPlaybackInfo() {
        if let Ok(status) = playback.PlaybackStatus() {
            is_playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        }
    }

    let mut raw_pos_ms: u64 = 0;
    let mut duration_ms: u64 = 0;
    let mut timeline_at = 0;
    if let Ok(timeline) = session.GetTimelineProperties() {
        raw_pos_ms = (timeline.Position().unwrap_or_default().Duration / 10000).max(0) as u64;
        duration_ms = (timeline.EndTime().unwrap_or_default().Duration / 10000).max(0) as u64;
        timeline_at = timeline.LastUpdatedTime().unwrap_or_default().UniversalTime;
    }

    let key = format!("{}|{}|{}|{}", app_id, artist, album, title);
    let now = now_ms();

    // Continuous time progression tracker
    let position_ms = {
        let mut tracker_guard = PLAYBACK_TRACKER.lock().unwrap();
        if tracker_guard.as_ref().map(|t|t.key.as_str()) != Some(&key) {
            *tracker_guard = Some(PlaybackProgress {
                key: key.clone(),
                base_pos_ms: raw_pos_ms,
                last_tick: now,
                duration_ms,
                playing: is_playing,
                raw_pos_ms,
                timeline_at,
            });
        }
        tracker_guard.as_mut()?.advance(raw_pos_ms,duration_ms,timeline_at,now,is_playing)
    };

    // Cover art retrieval with in-memory caching
    let mut cover_url = None;
    {
        let cache_guard = LAST_COVER_CACHE.lock().unwrap();
        if let Some((ref cached_key, ref cached_cover)) = *cache_guard {
            if cached_key == &key {
                cover_url = Some(cached_cover.clone());
            }
        }
    }

    if cover_url.is_none() {
        // Try reading local thumbnail from WinRT stream
        if let Some(stream_cover) = read_stream_thumbnail(&session) {
            let mut cache_guard = LAST_COVER_CACHE.lock().unwrap();
            *cache_guard = Some((key.clone(), stream_cover.clone()));
            cover_url = Some(stream_cover);
        }
    }

    let sources_count = mgr.GetSessions().map(|s| s.Size().unwrap_or(1)).unwrap_or(1);

    Some(json!({
        "key": key,
        "title": title,
        "artist": artist,
        "album": album,
        "app": app_id,
        "appName": app_name,
        "playing": is_playing,
        "positionMs": position_ms,
        "durationMs": duration_ms,
        "cover": cover_url,
        "updatedAt": now,
        "sources": sources_count
    }))
}

pub fn get_current_cover() -> Option<String> {
    if let Some(media)=get_current_media().filter(|m|m["app"]==crate::music_bridge::APP_ID) {return media["cover"].as_str().map(str::to_owned);}
    let current_key = PLAYBACK_TRACKER.lock().unwrap().as_ref().map(|t|t.key.clone());
    let cache_guard = LAST_COVER_CACHE.lock().unwrap();
    cache_guard.as_ref().filter(|(key,_)|current_key.as_ref()==Some(key)).map(|(_, c)| c.clone())
}

pub fn get_media_sources() -> Vec<Value> {
    let _com = match crate::audio::ComApartment::new() { Ok(c)=>c, Err(_)=>return vec![] };
    let mut result = Vec::new();
    if let Some(media)=crate::music_bridge::current() {
        let picked=PICKED_APP_ID.lock().unwrap().clone();
        result.push(json!({"id":crate::music_bridge::APP_ID,"name":format_app_name(crate::music_bridge::APP_ID),"title":media["title"],"playing":media["playing"],"active":picked.as_deref()==Some(crate::music_bridge::APP_ID)||(picked.is_none()&&media["playing"]==true)}));
    }
    let mgr = match get_manager() {
        Some(m) => m,
        None => return result,
    };

    let picked_id = PICKED_APP_ID.lock().ok().and_then(|p| p.clone());
    let current_id = mgr.GetCurrentSession().ok().and_then(|s| s.SourceAppUserModelId().ok()).map(|h| h.to_string());

    if let Ok(sessions) = mgr.GetSessions() {
        for session in sessions {
            let id = session.SourceAppUserModelId().unwrap_or_default().to_string();
            let name = format_app_name(&id);
            let mut title = String::new();
            if let Ok(prop_op) = session.TryGetMediaPropertiesAsync() {
                if let Ok(props) = prop_op.get() {
                    title = props.Title().unwrap_or_default().to_string();
                }
            }
            let mut is_playing = false;
            if let Ok(playback) = session.GetPlaybackInfo() {
                if let Ok(status) = playback.PlaybackStatus() {
                    is_playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
                }
            }

            let is_picked = picked_id.as_deref() == Some(&id);
            let is_current = current_id.as_deref() == Some(&id);

            result.push(json!({
                "id": id,
                "name": name,
                "title": title,
                "playing": is_playing,
                "active": is_picked || (picked_id.is_none() && is_current)
            }));
        }
    }

    result
}

pub fn set_picked_source(id: Option<String>) {
    if let Ok(mut lock) = PICKED_APP_ID.lock() {
        *lock = id;
    }
}

pub fn media_pick(id: &str) {
    set_picked_source(Some(id.to_string()));
}

pub fn media_seek(ms: u64) -> bool {
    media_seek_ms(ms)
}

pub fn media_control(action: &str) -> bool {
    if get_current_media().as_ref().map(|m|m["app"]==crate::music_bridge::APP_ID).unwrap_or(false) { return crate::music_bridge::control(action); }
    let _com = crate::audio::ComApartment::new().ok();
    if let Some(mgr) = get_manager() {
        if let Some(session) = get_active_session(&mgr) {
            let operation = match action {
                "play" => session.TryPlayAsync(),
                "pause" => session.TryPauseAsync(),
                "toggle" => session.TryTogglePlayPauseAsync(),
                "next" => session.TrySkipNextAsync(),
                "prev" => session.TrySkipPreviousAsync(),
                _ => return false,
            };
            if operation.and_then(|op|op.get()).unwrap_or(false) { return true; }
        }
    }
    match action {
        "toggle" => send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8),
        "next" => send_media_key(VK_MEDIA_NEXT_TRACK.0 as u8),
        "prev" => send_media_key(VK_MEDIA_PREV_TRACK.0 as u8),
        _ => return false,
    }
    true
}

pub fn change_volume(up: bool) {
    if up {
        volume_up();
    } else {
        volume_down();
    }
}

pub fn mute_volume() {
    volume_mute();
}

pub fn send_media_key(vk: u8) {
    if crate::win::WindowManager::passive_qa() { return; }
    unsafe {
        keybd_event(vk, 0, windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    }
}

pub fn media_play_pause() {
    let _com = crate::audio::ComApartment::new().ok();
    if let Some(mgr) = get_manager() {
        if let Some(session) = get_active_session(&mgr) {
            if session.TryTogglePlayPauseAsync().and_then(|op|op.get()).unwrap_or(false) {return;}
        }
    }
    send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8);
}

pub fn media_next() {
    let _com = crate::audio::ComApartment::new().ok();
    if let Some(mgr) = get_manager() {
        if let Some(session) = get_active_session(&mgr) {
            if session.TrySkipNextAsync().and_then(|op|op.get()).unwrap_or(false) {return;}
        }
    }
    send_media_key(VK_MEDIA_NEXT_TRACK.0 as u8);
}

pub fn media_prev() {
    let _com = crate::audio::ComApartment::new().ok();
    if let Some(mgr) = get_manager() {
        if let Some(session) = get_active_session(&mgr) {
            if session.TrySkipPreviousAsync().and_then(|op|op.get()).unwrap_or(false) {return;}
        }
    }
    send_media_key(VK_MEDIA_PREV_TRACK.0 as u8);
}

pub fn media_seek_ms(ms: u64) -> bool {
    if get_current_media().as_ref().map(|m|m["app"]==crate::music_bridge::APP_ID).unwrap_or(false) {return false;}
    let _com = crate::audio::ComApartment::new().ok();
    let mut changed = false;
    if let Some(mgr) = get_manager() {
        if let Some(session) = get_active_session(&mgr) {
            let duration_ticks = ms.min((i64::MAX / 10000) as u64) as i64 * 10000;
            changed = session.TryChangePlaybackPositionAsync(duration_ticks).and_then(|op|op.get()).unwrap_or(false);
        }
    }
    if !changed { return false; }
    if let Ok(mut tracker) = PLAYBACK_TRACKER.lock() {
        if let Some(ref mut trk) = *tracker {
            trk.base_pos_ms = ms;
            trk.last_tick = now_ms();
        }
    }
    true
}

pub fn volume_up() {
    send_media_key(VK_VOLUME_UP.0 as u8);
}

pub fn volume_down() {
    send_media_key(VK_VOLUME_DOWN.0 as u8);
}

pub fn volume_mute() {
    send_media_key(VK_VOLUME_MUTE.0 as u8);
}

/// Polls GSMTC and starts the measured WASAPI stream independently of media apps.
fn media_event_snapshot(current: &Option<Value>) -> Value {
    let mut value=current.clone().unwrap_or(Value::Null);
    if let Some(object)=value.as_object_mut() { object.remove("updatedAt"); }
    value
}

pub fn start_media_loop(app: tauri::AppHandle) {
    crate::music_bridge::start();
    crate::audio::start_loopback(app.clone());
    let app_clone = app.clone();
    
    // 1. GSMTC Media and Position Loop
    std::thread::spawn(move || {
        let _com = crate::audio::ComApartment::new().ok();
        let mut last_key = String::new();
        let mut last_playing = false;
        let mut last_cover = None;
        let mut last_payload = Value::Null;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(350));

            let current = get_current_media();
            let key = current.as_ref()
                .and_then(|v| v.get("key"))
                .and_then(|k| k.as_str())
                .unwrap_or("")
                .to_string();
            let is_playing = current.as_ref()
                .and_then(|v| v.get("playing"))
                .and_then(|p| p.as_bool())
                .unwrap_or(false);
            crate::audio::set_spectrum_playing(is_playing);

            let key_changed = key != last_key;
            let play_changed = is_playing != last_playing;
            let cover = current.as_ref().and_then(|m|m["cover"].as_str()).map(str::to_owned);
            if let Some(cover) = cover {
                let pair = (key.clone(),cover.clone());
                if last_cover.as_ref()!=Some(&pair) {
                    let _=app_clone.emit("media:cover",json!({"key":key,"cover":cover}));
                    last_cover=Some(pair);
                }
            } else if key_changed {last_cover=None;}

            // Trigger background online cover fetch if thumbnail missing
            if key_changed && !key.is_empty() {
                let cached_cover = LAST_COVER_CACHE.lock().unwrap().clone();
                let has_cover = current.as_ref().and_then(|m|m["cover"].as_str()).is_some() || cached_cover.as_ref().map(|(k, _)| k == &key).unwrap_or(false);
                if !has_cover {
                    if let Some(ref cur) = current {
                        let artist = cur.get("artist").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let title = cur.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let key_for_task = key.clone();
                        let app_for_task = app_clone.clone();

                        tauri::async_runtime::spawn(async move {
                            if let Some(artwork) = fetch_online_artwork(&artist, &title).await {
                                {
                                    let mut cache_guard = LAST_COVER_CACHE.lock().unwrap();
                                    if PLAYBACK_TRACKER.lock().unwrap().as_ref().map(|t| &t.key) == Some(&key_for_task) {
                                        *cache_guard = Some((key_for_task.clone(), artwork.clone()));
                                    }
                                }
                                let _ = app_for_task.emit("media:cover", json!({
                                    "key": key_for_task,
                                    "cover": artwork
                                }));
                            }
                        });
                    }
                }
            }

            let snapshot=media_event_snapshot(&current);
            if key_changed || play_changed || snapshot != last_payload {
                let payload = match current {
                    Some(ref v) => v.clone(),
                    None => Value::Null,
                };
                let _ = app_clone.emit("media:update", &payload);
                last_key = key;
                last_playing = is_playing;
                last_payload = snapshot;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn progress()->PlaybackProgress {PlaybackProgress{key:"track".into(),base_pos_ms:1000,last_tick:10000,duration_ms:100000,playing:true,raw_pos_ms:1000,timeline_at:1}}
    #[test] fn stale_timeline_does_not_rewind_every_three_seconds(){let mut p=progress();assert_eq!(p.advance(1000,100000,1,14000,true),5000);assert_eq!(p.advance(1000,100000,1,18000,true),9000);}
    #[test] fn seek_to_zero_and_pause_are_honored(){let mut p=progress();assert_eq!(p.advance(0,100000,2,11000,true),0);assert_eq!(p.advance(0,100000,2,12000,false),1000);assert_eq!(p.advance(0,100000,2,20000,false),1000);assert_eq!(p.advance(0,100000,2,30000,true),1000);assert_eq!(p.advance(0,100000,2,31000,true),2000);}
    #[test] fn paused_media_deduplicates_clock_but_preserves_seeks_and_metadata(){
        let a=Some(json!({"key":"a","positionMs":1000,"playing":false,"title":"Track","updatedAt":1}));
        let mut b=a.clone();b.as_mut().unwrap()["updatedAt"]=json!(2);assert_eq!(media_event_snapshot(&a),media_event_snapshot(&b));
        for (key,value) in [("positionMs",json!(0)),("title",json!("Corrected")),("playing",json!(true)),("cover",json!("new"))] {let mut changed=b.clone();changed.as_mut().unwrap()[key]=value;assert_ne!(media_event_snapshot(&a),media_event_snapshot(&changed));}
        assert_ne!(media_event_snapshot(&a),media_event_snapshot(&None));
    }
}
