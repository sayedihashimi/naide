---
Status: shipped
Area: ui, planning
Created: 2026-02-01
LastUpdated: 2026-02-03
---

# Feature: Feature Files Viewer
**Status**: ✅ IMPLEMENTED

## Overview
Add a UI component to the left navigation column that displays all feature files from `.prompts/features/`, allowing users to browse and view their contents in a markdown preview with advanced filtering options and optional editing capabilities.

## Motivation
Users need visibility into what features have been defined in their project. Currently, feature files exist but there's no built-in way to view them without leaving the app or using file system tools. Enhanced viewing options and editing capabilities will make the feature more powerful for managing project specifications.

## User-Facing Behavior

### Location
- **Left navigation column** (appears on all tabs)
- Positioned below the existing Planning/Building/Analyzing tabs
- Separated from the tabs with a visual divider (horizontal line)

### UI Layout
The feature viewer consists of four components stacked vertically:

1. **Filter Bar** (top)
   - Text input field with placeholder: "Filter features..."
   - Real-time filtering (case-insensitive)
   - Filters both file names and folder names
   - **View Options Gear Icon** (right side of filter bar)
     - Clicking opens a dropdown menu with view options:
       - ☐ Show bugs (include files from `bugs/` folder)
       - ☐ Show removed features (include files from `removed-features/` folder)
       - ☐ Show raw filenames (display with date prefixes like "2026-02-01-name")
     - Options persist across sessions
     - Menu closes when clicking outside

2. **File List** (middle - approximately 30% of available vertical space)
   - Tree view showing all `.md` files from `.prompts/features/**`
   - **File names displayed without date prefix by default** (e.g., "add-copilot-integration")
   - **Raw filename mode** shows complete filenames with date prefixes
   - **Sorted by date with most recent first** (parsed from filename date prefix)
   - Folders are collapsible/expandable
   - Click folder to toggle expand/collapse
   - Click file to view its content below
   - Visual indicators: folder icons, file icons, expand/collapse chevrons
   - Includes `bugs/` and `removed-features/` folders when respective options are enabled

3. **Markdown Preview** (bottom - approximately 70% of available vertical space)
   - Shows rendered markdown of selected file
   - Initially empty with message: "Select a feature file to view"
   - Updates when user clicks a different file
   - Proper markdown rendering (headings, lists, code blocks, etc.)
   - **Edit Mode Toggle** (top-right of preview area)
     - Icon button (pencil/edit icon)
     - Default state: Read-only (view mode)
     - When clicked: Switches to edit mode with textarea
     - In edit mode:
       - Raw markdown content displayed in textarea
       - Save button becomes visible
       - Cancel button to discard changes
       - Auto-saves on Ctrl+S/Cmd+S
     - After saving: Returns to read-only view mode

### Interaction Flow
1. User opens the app (viewer is visible in left column on all tabs)
2. User sees a divider line separating the mode tabs from the Feature Files section
3. User sees a list of all feature files organized by folder structure (most recent first)
4. User can type in filter box to narrow down the list
5. User can click the gear icon to toggle view options (bugs, removed features, raw filenames)
6. User can click folders to expand/collapse them
7. User clicks on a feature file name (displayed without date prefix by default)
8. Markdown content of that file appears in the preview area below
9. User can click the edit icon to switch to edit mode
10. In edit mode, user can modify the content and save changes
11. After saving, view returns to read-only preview mode

## Technical Considerations

### Frontend (React/TypeScript)
- New component: `FeatureFilesViewer.tsx`
- Subcomponents:
  - `ViewOptionsMenu` - gear icon dropdown with checkboxes
  - `FeatureFilesList` - tree view with filter
  - `MarkdownPreview` - render markdown content or edit textarea
- State management:
  - List of feature files (path, name, displayName, date, isFolder)
  - Currently selected file
  - Filter text
  - Expanded folder states
  - View options (show bugs, show removed, show raw filenames)
  - Edit mode state (isEditing, edited content, has changes)
- Display logic:
  - Parse date prefix from filename (YYYY-MM-DD-)
  - Remove date prefix for display (unless raw mode enabled)
  - Sort by parsed date (most recent first)
  - Handle files without date prefix gracefully
- View options persistence:
  - Store in localStorage or app settings
  - Restore on component mount

### Backend (Tauri)
- New command: `list_feature_files(options: ViewOptions)` - returns file tree structure from `.prompts/features/`
  - `ViewOptions` struct includes: show_bugs, show_removed, show_raw
- New command: `read_feature_file(path: String)` - returns file content as string
- New command: `write_feature_file(path: String, content: String)` - writes content to feature file
  - Validates path is within `.prompts/features/**`
  - Returns success/error status
- File watching (optional future enhancement): detect when feature files are added/removed/changed

