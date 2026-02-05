---
Status: implemented
Area: ui, build, infra
Created: 2026-02-04
LastUpdated: 2026-02-05
---

# Feature: Support Running npm and .NET Apps
**Status**: ✅ IMPLEMENTED (npm and .NET)

## Implementation Summary

The running apps feature has been fully implemented for both npm and .NET apps with proxy-based navigation tracking.

**Key Features Implemented:**
- **npm app detection and running** ✅ ADDED (2026-02-04)
  - Detects package.json and parses scripts
  - Priority order: dev → start → serve → preview
  - Runs `npm run {script}` with URL detection
  - Supports Vite, CRA, and other npm dev servers
- Automatic detection of .NET web projects (ASP.NET, Blazor)
- Play/Stop button with visual states (ready, starting, running, error)
- Refresh button to reload the iframe when app is running
- Uses `dotnet watch --non-interactive` for hot reload support
- **Environment variables set**:
  - `DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1` - Prevents automatic browser opening
  - `HotReloadAutoRestart=true` - Enables automatic restart on hot reload
- **Automatic browser refresh on hot reload**: Backend detects "Hot reload succeeded" messages and emits event to frontend to refresh iframe
- **Proxy server with script injection**: Solves CORS and enables navigation tracking
  - Lightweight proxy on `localhost:3002` proxies the running app
  - Injects tracking script into HTML responses
  - Script sends postMessage on navigation (page loads, popstate, history changes)
  - Frontend tracks current URL and preserves it on hot reload
- URL detection from stdout with 30-second timeout
- Running app displayed in iframe in right panel (via proxy)
- **Process tree termination** ✅ FIXED (2026-02-05) - Uses `taskkill /T /F` on Windows to kill entire process tree (npm + node + children)
- Process management with automatic cleanup on app close
- Status indicators for all app states

**Files Implemented:**
- `src/naide-desktop/src-tauri/src/app_runner.rs` - App detection and process management (npm + .NET)
- `src/naide-desktop/src-tauri/src/lib.rs` - Tauri commands and state management
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - UI, proxy integration, and navigation tracking
- `src/copilot-sidecar/src/proxy.ts` - Proxy server with script injection
- `src/copilot-sidecar/src/index.ts` - Proxy lifecycle management and API endpoints

**Backend (Rust):**
- `detect_runnable_app` command - Scans for package.json first, then .csproj files
- `detect_npm_app` function - **NEW** (2026-02-04)
- `start_npm_app` function - **NEW** (2026-02-04)
- `start_app` command - Spawns `npm run {script}` or `dotnet watch --non-interactive`
- `stop_app` command - Kills entire process tree using `taskkill /T /F` on Windows ✅ FIXED (2026-02-05)
- `kill_process_tree(pid)` function - **NEW** (2026-02-05) - Platform-specific process tree termination
- `is_process_running(pid)` function - **NEW** (2026-02-05) - Verifies process termination
- URL extraction from stdout using regex
- Process state tracking

**Backend (Node.js Sidecar):**
- `POST /api/proxy/start` - Starts proxy server for a target URL
- `POST /api/proxy/stop` - Stops running proxy server
- `GET /api/proxy/status` - Returns proxy status
- Proxy forwards all requests to target app
- Intercepts HTML responses and injects tracking script
- Proxies WebSocket connections for hot reload
- Automatic cleanup on sidecar shutdown

**Frontend (React):**
- App run state management (none, detecting, ready, starting, running, error)
- Play button (green) when app detected → starts app AND proxy
- Refresh button (blue) refreshes tracked URL (not base URL)
- Stop button (red) → stops app AND proxy
- **Navigation tracking**: postMessage listener receives URL updates from injected script
- **Current URL state**: Tracks user's navigation within the app
- **Hot reload**: Refreshes the tracked URL (preserves page position)
- Iframe displays proxied app when URL detected
- Error state with retry option

**Simplified MVP Approach:**
- Automatically uses first web project found (no picker dialog)
- Future enhancement: Multi-project selection with "remember choice"

