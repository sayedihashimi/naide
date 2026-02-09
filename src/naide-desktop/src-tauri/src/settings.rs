use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LastProject {
    pub path: String,
    pub last_accessed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalSettings {
    pub version: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_project: Option<LastProject>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recent_projects: Vec<LastProject>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub project_link_domains: Vec<String>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            version: 1,
            last_used_project: None,
            recent_projects: Vec::new(),
            project_link_domains: Vec::new(),
        }
    }
}

/// Get the path to the settings file
pub fn get_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    
    // Ensure directory exists
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    
    Ok(app_data_dir.join("naide-settings.json"))
}

/// Read settings from file
pub fn read_settings(app: &tauri::AppHandle) -> Result<GlobalSettings, String> {
    let settings_path = get_settings_path(app)?;
    
    if !settings_path.exists() {
        // No settings file yet, return default
        return Ok(GlobalSettings::default());
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    
    let settings: GlobalSettings = serde_json::from_str(&content)
        .map_err(|e| {
            // On parse error, backup the corrupted file
            let backup_path = settings_path.with_extension("json.backup");
            let _ = fs::copy(&settings_path, &backup_path);
            format!("Failed to parse settings file (backed up to {:?}): {}", backup_path, e)
        })?;
    
    Ok(settings)
}

/// Write settings to file
pub fn write_settings(app: &tauri::AppHandle, settings: &GlobalSettings) -> Result<(), String> {
    let settings_path = get_settings_path(app)?;
    
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&settings_path, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    Ok(())
}

/// Add a project to the recent projects list
/// Removes duplicates, updates timestamp, limits to 10 most recent, and sorts by last_accessed
pub fn add_recent_project(settings: &mut GlobalSettings, path: String, timestamp: String) {
    // Remove existing entry with the same path (case-insensitive on Windows)
    settings.recent_projects.retain(|p| {
        #[cfg(target_os = "windows")]
        {
            p.path.to_lowercase() != path.to_lowercase()
        }
        #[cfg(not(target_os = "windows"))]
        {
            p.path != path
        }
    });
    
    // Add the new project at the beginning
    settings.recent_projects.insert(0, LastProject {
        path,
        last_accessed: timestamp,
    });
    
    // Keep only the 10 most recent projects
    if settings.recent_projects.len() > 10 {
        settings.recent_projects.truncate(10);
    }
}

/// Remove a project from the recent projects list.
/// Also clears last_used_project if it matches the removed path.
pub fn remove_recent_project(settings: &mut GlobalSettings, path: &str) {
    #[cfg(target_os = "windows")]
    settings.recent_projects.retain(|p| !p.path.eq_ignore_ascii_case(path));
    #[cfg(not(target_os = "windows"))]
    settings.recent_projects.retain(|p| p.path != path);

    if let Some(ref last) = settings.last_used_project {
        #[cfg(target_os = "windows")]
        let matches = last.path.eq_ignore_ascii_case(path);
        #[cfg(not(target_os = "windows"))]
        let matches = last.path == path;

        if matches {
            settings.last_used_project = None;
        }
    }
}

/// Get recent projects sorted by last_accessed (most recent first)
pub fn get_recent_projects(settings: &GlobalSettings) -> Vec<LastProject> {
    settings.recent_projects.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = GlobalSettings::default();
        assert_eq!(settings.version, 1);
        assert!(settings.last_used_project.is_none());
    }

    #[test]
    fn test_serialize_settings() {
        let settings = GlobalSettings {
            version: 1,
            last_used_project: Some(LastProject {
                path: "/test/project".to_string(),
                last_accessed: "2026-01-31T17:30:00.000Z".to_string(),
            }),
            recent_projects: Vec::new(),
        };
        
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("\"version\":1"));
        assert!(json.contains("/test/project"));
    }

    #[test]
    fn test_add_recent_project() {
        let mut settings = GlobalSettings::default();
        
        // Add first project
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T10:00:00Z".to_string());
        assert_eq!(settings.recent_projects.len(), 1);
        assert_eq!(settings.recent_projects[0].path, "/path/to/project1");
        
        // Add second project
        add_recent_project(&mut settings, "/path/to/project2".to_string(), "2026-01-31T11:00:00Z".to_string());
        assert_eq!(settings.recent_projects.len(), 2);
        assert_eq!(settings.recent_projects[0].path, "/path/to/project2"); // Most recent first
        
        // Add duplicate - should update position
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T12:00:00Z".to_string());
        assert_eq!(settings.recent_projects.len(), 2);
        assert_eq!(settings.recent_projects[0].path, "/path/to/project1"); // Now first
        assert_eq!(settings.recent_projects[1].path, "/path/to/project2");
    }

    #[test]
    fn test_recent_projects_limit() {
        let mut settings = GlobalSettings::default();
        
        // Add 12 projects
        for i in 1..=12 {
            add_recent_project(&mut settings, format!("/path/to/project{}", i), format!("2026-01-31T{}:00:00Z", i));
        }
        
        // Should be limited to 10
        assert_eq!(settings.recent_projects.len(), 10);
        // Most recent should be first
        assert_eq!(settings.recent_projects[0].path, "/path/to/project12");
        // Oldest of the 10 should be project 3
        assert_eq!(settings.recent_projects[9].path, "/path/to/project3");
    }

    #[test]
    fn test_get_recent_projects() {
        let mut settings = GlobalSettings::default();
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T10:00:00Z".to_string());
        add_recent_project(&mut settings, "/path/to/project2".to_string(), "2026-01-31T11:00:00Z".to_string());
        
        let recent = get_recent_projects(&settings);
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].path, "/path/to/project2");
        assert_eq!(recent[1].path, "/path/to/project1");
    }

    #[test]
    fn test_remove_recent_project() {
        let mut settings = GlobalSettings::default();
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T10:00:00Z".to_string());
        add_recent_project(&mut settings, "/path/to/project2".to_string(), "2026-01-31T11:00:00Z".to_string());
        add_recent_project(&mut settings, "/path/to/project3".to_string(), "2026-01-31T12:00:00Z".to_string());
        assert_eq!(settings.recent_projects.len(), 3);

        remove_recent_project(&mut settings, "/path/to/project2");
        assert_eq!(settings.recent_projects.len(), 2);
        assert_eq!(settings.recent_projects[0].path, "/path/to/project3");
        assert_eq!(settings.recent_projects[1].path, "/path/to/project1");
    }

    #[test]
    fn test_remove_recent_project_clears_last_used() {
        let mut settings = GlobalSettings::default();
        settings.last_used_project = Some(LastProject {
            path: "/path/to/project1".to_string(),
            last_accessed: "2026-01-31T10:00:00Z".to_string(),
        });
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T10:00:00Z".to_string());

        remove_recent_project(&mut settings, "/path/to/project1");
        assert_eq!(settings.recent_projects.len(), 0);
        assert!(settings.last_used_project.is_none());
    }

    #[test]
    fn test_remove_recent_project_not_in_list() {
        let mut settings = GlobalSettings::default();
        add_recent_project(&mut settings, "/path/to/project1".to_string(), "2026-01-31T10:00:00Z".to_string());

        remove_recent_project(&mut settings, "/path/to/nonexistent");
        assert_eq!(settings.recent_projects.len(), 1);
    }
}
