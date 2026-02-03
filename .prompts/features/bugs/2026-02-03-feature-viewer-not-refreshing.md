# Bug: Feature Files Viewer Doesn't Refresh When AI Creates New Files

**Type:** Bug Fix  
**Priority:** Medium  
**Status:** ✅ Fixed (2026-02-03)

---

## Problem Statement

The Feature Files Viewer in the left panel does not automatically refresh when the AI creates new feature or bug files during a chat session. Users must manually reload the entire app to see newly created files appear in the list.

**Actual behavior:**
1. User asks AI to create a feature spec
2. AI creates file in `.prompts/features/` or `.prompts/features/bugs/`
3. File list in left panel remains unchanged
4. New file is not visible until app restart

**Expected behavior:**
1. User asks AI to create a feature spec
2. AI creates file
3. File list automatically updates
4. New file appears in the tree view

---

## Root Cause

The Feature Files Viewer component loads the file list once on mount and never refreshes. There is no mechanism to detect when files are added, removed, or modified in the `.prompts/features/` directory.

---

## Proposed Solution

Implement **file system watching** for the `.prompts/features/` directory with the following approach:

### Primary Solution: File Watcher (Recommended)

**Backend (Tauri):**
1. Use Tauri's file system watcher to monitor `.prompts/features/**`
2. Emit events when files are added, removed, or modified
3. Send events to frontend via Tauri event system

**Frontend (React):**
1. Subscribe to file system events on component mount
2. When event received, refresh the file list
3. Debounce rapid changes (e.g., 500ms) to avoid excessive refreshes
4. Unsubscribe on component unmount

**Benefits:**
- Automatic updates - no user action needed
- Works for external changes (user editing in VS Code, git operations)
- Real-time sync with file system
- Better UX - feels responsive and "live"

### Alternative Solution: Manual Refresh Button

Add a refresh button (↻ icon) next to the filter input.

**Benefits:**
- Simple to implement (just re-call `list_feature_files()`)
- No file watching complexity
- User has explicit control

**Drawbacks:**
- Requires manual user action
- Easy to forget to refresh
- Doesn't solve the UX problem completely

### Hybrid Approach (Best of Both)

Implement file watcher as primary mechanism, but also include a manual refresh button as a fallback in case watching fails or for user preference.

---

## Scope

### In Scope
- File watcher for `.prompts/features/**` directory
- Auto-refresh file list when changes detected
- Debouncing to handle rapid changes
- Error handling if file watching is unavailable
- Optional: Manual refresh button as fallback

### Out of Scope
- Watching other directories (e.g., `.prompts/plan/`)
- Real-time preview updates (separate feature)
- File change notifications/toasts
- Conflict resolution for concurrent edits

---

## Technical Implementation

### Backend Changes (Rust)

**File:** `src-tauri/src/lib.rs`

Add file watcher command:
```rust
use tauri::api::watcher::{watch, DebouncedEvent};
use std::sync::mpsc::channel;
use std::time::Duration;

#[tauri::command]
async fn watch_feature_files(window: tauri::Window, project_path: String) -> Result<(), String> {
    let features_path = Path::new(&project_path).join(".prompts/features");
    
    let (tx, rx) = channel();
    let mut watcher = watch(&features_path, tx, Duration::from_millis(500))
        .map_err(|e| e.to_string())?;
    
    std::thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(DebouncedEvent::Create(_)) |
                Ok(DebouncedEvent::Remove(_)) |
                Ok(DebouncedEvent::Rename(_, _)) => {
                    window.emit("feature-files-changed", {}).ok();
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}
```

### Frontend Changes (TypeScript/React)

**File:** `src/components/FeatureFilesViewer.tsx`

```typescript
useEffect(() => {
  // Initial load
  loadFeatureFiles();
  
  // Set up file watcher
  const unlisten = await listen('feature-files-changed', () => {
    // Debounce on frontend side too
    debouncedRefresh();
  });
  
  // Start watching
  invoke('watch_feature_files', { projectPath });
  
  return () => {
    unlisten();
  };
}, [projectPath]);

const debouncedRefresh = debounce(() => {
  loadFeatureFiles();
}, 500);
```