**Bug Fixes:**
- Fixed URL detection timeout issue where stdout reader thread wasn't communicating with main thread properly
- **Fixed EPIPE crash on hot reload** (2026-02-05) - See [bug report](./bugs/2026-02-05-npm-app-epipe-on-hot-reload.md)
  - Root cause: stdout reader thread was exiting after URL detection, closing the pipe
  - When Vite tried to write HMR messages to stdout, it crashed with `EPIPE: broken pipe`
  - Fix: Keep reading stdout indefinitely to keep the pipe open
- Changed `start_dotnet_app` to return the URL receiver channel instead of a stop signal channel
- **Fixed npm app detection** - See `.prompts/features/bugs/2026-02-04-npm-app-detection-not-implemented.md`
- **Fixed proxy URL escaping error** - See `.prompts/features/bugs/2026-02-04-proxy-url-escaping-error.md` (trailing slashes in URLs)
- **Fixed Stop button not killing all processes** (2026-02-05) - See [bug report](./bugs/2026-02-05-npm-app-stop-not-killing-processes.md)
  - Root cause: `process.kill()` only killed parent npm process, leaving node/Vite children orphaned
  - Fix: Use `taskkill /T /F /PID` on Windows to kill entire process tree

**Navigation Tracking Solution:**
- Proxy runs on `localhost:3002` and proxies the running app (e.g., `localhost:5103`)
- Both Naide (`localhost:5173`) and proxy (`localhost:3002`) are now same-origin-capable via postMessage
- Injected script tracks:
  - Initial page load
  - `popstate` events (browser back/forward)
  - `history.pushState` and `history.replaceState` (SPA navigation)
- Frontend stores current URL in state
- On hot reload or manual refresh, the tracked URL is preserved

**Proxy Dependencies:**
- `http-proxy-middleware@^3.0.0` - Proxy middleware for Express
- `express` - HTTP server (already present)

**To Complete Installation:**
```bash
cd src/copilot-sidecar
npm install http-proxy-middleware
npm run build
```


---

## Summary
Add "Play" button to launch and preview web apps in the "Running App" panel. Support two app types: npm apps (package.json) and .NET apps (web projects). Automatically detect project type, discover runnable commands/projects, and display the running app in an iframe.

---

## Goals
- Enable users to run their apps with one click
- Support npm-based web apps (React, Vue, vanilla, etc.)
- Support .NET web apps (ASP.NET, Blazor, etc.)
- Display running apps in the existing "Running App" panel
- Remember user's project selection for multi-project .NET solutions
- Provide clear status indicators (starting, running, stopped, error)

---

## Non-Goals
- Supporting other app types (desktop apps, mobile apps, Python, etc.) - future enhancement
- Hot reload integration beyond what dev servers provide
- Debugging tools (future enhancement)
- Multi-app simultaneous running (future enhancement)
- App deployment (out of scope)

---

## Problem Statement
Currently, the "Running App" panel in Naide is a placeholder. Users have no way to actually run the apps they're building with AI assistance. They must:
- Switch to a terminal outside Naide
- Remember the correct run command
- Manually navigate to the localhost URL
- Switch between Naide and browser to see results

By integrating app launching directly into Naide, users get immediate visual feedback and a seamless workflow.

---

## Core Behavior

### Project Type Detection

**On project load** (or when "Play" button area is rendered):
1. Scan project root for indicators:
   - `package.json` → npm app
   - `*.csproj` or `*.sln` → .NET app
2. If both exist, prefer npm (web apps are more common in npm)
3. Store detected type in project config

### Play Button States

**States:**
- **Disabled**: No runnable app detected (gray, tooltip: "No runnable app found")
- **Ready**: App detected, not running (green play icon, tooltip: "Run app")
- **Starting**: App is launching (spinner icon, tooltip: "Starting...")
- **Running**: App is running (stop icon, tooltip: "Stop app")
- **Error**: App failed to start (red X, tooltip: "Failed to start")

### npm Apps

**Detection:**
1. Check if `package.json` exists
2. Parse `scripts` section
3. Look for common run scripts (in priority order):
   - `dev`
   - `start`
   - `serve`
   - `preview`
4. If multiple found, prefer `dev` > `start` > others
5. Store selected script in project config

