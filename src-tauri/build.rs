fn main() {
    // Re-run (and re-embed icons) whenever the icon set or config changes.
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    tauri_build::build()
}
