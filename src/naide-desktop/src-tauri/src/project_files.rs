use std::fs;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ProjectFileNode {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub file_extension: Option<String>,
}

// List of folders/files to exclude from the project file tree
const EXCLUDED_ITEMS: &[&str] = &["node_modules", ".git", "bin", "obj", "dist"];

/// List immediate children of a directory (non-recursive, lazy loading)
#[tauri::command]
pub async fn list_project_files(
    project_path: String,
    relative_path: Option<String>,
) -> Result<Vec<ProjectFileNode>, String> {
    let base_path = PathBuf::from(&project_path);
    
    if !base_path.exists() {
        return Err("Project path does not exist".to_string());
    }
    
    // Construct the full path to read
    let target_path = if let Some(rel) = relative_path {
        base_path.join(rel)
    } else {
        base_path.clone()
    };
    
    if !target_path.exists() {
        return Err("Target path does not exist".to_string());
    }
    
    if !target_path.is_dir() {
        return Err("Target path is not a directory".to_string());
    }
    
    // Read directory entries
    let entries = fs::read_dir(&target_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut files: Vec<ProjectFileNode> = Vec::new();
    let mut folders: Vec<ProjectFileNode> = Vec::new();
    
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // Skip entries we can't read
        };
        
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // Skip excluded items
        if EXCLUDED_ITEMS.contains(&file_name.as_str()) {
            continue;
        }
        
        // Get metadata
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue, // Skip entries we can't read metadata for
        };
        
        let is_folder = metadata.is_dir();
        
        // Calculate relative path from project root
        let full_path = entry.path();
        let relative = full_path
            .strip_prefix(&base_path)
            .unwrap_or(&full_path)
            .to_string_lossy()
            .to_string();
        
        // Get file extension for files
        let file_extension = if !is_folder {
            full_path
                .extension()
                .map(|ext| ext.to_string_lossy().to_string())
        } else {
            None
        };
        
        let node = ProjectFileNode {
            name: file_name,
            path: relative,
            is_folder,
            file_extension,
        };
        
        if is_folder {
            folders.push(node);
        } else {
            files.push(node);
        }
    }
    
    // Sort alphabetically (case-insensitive)
    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    // Combine: folders first, then files
    let mut result = folders;
    result.extend(files);
    
    Ok(result)
}
