---
Status: implemented
Area: ui, infra
Created: 2026-02-06
LastUpdated: 2026-02-06
---

# Feature: App Selector Dropdown in Running App Panel
**Status**: ✅ IMPLEMENTED

## Summary
When the project folder contains more than one runnable app (npm or .NET), display a dropdown selector in the "Running App" panel header so users can choose which app to run. The selected app is persisted in `.naide/project-config.json` and restored on next project load. The dropdown is only interactive when no app is running.

---

## Goals
- Allow users to choose which app to run when multiple are detected
- Show a combined list of all runnable apps (npm and .NET together)
- Persist the user's selection per project
- Keep the UI minimal and non-intrusive

---

## Non-Goals
- Running multiple apps simultaneously (future enhancement)
- Drag-and-drop reordering of apps (not needed)
- App grouping by type (show flat combined list)
- Custom run commands or overrides (future enhancement)
- Showing the dropdown while an app is running

---

## Problem Statement
Currently, `detect_runnable_app` returns only the **first** runnable app it finds (npm preferred over .NET). Projects with multiple runnable apps (e.g., a React frontend + .NET API, or multiple microservices) have no way to select which app to launch. Users are stuck with whatever the detection logic picks first.

---

## Current Behavior

**Backend** (`app_runner.rs`):
- `detect_runnable_app()` calls `detect_npm_app()` first, then `detect_dotnet_app()`
- Returns the **first match only** as a single `AppInfo`
- `AppInfo` struct: `{ app_type, project_file, command, display_name }`

**Frontend** (`GenerateAppScreen.tsx`):
- Stores a single `appRunState` with one detected app
- Displays the app's relative path or project file name as static text in the Running App panel header
- No ability to switch between apps

---

## Core Behavior

### Detection: Return All Apps

