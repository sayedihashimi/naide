# Feature: Recent Projects Dropdown

## Overview
Enhance the project switcher UI to show a dropdown list of recent projects when clicking the current project button, and add a separate "Open Project" button for browsing to a new folder.

## Current Behavior
- Single button in header displays current project name with folder icon
- Clicking the button opens a directory browser dialog to select a different project folder
- Only the last used project is tracked in settings (`last_used_project` in `GlobalSettings`)
- Located in `GenerateAppScreen.tsx` (lines 391-410)

## Desired Behavior

### Project Button Dropdown
- Clicking the current project button opens a dropdown menu below it
- Dropdown displays a list of recently opened projects (sorted by most recent first)
- Each project item shows:
  - Project name
  - Optionally: project path (truncated if needed)
- Clicking a project in the list:
  - Loads that project (calls `loadProject()`)
  - Updates the current project name
  - Resets chat history (maintains existing behavior)
  - Closes the dropdown

### New "Open Project" Button
- Icon-only button (no text label)
- Positioned to the right of the current project button
- Shows folder/browse icon (e.g., folder-open or similar)
- Clicking opens the directory browser dialog (existing `handleOpenProjectFolder` logic)
- Tooltip: "Open a different project folder"

## Technical Requirements

### Backend Changes (Rust)
**File:** `src-tauri/src/settings.rs`

1. **Extend `GlobalSettings` struct:**
   - Add `recent_projects: Vec<LastProject>` field
   - Keep existing `last_used_project` for backward compatibility

2. **Add tracking logic:**
   - When a project is opened, add/update it in `recent_projects`
   - Maintain most recent timestamp
   - Remove duplicates (same path)
   - Limit list to 10 most recent projects
   - Sort by `last_accessed` timestamp (descending)

3. **Add Tauri commands:**
   - `get_recent_projects() -> Vec<LastProject>` - Returns sorted list
   - `add_recent_project(path: String)` - Adds/updates project in history

### Frontend Changes

**File:** `src/GenerateAppScreen.tsx`

1. **State Management:**
   - Add state for dropdown visibility: `showRecentProjects: boolean`
   - Add state for recent projects list: `recentProjects: Array<{path: string, name: string, lastAccessed: number}>`

2. **Fetch Recent Projects:**
   - On component mount, call `get_recent_projects()` Tauri command
   - Store in state

3. **Update UI Layout:**
   - Split current button into two:
     - **Left:** Current project button (opens dropdown)
     - **Right:** Open project button (icon only, opens directory browser)
   - Use flex layout to position them side by side

4. **Dropdown Component:**
   - Position absolutely below the project button
   - Show/hide based on `showRecentProjects` state
   - Close when clicking outside (use ref + click handler)
   - Map over `recentProjects` to render list items
   - Style: dark theme consistent with existing UI (zinc-800/700)

5. **Event Handlers:**
   - `handleProjectButtonClick()` - Toggles dropdown visibility
   - `handleSelectRecentProject(path)` - Loads selected project, closes dropdown
   - `handleOpenProjectFolder()` - Existing logic, moved to new button

## UI/UX Considerations

- **Dropdown styling:** Match existing app theme (dark mode, zinc colors)
- **Empty state:** If no recent projects, show "No recent projects" message
- **Accessibility:** 
  - Proper ARIA labels for buttons
  - Keyboard navigation (arrow keys, escape to close)
  - Focus management
- **Click outside:** Clicking outside dropdown should close it
- **Animation:** Optional subtle fade-in/out for dropdown

## Dependencies

- No new packages required
- Uses existing `@tauri-apps/plugin-dialog` for folder picker
- Uses existing Tauri command infrastructure

## Testing Checklist

- [ ] Recent projects list loads on app start
- [ ] Clicking project button toggles dropdown
- [ ] Recent projects are sorted correctly (most recent first)
- [ ] Selecting a project from dropdown loads it correctly
- [ ] Chat history resets when switching projects
- [ ] New "Open Project" button opens directory browser
- [ ] Adding a new project updates the recent list
- [ ] Duplicate projects are handled (only one entry per path)
- [ ] List is limited to 10 projects
- [ ] Clicking outside dropdown closes it
- [ ] Keyboard navigation works (ESC to close)
- [ ] Settings persist across app restarts

## Files to Modify

### Backend
- `src-tauri/src/settings.rs` - Add recent projects tracking
- `src-tauri/src/lib.rs` - Add new Tauri commands

### Frontend
- `src/GenerateAppScreen.tsx` - Update project switcher UI
- Optionally: Create separate `ProjectSwitcher.tsx` component if logic becomes complex

## Future Enhancements (Out of Scope)

- Pin favorite projects
- Remove/delete projects from recent list
- Show project metadata (last modified, file count)
- Categorize or tag projects
- Search/filter recent projects

created by naide
