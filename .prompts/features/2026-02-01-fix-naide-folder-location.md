# Fix: .naide Folder Location

**Type:** Bug Fix  
**Priority:** High  
**Status:** ✅ IMPLEMENTED (2026-02-03 - Status Verified)

---

## Implementation Summary

**What Was Fixed:**
The `.naide` folder was incorrectly created in the Documents directory instead of the user's opened project directory. This has been fixed, and chat sessions now persist correctly in the project root.

**Key Changes:**
1. **State Management**: Updated `AppContext` to track both `projectName` and `projectPath` (actual opened directory)
2. **File System Functions**: Modified all functions in `fileSystem.ts` and `chatPersistence.ts` to accept optional `actualPath` parameter
3. **UI Integration**: Updated `GenerateAppScreen.tsx` and `App.tsx` to pass actual project paths through the app
4. **Tauri Permissions**: Fixed file system capabilities to allow access to user-selected directories
5. **Logging Infrastructure**: Added comprehensive logging to diagnose issues in production

**Tauri 2.x Learnings:**
- File system access requires explicit `fs:scope` permission with path patterns
- Used wildcard pattern `{ "path": "**" }` to allow access to any user-selected directory
- This is appropriate for dev tools that need broad file access (like VSCode, IntelliJ)
- Dialog-selected paths are accessible with proper scope configuration

**Logging Infrastructure:**
- Created `utils/logger.ts` that uses Tauri commands to forward logs to backend
- Frontend logs now appear in Tauri log file via `log_to_file` command
- `TargetKind::Webview` in Rust backend captures console output
- Command-based logging more reliable than plugin API

**Files Modified:**
- `src/naide-desktop/src/context/AppContext.tsx` - Added projectPath state
- `src/naide-desktop/src/utils/fileSystem.ts` - Accept actualPath parameter
- `src/naide-desktop/src/utils/chatPersistence.ts` - Use actual project paths
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - Pass project path
- `src/naide-desktop/src/App.tsx` - Handle project path on init
- `src/naide-desktop/src-tauri/capabilities/default.json` - Fix file system permissions
- `src/naide-desktop/src-tauri/src/lib.rs` - Add log_to_file command, enable WebView logging
- `src/naide-desktop/src/utils/logger.ts` - New logging utility
- `.gitignore` - Added `.naide/` to prevent committing project-local state

---

## Problem

The `.naide` folder (containing `chatsessions/` and `project-config.json`) is currently being created in the **Documents directory** instead of the **project directory** (the directory the user explicitly opens).

This causes:
- Configuration and chat history to be stored in the wrong location
- Potential conflicts when multiple projects are opened
- Loss of project-specific context and settings

---

## Expected Behavior

**General Rule:**  
When a user opens a project directory, the `.naide` folder must be created **inside that project directory**.

**Exception:**  
Only on first launch, before the user has explicitly opened any project, may the app use a fallback location (e.g., Documents folder).

---

## Scope

### In Scope
- Move `.naide` folder creation logic to use the opened project directory
- Ensure `project-config.json` is written to `<project-root>/.naide/`
- Ensure chat sessions are stored in `<project-root>/.naide/chatsessions/`
- Handle the first-launch case when no project is open (fallback to Documents or prompt user)

### Out of Scope
- Migration of existing `.naide` data from Documents to project directories (can be handled separately if needed)
- Changes to the `.naide` folder structure or contents

---

## Technical Details

### Current Incorrect Behavior
```
Documents/
  .naide/
    chatsessions/
    project-config.json
```

### Expected Correct Behavior
```
<user-opened-project-directory>/
  .naide/
    chatsessions/
    project-config.json
```

### Implementation Notes
1. Identify where the code currently references the Documents folder for `.naide`
2. Update to use the project root directory (the directory the user opened)
3. Add a check: if no project is open (first launch), use a temporary fallback or prompt the user to open a project
4. Ensure all file I/O operations for `.naide` use the correct project-relative path

---

## Acceptance Criteria

- [x] When a user opens a project directory, `.naide/` is created inside that project directory
- [x] `project-config.json` is written to `<project-root>/.naide/project-config.json`
- [x] Chat sessions are saved to `<project-root>/.naide/chatsessions/`
- [x] The Documents folder is **only** used when the app first launches and no project has been opened yet
- [x] Opening different projects creates separate `.naide` folders in each project
- [x] No code references the Documents folder for `.naide` except for the first-launch fallback case

---

## Testing

- Open a project directory
- Verify `.naide/` folder is created in that project root
- Create a chat session and verify it's saved in `<project-root>/.naide/chatsessions/`
- Close and reopen the same project; verify existing `.naide` data is loaded correctly
- Open a different project; verify a separate `.naide` folder is created there
- Launch app without opening a project; verify fallback behavior (e.g., prompt or use Documents temporarily)

---

## Notes

- The `.naide` folder should be added to `.gitignore` (if not already) to avoid committing project-local state
- Consider documenting this behavior in the README or user guide

## Implementation Details (2026-02-02)

### Tauri 2.x Permissions Challenge

The biggest challenge was Tauri 2.x's security model. By default, Tauri blocks file system access to protect users. For Naide to work, we needed:

**Capabilities Configuration** (`src-tauri/capabilities/default.json`):
```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "**" }]  // Wildcard allows any user-selected path
    },
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-read-dir",
    "dialog:default"
  ]
}
```

The wildcard scope (`**`) is necessary because:
- Users can open projects from ANY location on their system
- Desktop dev tools need broad file access (VSCode, IntelliJ do the same)
- User explicitly selects directories via dialog (not arbitrary access)

### Debugging with Logging

Comprehensive logging was essential for diagnosing the permissions issue:

**Logger Utility** (`utils/logger.ts`):
- Uses Tauri commands (`log_to_file`) instead of plugin API
- Writes to both console (DevTools) and Tauri log file
- Gracefully handles test environment

**Backend Command** (`src-tauri/src/lib.rs`):
```rust
#[tauri::command]
async fn log_to_file(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "info" => log::info!("{}", message),
        "error" => log::error!("{}", message),
        // ...
    }
    Ok(())
}
```

This approach proved more reliable than `@tauri-apps/plugin-log` API calls, which were failing silently.

### Path Handling

**AppContext Changes:**
```typescript
interface AppState {
  projectName: string;
  projectPath: string | null;  // New: actual opened directory
  // ...
}
```

**File System Functions:**
```typescript
export async function getProjectPath(projectName: string, actualPath?: string): Promise<string> {
  if (actualPath) {
    return actualPath;  // Use actual opened path
  }
  // Fallback to Documents for legacy/first-launch
  const basePath = await getProjectsBasePath();
  return await join(basePath, projectName);
}
```

All file operations now accept `actualPath` parameter and use it when available.

created by naide