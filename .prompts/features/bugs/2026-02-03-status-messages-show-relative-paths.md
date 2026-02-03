# Bug: Status Messages Show Full Paths Instead of Relative Paths

**Type:** Bug Fix  
**Priority:** Medium  
**Status:** Fixed

---

## Problem Statement

The AI activity status messages were displaying full absolute file paths instead of relative paths from the project root. This made the status messages unnecessarily long and harder to read.

**Actual Behavior:**
```
📝 Writing C:\data\mycode\naide\src\copilot-sidecar\src\statusEvents.ts
🔍 Reading C:\data\mycode\naide\.prompts\features\2026-02-03-feature.md
```

**Expected Behavior:**
```
📝 Writing src/copilot-sidecar/src/statusEvents.ts
🔍 Reading .prompts/features/2026-02-03-feature.md
```

---

## Root Cause

In `src/copilot-sidecar/src/index.ts`, the status event emission code was using absolute file paths directly without converting them to relative paths from the workspace root.

**Affected Lines:**
- Streaming endpoint: Lines ~576-600 (file read/write operations)
- Non-streaming endpoint: Lines ~860-884 (file read/write operations)

---

## Proposed Solution

Add a helper function to convert absolute paths to relative paths and apply it to all file paths before emitting status events.

---

## Implementation

### Changes Made

**File:** `src/copilot-sidecar/src/index.ts`

1. Added helper function to convert absolute to relative paths:
```typescript
function toRelativePath(absolutePath: string, workspaceRoot: string): string {
  if (absolutePath.startsWith(workspaceRoot)) {
    return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  }
  return absolutePath; // Fallback to absolute if not within workspace
}
```

2. Updated status event emissions in streaming endpoint:
   - Applied `toRelativePath()` to file paths before emitting read/write events
   - Used `workspaceRoot` from request context

3. Updated status event emissions in non-streaming endpoint:
   - Applied `toRelativePath()` to file paths before emitting read/write events
   - Used `workspace` from request context

---

## Scope

### In Scope
- Convert absolute paths to relative paths in status messages
- Apply to both streaming and non-streaming endpoints
- Normalize path separators to forward slashes for consistency

### Out of Scope
- Changes to other status message types (build, test, API calls)
- Persistence of status messages
- UI rendering of status messages

---

## Acceptance Criteria

- [x] Helper function `toRelativePath()` created
- [x] Status messages in streaming endpoint show relative paths
- [x] Status messages in non-streaming endpoint show relative paths
- [x] Path separators normalized to forward slashes
- [x] Fallback to absolute path if file is outside workspace
- [x] No breaking changes to status event structure

---

## Testing

### Manual Testing
1. Open a project in Naide
2. Trigger file read operations (e.g., Planning mode chat)
3. Observe status bar messages
4. Verify paths are relative (e.g., `src/file.ts` not `C:\full\path\src\file.ts`)
5. Test with files in different directories (.prompts/, src/, etc.)
6. Verify path separators are forward slashes (/)

### Edge Cases
- Files at project root (e.g., `README.md`)
- Files in nested directories
- Files outside workspace (should fallback to absolute)

---

## Files Affected

- `src/copilot-sidecar/src/index.ts` - Added helper function and updated status emissions
- `.prompts/features/2026-02-03-ai-activity-status-display.md` - Updated specification
- `.prompts/features/bugs/2026-02-03-status-messages-show-relative-paths.md` - This bug report

---

## Related Issues

- Related feature: `.prompts/features/2026-02-03-ai-activity-status-display.md`

---

created by naide
