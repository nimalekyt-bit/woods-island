fn main() {
    // Console helper uses the same local importer and creates no Tauri windows.
    let result=woods_island_lib::pets::import_profile(&woods_island_lib::storage::get_storage_dir(),true);
    println!("{}",serde_json::to_string_pretty(&result).unwrap());
    if result["status"]!="ready" {std::process::exit(1);}
}
