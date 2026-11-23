use crate::storage;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use toml_edit::{Array, DocumentMut};

#[path = "agents/hooks.rs"]
mod hooks;
use hooks::{CLAUDE_EVENTS, CODEX_EVENTS};

static LIVE: Mutex<Vec<Value>> = Mutex::new(Vec::new());
static CONFIG_LOCK: Mutex<()> = Mutex::new(());
static ASK_ENABLED: AtomicBool = AtomicBool::new(true);
pub fn configure(ask_enabled: bool) {
    ASK_ENABLED.store(ask_enabled, Ordering::Relaxed);
}
const BRIDGE: &str = include_str!("../../scripts/island-notify.cjs");
const MARKER: &str = "island-notify.cjs";
const OPENCODE_PLUGIN: &str = include_str!("../../scripts/woods-opencode-plugin.mjs");

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn home() -> PathBuf {
    std::env::var_os("WOODS_ISLAND_AGENT_HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(storage::get_storage_dir)
}
fn event_dir() -> PathBuf {
    storage::get_storage_dir().join("agents")
}
fn script_path() -> PathBuf {
    storage::get_storage_dir().join(MARKER)
}
fn provider_dir(provider: &str) -> PathBuf {
    let variable = match provider {
        "claude" => "WOODS_ISLAND_CLAUDE_DIR",
        "codex" => "WOODS_ISLAND_CODEX_DIR",
        _ => "WOODS_ISLAND_OPENCODE_DIR",
    };
    if let Some(path) = std::env::var_os(variable) {
        return PathBuf::from(path);
    }
    // A fixture home must never fall through into the owner's real config.
    if std::env::var_os("WOODS_ISLAND_AGENT_HOME").is_none() {
        if provider == "codex" {
            if let Some(path) = std::env::var_os("CODEX_HOME") {
                return PathBuf::from(path);
            }
        }
        if provider == "claude" {
            if let Some(path) = std::env::var_os("CLAUDE_CONFIG_DIR") {
                return PathBuf::from(path);
            }
        }
        if provider == "opencode" {
            if let Some(path) = std::env::var_os("XDG_CONFIG_HOME") {
                return PathBuf::from(path).join("opencode");
            }
        }
    }
    match provider {
        "claude" => home().join(".claude"),
        "codex" => home().join(".codex"),
        _ => home().join(".config/opencode"),
    }
}
fn node_path() -> Option<PathBuf> {
    if let Some(node) = std::env::var_os("WOODS_ISLAND_NODE")
        .map(PathBuf::from)
        .filter(|path| path.is_file())
    {
        return Some(node);
    }
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|directory| directory.join("node.exe"))
        .find(|path| path.is_file())
}
fn ours(command: &str) -> bool {
    hooks::ours(command, &script_path())
}
fn config_json(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Invalid agent config: {error}"))
}
fn backup(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::copy(
            path,
            PathBuf::from(format!("{}.woods-backup-{}", path.display(), now())),
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}
fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    storage::atomic_write(
        path,
        &serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
}
fn hook_commands(provider: &str, events: &[&str]) -> Result<HashMap<String, String>, String> {
    hooks::expected(
        &node_path().ok_or("Node.js is required for agent hooks")?,
        &script_path(),
        &storage::get_storage_dir(),
        provider,
        events,
    )
}

fn save_config(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if fs::read(path).is_ok_and(|old| old == bytes) {
        return Ok(());
    }
    backup(path)?;
    storage::atomic_write(path, bytes)
}

fn notify(document: &DocumentMut) -> Result<Option<Vec<String>>, String> {
    match document.get("notify") {
        None => Ok(None),
        Some(item) => item
            .as_array()
            .ok_or("Codex notify must be an array")?
            .iter()
            .map(|item| {
                item.as_str()
                    .map(str::to_owned)
                    .ok_or("Codex notify arguments must be strings".into())
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Some),
    }
}
fn set_notify(document: &mut DocumentMut, args: Option<&[String]>) {
    if let Some(args) = args {
        let mut values = Array::new();
        for arg in args {
            values.push(arg.as_str());
        }
        document["notify"] = toml_edit::value(values);
    } else {
        document.as_table_mut().remove("notify");
    }
}

pub fn connections() -> Value {
    let claude_dir = provider_dir("claude");
    let claude = if !claude_dir.is_dir() {
        "missing"
    } else {
        let commands = hook_commands("claude", CLAUDE_EVENTS).ok();
        config_json(&claude_dir.join("settings.json"))
            .map(|config| hooks::status(&config, commands.as_ref(), &script_path(), CLAUDE_EVENTS))
            .unwrap_or("off")
    };
    let codex_dir = provider_dir("codex");
    let codex = if !codex_dir.is_dir() {
        "missing"
    } else {
        let commands = hook_commands("codex", CODEX_EVENTS).ok();
        let status = config_json(&codex_dir.join("hooks.json"))
            .map(|config| hooks::status(&config, commands.as_ref(), &script_path(), CODEX_EVENTS))
            .unwrap_or("off");
        if status == "off"
            && fs::read_to_string(codex_dir.join("config.toml"))
                .ok()
                .and_then(|text| text.parse::<DocumentMut>().ok())
                .and_then(|doc| notify(&doc).ok().flatten())
                .is_some_and(|args| args.iter().any(|arg| ours(arg)))
        {
            "old"
        } else {
            status
        }
    };
    let opencode_dir = provider_dir("opencode");
    let plugin = opencode_dir.join("plugins/woods-island.js");
    let opencode = if !opencode_dir.exists() {
        "missing"
    } else {
        match fs::read_to_string(plugin) {
            Ok(text) if text.contains("Woods Island bridge 2.") => "on",
            Ok(text) if text.contains("Woods Island bridge") => "old",
            _ => "off",
        }
    };
    json!({"claude":claude,"codex":codex,"opencode":opencode})
}

pub fn connect(agent: &str, on: bool, beside: bool) -> Result<Value, String> {
    let _guard = CONFIG_LOCK
        .lock()
        .map_err(|_| "Agent config lock poisoned")?;
    let _ = beside; // Kept for existing IPC clients; native hooks coexist with notify.
    if on {
        storage::atomic_write(&script_path(), BRIDGE.as_bytes())?;
    }
    match agent {
        "claude" => {
            let folder = provider_dir("claude");
            if !folder.is_dir() {
                return Err("Claude Code settings directory was not found".into());
            }
            let path = folder.join("settings.json");
            let mut config = config_json(&path)?;
            let before = config.clone();
            let commands = if on {
                hook_commands("claude", CLAUDE_EVENTS)?
            } else {
                HashMap::new()
            };
            hooks::mutate(
                &mut config,
                on,
                CLAUDE_EVENTS,
                &commands,
                &script_path(),
                "claude",
            )?;
            if config != before {
                save_config(
                    &path,
                    &serde_json::to_vec_pretty(&config).map_err(|error| error.to_string())?,
                )?;
            }
        }
        "codex" => {
            let folder = provider_dir("codex");
            if !folder.is_dir() {
                return Err("Codex settings directory was not found".into());
            }
            let path = folder.join("hooks.json");
            let mut config = config_json(&path)?;
            let before = config.clone();
            let commands = if on {
                hook_commands("codex", CODEX_EVENTS)?
            } else {
                HashMap::new()
            };
            hooks::mutate(
                &mut config,
                on,
                CODEX_EVENTS,
                &commands,
                &script_path(),
                "codex",
            )?;
            let notify_path = folder.join("config.toml");
            let mut migrated = None;
            if notify_path.exists() {
                let text = fs::read_to_string(&notify_path).map_err(|error| error.to_string())?;
                let mut document = text
                    .parse::<DocumentMut>()
                    .map_err(|error| error.to_string())?;
                if notify(&document)?.is_some_and(|args| args.iter().any(|arg| ours(arg))) {
                    let chain = storage::get_storage_dir().join("codex-notify-chain.json");
                    let value:Value=serde_json::from_slice(&fs::read(&chain).map_err(|_|"The previous Codex notify program could not be restored; configuration was preserved")?).map_err(|_|"Invalid previous Codex notify program")?;
                    let restore = if value.is_null() {
                        None
                    } else {
                        Some(
                            value
                                .as_array()
                                .ok_or("Invalid previous Codex notify program")?
                                .iter()
                                .map(|item| {
                                    item.as_str()
                                        .map(str::to_owned)
                                        .ok_or("Invalid previous Codex notify argument")
                                })
                                .collect::<Result<Vec<_>, _>>()?,
                        )
                    };
                    if restore
                        .as_ref()
                        .is_some_and(|args| args.iter().any(|arg| ours(arg)))
                    {
                        return Err("A cyclic Codex notify chain was preserved".into());
                    }
                    set_notify(&mut document, restore.as_deref());
                    migrated = Some(document.to_string());
                }
            }
            // All configuration is validated before either file is changed.
            let previous_hooks = fs::read(&path).ok();
            if config != before {
                save_config(
                    &path,
                    &serde_json::to_vec_pretty(&config).map_err(|error| error.to_string())?,
                )?;
            }
            if let Some(text) = migrated {
                if let Err(error) = save_config(&notify_path, text.as_bytes()) {
                    if let Some(bytes) = previous_hooks {
                        let _ = storage::atomic_write(&path, &bytes);
                    } else {
                        let _ = fs::remove_file(&path);
                    }
                    return Err(error);
                }
            }
        }
        "opencode" => {
            let folder = provider_dir("opencode");
            if !folder.exists() {
                return Err("opencode settings directory was not found".into());
            }
            let path = folder.join("plugins/woods-island.js");
            if on {
                if path.exists()
                    && !fs::read_to_string(&path)
                        .is_ok_and(|text| text.contains("Woods Island bridge"))
                {
                    return Err("An unrelated woods-island plugin exists; it was preserved".into());
                }
                let plugin = OPENCODE_PLUGIN
                    .replace(
                        "__WOODS_NODE__",
                        &serde_json::to_string(
                            &node_path().ok_or("Node.js is required")?.to_string_lossy(),
                        )
                        .unwrap(),
                    )
                    .replace(
                        "__WOODS_BRIDGE__",
                        &serde_json::to_string(&script_path().to_string_lossy()).unwrap(),
                    )
                    .replace(
                        "__WOODS_DATA_DIR__",
                        &serde_json::to_string(&storage::get_storage_dir().to_string_lossy())
                            .unwrap(),
                    );
                save_config(&path, plugin.as_bytes())?;
            } else if path.exists()
                && fs::read_to_string(&path).is_ok_and(|text| text.contains("Woods Island bridge"))
            {
                fs::remove_file(path).map_err(|error| error.to_string())?;
            }
        }
        _ => return Err("Unknown agent provider".into()),
    }
    Ok(connections())
}

pub fn current() -> Vec<Value> {
    LIVE.lock().map(|live| live.clone()).unwrap_or_default()
}
fn valid_request_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}
fn question_answers(questions: &Value, answers: &Value) -> Result<Value, String> {
    let questions = questions
        .as_array()
        .filter(|questions| !questions.is_empty() && questions.len() <= 4)
        .ok_or("Invalid agent questions")?;
    let answers = answers
        .as_object()
        .ok_or("Question answers must be an object")?;
    if answers.len() != questions.len() {
        return Err("Every question must have exactly one answer entry".into());
    }
    let mut normalized = serde_json::Map::new();
    for question in questions {
        let key = question["question"]
            .as_str()
            .filter(|key| !key.is_empty())
            .ok_or("Question text is missing")?;
        if normalized.contains_key(key) {
            return Err("Duplicate question text".into());
        }
        let options = question["options"]
            .as_array()
            .filter(|options| !options.is_empty())
            .ok_or("Question options are missing")?;
        let labels = options
            .iter()
            .map(|option| {
                option["label"]
                    .as_str()
                    .filter(|label| !label.is_empty())
                    .ok_or("Invalid question option")
            })
            .collect::<Result<Vec<_>, _>>()?;
        let multi = match question.get("multiSelect") {
            None => false,
            Some(value) => value.as_bool().ok_or("Invalid multiSelect flag")?,
        };
        let value = answers
            .get(key)
            .ok_or("An expected question answer is missing")?;
        let selections = match value {
            Value::Array(values) => values
                .iter()
                .map(|value| value.as_str().ok_or("Selected options must be strings"))
                .collect::<Result<Vec<_>, _>>()?,
            Value::String(value) if labels.contains(&value.as_str()) => vec![value.as_str()],
            Value::String(value) if multi => value.split(", ").collect(),
            _ => return Err("Question answer must contain selected options".into()),
        };
        if selections.is_empty() || (!multi && selections.len() != 1) {
            return Err("Invalid number of selected options".into());
        }
        let mut unique = HashSet::new();
        for selection in &selections {
            if !labels.contains(selection) || !unique.insert(*selection) {
                return Err("Unknown or duplicate selected option".into());
            }
        }
        normalized.insert(key.to_owned(), json!(selections));
    }
    Ok(Value::Object(normalized))
}

fn prepare_answer(
    pending: &Value,
    verdict: &str,
    answers: Option<Value>,
    at: u64,
) -> Result<Value, String> {
    if pending["until"].as_u64().unwrap_or(0) <= at {
        return Err("The agent request has expired".into());
    }
    let normalized = if verdict == "answer" {
        if pending["kind"] != "question" {
            return Err("This request does not accept question answers".into());
        }
        Some(question_answers(
            &pending["questions"],
            &answers.ok_or("Question answers are required")?,
        )?)
    } else {
        if answers.as_ref().is_some_and(|value| !value.is_null()) {
            return Err("Permission replies cannot contain answers".into());
        }
        if verdict == "allow" && pending["kind"] == "question" {
            return Err("Select an answer or continue in the terminal".into());
        }
        None
    };
    Ok(json!({"verdict":verdict,"answers":normalized,"at":at}))
}

pub fn answer(id: &str, verdict: &str, answers: Option<Value>) -> Result<bool, String> {
    if !valid_request_id(id) {
        return Err("Invalid request ID".into());
    }
    if !["allow", "deny", "terminal", "answer"].contains(&verdict) {
        return Err("Invalid verdict".into());
    }
    let live = LIVE.lock().map_err(|_| "Agent state lock poisoned")?;
    let pending = live
        .iter()
        .find_map(|event| {
            event
                .get("ask")
                .filter(|ask| ask["id"].as_str() == Some(id))
        })
        .ok_or("The agent request has expired")?;
    let value = prepare_answer(pending, verdict, answers, now())?;
    let destination = event_dir().join("answers").join(format!("{id}.json"));
    if destination.exists() {
        return Err("The agent request was already answered".into());
    }
    write_json(&destination, &value)?;
    Ok(true)
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let directory = event_dir();
        let _ = fs::create_dir_all(&directory);
        let mut seen_asks = HashSet::new();
        let mut finished_asks = HashSet::new();
        let mut seen_cards = HashSet::new();
        let mut previous = Vec::<Value>::new();
        let mut cache = HashMap::<PathBuf, (SystemTime, u64, Option<Value>)>::new();
        let mut heartbeat_at = 0u64;
        loop {
            let at = now();
            if at.saturating_sub(heartbeat_at) >= 1000 {
                let _ = write_json(
                    &directory.join("heartbeat.json"),
                    &json!({"at":at,"ask":ASK_ENABLED.load(Ordering::Relaxed)}),
                );
                heartbeat_at = at;
            }
            let mut live = Vec::new();
            let mut present = HashSet::new();
            if let Ok(entries) = fs::read_dir(&directory) {
                for entry in entries.flatten().take(1000) {
                    let path = entry.path();
                    if path.file_name().and_then(|name| name.to_str()) == Some("heartbeat.json")
                        || path.extension().and_then(|ext| ext.to_str()) != Some("json")
                    {
                        continue;
                    }
                    let Ok(metadata) = entry.metadata() else {
                        continue;
                    };
                    if metadata.len() > 65536 {
                        continue;
                    }
                    let stamp = metadata.modified().unwrap_or(UNIX_EPOCH);
                    present.insert(path.clone());
                    let changed = cache.get(&path).is_none_or(|(modified, size, _)| {
                        *modified != stamp || *size != metadata.len()
                    });
                    if changed {
                        cache.insert(
                            path.clone(),
                            (stamp, metadata.len(), config_json(&path).ok()),
                        );
                    }
                    if let Some(event) = cache.get(&path).and_then(|(_, _, event)| event.as_ref()) {
                        let age = at.saturating_sub(event["at"].as_u64().unwrap_or(0));
                        let ttl = if event["state"] == "done" || event["state"] == "error" {
                            15000
                        } else {
                            600000
                        };
                        if age <= ttl
                            && ["working", "waiting", "done", "error"]
                                .contains(&event["state"].as_str().unwrap_or(""))
                            && ["claude", "codex", "opencode"]
                                .contains(&event["agent"].as_str().unwrap_or(""))
                        {
                            live.push(event.clone());
                        }
                    }
                }
            }
            cache.retain(|path, _| present.contains(path));
            live.sort_by_key(|event| event["at"].as_u64().unwrap_or(0));
            if live != previous {
                if let Ok(mut state) = LIVE.lock() {
                    *state = live.clone();
                }
            }
            for event in &live {
                if let Some(ask) = event.get("ask") {
                    if let Some(id) = ask["id"].as_str().filter(|id| valid_request_id(id)) {
                        let finished = directory
                            .join("answers")
                            .join(format!("{id}.json"))
                            .exists()
                            || ask["until"].as_u64().unwrap_or(0) <= now();
                        if finished {
                            if finished_asks.insert(id.to_owned()) {
                                let _ = app.emit("agents:ask-done", id);
                            }
                        } else if seen_asks.insert(id.to_owned()) {
                            let _ = app.emit("agents:ask", ask);
                        }
                    }
                }
                if event["state"] == "done"
                    || event["state"] == "error"
                    || event["state"] == "waiting" && event.get("ask").is_none()
                {
                    let id = format!("{}:{}", event["id"], event["at"]);
                    if seen_cards.insert(id) {
                        let _ = app.emit("agents:card", event);
                    }
                }
            }
            for ask in previous.iter().filter_map(|event| event.get("ask")) {
                if let Some(id) = ask["id"].as_str().filter(|id| valid_request_id(id)) {
                    if !live
                        .iter()
                        .any(|event| event["ask"]["id"].as_str() == Some(id))
                        && finished_asks.insert(id.to_owned())
                    {
                        let _ = app.emit("agents:ask-done", id);
                    }
                }
            }
            if live != previous {
                let _ = app.emit("agents:update", &live);
                previous = live;
            }
            if seen_cards.len() > 1000 {
                seen_cards.clear();
            }
            if seen_asks.len() > 1000 {
                seen_asks.clear();
            }
            if finished_asks.len() > 1000 {
                finished_asks.clear();
            }
            let pending = previous.iter().any(|event| {
                event.get("ask").is_some_and(|ask| {
                    ask["until"].as_u64().unwrap_or(0) > at
                        && !finished_asks.contains(ask["id"].as_str().unwrap_or(""))
                })
            });
            std::thread::sleep(Duration::from_millis(if pending { 400 } else { 1000 }));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn questions() -> Value {
        json!([
            {"question":"Какой режим?","options":[{"label":"Быстро"},{"label":"Качественно"}],"multiSelect":false},
            {"question":"Что включить?","options":[{"label":"A, B"},{"label":"C"},{"label":"D"}],"multiSelect":true}
        ])
    }
    #[test]
    fn question_answers_preserve_unicode_comma_labels_and_multiselect() {
        assert_eq!(
            question_answers(
                &questions(),
                &json!({"Какой режим?":"Качественно","Что включить?":["A, B","C"]})
            )
            .unwrap(),
            json!({"Какой режим?":["Качественно"],"Что включить?":["A, B","C"]})
        );
        assert_eq!(
            question_answers(
                &questions(),
                &json!({"Какой режим?":"Быстро","Что включить?":"C, D"})
            )
            .unwrap()["Что включить?"],
            json!(["C", "D"])
        );
    }
    #[test]
    fn question_answers_reject_missing_foreign_duplicate_wrong_type_and_single_multi_values() {
        for answers in [
            json!({"Какой режим?":"Быстро"}),
            json!({"Какой режим?":"Быстро","Другой":"C"}),
            json!({"Какой режим?":["Быстро","Качественно"],"Что включить?":["C"]}),
            json!({"Какой режим?":"Быстро","Что включить?":["C","C"]}),
            json!({"Какой режим?":"Быстро","Что включить?":["missing"]}),
            json!({"Какой режим?":"Быстро","Что включить?":[]}),
            json!({"Какой режим?":true,"Что включить?":["C"]}),
            json!({"Какой режим?":"Быстро","Что включить?":["C"],"extra":"D"}),
        ] {
            assert!(
                question_answers(&questions(), &answers).is_err(),
                "{answers}"
            );
        }
    }
    #[test]
    fn answer_contract_enforces_request_kind_and_expiry() {
        let permission = json!({"kind":"permission","until":100});
        assert_eq!(
            prepare_answer(&permission, "allow", None, 99).unwrap()["verdict"],
            "allow"
        );
        assert!(prepare_answer(&permission, "allow", None, 100).is_err());
        assert!(prepare_answer(&permission, "answer", Some(json!({})), 99).is_err());
        assert!(prepare_answer(&permission, "deny", Some(json!({"extra":true})), 99).is_err());
        let question = json!({"kind":"question","until":100,"questions":questions()});
        assert!(prepare_answer(&question, "allow", None, 99).is_err());
        assert!(prepare_answer(
            &question,
            "answer",
            Some(json!({"Какой режим?":"Быстро","Что включить?":["C"]})),
            99
        )
        .is_ok());
    }
    #[test]
    fn permission_ids_cannot_escape_the_answer_directory() {
        assert!(valid_request_id("01a1cb92-4ea1-7620-bdca-79aa122878ff"));
        for id in [
            "",
            "../outside",
            "..\\outside",
            "C:\\outside",
            "request.json",
            "request/other",
        ] {
            assert!(!valid_request_id(id));
        }
        assert!(!valid_request_id(&"x".repeat(81)));
    }
    #[test]
    fn claude_hooks_preserve_unrelated_config_and_are_idempotent() {
        let mut config = json!({"permissions":{"allow":["Read"]},"hooks":{"Stop":[{"hooks":[{"type":"command","command":"original-notify.exe"}]}]}});
        let commands = CLAUDE_EVENTS
            .iter()
            .map(|event| {
                (
                    (*event).to_string(),
                    format!("node \"{}\" --event {event}", script_path().display()),
                )
            })
            .collect();
        hooks::mutate(
            &mut config,
            true,
            CLAUDE_EVENTS,
            &commands,
            &script_path(),
            "claude",
        )
        .unwrap();
        let first = config.clone();
        hooks::mutate(
            &mut config,
            true,
            CLAUDE_EVENTS,
            &commands,
            &script_path(),
            "claude",
        )
        .unwrap();
        assert_eq!(config, first);
        hooks::mutate(
            &mut config,
            false,
            CLAUDE_EVENTS,
            &commands,
            &script_path(),
            "claude",
        )
        .unwrap();
        assert_eq!(config["permissions"]["allow"], json!(["Read"]));
        assert_eq!(
            config["hooks"]["Stop"][0]["hooks"][0]["command"],
            "original-notify.exe"
        );
    }
    #[test]
    fn codex_notify_preserves_other_sections_comments_and_multiline_arrays() {
        let original="# user settings\nmodel = 'example'\nnotify = [\n  'other.exe',\n  '--flag',\n]\n[projects.'C:\\Projects']\ntrust_level = 'trusted'\n";
        let mut doc = original.parse::<DocumentMut>().unwrap();
        let old = notify(&doc).unwrap().unwrap();
        assert_eq!(old, vec!["other.exe", "--flag"]);
        set_notify(
            &mut doc,
            Some(&["node.exe".into(), "island-notify.cjs".into()]),
        );
        assert!(doc.to_string().contains("# user settings"));
        assert_eq!(doc["model"].as_str(), Some("example"));
        set_notify(&mut doc, Some(&old));
        assert_eq!(notify(&doc).unwrap(), Some(old));
        assert_eq!(
            doc["projects"]["C:\\Projects"]["trust_level"].as_str(),
            Some("trusted")
        );
    }
}
