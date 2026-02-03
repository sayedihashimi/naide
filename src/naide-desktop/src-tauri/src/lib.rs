use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use chrono::Utc;
use serde::{Deserialize, Serialize};

mod settings;
use settings::{LastProject, read_settings, write_settings, add_recent_project, get_recent_projects as get_recent_projects_from_settings};

// Global state to track the sidecar process
struct SidecarState {
    process: Option<Child>,
}

// Tauri command: Log from frontend to backend log file
#[tauri::command]
async fn log_to_file(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "info" => log::info!("{}", message),
        "error" => log::error!("{}", message),
        "warn" => log::warn!("{}", message),
        "debug" => log::debug!("{}", message),
        _ => log::info!("{}", message),
    }
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
    
    // Get settings file path for logging
    let settings_path = settings::get_settings_path(&app)?;
    println!("[Settings] Settings file path: {:?}", settings_path);
    
    // Get current timestamp in ISO 8601 format
    let now = chrono::Utc::now().to_rfc3339();
    
    let mut settings = read_settings(&app).unwrap_or_default();
    settings.last_used_project = Some(LastProject {
        path: path.clone(),
        last_accessed: now.clone(),
    });
    
    // Also add to recent projects
    add_recent_project(&mut settings, path.clone(), now);
    
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
    let path = settings::get_settings_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

// Tauri command: Get recent projects list
#[tauri::command]
async fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<LastProject>, String> {
    let settings = read_settings(&app)?;
    Ok(get_recent_projects_from_settings(&settings))
}

// Tauri command: Add a project to recent projects
#[tauri::command]
async fn add_recent_project_cmd(app: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("[Settings] add_recent_project called with path: {}", path);
    
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
    
    // Get current timestamp in ISO 8601 format
    let now = chrono::Utc::now().to_rfc3339();
    
    let mut settings = read_settings(&app).unwrap_or_default();
    add_recent_project(&mut settings, path.clone(), now);
    write_settings(&app, &settings)?;
    
    println!("[Settings] Added to recent projects: {}", path);
    Ok(())
}

// View options for feature files
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ViewOptions {
    show_bugs: bool,
    show_removed: bool,
    show_raw: bool,
}

// Feature file structure for tree view
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FeatureFileNode {
    name: String,          // Display name (without date prefix)
    full_name: String,     // Full filename
    path: String,          // Relative path from .prompts/features/
    date: Option<String>,  // Parsed date (YYYY-MM-DD)
    is_folder: bool,
    children: Option<Vec<FeatureFileNode>>,
}

// Tauri command: List feature files from .prompts/features/
#[tauri::command]
async fn list_feature_files(project_path: String, options: Option<ViewOptions>) -> Result<Vec<FeatureFileNode>, String> {
    let features_dir = PathBuf::from(&project_path).join(".prompts").join("features");
    
    if !features_dir.exists() {
        return Ok(Vec::new());
    }
    
    if !features_dir.is_dir() {
        return Err("Features path is not a directory".to_string());
    }
    
    let opts = options.unwrap_or(ViewOptions {
        show_bugs: false,
        show_removed: false,
        show_raw: false,
    });
    
    // Recursively scan the directory
    scan_directory(&features_dir, &features_dir, &opts)
}

fn scan_directory(base_dir: &PathBuf, current_dir: &PathBuf, options: &ViewOptions) -> Result<Vec<FeatureFileNode>, String> {
    let mut nodes = Vec::new();
    
    let entries = fs::read_dir(current_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files and directories
        if file_name.starts_with('.') {
            continue;
        }
        
        // Get relative path for filtering
        let rel_path = path.strip_prefix(base_dir)
            .unwrap()
            .to_string_lossy()
            .to_string();
        
        // Skip bugs/ folder if show_bugs is false
        if !options.show_bugs {
            let normalized_path = rel_path.replace('\\', "/");
            if normalized_path == "bugs" || normalized_path.starts_with("bugs/") {
                continue;
            }
        }
        
        // Skip removed-features/ folder if show_removed is false
        if !options.show_removed {
            let normalized_path = rel_path.replace('\\', "/");
            if normalized_path == "removed-features" || normalized_path.starts_with("removed-features/") {
                continue;
            }
        }
        
        if path.is_dir() {
            // Recursively scan subdirectories
            let children = scan_directory(base_dir, &path, options)?;
            
            nodes.push(FeatureFileNode {
                name: file_name.clone(),
                full_name: file_name.clone(),
                path: rel_path,
                date: None,
                is_folder: true,
                children: Some(children),
            });
        } else if file_name.ends_with(".md") {
            // Parse date prefix and display name based on show_raw option
            let (display_name, date) = if options.show_raw {
                (file_name.strip_suffix(".md").unwrap_or(&file_name).to_string(), parse_date_from_filename(&file_name))
            } else {
                parse_filename(&file_name)
            };
            
            nodes.push(FeatureFileNode {
                name: display_name,
                full_name: file_name.clone(),
                path: rel_path,
                date,
                is_folder: false,
                children: None,
            });
        }
    }
    
    // Sort nodes: files by date (most recent first), then alphabetically
    // Folders alphabetically
    nodes.sort_by(|a, b| {
        match (a.is_folder, b.is_folder) {
            (true, true) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            (false, false) => {
                // Both are files - sort by date (descending) then name
                match (&a.date, &b.date) {
                    (Some(date_a), Some(date_b)) => {
                        // Reverse order for descending (most recent first)
                        date_b.cmp(date_a).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
                    }
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                }
            }
        }
    });
    
    Ok(nodes)
}

