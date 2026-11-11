//! Compatibility with the owner's existing Yandex Music connector.
//! Only loopback metadata is read automatically; commands require a user action.
use serde_json::{json, Value};
use std::{collections::VecDeque, io::{Read, Write}, net::{TcpListener, TcpStream}, sync::Mutex, time::Duration};

pub const APP_ID: &str = "ru.yandex.desktop.music.mod.connector";
const FRESH_MS: u64 = 3000;
static TRACK: Mutex<Option<Value>> = Mutex::new(None);
static COMMANDS: Mutex<VecDeque<(u64, Value)>> = Mutex::new(VecDeque::new());
static STATUS: Mutex<Option<String>> = Mutex::new(None);

fn normalize(input: &Value, now: u64) -> Result<Value, String> {
    let title = input["title"].as_str().filter(|s| !s.trim().is_empty()).ok_or("Track title is required")?;
    let artist = input["artist"].as_str().unwrap_or("");
    let number = |key: &str| input[key].as_f64().filter(|n| n.is_finite() && *n >= 0.0).map(|n| n.round() as u64).ok_or_else(|| format!("Invalid {key}"));
    let duration = number("duration")?;
    let position = number("progress")?.min(duration.max(1));
    let playing = input["isPlaying"].as_bool().ok_or("Playing state is required")?;
    let cover = input["coverUrl"].as_str().filter(|url| url.starts_with("https://"));
    Ok(json!({"key":format!("{}|{}|{}|{}",APP_ID,input["trackId"],artist,title), "title":title,"artist":artist,"album":"", "app":APP_ID,"appName":"Яндекс Музыка", "playing":playing,"positionMs":position,"durationMs":duration, "cover":cover,"updatedAt":now,"sources":1,"canSeek":false,"transport":"yandex-connector"}))
}

fn fresh(track: &Value, now: u64) -> Option<Value> {
    let age = now.saturating_sub(track["updatedAt"].as_u64()?);
    if age > FRESH_MS { return None; }
    let mut media = track.clone();
    if media["playing"] == true {
        media["positionMs"] = json!((media["positionMs"].as_u64()? + age).min(media["durationMs"].as_u64()?));
    }
    media["updatedAt"] = json!(now);
    Some(media)
}

pub fn current() -> Option<Value> {
    TRACK.lock().unwrap().as_ref().and_then(|track| fresh(track, crate::media::now_ms()))
}

pub fn diagnostics() -> Value {
    json!({"connected":current().is_some(), "problem":STATUS.lock().unwrap().clone(), "port":std::env::var("WOODS_ISLAND_MUSIC_PORT").ok().and_then(|s|s.parse::<u16>().ok()).unwrap_or(3003)})
}

fn connector_action(action: &str, playing: bool) -> Result<Option<&'static str>, String> {
    match action {
        "play" if playing => Ok(None), "pause" if !playing => Ok(None),
        "play" | "pause" | "toggle" => Ok(Some("pause")),
        "next" => Ok(Some("next")), "prev" => Ok(Some("prev")),
        _ => Err("This action is not supported by the Yandex connector".into()),
    }
}

pub fn control(action: &str) -> bool {
    let Some(track) = current() else { return false; };
    let Ok(command) = connector_action(action, track["playing"].as_bool().unwrap_or(false)) else { return false; };
    if let Some(command) = command {
        let mut queue = COMMANDS.lock().unwrap();
        if queue.len() >= 8 { return false; }
        queue.push_back((crate::media::now_ms(),json!({"action":command})));
    }
    true
}

