---
Status: planned
Area: infra, ui
Created: 2026-02-06
LastUpdated: 2026-02-06
---

# Feature: Project File Watcher for App Detection
**Status**: 🟡 PLANNED

## Summary
Add a file watcher that monitors the project folder when no runnable app has been detected (`appRunState.status === 'none'`). When key files appear (e.g., `package.json`, `*.csproj`), automatically re-run app detection and enable the Play button if a runnable app is found.

---

## Goals
- Automatically detect when a runnable app appears in the project without requiring manual refresh
- Keep the watcher lightweight and non-intrusive
- Only watch when necessary (status is `'none'`)
- Stop watching as soon as an app is detected or manually started

---

## Non-Goals
- Watching for file changes while the app is running (hot reload handles that)
- Watching for arbitrary file changes (only care about app-indicator files)
- Re-detecting after an app is stopped (user can click Play again; detection already ran)
- Watching deeper than 4 levels (covers typical project structures)
- File watcher UI or configuration (fully automatic)

---

## Problem Statement
When a user opens a project that doesn't yet contain a runnable app (e.g., an empty folder or a project being scaffolded by the AI in Building mode), the Play button stays disabled. If the AI creates a `package.json` or `.csproj` file during a Building session, the user must close and reopen the project (or refresh manually) to trigger app detection. This breaks the seamless workflow Naide aims to provide.

---

## Core Behavior

### When to Watch
- **Start watching**: When `appRunState.status` transitions to `'none'` AND `projectPath` is set
- **Stop watching**: When `appRunState.status` transitions to anything other than `'none'` (i.e., `'detecting'`, `'ready'`, `'starting'`, `'running'`, `'error'`)
- **Never watch**: While an app is running, starting, or in error state

### What to Watch For
Monitor for creation or modification of these files anywhere within project root + 4 levels deep:
- `package.json` (npm apps)
- `*.csproj` (dotnet apps)

### Watch Depth
- Project root directory
- Up to 4 levels of subdirectories
- Skip known non-project directories: `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide`

### Debounce
- **2-second debounce** after a matching file event before triggering re-detection
- If multiple events arrive within the debounce window, only one detection runs
- This prevents rapid re-detection during file scaffolding (e.g., AI writing multiple files)

### Detection Trigger
When a matching file event fires (after debounce):
1. Call the existing `detect_runnable_app` Tauri command
2. If app is detected → update `appRunState` to `'ready'` (Play button enables)
3. If no app detected → continue watching (file may have been created but incomplete)
4. Watcher automatically stops once status leaves `'none'`

---

## Technical Implementation

### Backend (Rust) — `notify` crate

The `notify` crate (v6.1) is already a dependency, and a `WatcherState` struct already exists in `lib.rs`. Use this infrastructure.

#### New Tauri Command: `start_project_watcher`

```rust
#[tauri::command]
async fn start_project_watcher(
    project_path: String,
    app_handle: tauri::AppHandle,
    watcher_state: tauri::State<'_, Mutex<WatcherState>>
) -> Result<(), String> {
    // 1. Stop any existing watcher
    // 2. Create a new notify watcher with 2-second debounce
    // 3. Watch project_path recursively (notify handles depth via RecursiveMode)
    // 4. Filter events: only react to Create/Modify on package.json or *.csproj
    // 5. On matching event, emit Tauri event: "app-file-detected"
    // 6. Store watcher in WatcherState
}
```

#### New Tauri Command: `stop_project_watcher`

```rust
#[tauri::command]
async fn stop_project_watcher(
    watcher_state: tauri::State<'_, Mutex<WatcherState>>
) -> Result<(), String> {
    // 1. Drop the watcher from WatcherState (stops watching)
    // 2. Log that watcher was stopped
}
```

#### Event Filtering Logic

```rust
fn is_app_indicator_file(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    file_name == "package.json" || extension == "csproj"
}

fn is_in_excluded_directory(path: &Path) -> bool {
    let excluded = ["node_modules", ".git", "bin", "obj", "dist", "build", "out", ".naide"];
    path.components().any(|c| {
        excluded.contains(&c.as_os_str().to_str().unwrap_or(""))
    })
}

fn is_within_depth(path: &Path, root: &Path, max_depth: usize) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    // Count path components; file itself is one, so directories = components - 1
    relative.components().count() <= max_depth + 1
}
```

