use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use chrono::Utc;

// Global state to track the sidecar process
struct SidecarState {
    process: Option<Child>,
}

// Settings structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LastProject {
    pub path: String,
    #[serde(rename = "lastAccessed")]
    pub last_accessed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalSettings {
    pub version: u32,
    #[serde(rename = "lastUsedProject")]
    pub last_used_project: Option<LastProject>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        GlobalSettings {
            version: 1,
            last_used_project: None,
        }
    }
}

// Get the settings directory path (OS-specific)
fn get_settings_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

// Get the settings file path
fn get_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings_dir = get_settings_dir(app)?;
    Ok(settings_dir.join("naide-settings.json"))
}

// Read settings from file
fn read_settings(app: &tauri::AppHandle) -> Result<GlobalSettings, String> {
    let settings_path = get_settings_path(app)?;
    
    if !settings_path.exists() {
        return Ok(GlobalSettings::default());
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| {
            // If settings are corrupted, backup and return default
            let backup_path = settings_path.with_extension("json.backup");
            let _ = fs::copy(&settings_path, backup_path);
            format!("Failed to parse settings (backed up corrupted file): {}", e)
        })
}

// Write settings to file
fn write_settings(app: &tauri::AppHandle, settings: &GlobalSettings) -> Result<(), String> {
    let settings_dir = get_settings_dir(app)?;
    let settings_path = get_settings_path(app)?;
    
    println!("[Settings] Creating directory: {:?}", settings_dir);
    // Ensure directory exists
    fs::create_dir_all(&settings_dir)
        .map_err(|e| {
            println!("[Settings] ERROR creating directory: {}", e);
            format!("Failed to create settings directory: {}", e)
        })?;
    println!("[Settings] Directory created or already exists");
    
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| {
            println!("[Settings] ERROR serializing: {}", e);
            format!("Failed to serialize settings: {}", e)
        })?;
    
    println!("[Settings] Writing to file: {:?}", settings_path);
    fs::write(&settings_path, content)
        .map_err(|e| {
            println!("[Settings] ERROR writing file: {}", e);
            format!("Failed to write settings file: {}", e)
        })?;
    
    println!("[Settings] File written successfully");
    Ok(())
}

// Tauri command: Save the last used project path
#[tauri::command]
async fn save_last_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("[Settings] save_last_project called with path: {}", path);
    
    // Validate path exists and is a directory
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        println!("[Settings] ERROR: Path does not exist: {}", path);
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_buf.is_dir() {
        println!("[Settings] ERROR: Path is not a directory: {}", path);
        return Err(format!("Path is not a directory: {}", path));
    }
    
    // Get settings directory path for logging
    let settings_dir = get_settings_dir(&app)?;
    println!("[Settings] Settings directory: {:?}", settings_dir);
    
    let settings_path = get_settings_path(&app)?;
    println!("[Settings] Settings file path: {:?}", settings_path);
    
    // Get current timestamp in ISO 8601 format
    let now = chrono::Utc::now().to_rfc3339();
    
    let mut settings = read_settings(&app).unwrap_or_default();
    settings.last_used_project = Some(LastProject {
        path: path.clone(),
        last_accessed: now,
    });
    
    println!("[Settings] About to write settings...");
    write_settings(&app, &settings)?;
    
    println!("[Settings] Saved last project: {}", path);
    Ok(())
}

// Tauri command: Load the last used project path (returns None if invalid)
#[tauri::command]
async fn load_last_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let settings = read_settings(&app)?;
    
    if let Some(project) = settings.last_used_project {
        let path_buf = PathBuf::from(&project.path);
        
        // Validate path still exists and is a directory
        if path_buf.exists() && path_buf.is_dir() {
            println!("[Settings] Loaded last project: {}", project.path);
            return Ok(Some(project.path));
        } else {
            println!("[Settings] Last project path no longer valid: {}", project.path);
        }
    }
    
    Ok(None)
}

// Tauri command: Clear the last used project
#[tauri::command]
async fn clear_last_project(app: tauri::AppHandle) -> Result<(), String> {
    let mut settings = read_settings(&app).unwrap_or_default();
    settings.last_used_project = None;
    write_settings(&app, &settings)?;
    
    println!("[Settings] Cleared last project");
    Ok(())
}

// Tauri command: Get the settings file path (for debugging)
#[tauri::command]
async fn get_settings_file_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = get_settings_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      // Configure file logging for both debug and production
      // Get log directory: %temp%/com.naide.desktop/logs
      let temp_dir = env::temp_dir();
      let log_dir = temp_dir.join("com.naide.desktop").join("logs");
      
      // Create log directory if it doesn't exist
      if let Err(e) = fs::create_dir_all(&log_dir) {
        eprintln!("[Tauri] Failed to create log directory: {}", e);
      } else {
        println!("[Tauri] Log directory: {:?}", log_dir);
      }
      
      // Generate timestamped log filename: naide-2026-02-01T03-30-28.log
      let timestamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
      let log_filename = format!("naide-{}.log", timestamp);
      
      println!("[Tauri] Log file: {:?}/{}", log_dir.display(), log_filename);
      
      // Configure tauri-plugin-log with custom folder target
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .targets([
            tauri_plugin_log::Target::new(
              tauri_plugin_log::TargetKind::Folder {
                path: log_dir,
                file_name: Some(log_filename),
              }
            ),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
          ])
          .build(),
      )?;
      
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
    .invoke_handler(tauri::generate_handler![
      save_last_project,
      load_last_project,
      clear_last_project,
      get_settings_file_path
    ])
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
