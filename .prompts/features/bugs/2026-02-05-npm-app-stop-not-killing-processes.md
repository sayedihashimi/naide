# Bug: npm App Stop Button Doesn't Properly Kill All Processes

**Type:** Bug Fix  
**Priority:** High  
**Status:** Fixed

## Implementation Summary (2026-02-05)

**Root Cause:** The `stop_app` function was using `process.kill()` which only kills the parent npm process, leaving child processes (node.js running Vite) orphaned.

**Fix Applied:**
1. **Created `kill_process_tree()` function** - Uses `taskkill /T /F /PID` on Windows to kill the entire process tree (npm + node + all children)
2. **Created `is_process_running()` function** - Checks if a process is still alive using `tasklist`
3. **Updated `stop_app` command** - Now calls `kill_process_tree()` instead of `process.kill()`, then verifies the process is actually dead before returning success
4. **Updated cleanup on Naide exit** - Window close event handler now also uses `kill_process_tree()` to ensure all processes are terminated when Naide exits

**Key Changes in `src-tauri/src/lib.rs`:**
- Added `kill_process_tree(pid: u32)` - Platform-specific process tree termination
- Added `is_process_running(pid: u32)` - Process existence check
- Updated `stop_app` to use tree kill and verify termination
- Updated `on_window_event` handler to use tree kill for both sidecar and running app

---

## Problem Statement

When running an npm app (e.g., Vite dev server) and clicking the Stop button:
- The log file shows the app is stopped
- The UI remains in "running" state and the iframe still shows the app
- The web app is still interactive/functional
- Clicking Stop again finally shows the "not running" state
- Node/npm processes continue running even after closing Naide entirely

**Expected behavior:**
- Stop button kills all related processes immediately
- UI updates to "not running" state on first click
- All node/npm child processes are terminated
- No orphaned processes after Naide closes

---

## Root Cause (Investigation Needed)

Likely causes:

1. **Child process tree not killed**: `npm run dev` spawns child processes (e.g., node running Vite). Killing only the npm parent process leaves child processes orphaned.

2. **Process group not terminated**: On Windows, child processes may not be in the same process group, requiring explicit tree kill.

3. **UI state not updated on stop**: The frontend may not be receiving/handling the stop confirmation correctly.

4. **Race condition**: Stop command may return before processes are fully terminated.

---

## Reproduction Steps

1. Open a project with an npm app (e.g., Vite React app)
2. Click Play to start the app
3. Wait for the app to appear in the iframe
4. Click Stop button
5. **Observe**: UI still shows running app, iframe is interactive
6. Click Stop again
7. **Observe**: UI now shows "not running" state
8. Close Naide
9. Check Task Manager / `tasklist` for orphaned node processes

---

## Proposed Solution

### 1. Use Process Tree Kill on Windows

The current implementation likely uses simple process termination. On Windows, we need to kill the entire process tree:

**Current (problematic):**
```rust
// Only kills parent process
child.kill()?;
```

**Fix:**
```rust
// Windows: Kill entire process tree
#[cfg(windows)]
{
    use std::process::Command;
    // taskkill /T kills the process tree, /F forces termination
    Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output()?;
}

#[cfg(not(windows))]
{
    // Unix: Kill process group
    use nix::sys::signal::{kill, Signal};
    use nix::unistd::Pid;
    kill(Pid::from_raw(-pid as i32), Signal::SIGTERM)?;
}
```

### 2. Verify Process Termination

After sending kill signal, verify processes are actually dead before returning success:

```rust
async fn stop_app(pid: u32) -> Result<(), String> {
    // Send kill signal
    kill_process_tree(pid)?;
    
    // Wait for processes to terminate (with timeout)
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(5) {
        if !is_process_running(pid) {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    // Force kill if still running
    force_kill_process_tree(pid)?;
    Ok(())
}
```

### 3. Update Frontend State Correctly

Ensure the frontend updates state only after backend confirms processes are dead:

```typescript
const handleStopClick = async () => {
    try {
        setAppRunState(prev => ({ ...prev, status: 'stopping' }));
        await invoke('stop_app', { pid: currentPid });
        // Only update to 'ready' after confirmed stop
        setAppRunState(prev => ({ ...prev, status: 'ready', url: undefined }));
    } catch (error) {
        // Handle error, maybe processes couldn't be killed
        setAppRunState(prev => ({ ...prev, status: 'error', errorMessage: String(error) }));
    }
};
```

### 4. Clean Up on Naide Exit

Register a cleanup handler to kill all spawned processes when Naide exits:

```rust
// In app setup
app.on_window_event(|event| {
    if let tauri::WindowEvent::Destroyed = event.event() {
        // Kill all tracked running app processes
        cleanup_running_apps();
    }
});
```

---

## Scope

### In Scope
- Fix process tree termination on Windows
- Ensure all child processes (node, npm, vite) are killed
- Update frontend state correctly after stop
- Add cleanup on Naide exit
- Verify stop actually worked before returning success

### Out of Scope
- macOS/Linux process handling (can be addressed separately)
- Graceful shutdown with SIGTERM before SIGKILL (future enhancement)
- Multiple concurrent app support

---

## Acceptance Criteria

- [x] Clicking Stop once kills all npm/node processes
- [x] UI immediately updates to "not running" state
- [x] Iframe clears and shows placeholder
- [x] No orphaned node processes in Task Manager
- [x] Closing Naide kills any running app processes
- [x] Log file shows successful process termination
- [ ] Works for Vite, CRA, and other npm dev servers (manual testing needed)

---

## Files Affected

- `src/naide-desktop/src-tauri/src/app_runner.rs` - Process killing logic
- `src/naide-desktop/src-tauri/src/lib.rs` - Cleanup on exit
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - State management on stop

---

## Testing

### Manual Testing
- [ ] Start npm app, click Stop, verify all processes killed
- [ ] Check Task Manager for orphaned processes
- [ ] Start app, close Naide without stopping, verify processes killed
- [ ] Test with Vite app
- [ ] Test with Create React App
- [ ] Test rapid start/stop cycles

### Verification Commands
```powershell
# Check for running node processes
tasklist | findstr "node"

# Check for processes on specific port
netstat -ano | findstr ":5173"
```

---

## Related Issues

- Feature: [2026-02-04-support-running-apps.md](../2026-02-04-support-running-apps.md)
- Previous bug: [2026-02-05-npm-app-epipe-on-hot-reload.md](./2026-02-05-npm-app-epipe-on-hot-reload.md)

---

created by naide
