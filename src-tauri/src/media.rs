pub mod legacy;
pub mod names;

use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Condvar, Mutex, OnceLock,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use serde_json::{json, Value};
use windows::Foundation::TypedEventHandler;
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
static HIDDEN_APP_IDS: Mutex<Vec<String>> = Mutex::new(Vec::new());
static LAST_COVER_CACHE: Mutex<Option<(String, String)>> = Mutex::new(None); // (key, cover_url)
static PLAYBACK_TRACKER: Mutex<Option<PlaybackProgress>> = Mutex::new(None);
static APP_NAME_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
static MEDIA_NAMES_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
static CACHED_MEDIA: Mutex<Option<Value>> = Mutex::new(None);
static MEDIA_LOOP_RUNNING: AtomicBool = AtomicBool::new(false);
static MEDIA_WAKE: OnceLock<(Mutex<bool>, Condvar)> = OnceLock::new();
static LAST_GSMTC_ERROR: Mutex<Option<(String, Instant)>> = Mutex::new(None);
static LEGACY_CACHE: Mutex<Option<(Instant, Vec<Value>)>> = Mutex::new(None);

fn wake_pair() -> &'static (Mutex<bool>, Condvar) {
    MEDIA_WAKE.get_or_init(|| (Mutex::new(true), Condvar::new()))
}

pub fn notify_wake() {
    let (lock, cvar) = wake_pair();
    if let Ok(mut dirty) = lock.lock() {
        *dirty = true;
        cvar.notify_all();
    }
}

pub fn invalidate_names_cache() {
    if let Ok(mut guard) = MEDIA_NAMES_CACHE.lock() {
        *guard = None;
    }
    notify_wake();
}

pub fn cached_media() -> Option<Value> {
    CACHED_MEDIA.lock().ok().and_then(|g| g.clone())
}

fn custom_media_name(app_id: &str) -> Option<String> {
    let mut guard = MEDIA_NAMES_CACHE.lock().ok()?;
    if guard.is_none() {
        let mut map = HashMap::new();
        if let Some(obj) = crate::storage::load_json_file("media_names.json").and_then(|v| v.as_object().cloned()) {
            for (k, v) in obj {
                if let Some(s) = v.as_str() {
                    map.insert(k, s.to_owned());
                }
            }
        }
        *guard = Some(map);
    }
    guard.as_ref().and_then(|m| m.get(app_id).cloned())
}

fn log_gsmtc_error_throttled(error: &str) {
    let now = Instant::now();
    let should_log = if let Ok(mut guard) = LAST_GSMTC_ERROR.lock() {
        let repeat = guard
            .as_ref()
            .is_some_and(|(prev, at)| prev == error && now.duration_since(*at) < Duration::from_secs(60));
        if repeat {
            false
        } else {
            *guard = Some((error.to_owned(), now));
            true
        }
    } else {
        true
    };
    if should_log {
        crate::app_log(&format!("GSMTC manager: {error}"));
    }
}

fn cached_legacy_snapshots(force: bool) -> Vec<Value> {
    let now = Instant::now();
    if !force {
        if let Ok(guard) = LEGACY_CACHE.lock() {
            if let Some((at, ref cached)) = *guard {
                let ttl = if cached.is_empty() {
                    if crate::is_low_power() { Duration::from_secs(6) } else { Duration::from_secs(3) }
                } else {
                    Duration::from_millis(900)
                };
                if now.duration_since(at) < ttl {
                    return cached.clone();
                }
            }
        }
    }
    let fresh = legacy::snapshots();
    if let Ok(mut guard) = LEGACY_CACHE.lock() {
        *guard = Some((now, fresh.clone()));
    }
    fresh
}

fn cached_registered_app_name(app_id: &str) -> Option<String> {
    if app_id.is_empty() || app_id.starts_with("woods.") {
        return None;
    }
    let cache = APP_NAME_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(found) = cache.lock().unwrap().get(app_id).cloned() {
        return found;
    }
    let _com = crate::audio::ComApartment::new().ok();
    let resolved = names::registered_app_name(app_id);
    let mut guard = cache.lock().unwrap();
    if guard.len() >= 128 {
        guard.clear();
    }
    guard.insert(app_id.to_owned(), resolved.clone());
    resolved
}

