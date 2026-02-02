# Tech Setup — Tauri + React + Vite (Naide Desktop)

Follow these instructions to create the Naide prototype under **src/naide-desktop**.

## Folder layout (required)
Repository structure must be:

```
src/
  naide-desktop/
    (tauri + frontend project)
  copilot-sidecar/
    (node.js typescript sidecar)
```

The Vite frontend should live in `src/naide-desktop` and Tauri config in `src/naide-desktop/src-tauri`.
The Copilot sidecar lives in `src/copilot-sidecar` and is auto-started by Tauri.

## Create the Tauri + Vite project
Use the official Tauri + Vite template flow (current tooling varies). If you need to initialize manually:

- Create Vite React TS app in `src/naide-desktop`
- Add Tauri (`@tauri-apps/cli` and `@tauri-apps/api`)
- Initialize `src-tauri` with Tauri config

The app must build with:
- `tauri dev`
- `tauri build`

## TypeScript Best Practices (from PR #17)
When working with React components and external libraries:

1. **Interface Extensions**: Prefer extending React's built-in interfaces over using index signatures
   - ✅ Good: `interface CodeProps extends React.HTMLAttributes<HTMLElement> { inline?: boolean; }`
   - ❌ Avoid: `interface CodeProps { [key: string]: unknown; }`
   
2. **Type Compatibility**: Ensure custom component interfaces are compatible with library expectations
   - Example: `react-markdown` expects `JSX.IntrinsicElements[Key] & ExtraProps`
   - Extending `React.HTMLAttributes` provides full HTML attribute support while satisfying type constraints

3. **Avoid Redundancy**: Don't redeclare properties already provided by parent interfaces
   - `HTMLAttributes` already includes `className`, `children`, etc.

## Window defaults (required)
Configure the main window:
- default size: **1200x800**
- **resizable: true**
- title: **Naide**
- dark-only: do not implement light mode toggle

In Tauri, ensure window sizing is set in `tauri.conf.json` or equivalent.

## Tailwind CSS (required)
Install and configure Tailwind for the Vite React project.

Requirements:
- Dark mode only (do not use `dark:` toggles; the entire app is dark by default)
- Use a consistent design system:
  - page background: very dark
  - panels/surfaces: slightly lighter
  - borders: subtle
  - typography: high contrast but not pure white

## Fonts (required; must be bundled)
Bundle and use:
- **Inter** (UI font)
- **JetBrains Mono** (monospace blocks)

Implementation guidance:
1. Add font files under:
   - `src/naide-desktop/src/assets/fonts/Inter/`
   - `src/naide-desktop/src/assets/fonts/JetBrainsMono/`
2. Add `@font-face` declarations in a global CSS file (e.g., `src/styles/fonts.css`)
3. Set Tailwind theme font families:
   - `font-sans` → Inter
   - `font-mono` → JetBrains Mono

NOTE: Include the font files in the repo. Use regular + medium weights at minimum.

## Routing (required)
Use a simple client-side router:
- `/` → Screen 1 (Intent Capture)
- `/planning` → Planning Mode

Keep routing minimal. React Router is acceptable; if you use it, keep to v6+.

## State management (required)
Use lightweight in-memory state:
- React context or a small store (no heavy frameworks)
- Data to pass:
  - `initialIntentText` from Screen 1 to Planning Mode
  - `planDirty` boolean for Planning Mode footer state

Persisting to localStorage is optional but not required.

## Accessibility and UX requirements
- Modal must trap focus and be dismissible with Escape.
- Buttons must have visible focus states.
- Ensure keyboard navigation works.

## CI/CD Setup (Implemented in PR #5)
GitHub Actions workflow configured for continuous integration:

### Build Matrix
- Platforms: `ubuntu-latest`, `windows-latest`, `macos-latest`
- Node.js: Version 18.x
- Rust: Stable toolchain

### Build Steps
1. Install Node.js and Rust dependencies
2. Install system dependencies (Linux: webkit2gtk, libayatana-appindicator3)
3. Run linter: `npm run lint`
4. Run tests: `npm run testonly`
5. Build TypeScript and frontend: `npm run build`
6. Build Tauri application: `npm run tauri build`

### Configuration
- Workflow triggers: push and pull_request on all branches
- TypeScript config: Excludes `*.test.tsx` and `*.test.ts` files from build
- ESLint config: Excludes test files from linting
- Tauri bundle identifier: `com.naide.desktop` (changed from default `com.tauri.dev`)

## Build verification
Finally, verify:
- `npm run tauri:dev` launches the app
- App shows the Generate App screen (single route: `/`)
- `npm test` runs Vitest tests successfully
- `npm run lint` runs ESLint without critical errors
- Multi-platform builds work (ubuntu, windows, macos) via GitHub Actions

## Tauri 2.x File System Permissions (Implemented 2026-02-02)

### Overview
Tauri 2.x has a strict security model that blocks file system access by default. For Naide to access user-selected project directories and create `.naide` folders, specific permissions are required.

### Required Capabilities Configuration

**File**: `src-tauri/capabilities/default.json`

