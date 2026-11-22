#![windows_subsystem = "windows"]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(index) = args.iter().position(|arg| arg == "--g435-measure" || arg == "--g435-exit") {
        let result = if args.iter().any(|arg|arg=="--allow-audio-pause") {
            woods_island_lib::peripherals::g435_child(args.get(index+1).map(String::as_str).unwrap_or(""),args[index]=="--g435-exit")
        } else { serde_json::json!({"ok":false,"error":"g435ConfirmationRequired"}) };
        use std::io::Write;
        let _ = writeln!(std::io::stdout().lock(),"{result}");
        return;
    }
    if std::env::args().any(|arg| arg == "--peripheral-scan") {
        match woods_island_lib::peripherals::scan_payload() {
            Ok(snapshot) => {
                use std::io::Write;
                if writeln!(std::io::stdout().lock(), "{snapshot}").is_err() { std::process::exit(1); }
            }
            Err(_) => std::process::exit(1),
        }
        return;
    }
    std::panic::set_hook(Box::new(|info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else {
            format!("{:#?}", info)
        };
        let _ = std::fs::write("panic.log", format!("PANIC: {}\nLocation: {:?}", msg, info.location()));
    }));
    woods_island_lib::run();
}
