//! Fallback browser media detection when Chromium/Yandex Browser does not publish GSMTC
//! (for example when `browser://flags/#hardware-media-key-handling` is disabled or a site
//! omits MediaSession metadata). Reads active Core Audio render sessions + browser window titles.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use windows::core::Interface;
use windows::Win32::Foundation::{BOOL, CloseHandle, HWND, LPARAM};
use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
use windows::Win32::Media::Audio::{
    AudioSessionStateActive, eRender, IAudioSessionControl2, IAudioSessionManager2,
    IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
};

const AUDIO_PEAK_THRESHOLD: f32 = 0.0005;
const PAUSE_HOLD: Duration = Duration::from_secs(12);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BrowserKind {
    Yandex,
    Chrome,
    Edge,
    Opera,
    Firefox,
    Brave,
    Vivaldi,
}

impl BrowserKind {
    pub fn id(self) -> &'static str {
        match self {
            Self::Yandex => "woods.browser.yandex",
            Self::Chrome => "woods.browser.chrome",
            Self::Edge => "woods.browser.edge",
            Self::Opera => "woods.browser.opera",
            Self::Firefox => "woods.browser.firefox",
            Self::Brave => "woods.browser.brave",
            Self::Vivaldi => "woods.browser.vivaldi",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Yandex => "Яндекс Браузер",
            Self::Chrome => "Google Chrome",
            Self::Edge => "Microsoft Edge",
            Self::Opera => "Opera",
            Self::Firefox => "Firefox",
            Self::Brave => "Brave",
            Self::Vivaldi => "Vivaldi",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        [
            Self::Yandex,
            Self::Chrome,
            Self::Edge,
            Self::Opera,
            Self::Firefox,
            Self::Brave,
            Self::Vivaldi,
        ]
        .into_iter()
        .find(|kind| kind.id() == id)
    }

    pub fn from_exe_path(path: &str) -> Option<Self> {
        let lower = path.to_lowercase();
        let file = Path::new(&lower).file_name()?.to_str()?;
        match file {
            "browser.exe" if lower.contains("yandex") => Some(Self::Yandex),
            "yandex.exe" => Some(Self::Yandex),
            "chrome.exe" => Some(Self::Chrome),
            "msedge.exe" => Some(Self::Edge),
            "opera.exe" | "opera_gx.exe" => Some(Self::Opera),
            "firefox.exe" => Some(Self::Firefox),
            "brave.exe" => Some(Self::Brave),
            "vivaldi.exe" => Some(Self::Vivaldi),
            _ => None,
        }
    }

    pub fn matches_gsmtc_app_id(self, app_id: &str) -> bool {
        let lower = app_id.to_lowercase();
        match self {
            Self::Yandex => {
                (lower.starts_with("yandex.") && !lower.contains("music"))
                    || lower.contains("yandexbrowser")
                    || lower == "browser.exe"
            }
            Self::Chrome => lower.contains("chrome"),
            Self::Edge => lower.contains("msedge") || lower.contains("edge"),
            Self::Opera => lower.contains("opera"),
            Self::Firefox => crate::media::names::firefox_app_id(app_id),
            Self::Brave => lower.contains("brave"),
            Self::Vivaldi => lower.contains("vivaldi"),
        }
    }
}

pub fn is_browser_id(id: &str) -> bool {
    BrowserKind::from_id(id).is_some()
}

#[derive(Clone, Debug)]
struct LastPlaying {
    kind: BrowserKind,
    title: String,
    artist: String,
    pid: u32,
    seen_at: Instant,
}

static LAST_PLAYING: Mutex<Option<LastPlaying>> = Mutex::new(None);

unsafe fn process_path(pid: u32) -> Option<String> {
    if pid == 0 {
        return None;
    }
    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buffer = [0u16; 1024];
    let mut len = buffer.len() as u32;
    let ok = QueryFullProcessImageNameW(
        handle,
        PROCESS_NAME_WIN32,
        windows::core::PWSTR(buffer.as_mut_ptr()),
        &mut len,
    )
    .is_ok();
    let _ = CloseHandle(handle);
    if !ok || len == 0 {
        return None;
    }
    Some(String::from_utf16_lossy(&buffer[..len as usize]))
}

