---
Status: shipped
Area: ui, infra
Created: 2026-02-01
LastUpdated: 2026-02-03
---

# Feature: Last Used Project Persistence
**Status**: ✅ IMPLEMENTED

## Implementation Summary

The last used project persistence feature has been fully implemented with automatic project loading on app launch.

**Implemented Features:**
- Global settings file stored in OS-appropriate location (`%AppData%/com.naide.desktop/naide-settings.json`)
- Last project path saved automatically when project is opened
- Automatic project reload on app launch
- Path validation (checks if project still exists)
- Graceful fallback to project picker if path is invalid
- Integration with recent projects list

**Backend (Rust):**
- `save_last_project` command in `src-tauri/src/lib.rs`
- `load_last_project` command in `src-tauri/src/lib.rs`
- Settings stored with version field for future migrations
- Automatic directory creation for settings file

**Frontend:**
- `loadLastProject()` function in `src/utils/globalSettings.ts`
- `saveLastProject()` function in `src/utils/globalSettings.ts`
- Auto-load on startup in `src/App.tsx`
- Project name and path extracted from settings
- Fallback to project picker if no valid last project

**Files Modified:**
- `src/naide-desktop/src/App.tsx` - Added auto-load logic in `initializeApp()`
- `src/naide-desktop/src/utils/globalSettings.ts` - Added API functions
- `src/naide-desktop/src-tauri/src/lib.rs` - Added Tauri commands
- `src/naide-desktop/src-tauri/src/settings.rs` - Settings persistence logic

## Summary
Automatically remember and reload the last opened project when Naide launches. This provides a seamless user experience by eliminating the need to manually navigate to the project folder on every launch.

---

## Goals
- Store the last opened project path in a global settings file
- Automatically load the last used project on app launch
- Store settings in OS-appropriate locations
- Handle missing/invalid project paths gracefully

---

## Non-Goals
- Multiple project history or "recent projects" list (future enhancement)
- Project favorites or bookmarks
- Workspace management (multiple open projects)
- Cloud sync of settings

---

## Problem Statement
Currently, when Naide launches, users must manually select a project folder every time. For users working on a single project consistently, this is repetitive and frustrating. By persisting the last opened project, we can reduce friction and improve the user experience.

---

## Core Behavior

### On Project Open
When a project folder is opened (via folder picker or any other method):
1. **Store the project path** in the global settings file
2. **Update timestamp** of last access
3. **Validate path exists** before storing

### On App Launch
1. **Check if global settings file exists**
2. **Read last project path** from settings
3. **Validate path still exists**
4. **If valid**: Load project automatically
5. **If invalid/missing**: Show project picker as normal

### Settings File Location

**Windows**:
```
%AppData%\com.naide.desktop\naide-settings.json
```
Example: `C:\Users\<username>\AppData\Roaming\com.naide.desktop\naide-settings.json`

**macOS**:
```
~/Library/Application Support/com.naide.desktop/naide-settings.json
```
Example: `/Users/<username>/Library/Application Support/com.naide.desktop/naide-settings.json`

**Linux**:
```
~/.config/com.naide.desktop/naide-settings.json
```
Example: `/home/<username>/.config/com.naide.desktop/naide-settings.json`

---

## Settings File Format

### Schema
```json
{
  "version": 1,
  "lastUsedProject": {
    "path": "/absolute/path/to/project",
    "lastAccessed": "2026-01-31T17:30:00.000Z"
  }
}
```

### Fields
- **version**: Schema version for future migrations (start at 1)
- **lastUsedProject.path**: Absolute path to project folder
- **lastUsedProject.lastAccessed**: ISO 8601 timestamp of last access

### Future Extensions
Settings file can later include:
- Recent projects list
- User preferences (theme, font size)
- Window position/size
- AI model preferences

---

## Implementation Details

### Tauri Backend (Rust)

#### Directory Creation
Use `tauri::api::path::app_data_dir()` or equivalent to get OS-appropriate path:
```rust
// Get the Naide settings directory
let app_data_dir = app.path_resolver()
    .app_data_dir()
    .expect("Failed to get app data dir");

let settings_path = app_data_dir.join("naide-settings.json");

// Ensure directory exists
std::fs::create_dir_all(&app_data_dir)?;
```

#### Save Settings Command
```rust
#[tauri::command]
async fn save_last_project(path: String) -> Result<(), String> {
    let settings = GlobalSettings {
        version: 1,
        last_used_project: Some(LastProject {
            path: path.clone(),
            last_accessed: Utc::now().to_rfc3339(),
        }),
    };
    
    // Write to settings file
    write_settings(settings)?;
    Ok(())
}
```

#### Load Settings Command
```rust
#[tauri::command]
async fn load_last_project() -> Result<Option<String>, String> {
    let settings = read_settings()?;
    
    // Validate path exists
    if let Some(project) = settings.last_used_project {
        if Path::new(&project.path).exists() {
            return Ok(Some(project.path));
        }
    }
    
    Ok(None)
}
```

