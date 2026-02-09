use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, Emitter};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use notify::{Watcher, RecursiveMode, recommended_watcher, Event, EventKind};
use std::sync::mpsc::channel;

mod settings;
use settings::{LastProject, read_settings, write_settings, add_recent_project, remove_recent_project, get_recent_projects as get_recent_projects_from_settings};

mod app_runner;
use app_runner::{detect_dotnet_app, detect_npm_app, detect_all_runnable_apps, start_dotnet_app, start_npm_app, wait_for_url, AppInfo, RunningAppInfo};

mod project_files;
use project_files::list_project_files;

// Global state to track the sidecar process
struct SidecarState {
    process: Option<Child>,
}

// Global state to track file watchers
struct WatcherState {
    _feature_watcher: Option<Box<dyn Watcher + Send>>,
    _project_watcher: Option<Box<dyn Watcher + Send>>,
}

// Global state to track running app process
struct RunningAppState {
    process: Option<Child>,
    pid: Option<u32>,
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

// Tauri command: Remove a project from recent projects
#[tauri::command]
async fn remove_recent_project_cmd(app: tauri::AppHandle, path: String) -> Result<(), String> {
    println!("[Settings] remove_recent_project called with path: {}", path);
    let mut settings = read_settings(&app)?;
    remove_recent_project(&mut settings, &path);
    write_settings(&app, &settings)?;
    println!("[Settings] Removed from recent projects: {}", path);
    Ok(())
}

// Tauri command: Get project link domains from settings
#[tauri::command]
async fn get_project_link_domains(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let settings = read_settings(&app)?;
    Ok(settings.project_link_domains)
}

// Tauri command: Check if a file exists within the project directory
#[tauri::command]
async fn check_file_exists(project_path: String, relative_path: String) -> Result<bool, String> {
    use std::path::Path;
    
    let full_path = Path::new(&project_path).join(&relative_path);

    // Security: ensure path is within project directory
    let canonical = match full_path.canonicalize() {
        Ok(c) => c,
        Err(e) => {
            // Path doesn't exist or can't be accessed
            log::debug!("Failed to canonicalize path {}: {}", full_path.display(), e);
            return Ok(false);
        }
    };
    let project_canonical = Path::new(&project_path).canonicalize()
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;

    if !canonical.starts_with(&project_canonical) {
        log::warn!("Path escapes project directory: {}", canonical.display());
        return Ok(false); // Path escapes project directory
    }

    Ok(canonical.is_file())
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

// Tauri command: Read project file content
#[tauri::command]
async fn read_project_file(project_path: String, file_path: String) -> Result<String, String> {
    let full_path = PathBuf::from(&project_path).join(&file_path);
    
    // Security check: ensure the path is within the project directory
    let base_dir = PathBuf::from(&project_path);
    let canonical_full_path = full_path.canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let canonical_base_dir = base_dir.canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    
    if !canonical_full_path.starts_with(&canonical_base_dir) {
        return Err("Access denied: path outside of project directory".to_string());
    }
    
    // Read the file
    fs::read_to_string(&canonical_full_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// Tauri command: Write project file content
#[tauri::command]
async fn write_project_file(project_path: String, file_path: String, content: String) -> Result<(), String> {
    let full_path = PathBuf::from(&project_path).join(&file_path);
    
    // Security check: ensure the path is within the project directory
    let base_dir = PathBuf::from(&project_path);
    
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
        return Err("Access denied: path outside of project directory".to_string());
    }
    
    // Write the file
    fs::write(&full_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

// Tauri command: Get file size
#[tauri::command]
async fn get_file_size(project_path: String, relative_path: String) -> Result<u64, String> {
    let full_path = PathBuf::from(&project_path).join(&relative_path);
    
    // Security check: ensure the path is within the project directory
    let base_dir = PathBuf::from(&project_path);
    let canonical_full_path = full_path.canonicalize()
        .map_err(|e| format!("Invalid file path: {}", e))?;
    let canonical_base_dir = base_dir.canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    
    if !canonical_full_path.starts_with(&canonical_base_dir) {
        return Err("Access denied: path outside of project directory".to_string());
    }
    
    // Get file metadata
    let metadata = fs::metadata(&canonical_full_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    Ok(metadata.len())
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

// Tauri command: Delete a chat session (move to trash)
#[tauri::command]
async fn delete_chat_session(project_path: String, filename: String) -> Result<(), String> {
    // Security check: validate filename (prevent path traversal)
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }
    
    // Construct paths
    let chatsessions_dir = PathBuf::from(&project_path)
        .join(".naide")
        .join("chatsessions");
    
    let source_path = chatsessions_dir.join(&filename);
    let trash_dir = chatsessions_dir.join("trash");
    let dest_path = trash_dir.join(&filename);
    
    // Check source file exists
    if !source_path.exists() {
        return Err("Chat file not found".to_string());
    }
    
    // Create trash directory if it doesn't exist
    if !trash_dir.exists() {
        fs::create_dir_all(&trash_dir)
            .map_err(|e| format!("Failed to create trash directory: {}", e))?;
    }
    
    // Move the file to trash
    fs::rename(&source_path, &dest_path)
        .map_err(|e| format!("Failed to move file to trash: {}", e))?;
    
    log::info!("Moved chat session to trash: {}", filename);
    
    Ok(())
}

// Tauri command: Watch feature files directory for changes
#[tauri::command]
async fn watch_feature_files(window: tauri::Window, project_path: String) -> Result<(), String> {
    let features_path = PathBuf::from(&project_path)
        .join(".prompts")
        .join("features");
    
    if !features_path.exists() {
        log::warn!("Features directory does not exist: {:?}", features_path);
        return Err("Features directory does not exist".to_string());
    }
    
    log::info!("Starting file watcher for: {:?}", features_path);
    
    let (tx, rx) = channel();
    
    // Create the watcher
    let mut watcher = recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Filter for events we care about
                match event.kind {
                    EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_) => {
                        log::debug!("File change detected: {:?}", event);
                        // Send through channel
                        let _ = tx.send(());
                    }
                    _ => {}
                }
            }
            Err(e) => {
                log::error!("Watch error: {:?}", e);
            }
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    // Start watching
    watcher.watch(&features_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;
    
    log::info!("File watcher started successfully");
    
    // Clone window for the thread, keep original for state access
    let window_clone = window.clone();
    
    // Spawn a thread to listen for events and emit to frontend
    std::thread::spawn(move || {
        while let Ok(_) = rx.recv() {
            // Emit event to frontend
            log::debug!("Emitting feature-files-changed event");
            if let Err(e) = window_clone.emit("feature-files-changed", ()) {
                log::error!("Failed to emit event: {}", e);
            }
        }
    });
    
    // Store watcher to keep it alive
    // Note: The watcher will be dropped when the app closes, which is fine
    window.state::<Mutex<WatcherState>>().lock().unwrap()._feature_watcher = Some(Box::new(watcher));
    
    Ok(())
}

// Tauri command: Watch project files directory for changes
#[tauri::command]
async fn watch_project_files(window: tauri::Window, project_path: String) -> Result<(), String> {
    let project_path_buf = PathBuf::from(&project_path);
    
    if !project_path_buf.exists() {
        log::warn!("Project directory does not exist: {:?}", project_path_buf);
        return Err("Project directory does not exist".to_string());
    }
    
    log::info!("Starting project file watcher for: {:?}", project_path_buf);
    
    let (tx, rx) = channel();
    
    // List of directories to exclude from watching
    let excluded_dirs = vec![
        "node_modules",
        ".git",
        "bin",
        "obj",
        "dist",
        "build",
        "out",
        ".naide",
        "target", // Rust
        "__pycache__", // Python
        ".venv", // Python
        "venv", // Python
    ];
    
    // Create the watcher
    let project_path_clone = project_path_buf.clone();
    let mut watcher = recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Filter for events we care about (Create, Remove, Rename only - ignore Modify)
                match event.kind {
                    EventKind::Create(_) | EventKind::Remove(_) => {
                        // Check if any of the paths should be excluded
                        let should_exclude = event.paths.iter().any(|path| {
                            // Get relative path from project root
                            if let Ok(rel_path) = path.strip_prefix(&project_path_clone) {
                                // Check if any path component matches an excluded directory
                                rel_path.components().any(|component| {
                                    if let std::path::Component::Normal(os_str) = component {
                                        if let Some(name) = os_str.to_str() {
                                            return excluded_dirs.contains(&name);
                                        }
                                    }
                                    false
                                })
                            } else {
                                false
                            }
                        });
                        
                        if !should_exclude {
                            log::debug!("Project file change detected: {:?}", event);
                            // Send through channel
                            let _ = tx.send(());
                        }
                    }
                    _ => {}
                }
            }
            Err(e) => {
                log::error!("Watch error: {:?}", e);
            }
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    // Start watching
    watcher.watch(&project_path_buf, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;
    
    log::info!("Project file watcher started successfully");
    
    // Clone window for the thread, keep original for state access
    let window_clone = window.clone();
    
    // Spawn a thread to listen for events and emit to frontend
    std::thread::spawn(move || {
        while let Ok(_) = rx.recv() {
            // Emit event to frontend
            log::debug!("Emitting project-files-changed event");
            if let Err(e) = window_clone.emit("project-files-changed", ()) {
                log::error!("Failed to emit event: {}", e);
            }
        }
    });
    
    // Store watcher to keep it alive
    // Note: We're storing in a separate field from feature files watcher
    // Both can be active simultaneously
    window.state::<Mutex<WatcherState>>().lock().unwrap()._project_watcher = Some(Box::new(watcher));
    
    Ok(())
}

// Tauri command: Detect runnable app in the project
#[tauri::command]
async fn detect_runnable_app(project_path: String) -> Result<Option<AppInfo>, String> {
    log::info!("Detecting runnable app in: {}", project_path);
    
    // Try npm first (more common for web apps)
    if let Some(app_info) = detect_npm_app(&project_path)? {
        log::info!("Detected npm app: {:?}", app_info);
        return Ok(Some(app_info));
    }
    
    // Fall back to .NET
    if let Some(app_info) = detect_dotnet_app(&project_path)? {
        log::info!("Detected .NET app: {:?}", app_info);
        return Ok(Some(app_info));
    }
    
    Ok(None)
}

// Tauri command: Detect all runnable apps in the project
#[tauri::command]
async fn detect_all_runnable_apps_command(project_path: String) -> Result<Vec<AppInfo>, String> {
    log::info!("Detecting all runnable apps in: {}", project_path);
    let apps = detect_all_runnable_apps(&project_path)?;
    log::info!("Found {} apps", apps.len());
    Ok(apps)
}

// Tauri command: Start the app
#[tauri::command]
async fn start_app(
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    project_path: String,
    app_info: AppInfo,
) -> Result<RunningAppInfo, String> {
    log::info!("Starting app: {:?}", app_info);
    
    match app_info.app_type.as_str() {
        "npm" => {
            let script = app_info.command
                .ok_or_else(|| "No script specified for npm app".to_string())?;
            
            // If project_file is set, it's the subdirectory containing package.json
            let working_dir = match &app_info.project_file {
                Some(subdir) => {
                    let full = std::path::Path::new(&project_path).join(subdir);
                    full.to_string_lossy().to_string()
                }
                None => project_path.clone(),
            };
            
            let (child, rx) = start_npm_app(&working_dir, &script, window)?;
            let pid = child.id();
            
            // Wait for URL with 30 second timeout
            let url = wait_for_url(rx, 30);
            
            if url.is_none() {
                log::warn!("URL not detected within timeout");
            }
            
            // Store the process in state
            app_handle.state::<Mutex<RunningAppState>>().lock().unwrap().process = Some(child);
            app_handle.state::<Mutex<RunningAppState>>().lock().unwrap().pid = Some(pid);
            
            Ok(RunningAppInfo { pid, url })
        }
        "dotnet" => {
            let project_file = app_info.project_file
                .ok_or_else(|| "No project file specified for .NET app".to_string())?;
            
            let (child, rx) = start_dotnet_app(&project_path, &project_file, window)?;
            let pid = child.id();
            
            // Wait for URL with 30 second timeout
            let url = wait_for_url(rx, 30);
            
            if url.is_none() {
                log::warn!("URL not detected within timeout");
            }
            
            // Store the process in state
            app_handle.state::<Mutex<RunningAppState>>().lock().unwrap().process = Some(child);
            app_handle.state::<Mutex<RunningAppState>>().lock().unwrap().pid = Some(pid);
            
            Ok(RunningAppInfo { pid, url })
        }
        _ => Err(format!("Unsupported app type: {}", app_info.app_type)),
    }
}

/// Kill a process tree (the process and all its children)
/// On Windows, uses taskkill /T /F to kill the entire tree
/// On other platforms, uses process.kill() as fallback
fn kill_process_tree(pid: u32) -> Result<(), String> {
    log::info!("Killing process tree with PID: {}", pid);
    
    #[cfg(windows)]
    {
        // Use taskkill /T to kill the process tree, /F to force
        let output = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output()
            .map_err(|e| format!("Failed to run taskkill: {}", e))?;
        
        if output.status.success() {
            log::info!("taskkill succeeded for PID {}", pid);
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // taskkill returns error if process is already dead, which is fine
            if stderr.contains("not found") || stderr.contains("Access is denied") {
                log::warn!("taskkill warning for PID {}: {}", pid, stderr.trim());
            } else {
                log::info!("taskkill output for PID {}: {}", pid, stderr.trim());
            }
        }
        Ok(())
    }
    
    #[cfg(not(windows))]
    {
        // On Unix, try to kill the process group
        // Note: This may need enhancement for full process tree kill on macOS/Linux
        use std::process::Command;
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
        Ok(())
    }
}

/// Check if a process is still running
#[cfg(windows)]
fn is_process_running(pid: u32) -> bool {
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/NH"])
        .output();
    
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // tasklist returns "INFO: No tasks are running..." if not found
            !stdout.contains("No tasks") && stdout.contains(&pid.to_string())
        }
        Err(_) => false,
    }
}

#[cfg(not(windows))]
fn is_process_running(pid: u32) -> bool {
    std::path::Path::new(&format!("/proc/{}", pid)).exists()
}

// Tauri command: Stop the running app
#[tauri::command]
async fn stop_app(app_handle: tauri::AppHandle) -> Result<(), String> {
    log::info!("Stopping app");
    
    let (process_opt, pid_opt) = {
        let state_guard = app_handle.state::<Mutex<RunningAppState>>();
        let mut state = state_guard.lock().unwrap();
        (state.process.take(), state.pid.take())
    };
    
    // Get PID either from state or from the process
    let pid = match (pid_opt, &process_opt) {
        (Some(p), _) => Some(p),
        (None, Some(proc)) => Some(proc.id()),
        (None, None) => None,
    };
    
    if let Some(pid) = pid {
        log::info!("Killing process tree with PID: {}", pid);
        
        // Kill the entire process tree (npm + node + children)
        kill_process_tree(pid)?;
        
        // Wait a moment and verify the process is actually dead
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(5);
        
        while start.elapsed() < timeout {
            if !is_process_running(pid) {
                log::info!("Process {} confirmed dead", pid);
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        
        // Final check
        if is_process_running(pid) {
            log::warn!("Process {} may still be running after kill attempt", pid);
        }
        
        // Clear state
        {
            let state_guard = app_handle.state::<Mutex<RunningAppState>>();
            let mut state = state_guard.lock().unwrap();
            state.process = None;
            state.pid = None;
        }
        
        log::info!("Process stopped successfully");
        Ok(())
    } else if process_opt.is_some() {
        // We have a process but no PID (shouldn't happen, but handle it)
        if let Some(process) = process_opt {
            let pid = process.id();
            log::info!("Falling back to process.kill() for PID: {}", pid);
            kill_process_tree(pid)?;
        }
        Ok(())
    } else {
        Err("No running app to stop".to_string())
    }
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
                path: log_dir.clone(),
                file_name: Some(log_filename.clone()),
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
      
      // Initialize watcher state
      app.manage(Mutex::new(WatcherState {
        _feature_watcher: None,
        _project_watcher: None,
      }));
      
      // Initialize running app state
      app.manage(Mutex::new(RunningAppState {
        process: None,
        pid: None,
      }));
      
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
        
        // Pass log file path to sidecar via environment variable
        let log_file_path = log_dir.join(&log_filename);
        
        match Command::new("node")
          .arg(path)
          .env("NAIDE_LOG_FILE", log_file_path.to_string_lossy().to_string())
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
      remove_recent_project_cmd,
      get_project_link_domains,
      check_file_exists,
      log_to_file,
      list_feature_files,
      read_feature_file,
      write_feature_file,
      read_project_file,
      write_project_file,
      get_file_size,
      list_chat_sessions,
      load_chat_session_file,
      delete_chat_session,
      watch_feature_files,
      watch_project_files,
      detect_runnable_app,
      detect_all_runnable_apps_command,
      start_app,
      stop_app,
      list_project_files
    ])
    .on_window_event(|_window, event| {
      // Clean up processes on app exit
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        // Stop sidecar
        if let Some(mut state) = _window.state::<Mutex<SidecarState>>().try_lock().ok() {
          if let Some(mut process) = state.process.take() {
            let pid = process.id();
            println!("[Tauri] Stopping sidecar process tree (PID {})...", pid);
            // Kill the entire process tree to ensure all child processes are terminated
            if let Err(e) = kill_process_tree(pid) {
              eprintln!("[Tauri] Warning: Failed to kill sidecar process tree: {}", e);
              // Fallback to simple kill
              let _ = process.kill();
            }
          }
        }
        
        // Stop running app
        if let Some(mut state) = _window.state::<Mutex<RunningAppState>>().try_lock().ok() {
          if let Some(pid) = state.pid.take() {
            println!("[Tauri] Stopping running app process tree (PID {})...", pid);
            // Kill the entire process tree (npm + node + children)
            if let Err(e) = kill_process_tree(pid) {
              eprintln!("[Tauri] Warning: Failed to kill app process tree: {}", e);
            }
          }
          // Also try to kill any process reference we have
          if let Some(process) = state.process.take() {
            let pid = process.id();
            println!("[Tauri] Also killing process via handle (PID {})...", pid);
            let _ = kill_process_tree(pid);
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