pub fn configure(settings: &Value) {
    let hidden: Vec<String> = settings["mediaHidden"].as_array().into_iter().flatten()
        .filter_map(Value::as_str).filter(|id| !id.is_empty()).map(str::to_owned).collect();
    let mut picked = PICKED_APP_ID.lock().unwrap();
    if picked.as_ref().is_some_and(|id| hidden.iter().any(|h| h.eq_ignore_ascii_case(id))) {
        *picked = None;
    }
    *HIDDEN_APP_IDS.lock().unwrap() = hidden;
    notify_wake();
}

fn is_hidden(id: &str) -> bool {
    HIDDEN_APP_IDS.lock().unwrap().iter().any(|hidden| hidden.eq_ignore_ascii_case(id))
}

fn session_visible(session: &GlobalSystemMediaTransportControlsSession) -> bool {
    session.SourceAppUserModelId().ok().is_some_and(|id| !is_hidden(&id.to_string()))
}

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
    if let Some(name) = custom_media_name(app_id) { return name; }
    if let Some(kind) = legacy::LegacyKind::from_id(app_id) {
        return kind.name().to_string();
    }
    if names::firefox_app_id(app_id) {
        return "Firefox".to_string();
    }
    let lower = app_id.to_lowercase();
    if lower.contains("yandex") {
        "Яндекс Музыка".to_string()
    } else if lower.contains("ayugram") {
        "Telegram (AyuGram)".to_string()
    } else if lower.contains("vk") {
        "VK Музыка".to_string()
    } else if let Some(registered) = cached_registered_app_name(app_id) {
        registered
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
    } else if lower.contains("aimp") {
        "AIMP".to_string()
    } else if lower.contains("winamp") {
        "Winamp".to_string()
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

fn request_manager_no_com() -> Option<GlobalSystemMediaTransportControlsSessionManager> {
    match GlobalSystemMediaTransportControlsSessionManager::RequestAsync().and_then(|operation| operation.get()) {
        Ok(manager) => Some(manager),
        Err(error) => {
            log_gsmtc_error_throttled(&error.to_string());
            None
        }
    }
}

pub fn get_manager() -> Option<GlobalSystemMediaTransportControlsSessionManager> {
    let _com = crate::audio::ComApartment::new().ok()?;
    request_manager_no_com()
}

pub fn get_active_session(
    mgr: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let picked = PICKED_APP_ID.lock().ok().and_then(|p| p.clone());
    
    if let Ok(all) = mgr.GetSessions() {
        let sessions: Vec<_> = all.into_iter().filter(session_visible).collect();
        // 1. Prioritize user picked session
        if let Some(target) = picked {
            for session in sessions.iter().cloned() {
                if session.SourceAppUserModelId().unwrap_or_default().to_string() == target {
                    return Some(session);
                }
            }
        }

        // 2. Default current session if Playing
        if let Some(current) = mgr.GetCurrentSession().ok().filter(session_visible) {
            if let Ok(playback) = current.GetPlaybackInfo() {
                if let Ok(status) = playback.PlaybackStatus() {
                    if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
                        return Some(current);
                    }
                }
            }
        }

        // 3. Find any session that is currently Playing
        for session in sessions.iter().cloned() {
            if let Ok(playback) = session.GetPlaybackInfo() {
                if let Ok(status) = playback.PlaybackStatus() {
                    if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
                        return Some(session);
                    }
                }
            }
        }

        // 4. Fallback to default current session
        if let Some(current) = mgr.GetCurrentSession().ok().filter(session_visible) {
            return Some(current);
        }

        // 5. Fallback to first session with non-empty title
        for session in sessions.iter().cloned() {
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

/// Attempts to read the thumbnail image from already-fetched GSMTC properties
fn read_stream_thumbnail_from_props(
    props: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Option<String> {
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

fn advance_cached_media_position() -> Option<Value> {
    let mut cached = CACHED_MEDIA.lock().ok()?.clone()?;
    if cached["playing"] != true {
        return Some(cached);
    }
    let key = cached["key"].as_str().unwrap_or_default();
    let now = now_ms();
    if let Ok(mut tracker_guard) = PLAYBACK_TRACKER.lock() {
        if let Some(ref mut trk) = *tracker_guard {
            if trk.key == key && trk.playing {
                let delta = now.saturating_sub(trk.last_tick);
                let mut pos = trk.base_pos_ms.saturating_add(delta);
                if trk.duration_ms > 0 {
                    pos = pos.min(trk.duration_ms);
                }
                trk.base_pos_ms = pos;
                trk.last_tick = now;
                cached["positionMs"] = json!(pos);
                cached["updatedAt"] = json!(now);
            }
        }
    }
    if let Ok(mut guard) = CACHED_MEDIA.lock() {
        *guard = Some(cached.clone());
    }
    Some(cached)
}

pub fn get_current_media() -> Option<Value> {
    if MEDIA_LOOP_RUNNING.load(Ordering::Acquire) {
        return advance_cached_media_position();
    }
    let mgr = get_manager();
    poll_current_media_with_manager(mgr.as_ref(), true).0
}

fn poll_current_media_with_manager(
    mgr: Option<&GlobalSystemMediaTransportControlsSessionManager>,
    force_legacy: bool,
) -> (Option<Value>, Option<GlobalSystemMediaTransportControlsSession>, bool) {
    let bridge = crate::music_bridge::current().filter(|_| !is_hidden(crate::music_bridge::APP_ID));
    let legacy_visible: Vec<Value> = cached_legacy_snapshots(force_legacy)
        .into_iter()
        .filter(|m| m["app"].as_str().is_some_and(|id| !is_hidden(id)))
        .map(|mut m| {
            if let Some(id) = m["app"].as_str().map(str::to_owned) {
                m["appName"] = json!(format_app_name(&id));
            }
            m
        })
        .collect();
    let picked = PICKED_APP_ID.lock().unwrap().clone();
    let mut rpc_ok = true;
    let mut active_session: Option<GlobalSystemMediaTransportControlsSession> = None;
    let mut current = if let Some(ref picked_id) = picked {
        if picked_id == crate::music_bridge::APP_ID {
            bridge.clone()
        } else if let Some(found) = legacy_visible.iter().find(|m| m["app"].as_str() == Some(picked_id.as_str())) {
            Some(found.clone())
        } else {
            let (val, sess, ok) = read_current_media_from_manager(mgr);
            rpc_ok = ok;
            active_session = sess;
            val
        }
    } else {
        None
    };
    if current.is_none() {
        let (gsmtc, sess, ok) = read_current_media_from_manager(mgr);
        rpc_ok = ok;
        active_session = sess;
        let legacy_playing = legacy_visible.iter().find(|m| m["playing"] == true).cloned();
        let legacy_any = legacy_visible.first().cloned();
        current = if bridge.as_ref().is_some_and(|m| m["playing"] == true) {
            bridge
        } else if gsmtc.as_ref().is_some_and(|m| m["playing"] == true) {
            gsmtc
        } else if legacy_playing.is_some() {
            legacy_playing
        } else {
            gsmtc.or(bridge).or(legacy_any)
        };
    }
    if let Some(ref mut media) = current {
        let extra = usize::from(crate::music_bridge::current().is_some()) + legacy_visible.len();
        let existing = media["sources"].as_u64().unwrap_or(1) as usize;
        if existing < extra.max(1) {
            media["sources"] = json!(extra.max(1));
        }
    } else {
        *PLAYBACK_TRACKER.lock().unwrap() = None;
        *LAST_COVER_CACHE.lock().unwrap() = None;
    }
    (current, active_session, rpc_ok)
}

fn read_current_media_from_manager(
    mgr: Option<&GlobalSystemMediaTransportControlsSessionManager>,
) -> (Option<Value>, Option<GlobalSystemMediaTransportControlsSession>, bool) {
    let Some(mgr) = mgr else { return (None, None, false); };
    let Ok(all_sessions) = mgr.GetSessions() else {
        return (None, None, false);
    };
    let sources_count = all_sessions.Size().unwrap_or(1);
    let Some(session) = get_active_session(mgr) else {
        return (None, None, true);
    };

    let app_id = session.SourceAppUserModelId().unwrap_or_default().to_string();
    let app_name = format_app_name(&app_id);

    let Ok(prop_op) = session.TryGetMediaPropertiesAsync() else {
        return (None, Some(session), true);
    };
    let Ok(props) = prop_op.get() else {
        return (None, Some(session), true);
    };

    let title = props.Title().unwrap_or_default().to_string();
    if title.is_empty() {
        return (None, Some(session), true);
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
        if tracker_guard.as_ref().map(|t| t.key.as_str()) != Some(&key) {
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
        match tracker_guard.as_mut() {
            Some(t) => t.advance(raw_pos_ms, duration_ms, timeline_at, now, is_playing),
            None => raw_pos_ms,
        }
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
        // Try reading local thumbnail from WinRT stream (reuse already-fetched props!)
        if let Some(stream_cover) = read_stream_thumbnail_from_props(&props) {
            let mut cache_guard = LAST_COVER_CACHE.lock().unwrap();
            *cache_guard = Some((key.clone(), stream_cover.clone()));
            cover_url = Some(stream_cover);
        }
    }

    (
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
        })),
        Some(session),
        true,
    )
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
    let shown_id = get_current_media().and_then(|media| media["app"].as_str().map(str::to_owned));
    if let Some(media)=crate::music_bridge::current() {
        result.push(json!({"id":crate::music_bridge::APP_ID,"name":format_app_name(crate::music_bridge::APP_ID),"title":media["title"],"playing":media["playing"],"hidden":is_hidden(crate::music_bridge::APP_ID),"active":shown_id.as_deref()==Some(crate::music_bridge::APP_ID)}));
    }
    for media in legacy::snapshots() {
        if let Some(id) = media["app"].as_str() {
            result.push(json!({
                "id": id,
                "name": format_app_name(id),
                "title": media["title"],
                "playing": media["playing"],
                "hidden": is_hidden(id),
                "active": shown_id.as_deref() == Some(id)
            }));
        }
    }
    let mgr = match get_manager() {
        Some(m) => m,
        None => return result,
    };

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

            result.push(json!({
                "id": id,
                "name": name,
                "title": title,
                "playing": is_playing,
                "hidden": is_hidden(&id),
                "active": shown_id.as_deref() == Some(&id)
            }));
        }
    }

    result
}

