use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use std::sync::mpsc::{channel, Receiver};
use regex::Regex;
use tauri::Emitter;
use serde_json;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppInfo {
    pub app_type: String, // "dotnet" or "npm"
    pub project_file: Option<String>, // For dotnet, the .csproj path
    pub command: Option<String>, // For npm, the script name
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunningAppInfo {
    pub pid: u32,
    pub url: Option<String>,
}

/// Detect if the project has a runnable npm app
pub fn detect_npm_app(project_path: &str) -> Result<Option<AppInfo>, String> {
    let project_dir = Path::new(project_path);
    let package_json_path = project_dir.join("package.json");
    
    if !package_json_path.exists() {
        return Ok(None);
    }
    
    // Read and parse package.json
    let content = fs::read_to_string(&package_json_path)
        .map_err(|e| format!("Failed to read package.json: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse package.json: {}", e))?;
    
    // Check for runnable scripts (priority order)
    let script_priority = ["dev", "start", "serve", "preview"];
    
    if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
        for script_name in &script_priority {
            if scripts.contains_key(*script_name) {
                log::info!("Found npm script: {}", script_name);
                return Ok(Some(AppInfo {
                    app_type: "npm".to_string(),
                    project_file: None,
                    command: Some(script_name.to_string()),
                }));
            }
        }
    }
    
    Ok(None)
}

/// Detect if the project has a runnable .NET web app
pub fn detect_dotnet_app(project_path: &str) -> Result<Option<AppInfo>, String> {
    let project_dir = Path::new(project_path);
    
    // Look for .csproj files recursively
    let csproj_files = find_files_with_extension(project_dir, "csproj")?;
    
    for csproj_path in csproj_files {
        if is_web_project(&csproj_path)? {
            // Found a web project, return the first one
            let relative_path = csproj_path
                .strip_prefix(project_dir)
                .unwrap_or(&csproj_path)
                .to_string_lossy()
                .to_string();
            
            return Ok(Some(AppInfo {
                app_type: "dotnet".to_string(),
                project_file: Some(relative_path),
                command: None,
            }));
        }
    }
    
    Ok(None)
}

/// Find all files with a given extension recursively
fn find_files_with_extension(dir: &Path, extension: &str) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    
    if !dir.is_dir() {
        return Ok(files);
    }
    
    fn walk_dir(dir: &Path, extension: &str, files: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))? {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let path = entry.path();
            
            // Skip node_modules, bin, obj folders
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str == "node_modules" || name_str == "bin" || name_str == "obj" {
                    continue;
                }
            }
            
            if path.is_dir() {
                walk_dir(&path, extension, files)?;
            } else if let Some(ext) = path.extension() {
                if ext == extension {
                    files.push(path);
                }
            }
        }
        Ok(())
    }
    
    walk_dir(dir, extension, &mut files)?;
    Ok(files)
}

/// Check if a .csproj file is a web project
fn is_web_project(csproj_path: &Path) -> Result<bool, String> {
    let content = fs::read_to_string(csproj_path)
        .map_err(|e| format!("Failed to read {}: {}", csproj_path.display(), e))?;
    
    // Check for web SDK or web-related packages
    let is_web = content.contains("Microsoft.NET.Sdk.Web")
        || content.contains("Microsoft.AspNetCore.App")
        || content.contains("Microsoft.AspNetCore.All");
    
    Ok(is_web)
}

