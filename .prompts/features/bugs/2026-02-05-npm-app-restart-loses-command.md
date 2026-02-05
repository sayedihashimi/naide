# Bug: npm App Restart Loses Command After Stop

**Type:** Bug Fix  
**Priority:** High  
**Status:** ✅ Fixed

---

## Problem Statement

When running an npm app in the Running App panel:
1. User clicks Play → app starts successfully
2. User clicks Stop → app stops
3. User clicks Play again → **Error: "Failed to start app. No script specified for npm app"**

The `command` field (e.g., `"dev"`) is lost during state transitions, so subsequent restarts fail.

---

## Root Cause

In `GenerateAppScreen.tsx`, the `command` field was not being preserved when transitioning between app states. The issue was in **multiple places**:

### 1. `handlePlayClick` success path (PRIMARY CAUSE)
When the app starts successfully and transitions from `ready` → `running`, the `command` field was not included:

```typescript
// BUG: Missing command field when transitioning to 'running'
setAppRunState({
  status: 'running',
  type: appRunState.type,
  projectFile: appRunState.projectFile,
  url: result.url,
  proxyUrl,
  pid: result.pid,
  // command was NOT preserved!
});
```

This meant that by the time `handleStopClick` ran, `appRunState.command` was already `undefined`.

### 2. `handlePlayClick` error path
Same issue - `command` was not preserved on error.

### 3. `handleStopClick` paths
These were also missing `command`, but fixing them alone didn't help because the `command` was already lost when transitioning to `running`.

---

## Log Evidence

From logs:

**First run (success):**
```
Starting app: AppInfo { app_type: "npm", project_file: None, command: Some("dev") }
```

**After stop and restart (failure):**
```
Starting app: AppInfo { app_type: "npm", project_file: None, command: None }
[AppRunner] Failed to start app: No script specified for npm app
```

The `command` field changes from `Some("dev")` to `None` after the app transitions to `running` state.

---

## Fix Applied

Added `command: appRunState.command` to ALL state transitions in both `handlePlayClick` and `handleStopClick`:

**File:** `src/naide-desktop/src/pages/GenerateAppScreen.tsx`

### handlePlayClick success path (line ~906-914):
```typescript
setAppRunState({
  status: 'running',
  type: appRunState.type,
  projectFile: appRunState.projectFile,
  command: appRunState.command,  // ← Added
  url: result.url,
  proxyUrl,
  pid: result.pid,
});
```

### handlePlayClick error path (line ~921-927):
```typescript
setAppRunState({
  status: 'error',
  type: appRunState.type,
  projectFile: appRunState.projectFile,
  command: appRunState.command,  // ← Added
  errorMessage: String(error),
});
```

### handleStopClick success path (line ~953-958):
```typescript
setAppRunState({
  status: 'ready',
  type: appRunState.type,
  projectFile: appRunState.projectFile,
  command: appRunState.command,  // ← Added
});
```

### handleStopClick error path (line ~965-970):
```typescript
setAppRunState(prev => ({
  ...prev,
  status: 'error',
  errorMessage: String(error),
  command: prev.command,  // ← Added
}));
```

---

## Verification

After fix:
1. App detection: `command: Some("dev")` stored in state
2. Start app → transitions to `running` with `command: "dev"` preserved
3. Stop app → transitions to `ready` with `command: "dev"` preserved  
4. Start again → successfully uses `command: "dev"`

---

## Acceptance Criteria

- [x] After stopping an npm app, clicking Play again starts the app successfully
- [x] The `command` field is preserved across ALL state transitions
- [x] Error states also preserve the `command` field
- [x] .NET apps (with `projectFile` instead of `command`) continue to work correctly
- [x] Logs show correct `command` value on restart

---

## Files Affected

- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - Fixed state preservation in handlePlayClick AND handleStopClick

---

## Testing

1. Open an npm project with `package.json` containing a `dev` script
2. Click Play → verify app starts
3. Click Stop → verify app stops
4. Click Play again → verify app starts (should succeed after fix)
5. Repeat cycle multiple times
6. Test with .NET apps to ensure no regression

---

## Related Issues

- Feature: [2026-02-04-support-running-apps.md](../2026-02-04-support-running-apps.md) - Running apps feature

---

created by naide
