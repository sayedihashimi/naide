---
Status: planned
Area: ui, build, infra
Created: 2026-02-04
LastUpdated: 2026-02-04
---

# Feature: Support Running npm and .NET Apps
**Status**: 🟡 PLANNED

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
3. If multiple web projects found:
   - Show project picker dialog
   - User selects which project to run
   - Remember selection in project config (`.naide/project-config.json`)
4. Store selected project path

**Running:**
1. User clicks Play
2. Execute: `dotnet watch --non-interactive --project {selected-project-path}`
3. Capture stdout/stderr
4. Detect app URL from output (e.g., "Now listening on: http://localhost:5000")
5. Load URL in iframe in "Running App" panel
6. Show status: "Running on http://localhost:5000"

**Why `dotnet watch --non-interactive`:**
- Enables hot reload (auto-restart on file changes)
- `--non-interactive` prevents prompts that would block execution
- Provides better development experience matching npm's dev servers

**Stopping:**
1. User clicks Stop
2. Kill the dotnet process
3. Clear iframe
4. Show status: "Stopped"

**Multi-Project Handling:**
- If user has selected a project before, use that selection automatically
- Show "Change project" link/button to re-open picker
- Store selection per workspace in `.naide/project-config.json`:
  ```json
  {
    "projectName": "my-app",
    "projectPath": "/path/to/project",
    "runConfig": {
      "type": "dotnet",
      "projectFile": "src/Web/Web.csproj"
    }
  }
  ```

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

**Running state (red):**
- Icon: Stop square (⏹) from Lucide `Square` icon
- Color: Red (red-500)
- Size: 32px clickable area, 20px icon
- Hover: Lighter red (red-400)

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
│ Running App                    [⏹ Stop]│
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
   - Captures output to detect URL
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
- [ ] Detects projects with .csproj or .sln
- [ ] Identifies web projects (ASP.NET, Blazor)
- [ ] Shows project picker for multiple projects
- [ ] Remembers user's project selection
- [ ] Play button appears when runnable app detected
- [ ] Clicking Play runs dotnet run
- [ ] URL is detected from stdout
- [ ] Iframe loads the running app
- [ ] Stop button kills the process
- [ ] Status indicators update correctly
- [ ] "Change project" option available

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