#### Debounce Strategy

Use `notify`'s built-in debounced watcher **or** implement manual debounce:

**Option A — notify debouncer (preferred):**
```rust
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::time::Duration;

let (tx, rx) = std::sync::mpsc::channel();
let mut debouncer = new_debouncer(Duration::from_secs(2), tx)?;
debouncer.watcher().watch(Path::new(&project_path), RecursiveMode::Recursive)?;
```

**Option B — manual debounce:**
- Receive raw events from `notify`
- Track last event timestamp
- Only emit Tauri event if 2 seconds have elapsed since last matching event

If `notify-debouncer-mini` is not already a dependency, Option B (manual debounce with a simple `Instant` comparison) is fine to avoid adding a new crate.

#### Tauri Event Emission

When a matching file event passes debounce:
```rust
app_handle.emit("app-file-detected", payload)?;
```

Payload can be minimal:
```rust
#[derive(Serialize, Clone)]
struct AppFileDetectedPayload {
    path: String,
}
```

### Frontend (React)

#### State Management in `GenerateAppScreen.tsx`

**New useEffect — start/stop watcher based on appRunState:**

```typescript
useEffect(() => {
  if (appRunState.status === 'none' && state.projectPath) {
    // Start watching
    invoke('start_project_watcher', { projectPath: state.projectPath })
      .then(() => logInfo('[Watcher] Started project file watcher'))
      .catch((err) => logError('[Watcher] Failed to start watcher:', err));

    return () => {
      // Cleanup: stop watching
      invoke('stop_project_watcher')
        .catch((err) => logError('[Watcher] Failed to stop watcher:', err));
    };
  }
}, [appRunState.status, state.projectPath]);
```

**New useEffect — listen for detection event:**

```typescript
useEffect(() => {
  if (appRunState.status !== 'none') return;

  let unlisten: (() => void) | null = null;

  const setup = async () => {
    const { listen } = await import('@tauri-apps/api/event');
    unlisten = await listen('app-file-detected', async () => {
      logInfo('[Watcher] App indicator file detected, re-running detection');
      try {
        const result = await invoke<AppInfo | null>('detect_runnable_app', {
          projectPath: state.projectPath,
        });
        if (result) {
          setAppRunState({
            status: 'ready',
            type: result.app_type,
            projectFile: result.project_file,
            command: result.command,
          });
        }
      } catch (err) {
        logError('[Watcher] Detection after file event failed:', err);
      }
    });
  };

  setup();
  return () => { unlisten?.(); };
}, [appRunState.status, state.projectPath]);
```

#### Key Behavior Rules
- The watcher useEffect **only activates** when `status === 'none'`
- Cleanup function stops the watcher when status changes away from `'none'`
- Detection result updates state which triggers cleanup → watcher stops automatically
- If detection finds nothing, watcher stays active (continues monitoring)

---

## Lifecycle Diagram

```
Project opened
    │
    ▼
detect_runnable_app()
    │
    ├── App found → status: 'ready' → Play button enabled (no watcher needed)
    │
    └── No app found → status: 'none'
            │
            ▼
        Start file watcher
            │
            ├── package.json or *.csproj created/modified (debounced 2s)
            │       │
            │       ▼
            │   detect_runnable_app()
            │       │
            │       ├── App found → status: 'ready' → Stop watcher → Play enabled
            │       │
            │       └── Not yet valid → Continue watching
            │
            └── Project closed → Stop watcher (cleanup)
```

---

## Error Handling

### Watcher Creation Failures
- Log error, do not crash
- User can still manually re-detect by re-opening the project
- Show no UI error (watcher is a background enhancement)

### File System Permission Errors
- Some directories may be inaccessible (e.g., symlinks, restricted folders)
- `notify` crate handles this gracefully; log warnings but continue watching accessible paths

### Rapid File Events During Scaffolding
- 2-second debounce ensures only one detection per burst
- AI creating 20 files in Building mode → at most one detection after the burst settles