**Running:**
1. User clicks Play
2. Execute: `npm run {selected-script}`
3. Capture stdout/stderr
4. Detect dev server URL from output (e.g., "Local: http://localhost:5173")
5. Load URL in iframe in "Running App" panel
6. Show status: "Running on http://localhost:5173"

**Stopping:**
1. User clicks Stop
2. Kill the npm process (and child processes)
3. Clear iframe
4. Show status: "Stopped"

### .NET Apps

**Detection:**
1. Check for `*.csproj` or `*.sln` files
2. Parse project files to find web projects:
   - Look for `<OutputType>Exe</OutputType>` or Web SDK
   - Check for `Microsoft.NET.Sdk.Web` or `Microsoft.AspNetCore.App`
3. **Simplified approach for MVP**: Use the first web project found
   - Future enhancement: Allow user to select from multiple projects

**Running:**
1. User clicks Play
2. Execute: `dotnet watch --non-interactive --project {first-web-project-path}`
   - Environment variables set:
     - `DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1` - Prevents automatic browser opening
     - `HotReloadAutoRestart=true` - Enables automatic restart on hot reload
3. Capture stdout/stderr
4. Detect app URL from output (e.g., "Now listening on: http://localhost:5000")
5. Load URL in iframe in "Running App" panel
6. Show status: "Running on http://localhost:5000"
7. **Hot Reload Detection**: Backend monitors stderr for "Hot reload succeeded" messages
8. **Automatic Refresh**: When hot reload succeeds, backend emits `hot-reload-success` event to frontend, triggering iframe refresh

**Why `dotnet watch --non-interactive`:**
- Enables hot reload (auto-restart on file changes)
- `--non-interactive` prevents prompts that would block execution
- Provides better development experience matching npm's dev servers
- `DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1` prevents dotnet from opening default browser
- `HotReloadAutoRestart=true` enables automatic hot reload without user confirmation

**Hot Reload Workflow:**
1. Developer makes code changes
2. `dotnet watch` detects changes and applies hot reload
3. Backend detects "Hot reload succeeded" in stderr output
4. Backend emits `hot-reload-success` Tauri event
5. Frontend receives event and refreshes iframe with cache-busting parameter
6. User sees updated app without manual refresh

**Cache-Busting for Refresh:**
- Both manual refresh and hot reload use cache-busting to ensure fresh content
- Appends `?_refresh={timestamp}` to the URL to bypass browser cache
- **Preserves user's current page**: Uses `iframe.contentWindow.location.href` to get the current URL before refresh
- Falls back to base URL if CORS prevents accessing contentWindow
- Ensures users see the latest changes immediately while staying on their current page

**Stopping:**
1. User clicks Stop
2. Kill the dotnet process
3. Clear iframe
4. Show status: "Stopped"

**Multi-Project Handling:**
- **MVP**: Automatically use first web project found
- **Future enhancement**: Project picker dialog with "remember choice"

---

## UI Changes

### Play Button Location
- **Position**: Top-right of "Running App" panel header
- **Layout**: `[Running App ———————— [Play/Stop button]]`

### Button Appearance

**Ready state (green):**
- Icon: Play triangle (▶) from Lucide `Play` icon
- Color: Green (green-500)
- Size: 32px clickable area, 20px icon
- Hover: Lighter green (green-400)

**Running state:**
- **Stop button**: Stop square (⏹) from Lucide `Square` icon, red (red-500), hover: red-400
- **Refresh button**: Refresh icon from Lucide `RefreshCw` icon, blue (blue-500), hover: blue-400
- Size: 32px clickable area, 20px icon each
- Positioned side-by-side (Refresh, then Stop)

**Starting state:**
- Icon: Spinner from Lucide `Loader2` icon (animated)
- Color: Blue (blue-500)
- Disabled (not clickable)

**Disabled state:**
- Icon: Play triangle (grayed out)
- Color: zinc-600
- Tooltip explains why disabled

**Error state:**
- Icon: X from Lucide `XCircle` icon
- Color: Red (red-500)
- Clickable to retry

### Running App Panel Content

**When not running:**
```
┌────────────────────────────────────────┐
│ Running App                    [▶ Play]│
├────────────────────────────────────────┤
│                                        │
│   Your app will appear here once       │
│   you click Play.                      │
│                                        │
│   Detected: npm app (npm run dev)     │
│                                        │
└────────────────────────────────────────┘
```

