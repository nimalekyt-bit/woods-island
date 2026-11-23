//! Pure hook installation and cross-shell command construction.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{collections::HashMap, path::Path};

pub(super) const CLAUDE_EVENTS: &[&str] = &[
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "Notification",
    "PermissionRequest",
    "Stop",
    "SessionEnd",
];
pub(super) const CODEX_EVENTS: &[&str] = &[
    "UserPromptSubmit",
    "PermissionRequest",
    "PostToolUse",
    "Stop",
    "SessionEnd",
];
const LAUNCHER: &str = include_str!("../../../scripts/woods-agent-launch.ps1");

fn literal(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}
fn windows_arg(text: &str) -> Result<String, String> {
    if text.contains(['\0', '\r', '\n', '"']) {
        return Err("Invalid agent hook path".into());
    }
    // CommandLineToArgvW doubles backslashes before a closing quote.
    let trailing = text.chars().rev().take_while(|ch| *ch == '\\').count();
    Ok(format!("\"{text}{}\"", "\\".repeat(trailing)))
}

pub(super) fn command(
    node: &Path,
    bridge: &Path,
    directory: &Path,
    provider: &str,
    event: &str,
) -> Result<String, String> {
    if !["claude", "codex"].contains(&provider) || !CLAUDE_EVENTS.contains(&event) {
        return Err("Unknown agent hook".into());
    }
    let node = node.to_string_lossy();
    windows_arg(&node)?;
    let arguments = format!(
        "{} --provider {provider} --event {event} --data-dir {}",
        windows_arg(&bridge.to_string_lossy())?,
        windows_arg(&directory.to_string_lossy())?
    );
    let script = format!(
        "$woodsNode={};$woodsArguments={};\n{LAUNCHER}",
        literal(&node),
        literal(&arguments)
    );
    let encoded = STANDARD.encode(
        script
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>(),
    );
    Ok(format!("powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand {encoded}"))
}

fn decoded(command: &str) -> Option<String> {
    let mut words = command.split_whitespace();
    while let Some(word) = words.next() {
        if word.eq_ignore_ascii_case("-EncodedCommand") {
            let bytes = STANDARD.decode(words.next()?).ok()?;
            if bytes.len() % 2 != 0 {
                return None;
            }
            return String::from_utf16(
                &bytes
                    .chunks_exact(2)
                    .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
                    .collect::<Vec<_>>(),
            )
            .ok();
        }
    }
    None
}

pub(super) fn ours(command: &str, bridge: &Path) -> bool {
    let decoded = decoded(command);
    let text = decoded
        .as_deref()
        .unwrap_or(command)
        .replace("''", "'")
        .replace('\\', "/")
        .to_lowercase();
    let path = bridge.to_string_lossy().replace('\\', "/").to_lowercase();
    text == path
        || text.contains(&format!("\"{path}\""))
        || text.contains(&literal(&path))
        || text.split_whitespace().any(|word| word == path)
}

pub(super) fn expected(
    node: &Path,
    bridge: &Path,
    directory: &Path,
    provider: &str,
    events: &[&str],
) -> Result<HashMap<String, String>, String> {
    events
        .iter()
        .map(|event| {
            command(node, bridge, directory, provider, event)
                .map(|value| ((*event).to_owned(), value))
        })
        .collect()
}

pub(super) fn mutate(
    config: &mut Value,
    on: bool,
    events: &[&str],
    commands: &HashMap<String, String>,
    bridge: &Path,
    provider: &str,
) -> Result<(), String> {
    // Validate a copy so a malformed foreign group is preserved on error.
    let mut next = config.clone();
    let object = next
        .as_object_mut()
        .ok_or("Agent settings must be an object")?;
    if !object.contains_key("hooks") {
        if !on {
            return Ok(());
        }
        object.insert("hooks".into(), json!({}));
    }
    let hooks = object
        .get_mut("hooks")
        .and_then(Value::as_object_mut)
        .ok_or("Agent hooks must be an object")?;
    for groups in hooks.values_mut() {
        let groups = groups
            .as_array_mut()
            .ok_or("Agent hook event must be an array")?;
        for group in groups.iter_mut() {
            let list = group
                .get_mut("hooks")
                .and_then(Value::as_array_mut)
                .ok_or("Agent hook group must contain a hooks array")?;
            list.retain(|hook| {
                !hook
                    .get("command")
                    .and_then(Value::as_str)
                    .is_some_and(|command| ours(command, bridge))
            });
        }
        groups.retain(|group| {
            group["hooks"]
                .as_array()
                .is_some_and(|list| !list.is_empty())
        });
    }
    if on {
        for event in events {
            let timeout = if *event == "PermissionRequest"
                || provider == "claude" && *event == "PreToolUse"
            {
                125
            } else {
                10
            };
            let groups = hooks
                .entry((*event).to_owned())
                .or_insert_with(|| json!([]))
                .as_array_mut()
                .ok_or("Agent hook event must be an array")?;
            let mut group = json!({"hooks":[{"type":"command","command":commands.get(*event).ok_or("Missing hook command")?,"timeout":timeout}]});
            if provider == "claude" && *event == "PreToolUse" {
                group["matcher"] = json!("^AskUserQuestion$");
            }
            groups.push(group);
        }
    }
    *config = next;
    Ok(())
}