#[derive(Clone, Debug)]
struct ActiveBrowserAudio {
    kind: BrowserKind,
    pid: u32,
    peak: f32,
}

unsafe fn active_browser_audio_sessions() -> Vec<ActiveBrowserAudio> {
    let Ok(enumerator): Result<IMMDeviceEnumerator, _> =
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
    else {
        return Vec::new();
    };
    let Ok(devices) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) else {
        return Vec::new();
    };
    let mut best_by_kind: HashMap<u8, ActiveBrowserAudio> = HashMap::new();
    let device_count = devices.GetCount().unwrap_or(0).min(16);
    for dev_idx in 0..device_count {
        let Ok(device) = devices.Item(dev_idx) else { continue };
        let Ok(manager): Result<IAudioSessionManager2, _> = device.Activate(CLSCTX_ALL, None) else {
            continue;
        };
        let Ok(list) = manager.GetSessionEnumerator() else { continue };
        let count = list.GetCount().unwrap_or(0).min(128);
        for idx in 0..count {
            let Ok(control) = list.GetSession(idx) else { continue };
            if control.GetState().ok() != Some(AudioSessionStateActive) {
                continue;
            }
            let Ok(extended) = control.cast::<IAudioSessionControl2>() else { continue };
            let pid = extended.GetProcessId().unwrap_or(0);
            let Some(path) = process_path(pid) else { continue };
            let Some(kind) = BrowserKind::from_exe_path(&path) else { continue };
            let peak = control
                .cast::<IAudioMeterInformation>()
                .ok()
                .and_then(|meter| meter.GetPeakValue().ok())
                .unwrap_or(0.0);
            let key = kind as u8;
            let replace = best_by_kind
                .get(&key)
                .map(|existing| peak > existing.peak)
                .unwrap_or(true);
            if replace {
                best_by_kind.insert(key, ActiveBrowserAudio { kind, pid, peak });
            }
        }
    }
    let mut out: Vec<_> = best_by_kind.into_values().collect();
    out.sort_by(|a, b| b.peak.total_cmp(&a.peak));
    out
}

struct WindowCollector {
    target: BrowserKind,
    titles: Vec<String>,
    pid_cache: HashMap<u32, Option<BrowserKind>>,
}

