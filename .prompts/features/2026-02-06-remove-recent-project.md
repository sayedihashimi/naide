---
Status: planned
Area: ui, settings
Created: 2026-02-06
LastUpdated: 2026-02-06
---

# Feature: Remove Project from Recent Projects List
**Status**: 🟡 PLANNED

## Summary
Add a trash can icon to each entry in the Recent Projects dropdown so users can remove projects from the list. Removal only affects the stored list—it does **not** modify the project folder on disk. The trash icon is hidden for the currently loaded project.

---

## Goals
- Allow users to clean up the recent projects list
- Remove stale or unwanted entries without affecting project files
- Keep the interaction fast and frictionless (no confirmation dialog)

---

## Non-Goals
- Deleting or modifying the actual project folder on disk
- Removing the currently loaded project from the list
- Undo/restore of removed entries
- Bulk removal (select multiple)

---

## Problem Statement
The Recent Projects dropdown accumulates entries over time. Some entries may point to deleted folders, renamed projects, or experiments the user no longer needs. Currently there is no way to clean up this list. Users are stuck with a growing list of stale entries.

---

## Core Behavior

### Trash Icon Placement
- Each project entry in the Recent Projects dropdown shows a **trash can icon** on the right side
- The icon is **hidden for the currently loaded project** (the user cannot remove the active project from the list)
- Icon appears on hover or is always visible (subtle styling)

### Click Behavior
- Clicking the trash icon **immediately removes** the entry from the list
- **No confirmation dialog** — removal is instant
- The dropdown stays open and the list updates immediately
- Clicking the trash icon does **not** trigger project selection (use `stopPropagation`)

### What Removal Does
- Removes the project entry from `recent_projects` in `GlobalSettings`
- If the removed project was also `last_used_project`, clear that field too
- Persists the updated settings to disk immediately
- Does **NOT** touch the project folder, `.naide/` directory, or any files on disk

### Edge Cases
- **Last remaining entry (other than current)**: Removing it leaves only the current project in the list. Dropdown shows the current project without a trash icon.
- **All entries removed except current**: Dropdown shows only the current project (no trash icon). This is fine.
- **Removed project folder still exists**: No impact — it's just removed from the list. User can re-open it via "Open Project" button.

---

## Technical Implementation

### Backend (Rust)

**File**: `src/naide-desktop/src-tauri/src/settings.rs`

Add a new function:

```rust
pub fn remove_recent_project(settings: &mut GlobalSettings, path: &str) {
    // Remove from recent_projects list (case-insensitive on Windows)
    #[cfg(target_os = "windows")]
    settings.recent_projects.retain(|p| !p.path.eq_ignore_ascii_case(path));
    #[cfg(not(target_os = "windows"))]
    settings.recent_projects.retain(|p| p.path != path);

    // If this was also the last_used_project, clear it
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
```

**File**: `src/naide-desktop/src-tauri/src/lib.rs`

Add a new Tauri command:

```rust
#[tauri::command]
async fn remove_recent_project(path: String) -> Result<(), String> {
    let mut settings = settings::read_settings().map_err(|e| e.to_string())?;
    settings::remove_recent_project(&mut settings, &path);
    settings::write_settings(&settings).map_err(|e| e.to_string())?;
    Ok(())
}
```

Register the command in the invoke handler alongside existing commands.

### Frontend (TypeScript)

**File**: `src/naide-desktop/src/utils/globalSettings.ts`

Add a new function:

```typescript
export async function removeRecentProject(path: string): Promise<void> {
  try {
    await invoke('remove_recent_project', { path });
  } catch (error) {
    console.error('Failed to remove recent project:', error);
  }
}
```

**File**: `src/naide-desktop/src/pages/GenerateAppScreen.tsx`

In the Recent Projects dropdown rendering:

1. Add a trash icon button to each dropdown item
2. Hide the trash icon when the item's path matches the current project path
3. On trash icon click:
   - Call `stopPropagation()` to prevent project selection
   - Call `removeRecentProject(project.path)`
   - Update local `recentProjects` state to remove the entry immediately

```typescript
const handleRemoveRecentProject = async (projectPath: string, e: React.MouseEvent) => {
  e.stopPropagation();
  await removeRecentProject(projectPath);
  setRecentProjects(prev => prev.filter(p => p.path !== projectPath));
};
```

### Trash Icon Styling
- Icon: Lucide `Trash2` (16px)
- Color: `text-zinc-500` default, `text-red-400` on hover
- Positioned on the right side of the dropdown item
- Clickable area: at least 24×24px for easy targeting
- Hidden for the currently loaded project entry

---

## UI/UX Details

### Dropdown Item Layout
```
┌──────────────────────────────────────────────┐
│ MyProject                           [🗑]     │  ← Other project (trash visible)
│ C:\Users\me\projects\MyProject               │
├──────────────────────────────────────────────┤
│ CurrentProject                               │  ← Current project (no trash)
│ C:\Users\me\projects\CurrentProject          │
├──────────────────────────────────────────────┤
│ OldExperiment                       [🗑]     │  ← Other project (trash visible)
│ C:\Users\me\projects\OldExperiment           │
└──────────────────────────────────────────────┘
```

### Interaction
- Hovering over the trash icon changes its color to red
- Clicking the trash icon removes the entry; the dropdown stays open
- The list re-renders immediately without the removed entry

---

## Acceptance Criteria

- [ ] Trash icon appears next to each recent project entry in the dropdown
- [ ] Trash icon is **not shown** for the currently loaded project
- [ ] Clicking the trash icon removes the entry from the list immediately
- [ ] No confirmation dialog is shown
- [ ] Clicking the trash icon does **not** select/load the project
- [ ] Removal persists across app restarts (settings file updated)
- [ ] Removal does **not** modify or delete the project folder on disk
- [ ] If the removed project was also `last_used_project`, that field is cleared
- [ ] Dropdown stays open after removal
- [ ] App builds and runs successfully
- [ ] No console errors or warnings

---

## Files to Modify

### Backend
- `src/naide-desktop/src-tauri/src/settings.rs` — Add `remove_recent_project` function
- `src/naide-desktop/src-tauri/src/lib.rs` — Add Tauri command, register in invoke handler

### Frontend
- `src/naide-desktop/src/utils/globalSettings.ts` — Add `removeRecentProject` function
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Add trash icon UI and handler

---

## Testing Strategy

### Unit Tests (Rust)
- Remove a project that exists in the list → verify it's gone
- Remove a project that is also `last_used_project` → verify both fields cleared
- Remove a project not in the list → no error, list unchanged
- Case-insensitive removal on Windows

### Unit Tests (TypeScript)
- `removeRecentProject` calls invoke correctly
- Handles errors gracefully (non-fatal)

### Manual Testing
- [ ] Open dropdown, verify trash icons appear for non-current projects
- [ ] Verify no trash icon on the current project entry
- [ ] Click trash icon → entry removed immediately
- [ ] Dropdown stays open after removal
- [ ] Restart app → removed entry is still gone
- [ ] Project folder on disk is untouched after removal
- [ ] Remove all entries except current → dropdown shows only current project

---

## Related Features
- [2026-02-01-recent-projects-dropdown.md](./2026-02-01-recent-projects-dropdown.md) — Base recent projects feature
- [2026-02-01-last-used-project.md](./2026-02-01-last-used-project.md) — Last used project persistence

---

created by naide
