---
Status: fixed
Area: infra
Severity: minor
Created: 2026-02-06
Fixed: 2026-02-06
---

# Bug: Two Log Files Created on Each Run

## Status: ✅ FIXED

## Issue Description
The application was creating two separate log files on each run instead of a single unified log file.

## Symptoms
- Two timestamped log files appeared in `%temp%/com.naide.desktop/logs/` after each app launch
- Files had slightly different timestamps (seconds apart)
- Logs were split between two files, making debugging difficult
- Example:
  - `naide-2026-02-06T10-30-28.log` (from Tauri)
  - `naide-2026-02-06T10-30-29.log` (from sidecar)

## Root Cause
Both the Tauri backend and Node.js sidecar independently initialized their own log files:
1. **Tauri backend** (`lib.rs`): Created log file at startup using `Utc::now()`
2. **Sidecar** (`logger.ts`): Created another log file at startup using `new Date()`

Since the sidecar starts slightly after Tauri, the timestamps differed by 1-2 seconds, resulting in separate files.

## Impact
- **Severity**: Minor
- **User Impact**: Cluttered log directory, split logs made debugging harder
- **Functional Impact**: No loss of functionality, just inconvenient

## Fix Implementation

### Solution
Modified the architecture to share a single log file:
1. Tauri creates the log file and generates the path
2. Tauri passes log file path to sidecar via `NAIDE_LOG_FILE` environment variable
3. Sidecar reads the environment variable and appends to the existing log
4. Fallback: If env var not set, sidecar creates its own log (for standalone mode)

### Files Changed
- `src/naide-desktop/src-tauri/src/lib.rs`:
  - Added `log_file_path` variable construction
  - Added `.env("NAIDE_LOG_FILE", log_file_path)` when spawning sidecar
  
- `src/copilot-sidecar/src/logger.ts`:
  - Added check for `process.env.NAIDE_LOG_FILE`
  - Uses `appendFileSync` instead of `writeFileSync` when reusing log
  - Maintains fallback to standalone log creation

### Code Changes

**Tauri (lib.rs)**:
```rust
// Pass log file path to sidecar via environment variable
let log_file_path = log_dir.join(&log_filename);

match Command::new("node")
  .arg(path)
  .env("NAIDE_LOG_FILE", log_file_path.to_string_lossy().to_string())
  .stdout(Stdio::piped())
  .stderr(Stdio::piped())
  .spawn() {
```

**Sidecar (logger.ts)**:
```typescript
// Check if Tauri passed us a log file path via environment variable
const tauriLogFile = process.env.NAIDE_LOG_FILE;

if (tauriLogFile) {
  // Reuse the log file created by Tauri
  logFilePath = tauriLogFile;
  
  // Append initial log entry
  const initMessage = `[${new Date().toISOString()}] [Sidecar] Log initialized (shared with Tauri): ${logFilePath}\n`;
  appendFileSync(logFilePath, initMessage, 'utf-8');
  
  console.log(`[Sidecar] File logging initialized (shared): ${logFilePath}`);
} else {
  // Fallback: Create our own log file (for standalone sidecar runs)
  // ... existing standalone logic ...
}
```

## Verification
After the fix:
- ✅ Only one log file is created per app run
- ✅ Both Tauri and sidecar logs appear in the same file
- ✅ Chronological ordering is maintained
- ✅ Fallback mode still works for standalone sidecar development

## Follow-up Fix (2026-02-06): Rust Compilation Error

### Problem
The initial fix caused Rust compilation errors:
```
error[E0382]: borrow of moved value: `log_dir`
error[E0382]: borrow of moved value: `log_filename`
```

### Root Cause
The `log_dir` and `log_filename` values were moved into the logging configuration struct, then attempted to be used again to construct the sidecar's log file path.

### Solution
Added `.clone()` calls before moving the values into the struct:
```rust
tauri_plugin_log::TargetKind::Folder {
  path: log_dir.clone(),           // Clone before move
  file_name: Some(log_filename.clone()),  // Clone before move
}
```

This allows the original values to remain available for constructing the `NAIDE_LOG_FILE` environment variable.

## Related
- Original feature: `.prompts/features/2026-02-01-add-file-logger.md`
- Issue tracker: GitHub issue about duplicate log files

## Prevention
- Always consider cross-component initialization when implementing system-wide features
- Use environment variables or IPC to share configuration between components
- Document shared resource initialization patterns in architecture docs

## Notes
- The fix maintains backward compatibility with standalone sidecar runs
- No breaking changes to the logging API
- Log format remains unchanged
