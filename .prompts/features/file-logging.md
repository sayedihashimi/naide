# File Logging Feature

## Overview
The Naide application now includes persistent file logging for both the Rust backend (Tauri) and the Node.js sidecar. Log files are created for each application run to aid in debugging and tracking application behavior.

## Log File Location

### All Platforms
Logs are stored in: `%temp%/com.naide.desktop/logs`

Platform-specific paths:
- **Windows**: `C:\Users\{username}\AppData\Local\Temp\com.naide.desktop\logs\`
- **macOS**: `/var/folders/.../T/com.naide.desktop/logs/` (system temp directory)
- **Linux**: `/tmp/com.naide.desktop/logs/`

## Log File Naming Convention

Each application run creates a new log file with a timestamp:

Format: `naide-{TIMESTAMP}.log`

Example: `naide-2026-02-01T03-30-28.log`

The timestamp uses ISO 8601 format with colons replaced by hyphens for filesystem compatibility.

## Implementation Details

### Rust Backend (Tauri)

The Rust backend uses `tauri-plugin-log` with a custom folder target:

- **Plugin**: `tauri-plugin-log` version 2
- **Target**: Custom folder in temp directory
- **Log Level**: Info and above
- **Outputs**: Both file and stdout (console)

Key features:
- Creates log directory on startup if it doesn't exist
- Generates timestamped filename for each run
- Logs application startup events
- Logs sidecar initialization
- Captures errors and warnings

Configuration is in `src/naide-desktop/src-tauri/src/lib.rs` in the `setup` handler.

### Node.js Sidecar

The Node.js sidecar uses a custom logger module:

- **Module**: `src/copilot-sidecar/src/logger.ts`
- **Log Level**: All console output (log, error, warn)
- **Format**: `[timestamp] [level] message`

Key features:
- Intercepts console.log, console.error, and console.warn
- Writes to both console and file simultaneously
- Creates log directory on startup if it doesn't exist
- Generates timestamped filename for each run
- Handles JSON object serialization

The logger is initialized at sidecar startup before any other logging occurs.

## Log Format

### Rust Backend
Uses `tauri-plugin-log` default format:
```
[2026-02-01T03:30:28.123Z INFO  app_lib] Naide application starting
[2026-02-01T03:30:28.456Z INFO  app_lib] Logging configured successfully
```

### Node.js Sidecar
Custom format:
```
[2026-02-01T03:30:28.789Z] [INFO] [Sidecar] Copilot sidecar running on http://localhost:3001
[2026-02-01T03:30:29.012Z] [ERROR] [Sidecar] Failed to initialize Copilot: Connection refused
```

## Usage

### For Developers
No code changes needed. The logger is automatically initialized on application startup.

For Rust code:
```rust
log::info!("Information message");
log::warn!("Warning message");
log::error!("Error message");
```

For Node.js code:
```typescript
console.log('[Sidecar] Info message');    // Logged as INFO
console.warn('[Sidecar] Warning');        // Logged as WARN
console.error('[Sidecar] Error');         // Logged as ERROR
```

### For Users
Log files are created automatically. To access logs:

1. Navigate to your system's temp directory:
   - Windows: Open `%TEMP%` in File Explorer
   - macOS/Linux: Navigate to system temp directory
2. Open the `com.naide.desktop/logs` folder
3. Find the log file for the relevant run by timestamp

## Log Management

### Current Behavior
- New log file created for each application run
- No automatic cleanup or rotation
- Files persist until manually deleted or system temp cleanup occurs

### Future Enhancements
Potential improvements for future versions:
- Automatic log rotation after N days
- Maximum log file size limits
- Log file compression for old logs
- Frontend log forwarding to backend (for persistence)
- Built-in log viewer UI

## Troubleshooting

### No Log Files Created
1. Check that the application has write permissions to the temp directory
2. Verify temp directory exists and is accessible
3. Check console output for any error messages during log initialization

### Log Directory Not Found
The application automatically creates the log directory on startup. If it fails:
- Check filesystem permissions
- Verify temp directory path is valid
- Check console/terminal output for error messages

### Logs Not Being Written
1. Verify log file was created (check timestamp in filename)
2. Check file permissions
3. Look for error messages in console output
4. Ensure disk space is available

## Dependencies

### Rust Backend
- `tauri-plugin-log` = "2"
- `log` = "0.4"
- `chrono` = "0.4" (for timestamp formatting)

### Node.js Sidecar
- Native Node.js modules only (`fs`, `path`, `os`)
- No external dependencies required

## Security Considerations

- Log files may contain debugging information
- Files are stored in system temp directory (cleared on reboot on some systems)
- No sensitive data (passwords, tokens) should be logged
- Log files are not encrypted
- Standard filesystem permissions apply
