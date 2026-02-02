---
Status: shipped
Area: infra
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# File Logging Feature

## Status: ✅ IMPLEMENTED

## Problem Statement
The app currently only logs to the console, which means logs are lost when the app closes or the console buffer clears. We need persistent file logging for debugging and tracking.

## Requirements
- Log files location: `%temp%/com.naide.desktop/logs` ✅
- Create new log file each app run ✅
- File naming: `naide-{TIMESTAMP}.log` (e.g., `naide-2026-02-01T03-30-28.log`) ✅
- Apply to both Rust backend and Node.js sidecar ✅

## Implementation Summary

### Rust Backend (Tauri) ✅
- Configured `tauri-plugin-log` version 2 with `TargetKind::Folder`
- Custom log directory: `%temp%/com.naide.desktop/logs`
- Timestamped filename using ISO 8601 format (colons replaced with hyphens)
- Dual output: both file and stdout
- Automatic directory creation on startup
- Comprehensive error handling with full path context
- Location: `src/naide-desktop/src-tauri/src/lib.rs`

### Node.js Sidecar ✅
- Created custom logger module: `src/copilot-sidecar/src/logger.ts`
- Intercepts console.log/error/warn to write to both console and file
- Same log directory and naming convention as Rust backend
- Cross-platform temp path resolution using `os.tmpdir()`
- Automatic directory creation
- Format: `[timestamp] [level] message`
- Error handling to prevent infinite loops

### Frontend
- Frontend logs remain console-only (captured by DevTools)
- Can be extended in future to forward important logs to backend

## Implementation Checklist

- [x] **Backend: Configure tauri-plugin-log for file logging**
  - [x] Configured plugin in lib.rs with Folder target
  - [x] Set log directory to `%temp%/com.naide.desktop/logs`
  - [x] Set file naming pattern to `naide-{timestamp}.log`
  - [x] Added log statements for testing

- [x] **Backend: Create log directory on startup**
  - [x] Added code to ensure log directory exists before writing
  - [x] Cross-platform %temp% path resolution
  - [x] Improved error messages with full path context

- [x] **Sidecar: Implement file logger module**
  - [x] Created logger utility in `src/copilot-sidecar/src/logger.ts`
  - [x] Resolved %temp% path for all platforms
  - [x] Creates logs directory if missing
  - [x] Generates timestamped filename on startup
  - [x] Wraps console.log/error/warn to write to file

- [x] **Sidecar: Initialize logger on startup**
  - [x] Logger initialization in `src/copilot-sidecar/src/index.ts`
  - [x] Initialized before any other logging

- [x] **Code quality improvements**
  - [x] Added comprehensive error handling
  - [x] Improved error messages
  - [x] Protected against infinite loops in console overrides

- [ ] **Testing and verification** (requires manual testing)
  - [ ] Run app and verify log files are created in correct location
  - [ ] Verify timestamp format in filename
  - [ ] Verify log content is written correctly
  - [ ] Test multiple app runs create separate files

## Technical Details

### Log Directory Path
- **Windows**: `%temp%` typically resolves to `C:\Users\{username}\AppData\Local\Temp`
- **macOS**: System temp directory (varies, e.g., `/var/folders/.../T/`)
- **Linux**: `/tmp/`
- **Full path**: `{temp}/com.naide.desktop/logs/naide-{timestamp}.log`

### Timestamp Format
- ISO 8601 format with safe filename characters: `2026-02-01T03-30-28`
- Colons replaced with hyphens for filesystem compatibility
- Generated at application startup

### Log Format

**Rust Backend** (via tauri-plugin-log):
```
[2026-02-01T03:30:28.123Z INFO  app_lib] Naide application starting
[2026-02-01T03:30:28.456Z INFO  app_lib] Logging configured successfully
```

**Node.js Sidecar** (custom format):
```
[2026-02-01T03:30:28.789Z] [INFO] [Sidecar] Copilot sidecar running on http://localhost:3001
[2026-02-01T03:30:29.012Z] [ERROR] [Sidecar] Failed to initialize Copilot: Connection refused
```

### Log Levels
- Keep existing log levels (info, warn, error, debug)
- Both console and file receive same log messages
- Rust: Uses standard `log` crate levels
- Node.js: INFO, WARN, ERROR mapped from console methods

### Usage

**Rust code:**
```rust
log::info!("Information message");
log::warn!("Warning message");
log::error!("Error message");
```

**Node.js code:**
```typescript
console.log('[Sidecar] Info message');    // Logged as INFO
console.warn('[Sidecar] Warning');        // Logged as WARN
console.error('[Sidecar] Error');         // Logged as ERROR
```

### Dependencies

**Rust Backend:**
- `tauri-plugin-log = "2"`
- `log = "0.4"`
- `chrono = "0.4"` (for timestamp formatting)

**Node.js Sidecar:**
- Native Node.js modules only (`fs`, `path`, `os`)
- No external dependencies

### Files Changed
- `src/naide-desktop/src-tauri/src/lib.rs` - Rust logging configuration
- `src/copilot-sidecar/src/logger.ts` - New logger module (created)
- `src/copilot-sidecar/src/index.ts` - Logger initialization

## Future Considerations
- Log rotation/cleanup (delete old logs after N days?)
- Max log file size limits
- Frontend log forwarding to backend (optional)
- Log viewer UI (optional enhancement)
- Centralized log aggregation for debugging

## Troubleshooting

### No Log Files Created
1. Check application has write permissions to temp directory
2. Verify temp directory exists and is accessible
3. Check console output for error messages during log initialization

### Log Directory Not Found
- Application automatically creates directory on startup
- If fails, check filesystem permissions and disk space

### Logs Not Being Written
1. Verify log file was created (check timestamp in filename)
2. Check file permissions
3. Look for error messages in console output
4. Ensure disk space is available
