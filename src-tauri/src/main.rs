#![windows_subsystem = "windows"]

fn main() {
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
