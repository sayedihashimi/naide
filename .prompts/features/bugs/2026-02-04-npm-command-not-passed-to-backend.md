# Bug: npm command field not passed from frontend to backend

**Type:** Bug Fix  
**Priority:** High  
**Status:** Fixed

---

## Problem Statement

When clicking the Play button for an npm app, the app fails to start with the error "No script specified for npm app", even though the detection correctly identifies the script (e.g., "dev").

The issue occurs because the frontend is not properly storing and passing the `command` field from the detected npm app to the backend's `start_app` command.

---

## Reproduction Steps

1. Open a project with package.json that has a "dev" script
2. Play button appears (detection works)
3. Click Play button
4. Error: "No script specified for npm app"

---

## Root Cause

**Three issues in GenerateAppScreen.tsx:**

1. **Type definition (line 121)**: `type?: 'dotnet'` should be `type?: 'dotnet' | 'npm'`
2. **Missing field (line 122)**: State doesn't include `command?: string` field
3. **Not storing command (line 245)**: Detection result doesn't save `appInfo.command`
4. **Hardcoded null (line 874)**: `start_app` call passes `command: null` instead of actual value

**Backend detection works correctly** - `detect_npm_app()` in app_runner.rs properly extracts the script name and returns it in `AppInfo.command`.

**Frontend breaks the chain** - It receives the command but doesn't store it, then passes null to the start command.

---

## Solution

**Fixed in GenerateAppScreen.tsx:**

1. Updated state type to include `'npm'` and `command` field:
```typescript
const [appRunState, setAppRunState] = useState<{
  status: 'none' | 'detecting' | 'ready' | 'starting' | 'running' | 'error';
  type?: 'dotnet' | 'npm';  // Added 'npm'
  projectFile?: string;
  command?: string;  // Added command field
  url?: string;
  // ...
}>({ status: 'none' });
```

2. Store command when detecting (line ~245):
```typescript
setAppRunState({
  status: 'ready',
  type: appInfo.app_type as 'dotnet' | 'npm',
  projectFile: appInfo.project_file,
  command: appInfo.command,  // Now stored
});
```

3. Pass command when starting (line ~874):
```typescript
appInfo: {
  app_type: appRunState.type,
  project_file: appRunState.projectFile,
  command: appRunState.command,  // Now passed correctly
}
```

---

## Acceptance Criteria

- [x] Frontend state includes `command?: string` field
- [x] Frontend state type includes `'npm'` option
- [x] App detection stores the command from backend response
- [x] Start app command passes the command to backend
- [x] npm apps start successfully with correct script

---

## Testing

Verified with React app at `C:\temp\naide\MyReactWeb01\`:
1. package.json has `"dev": "vite"` script
2. Detection returns: `{ app_type: "npm", command: "dev" }`
3. Frontend stores command in state
4. Play button passes command to backend
5. Backend runs `npm run dev` successfully

---

## Related Features

- [2026-02-04-support-running-apps.md](../2026-02-04-support-running-apps.md) - Running apps feature
- [bugs/2026-02-04-npm-app-detection-not-implemented.md](./2026-02-04-npm-app-detection-not-implemented.md) - npm detection implementation

---

created by naide