fn handle(mut stream: TcpStream) -> Result<(), String> {
    stream.set_read_timeout(Some(Duration::from_secs(2))).map_err(|e|e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(2))).map_err(|e|e.to_string())?;
    let mut bytes = Vec::new();
    let header_end = loop {
        let mut chunk = [0u8;4096];
        let count = stream.read(&mut chunk).map_err(|e|e.to_string())?;
        if count == 0 { return Err("Incomplete request".into()); }
        bytes.extend_from_slice(&chunk[..count]);
        if let Some(index) = bytes.windows(4).position(|s|s==b"\r\n\r\n") { break index+4; }
        if bytes.len() > 16384 { return Err("Request headers too large".into()); }
    };
    let header = String::from_utf8(bytes[..header_end].to_vec()).map_err(|e|e.to_string())?;
    let mut request = header.lines().next().unwrap_or("").split_whitespace();
    let method = request.next().unwrap_or("");
    let path = request.next().unwrap_or("").split('?').next().unwrap_or("");
    let length = header.lines().filter_map(|line|line.split_once(':')).find(|(name,_)|name.eq_ignore_ascii_case("content-length")).map(|(_,value)|value.trim().parse::<usize>()).transpose().map_err(|e|e.to_string())?.unwrap_or(0);
    if length > 65536 { return Err("Track payload too large".into()); }
    while bytes.len() < header_end+length {
        let mut chunk = [0u8;4096];
        let count = stream.read(&mut chunk).map_err(|e|e.to_string())?;
        if count == 0 { return Err("Incomplete payload".into()); }
        bytes.extend_from_slice(&chunk[..count]);
    }
    let (status, payload) = match (method,path) {
        ("OPTIONS",_) => (200,json!({})),
        ("POST","/track") => {
            match serde_json::from_slice::<Value>(&bytes[header_end..header_end+length]).map_err(|e|e.to_string()).and_then(|input|normalize(&input,crate::media::now_ms())) {
                Ok(track) => { *TRACK.lock().unwrap() = Some(track); *STATUS.lock().unwrap() = None; (200,json!({})) },
                Err(error) => (400,json!({"error":error})),
            }
        },
        ("GET","/cmd") => {
            let mut queue = COMMANDS.lock().unwrap();
            while queue.front().map(|(at,_)|crate::media::now_ms().saturating_sub(*at)>2000).unwrap_or(false) {queue.pop_front();}
            queue.pop_front().map(|(_,command)|(200,command)).unwrap_or((204,Value::Null))
        },
        ("POST","/debug") => (200,json!({})),
        ("GET","/health") => (200,diagnostics()),
        _ => (404,json!({"error":"Unknown bridge route"})),
    };
    let body = if status == 204 {String::new()} else {payload.to_string()};
    write!(stream,"HTTP/1.1 {status} {}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}", match status{200=>"OK",204=>"No Content",400=>"Bad Request",_=>"Not Found"},body.len(),body).map_err(|e|e.to_string())
}

pub fn start() {
    let port = std::env::var("WOODS_ISLAND_MUSIC_PORT").ok().and_then(|s|s.parse::<u16>().ok()).unwrap_or(3003);
    match TcpListener::bind(("127.0.0.1",port)) {
        Ok(listener) => {
            crate::app_log(&format!("Yandex connector listening on 127.0.0.1:{port}"));
            std::thread::spawn(move || for stream in listener.incoming().flatten() { if let Err(error)=handle(stream) {crate::app_log(&format!("Yandex connector: {error}"));} });
        },
        Err(error) => {let message=format!("Yandex connector port {port}: {error}");crate::app_log(&message);*STATUS.lock().unwrap()=Some(message);},
    }
}

#[cfg(test)] mod tests {
    use super::*;
    fn track() -> Value {json!({"title":"Песня","artist":"Автор","trackId":"1","progress":1234.5,"duration":5000,"isPlaying":true,"coverUrl":"https://example.com/cover.jpg"})}
    #[test] fn stale_connector_never_leaves_a_fake_playing_track() {
        let media=normalize(&track(),10000).unwrap();
        assert_eq!(fresh(&media,11000).unwrap()["positionMs"],2235);
        assert!(fresh(&media,13001).is_none());
    }
    #[test] fn connector_preserves_unicode_and_clamps_position() {
        let mut input=track();input["progress"]=json!(8000);input["coverUrl"]=json!("file:///secret");
        let media=normalize(&input,1000).unwrap();assert_eq!(media["title"],"Песня");assert_eq!(media["positionMs"],5000);assert_eq!(media["cover"],Value::Null);
        input["isPlaying"]=Value::Null;assert!(normalize(&input,1000).is_err());
    }
    #[test] fn explicit_pause_and_play_never_toggle_an_already_correct_state() {
        assert_eq!(connector_action("play",true).unwrap(),None);
        assert_eq!(connector_action("pause",false).unwrap(),None);
        assert_eq!(connector_action("pause",true).unwrap(),Some("pause"));
        assert!(connector_action("seek",true).is_err());
    }
}