**Change `detect_runnable_app`** (or add a new command `detect_all_runnable_apps`):
- Call both `detect_npm_app()` and `detect_dotnet_app()`
- Collect ALL matches into a `Vec<AppInfo>` instead of returning the first one
- Return the combined list sorted by:
  1. npm apps first (since they're more common for web dev)
  2. Then .NET apps
  3. Within each type, sorted by path depth (shallower first)

**Example return for a monorepo:**
```json
[
  { "app_type": "npm", "project_file": "frontend", "command": "npm run dev", "display_name": "frontend (npm run dev)" },
  { "app_type": "npm", "project_file": "admin-panel", "command": "npm run dev", "display_name": "admin-panel (npm run dev)" },
  { "app_type": "dotnet", "project_file": "src/Api/Api.csproj", "command": "dotnet watch", "display_name": "Api.csproj (dotnet watch)" }
]
```

### UI: Single App (No Change)

When only **one** app is detected:
- Show the app info as **static text** (current behavior)
- No dropdown indicator, no interactivity
- Identical to how it works today

### UI: Multiple Apps (New Dropdown)

When **two or more** apps are detected:
- The app info text in the header becomes **clickable**
- On click, a dropdown appears below showing all detected apps
- Each item shows: display name (relative path + command hint)
- Clicking an item selects that app and closes the dropdown
- The selected app replaces the current `appRunState` ready state

### UI: App Running (Dropdown Hidden)

When `appRunState.status` is `'starting'` or `'running'`:
- **Do NOT show the dropdown**
- The app info text is shown as **static text** (not clickable)
- User must stop the running app before switching
- This prevents confusing state changes while an app is active

### Dropdown Visibility Rules

| State | Text Display | Clickable? | Dropdown Available? |
|-------|-------------|------------|-------------------|
| `none` | "No app detected" | No | No |
| `ready` (1 app) | App info | No | No |
| `ready` (2+ apps) | Selected app info | Yes | Yes |
| `starting` | App info | No | No |
| `running` | App info | No | No |
| `error` (2+ apps) | App info | Yes | Yes |

---

## Persistence

### Storage Location
`.naide/project-config.json` (existing file, already used for project settings)

### Schema Addition
Add a `selectedApp` field to the existing config:
```json
{
  "projectName": "my-project",
  "selectedApp": {
    "app_type": "npm",
    "project_file": "frontend",
    "command": "npm run dev"
  }
}
```

### Persistence Logic
1. **On app selection**: Write the selected `AppInfo` to `project-config.json`
2. **On project load**: Read `project-config.json`, check if `selectedApp` matches one of the detected apps
3. **If match found**: Pre-select that app as the active one
4. **If no match** (app was removed or renamed): Fall back to first detected app, clear stale config

### Reading/Writing
- Use existing Tauri file system utilities for reading/writing `.naide/project-config.json`
- The frontend should handle persistence (read on mount, write on selection change)
- Non-fatal: if config read/write fails, fall back to first app silently

---

## Technical Implementation

### Backend Changes

**File**: `src/naide-desktop/src-tauri/src/app_runner.rs`

**New function**: `detect_all_runnable_apps(project_path: &str) -> Vec<AppInfo>`
- Calls `detect_npm_app()` and `detect_dotnet_app()`
- Wraps each result in a Vec (both currently return `Option<AppInfo>`)
- To find ALL npm apps (not just first): modify `detect_npm_app` to return `Vec<AppInfo>` or add `detect_all_npm_apps`
- To find ALL .NET apps: modify `detect_dotnet_app` similarly
- Concatenate results and return

**File**: `src/naide-desktop/src-tauri/src/lib.rs`

**New Tauri command**: `detect_all_runnable_apps`
```rust
#[tauri::command]
async fn detect_all_runnable_apps(project_path: String) -> Result<Vec<AppInfo>, String> {
    app_runner::detect_all_runnable_apps(&project_path)
}
```

**Keep existing**: `detect_runnable_app` can remain for backward compatibility or be updated to use the new function internally (return first result).

### Frontend Changes

**File**: `src/naide-desktop/src/pages/GenerateAppScreen.tsx`

**New state**:
```typescript
const [detectedApps, setDetectedApps] = useState<AppInfo[]>([]);
const [showAppSelector, setShowAppSelector] = useState(false);
```

**Updated detection logic** (in existing `useEffect` or `detectApp` function):
```typescript
// Replace: invoke('detect_runnable_app', ...)
// With:    invoke('detect_all_runnable_apps', ...)
const apps: AppInfo[] = await invoke('detect_all_runnable_apps', { projectPath });
setDetectedApps(apps);

if (apps.length > 0) {
  // Check project-config.json for saved selection
  const savedApp = await loadSelectedApp(projectPath);
  const selectedApp = savedApp && apps.find(a => a.project_file === savedApp.project_file && a.app_type === savedApp.app_type)
    ? savedApp
    : apps[0];
  
  setAppRunState({
    status: 'ready',
    type: selectedApp.app_type,
    projectFile: selectedApp.project_file,
    command: selectedApp.command,
  });
}
```

**Dropdown component** (inline in GenerateAppScreen or extracted):
```tsx
{/* App selector - only when multiple apps and not running */}
{detectedApps.length > 1 && (appRunState.status === 'ready' || appRunState.status === 'error') && (
  <div className="relative">
    <button 
      onClick={() => setShowAppSelector(!showAppSelector)}
      className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer"
    >
      {appRunState.projectFile} ▾
    </button>
    {showAppSelector && (
      <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-20 min-w-[250px]">
        {detectedApps.map((app, i) => (
          <button
            key={i}
            onClick={() => handleSelectApp(app)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${
              app.project_file === appRunState.projectFile ? 'text-blue-400' : 'text-zinc-300'
            }`}
          >
            <div>{app.display_name || app.project_file}</div>
            <div className="text-xs text-zinc-500">{app.app_type} • {app.command}</div>
          </button>
        ))}
      </div>
    )}
  </div>
)}

