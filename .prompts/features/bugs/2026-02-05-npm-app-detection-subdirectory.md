# Bug: npm App Detection Fails When package.json Is in a Subdirectory

**Type:** Bug Fix  
**Priority:** High  
**Status:** Fixed (2026-02-05)

---

## Problem Statement

When a user opens a project where `package.json` is not in the project root but in a subdirectory (e.g., `src/frontend/package.json`), Naide fails to detect it as a runnable npm web app. The "Running App" panel shows "No runnable app detected" even though a valid npm web app exists in the project.

**Actual behavior:** `detect_npm_app()` only checks `{project_root}/package.json`. If not found, it returns `None`.

**Expected behavior:** `detect_npm_app()` should search subdirectories for `package.json` (similar to how `detect_dotnet_app()` recursively searches for `.csproj` files), find a runnable npm app, and return its info including the subdirectory path.

---

## Reproduction Steps

1. Open a project where `package.json` is in a subdirectory (e.g., `C:\temp\naide\MyPieShop2\`)
   - Project structure:
     ```
     MyPieShop2/
     ├── src/
     │   └── frontend/
     │       ├── package.json    ← Has "dev": "vite" script
     │       ├── vite.config.js
     │       ├── node_modules/
     │       └── src/
     ├── images/
     └── .prompts/
     ```
2. Look at the "Running App" panel in the right column
3. Panel shows "No runnable app detected" instead of detecting the npm app

---

## Root Cause

In `src/naide-desktop/src-tauri/src/app_runner.rs`, the `detect_npm_app()` function (lines 35-67) only checks the project root:

```rust
let package_json_path = project_dir.join("package.json");

if !package_json_path.exists() {
    return Ok(None);  // ← Immediately gives up if not in root
}
```

In contrast, `detect_dotnet_app()` uses `find_files_with_extension()` which recursively walks subdirectories. The npm detection lacks this recursive search.

Additionally, `start_npm_app()` (line 250) uses `project_path` as the working directory, but when `package.json` is in a subdirectory, the `npm run` command needs to execute from that subdirectory.

---

## Proposed Solution

### 1. Add recursive `package.json` search to `detect_npm_app()`

If `package.json` is not found in the project root, recursively search subdirectories (skipping `node_modules`, `.git`, `dist`, `build`, etc.):

```
1. Check project root for package.json (current behavior, fast path)
2. If not found, recursively search subdirectories
3. For each package.json found, check if it has runnable scripts
4. Return the first match with its relative directory path
```

### 2. Store the npm app's directory in `AppInfo`

The `AppInfo` struct's `project_file` field (currently `None` for npm apps) should store the relative path to the directory containing `package.json` so that `start_npm_app()` can use it as the working directory.

For example:
- `project_file: Some("src/frontend")` when `package.json` is at `src/frontend/package.json`
- `project_file: None` when `package.json` is at the project root (backward compatible)

### 3. Update `start_npm_app()` to use the correct working directory

When `project_file` (directory path) is provided, `start_npm_app()` should set `current_dir` to `project_path/project_file` instead of just `project_path`.

### 4. Skip irrelevant directories during search

When searching recursively, skip directories that are unlikely to contain the main app:
- `node_modules`
- `.git`
- `dist` / `build` / `out`
- `bin` / `obj`

---

## Scope

### In Scope
- Make `detect_npm_app()` search subdirectories recursively
- Update `AppInfo` to carry the npm app's subdirectory path
- Update `start_npm_app()` to run from the correct subdirectory
- Update `start_app` Tauri command to pass the subdirectory path
- Ensure backward compatibility (root-level `package.json` still works)

### Out of Scope
- Handling multiple `package.json` files (monorepo detection)
- UI for selecting which npm app to run when multiple are found
- Changes to .NET detection logic

---

## Acceptance Criteria

- [ ] Projects with `package.json` in a subdirectory are detected as npm apps
- [ ] Projects with `package.json` in the root still work (no regression)
- [ ] `npm run {script}` executes from the correct subdirectory
- [ ] The detected app's subdirectory path is shown in the UI status
- [ ] `node_modules`, `.git`, and build output directories are skipped during search
- [ ] App successfully starts and URL is detected for subdirectory npm apps

---

## Files Affected

- `src/naide-desktop/src-tauri/src/app_runner.rs` - Add recursive search to `detect_npm_app()`, update `start_npm_app()` working directory
- `src/naide-desktop/src-tauri/src/lib.rs` - Update `start_app` command to pass subdirectory path to `start_npm_app()`
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - May need to display subdirectory info in status, pass project_file for npm apps

---

## Testing

### Manual Testing
- [ ] Open project with `package.json` at root → detected correctly (regression test)
- [ ] Open project with `package.json` in subdirectory (e.g., `src/frontend/`) → detected correctly
- [ ] Click Play for subdirectory npm app → app starts from correct directory
- [ ] URL is detected and iframe loads the running app
- [ ] Stop button kills the process correctly
- [ ] Verify `node_modules` directories are not scanned

### Edge Cases
- Project with multiple `package.json` files (monorepo) → use first valid one found
- Deeply nested `package.json` (3+ levels deep) → still detected
- `package.json` without runnable scripts in subdirectory → skipped, continues searching

---

## Related Issues

- Related feature: `.prompts/features/2026-02-04-support-running-apps.md`
- Similar pattern: `detect_dotnet_app()` already does recursive search correctly

---

## Fix Implementation (2026-02-05)

### Changes Made

**`src/naide-desktop/src-tauri/src/app_runner.rs`:**
- Extracted script detection into `find_npm_script()` helper for reuse
- Updated `detect_npm_app()` to search recursively:
  - Fast path: checks project root first (no regression)
  - Recursive path: uses new `find_files_by_name()` to find `package.json` in subdirectories
  - Stores relative subdirectory path in `AppInfo.project_file`
- Added `find_files_by_name()` helper (skips `node_modules`, `.git`, `dist`, `build`, `out`, `bin`, `obj`, `.naide`)

**`src/naide-desktop/src-tauri/src/lib.rs`:**
- Updated `start_app` command to compute the correct working directory for npm apps
- When `project_file` (subdirectory) is set, joins it with `project_path` for the npm working directory
- Backward compatible: `project_file: None` still uses project root
