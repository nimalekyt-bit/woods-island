//! Bounded, cached MP4 clip fetcher for Woods Island "What's new" highlights.
use std::path::PathBuf;
use std::time::Duration;

const MAX_CLIP_BYTES: usize = 6 * 1024 * 1024;
const SITE_BASE: &str = "https://island.woodslab.top/clips";
const RELEASES_BASE: &str = "https://github.com/nimalekyt-bit/woods-island/releases/download";

pub fn valid_version(value: &str) -> bool {
    let mut parts = value.split('.');
    matches!(
        (parts.next(), parts.next(), parts.next(), parts.next()),
        (Some(a), Some(b), Some(c), None)
            if [a, b, c].iter().all(|p| !p.is_empty() && p.len() <= 5 && p.bytes().all(|b| b.is_ascii_digit()))
    )
}

pub fn valid_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 32
        && value.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub fn valid_lang(value: &str) -> bool {
    matches!(value, "ru" | "en")
}

pub fn valid_mp4(bytes: &[u8]) -> bool {
    bytes.len() >= 16 && bytes.len() <= MAX_CLIP_BYTES && &bytes[4..8] == b"ftyp"
}

fn cache_path(version: &str, name: &str, lang: &str) -> PathBuf {
    crate::storage::get_storage_dir()
        .join("clips")
        .join(version)
        .join(format!("{name}-{lang}.mp4"))
}

fn candidate_urls(version: &str, name: &str, lang: &str) -> Vec<String> {
    if let Ok(override_base) = std::env::var("WOODS_ISLAND_CLIPS_URL") {
        let base = override_base.trim_end_matches('/');
        if !base.is_empty() {
            return vec![format!("{base}/{version}/{name}-{lang}.mp4")];
        }
    }
    vec![
        format!("{SITE_BASE}/{version}/{name}-{lang}.mp4"),
        format!("{RELEASES_BASE}/v{version}/clip-{name}-{lang}.mp4"),
    ]
}

pub async fn fetch(version: &str, name: &str, lang: &str) -> Result<Vec<u8>, String> {
    if !valid_version(version) || !valid_name(name) || !valid_lang(lang) {
        return Err("Invalid clip parameters".into());
    }
    let path = cache_path(version, name, lang);
    if let Ok(cached) = std::fs::read(&path) {
        if valid_mp4(&cached) {
            return Ok(cached);
        }
    }
    let client = reqwest::Client::builder()
        .user_agent(format!("WoodsIsland/{}", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let mut last_error = "HTTP 404".to_owned();
    for url in candidate_urls(version, name, lang) {
        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };
        if resp.status().as_u16() == 404 {
            last_error = "HTTP 404".to_owned();
            continue;
        }
        if !resp.status().is_success() {
            last_error = format!("HTTP {}", resp.status().as_u16());
            continue;
        }
        if resp.content_length().is_some_and(|n| n as usize > MAX_CLIP_BYTES) {
            last_error = "Clip exceeds size limit".to_owned();
            continue;
        }
        let Ok(bytes) = resp.bytes().await else {
            last_error = "Failed to read clip body".to_owned();
            continue;
        };
        let vec = bytes.to_vec();
        if !valid_mp4(&vec) {
            last_error = "Invalid MP4 header".to_owned();
            continue;
        }
        let _ = crate::storage::atomic_write(&path, &vec);
        return Ok(vec);
    }
    Err(last_error)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_clip_identifiers_and_rejects_traversal() {
        assert!(valid_version("1.4.0"));
        assert!(!valid_version("../1.4"));
        assert!(!valid_version("v1.4.0"));
        assert!(valid_name("phone"));
        assert!(valid_name("notch-bar"));
        assert!(!valid_name("../evil"));
        assert!(!valid_name("UPPER"));
        assert!(valid_lang("ru") && valid_lang("en") && !valid_lang("de"));
    }
    #[test]
    fn validates_mp4_magic_and_bounds() {
        let mut ok = vec![0u8; 32];
        ok[4..8].copy_from_slice(b"ftyp");
        assert!(valid_mp4(&ok));
        assert!(!valid_mp4(b"not an mp4 file at all"));
        assert!(!valid_mp4(&[0u8; 8]));
    }
}
