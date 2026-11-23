//! Dependency-free protocol boundaries for local phone transfers.
use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

pub const MAX_HEADERS: usize = 16 * 1024;
pub const MAX_FILE: u64 = 256 * 1024 * 1024;
pub const MAX_TEXT: u64 = 64 * 1024;
pub const LINK_TTL: Duration = Duration::from_secs(10 * 60);
pub const PAIR_TTL: Duration = Duration::from_secs(2 * 60);
pub const SESSION_TTL: Duration = Duration::from_secs(24 * 60 * 60);
pub const IDLE_TTL: Duration = Duration::from_secs(12 * 60 * 60);

#[derive(Debug)]
pub struct Request {
    pub method: String,
    pub target: String,
    pub headers: HashMap<String, String>,
    pub length: u64,
}
pub fn parse_request(bytes: &[u8]) -> Result<Request, &'static str> {
    if bytes.len() > MAX_HEADERS {
        return Err("headers_too_large");
    }
    let source = std::str::from_utf8(bytes).map_err(|_| "invalid_headers")?;
    let mut lines = source.split("\r\n");
    let first = lines.next().ok_or("invalid_request")?;
    let fields: Vec<_> = first.split(' ').collect();
    if fields.len() != 3
        || fields[2] != "HTTP/1.1"
        || !["GET", "POST"].contains(&fields[0])
        || !fields[1].starts_with('/')
        || fields[1].len() > 4096
        || fields[1].contains('#')
    {
        return Err("invalid_request");
    }
    let mut headers: HashMap<String, String> = HashMap::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let (key, value) = line.split_once(':').ok_or("invalid_header")?;
        if key.is_empty()
            || !key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
            || value.chars().any(|c| c.is_control() && c != '\t')
        {
            return Err("invalid_header");
        }
        let lower = key.to_ascii_lowercase();
        let trimmed = value.trim().to_owned();
        if let Some(existing) = headers.get_mut(&lower) {
            if matches!(
                lower.as_str(),
                "host"
                    | "content-length"
                    | "authorization"
                    | "origin"
                    | "transfer-encoding"
                    | "expect"
            ) {
                return Err("duplicate_header");
            }
            existing.push_str(", ");
            existing.push_str(&trimmed);
        } else {
            headers.insert(lower, trimmed);
        }
    }
    if headers.contains_key("transfer-encoding") {
        return Err("unsupported_transfer_encoding");
    }
    let length = match headers.get("content-length") {
        Some(value) if value.bytes().all(|byte| byte.is_ascii_digit()) && !value.is_empty() => {
            value.parse::<u64>().map_err(|_| "invalid_length")?
        }
        Some(_) => return Err("invalid_length"),
        None if fields[0] == "POST" => return Err("length_required"),
        None => 0,
    };
    if length > MAX_FILE {
        return Err("file_too_large");
    }
    if fields[0] == "GET" && length != 0 {
        return Err("unexpected_body");
    }
    Ok(Request {
        method: fields[0].into(),
        target: fields[1].into(),
        headers,
        length,
    })
}

pub fn safe_filename(name: &str) -> Result<String, &'static str> {
    if name.is_empty()
        || name.encode_utf16().count() > 180
        || name.ends_with([' ', '.'])
        || name
            .chars()
            .any(|c| c.is_control() || ['/', '\\', ':', '<', '>', '"', '|', '?', '*'].contains(&c))
    {
        return Err("invalid_filename");
    }
    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end_matches(' ')
        .to_ascii_uppercase();
    if ["CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$"].contains(&stem.as_str())
        || ["COM", "LPT"].iter().any(|prefix| {
            stem.strip_prefix(prefix).is_some_and(|suffix| {
                ["1", "2", "3", "4", "5", "6", "7", "8", "9", "¹", "²", "³"].contains(&suffix)
            })
        })
    {
        return Err("invalid_filename");
    }
    Ok(name.to_owned())
}
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() || a.is_empty() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |diff, (a, b)| diff | (a ^ b))
        == 0
}