### Watcher Cleanup on Project Switch
- When `projectPath` changes, the useEffect cleanup stops the old watcher
- New watcher starts for new project (if status is `'none'`)

---

## Dependencies

### Existing (no new dependencies needed)
- `notify` v6.1 — already in `Cargo.toml`
- `WatcherState` struct — already in `lib.rs`
- `detect_runnable_app` command — already implemented
- Tauri event system — already used for `hot-reload-success`

### Potentially New
- `notify-debouncer-mini` — only if built-in debounce is preferred over manual implementation. **Recommendation**: use manual debounce to avoid adding a crate for a simple timer.

---

## Affected Files

### Backend
- `src/naide-desktop/src-tauri/src/lib.rs` — Add `start_project_watcher` and `stop_project_watcher` commands; register in invoke handler
- `src/naide-desktop/src-tauri/src/app_runner.rs` — Optionally: extract `is_app_indicator_file` helper if reusing detection patterns

### Frontend
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Add two useEffects for watcher lifecycle and event handling

---

## Constraints
- **Watch only when status is `'none'`** — never while app is running, starting, ready, or in error
- **Watch project root + 4 levels deep** — deeper files are unlikely to be project roots
- **2-second debounce** — prevent rapid re-detection during file scaffolding
- **Skip excluded directories** — `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide`
- **No UI changes** — this is invisible background behavior; Play button simply enables when appropriate

---

## Acceptance Criteria

- [ ] File watcher starts automatically when `appRunState.status` is `'none'` and project path is set
- [ ] File watcher stops when status transitions away from `'none'`
- [ ] Creating a `package.json` in the project root triggers app detection after ~2s debounce
- [ ] Creating a `*.csproj` in a subdirectory (within 4 levels) triggers app detection after ~2s debounce
- [ ] Play button enables automatically when a valid app is detected via the watcher
- [ ] Watcher ignores files in `node_modules`, `.git`, `bin`, `obj`, `dist`, `build`, `out`, `.naide`
- [ ] Watcher ignores files deeper than 4 levels from project root
- [ ] Watcher does NOT run while app is in `'ready'`, `'starting'`, `'running'`, or `'error'` state
- [ ] Watcher stops cleanly when switching projects
- [ ] Watcher stops cleanly when closing the app
- [ ] No console errors or performance degradation from the watcher
- [ ] Multiple rapid file creates (e.g., AI scaffolding) result in at most one detection attempt per 2-second window
- [ ] App builds and runs successfully (`tauri dev`)

---

## Testing Strategy

### Manual Testing
- [ ] Open empty project folder → verify watcher starts (check logs)
- [ ] Create `package.json` with a `dev` script → verify Play button enables within ~3s
- [ ] Create `MyApp.csproj` with Web SDK in subfolder → verify Play button enables
- [ ] Open project that already has `package.json` → verify watcher does NOT start (status is `'ready'`)
- [ ] Start and stop an app → verify watcher does NOT restart (status is `'ready'` or `'error'`)
- [ ] Switch projects → verify old watcher stops, new one starts if needed
- [ ] Create files in `node_modules/` → verify watcher ignores them
- [ ] Create `package.json` 5 levels deep → verify watcher ignores it

### Integration Testing
- [ ] Building mode: AI scaffolds a new React app → Play button enables automatically
- [ ] Building mode: AI scaffolds a new .NET app → Play button enables automatically

---

## Future Enhancements

### Watch for App Removal
- If `package.json` or `*.csproj` is deleted while status is `'ready'` (but app is not running), re-detect and potentially disable Play button
- Requires watching in `'ready'` state too — deferred for simplicity

### Watch Configuration Changes
- Monitor changes to `package.json` scripts section to update the detected run command
- Monitor `.csproj` changes to detect project type changes

### Configurable Watch Depth
- Allow users to configure max depth in project settings
- Default remains 4 levels

---

## Related Features
- [2026-02-04-support-running-apps.md](./2026-02-04-support-running-apps.md) — App detection and running
- [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) — AI creates project files that trigger detection

---

created by naide