**When running:**
```
┌────────────────────────────────────────┐
│ Running App           [🔄 Refresh][⏹ Stop]│
├────────────────────────────────────────┤
│ Status: Running on http://localhost:5173│
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │      [iframe with app]             │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**When starting:**
```
┌────────────────────────────────────────┐
│ Running App               [⟳ Starting...]│
├────────────────────────────────────────┤
│                                        │
│   Starting app...                      │
│   This may take a few moments.         │
│                                        │
└────────────────────────────────────────┘
```

**When error:**
```
┌────────────────────────────────────────┐
│ Running App                   [✕ Retry]│
├────────────────────────────────────────┤
│                                        │
│   ❌ Failed to start app              │
│                                        │
│   Error: Command 'npm run dev' failed │
│   Exit code: 1                         │
│                                        │
│   [View logs]                          │
│                                        │
└────────────────────────────────────────┘
```

### Project Picker Dialog (for .NET)

When multiple .NET web projects are detected:

```
┌─────────────────────────────────────────┐
│ Select Project to Run                   │
├─────────────────────────────────────────┤
│ Multiple web projects found:            │
│                                         │
│ ○ MyApp.Web (src/MyApp.Web/MyApp.Web.csproj) │
│ ● MyApp.Api (src/MyApp.Api/MyApp.Api.csproj) │
│ ○ MyApp.Admin (src/MyApp.Admin/MyApp.Admin.csproj) │
│                                         │
│ ☑ Remember my choice                   │
│                                         │
│             [Cancel]  [Run Selected]   │
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### Frontend Changes

**Component**: `src/pages/GenerateAppScreen.tsx`

**New state:**
```typescript
const [appRunState, setAppRunState] = useState<{
  status: 'none' | 'detecting' | 'ready' | 'starting' | 'running' | 'error';
  type?: 'npm' | 'dotnet';
  command?: string;
  url?: string;
  errorMessage?: string;
}>({ status: 'none' });
```

**New functions:**
```typescript
const detectRunnableApp = async () => {
  // Scan for package.json or .csproj files
  // Call backend to parse and determine runnable app
};

const handlePlayClick = async () => {
  // Start the app based on detected type
  // Update state to 'starting'
  // Call backend to run command
};

const handleStopClick = async () => {
  // Stop the running app
  // Update state to 'ready'
  // Call backend to kill process
};

const handleRefreshClick = () => {
  // Reload the current page in iframe (preserves user's current location)
  iframeRef.current?.contentWindow?.location.reload();
};
```

**Hot Reload Event Listener:**
```typescript
// Listen for hot reload events from backend
useEffect(() => {
  let unlistenFn: (() => void) | null = null;
  
  const setupListener = async () => {
    const { listen } = await import('@tauri-apps/api/event');
    unlistenFn = await listen('hot-reload-success', () => {
      logInfo('[AppRunner] Hot reload detected, refreshing iframe');
      if (appRunState.status === 'running' && iframeRef.current) {
        iframeRef.current.contentWindow?.location.reload();
      }
    });
  };
  
  if (appRunState.status === 'running') {
    setupListener();
  }
  
  return () => {
    if (unlistenFn) {
      unlistenFn();
    }
  };
}, [appRunState.status]);
```

**UI rendering:**
```tsx
<div className="running-app-panel">
  <div className="header">
    <h3>Running App</h3>
    {renderPlayStopButton()}
  </div>
  <div className="content">
    {appRunState.status === 'running' && (
      <iframe src={appRunState.url} />
    )}
    {appRunState.status === 'ready' && (
      <div>Your app will appear here...</div>
    )}
    {/* Other states... */}
  </div>
</div>
```

### Backend Changes (Tauri)

**New commands:**

1. **detect_runnable_app**
   - Scans project for package.json or .csproj
   - Returns app type and runnable command/project

2. **start_app**
   - Spawns process to run the app
   - Sets environment variables for .NET apps:
     - `DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1` - Prevents automatic browser opening
     - `HotReloadAutoRestart=true` - Enables automatic hot reload
   - Captures output to detect URL
   - Monitors stderr for hot reload success messages
   - Emits `hot-reload-success` Tauri event when hot reload succeeds
   - Returns PID and detected URL

