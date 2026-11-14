//! Local, deliberately small support data. No paths, document names or secret values.
use serde_json::{json, Value};
use crate::AppState;

pub fn summary(state: &AppState) -> Value {
    let settings = state.settings.lock().unwrap().clone();
    let english = settings["language"] == "en";
    let text = |ru: &str, en: &str| if english { en.to_owned() } else { ru.to_owned() };
    let mut modules = Vec::new();
    let mut add = |id: &str, status: &str, detail: String| modules.push(json!({"id":id,"status":status,"detail":detail}));
    add("webview", "ready", text("Интерфейс работает на WebView2.", "The interface is running on WebView2."));
    let media = crate::media::get_current_media();
    add("media", if media.is_none() { "unavailable" } else { "ready" }, text("Плеер должен публиковать медиасессию Windows.", "Your player must publish a Windows media session."));
    let bridge = crate::music_bridge::diagnostics();
    add("yandex", if bridge["connected"] == true { "ready" } else if bridge["problem"].is_string() { "error" } else { "unavailable" },
        text("Для отдельного коннектора запусти поддерживаемый плеер. Отсутствие трека не означает ошибку.", "Start a supported player for the optional connector. No active track does not mean a fault."));
    add("ffmpeg", if crate::recorder::executable().is_ok() { "ready" } else { "unavailable" },
        text("Инструменты записи входят в Setup и полный portable-архив.", "Recording tools are included in Setup and the complete portable archive."));
    let ai_configured = !settings["aiBaseUrl"].as_str().unwrap_or_default().is_empty() && !settings["aiModel"].as_str().unwrap_or_default().is_empty();
    add("ai", if ai_configured { "ready" } else { "notConfigured" }, text("Проверку ответа модели запускай в настройках ИИ. Здесь проверена только конфигурация.", "Run the model response test in AI settings. Only the configuration is checked here."));
    add("obs", if settings["obsStatus"] == true { "ready" } else { "notConfigured" }, text("Статус соединения показан на панели OBS; эта строка проверяет включение интеграции.", "The OBS panel shows its connection status; this row checks whether the integration is enabled."));
    add("notifications", if crate::notifications::access() { "ready" } else { "notConfigured" }, text("Разрешение Windows запрашивается отдельно в настройках событий.", "Windows permission is requested separately in event settings."));
    let connections = crate::agents::connections();
    let hooks = connections.as_object().is_some_and(|items| items.values().any(|v| v == "on"));
    add("agents", if hooks { "ready" } else { "notConfigured" }, text("Hooks настраиваются отдельно и требуют Node.js. Базовому приложению он не нужен.", "Hooks are configured separately and require Node.js. The base app does not need it."));
    add("hotkeys", if state.hotkey_errors.lock().unwrap().is_empty() { "ready" } else { "error" }, text("Конфликты сочетаний показаны в настройках горячих клавиш.", "Shortcut conflicts are shown in hotkey settings."));
    add("clipboard", if state.clipboard_store.is_temporary() { "error" } else { "ready" }, if state.clipboard_store.is_temporary() {
        text("История временная: исходная база сохранена. Проверь доступ к профилю и перезапусти приложение.", "History is temporary: the original database is preserved. Check profile access and restart the app.")
    } else { text("История сохраняется локально.", "History is stored locally.") });
    let recovery = crate::storage::recovery_warnings().into_iter().map(|message| json!({"kind":"storage","message":message})).collect::<Vec<_>>();
    json!({"version":env!("CARGO_PKG_VERSION"),"os":format!("Windows {}",std::env::consts::ARCH),
        "webview":tauri::webview_version().unwrap_or_else(|_|"unavailable".into()),"modules":modules,"recovery":recovery})
}
