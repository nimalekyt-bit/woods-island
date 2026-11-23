extern crate self as tauri;
extern crate serde;
extern crate serde_json;
use std::io::{BufRead, Write};
#[derive(Clone)]
pub struct AppHandle;
pub trait Emitter {
    fn emit<T: serde::Serialize>(&self, event: &str, payload: T) -> Result<(), ()>;
}
impl Emitter for AppHandle {
    fn emit<T: serde::Serialize>(&self, event: &str, payload: T) -> Result<(), ()> {
        let value = serde_json::json!({"event":event,"payload":payload});
        let _ = writeln!(std::io::stdout().lock(), "{value}");
        Ok(())
    }
}
mod storage {
    pub fn get_storage_dir() -> std::path::PathBuf {
        let path = std::path::PathBuf::from(
            std::env::var_os("WOODS_ISLAND_DATA_DIR").expect("Explicit fixture required"),
        );
        assert!(path.starts_with(std::path::PathBuf::from(
            std::env::var_os("WOODS_AGENT_FIXTURE_ROOT").expect("Explicit fixture root required")
        )));
        let _ = std::fs::create_dir_all(&path);
        path
    }
    pub fn atomic_write(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
        std::fs::rename(tmp, path).map_err(|e| e.to_string())
    }
}
#[path = "../../src-tauri/src/agents.rs"]
mod agents;
fn main() {
    agents::start(AppHandle);
    for line in std::io::stdin().lock().lines().map_while(Result::ok) {
        let input: serde_json::Value = serde_json::from_str(&line).unwrap();
        let response = match input["op"].as_str().unwrap() {
            "connect" => agents::connect(
                input["agent"].as_str().unwrap(),
                input["on"].as_bool().unwrap(),
                input["beside"].as_bool().unwrap_or(false),
            ),
            "connections" => Ok(agents::connections()),
            "snapshot" => Ok(serde_json::json!(agents::current())),
            "configure" => {
                agents::configure(input["ask"].as_bool().unwrap());
                Ok(serde_json::json!(true))
            }
            "answer" => agents::answer(
                input["id"].as_str().unwrap(),
                input["verdict"].as_str().unwrap(),
                input.get("answers").cloned(),
            )
            .map(|v| serde_json::json!(v)),
            _ => unreachable!(),
        };
        let result = match response {
            Ok(v) => serde_json::json!({"request":input["request"],"ok":true,"result":v}),
            Err(e) => serde_json::json!({"request":input["request"],"ok":false,"error":e}),
        };
        let _ = writeln!(std::io::stdout().lock(), "{result}");
    }
}