3. **stop_app**
   - Kills the running process by PID
   - Ensures cleanup of child processes

4. **list_dotnet_projects**
   - Parses .NET solution/projects
   - Returns list of runnable web projects

**File**: `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn detect_runnable_app(project_path: String) -> Result<AppInfo, String> {
    // Implementation
}

#[tauri::command]
async fn start_app(
    project_path: String,
    app_type: String,
    command: String
) -> Result<RunningAppInfo, String> {
    // Implementation
}

#[tauri::command]
async fn stop_app(pid: u32) -> Result<(), String> {
    // Implementation
}
```

**Process Management:**
- Use `std::process::Command` to spawn processes
- Use `tauri::async_runtime` for async process handling
- Track PIDs in app state
- Ensure cleanup on app shutdown

### URL Detection

**npm apps:**
- Parse stdout for patterns:
  - `Local: http://localhost:{port}`
  - `http://localhost:{port}`
  - `http://127.0.0.1:{port}`
- Common ports: 3000, 5173, 8080, 4200

**.NET apps:**
- Parse stdout for patterns:
  - `Now listening on: http://localhost:{port}`
  - `Application started. Press Ctrl+C to shut down.`
- Common ports: 5000, 5001, 7000, 7001

**Fallback:**
- If URL not detected after 5 seconds, show "App started but URL not found"
- Provide manual URL input field

### Project Config Storage

**Location**: `.naide/project-config.json`

**Schema:**
```json
{
  "projectName": "my-app",
  "projectPath": "/path/to/project",
  "runConfig": {
    "type": "npm" | "dotnet",
    "command": "npm run dev",  // for npm
    "projectFile": "src/Web/Web.csproj",  // for dotnet
    "rememberedProject": true
  }
}
```

---

## Error Handling

### npm Errors

**npm not installed:**
- Show: "npm is not installed. Please install Node.js and npm."
- Provide link to nodejs.org

**Script not found:**
- Show: "No dev/start script found in package.json"
- Suggest: "Add a 'dev' or 'start' script to your package.json"

**Port already in use:**
- Show: "Port {port} is already in use"
- Suggest: "Stop the existing process or change the port"

**Dependencies not installed:**
- Detect "Cannot find module" errors
- Show: "Dependencies not installed. Run 'npm install' first."
- Offer: Button to run npm install

### .NET Errors

**.NET SDK not installed:**
- Show: "dotnet SDK is not installed. Please install .NET SDK."
- Provide link to dotnet.microsoft.com

**Project file not found:**
- Show: "Project file not found: {path}"
- Suggest: "Check if the project file exists"

**Build errors:**
- Show: "Build failed. Check the error message below."
- Display build output in expandable section

**Port already in use:**
- Show: "Port {port} is already in use"
- Suggest: "Stop the existing process or change the port in launchSettings.json"

### General Errors

**Process crash:**
- Detect if process exits unexpectedly
- Show: "App crashed. Check logs for details."
- Provide: "Retry" button

**Timeout:**
- If app doesn't start URL within 30 seconds:
- Show: "App is taking longer than expected to start"
- Provide: Option to enter URL manually or keep waiting

---

## User Flows

### First-Time npm App
1. User opens project with package.json
2. Naide detects npm app, shows "Ready" play button
3. User clicks Play
4. Status: "Starting..."
5. npm run dev executes
6. URL detected from output
7. Iframe loads app
8. Status: "Running on http://localhost:5173"
9. User interacts with app in iframe
10. User clicks Stop
11. Process killed, iframe cleared
12. Status: "Stopped"

### First-Time .NET App with Multiple Projects
1. User opens .NET solution with 3 web projects
2. Naide detects .NET app, shows project picker
3. User selects "MyApp.Web"
4. User checks "Remember my choice"
5. Project picker closes, shows "Ready" play button
6. User clicks Play
7. Status: "Starting..."
8. dotnet run executes
9. URL detected from output
10. Iframe loads app
11. Status: "Running on http://localhost:5000"