// Parse filename to extract date prefix and display name
// Example: "2026-02-01-add-copilot-integration.md" -> ("add-copilot-integration", Some("2026-02-01"))
fn parse_filename(filename: &str) -> (String, Option<String>) {
    // Remove .md extension
    let name_without_ext = filename.strip_suffix(".md").unwrap_or(filename);
    
    // Check if it starts with a date pattern (YYYY-MM-DD-)
    if name_without_ext.len() >= 11 {
        let potential_date = &name_without_ext[0..10];
        if potential_date.chars().nth(4) == Some('-') 
            && potential_date.chars().nth(7) == Some('-')
            && name_without_ext.chars().nth(10) == Some('-') {
            // Looks like a date prefix
            let date = potential_date.to_string();
            let display_name = name_without_ext[11..].to_string();
            return (display_name, Some(date));
        }
    }
    
    (name_without_ext.to_string(), None)
}

// Parse just the date from filename without modifying the display name
fn parse_date_from_filename(filename: &str) -> Option<String> {
    let name_without_ext = filename.strip_suffix(".md").unwrap_or(filename);
    
    if name_without_ext.len() >= 11 {
        let potential_date = &name_without_ext[0..10];
        if potential_date.chars().nth(4) == Some('-') 
            && potential_date.chars().nth(7) == Some('-')
            && name_without_ext.chars().nth(10) == Some('-') {
            return Some(potential_date.to_string());
        }
    }
    
    None
}