pub fn set_picked_source(id: Option<String>) {
    if let Ok(mut lock) = PICKED_APP_ID.lock() {
        *lock = id;
    }
    notify_wake();
}

pub fn media_pick(id: &str) {
    set_picked_source(Some(id.to_string()));
}

pub fn media_seek(ms: u64) -> bool {
    media_seek_ms(ms)
}

pub fn media_control(action: &str) -> bool {
    if let Some(current) = get_current_media() {
        if let Some(app_id) = current["app"].as_str() {
            if app_id == crate::music_bridge::APP_ID {
                return crate::music_bridge::control(action);
            }
            if legacy::LegacyKind::from_id(app_id).is_some() {
                return legacy::control(app_id, action).is_ok();
            }
        }
    }
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
            if operation.and_then(|op|op.get()).unwrap_or(false) { notify_wake(); return true; }
        }
    }
    match action {
        "toggle" => send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8),
        "next" => send_media_key(VK_MEDIA_NEXT_TRACK.0 as u8),
        "prev" => send_media_key(VK_MEDIA_PREV_TRACK.0 as u8),
        _ => return false,
    }
    notify_wake();
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
    if let Some(current) = get_current_media() {
        if let Some(app_id) = current["app"].as_str() {
            if app_id == crate::music_bridge::APP_ID {
                return false;
            }
            if legacy::LegacyKind::from_id(app_id).is_some() {
                return legacy::seek(app_id, ms).is_ok();
            }
        }
    }
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
    notify_wake();
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