```json
{
  "permissions": [
    "core:default",
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "**" }
      ]
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

### Key Insights

1. **fs:scope Requires Path Patterns**: Simply including `"fs:scope"` permission doesn't grant access to any paths. You must explicitly define which paths are allowed using `allow` or `deny` arrays.

2. **Wildcard Pattern for Dev Tools**: Using `{ "path": "**" }` allows access to any path on the system. This is appropriate for:
   - Development tools that need broad file access
   - Apps where users explicitly select directories via dialog
   - Similar to VSCode, IntelliJ, and other IDEs

3. **Alternative Approach**: If you need more restrictive permissions:
   ```json
   {
     "identifier": "fs:scope",
     "allow": [
       { "path": "$DOCUMENT/**" },
       { "path": "$HOME/projects/**" },
       { "path": "C:\\Users\\*\\Documents\\**" }  // Windows
     ]
   }
   ```

4. **Dialog Integration**: The `dialog:default` permission allows users to select directories, but `fs:scope` determines which selected directories are actually accessible.

### Common Permission Errors

**Error Message:**
```
forbidden path: C:\path\to\project\.naide\file.json, 
maybe it is not allowed on the scope for `allow-exists` permission in your capability file
```

**Solutions:**
- Add the path pattern to `fs:scope` allow list
- Use wildcard `**` for broad access
- Ensure operation-specific permissions are included (`allow-exists`, `allow-read-text-file`, etc.)

### Security Considerations

**Why Wildcard is Acceptable:**
- User explicitly selects directories via file dialog
- Desktop development tools require broad file access
- Tauri still provides process isolation and sandboxing
- Alternative would be to prompt user for every directory (poor UX)

**What Wildcard Grants:**
- Access to any path the app attempts to read/write
- Still requires user interaction to select directories
- Does not grant network access or other system capabilities
- Only grants file system operations allowed by specific permissions

## Frontend Logging in Tauri (Implemented 2026-02-02)

### Overview
Frontend JavaScript `console.log` statements only appear in browser DevTools, not in Tauri's backend log file. For production debugging, we need to forward frontend logs to the backend.

### Implementation Pattern

**Backend Command** (`src-tauri/src/lib.rs`):
```rust
#[tauri::command]
async fn log_to_file(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "info" => log::info!("{}", message),
        "error" => log::error!("{}", message),
        "warn" => log::warn!("{}", message),
        "debug" => log::debug!("{}", message),
        _ => log::info!("{}", message),
    }
    Ok(())
}
```

Register in invoke_handler:
```rust
.invoke_handler(tauri::generate_handler![
    // ... other commands
    log_to_file
])
```

**Frontend Utility** (`src/utils/logger.ts`):
```typescript
import { invoke } from '@tauri-apps/api/core';

export function logInfo(message: string, ...args: unknown[]): void {
  const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
  console.log(message, ...args);  // DevTools
  invoke('log_to_file', { level: 'info', message: fullMessage });  // Log file
}
```

### Key Insights

1. **TargetKind::Webview Limitation**: The `TargetKind::Webview` log target in Rust captures `console.log` output from the WebView, but these logs may not be formatted or timed properly. Using commands provides better control.

2. **Plugin API vs Commands**: 
   - `@tauri-apps/plugin-log` API functions (`info()`, `error()`) are async and can fail silently
   - Tauri commands (`invoke('log_to_file')`) provide better error handling
   - Commands are more reliable for critical logging

3. **Test Environment Handling**: The logger must gracefully handle test environments where Tauri is unavailable:
   ```typescript
   function safeInvoke(level: string, message: string): void {
     try {
       if (typeof invoke !== 'undefined') {
         invoke('log_to_file', { level, message });
       }
     } catch (e) {
       // Silently fail in test environment
     }
   }
   ```

4. **Dual Output**: Always log to both console and file:
   - Console for DevTools during development
   - File for production debugging and user support

### Usage Pattern

Replace all `console.log/error` with logger functions:
```typescript
// Before
console.log('[Component] Doing something:', value);
console.error('[Component] Error:', error);

// After
import { logInfo, logError } from '../utils/logger';

logInfo('[Component] Doing something:', value);
logError('[Component] Error:', error);
```

### Log File Location
- Windows: `%TEMP%\com.naide.desktop\logs\naide-{timestamp}.log`
- macOS: `/tmp/com.naide.desktop/logs/naide-{timestamp}.log`
- Linux: `/tmp/com.naide.desktop/logs/naide-{timestamp}.log`

### Backend Logging Configuration

**File**: `src-tauri/src/lib.rs` setup function

```rust
// Create log directory
let temp_dir = env::temp_dir();
let log_dir = temp_dir.join("com.naide.desktop").join("logs");
fs::create_dir_all(&log_dir)?;

// Configure log targets
app.handle().plugin(
  tauri_plugin_log::Builder::default()
    .level(log::LevelFilter::Info)
    .targets([
      tauri_plugin_log::Target::new(
        tauri_plugin_log::TargetKind::Folder {
          path: log_dir,
          file_name: Some(log_filename),
        }
      ),
      tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
      tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
    ])
    .build(),
)?;
```

**Targets Explained:**
- `Folder`: Writes logs to timestamped file in temp directory
- `Stdout`: Prints logs to console during development
- `Webview`: Captures frontend console.log (supplementary to command-based logging)

