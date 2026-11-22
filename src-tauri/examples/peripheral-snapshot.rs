fn main() {
    let result = if std::env::args().any(|arg| arg == "--scan-report") {
        woods_island_lib::peripherals::scan_payload()
    } else if std::env::args().any(|arg| arg == "--rongyuan-status") {
        woods_island_lib::peripherals::rongyuan_status_inventory()
    } else if std::env::args().any(|arg| arg == "--rongyuan-features") {
        woods_island_lib::peripherals::rongyuan_feature_inventory()
    } else if std::env::args().any(|arg| arg == "--descriptors") {
        woods_island_lib::peripherals::descriptor_inventory()
    } else {
        woods_island_lib::peripherals::inspect()
    };
    match result {
        Ok(snapshot) => println!("{}", serde_json::to_string_pretty(&snapshot).unwrap()),
        Err(error) => {
            eprintln!("Peripheral inventory unavailable: {error}");
            std::process::exit(1);
        }
    }
}
