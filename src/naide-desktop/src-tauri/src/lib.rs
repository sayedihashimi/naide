use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::env;
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
      // Get the current executable directory and construct path to sidecar
      let sidecar_relative_path = if cfg!(target_os = "windows") {
        r"..\..\copilot-sidecar\dist\index.js"
      } else {
        "../../copilot-sidecar/dist/index.js"
      };
      
      // Try to resolve the path relative to current directory
      let sidecar_path = env::current_dir()
        .ok()
        .and_then(|dir| {
          let path = dir.join(sidecar_relative_path);
          if path.exists() {
            Some(path)
          } else {
            // Try from the app directory
            app.path().app_data_dir()
              .ok()
              .and_then(|app_dir| {
                let alt_path = app_dir.join(sidecar_relative_path);
                if alt_path.exists() {
                  Some(alt_path)
                } else {
                  None
                }
              })
          }
        });
      
      if let Some(path) = sidecar_path {
        println!("[Tauri] Starting copilot sidecar from: {:?}", path);
        
        match Command::new("node")
          .arg(path)
          .stdout(Stdio::piped())
          .stderr(Stdio::piped())
          .spawn() {
            Ok(child) => {
              println!("[Tauri] Copilot sidecar started with PID: {:?}", child.id());
              println!("[Tauri] Sidecar should be accessible at http://localhost:3001");
              
              // Store the process handle for cleanup
              app.manage(Mutex::new(SidecarState {
                process: Some(child),
              }));
            }
            Err(e) => {
              eprintln!("[Tauri] Failed to start copilot sidecar: {}", e);
              eprintln!("[Tauri] Make sure Node.js is installed and in PATH");
              eprintln!("[Tauri] App will continue, but copilot features will not work");
            }
          }
      } else {
        eprintln!("[Tauri] Sidecar not found at expected path: {}", sidecar_relative_path);
        eprintln!("[Tauri] Make sure to build the sidecar with: cd src/copilot-sidecar && npm run build");
        eprintln!("[Tauri] App will continue, but copilot features will not work");
      }
      
      Ok(())
    })
    .on_window_event(|_window, event| {
      // Clean up sidecar on app exit
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        if let Some(mut state) = _window.state::<Mutex<SidecarState>>().try_lock().ok() {
          if let Some(mut process) = state.process.take() {
            println!("[Tauri] Stopping sidecar process...");
            let _ = process.kill();
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
