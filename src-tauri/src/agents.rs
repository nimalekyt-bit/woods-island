use crate::storage;
use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}, sync::Mutex, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Emitter};
use toml_edit::{Array, DocumentMut};

static LIVE: Mutex<Vec<Value>> = Mutex::new(Vec::new());
static CONFIG_LOCK: Mutex<()> = Mutex::new(());
const BRIDGE: &str = include_str!("../../scripts/island-notify.cjs");
const MARKER: &str = "island-notify.cjs";
const CLAUDE_EVENTS: &[&str] = &["UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification", "PermissionRequest", "Stop"];

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }
fn home() -> PathBuf { std::env::var_os("WOODS_ISLAND_AGENT_HOME").or_else(||std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(storage::get_storage_dir) }
fn event_dir() -> PathBuf { storage::get_storage_dir().join("agents") }
fn script_path() -> PathBuf { storage::get_storage_dir().join(MARKER) }
fn node_path() -> Option<PathBuf> {
    if let Some(node) = std::env::var_os("WOODS_ISLAND_NODE").map(PathBuf::from).filter(|path|path.is_file()) { return Some(node); }
    std::env::split_paths(&std::env::var_os("PATH")?).map(|directory| directory.join("node.exe")).find(|path|path.is_file())
}
fn ours(command: &str) -> bool {
    command.replace('\\', "/").to_lowercase().contains(&script_path().to_string_lossy().replace('\\', "/").to_lowercase())
}
fn config_json(path: &Path) -> Result<Value,String> {
    if !path.exists() { return Ok(json!({})); }
    serde_json::from_slice(&fs::read(path).map_err(|error|error.to_string())?).map_err(|error|format!("Invalid agent config: {error}"))
}
fn backup(path: &Path) -> Result<(),String> {
    if path.exists() { fs::copy(path,PathBuf::from(format!("{}.woods-backup-{}",path.display(),now()))).map_err(|error|error.to_string())?; }
    Ok(())
}
fn write_json(path:&Path,value:&Value)->Result<(),String>{storage::atomic_write(path,&serde_json::to_vec_pretty(value).map_err(|error|error.to_string())?)}
fn command(event: &str) -> Result<String,String> {
    let node=node_path().ok_or("Node.js is required for agent hooks")?;
    Ok(format!("\"{}\" \"{}\" --provider claude --event {}",node.display(),script_path().display(),event))
}

fn claude_hooks(config:&mut Value,on:bool,commands:&HashMap<String,String>) -> Result<(),String> {
    let object=config.as_object_mut().ok_or("Claude settings must be an object")?;
    if !object.contains_key("hooks") { if !on {return Ok(());} object.insert("hooks".into(),json!({})); }
    let hooks=object.get_mut("hooks").and_then(Value::as_object_mut).ok_or("Claude hooks must be an object")?;
    for event in CLAUDE_EVENTS {
        if let Some(groups)=hooks.get_mut(*event) {
            let groups=groups.as_array_mut().ok_or("Claude hook event must be an array")?;
            for group in groups.iter_mut() {
                if let Some(list)=group.get_mut("hooks").and_then(Value::as_array_mut) {
                    list.retain(|hook| !hook.get("command").and_then(Value::as_str).is_some_and(ours));
                }
            }
            groups.retain(|group|group.get("hooks").and_then(Value::as_array).is_none_or(|list|!list.is_empty()));
        }
        if on {
            let groups=hooks.entry((*event).to_owned()).or_insert_with(||json!([])).as_array_mut().ok_or("Claude hook event must be an array")?;
            groups.push(json!({"matcher":"*","hooks":[{"type":"command","command":commands.get(*event).ok_or("Missing hook command")?,"timeout":if *event=="PermissionRequest"{125}else{10}}]}));
        }
    }
    Ok(())
}

fn notify(document:&DocumentMut)->Result<Option<Vec<String>>,String>{
    match document.get("notify") {
        None=>Ok(None),
        Some(item)=>item.as_array().ok_or("Codex notify must be an array")?.iter().map(|item|item.as_str().map(str::to_owned).ok_or("Codex notify arguments must be strings".into())).collect::<Result<Vec<_>,_>>().map(Some),
    }
}
fn set_notify(document:&mut DocumentMut,args:Option<&[String]>){
    if let Some(args)=args { let mut values=Array::new();for arg in args {values.push(arg.as_str());}document["notify"]=toml_edit::value(values); }
    else {document.as_table_mut().remove("notify");}
}

pub fn connections()->Value{
    let directory=home();
    let claude_path=directory.join(".claude/settings.json");
    let claude=if !directory.join(".claude").is_dir(){"missing"}else{
        config_json(&claude_path).ok().and_then(|config|config["hooks"].as_object().map(|hooks|hooks.values().any(|groups|groups.as_array().is_some_and(|groups|groups.iter().any(|group|group["hooks"].as_array().is_some_and(|hooks|hooks.iter().any(|hook|hook["command"].as_str().is_some_and(ours)))))))).map(|on|if on{"on"}else{"off"}).unwrap_or("off")
    };
    let codex_path=directory.join(".codex/config.toml");
    let codex=if !codex_path.exists(){"missing"}else{
        fs::read_to_string(&codex_path).ok().and_then(|text|text.parse::<DocumentMut>().ok()).and_then(|doc|notify(&doc).ok()).map(|args|match args{Some(args)if args.iter().any(|arg|ours(arg))=>"on",Some(args)if !args.is_empty()=>"taken",_=>"off"}).unwrap_or("off")
    };
    let opencode_dir=directory.join(".config/opencode");
    let plugin=opencode_dir.join("plugins/woods-island.js");
    let opencode=if !opencode_dir.exists(){"missing"}else if fs::read_to_string(plugin).is_ok_and(|text|text.contains("Woods Island bridge")){"on"}else{"off"};
    json!({"claude":claude,"codex":codex,"opencode":opencode})
}

pub fn connect(agent:&str,on:bool,beside:bool)->Result<Value,String>{
    let _guard=CONFIG_LOCK.lock().map_err(|_|"Agent config lock poisoned")?;
    let directory=home();
    if on {storage::atomic_write(&script_path(),BRIDGE.as_bytes())?;}
    match agent {
        "claude"=>{
            if !directory.join(".claude").exists(){return Err("Claude Code settings directory was not found".into());}
            let path=directory.join(".claude/settings.json");let mut config=config_json(&path)?;
            let mut commands=HashMap::new();if on{for event in CLAUDE_EVENTS{commands.insert((*event).to_owned(),command(event)?);}}
            claude_hooks(&mut config,on,&commands)?;backup(&path)?;write_json(&path,&config)?;
        }
        "codex"=>{
            let path=directory.join(".codex/config.toml");let text=fs::read_to_string(&path).map_err(|_|"Codex config.toml was not found")?;
            let mut document=text.parse::<DocumentMut>().map_err(|error|error.to_string())?;
            let previous=notify(&document)?;let owned=previous.as_ref().is_some_and(|args|args.iter().any(|arg|ours(arg)));
            let chain=storage::get_storage_dir().join("codex-notify-chain.json");
            if on {
                if !owned && previous.as_ref().is_some_and(|args|!args.is_empty())&&!beside{return Err("Codex has an existing notify program; choose Connect beside it".into());}
                if !owned{write_json(&chain,&json!(previous))?;}
                let args=vec![node_path().ok_or("Node.js is required")?.to_string_lossy().into_owned(),script_path().to_string_lossy().into_owned(),"--provider".into(),"codex".into()];
                set_notify(&mut document,Some(&args));
            } else if owned {
                let restore=config_json(&chain)?;
                let restored=restore.as_array().map(|items|items.iter().filter_map(Value::as_str).map(str::to_owned).collect::<Vec<_>>());
                set_notify(&mut document,restored.as_deref());
            } else {return Ok(connections());}
            backup(&path)?;storage::atomic_write(&path,document.to_string().as_bytes())?;
        }
        "opencode"=>{
            let folder=directory.join(".config/opencode");if !folder.exists(){return Err("opencode settings directory was not found".into());}
            let path=folder.join("plugins/woods-island.js");
            if on {
                if path.exists()&&!fs::read_to_string(&path).is_ok_and(|text|text.contains("Woods Island bridge")){return Err("An unrelated woods-island plugin exists; it was preserved".into());}
                let node=node_path().ok_or("Node.js is required")?.to_string_lossy().into_owned();let script=script_path().to_string_lossy().into_owned();
                let plugin=format!("// Woods Island bridge\nimport {{ spawn }} from 'node:child_process';\nexport const WoodsIsland = async ({{ directory }}) => ({{ event: async ({{ event }}) => {{ if (!['session.status','session.idle','session.error','permission.asked'].includes(event.type)) return; const payload = {{ ...event.properties, directory, message:event.type }}; const child = spawn({}, [{}, '--provider', 'opencode', '--event', event.type, JSON.stringify(payload)], {{ windowsHide:true, stdio:'ignore' }}); child.on('error', () => {{}}); }} }});\n",serde_json::to_string(&node).unwrap(),serde_json::to_string(&script).unwrap());
                backup(&path)?;storage::atomic_write(&path,plugin.as_bytes())?;
            }else if path.exists()&&fs::read_to_string(&path).is_ok_and(|text|text.contains("Woods Island bridge")){fs::remove_file(path).map_err(|error|error.to_string())?;}
        }
        _=>return Err("Unknown agent provider".into()),
    }
    Ok(connections())
}

pub fn current()->Vec<Value>{LIVE.lock().map(|live|live.clone()).unwrap_or_default()}
fn valid_request_id(id:&str)->bool{!id.is_empty()&&id.len()<=80&&id.chars().all(|c|c.is_ascii_alphanumeric()||c=='-')}
fn question_answers(questions: &Value, answers: &Value) -> Result<Value, String> {
    let questions = questions.as_array().filter(|questions| !questions.is_empty() && questions.len() <= 4).ok_or("Invalid agent questions")?;
    let answers = answers.as_object().ok_or("Question answers must be an object")?;
    if answers.len() != questions.len() { return Err("Every question must have exactly one answer entry".into()); }
    let mut normalized = serde_json::Map::new();
    for question in questions {
        let key = question["question"].as_str().filter(|key| !key.is_empty()).ok_or("Question text is missing")?;
        if normalized.contains_key(key) { return Err("Duplicate question text".into()); }
        let options = question["options"].as_array().filter(|options| !options.is_empty()).ok_or("Question options are missing")?;
        let labels = options.iter().map(|option| option["label"].as_str().filter(|label| !label.is_empty()).ok_or("Invalid question option")).collect::<Result<Vec<_>, _>>()?;
        let multi = match question.get("multiSelect") { None => false, Some(value) => value.as_bool().ok_or("Invalid multiSelect flag")? };
        let value = answers.get(key).ok_or("An expected question answer is missing")?;
        let selections = match value {
            Value::Array(values) => values.iter().map(|value| value.as_str().ok_or("Selected options must be strings")).collect::<Result<Vec<_>, _>>()?,
            Value::String(value) if labels.contains(&value.as_str()) => vec![value.as_str()],
            Value::String(value) if multi => value.split(", ").collect(),
            _ => return Err("Question answer must contain selected options".into()),
        };
        if selections.is_empty() || (!multi && selections.len() != 1) { return Err("Invalid number of selected options".into()); }
        let mut unique = HashSet::new();
        for selection in &selections {
            if !labels.contains(selection) || !unique.insert(*selection) { return Err("Unknown or duplicate selected option".into()); }
        }
        normalized.insert(key.to_owned(), json!(selections));
    }
    Ok(Value::Object(normalized))
}

fn prepare_answer(pending: &Value, verdict: &str, answers: Option<Value>, at: u64) -> Result<Value, String> {
    if pending["until"].as_u64().unwrap_or(0) <= at { return Err("The agent request has expired".into()); }
    let normalized = if verdict == "answer" {
        if pending["kind"] != "question" { return Err("This request does not accept question answers".into()); }
        Some(question_answers(&pending["questions"], &answers.ok_or("Question answers are required")?)?)
    } else {
        if answers.as_ref().is_some_and(|value| !value.is_null()) { return Err("Permission replies cannot contain answers".into()); }
        if verdict == "allow" && pending["kind"] == "question" { return Err("Select an answer or continue in the terminal".into()); }
        None
    };
    Ok(json!({"verdict":verdict,"answers":normalized,"at":at}))
}

pub fn answer(id:&str,verdict:&str,answers:Option<Value>)->Result<bool,String>{
    if !valid_request_id(id){return Err("Invalid request ID".into());}
    if !["allow","deny","terminal","answer"].contains(&verdict){return Err("Invalid verdict".into());}
    let live=LIVE.lock().map_err(|_|"Agent state lock poisoned")?;
    let pending=live.iter().find_map(|event|event.get("ask").filter(|ask|ask["id"].as_str()==Some(id))).ok_or("The agent request has expired")?;
    let value = prepare_answer(pending, verdict, answers, now())?;
    let destination = event_dir().join("answers").join(format!("{id}.json"));
    if destination.exists() { return Err("The agent request was already answered".into()); }
    write_json(&destination, &value)?;
    Ok(true)
}

pub fn start(app:AppHandle){std::thread::spawn(move||{
    let directory=event_dir();let _=fs::create_dir_all(&directory);let mut seen_asks=HashSet::new();let mut finished_asks=HashSet::new();let mut seen_cards=HashSet::new();let mut previous=Vec::<Value>::new();
    let mut cache = HashMap::<PathBuf, (SystemTime, u64, Option<Value>)>::new();
    let mut heartbeat_at = 0u64;
    loop {
        let at = now();
        if at.saturating_sub(heartbeat_at) >= 1000 { let _=write_json(&directory.join("heartbeat.json"),&json!({"at":at})); heartbeat_at=at; }
        let mut live=Vec::new();
        let mut present = HashSet::new();
        if let Ok(entries)=fs::read_dir(&directory){for entry in entries.flatten().take(1000){
            let path=entry.path();if path.file_name().and_then(|name|name.to_str())==Some("heartbeat.json")||path.extension().and_then(|ext|ext.to_str())!=Some("json"){continue;}
            let Ok(metadata)=entry.metadata() else {continue;}; if metadata.len()>65536 {continue;}
            let stamp=metadata.modified().unwrap_or(UNIX_EPOCH);
            present.insert(path.clone());
            let changed=cache.get(&path).is_none_or(|(modified,size,_)|*modified!=stamp||*size!=metadata.len());
            if changed {cache.insert(path.clone(), (stamp,metadata.len(),config_json(&path).ok()));}
            if let Some(event)=cache.get(&path).and_then(|(_,_,event)|event.as_ref()){
                let age=at.saturating_sub(event["at"].as_u64().unwrap_or(0));let ttl=if event["state"]=="done"{15000}else{600000};if age<=ttl&&["claude","codex","opencode"].contains(&event["agent"].as_str().unwrap_or("")){live.push(event.clone());}
            }
        }}
        cache.retain(|path,_|present.contains(path));
        live.sort_by_key(|event|event["at"].as_u64().unwrap_or(0));
        for event in &live {
            if let Some(ask)=event.get("ask"){if let Some(id)=ask["id"].as_str().filter(|id|valid_request_id(id)){let finished=directory.join("answers").join(format!("{id}.json")).exists()||ask["until"].as_u64().unwrap_or(0)<=now();if finished{if finished_asks.insert(id.to_owned()){let _=app.emit("agents:ask-done",id);}}else if seen_asks.insert(id.to_owned()){let _=app.emit("agents:ask",ask);}}}
            if event["state"]=="done"||event["state"]=="waiting"&&event.get("ask").is_none(){let id=format!("{}:{}",event["id"],event["at"]);if seen_cards.insert(id){let _=app.emit("agents:card",event);}}
        }
        if live!=previous{if let Ok(mut state)=LIVE.lock(){*state=live.clone();}let _=app.emit("agents:update",&live);previous=live;}
        if seen_cards.len()>1000{seen_cards.clear();}if seen_asks.len()>1000{seen_asks.clear();}if finished_asks.len()>1000{finished_asks.clear();}
        let pending=previous.iter().any(|event|event.get("ask").is_some_and(|ask|ask["until"].as_u64().unwrap_or(0)>at&&!finished_asks.contains(ask["id"].as_str().unwrap_or(""))));
        std::thread::sleep(Duration::from_millis(if pending {400} else {1000}));
    }
});}

#[cfg(test)]
mod tests{
    use super::*;
    fn questions() -> Value { json!([
        {"question":"Какой режим?","options":[{"label":"Быстро"},{"label":"Качественно"}],"multiSelect":false},
        {"question":"Что включить?","options":[{"label":"A, B"},{"label":"C"},{"label":"D"}],"multiSelect":true}
    ]) }
    #[test] fn question_answers_preserve_unicode_comma_labels_and_multiselect() {
        assert_eq!(question_answers(&questions(), &json!({"Какой режим?":"Качественно","Что включить?":["A, B","C"]})).unwrap(), json!({"Какой режим?":["Качественно"],"Что включить?":["A, B","C"]}));
        assert_eq!(question_answers(&questions(), &json!({"Какой режим?":"Быстро","Что включить?":"C, D"})).unwrap()["Что включить?"], json!(["C","D"]));
    }
    #[test] fn question_answers_reject_missing_foreign_duplicate_wrong_type_and_single_multi_values() {
        for answers in [json!({"Какой режим?":"Быстро"}), json!({"Какой режим?":"Быстро","Другой":"C"}), json!({"Какой режим?":["Быстро","Качественно"],"Что включить?":["C"]}), json!({"Какой режим?":"Быстро","Что включить?":["C","C"]}), json!({"Какой режим?":"Быстро","Что включить?":["missing"]}), json!({"Какой режим?":"Быстро","Что включить?":[]}), json!({"Какой режим?":true,"Что включить?":["C"]}), json!({"Какой режим?":"Быстро","Что включить?":["C"],"extra":"D"})] {
            assert!(question_answers(&questions(), &answers).is_err(), "{answers}");
        }
    }
    #[test] fn answer_contract_enforces_request_kind_and_expiry() {
        let permission = json!({"kind":"permission","until":100});
        assert_eq!(prepare_answer(&permission,"allow",None,99).unwrap()["verdict"], "allow");
        assert!(prepare_answer(&permission,"allow",None,100).is_err());
        assert!(prepare_answer(&permission,"answer",Some(json!({})),99).is_err());
        assert!(prepare_answer(&permission,"deny",Some(json!({"extra":true})),99).is_err());
        let question = json!({"kind":"question","until":100,"questions":questions()});
        assert!(prepare_answer(&question,"allow",None,99).is_err());
        assert!(prepare_answer(&question,"answer",Some(json!({"Какой режим?":"Быстро","Что включить?":["C"]})),99).is_ok());
    }
    #[test]fn permission_ids_cannot_escape_the_answer_directory(){
        assert!(valid_request_id("01a1cb92-4ea1-7620-bdca-79aa122878ff"));
        for id in ["", "../outside", "..\\outside", "C:\\outside", "request.json", "request/other"] {assert!(!valid_request_id(id));}
        assert!(!valid_request_id(&"x".repeat(81)));
    }
    #[test]fn claude_hooks_preserve_unrelated_config_and_are_idempotent(){
        let mut config=json!({"permissions":{"allow":["Read"]},"hooks":{"Stop":[{"hooks":[{"type":"command","command":"original-notify.exe"}]}]}});
        let commands=CLAUDE_EVENTS.iter().map(|event|((*event).to_string(),format!("node \"{}\" --event {event}",script_path().display()))).collect();
        claude_hooks(&mut config,true,&commands).unwrap();let first=config.clone();claude_hooks(&mut config,true,&commands).unwrap();assert_eq!(config,first);
        claude_hooks(&mut config,false,&commands).unwrap();assert_eq!(config["permissions"]["allow"],json!(["Read"]));assert_eq!(config["hooks"]["Stop"][0]["hooks"][0]["command"],"original-notify.exe");
    }
    #[test]fn codex_notify_preserves_other_sections_comments_and_multiline_arrays(){
        let original="# user settings\nmodel = 'example'\nnotify = [\n  'other.exe',\n  '--flag',\n]\n[projects.'C:\\Projects']\ntrust_level = 'trusted'\n";
        let mut doc=original.parse::<DocumentMut>().unwrap();let old=notify(&doc).unwrap().unwrap();assert_eq!(old,vec!["other.exe","--flag"]);
        set_notify(&mut doc,Some(&["node.exe".into(),"island-notify.cjs".into()]));assert!(doc.to_string().contains("# user settings"));assert_eq!(doc["model"].as_str(),Some("example"));
        set_notify(&mut doc,Some(&old));assert_eq!(notify(&doc).unwrap(),Some(old));assert_eq!(doc["projects"]["C:\\Projects"]["trust_level"].as_str(),Some("trusted"));
    }
}
