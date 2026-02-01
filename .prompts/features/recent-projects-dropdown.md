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

## Implementation Notes

### Completed Changes

**Backend (Rust):**
- Updated `src-tauri/src/settings.rs`:
  - Added `recent_projects: Vec<LastProject>` field to `GlobalSettings` struct
  - Implemented `add_recent_project()` function to manage the recent projects list:
    - Removes duplicates (case-insensitive on Windows)
    - Adds new project at the beginning (most recent first)
    - Limits list to 10 most recent projects
  - Implemented `get_recent_projects()` function to retrieve the list
  - Added comprehensive unit tests for the new functionality

- Updated `src-tauri/src/lib.rs`:
  - Refactored to use the `settings` module instead of duplicate code
  - Modified `save_last_project` command to also add projects to recent list
  - Added `get_recent_projects` Tauri command
  - Added `add_recent_project_cmd` Tauri command
  - Registered new commands in the invoke handler

**Frontend (TypeScript/React):**
- Updated `src/utils/globalSettings.ts`:
  - Added `getRecentProjects()` function
  - Added `addRecentProject()` function
  - Added corresponding unit tests

- Updated `src/pages/GenerateAppScreen.tsx`:
  - Added state management for dropdown visibility and recent projects list
  - Added `useEffect` hook to load recent projects on component mount
  - Added `useEffect` hook for click-outside handler to close dropdown
  - Implemented `handleToggleDropdown()` to show/hide dropdown
  - Implemented `handleSelectRecentProject()` to switch to a selected project
  - Updated `handleOpenProjectFolder()` to reload recent projects after opening
  - Split project button into two buttons:
    - **Left button**: Shows current project name with dropdown arrow, opens dropdown
    - **Right button**: Icon-only "Open folder" button, opens directory browser
  - Implemented dropdown component:
    - Positioned absolutely below project button
    - Shows list of recent projects with name and path
    - Displays "No recent projects" when list is empty
    - Dark theme styling consistent with app (zinc colors)
    - Auto-closes when clicking outside
    - Updates list after project selection

### Key Design Decisions

1. **Case-insensitive path comparison on Windows**: The backend removes duplicate projects using case-insensitive comparison on Windows to handle different case variations of the same path.

2. **Automatic list management**: When a project is opened via `save_last_project`, it's automatically added to the recent projects list, so no manual tracking is needed.

3. **Non-fatal errors**: Both backend and frontend handle errors gracefully, logging them but not throwing, to prevent disrupting the user experience.

4. **State synchronization**: The recent projects list is reloaded after any project operation (open folder, select from dropdown) to ensure the UI stays in sync with the backend.

5. **Backward compatibility**: The `last_used_project` field is retained in settings for backward compatibility, even though recent projects now provides similar functionality.

### Testing Recommendations

- [x] Backend unit tests pass for recent projects logic
- [x] Frontend unit tests added for new API functions
- [ ] Manual testing required (requires full Tauri environment):
  - Open multiple projects and verify they appear in dropdown
  - Verify projects are sorted by most recent first
  - Test switching between projects via dropdown
  - Test opening new project via "Open folder" button
  - Verify dropdown closes when clicking outside
  - Confirm settings persist across app restarts
  - Test limit of 10 projects

created by naide

