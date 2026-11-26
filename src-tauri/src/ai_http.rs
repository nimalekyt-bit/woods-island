use serde_json::{json, Value};

pub fn text(settings: &Value, ru: &str, en: &str) -> String {
    let russian = match settings["language"].as_str() {
        Some("ru") => true,
        Some("en") => false,
        _ => unsafe { windows::Win32::Globalization::GetUserDefaultUILanguage() & 0x3ff == 0x19 },
    };
    (if russian { ru } else { en }).to_owned()
}
pub fn proxy(value: &str) -> Result<(String, String), String> {
    if value.trim().is_empty() {
        return Ok((String::new(), String::new()));
    }
    let mut url = reqwest::Url::parse(value.trim()).map_err(|_| "Invalid AI proxy address")?;
    if !["http", "https", "socks5", "socks5h"].contains(&url.scheme())
        || url.host_str().is_none()
        || url.query().is_some()
        || url.fragment().is_some()
        || !["", "/"].contains(&url.path())
    {
        return Err(
            "AI proxy must be an HTTP, HTTPS, SOCKS5 or SOCKS5H address without a path".into(),
        );
    }
    let full = url.to_string();
    url.set_password(None).map_err(|_| "Invalid AI proxy")?;
    url.set_username("").map_err(|_| "Invalid AI proxy")?;
    Ok((url.to_string(), full))
}
pub fn client(settings: &Value, seconds: u64) -> Result<reqwest::Client, String> {
    client_for(settings,"aiBaseUrl",seconds)
}
pub fn client_for(settings:&Value,endpoint_key:&str,seconds:u64)->Result<reqwest::Client,String> {
    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(seconds))
        .connect_timeout(std::time::Duration::from_secs(8));
    let endpoint = settings[endpoint_key]
        .as_str()
        .and_then(|s| reqwest::Url::parse(s).ok());
    let local = endpoint.as_ref().is_some_and(|url| {
        matches!(
            url.host_str(),
            Some("localhost" | "127.0.0.1" | "::1" | "[::1]")
        )
    });
    if local {
        builder = builder.no_proxy();
    } else if let Some(configured) = settings["aiProxy"].as_str().filter(|s| !s.is_empty()) {
        let (public, _) = proxy(configured)?;
        let full = crate::storage::load_secret("ai-proxy")
            .and_then(|secret| {
                proxy(&secret)
                    .ok()
                    .filter(|(address, _)| *address == public)
                    .map(|(_, full)| full)
            })
            .unwrap_or(public);
        let proxy = reqwest::Proxy::all(full).map_err(|_| "Invalid AI proxy address")?;
        builder = builder.no_proxy().proxy(proxy);
    }
    builder.build().map_err(|_| {
        text(
            settings,
            "Не удалось подготовить соединение с ИИ.",
            "Could not prepare the AI connection.",
        )
    })
}
pub fn network_error(settings: &Value, error: &reqwest::Error) -> String {
    if error.is_timeout() {
        text(
            settings,
            "Сервис ИИ не ответил вовремя. Проверь соединение или попробуй ещё раз.",
            "The AI service timed out. Check the connection or try again.",
        )
    } else if error.is_connect() {
        text(settings,"Не удалось подключиться к ИИ. Проверь адрес API, интернет и настройки прокси.","Could not connect to AI. Check the API address, internet connection and proxy settings.")
    } else {
        text(
            settings,
            "Соединение с ИИ прервалось. Попробуй отправить запрос ещё раз.",
            "The AI connection was interrupted. Try sending the request again.",
        )
    }
}
pub fn status_error(settings: &Value, status: reqwest::StatusCode) -> String {
    match status.as_u16(){
        401=>text(settings,"Сервис ИИ не принял API-ключ. Проверь его в настройках ИИ.","The AI service rejected the API key. Check it in AI settings."),
        403=>text(settings,"Сервис ИИ запретил доступ. Проверь доступность сервиса и разрешения аккаунта.","The AI service denied access. Check service availability and account permissions."),
        404=>text(settings,"Адрес API или модель не найдены. Проверь их в настройках ИИ.","The API endpoint or model was not found. Check them in AI settings."),
        407=>text(settings,"Прокси требует авторизацию. Сохрани адрес с логином и паролем в настройках ИИ.","The proxy requires authentication. Save its address with a username and password in AI settings."),
        429=>text(settings,"Достигнут лимит сервиса ИИ. Подожди немного или выбери другую модель.","The AI service limit was reached. Wait a little or choose another model."),
        500..=599=>text(settings,"Сервис ИИ временно недоступен. Попробуй позже.","The AI service is temporarily unavailable. Try again later."),
        _=>text(settings,&format!("Сервис ИИ отклонил запрос (HTTP {}). Проверь адрес API и модель.",status.as_u16()),&format!("The AI service rejected the request (HTTP {}). Check the API endpoint and model.",status.as_u16()))
    }
}
pub fn with_date(mut messages: Vec<Value>, stamp: &str) -> Vec<Value> {
    messages.insert(0,json!({"role":"system","content":format!("Current local date and time on the user's computer: {stamp}. Use this for relative dates. This timestamp does not provide live news, weather or other current external facts.")}));
    messages
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn socks5h_uses_proxy_dns_and_receives_a_real_http_response() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut greeting = [0u8; 2];
            socket.read_exact(&mut greeting).await.unwrap();
            assert_eq!(greeting[0], 5);
            let mut methods = vec![0u8; greeting[1] as usize];
            socket.read_exact(&mut methods).await.unwrap();
            assert!(methods.contains(&0));
            socket.write_all(&[5, 0]).await.unwrap();
            let mut header = [0u8; 4];
            socket.read_exact(&mut header).await.unwrap();
            assert_eq!(header, [5, 1, 0, 3]);
            let size = socket.read_u8().await.unwrap();
            let mut host = vec![0u8; size as usize];
            socket.read_exact(&mut host).await.unwrap();
            assert_eq!(host, b"service.invalid");
            let _port = socket.read_u16().await.unwrap();
            socket
                .write_all(&[5, 0, 0, 1, 127, 0, 0, 1, 0, 0])
                .await
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                request.push(socket.read_u8().await.unwrap());
                assert!(request.len() < 8192);
            }
            assert!(request.starts_with(b"GET /models HTTP/1.1"));
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
                .await
                .unwrap();
        });
        let (_, full) = proxy(&format!("socks5h://{address}")).unwrap();
        let client = reqwest::Client::builder()
            .no_proxy()
            .proxy(reqwest::Proxy::all(full).unwrap())
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap();
        let response = client
            .get("http://service.invalid/models")
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert_eq!(response.text().await.unwrap(), "{}");
        tokio::time::timeout(std::time::Duration::from_secs(5), server)
            .await
            .unwrap()
            .unwrap();
    }
    #[test]
    fn credentials_are_removed_from_public_proxy_settings() {
        let (public, secret) = proxy("http://alice:p%40ss@127.0.0.1:7890").unwrap();
        assert_eq!(public, "http://127.0.0.1:7890/");
        assert!(secret.contains("alice:p%40ss@"));
        for bad in [
            "file:///tmp/proxy",
            "http://example.com/private",
            "http://example.com/?password=secret",
        ] {
            assert!(proxy(bad).is_err());
        }
        assert_eq!(proxy("").unwrap(), (String::new(), String::new()));
        assert!(proxy("socks5h://127.0.0.1:1080").is_ok());
    }
    #[test]
    fn date_is_request_context_and_does_not_replace_the_existing_conversation() {
        let original = vec![
            json!({"role":"system","content":"Reply in Russian"}),
            json!({"role":"user","content":"Завтра"}),
        ];
        let next = with_date(original.clone(), "2026-11-22T08:00:00+03:00");
        assert_eq!(&next[1..], original.as_slice());
        assert!(next[0]["content"].as_str().unwrap().contains("2026-11-22"));
    }
    #[test]
    fn provider_errors_are_specific_and_localized() {
        let ru = json!({"language":"ru"});
        assert!(status_error(&ru, reqwest::StatusCode::UNAUTHORIZED).contains("API-ключ"));
        assert!(status_error(
            &json!({"language":"en"}),
            reqwest::StatusCode::TOO_MANY_REQUESTS
        )
        .contains("limit"));
    }
}
