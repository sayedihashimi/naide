---
Status: planned
Area: ui, files
Created: 2026-02-08
LastUpdated: 2026-02-08
---

# Feature: Refresh Button & Auto-Refresh for Files Section
**Status**: 🟡 PLANNED

## Summary
Add a manual refresh button and automatic file watcher to the Files section (project file browser) in the left column. This mirrors the existing refresh behavior in the Features section. When refreshing, expanded folder states are preserved so users don't lose their navigation context.

---

## Goals
- Allow users to manually refresh the project file tree
- Automatically detect external file changes and refresh the tree
- Preserve expanded/collapsed folder states across refreshes
- Match the UX pattern already established by the Features section

---

## Non-Goals
- Real-time streaming of file changes (debounced refresh is sufficient)
- Watching for file content changes (only structure: created/deleted/renamed)
- Refreshing file content in open tabs (separate concern)
- Adding refresh to the tab bar or individual tabs

---

## Problem Statement
The Files section currently loads folder contents lazily on first expansion, but has no way to detect or show files that are added, deleted, or renamed after the initial load. When Copilot creates new files in Building mode, or the user modifies the project outside Naide, the file tree becomes stale. Users must collapse and re-expand folders (or switch projects) to see updates.

The Features section already solves this problem with a manual refresh button and a Tauri file watcher. The Files section should follow the same pattern.

---

## Core Behavior

### Manual Refresh Button

**Placement**: In the Files section header row, to the right of the "FILES" heading text and to the left of the expand/collapse chevron — same relative position as the refresh button in the Features section.

**Appearance**:
- Circular refresh icon (SVG, same as Features section)
- Spins while refresh is in progress (`animate-spin`)
- Disabled (dimmed, `cursor-not-allowed`) during loading
- Tooltip: "Refresh file list"

**Click behavior**:
1. Set a `loading` state to true (disables button, spins icon)
2. Re-fetch the root-level files from the backend (`list_project_files`)
3. For each currently expanded folder, re-fetch its contents
4. Update the file tree while **preserving expanded/collapsed folder states**
5. Set `loading` to false

### Preserving Expanded Folders

