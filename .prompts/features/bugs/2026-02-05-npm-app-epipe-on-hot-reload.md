# Bug: npm App Crashes with EPIPE on Hot Reload

**Type:** Bug Fix  
**Priority:** High  
**Status:** Fixed

---

## Problem Statement

When running an npm app (e.g., Vite dev server) through Naide's app runner, making changes to the source code causes the dev server to crash with an `EPIPE: broken pipe, write` error.

**Actual Behavior:**
1. User starts npm app via Play button
2. App runs successfully, URL detected, iframe displays app
3. User modifies a source file
4. Vite attempts to perform hot module reload (HMR)
5. Vite crashes with: `Error: EPIPE: broken pipe, write`
6. App preview stops working

**Expected Behavior:**
Hot module reload should work seamlessly - file changes should update the running app without crashing.

---

## Root Cause

The Rust app_runner code spawns a thread to read stdout from the npm process to detect the URL. Once the URL was detected, the thread would `break` out of its read loop:

```rust
// OLD CODE - PROBLEMATIC
for line in reader.lines() {
    if let Ok(line) = line {
        // ... detect URL
        if url_found {
            let _ = tx_clone.send(url);
            break;  // <-- This exits the loop, thread ends
        }
    }
}
// Thread ends here, BufReader is dropped, stdout handle closed
```

When the thread exits:
1. The `BufReader` is dropped
2. The underlying stdout file handle gets closed
3. The child process (Vite) still thinks stdout is connected
4. When Vite tries to write HMR messages to stdout, it gets EPIPE (broken pipe)
5. Node.js crashes on unhandled EPIPE error

---

## Solution

Keep reading stdout indefinitely, even after the URL is detected:

```rust
// NEW CODE - FIXED
let mut url_detected = false;

for line in reader.lines() {
    if let Ok(line) = line {
        log::info!("[npm stdout] {}", clean_line);
        
        if !url_detected {
            // Try to detect URL
            if url_found {
                let _ = tx_clone.send(url);
                url_detected = true;
                // DON'T break - keep reading to prevent EPIPE
            }
        }
        // Continue reading all output to keep the pipe open
    }
}
```

The same fix was applied to both:
- `start_npm_app()` - for npm/Vite apps
- `start_dotnet_app()` - for .NET apps (preventive fix)

---

## Files Modified

- `src/naide-desktop/src-tauri/src/app_runner.rs`
  - Modified `start_npm_app()`: Keep reading stdout after URL detection
  - Modified `start_dotnet_app()`: Keep reading stdout after URL detection

---

## Testing

1. Start an npm app (Vite) via the Play button
2. Verify app loads in the iframe
3. Modify a source file
4. Verify hot reload works without crashes
5. Verify no EPIPE errors in logs

---

## Related

- Feature: [2026-02-04-support-running-apps.md](../2026-02-04-support-running-apps.md)

---

created by naide