### Subsequent Runs (Remembered Project)
1. User opens project
2. Naide loads remembered project from config
3. Shows "Ready" play button immediately
4. User clicks Play
5. App starts with remembered settings

---

## Acceptance Criteria

### npm Apps
- [ ] Detects projects with package.json
- [ ] Finds dev/start/serve scripts
- [ ] Play button appears when runnable app detected
- [ ] Clicking Play runs npm command
- [ ] URL is detected from stdout
- [ ] Iframe loads the running app
- [ ] Stop button kills the process
- [ ] Status indicators update correctly
- [ ] Error messages are clear and actionable

### .NET Apps
- [x] Detects projects with .csproj or .sln
- [x] Identifies web projects (ASP.NET, Blazor)
- [x] Uses first web project found (simplified MVP)
- [x] Play button appears when runnable app detected
- [x] Clicking Play runs dotnet watch with --non-interactive
- [x] Browser launch suppression via DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER
- [x] URL is detected from stdout
- [x] Iframe loads the running app
- [x] Stop button kills the process
- [x] Refresh button reloads current page in iframe
- [x] Status indicators update correctly
- [ ] "Change project" option available (future enhancement)

### General
- [ ] No console errors or warnings
- [ ] UI matches Naide's design system
- [ ] Button states are visually distinct
- [ ] Tooltips are helpful
- [ ] Process cleanup on app shutdown
- [ ] Multiple start/stop cycles work correctly

---

## Future Enhancements

### Phase 2: Advanced Features
- Hot reload indicators
- Console output viewer (stdout/stderr in panel)
- Environment variable configuration
- Multiple apps running simultaneously
- Port auto-detection and management

### Phase 3: Other App Types
- Python (Flask, Django, FastAPI)
- Go web servers
- Ruby (Rails, Sinatra)
- Java (Spring Boot)

### Phase 4: Deployment
- One-click deploy to hosting platforms
- Build optimization suggestions
- Production preview mode

---

## Dependencies

### Frontend
- Lucide React icons (Play, Square, Loader2, XCircle)
- Existing Tauri invoke system

### Backend
- Tauri process spawning
- File system access (already configured)
- Process management utilities

### External
- User must have npm installed (for npm apps)
- User must have .NET SDK installed (for .NET apps)

---

## Testing Strategy

### Unit Tests
- URL detection from stdout
- Process state management
- Config persistence/loading

### Integration Tests
1. **npm app:**
   - Create test project with package.json
   - Run dev script, verify URL detection
   - Load in iframe, verify it works
   - Stop, verify process killed

2. **.NET app (single project):**
   - Create test .NET web project
   - Run dotnet run, verify URL detection
   - Load in iframe, verify it works
   - Stop, verify process killed

3. **.NET app (multiple projects):**
   - Create test solution with 2 web projects
   - Verify project picker appears
   - Select project, verify remember works
   - Run, verify correct project runs

4. **Error scenarios:**
   - npm not installed
   - dotnet not installed
   - Port already in use
   - Project file not found
   - Build failures

### Manual Testing
- [ ] Test with React app (Vite)
- [ ] Test with Vue app
- [ ] Test with vanilla HTML/JS
- [ ] Test with ASP.NET Core app
- [ ] Test with Blazor app
- [ ] Test with .NET solution (multiple projects)
- [ ] Test start/stop cycles
- [ ] Test error recovery
- [ ] Test remembered project selection
- [ ] Test on Windows (primary target)
- [ ] Test on macOS (if applicable)

---

## Security Considerations

### Process Execution
- Validate project paths (prevent arbitrary command execution)
- Ensure processes run in project directory only
- Use allowlist of commands (npm, dotnet only)
- Clean up processes on app shutdown (prevent zombie processes)

### Iframe Security
- Only load localhost URLs
- Validate URLs before loading
- Implement CSP for iframe if needed
- Warn about CORS issues (informational)

### File Access
- Only access project directory and .naide config
- Validate all file paths
- No reading of sensitive files outside project

---

## Related Features
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Running App panel
- [2026-02-04-resizable-running-app-column.md](./2026-02-04-resizable-running-app-column.md) - Resizable right panel
- [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) - Building mode for creating apps

---

created by naide