When refreshing:
- Read the current `expandedFolders` Set (already tracked in state)
- After fetching new root files, iterate through `expandedFolders` and re-fetch each expanded folder's contents
- Rebuild `loadedFolders` Map with fresh data
- Keep the same `expandedFolders` Set (don't collapse anything)
- If an expanded folder no longer exists (was deleted), silently remove it from `expandedFolders`

### Auto-Refresh via File Watcher

**Mechanism**: Use Tauri file watcher (same pattern as Features section) to watch the project root for structural changes.

**Implementation**:
1. On component mount (when Files section is rendered and project path is set), invoke a Tauri command to start watching the project directory
2. Listen for a Tauri event (e.g., `'project-files-changed'`) emitted when files are created, deleted, or renamed
3. Debounce incoming events (500ms) to batch rapid changes
4. On debounced event, trigger the same refresh logic as the manual button
5. Clean up watcher on component unmount or project path change

**Watch scope**:
- Watch the project root recursively
- Exclude: `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide` (same exclusions as the existing file tree)
- React to: file/folder creation, deletion, rename events
- Ignore: file content modification events (not relevant to tree structure)

**Reuse existing infrastructure**: If the Features section's file watcher command (`watch_feature_files`) can be generalized, reuse it. Otherwise, create a parallel `watch_project_files` command with the same pattern.

---

## Technical Implementation

### Frontend Changes

**File**: `src/naide-desktop/src/components/ProjectFilesViewer.tsx`

**New state**:
```typescript
const [loading, setLoading] = useState(false);
```

**New function — `handleRefresh`**:
```typescript
const handleRefresh = async () => {
  if (!projectPath || loading) return;
  setLoading(true);
  try {
    // Re-fetch root files
    const rootResult = await listProjectFiles(projectPath);
    setRootFiles(rootResult);

    // Re-fetch all currently expanded folders
    const newLoadedFolders = new Map<string, ProjectFileNode[]>();
    for (const folderPath of expandedFolders) {
      try {
        const children = await listProjectFiles(projectPath, folderPath);
        newLoadedFolders.set(folderPath, children);
      } catch {
        // Folder may have been deleted — remove from expanded set
        expandedFolders.delete(folderPath);
      }
    }
    setLoadedFolders(newLoadedFolders);
    // expandedFolders stays the same (minus any deleted folders)
  } catch (error) {
    console.error('[ProjectFilesViewer] Refresh failed:', error);
  } finally {
    setLoading(false);
  }
};
```

**New — file watcher setup** (useEffect):
```typescript
useEffect(() => {
  if (!projectPath) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let unlisten: (() => void) | null = null;

  const setup = async () => {
    try {
      await invoke('watch_project_files', { projectPath });
    } catch (err) {
      console.error('[ProjectFilesViewer] Failed to start watcher:', err);
      return;
    }

    const { listen } = await import('@tauri-apps/api/event');
    unlisten = await listen('project-files-changed', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleRefresh();
      }, 500);
    });
  };

  setup();

  return () => {
    unlisten?.();
    if (debounceTimer) clearTimeout(debounceTimer);
    invoke('stop_project_files_watcher').catch(() => {});
  };
}, [projectPath]);
```

**UI — refresh button** (in the header row, next to "FILES" heading):
```tsx
<button
  onClick={handleRefresh}
  disabled={loading}
  className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  title="Refresh file list"
>
  <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
</button>
```

### Backend Changes

**File**: `src/naide-desktop/src-tauri/src/lib.rs` (or a dedicated watcher module)

**New Tauri commands**:

1. `watch_project_files(project_path: String)` — Start a recursive file watcher on the project directory
   - Use the `notify` crate (already a dependency)
   - Filter events: only emit for Create, Remove, Rename (ignore Modify)
   - Exclude paths containing: `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide`
   - On matching event, emit Tauri event: `project-files-changed`
   - Store watcher in managed state (similar to existing `WatcherState`)

2. `stop_project_files_watcher()` — Stop the project files watcher
   - Drop the watcher from state
   - Called on cleanup / component unmount

**Alternatively**: If the existing `watch_feature_files` command and infrastructure can be generalized to accept a directory path and event name, reuse it instead of creating separate commands. The key difference is the watch path (project root vs `.prompts/features/`) and the emitted event name.

---

## UI/UX Details

### Button Position
Match the Features section pattern:
```
▼ FILES    [🔄]
  [Filter files...]
  ▶ 📁 .prompts
  ▶ 📁 src
  📄 package.json
```

The refresh button sits in the same header row as the "FILES" heading, between the heading text and the collapse chevron.

### Visual States
- **Idle**: Static refresh icon, `text-gray-400`
- **Hover**: `text-gray-200`, `bg-zinc-800`
- **Loading/Spinning**: Icon rotates via `animate-spin`, button disabled
- **Disabled**: `opacity-50`, `cursor-not-allowed`

### Loading During Auto-Refresh
- The refresh icon spins during auto-refresh just as it does for manual refresh
- No toast or notification — the visual spinner is sufficient feedback
- If the Files section is collapsed, the watcher still runs but refresh is deferred until expansion (optional optimization)

---

## Edge Cases

### Folder Deleted During Refresh
- If an expanded folder no longer exists when re-fetching, silently remove it from `expandedFolders`
- Don't show an error — the folder simply disappears from the tree

### Rapid External Changes
- 500ms debounce prevents excessive re-fetching during bulk operations (e.g., `npm install`, git checkout)
- Multiple events within the window trigger a single refresh

### Files Section Collapsed
- The watcher still runs even when the section is collapsed
- On next expansion, the data will be fresh from the last auto-refresh
- Alternative (optimization): pause the watcher when collapsed, refresh on expand — but this adds complexity for marginal benefit

### Project Switch
- Cleanup effect stops the old watcher
- New watcher starts for the new project path
- Expanded folders are already reset on project switch (existing behavior)

### No Project Open
- Watcher does not start if `projectPath` is null/undefined
- Refresh button is not shown (Files section is empty anyway)

---

## Acceptance Criteria

- [ ] Refresh button appears in the Files section header row (same position as Features section)
- [ ] Clicking refresh re-fetches root files and all expanded folder contents
- [ ] Expanded/collapsed folder states are preserved after refresh
- [ ] Refresh button shows spinning animation during loading
- [ ] Refresh button is disabled during loading
- [ ] File watcher automatically triggers refresh when files are created, deleted, or renamed
- [ ] File watcher events are debounced (500ms)
- [ ] Watcher excludes `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide`
- [ ] Watcher cleans up on component unmount or project switch
- [ ] Deleted folders are silently removed from expanded state
- [ ] No console errors during normal operation
- [ ] App builds and all existing tests pass

---

## Files to Create
- None (all changes in existing files)

## Files to Modify

### Frontend
- `src/naide-desktop/src/components/ProjectFilesViewer.tsx` — Add refresh button, loading state, refresh handler, file watcher setup/cleanup

### Backend
- `src/naide-desktop/src-tauri/src/lib.rs` — Add `watch_project_files` and `stop_project_files_watcher` commands (or generalize existing watcher infrastructure)

---

## Testing Strategy

### Manual Testing
- [ ] Click refresh → file tree updates, expanded folders stay expanded
- [ ] Create a new file externally → file appears in tree within ~1 second
- [ ] Delete a file externally → file disappears from tree within ~1 second
- [ ] Delete an expanded folder externally → folder disappears, no error
- [ ] Rapid file creation (e.g., `npm install`) → single refresh, no flooding
- [ ] Switch projects → watcher restarts for new project
- [ ] Collapse and expand Files section → data is fresh

### Unit Tests
- Refresh handler preserves expanded folders
- Deleted folder handling (removed from expanded set)

---

## Related Features
- [2026-02-06-left-column-redesign.md](./2026-02-06-left-column-redesign.md) — Files section implementation
- [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) — Features section with existing refresh button pattern

---

created by naide