unsafe extern "system" fn enum_browser_windows(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let collector = &mut *(lparam.0 as *mut WindowCollector);
    if !IsWindowVisible(hwnd).as_bool() {
        return BOOL(1);
    }
    let len = GetWindowTextLengthW(hwnd);
    if len <= 0 || len > 512 {
        return BOOL(1);
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == 0 {
        return BOOL(1);
    }
    let kind = *collector
        .pid_cache
        .entry(pid)
        .or_insert_with(|| process_path(pid).and_then(|p| BrowserKind::from_exe_path(&p)));
    if kind != Some(collector.target) {
        return BOOL(1);
    }
    let mut buf = vec![0u16; (len as usize) + 1];
    let copied = GetWindowTextW(hwnd, &mut buf).max(0) as usize;
    if copied > 0 {
        let text = String::from_utf16_lossy(&buf[..copied]).trim().to_owned();
        if !text.is_empty() {
            collector.titles.push(text);
        }
    }
    BOOL(1)
}

unsafe fn browser_window_titles(kind: BrowserKind) -> Vec<String> {
    let mut collector = WindowCollector {
        target: kind,
        titles: Vec::new(),
        pid_cache: HashMap::new(),
    };
    let _ = EnumWindows(
        Some(enum_browser_windows),
        LPARAM((&mut collector as *mut WindowCollector) as isize),
    );
    collector.titles
}

fn strip_browser_suffix(raw: &str) -> &str {
    let mut s = raw.trim();
    // Strip leading notification counters like "(1) " or "(23) "
    if s.starts_with('(') {
        if let Some(close) = s.find(") ") {
            if close > 1 && close <= 5 && s[1..close].bytes().all(|b| b.is_ascii_digit()) {
                s = s[close + 2..].trim_start();
            }
        }
    }
    // Strip leading sound indicator symbols used by some browsers
    for prefix in ["▶ ", "🔊 ", "♪ "] {
        if let Some(rest) = s.strip_prefix(prefix) {
            s = rest.trim_start();
        }
    }
    let suffixes = [
        " — Яндекс Браузер",
        " — Яндекс.Браузер",
        " - Яндекс Браузер",
        " - Яндекс.Браузер",
        " – Яндекс Браузер",
        " — Yandex Browser",
        " - Yandex Browser",
        " — Google Chrome",
        " - Google Chrome",
        " — Microsoft Edge",
        " - Microsoft Edge",
        " — Opera GX",
        " - Opera GX",
        " — Opera",
        " - Opera",
        " — Mozilla Firefox",
        " - Mozilla Firefox",
        " — Brave",
        " - Brave",
        " — Vivaldi",
        " - Vivaldi",
    ];
    for suffix in suffixes {
        if let Some(stripped) = s.strip_suffix(suffix) {
            s = stripped.trim_end();
            break;
        }
    }
    // Strip trailing Chrome profile suffix like " - Profile 1" if browser suffix was preceded
    s
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParsedTrack {
    pub title: String,
    pub artist: String,
    pub score: u8,
}

fn split_pair(text: &str) -> Option<(String, String)> {
    for sep in [" — ", " – ", " - ", " • "] {
        if let Some((left, right)) = text.split_once(sep) {
            let left = left.trim();
            let right = right.trim();
            if !left.is_empty() && !right.is_empty() {
                return Some((left.to_owned(), right.to_owned()));
            }
        }
    }
    None
}

/// Parses a browser window title into `(title, artist)` with a confidence score
/// favoring known music/video platforms over ordinary web tabs.
pub fn parse_browser_title(raw: &str) -> Option<ParsedTrack> {
    let cleaned = strip_browser_suffix(raw).trim();
    if cleaned.is_empty() {
        return None;
    }
    let lower = cleaned.to_lowercase();
    // Ignore bare browser/new-tab windows
    let generic_tabs = [
        "новая вкладка",
        "new tab",
        "яндекс браузер",
        "яндекс.браузер",
        "yandex browser",
        "google chrome",
        "microsoft edge",
        "mozilla firefox",
        "opera",
        "opera gx",
        "brave",
        "vivaldi",
        "настройки",
        "settings",
        "extensions",
        "расширения",
    ];
    if generic_tabs.iter().any(|g| lower == *g) {
        return None;
    }

    // 1. Yandex Music web
    for suffix in [
        " — Яндекс Музыка",
        " — Яндекс.Музыка",
        " - Яндекс Музыка",
        " | Яндекс Музыка",
        " — Yandex Music",
        " - Yandex Music",
    ] {
        if let Some(body) = cleaned.strip_suffix(suffix) {
            let body = body.trim();
            if body.is_empty() || body.eq_ignore_ascii_case("яндекс музыка") {
                return None;
            }
            // Yandex Music web often formats: "Track — Artist" or "Track. Слушать онлайн..."
            let body = body.split(". Слушать онлайн").next().unwrap_or(body).trim();
            if let Some((a, b)) = split_pair(body) {
                return Some(ParsedTrack { title: a, artist: b, score: 100 });
            }
            return Some(ParsedTrack {
                title: body.to_owned(),
                artist: "Яндекс Музыка".to_owned(),
                score: 95,
            });
        }
    }

    // 2. YouTube Music & YouTube
    for suffix in [" - YouTube Music", " — YouTube Music"] {
        if let Some(body) = cleaned.strip_suffix(suffix) {
            let body = body.trim();
            if body.is_empty() {
                return None;
            }
            if let Some((artist, title)) = split_pair(body) {
                return Some(ParsedTrack { title, artist, score: 98 });
            }
            return Some(ParsedTrack {
                title: body.to_owned(),
                artist: "YouTube Music".to_owned(),
                score: 94,
            });
        }
    }
    for suffix in [" - YouTube", " — YouTube"] {
        if let Some(body) = cleaned.strip_suffix(suffix) {
            let body = body.trim();
            if body.is_empty() || body.eq_ignore_ascii_case("youtube") {
                return None;
            }
            if let Some((artist, title)) = split_pair(body) {
                return Some(ParsedTrack { title, artist, score: 92 });
            }
            return Some(ParsedTrack {
                title: body.to_owned(),
                artist: "YouTube".to_owned(),
                score: 88,
            });
        }
    }

    // 3. VK / VK Music
    for suffix in [
        " | ВКонтакте",
        " — ВКонтакте",
        " - ВКонтакте",
        " | VK Музыка",
        " — VK Музыка",
        " | VK",
    ] {
        if let Some(body) = cleaned.strip_suffix(suffix) {
            let body = body.trim();
            if body.is_empty() {
                return None;
            }
            if let Some((left, right)) = split_pair(body) {
                return Some(ParsedTrack { title: right, artist: left, score: 90 });
            }
            return Some(ParsedTrack {
                title: body.to_owned(),
                artist: "VK".to_owned(),
                score: 80,
            });
        }
    }

    // 4. SoundCloud
    if let Some(idx) = lower.find(" on soundcloud") {
        let body = cleaned[..idx].trim();
        let body = body.strip_prefix("Stream ").unwrap_or(body).trim();
        if let Some((title, artist)) = body.rsplit_once(" by ") {
            if !title.trim().is_empty() && !artist.trim().is_empty() {
                return Some(ParsedTrack {
                    title: title.trim().to_owned(),
                    artist: artist.trim().to_owned(),
                    score: 95,
                });
            }
        }
        if !body.is_empty() {
            return Some(ParsedTrack {
                title: body.to_owned(),
                artist: "SoundCloud".to_owned(),
                score: 88,
            });
        }
    }

    // 5. Spotify Web Player ("Title • Artist" or "Artist – Title")
    if let Some(body) = cleaned
        .strip_suffix(" - Spotify")
        .or_else(|| cleaned.strip_suffix(" — Spotify"))
    {
        let body = body.trim();
        if !body.is_empty() {
            if let Some((title, artist)) = body.split_once(" • ") {
                return Some(ParsedTrack {
                    title: title.trim().to_owned(),
                    artist: artist.trim().to_owned(),
                    score: 96,
                });
            }
            if let Some((artist, title)) = split_pair(body) {
                return Some(ParsedTrack { title, artist, score: 94 });
            }
        }
    }
    if let Some((title, artist)) = cleaned.split_once(" • ") {
        if !title.trim().is_empty() && !artist.trim().is_empty() {
            return Some(ParsedTrack {
                title: title.trim().to_owned(),
                artist: artist.trim().to_owned(),
                score: 85,
            });
        }
    }

    // 6. Other known media platforms (Twitch, RuTube, Кинопоиск, Apple Music, Zvuk, Deezer)
    for (suffix, platform) in [
        (" - Twitch", "Twitch"),
        (" — RUTUBE", "RUTUBE"),
        (" - RUTUBE", "RUTUBE"),
        (" — Кинопоиск", "Кинопоиск"),
        (" - Кинопоиск", "Кинопоиск"),
        (" — Apple Music", "Apple Music"),
        (" — Звук", "Звук"),
        (" - Deezer", "Deezer"),
    ] {
        if let Some(body) = cleaned.strip_suffix(suffix) {
            let body = body.trim();
            if !body.is_empty() {
                if let Some((left, right)) = split_pair(body) {
                    return Some(ParsedTrack { title: right, artist: left, score: 86 });
                }
                return Some(ParsedTrack {
                    title: body.to_owned(),
                    artist: platform.to_owned(),
                    score: 82,
                });
            }
        }
    }

    // 7. Generic playing browser tab
    if let Some((left, right)) = split_pair(cleaned) {
        return Some(ParsedTrack { title: right, artist: left, score: 60 });
    }
    Some(ParsedTrack {
        title: cleaned.to_owned(),
        artist: String::new(),
        score: 40,
    })
}

fn best_track_from_titles(titles: &[String]) -> Option<ParsedTrack> {
    titles
        .iter()
        .filter_map(|raw| parse_browser_title(raw))
        .max_by_key(|track| track.score)
}

fn make_snapshot(kind: BrowserKind, title: &str, artist: &str, pid: u32, playing: bool) -> Value {
    let key = format!("{}|{}||{}", kind.id(), artist, title);
    let updated_at = crate::media::now_ms();
    json!({
        "key": key,
        "title": title,
        "artist": artist,
        "album": "",
        "app": kind.id(),
        "appName": kind.name(),
        "playing": playing,
        "positionMs": 0,
        "durationMs": 0,
        "canSeek": false,
        "cover": null,
        "pid": pid,
        "updatedAt": updated_at,
        "sources": 1
    })
}

/// Returns browser media snapshots detected from active Core Audio sessions.
/// Skips browsers that already have an active GSMTC session with metadata.
pub fn snapshots(gsmtc_active_apps: &[String]) -> Vec<Value> {
    let active = unsafe { active_browser_audio_sessions() };
    let mut results = Vec::new();
    let mut found_playing: Option<LastPlaying> = None;

    for session in active {
        if gsmtc_active_apps
            .iter()
            .any(|app_id| session.kind.matches_gsmtc_app_id(app_id))
        {
            continue;
        }
        let audible = session.peak >= AUDIO_PEAK_THRESHOLD;
        if !audible {
            continue;
        }
        let titles = unsafe { browser_window_titles(session.kind) };
        let track = best_track_from_titles(&titles).unwrap_or_else(|| ParsedTrack {
            title: session.kind.name().to_owned(),
            artist: String::new(),
            score: 10,
        });
        if found_playing.is_none() {
            found_playing = Some(LastPlaying {
                kind: session.kind,
                title: track.title.clone(),
                artist: track.artist.clone(),
                pid: session.pid,
                seen_at: Instant::now(),
            });
        }
        results.push(make_snapshot(
            session.kind,
            &track.title,
            &track.artist,
            session.pid,
            true,
        ));
    }

    if let Ok(mut guard) = LAST_PLAYING.lock() {
        if let Some(playing) = found_playing {
            *guard = Some(playing);
        } else if let Some(ref prev) = *guard {
            let covered_by_gsmtc = gsmtc_active_apps
                .iter()
                .any(|app_id| prev.kind.matches_gsmtc_app_id(app_id));
            if covered_by_gsmtc || prev.seen_at.elapsed() > PAUSE_HOLD {
                *guard = None;
            } else {
                // Keep showing paused card briefly between tracks or during short pauses
                results.push(make_snapshot(
                    prev.kind,
                    &prev.title,
                    &prev.artist,
                    prev.pid,
                    false,
                ));
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_yandex_browser_executable_and_aumid() {
        assert_eq!(
            BrowserKind::from_exe_path(
                r"C:\Users\user\AppData\Local\Yandex\YandexBrowser\Application\browser.exe"
            ),
            Some(BrowserKind::Yandex)
        );
        assert!(BrowserKind::Yandex.matches_gsmtc_app_id("Yandex.OWPTABZ5EHFIKZ6HFNJOEQW6JI"));
        assert!(!BrowserKind::Yandex.matches_gsmtc_app_id("ru.yandex.desktop.music"));
    }

    #[test]
    fn parses_yandex_browser_music_and_video_titles() {
        let ym = parse_browser_title("Кукла колдуна — Король и Шут — Яндекс Музыка — Яндекс Браузер")
            .expect("yandex music parsed");
        assert_eq!(ym.title, "Кукла колдуна");
        assert_eq!(ym.artist, "Король и Шут");
        assert!(ym.score >= 95);

        let yt = parse_browser_title("(2) Daft Punk - Instant Crush - YouTube — Яндекс Браузер")
            .expect("youtube parsed");
        assert_eq!(yt.title, "Instant Crush");
        assert_eq!(yt.artist, "Daft Punk");

        let sp = parse_browser_title("Blinding Lights • The Weeknd — Яндекс Браузер")
            .expect("spotify web parsed");
        assert_eq!(sp.title, "Blinding Lights");
        assert_eq!(sp.artist, "The Weeknd");

        assert!(parse_browser_title("Новая вкладка — Яндекс Браузер").is_none());
    }

    #[test]
    fn prefers_music_window_over_generic_browser_window() {
        let titles = vec![
            "GitHub - Dashboard — Яндекс Браузер".to_string(),
            "Ночь — Кино — Яндекс Музыка — Яндекс Браузер".to_string(),
        ];
        let best = best_track_from_titles(&titles).unwrap();
        assert_eq!(best.title, "Ночь");
        assert_eq!(best.artist, "Кино");
    }
}