#[derive(Clone, Debug)]
pub struct Pending {
    pub id: String,
    pub device: String,
    pub ticket: String,
    pub expires: Instant,
}
#[derive(Clone, Debug)]
pub struct Active {
    pub device: String,
    pub capability: String,
    pub expires: Instant,
    pub seen: Instant,
}
pub struct Authentication {
    pub link: String,
    pub link_expires: Instant,
    pub pending: Option<Pending>,
    pub active: Option<Active>,
    pub epoch: u64,
}
impl Authentication {
    pub fn new(token: String, now: Instant) -> Self {
        Self {
            link: token,
            link_expires: now + LINK_TTL,
            pending: None,
            active: None,
            epoch: 1,
        }
    }
    pub fn restored(device: String, capability: String, remaining: Duration, now: Instant) -> Self {
        let ttl = remaining.min(SESSION_TTL);
        Self {
            link: String::new(),
            link_expires: now,
            pending: None,
            active: Some(Active {
                device,
                capability,
                expires: now + ttl,
                seen: now,
            }),
            epoch: 1,
        }
    }
    pub fn renew(&mut self, token: String, now: Instant) {
        self.link = token;
        self.link_expires = now + LINK_TTL;
        self.pending = None;
        self.active = None;
        self.epoch = self.epoch.wrapping_add(1);
    }
    pub fn expire(&mut self, now: Instant) {
        if now >= self.link_expires {
            self.link.clear();
        }
        if self.pending.as_ref().is_some_and(|p| now >= p.expires) {
            self.pending = None;
        }
        if self
            .active
            .as_ref()
            .is_some_and(|p| now >= p.expires || now.saturating_duration_since(p.seen) >= IDLE_TTL)
        {
            self.active = None;
            self.epoch = self.epoch.wrapping_add(1);
        }
    }
    pub fn pair(
        &mut self,
        token: &str,
        ticket: String,
        id: String,
        device: String,
        now: Instant,
    ) -> Result<(), &'static str> {
        self.expire(now);
        if self.pending.is_some() || self.active.is_some() || !constant_time_eq(token, &self.link) {
            return Err("invalid_link");
        }
        self.link.clear();
        self.pending = Some(Pending {
            id,
            device,
            ticket,
            expires: now + PAIR_TTL,
        });
        Ok(())
    }
    pub fn allow(&mut self, id: &str, now: Instant) -> Result<(), &'static str> {
        self.expire(now);
        let pending = self
            .pending
            .as_ref()
            .filter(|p| constant_time_eq(id, &p.id))
            .ok_or("pairing_expired")?;
        self.active = Some(Active {
            device: pending.device.clone(),
            capability: pending.ticket.clone(),
            expires: now + SESSION_TTL,
            seen: now,
        });
        self.pending = None;
        Ok(())
    }
    pub fn deny(&mut self, id: &str) -> Result<(), &'static str> {
        if !self
            .pending
            .as_ref()
            .is_some_and(|p| constant_time_eq(id, &p.id))
        {
            return Err("pairing_expired");
        }
        self.pending = None;
        self.epoch = self.epoch.wrapping_add(1);
        Ok(())
    }
    pub fn authorized(&mut self, token: &str, now: Instant, touch: bool) -> bool {
        self.expire(now);
        let Some(active) = self.active.as_mut() else {
            return false;
        };
        if !constant_time_eq(token, &active.capability) {
            return false;
        }
        if touch {
            active.seen = now;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn windows_paths_and_header_injection_cannot_be_received_as_filenames() {
        for name in [
            "../private",
            "a\\b.txt",
            "C:payload",
            "photo:stream",
            ".",
            "NUL.txt",
            "COM1.png",
            "LPT².log",
            "x. ",
            "a\r\nX: y",
            "bad?.zip",
        ] {
            assert!(safe_filename(name).is_err(), "{name}");
        }
        assert_eq!(
            safe_filename("Фото с телефона 你好.png").unwrap(),
            "Фото с телефона 你好.png"
        );
    }
    #[test]
    fn framing_rejects_ambiguous_and_unbounded_requests() {
        assert!(safe_filename("AUX .txt").is_err());
        assert_eq!(safe_filename(".env").unwrap(), ".env");
        for head in [
            "POST /text HTTP/1.1\r\nHost: x\r\nContent-Length: 1\r\ncontent-length: 2\r\n",
            "POST /text HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\nContent-Length: 1\r\n",
            "POST /text HTTP/1.1\r\nHost: x\r\n",
            "GET / HTTP/1.1\r\nHost: x\r\nContent-Length: 1\r\n",
            "POST /file HTTP/1.1\r\nHost: x\r\nContent-Length: 99999999999\r\n",
        ] {
            assert!(parse_request(head.as_bytes()).is_err());
        }
        let request = parse_request(
            b"POST /text HTTP/1.1\r\nHost: 192.168.1.2:1234\r\nContent-Length: 7\r\n",
        )
        .unwrap();
        assert_eq!(request.length, 7);
    }
    #[test]
    fn scanned_links_require_specific_desktop_approval_and_expire() {
        let now = Instant::now();
        let mut auth = Authentication::new("link".into(), now);
        auth.pair(
            "link",
            "phone-cap".into(),
            "pair-id".into(),
            "Android".into(),
            now,
        )
        .unwrap();
        assert!(!auth.authorized("phone-cap", now, false));
        assert!(auth.allow("old-pair-id", now).is_err());
        auth.allow("pair-id", now).unwrap();
        assert!(auth.authorized("phone-cap", now, false));
        assert!(auth
            .pair("link", "other".into(), "other".into(), "Other".into(), now)
            .is_err());
        auth.renew("new-link".into(), now);
        assert!(!auth.authorized("phone-cap", now, false));
        assert!(auth
            .pair(
                "new-link",
                "cap".into(),
                "id".into(),
                "Phone".into(),
                now + LINK_TTL
            )
            .is_err());
    }
    #[test]
    fn rejection_and_idle_timeout_invalidate_transfer_capabilities() {
        let now = Instant::now();
        let mut auth = Authentication::new("link".into(), now);
        auth.pair("link", "cap".into(), "id".into(), "Phone".into(), now)
            .unwrap();
        auth.deny("id").unwrap();
        assert!(auth.allow("id", now).is_err());
        auth.renew("next".into(), now);
        auth.pair("next", "cap2".into(), "id2".into(), "Phone".into(), now)
            .unwrap();
        auth.allow("id2", now).unwrap();
        assert!(!auth.authorized("cap2", now + IDLE_TTL, false));
    }
    #[test]
    fn restored_session_authorizes_existing_phone_without_open_link() {
        let now = Instant::now();
        let mut auth = Authentication::restored(
            "iPhone".into(),
            "saved-cap".into(),
            Duration::from_secs(3600),
            now,
        );
        assert!(auth.link.is_empty());
        assert!(auth.authorized("saved-cap", now, true));
        assert!(!auth.authorized("other-cap", now, false));
        assert!(auth
            .pair("", "x".into(), "y".into(), "Other".into(), now)
            .is_err());
    }
}