struct ManagerBinding {
    mgr: GlobalSystemMediaTransportControlsSessionManager,
    sessions_token: Option<windows::Foundation::EventRegistrationToken>,
    current_token: Option<windows::Foundation::EventRegistrationToken>,
}

impl ManagerBinding {
    fn connect() -> Option<Self> {
        let mgr = request_manager_no_com()?;
        let sessions_token = mgr
            .SessionsChanged(&TypedEventHandler::new(|_, _| {
                notify_wake();
                Ok(())
            }))
            .ok();
        let current_token = mgr
            .CurrentSessionChanged(&TypedEventHandler::new(|_, _| {
                notify_wake();
                Ok(())
            }))
            .ok();
        Some(Self {
            mgr,
            sessions_token,
            current_token,
        })
    }
}

impl Drop for ManagerBinding {
    fn drop(&mut self) {
        if let Some(t) = self.sessions_token.take() {
            let _ = self.mgr.RemoveSessionsChanged(t);
        }
        if let Some(t) = self.current_token.take() {
            let _ = self.mgr.RemoveCurrentSessionChanged(t);
        }
    }
}

struct SessionBinding {
    session: GlobalSystemMediaTransportControlsSession,
    app_id: String,
    media_token: Option<windows::Foundation::EventRegistrationToken>,
    playback_token: Option<windows::Foundation::EventRegistrationToken>,
    timeline_token: Option<windows::Foundation::EventRegistrationToken>,
}

