pub mod browser_fallback;
pub mod legacy;
pub mod names;
mod cover_retry;

use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Condvar, Mutex, OnceLock,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use serde_json::{json, Value};
use windows::core::Interface;
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
static BROWSER_CACHE: Mutex<Option<(Instant, Vec<Value>)>> = Mutex::new(None);

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

fn cached_browser_snapshots(force: bool, gsmtc_active_apps: &[String]) -> Vec<Value> {
    let now = Instant::now();
    if !force {
        if let Ok(guard) = BROWSER_CACHE.lock() {
            if let Some((at, ref cached)) = *guard {
                let ttl = if cached.is_empty() {
                    if crate::is_low_power() { Duration::from_secs(5) } else { Duration::from_millis(1800) }
                } else {
                    Duration::from_millis(900)
                };
                if now.duration_since(at) < ttl {
                    return cached.clone();
                }
            }
        }
    }
    let fresh = browser_fallback::snapshots(gsmtc_active_apps);
    if let Ok(mut guard) = BROWSER_CACHE.lock() {
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
    if let Some(kind) = browser_fallback::BrowserKind::from_id(app_id) {
        return kind.name().to_string();
    }
    if names::firefox_app_id(app_id) {
        return "Firefox".to_string();
    }
    let lower = app_id.to_lowercase();
    if lower.contains("yandex") {
        // Distinguish Yandex Browser (e.g. `Yandex.OWPTABZ5EHFIKZ6HFNJOEQW6JI`, `YandexBrowser`)
        // from the dedicated Yandex Music desktop app (`ru.yandex.desktop.music`, `yandex.music`).
        if lower.contains("music") {
            "Яндекс Музыка".to_string()
        } else if lower.contains("browser")
            || lower.starts_with("yandex.")
            || lower.ends_with("browser.exe")
        {
            "Яндекс Браузер".to_string()
        } else {
            cached_registered_app_name(app_id).unwrap_or_else(|| "Яндекс Музыка".to_string())
        }
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

fn session_is_playing(session: &GlobalSystemMediaTransportControlsSession) -> bool {
    session
        .GetPlaybackInfo()
        .ok()
        .and_then(|p| p.PlaybackStatus().ok())
        .is_some_and(|s| s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
}

fn session_has_title(session: &GlobalSystemMediaTransportControlsSession) -> bool {
    session
        .TryGetMediaPropertiesAsync()
        .ok()
        .and_then(|op| op.get().ok())
        .and_then(|props| props.Title().ok())
        .is_some_and(|t| !t.to_string().trim().is_empty())
}

pub fn get_active_session(
    mgr: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    let picked = PICKED_APP_ID.lock().ok().and_then(|p| p.clone());

    if let Ok(all) = mgr.GetSessions() {
        let sessions: Vec<_> = all.into_iter().filter(session_visible).collect();
        // 1. Prioritize user picked session (prefer one with a non-empty title when the browser has multiple)
        if let Some(target) = picked {
            let matching: Vec<_> = sessions
                .iter()
                .filter(|s| s.SourceAppUserModelId().unwrap_or_default().to_string() == target)
                .cloned()
                .collect();
            if let Some(s) = matching.iter().find(|s| session_is_playing(s) && session_has_title(s)) {
                return Some(s.clone());
            }
            if let Some(s) = matching.iter().find(|s| session_has_title(s)) {
                return Some(s.clone());
            }
            if let Some(s) = matching.into_iter().next() {
                return Some(s);
            }
        }

        let current = mgr.GetCurrentSession().ok().filter(session_visible);

        // 2. Default current session if Playing AND has a non-empty title
        if let Some(ref cur) = current {
            if session_is_playing(cur) && session_has_title(cur) {
                return Some(cur.clone());
            }
        }

        // 3. Any visible Playing session with a non-empty title (skips empty browser/Alice ghost sessions)
        for session in &sessions {
            if session_is_playing(session) && session_has_title(session) {
                return Some(session.clone());
            }
        }

        // 4. Default current session with a non-empty title (paused)
        if let Some(ref cur) = current {
            if session_has_title(cur) {
                return Some(cur.clone());
            }
        }

        // 5. Any visible session with a non-empty title
        for session in &sessions {
            if session_has_title(session) {
                return Some(session.clone());
            }
        }

        // 6. Keep a handle to a playing/current session solely for event subscription
        if let Some(session) = sessions.iter().find(|s| session_is_playing(s)) {
            return Some(session.clone());
        }
        if let Some(cur) = current {
            return Some(cur);
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

    decode_artwork(&buf)
}

fn decode_artwork(bytes:&[u8])->Option<String> {
    if bytes.is_empty()||bytes.len()>10*1024*1024{return None;}
    let mut reader=image::ImageReader::new(std::io::Cursor::new(bytes)).with_guessed_format().ok()?;
    let mut limits=image::Limits::default();limits.max_image_width=Some(4096);limits.max_image_height=Some(4096);limits.max_alloc=Some(64*1024*1024);reader.limits(limits);
    let image=reader.decode().ok()?.thumbnail(256,256).into_rgba8();
    crate::capture::data_url(&image).ok()
}

static ARTWORK_FAILURES:Mutex<(String,u8)>=Mutex::new((String::new(),0));
pub async fn recover_cover(app:&tauri::AppHandle,key:String,failed_cover:String)->bool {
    let current=cached_media();
    if !current.as_ref().is_some_and(|media|media["key"]==key&&media["cover"]==failed_cover){return false;}
    {
        let mut failures=ARTWORK_FAILURES.lock().unwrap();
        if failures.0!=key{*failures=(key.clone(),0);}
        if failures.1>=2{return false;}failures.1+=1;
    }
    let artwork=async {
        let url=reqwest::Url::parse(&failed_cover).ok()?;
        if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return None;}
        let client=reqwest::Client::builder().timeout(Duration::from_secs(3)).build().ok()?;
        let mut response=client.get(url).send().await.ok()?.error_for_status().ok()?;
        if response.content_length().is_some_and(|size|size>10*1024*1024){return None;}
        let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.ok()? {if bytes.len()+chunk.len()>10*1024*1024{return None;}bytes.extend_from_slice(&chunk);}
        tauri::async_runtime::spawn_blocking(move||decode_artwork(&bytes)).await.ok()?
    }.await;
    let mut media=CACHED_MEDIA.lock().unwrap();
    let Some(current)=media.as_mut().filter(|media|media["key"]==key&&media["cover"]==failed_cover)else{return false;};
    let mut cache=LAST_COVER_CACHE.lock().unwrap();
    if let Some(artwork)=artwork {
        current["cover"]=json!(artwork);*cache=Some((key.clone(),artwork.clone()));
        drop(cache);drop(media);let _=app.emit("media:cover",json!({"key":key,"cover":artwork}));true
    }else {
        current["cover"]=Value::Null;
        if cache.as_ref().is_some_and(|(cached_key,_)|cached_key==&key){*cache=None;}
        drop(cache);drop(media);notify_wake();false
    }
}

/// Fallback online cover fetcher using iTunes Search API
fn matching_online_artwork(data: &Value, artist: &str, title: &str, duration_ms: u64) -> Option<String> {
    let normalize = |text: &str| text.chars().filter(|ch| ch.is_alphanumeric()).flat_map(char::to_lowercase).collect::<String>();
    let artist = normalize(artist);
    let title = normalize(title);
    if artist.is_empty() || title.is_empty() { return None; }
    data.get("results")?.as_array()?.iter().find_map(|song| {
        if normalize(song["artistName"].as_str()?) != artist || normalize(song["trackName"].as_str()?) != title { return None; }
        if duration_ms > 0 && song["trackTimeMillis"].as_u64().is_none_or(|duration| duration.abs_diff(duration_ms) > 3000) { return None; }
        let artwork = song["artworkUrl100"].as_str()?;
        let url = reqwest::Url::parse(artwork).ok()?;
        if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() { return None; }
        Some(artwork.replace("100x100bb", "600x600bb"))
    })
}

async fn fetch_online_artwork(artist: &str, title: &str, duration_ms: u64) -> Option<String> {
    // Synthetic native fixtures must not search public catalogs for made-up tracks.
    if crate::win::WindowManager::passive_qa() { return None; }
    let term = format!("{} {}", artist, title);
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=5",
        urlencoding::encode(&term)
    );

    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (Mozilla/5.0)")
        .timeout(std::time::Duration::from_millis(2000))
        .build()
        .ok()?;

    let resp = client.get(&url).send().await.ok()?.error_for_status().ok()?;
    let data = resp.json::<Value>().await.ok()?;
    matching_online_artwork(&data, artist, title, duration_ms)
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
    let mut bridge = crate::music_bridge::current().filter(|_| !is_hidden(crate::music_bridge::APP_ID));
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
        } else if browser_fallback::is_browser_id(picked_id) {
            cached_browser_snapshots(force_legacy, &[])
                .into_iter()
                .find(|m| m["app"].as_str() == Some(picked_id.as_str()))
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
        if let (Some(bridge),Some(native))=(bridge.as_mut(),gsmtc.as_ref()) {
            merge_matching_cover(bridge,native);
        }
        let legacy_playing = legacy_visible.iter().find(|m| m["playing"] == true).cloned();
        let legacy_any = legacy_visible.first().cloned();
        let gsmtc_playing = gsmtc.as_ref().is_some_and(|m| m["playing"] == true);
        let bridge_playing = bridge.as_ref().is_some_and(|m| m["playing"] == true);
        // Only query Core Audio browser fallback when neither GSMTC nor bridge is already playing,
        // or when explicitly picking a browser fallback source.
        let gsmtc_apps: Vec<String> = gsmtc
            .as_ref()
            .and_then(|m| m["app"].as_str())
            .map(|id| vec![id.to_owned()])
            .unwrap_or_default();
        let browser_visible: Vec<Value> = if !gsmtc_playing && !bridge_playing {
            cached_browser_snapshots(force_legacy, &gsmtc_apps)
                .into_iter()
                .filter(|m| m["app"].as_str().is_some_and(|id| !is_hidden(id)))
                .map(|mut m| {
                    if let Some(id) = m["app"].as_str().map(str::to_owned) {
                        m["appName"] = json!(format_app_name(&id));
                    }
                    m
                })
                .collect()
        } else {
            Vec::new()
        };
        let browser_playing = browser_visible.iter().find(|m| m["playing"] == true).cloned();
        let browser_any = browser_visible.first().cloned();
        current = if bridge_playing {
            bridge
        } else if gsmtc_playing {
            gsmtc
        } else if legacy_playing.is_some() {
            legacy_playing
        } else if browser_playing.is_some() {
            browser_playing
        } else {
            gsmtc.or(bridge).or(legacy_any).or(browser_any)
        };
    }
    if current.as_ref().is_some_and(|media|media["app"]==crate::music_bridge::APP_ID&&media["cover"].is_null())&&active_session.is_none() {
        let (native,session,ok)=read_current_media_from_manager(mgr);rpc_ok&=ok;active_session=session;
        if let (Some(media),Some(native))=(current.as_mut(),native.as_ref()){merge_matching_cover(media,native);}
    }
    if let Some(ref mut media) = current {
        if media["cover"].as_str().is_none() {
            if let Some((key,cover))=LAST_COVER_CACHE.lock().unwrap().as_ref().filter(|(key,_)|media["key"]==*key) {
                let _=key;media["cover"]=json!(cover);
            }
        }
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

fn merge_matching_cover(target:&mut Value,source:&Value) {
    let normalized=|value:&Value|value.as_str().unwrap_or("").split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
    let title=normalized(&target["title"]);
    let artist=normalized(&target["artist"]);
    let duration_matches=match(target["durationMs"].as_u64(),source["durationMs"].as_u64()){
        (Some(a),Some(b))if a>0&&b>0=>a.abs_diff(b)<=5000,_=>true,
    };
    if target["cover"].as_str().is_none()&&!title.is_empty()&&!artist.is_empty()
        &&title==normalized(&source["title"])&&artist==normalized(&source["artist"])&&duration_matches
        &&source["cover"].as_str().is_some() {target["cover"]=source["cover"].clone();}
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
    let mut can_seek = false;
    if let Ok(playback) = session.GetPlaybackInfo() {
        can_seek = playback.Controls().and_then(|controls| controls.IsPlaybackPositionEnabled()).unwrap_or(false);
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
            "canSeek": can_seek,
            "cover": cover_url,
            "updatedAt": now,
            "sources": sources_count
        })),
        Some(session),
        true,
    )
}

pub fn get_current_cover() -> Option<String> {
    let current=get_current_media()?;
    if let Some(cover)=current["cover"].as_str(){return Some(cover.to_owned());}
    let current_key = current["key"].as_str();
    let cache_guard = LAST_COVER_CACHE.lock().unwrap();
    cache_guard.as_ref().filter(|(key,_)|current_key==Some(key.as_str())).map(|(_, c)| c.clone())
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
    let mut gsmtc_apps = Vec::new();
    if let Some(mgr) = get_manager() {
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
                if !title.is_empty() {
                    gsmtc_apps.push(id.clone());
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
    }

    for media in browser_fallback::snapshots(&gsmtc_apps) {
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
            if browser_fallback::is_browser_id(app_id) {
                let playing = current["playing"].as_bool().unwrap_or(false);
                match action {
                    "play" if !playing => send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8),
                    "pause" if playing => send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8),
                    "play" | "pause" => return true,
                    "toggle" => send_media_key(VK_MEDIA_PLAY_PAUSE.0 as u8),
                    "next" => send_media_key(VK_MEDIA_NEXT_TRACK.0 as u8),
                    "prev" => send_media_key(VK_MEDIA_PREV_TRACK.0 as u8),
                    _ => return false,
                }
                notify_wake();
                return true;
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

fn emit_media_event<S: serde::Serialize + Clone>(app: &tauri::AppHandle, event: &str, payload: S) {
    let _ = app.emit_to("main", event, payload.clone());
    if let Some(settings) = app.get_webview_window("settings") {
        if settings.is_visible().unwrap_or(false) && !settings.is_minimized().unwrap_or(false) {
            let _ = app.emit_to("settings", event, payload);
        }
    }
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
    raw_ptr: usize,
    media_token: Option<windows::Foundation::EventRegistrationToken>,
    playback_token: Option<windows::Foundation::EventRegistrationToken>,
    timeline_token: Option<windows::Foundation::EventRegistrationToken>,
}

impl SessionBinding {
    fn bind(session: GlobalSystemMediaTransportControlsSession, app_id: String) -> Self {
        let raw_ptr = session.as_raw() as usize;
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
            raw_ptr,
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
            let mut cover_retry = cover_retry::CoverRetry::default();

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
                        let wait = cover_retry.wait(Instant::now()).map_or(wait, |delay| delay.min(wait));
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
                    || cover_retry.take_due(Instant::now())
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
                                let raw_ptr = sess.as_raw() as usize;
                                // Browsers (especially Yandex Browser / Chromium) replace the GSMTC
                                // COM session object under the same AUMID when switching tabs.
                                let same = session_binding
                                    .as_ref()
                                    .is_some_and(|b| b.app_id == app_id && b.raw_ptr == raw_ptr);
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
                let missing_native_cover = current.as_ref().is_some_and(|media| {
                    media["cover"].as_str().is_none() && (media["app"]==crate::music_bridge::APP_ID || session_binding.as_ref().is_some_and(|binding|
                        media["app"].as_str() == Some(binding.app_id.as_str())))
                });
                cover_retry.observe(&key, missing_native_cover, Instant::now());
                let cover = current
                    .as_ref()
                    .and_then(|m| m["cover"].as_str())
                    .map(str::to_owned);
                if let Some(cover) = cover {
                    let pair = (key.clone(), cover.clone());
                    if last_cover.as_ref() != Some(&pair) {
                        emit_media_event(&app_clone, "media:cover", json!({"key": key, "cover": cover}));
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
                            let duration_ms = cur["durationMs"].as_u64().unwrap_or(0);
                            let key_for_task = key.clone();
                            let app_for_task = app_clone.clone();

                            tauri::async_runtime::spawn(async move {
                                // Prefer the player's own late thumbnail before an online fallback.
                                tokio::time::sleep(Duration::from_millis(1400)).await;
                                if !cached_media().is_some_and(|media| media["key"] == key_for_task && media["cover"].is_null()) { return; }
                                if let Some(artwork) = fetch_online_artwork(&artist, &title, duration_ms).await {
                                    let mut current = CACHED_MEDIA.lock().unwrap();
                                    let Some(media) = current.as_mut().filter(|media| media["key"] == key_for_task && media["cover"].is_null()) else { return; };
                                    media["cover"] = json!(artwork);
                                    *LAST_COVER_CACHE.lock().unwrap() = Some((key_for_task.clone(), artwork.clone()));
                                    drop(current);
                                    emit_media_event(
                                        &app_for_task,
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
                    emit_media_event(&app_clone, "media:update", &payload);
                    last_key = key;
                    last_playing = is_playing;
                    last_payload = snapshot;
                }
            }
        });
}

#[cfg(test)]
mod tests {
    #[test] fn online_artwork_rejects_unrelated_results_and_other_recordings() {
        let song=json!({"artistName":"Автор", "trackName":"Песня!", "trackTimeMillis":180000, "artworkUrl100":"https://example.test/100x100bb.jpg"});
        let data=json!({"results":[{"artistName":"Другой", "trackName":"Песня", "trackTimeMillis":180000, "artworkUrl100":"https://example.test/wrong.jpg"},song]});
        assert_eq!(super::matching_online_artwork(&data," автор ","ПЕСНЯ",181000).as_deref(),Some("https://example.test/600x600bb.jpg"));
        assert!(super::matching_online_artwork(&data,"Fixture","Pause fixture",300000).is_none());
        assert!(super::matching_online_artwork(&data,"Автор","Песня",240000).is_none());
        assert!(super::matching_online_artwork(&data,"","Песня",180000).is_none());
        let insecure=json!({"results":[{"artistName":"Автор","trackName":"Песня","trackTimeMillis":180000,"artworkUrl100":"http://example.test/art.jpg"}]});
        assert!(super::matching_online_artwork(&insecure,"Автор","Песня",180000).is_none());
    }
    #[test] fn yandex_browser_and_yandex_music_have_distinct_names() {
        assert_eq!(super::format_app_name("Yandex.OWPTABZ5EHFIKZ6HFNJOEQW6JI"), "Яндекс Браузер");
        assert_eq!(super::format_app_name("YandexBrowser"), "Яндекс Браузер");
        assert_eq!(super::format_app_name("woods.browser.yandex"), "Яндекс Браузер");
        assert_eq!(super::format_app_name("ru.yandex.desktop.music"), "Яндекс Музыка");
        assert_eq!(super::format_app_name("yandex.music"), "Яндекс Музыка");
    }
    #[test] fn connector_artwork_uses_only_the_same_song_and_never_replaces_its_own_cover() {
        let source=serde_json::json!({"title":"Песня","artist":"Автор","durationMs":180000,"cover":"native"});
        let mut target=serde_json::json!({"title":" Песня ","artist":"автор","durationMs":181000,"cover":null});
        super::merge_matching_cover(&mut target,&source);assert_eq!(target["cover"],"native");
        target["cover"]=serde_json::json!("connector");super::merge_matching_cover(&mut target,&source);assert_eq!(target["cover"],"connector");
        for (key,value) in [("title",serde_json::json!("Другая")),("artist",serde_json::json!("Другой")),("durationMs",serde_json::json!(240000))] {
            let mut different=source.clone();different["cover"]=serde_json::Value::Null;different[key]=value;
            super::merge_matching_cover(&mut different,&source);assert!(different["cover"].is_null());
        }
    }
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
