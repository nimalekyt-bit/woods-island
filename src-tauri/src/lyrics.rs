//! LRCLIB responses in the renderer's millisecond-based lyrics contract.
use serde_json::{json, Value};

fn timestamp(tag: &str) -> Option<i64> {
    let (minutes, seconds) = tag.split_once(':')?;
    let minutes = minutes.parse::<u32>().ok()?;
    let seconds = seconds.parse::<f64>().ok()?;
    if !seconds.is_finite() || !(0.0..60.0).contains(&seconds) { return None; }
    Some(((minutes as f64 * 60.0 + seconds) * 1000.0).round() as i64)
}

fn synced_lines(lrc: &str) -> Vec<Value> {
    let offset = lrc.lines().find_map(|line| {
        line.trim().strip_prefix("[offset:")?.strip_suffix(']')?.trim().parse::<i64>().ok()
    }).unwrap_or(0);
    let mut lines = Vec::new();
    for line in lrc.lines() {
        let mut rest = line.trim().trim_start_matches('\u{feff}');
        let mut times = Vec::new();
        while let Some(tagged) = rest.strip_prefix('[') {
            let Some((tag, tail)) = tagged.split_once(']') else { break; };
            if let Some(ms) = timestamp(tag) { times.push(ms.saturating_add(offset).max(0) as u64); }
            rest = tail;
        }
        for ms in times { lines.push(json!({"ms": ms, "text": rest.trim()})); }
    }
    lines.sort_by_key(|line| line["ms"].as_u64().unwrap_or(0));
    lines
}

pub fn response(data: &Value) -> Value {
    let plain = data["plainLyrics"].as_str().unwrap_or("");
    let synced = synced_lines(data["syncedLyrics"].as_str().unwrap_or(""));
    let instrumental = data["instrumental"].as_bool().unwrap_or(false);
    json!({"id":data["id"], "found":!plain.trim().is_empty() || !synced.is_empty() || instrumental,
        "synced":synced, "plain":plain, "instrumental":instrumental})
}