### Frontend Integration

#### On Startup (App.tsx)
```typescript
useEffect(() => {
  async function initializeProject() {
    try {
      // Try to load last project
      const lastProjectPath = await invoke('load_last_project');
      
      if (lastProjectPath) {
        // Validate it's a valid Naide project
        if (await isValidProject(lastProjectPath)) {
          setProjectPath(lastProjectPath);
          return;
        }
      }
      
      // Fall back to project picker
      showProjectPicker();
    } catch (error) {
      console.error('Failed to load last project:', error);
      showProjectPicker();
    }
  }
  
  initializeProject();
}, []);
```

#### On Project Selection
```typescript
async function handleProjectSelected(path: string) {
  try {
    // Save as last used project
    await invoke('save_last_project', { path });
    
    // Load the project
    setProjectPath(path);
  } catch (error) {
    console.error('Failed to save last project:', error);
    // Non-fatal: still load the project
    setProjectPath(path);
  }
}
```

---

## Error Handling

### Missing Settings File
- **Expected on first launch**
- Create file with default/empty content
- Continue to project picker

### Invalid Project Path
- **Project folder was deleted or moved**
- Log warning
- Ignore stored path
- Show project picker

### Permission Errors
- **Cannot write to settings directory**
- Show error dialog to user
- Continue without persistence (degraded mode)

### Corrupted Settings File
- **JSON parse error**
- Log error
- Back up corrupted file (naide-settings.json.backup)
- Create fresh settings file
- Continue to project picker

---

## Testing Strategy

### Unit Tests
- Settings file serialization/deserialization
- Path validation logic
- OS-specific path resolution

### Integration Tests
1. **Fresh install**: No settings → project picker shown
2. **Return user**: Valid settings → project loaded automatically
3. **Moved project**: Invalid path → project picker shown
4. **Multiple launches**: Settings persist correctly
5. **Permission denied**: Graceful degradation

### Manual Testing Checklist
- [ ] First launch shows project picker
- [ ] After selecting project, settings file is created
- [ ] Second launch loads project automatically
- [ ] Delete project folder, launch → project picker shown
- [ ] Corrupted naide-settings.json → recover gracefully
- [ ] Works on Windows, macOS, Linux

---

## Security Considerations

### Path Validation
- **Always use absolute paths** (no relative paths)
- **Validate path exists** before loading
- **Check path is a directory** (not a file)
- **Sanitize path** for platform (handle symlinks, etc.)

### Privacy
- **Settings file is local only** (no cloud sync)
- **Contains no credentials** (only file paths)
- **User-accessible location** (can manually edit/delete)

### Safety
- **Read-only operation** on stored project initially
- **No automatic code execution** on project load
- **User can always choose different project** via File menu

---

## User-Facing Behavior

### First Launch
```
1. App starts
2. No settings found
3. "Welcome to Naide!" screen
4. "Open Project" button → folder picker
5. User selects folder
6. Project loads
7. Settings saved
```

### Subsequent Launches
```
1. App starts
2. Settings found with valid path
3. Project loads directly
4. No user interaction needed
```

### Invalid Stored Path
```
1. App starts
2. Settings found but path invalid
3. Show notification: "Previous project not found"
4. Show project picker
5. User selects project
6. Settings updated
```

---

## Future Enhancements
(Not in initial implementation)

### Recent Projects List
- Store last 5-10 projects
- Show in File → Recent Projects menu
- Quick switch between projects

### Project Validation
- Check for `.prompts/` folder
- Warn if project structure looks wrong
- Offer to initialize Naide in existing folder

### Settings UI
- Preferences dialog
- Clear recent projects
- Toggle auto-load behavior

### Migration Path
- When adding recent projects, migrate existing `lastUsedProject` to `recentProjects[0]`
- Preserve backward compatibility with version field

---

## Dependencies

### Rust Crates
- `serde` / `serde_json` - JSON serialization
- `chrono` - Timestamp handling
- `dirs` or `tauri::api::path` - OS paths

### Frontend
- No new dependencies needed
- Uses existing Tauri invoke mechanism

---

## Success Criteria

✅ Settings file is created on first project selection  
✅ Last project loads automatically on subsequent launches  
✅ Graceful handling of missing/invalid paths  
✅ Works correctly on Windows, macOS, and Linux  
✅ No performance impact on launch time (<100ms overhead)  
✅ Settings file location follows OS conventions  

---

## Open Questions

1. **Should we show a "Loading project..." splash screen** during auto-load?
   - Probably yes if load takes >500ms
   
2. **Should user be able to disable auto-load** behavior?
   - Could add a preference later, default to enabled
   
3. **Should we add telemetry** for project load success/failure rates?
   - Defer to overall telemetry strategy
   
4. **What if user has multiple Naide windows open?**
   - Current design: last-closed-window wins
   - Future: per-window settings or workspace support