// Tauri command: Read feature file content
#[tauri::command]
async fn read_feature_file(project_path: String, file_path: String) -> Result<String, String> {
    let full_path = PathBuf::from(&project_path)
        .join(".prompts")
        .join("features")
        .join(&file_path);
    
    // Security check: ensure the path is within .prompts/features/
    let base_dir = PathBuf::from(&project_path).join(".prompts").join("features");
    let canonical_full_path = full_path.canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let canonical_base_dir = base_dir.canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    
    if !canonical_full_path.starts_with(&canonical_base_dir) {
        return Err("Access denied: path outside of features directory".to_string());
    }
    
    fs::read_to_string(&canonical_full_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// Tauri command: Write feature file content
#[tauri::command]
async fn write_feature_file(project_path: String, file_path: String, content: String) -> Result<(), String> {
    let full_path = PathBuf::from(&project_path)
        .join(".prompts")
        .join("features")
        .join(&file_path);
    
    // Security check: ensure the path is within .prompts/features/
    let base_dir = PathBuf::from(&project_path).join(".prompts").join("features");
    
    // For write operations, we need to handle paths that might not exist yet
    // So we'll check the parent directory instead
    let parent = full_path.parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?;
    
    // Ensure parent directory exists
    if !parent.exists() {
        return Err("Parent directory does not exist".to_string());
    }
    
    let canonical_parent = parent.canonicalize()
        .map_err(|e| format!("Invalid parent directory: {}", e))?;
    let canonical_base_dir = base_dir.canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    
    if !canonical_parent.starts_with(&canonical_base_dir) {
        return Err("Access denied: path outside of features directory".to_string());
    }
    
    // Write the file
    fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

// Chat session metadata structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatSessionMetadata {
    filename: String,
    last_modified: u64,
    message_count: usize,
    mode: String,
    first_user_message: String,
}

// Tauri command: List chat sessions (excluding active session)
#[tauri::command]
async fn list_chat_sessions(project_path: String) -> Result<Vec<ChatSessionMetadata>, String> {
    let chat_sessions_dir = PathBuf::from(&project_path)
        .join(".naide")
        .join("chatsessions");
    
    if !chat_sessions_dir.exists() {
        return Ok(Vec::new());
    }
    
    if !chat_sessions_dir.is_dir() {
        return Err("Chat sessions path is not a directory".to_string());
    }
    
    let mut sessions = Vec::new();
    
    let entries = fs::read_dir(&chat_sessions_dir)
        .map_err(|e| format!("Failed to read chat sessions directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // Skip the active chat file and non-JSON files
        if file_name == "default-chat.json" || !file_name.ends_with(".json") {
            continue;
        }
        
        // Read file metadata
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read file metadata: {}", e))?;
        
        let last_modified = metadata.modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        
        // Read and parse the chat session file
        match fs::read_to_string(&path) {
            Ok(content) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(session) => {
                        let messages = session.get("messages")
                            .and_then(|m| m.as_array())
                            .cloned()
                            .unwrap_or_default();
                        
                        let mode = session.get("mode")
                            .and_then(|m| m.as_str())
                            .unwrap_or("Planning")
                            .to_string();
                        
                        // Find first user message
                        let first_user_message = messages.iter()
                            .find(|msg| {
                                msg.get("role")
                                    .and_then(|r| r.as_str())
                                    .map(|r| r == "user")
                                    .unwrap_or(false)
                            })
                            .and_then(|msg| msg.get("content"))
                            .and_then(|c| c.as_str())
                            .unwrap_or("")
                            .to_string();
                        
                        sessions.push(ChatSessionMetadata {
                            filename: file_name,
                            last_modified,
                            message_count: messages.len(),
                            mode,
                            first_user_message,
                        });
                    }
                    Err(_) => {
                        // Skip corrupted files
                        log::warn!("Skipping corrupted chat session file: {}", file_name);
                    }
                }
            }
            Err(_) => {
                // Skip files that can't be read
                log::warn!("Skipping unreadable chat session file: {}", file_name);
            }
        }
    }
    
    // Sort by last_modified descending (most recent first)
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    
    Ok(sessions)
}

// Tauri command: Load a specific chat session
#[tauri::command]
async fn load_chat_session_file(project_path: String, filename: String) -> Result<String, String> {
    // Security check: validate filename
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }
    
    let session_path = PathBuf::from(&project_path)
        .join(".naide")
        .join("chatsessions")
        .join(&filename);
    
    if !session_path.exists() {
        return Err(format!("Chat session file not found: {}", filename));
    }
    
    fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read chat session file: {}", e))
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
        eprintln!("[Tauri] Failed to create log directory at {:?}: {}", log_dir, e);
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
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
          ])
          .build(),
      )?;
      
      // Test that logging works
      log::info!("Naide application starting");
      log::info!("Logging configured successfully");
      
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
        log::info!("Starting copilot sidecar from: {:?}", path);
        println!("[Tauri] Starting copilot sidecar from: {:?}", path);
        
        match Command::new("node")
          .arg(path)
          .stdout(Stdio::piped())
          .stderr(Stdio::piped())
          .spawn() {
            Ok(child) => {
              log::info!("Copilot sidecar started with PID: {:?}", child.id());
              println!("[Tauri] Copilot sidecar started with PID: {:?}", child.id());
              println!("[Tauri] Sidecar should be accessible at http://localhost:3001");
              
              // Store the process handle for cleanup
              app.manage(Mutex::new(SidecarState {
                process: Some(child),
              }));
            }
            Err(e) => {
              log::error!("Failed to start copilot sidecar: {}", e);
              eprintln!("[Tauri] Failed to start copilot sidecar: {}", e);
              eprintln!("[Tauri] Make sure Node.js is installed and in PATH");
              eprintln!("[Tauri] App will continue, but copilot features will not work");
            }
          }
      } else {
        log::warn!("Sidecar not found at expected path: {}", sidecar_relative_path);
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
      get_settings_file_path,
      get_recent_projects,
      add_recent_project_cmd,
      log_to_file,
      list_feature_files,
      read_feature_file,
      write_feature_file,
      list_chat_sessions,
      load_chat_session_file
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
