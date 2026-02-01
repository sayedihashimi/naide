use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            version: 1,
            last_used_project: None,
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
        };
        
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("\"version\":1"));
        assert!(json.contains("/test/project"));
    }
}
