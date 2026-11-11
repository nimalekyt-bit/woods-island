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

pub async fn get(artist: String, title: String, album: String, duration_ms: Option<u64>) -> Result<Value, String> {
    if artist.trim().is_empty() || title.trim().is_empty() { return Ok(response(&Value::Null)); }
    let mut query = vec![("artist_name", artist), ("track_name", title)];
    if !album.trim().is_empty() { query.push(("album_name", album)); }
    if let Some(duration) = duration_ms.filter(|ms| *ms > 0) { query.push(("duration", (duration / 1000).to_string())); }
    let endpoint = std::env::var("WOODS_ISLAND_LYRICS_URL").ok()
        .filter(|_| crate::win::WindowManager::passive_qa())
        .unwrap_or_else(|| "https://lrclib.net/api/get".into());
    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit/woods-island)")
        .timeout(std::time::Duration::from_secs(4)).build().map_err(|e|e.to_string())?;
    let reply = client.get(endpoint).query(&query).send().await.map_err(|e|e.to_string())?;
    if reply.status() == reqwest::StatusCode::NOT_FOUND { return Ok(response(&Value::Null)); }
    let data = reply.error_for_status().map_err(|e|e.to_string())?.json::<Value>().await.map_err(|e|e.to_string())?;
    Ok(response(&data))
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
}