**Add manual refresh button:**
```typescript
<div className="filter-bar">
  <input type="text" placeholder="Filter features..." />
  <button onClick={loadFeatureFiles} title="Refresh">
    <RefreshCw size={16} />
  </button>
  <button onClick={toggleViewOptions} title="View options">
    <Settings size={16} />
  </button>
</div>
```

---

## Files Affected

- `src-tauri/src/lib.rs` - Add file watcher command
- `src-tauri/Cargo.toml` - Add dependencies (if needed)
- `src/components/FeatureFilesViewer.tsx` - Subscribe to events, add refresh logic
- `src/utils/fileSystem.ts` - Add helper functions (if needed)

---

## Acceptance Criteria

### Must Have
- [ ] When AI creates a new file in `.prompts/features/**`, file list refreshes automatically
- [ ] When file is deleted, file list updates to remove it
- [ ] When file is renamed, file list reflects the change
- [ ] Changes are debounced (no excessive refreshes)
- [ ] File watcher unsubscribes on component unmount (no memory leaks)
- [ ] Manual refresh button works as fallback

### Should Have
- [ ] External changes (VS Code edits) trigger refresh
- [ ] Graceful error handling if file watching is unavailable
- [ ] Loading state during refresh (optional, if noticeable)

### Nice to Have
- [ ] Visual indication when file list is refreshing
- [ ] Preserve expanded/collapsed folder state after refresh
- [ ] Preserve scroll position after refresh

---

## Testing

### Manual Testing
1. Open Naide with feature files viewer visible
2. Ask AI to create a new feature file
3. Verify file appears in list automatically (within 1 second)
4. Create a file manually in `.prompts/features/` using file explorer
5. Verify file appears in list automatically
6. Delete a file using file explorer
7. Verify file disappears from list automatically
8. Click manual refresh button
9. Verify list refreshes correctly

### Edge Cases
- Rapid file creation (create 10 files quickly)
- File watcher unavailable (simulate failure)
- Very large directory (100+ files)
- Network drive or slow file system
- File permissions issues

---

## Related Features

- [2026-02-01-feature-files-viewer.md](../2026-02-01-feature-files-viewer.md) - Original feature spec
- [2026-02-03-feature-files-popup-viewer.md](../2026-02-03-feature-files-popup-viewer.md) - Popup enhancement

---

## Notes

- Tauri provides built-in file watching capabilities via `notify` crate
- Debouncing is important to avoid excessive UI updates
- Consider platform differences (Windows, macOS, Linux) for file watching
- File watching might not work on network drives or certain file systems
- Manual refresh button provides good fallback UX

---

## Fix Summary (2026-02-03)

**Implementation**: Hybrid approach with automatic file watching and manual refresh button.

**Changes Made**:

1. **Backend (Rust)**:
   - Added `notify = "6.1"` dependency to `Cargo.toml`
   - Created `WatcherState` struct to track file watcher
   - Implemented `watch_feature_files` Tauri command
   - Watches `.prompts/features/` directory recursively
   - Emits `feature-files-changed` events on file create/modify/delete
   - Events are debounced at the file system level

2. **Frontend (React)**:
   - Updated `FeatureFilesViewer.tsx`:
     - Added Tauri event imports (`invoke`, `listen`)
     - Created memoized `loadFiles` function
     - Implemented `debouncedRefresh` with 500ms debounce
     - Set up event listener for `feature-files-changed` events
     - Added manual refresh button (↻ icon) next to filter input
     - Refresh button shows spinner when loading
     - Proper cleanup on component unmount (removes listeners)

**Benefits**:
- ✅ Automatic refresh when AI creates/modifies/deletes files
- ✅ Works for external changes (VS Code, file explorer, git)
- ✅ Manual refresh button as fallback if watcher fails
- ✅ Debounced to avoid excessive refreshes (500ms)
- ✅ No memory leaks (proper cleanup)
- ✅ Visual feedback (loading spinner)

**Testing Recommendations**:
- Ask AI to create a feature file → should auto-refresh within 1 second
- Create file manually in `.prompts/features/` → should auto-refresh
- Delete a file → should auto-refresh
- Click refresh button → should refresh immediately
- Verify no console errors

---

created by naide