impl SessionBinding {
    fn bind(session: GlobalSystemMediaTransportControlsSession, app_id: String) -> Self {
        let media_token = session
            .MediaPropertiesChanged(&TypedEventHandler::new(|_, _| {
                notify_wake();
                Ok(())
            }))
            .ok();
        let playback_token = session
            .PlaybackInfoChanged(&TypedEventHandler::new(|_, _| {
                notify_wake();
                Ok(())
            }))
            .ok();
        let timeline_token = session
            .TimelinePropertiesChanged(&TypedEventHandler::new(|_, _| {
                notify_wake();
                Ok(())
            }))
            .ok();
        Self {
            session,
            app_id,
            media_token,
            playback_token,
            timeline_token,
        }
    }
}

impl Drop for SessionBinding {
    fn drop(&mut self) {
        if let Some(t) = self.media_token.take() {
            let _ = self.session.RemoveMediaPropertiesChanged(t);
        }
        if let Some(t) = self.playback_token.take() {
            let _ = self.session.RemovePlaybackInfoChanged(t);
        }
        if let Some(t) = self.timeline_token.take() {
            let _ = self.session.RemoveTimelinePropertiesChanged(t);
        }
    }
}

pub fn start_media_loop(app: tauri::AppHandle) {
    crate::music_bridge::start();
    crate::audio::start_loopback(app.clone());
    let app_clone = app.clone();

    // 1. Event-driven GSMTC Media and Position Loop (zero 350ms RequestAsync polling!)
    let _ = std::thread::Builder::new()
        .name("woods-media-loop".into())
        .spawn(move || {
            let _com = crate::audio::ComApartment::new().ok();
            MEDIA_LOOP_RUNNING.store(true, Ordering::Release);

            let mut manager_binding: Option<ManagerBinding> = None;
            let mut session_binding: Option<SessionBinding> = None;
            let mut next_manager_retry = Instant::now();
            let mut last_full_poll = Instant::now() - Duration::from_secs(60);

            let mut last_key = String::new();
            let mut last_playing = false;
            let mut last_cover = None;
            let mut last_payload = Value::Null;

            loop {
                let low_power = crate::is_low_power();
                let (lock, cvar) = wake_pair();
                let woken_by_event = {
                    let mut dirty = lock.lock().unwrap_or_else(|e| e.into_inner());
                    if *dirty {
                        *dirty = false;
                        true
                    } else {
                        let wait = if low_power {
                            Duration::from_secs(5)
                        } else if last_playing {
                            Duration::from_millis(950)
                        } else {
                            Duration::from_secs(4)
                        };
                        let (mut guard, _) = cvar
                            .wait_timeout(dirty, wait)
                            .unwrap_or_else(|e| e.into_inner());
                        let was_dirty = *guard;
                        *guard = false;
                        was_dirty
                    }
                };

                let low_power = crate::is_low_power();
                let safety_interval = if low_power {
                    Duration::from_secs(10)
                } else if last_playing {
                    Duration::from_secs(4)
                } else {
                    Duration::from_secs(6)
                };
                let need_full_poll = woken_by_event
                    || last_full_poll.elapsed() >= safety_interval
                    || (manager_binding.is_none() && Instant::now() >= next_manager_retry);

                let current = if need_full_poll {
                    if manager_binding.is_none() && Instant::now() >= next_manager_retry {
                        manager_binding = ManagerBinding::connect();
                        if manager_binding.is_none() {
                            next_manager_retry = Instant::now() + Duration::from_secs(5);
                        }
                    }

                    let (polled, active_session, rpc_ok) = poll_current_media_with_manager(
                        manager_binding.as_ref().map(|b| &b.mgr),
                        woken_by_event,
                    );
                    last_full_poll = Instant::now();

                    if !rpc_ok && manager_binding.is_some() {
                        session_binding = None;
                        manager_binding = None;
                        next_manager_retry = Instant::now() + Duration::from_secs(5);
                    } else {
                        match active_session {
                            Some(sess) => {
                                let app_id = sess.SourceAppUserModelId().unwrap_or_default().to_string();
                                let same = session_binding
                                    .as_ref()
                                    .is_some_and(|b| b.app_id == app_id);
                                if !same {
                                    session_binding = Some(SessionBinding::bind(sess, app_id));
                                }
                            }
                            None => {
                                session_binding = None;
                            }
                        }
                    }

                    if let Ok(mut guard) = CACHED_MEDIA.lock() {
                        *guard = polled.clone();
                    }
                    polled
                } else if last_playing {
                    // Pure in-memory progress tick: zero WinRT/NPSMSvc RPC!
                    advance_cached_media_position()
                } else {
                    cached_media()
                };

                let key = current
                    .as_ref()
                    .and_then(|v| v.get("key"))
                    .and_then(|k| k.as_str())
                    .unwrap_or("")
                    .to_string();
                let is_playing = current
                    .as_ref()
                    .and_then(|v| v.get("playing"))
                    .and_then(|p| p.as_bool())
                    .unwrap_or(false);
                crate::audio::set_spectrum_playing(is_playing);

                let key_changed = key != last_key;
                let play_changed = is_playing != last_playing;
                let cover = current
                    .as_ref()
                    .and_then(|m| m["cover"].as_str())
                    .map(str::to_owned);
                if let Some(cover) = cover {
                    let pair = (key.clone(), cover.clone());
                    if last_cover.as_ref() != Some(&pair) {
                        let _ = app_clone.emit("media:cover", json!({"key": key, "cover": cover}));
                        last_cover = Some(pair);
                    }
                } else if key_changed {
                    last_cover = None;
                }

                // Trigger background online cover fetch if thumbnail missing
                if key_changed && !key.is_empty() {
                    let cached_cover = LAST_COVER_CACHE.lock().unwrap().clone();
                    let has_cover = current.as_ref().and_then(|m| m["cover"].as_str()).is_some()
                        || cached_cover.as_ref().map(|(k, _)| k == &key).unwrap_or(false);
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
                                    let _ = app_for_task.emit(
                                        "media:cover",
                                        json!({
                                            "key": key_for_task,
                                            "cover": artwork
                                        }),
                                    );
                                }
                            });
                        }
                    }
                }

                // When pill is hidden in a fullscreen game, only emit real track/play-state changes
                // (skip pure positionMs ticks so WebView2 never wakes up unnecessarily during games).
                let snapshot = media_event_snapshot(&current);
                let should_emit = if low_power {
                    key_changed || play_changed
                } else {
                    key_changed || play_changed || snapshot != last_payload
                };
                if should_emit {
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