### File Discovery
- Scan `.prompts/features/` directory recursively
- Include all `.md` files
- Conditionally include:
  - `bugs/` subfolder when "Show bugs" is enabled
  - `removed-features/` subfolder when "Show removed features" is enabled
- Build tree structure preserving folder hierarchy
- Parse date prefix (YYYY-MM-DD-) from filenames
- Sort by date descending (most recent first), then alphabetically for same date
- Folders remain sorted alphabetically
- Display filename with or without date prefix based on "Show raw filenames" setting

### Error Handling
- If `.prompts/features/` doesn't exist: show "No features directory found"
- If directory is empty: show "No feature files defined yet"
- If file read fails: show error message in preview area
- Handle markdown rendering errors gracefully

## Constraints
- **Read-only by default**: Files are read-only unless user explicitly enables edit mode
- **Edit within allowed paths**: Can only edit files within `.prompts/features/**`
- **Markdown files only**: Only show `.md` files
- **No external links**: Markdown preview should not open external links (or warn before opening)
- **Left column only**: This feature appears in the left navigation column on all tabs
- **Date prefix convention**: Assumes files follow YYYY-MM-DD- naming convention
- **No file creation/deletion**: Can view and edit existing files, but not create new ones or delete

## Non-Goals (For This Version)
- Creating new feature files from UI
- Deleting or renaming files
- Version history or diff view
- Search within file contents (only filter by name)
- Syntax highlighting in edit mode (plain textarea)
- Preview while editing (must save to see rendered output)

## Acceptance Criteria

### Phase 1: View Options & Filtering
- [ ] Gear icon appears in filter bar (right side)
- [ ] Clicking gear opens dropdown menu with three checkboxes
- [ ] "Show bugs" checkbox toggles visibility of `bugs/` folder contents
- [ ] "Show removed features" checkbox toggles visibility of `removed-features/` folder contents
- [ ] "Show raw filenames" checkbox toggles date prefix display
- [ ] View options persist across app sessions
- [ ] Menu closes when clicking outside

### Phase 2: Improved Layout
- [ ] File list takes ~30% of vertical space (with minimum height)
- [ ] Markdown preview takes ~70% of vertical space
- [ ] Layout is responsive and resizes properly
- [ ] Scrolling works correctly in both sections

### Phase 3: Edit Mode
- [ ] Edit icon (pencil) appears in top-right of preview area
- [ ] Clicking edit icon switches to edit mode with textarea
- [ ] Textarea shows raw markdown content
- [ ] Save and Cancel buttons appear in edit mode
- [ ] Ctrl+S/Cmd+S triggers save
- [ ] Save writes changes to file and returns to view mode
- [ ] Cancel discards changes and returns to view mode
- [ ] Unsaved changes warning (if navigating away)

### Core Functionality (Existing)
- [ ] Feature Files Viewer section appears in left column on all tabs
- [ ] Visual divider separates mode tabs from Feature Files section
- [ ] All `.md` files from `.prompts/features/` are listed
- [ ] File names displayed without date prefix by default
- [ ] Files sorted by date (most recent first) based on filename date prefix
- [ ] Folder structure is preserved and navigable
- [ ] Folders can be expanded and collapsed
- [ ] Filter box filters the list in real-time (case-insensitive)
- [ ] Clicking a file shows its markdown content below
- [ ] Markdown is properly rendered (headings, lists, code blocks, emphasis)
- [ ] Empty states are handled (no files, no directory)
- [ ] Error states are handled (file read failure, write failure)
- [ ] UI is responsive and performs well with 50+ files
- [ ] Files without date prefix are handled gracefully (shown at bottom)

## Affected Specs & Components
- **UI Spec**: Update to document left column layout change
- **App Spec**: Add this feature to the features list
- **Frontend**: 
  - Modify left navigation component to include `FeatureFilesViewer`
  - Add visual divider above Feature Files section
  - Create new `FeatureFilesViewer` component
  - Implement date prefix parsing and display name logic
  - Implement date-based sorting (most recent first)
- **Backend**: 
  - Add Tauri commands for file listing and reading
  - Ensure proper path resolution for `.prompts/features/`

## Future Enhancements (Deferred)

### Favorites & Recently Viewed
- **Favorites**: Allow users to mark features as favorites
  - Starred icon next to file names
  - Favorites appear at top of list
  - Persist favorite status across sessions
  
- **Recently Viewed**: Track last 5 viewed feature files
  - Appear after favorites but before full list
  - Auto-update based on file selection
  - Configurable list size (future setting)
  - Clear history option

### Other Future Ideas
- Drag-and-drop to reorganize files
- Create new feature files from template
- Delete/rename files via UI
- Real-time file watching (auto-refresh on external changes)
- Full-text search within files
- Side-by-side markdown preview while editing
- Syntax highlighting in edit mode
- File revision history


created by naide