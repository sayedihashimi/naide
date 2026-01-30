use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::Manager;

// Global state to track the sidecar process
struct SidecarState {
    process: Option<Child>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Start the copilot sidecar
      let sidecar_path = if cfg!(target_os = "windows") {
        "../../copilot-sidecar/dist/index.js"
      } else {
        "../../copilot-sidecar/dist/index.js"
      };
      
      println!("[Tauri] Starting copilot sidecar...");
      
      match Command::new("node")
        .arg(sidecar_path)
        .spawn() {
          Ok(child) => {
            println!("[Tauri] Copilot sidecar started with PID: {:?}", child.id());
            
            // Store the process handle for cleanup
            app.manage(Mutex::new(SidecarState {
              process: Some(child),
            }));
          }
          Err(e) => {
            eprintln!("[Tauri] Failed to start copilot sidecar: {}", e);
            eprintln!("[Tauri] App will continue, but copilot features will not work");
          }
        }
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