fn normalize_text(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn pick_best_synced_candidate(
    candidates: &[Value],
    artist: &str,
    title: &str,
    duration_ms: Option<u64>,
) -> Option<Value> {
    let want_artist = normalize_text(artist);
    let want_title = normalize_text(title);
    let want_secs = duration_ms.filter(|ms| *ms > 0).map(|ms| ms as f64 / 1000.0);
    let mut best: Option<(f64, Value)> = None;
    for item in candidates {
        let synced = synced_lines(item["syncedLyrics"].as_str().unwrap_or(""));
        if synced.is_empty() {
            continue;
        }
        let item_title = normalize_text(item["trackName"].as_str().unwrap_or(""));
        let item_artist = normalize_text(item["artistName"].as_str().unwrap_or(""));
        if item_title != want_title && !item_title.contains(&want_title) {
            continue;
        }
        if !want_artist.is_empty()
            && item_artist != want_artist
            && !item_artist.contains(&want_artist)
            && !want_artist.contains(&item_artist)
        {
            continue;
        }
        let duration_diff = match (want_secs, item["duration"].as_f64()) {
            (Some(want), Some(got)) if got.is_finite() && got > 0.0 => {
                let diff = (want - got).abs();
                if diff > 6.0 {
                    continue;
                }
                diff
            }
            _ => 3.0,
        };
        let exact_bonus = if item_title == want_title && item_artist == want_artist { 0.0 } else { 2.0 };
        let score = duration_diff + exact_bonus;
        if best.as_ref().is_none_or(|(best_score, _)| score < *best_score) {
            best = Some((score, response(item)));
        }
    }
    best.map(|(_, value)| value)
}

pub async fn get(artist: String, title: String, album: String, duration_ms: Option<u64>) -> Result<Value, String> {
    if artist.trim().is_empty() || title.trim().is_empty() { return Ok(response(&Value::Null)); }
    let mut query = vec![("artist_name", artist.clone()), ("track_name", title.clone())];
    if !album.trim().is_empty() { query.push(("album_name", album)); }
    if let Some(duration) = duration_ms.filter(|ms| *ms > 0) { query.push(("duration", (duration / 1000).to_string())); }
    let qa_override = std::env::var("WOODS_ISLAND_LYRICS_URL").ok()
        .filter(|_| crate::win::WindowManager::passive_qa());
    let endpoint = qa_override.clone().unwrap_or_else(|| "https://lrclib.net/api/get".into());
    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit/woods-island)")
        .timeout(std::time::Duration::from_secs(4)).build().map_err(|e|e.to_string())?;
    let reply = client.get(&endpoint).query(&query).send().await.map_err(|e|e.to_string())?;
    let direct = if reply.status() == reqwest::StatusCode::NOT_FOUND {
        response(&Value::Null)
    } else {
        let data = reply.error_for_status().map_err(|e|e.to_string())?.json::<Value>().await.map_err(|e|e.to_string())?;
        response(&data)
    };
    if direct["synced"].as_array().is_some_and(|arr| !arr.is_empty()) || direct["instrumental"] == true {
        return Ok(direct);
    }
    // Many tracks have a plain-only entry returned by /api/get alongside synced entries in /api/search.
    if qa_override.is_none() {
        let search_query = [("artist_name", artist.as_str()), ("track_name", title.as_str())];
        if let Ok(search_reply) = client.get("https://lrclib.net/api/search").query(&search_query).send().await {
            if let Ok(ok_reply) = search_reply.error_for_status() {
                if let Ok(candidates) = ok_reply.json::<Vec<Value>>().await {
                    if let Some(synced_match) = pick_best_synced_candidate(&candidates, &artist, &title, duration_ms) {
                        return Ok(synced_match);
                    }
                }
            }
        }
    }
    Ok(direct)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn timestamps_match_the_renderer_ms_contract() {
        let data = response(&json!({"id":42,"syncedLyrics":"[00:10.01]First line\n[00:14.04]Second line\n[00:18.880]Third line"}));
        assert_eq!(data["synced"][1]["ms"], 14040);
        assert_eq!(data["synced"][1]["text"], "Second line");
        assert!(data["synced"][1].get("time").is_none());
        assert_eq!(data["found"], true);
    }
    #[test]
    fn offsets_repeated_tags_and_out_of_order_lines_are_normalized() {
        let lines = synced_lines("[offset:-250]\n[00:20.5][00:10.25]Повтор\n[00:00.10]\n[ar:Artist]\n[00:99.0]invalid\n[00:NaN]invalid");
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0]["ms"], 0);
        assert_eq!(lines[0]["text"], "");
        assert_eq!(lines[1]["ms"], 10000);
        assert_eq!(lines[2]["ms"], 20250);
        assert_eq!(lines[2]["text"], "Повтор");
    }
    #[test]
    fn plain_instrumental_and_missing_lyrics_have_distinct_contracts() {
        assert_eq!(response(&json!({"plainLyrics":"Plain words"}))["found"], true);
        let instrumental = response(&json!({"instrumental":true}));
        assert_eq!(instrumental["found"], true);
        assert_eq!(instrumental["instrumental"], true);
        assert_eq!(response(&Value::Null)["found"], false);
    }
    #[test]
    fn synced_search_candidate_beats_plain_only_and_rejects_wrong_duration() {
        let candidates = vec![
            json!({"id":1,"trackName":"Универ","artistName":"Baby Cute","duration":117.0,"plainLyrics":"Plain only","syncedLyrics":null}),
            json!({"id":2,"trackName":"Универ","artistName":"Baby Cute","duration":144.0,"syncedLyrics":"[00:05.00]Wrong length"}),
            json!({"id":3,"trackName":"Универ","artistName":"Baby Cute","duration":117.32,"syncedLyrics":"[00:10.00]Я не знаю твое имя"}),
        ];
        let picked = pick_best_synced_candidate(&candidates, "Baby Cute", "Универ", Some(117_000)).unwrap();
        assert_eq!(picked["id"], 3);
        assert_eq!(picked["synced"][0]["ms"], 10000);
        assert_eq!(picked["synced"][0]["text"], "Я не знаю твое имя");
    }
}
