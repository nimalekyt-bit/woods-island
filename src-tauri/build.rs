fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build();
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        // Tauri links its Common Controls v6 manifest into binaries only.
        // The offline verifier and the library test harness also use its mock
        // runtime, which imports TaskDialogIndirect from those controls.
        let out = std::env::var("OUT_DIR").unwrap();
        println!("cargo:rustc-link-search=native={out}");
        println!("cargo:rustc-link-arg-examples={out}/resource.lib");
    }
}
