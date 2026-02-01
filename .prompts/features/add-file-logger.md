# File Logging Feature Plan

## Problem Statement
The app currently only logs to the console, which means logs are lost when the app closes or the console buffer clears. We need persistent file logging for debugging and tracking.

## Requirements
- Log files location: `%temp%/com.naide.desktop/logs`
- Create new log file each app run
- File naming: `naide-{TIMESTAMP}.log` (e.g., `naide-2026-02-01T03-30-28.log`)
- Apply to both Rust backend and Node.js sidecar

## Proposed Approach

### Rust Backend (Tauri)
- Use `tauri-plugin-log` with file targets (already has debug dependency, needs to be enabled for production)
- Configure log directory and rotation strategy
- Set timestamp format for file names

### Node.js Sidecar
- Implement file logger using Node.js `fs` module
- Create log directory if it doesn't exist
- Write logs with timestamp prefixes
- Maintain same format as Rust logs for consistency

### Frontend
- Frontend logs can remain console-only (captured by DevTools)
- Or optionally send important logs to backend via IPC for persistence

## Workplan

- [ ] **Backend: Configure tauri-plugin-log for file logging**
  - Update Cargo.toml to enable tauri-plugin-log properly
  - Configure plugin in lib.rs with file target
  - Set log directory to `%temp%/com.naide.desktop/logs`
  - Set file naming pattern to `naide-{timestamp}.log`
  - Test log file creation and writing

- [ ] **Backend: Create log directory on startup**
  - Add code to ensure log directory exists before writing
  - Handle Windows %temp% path resolution

- [ ] **Sidecar: Implement file logger module**
  - Create logger utility in Node.js sidecar
  - Resolve %temp% path for Windows
  - Create logs directory if missing
  - Generate timestamped filename on startup
  - Wrap console.log/error/warn to write to file

- [ ] **Sidecar: Initialize logger on startup**
  - Call logger initialization at app start
  - Test file creation and logging

- [ ] **Update specs and features**
  - Create `.prompts/features/file-logging.md`
  - Update app-spec.md if needed
  - Document log file location and naming convention

- [ ] **Testing and verification**
  - Run app and verify log files are created in correct location
  - Verify timestamp format in filename
  - Verify log content is written correctly
  - Test multiple app runs create separate files
  - Check log rotation/cleanup (if needed)

## Notes

### Log Directory Path
- Windows: `%temp%` typically resolves to `C:\Users\{username}\AppData\Local\Temp`
- Full path will be: `C:\Users\{username}\AppData\Local\Temp\com.naide.desktop\logs\naide-{timestamp}.log`

### Timestamp Format
- Use ISO 8601 format with safe filename characters: `2026-02-01T03-30-28` (colons replaced with hyphens)

### Log Levels
- Keep existing log levels (info, warn, error, debug)
- Both console and file should receive same log messages

### Future Considerations
- Log rotation/cleanup (delete old logs after N days?)
- Max log file size limits
- Frontend log forwarding to backend (optional)
- Log viewer UI (optional enhancement)