{/* Static text - single app or app is running */}
{(detectedApps.length <= 1 || appRunState.status === 'starting' || appRunState.status === 'running') && appRunState.projectFile && (
  <span className="text-sm text-zinc-400">{appRunState.projectFile}</span>
)}
```

**Selection handler**:
```typescript
const handleSelectApp = async (app: AppInfo) => {
  setAppRunState({
    status: 'ready',
    type: app.app_type,
    projectFile: app.project_file,
    command: app.command,
  });
  setShowAppSelector(false);
  
  // Persist selection
  await saveSelectedApp(state.projectPath, app);
};
```

**Click-outside handler** (reuse existing pattern from recent projects dropdown):
- Close dropdown when clicking outside
- Close on ESC key

---

## UI/UX Details

### Dropdown Styling
- Background: zinc-800
- Border: zinc-700, rounded
- Shadow: subtle drop shadow
- Items: full-width, left-aligned
- Hover: zinc-700 background
- Selected item: blue-400 text
- Item layout:
  - Line 1: Display name (e.g., `frontend (npm run dev)`)
  - Line 2: Type and command hint in smaller text (e.g., `npm • npm run dev`)

### Text Display
- When clickable (multiple apps, not running): subtle hover effect, small dropdown arrow `▾`
- When static (single app or running): plain text, no interactivity indicators

### Position
- Dropdown opens below the app info text in the Running App panel header
- Aligned to the left edge of the text
- Z-index above panel content

---

## Edge Cases

### Saved App No Longer Exists
- User saved "frontend" but the folder was deleted
- On next load, `project-config.json` references a missing app
- **Behavior**: Fall back to first detected app, update config

### App List Changes Between Sessions
- New apps added or removed between sessions
- **Behavior**: Re-detect all apps on project load, match saved selection by `project_file` + `app_type`

### Zero Apps Detected
- **Behavior**: No dropdown, show "No app detected" (existing behavior)
- File watcher (if implemented) continues monitoring

### Config File Missing or Corrupt
- **Behavior**: Fall back to first detected app, no error shown
- Create/overwrite config on next selection

---

## Error Handling

### Detection Errors
- If `detect_all_runnable_apps` fails, fall back to current `detect_runnable_app` behavior
- Log warning, don't show error to user

### Persistence Errors
- If reading/writing `project-config.json` fails, continue without persistence
- Log warning, app still works (just won't remember selection)

---

## Acceptance Criteria

- [ ] Backend returns all detected apps (npm + .NET combined) instead of just the first one
- [ ] When only one app detected, UI shows static text (no dropdown) — unchanged from current
- [ ] When multiple apps detected and app is NOT running, clicking the app text opens a dropdown
- [ ] Dropdown shows all detected apps with display name and type/command info
- [ ] Clicking a dropdown item selects that app and closes the dropdown
- [ ] Selected app is persisted to `.naide/project-config.json`
- [ ] On project reload, previously selected app is pre-selected (if still detected)
- [ ] When app is running or starting, the text is static (no dropdown available)
- [ ] Dropdown closes when clicking outside or pressing ESC
- [ ] Currently selected app is visually highlighted in the dropdown
- [ ] Stale saved selection gracefully falls back to first detected app
- [ ] No console errors or warnings
- [ ] App builds and runs successfully

---

## Files to Modify

### Backend
- `src/naide-desktop/src-tauri/src/app_runner.rs` — Add `detect_all_runnable_apps` (and modify internal functions to return multiple results)
- `src/naide-desktop/src-tauri/src/lib.rs` — Register new Tauri command

### Frontend
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Add dropdown UI, state, selection handler, persistence

---

## Future Enhancements

- Run multiple apps simultaneously (split right panel or tabbed view)
- Custom run command overrides per app
- App-specific environment variables
- Grouping by type (npm section, .NET section) for very large projects
- App health indicators in the dropdown (port status, etc.)

---

## Related Features
- [2026-02-04-support-running-apps.md](./2026-02-04-support-running-apps.md) — Core app detection and running
- [2026-02-04-resizable-running-app-column.md](./2026-02-04-resizable-running-app-column.md) — Right panel layout
- [2026-02-06-project-file-watcher.md](./2026-02-06-project-file-watcher.md) — File watcher for new app detection

---

created by naide