/// Start a .NET app with dotnet watch
pub fn start_dotnet_app(
    project_path: &str,
    project_file: &str,
    window: tauri::Window,
) -> Result<(Child, Receiver<String>), String> {
    let full_project_path = Path::new(project_path).join(project_file);
    
    log::info!("Starting .NET app: dotnet watch --non-interactive --project {}", full_project_path.display());
    
    let mut child = Command::new("dotnet")
        .arg("watch")
        .arg("--non-interactive")
        .arg("--project")
        .arg(&full_project_path)
        .current_dir(project_path)
        .env("DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER", "1")
        .env("HotReloadAutoRestart", "true")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start dotnet: {}", e))?;
    
    let pid = child.id();
    log::info!("Started dotnet watch with PID: {}", pid);
    
    // Create a channel to signal when URL is detected
    let (tx, rx) = channel();
    
    // Spawn a thread to read stdout and detect URL
    if let Some(stdout) = child.stdout.take() {
        let tx_clone = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let url_regex = Regex::new(r"https?://[^\s]+").unwrap();
            
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::info!("[dotnet stdout] {}", line);
                    
                    // Look for URL in output
                    if let Some(captures) = url_regex.find(&line) {
                        let url = captures.as_str().to_string();
                        log::info!("Detected URL: {}", url);
                        let _ = tx_clone.send(url);
                        break;
                    }
                }
            }
        });
    }
    
    // Also read stderr to capture errors and hot reload messages
    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::error!("[dotnet stderr] {}", line);
                    
                    // Detect hot reload success message
                    if line.contains("Hot reload succeeded") || line.contains("Hot reload of changes succeeded") {
                        log::info!("Hot reload detected, emitting refresh event");
                        // Emit event to frontend to refresh the browser
                        if let Err(e) = window_clone.emit("hot-reload-success", ()) {
                            log::error!("Failed to emit hot-reload-success event: {}", e);
                        }
                    }
                }
            }
        });
    }
    
    Ok((child, rx))
}

/// Extract URL from the receiver with timeout
pub fn wait_for_url(rx: std::sync::mpsc::Receiver<String>, timeout_secs: u64) -> Option<String> {
    use std::time::Duration;
    
    match rx.recv_timeout(Duration::from_secs(timeout_secs)) {
        Ok(url) => Some(url),
        Err(_) => None,
    }
}

/// Start an npm app
pub fn start_npm_app(
    project_path: &str,
    script_name: &str,
    _window: tauri::Window,
) -> Result<(Child, Receiver<String>), String> {
    let project_dir = Path::new(project_path);
    
    log::info!("Starting npm app: npm run {}", script_name);
    
    // Spawn npm run {script}
    // Use stdin(Stdio::null()) to prevent terminal corruption when the process exits
    // Without this, interactive dev servers can leave the terminal in raw mode
    let mut child = Command::new("npm")
        .arg("run")
        .arg(script_name)
        .current_dir(project_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start npm: {}", e))?;
    
    let pid = child.id();
    log::info!("Started npm with PID: {}", pid);
    
    // Create a channel to signal when URL is detected
    let (tx, rx) = channel();
    
    // Capture stdout for URL detection
    if let Some(stdout) = child.stdout.take() {
        let tx_clone = tx.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            // Common patterns for npm dev servers
            // Vite: "Local:   http://localhost:5173/"
            // CRA: "Local:            http://localhost:3000"
            // webpack: "http://localhost:8080"
            let url_regex = Regex::new(r"(?:Local:\s*|http://)(?:http://)?(?:localhost|127\.0\.0\.1):(\d+)").unwrap();
            
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::info!("[npm stdout] {}", line);
                    
                    // Try to extract URL
                    if let Some(captures) = url_regex.captures(&line) {
                        if let Some(port) = captures.get(1) {
                            let url = format!("http://localhost:{}", port.as_str());
                            log::info!("Detected npm URL: {}", url);
                            let _ = tx_clone.send(url);
                            break;
                        }
                    }
                    
                    // Also check for direct URL patterns
                    let direct_url_regex = Regex::new(r"https?://[^\s]+").unwrap();
                    if let Some(url_match) = direct_url_regex.find(&line) {
                        let url = url_match.as_str().to_string();
                        if url.contains("localhost") || url.contains("127.0.0.1") {
                            log::info!("Detected npm URL: {}", url);
                            let _ = tx_clone.send(url);
                            break;
                        }
                    }
                }
            }
        });
    }
    
    // Also read stderr to capture errors
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::error!("[npm stderr] {}", line);
                }
            }
        });
    }
    
    Ok((child, rx))
}