pub(super) fn status(
    config: &Value,
    commands: Option<&HashMap<String, String>>,
    bridge: &Path,
    events: &[&str],
) -> &'static str {
    let Some(hooks) = config["hooks"].as_object() else {
        return "off";
    };
    let owned = hooks.values().any(|groups| {
        groups.as_array().is_some_and(|groups| {
            groups.iter().any(|group| {
                group["hooks"].as_array().is_some_and(|items| {
                    items.iter().any(|item| {
                        item["command"]
                            .as_str()
                            .is_some_and(|command| ours(command, bridge))
                    })
                })
            })
        })
    });
    if !owned {
        return "off";
    }
    let current = commands.is_some_and(|commands| {
        events.iter().all(|event| {
            hooks
                .get(*event)
                .and_then(Value::as_array)
                .is_some_and(|groups| {
                    groups.iter().any(|group| {
                        group["hooks"].as_array().is_some_and(|items| {
                            items.iter().any(|item| {
                                item["type"] == "command"
                                    && item["command"].as_str()
                                        == commands.get(*event).map(String::as_str)
                            })
                        })
                    })
                })
        })
    });
    if current {
        "on"
    } else {
        "old"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn bridge() -> &'static Path {
        Path::new("E:\\Woods data\\island-notify.cjs")
    }
    fn commands(provider: &str, events: &[&str]) -> HashMap<String, String> {
        expected(
            Path::new("C:\\Program Files\\nodejs\\node.exe"),
            bridge(),
            Path::new("E:\\Woods data"),
            provider,
            events,
        )
        .unwrap()
    }
    #[test]
    fn commands_are_cross_shell_utf8_encoded_and_owned_with_literal_metacharacters() {
        let bridge = Path::new("E:\\User's data & $(untouched)\\island-notify.cjs");
        let value = command(
            Path::new("E:\\Node's directory\\node.exe"),
            bridge,
            Path::new("E:\\User's data & $(untouched)"),
            "codex",
            "PermissionRequest",
        )
        .unwrap();
        assert!(value.starts_with("powershell.exe "));
        assert!(!value.contains("$(untouched)"));
        assert!(ours(&value, bridge));
        let decoded = decoded(&value).unwrap();
        assert!(decoded.contains("Node''s directory"));
        assert!(decoded.contains("--provider codex --event PermissionRequest --data-dir"));
        assert!(!ours(
            &format!("node \"{}.other\"", bridge.display()),
            bridge
        ));
    }
    #[test]
    fn malformed_commands_paths_and_unknown_provider_cannot_launch() {
        assert!(command(
            Path::new("node\".exe"),
            bridge(),
            Path::new("data"),
            "codex",
            "Stop"
        )
        .is_err());
        assert!(command(
            Path::new("node.exe"),
            bridge(),
            Path::new("data"),
            "other",
            "Stop"
        )
        .is_err());
        assert!(!ours("powershell -EncodedCommand broken", bridge()));
    }
    #[test]
    fn claude_and_codex_refresh_preserve_foreign_hooks_and_unknown_events() {
        for (provider, events) in [("claude", CLAUDE_EVENTS), ("codex", CODEX_EVENTS)] {
            let commands = commands(provider, events);
            let foreign = json!({"permissions":{"allow":["Read"]},"hooks":{"Stop":[{"matcher":"*","hooks":[{"type":"command","command":"other-notify.exe","custom":true}]}],"ForeignEvent":[{"hooks":[{"type":"prompt","prompt":"preserve me"}]}]}});
            let mut config = foreign.clone();
            mutate(&mut config, true, events, &commands, bridge(), provider).unwrap();
            assert_eq!(status(&config, Some(&commands), bridge(), events), "on");
            let first = config.clone();
            mutate(&mut config, true, events, &commands, bridge(), provider).unwrap();
            assert_eq!(config, first);
            mutate(&mut config, false, events, &commands, bridge(), provider).unwrap();
            assert_eq!(config["permissions"], foreign["permissions"]);
            assert_eq!(config["hooks"]["Stop"], foreign["hooks"]["Stop"]);
            assert_eq!(
                config["hooks"]["ForeignEvent"],
                foreign["hooks"]["ForeignEvent"]
            );
            assert_eq!(status(&config, Some(&commands), bridge(), events), "off");
        }
    }
    #[test]
    fn previous_hooks_need_refresh_and_malformed_foreign_config_stays_unchanged() {
        let commands = commands("claude", CLAUDE_EVENTS);
        let mut config = json!({"hooks":{"Stop":[{"hooks":[{"type":"command","command":format!("node \"{}\" --event Stop",bridge().display())}]}]}});
        assert_eq!(
            status(&config, Some(&commands), bridge(), CLAUDE_EVENTS),
            "old"
        );
        config["hooks"]["ForeignEvent"] = json!("preserve invalid config");
        let before = config.clone();
        assert!(mutate(
            &mut config,
            true,
            CLAUDE_EVENTS,
            &commands,
            bridge(),
            "claude"
        )
        .is_err());
        assert_eq!(config, before);
    }
    #[test]
    fn question_hook_uses_pre_tool_use_and_full_reply_timeout() {
        let mut config = json!({});
        let commands = commands("claude", CLAUDE_EVENTS);
        mutate(
            &mut config,
            true,
            CLAUDE_EVENTS,
            &commands,
            bridge(),
            "claude",
        )
        .unwrap();
        assert_eq!(
            config["hooks"]["PreToolUse"][0]["matcher"],
            "^AskUserQuestion$"
        );
        assert_eq!(config["hooks"]["PreToolUse"][0]["hooks"][0]["timeout"], 125);
        assert!(config["hooks"]["SessionEnd"].is_array());
    }
}
