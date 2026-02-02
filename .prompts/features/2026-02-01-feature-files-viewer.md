---
Status: planned
Area: ui, planning
Created: 2026-02-01
LastUpdated: 2026-02-02
---

# Feature: Feature Files Viewer

## Overview
Add a UI component to the left navigation column that displays all feature files from `.prompts/features/`, allowing users to browse and view their contents in a read-only markdown preview.

## Motivation
Users need visibility into what features have been defined in their project. Currently, feature files exist but there's no built-in way to view them without leaving the app or using file system tools.

## User-Facing Behavior

### Location
- **Left navigation column** (appears on all tabs)
- Positioned below the existing Planning/Building/Analyzing tabs
- Separated from the tabs with a visual divider (horizontal line)

### UI Layout
The feature viewer consists of three components stacked vertically:

1. **Filter Box** (top)
   - Text input field
   - Placeholder: "Filter features..."
   - Real-time filtering (case-insensitive)
   - Filters both file names and folder names

2. **File List** (middle)
   - Tree view showing all `.md` files from `.prompts/features/**`
   - **File names displayed without date prefix** (e.g., "add-copilot-integration" instead of "2026-02-01-add-copilot-integration")
   - **Sorted by date with most recent first** (parsed from filename date prefix)
   - Folders are collapsible/expandable
   - Click folder to toggle expand/collapse
   - Click file to view its content below
   - Visual indicators: folder icons, file icons, expand/collapse chevrons

3. **Markdown Preview** (bottom)
   - Shows rendered markdown of selected file
   - Initially empty with message: "Select a feature file to view"
   - Updates when user clicks a different file
   - Proper markdown rendering (headings, lists, code blocks, etc.)

### Interaction Flow
1. User opens the app (viewer is visible in left column on all tabs)
2. User sees a divider line separating the mode tabs from the Feature Files section
3. User sees a list of all feature files organized by folder structure (most recent first)
4. User can type in filter box to narrow down the list
5. User can click folders to expand/collapse them
6. User clicks on a feature file name (displayed without date prefix)
7. Markdown content of that file appears in the preview area below

## Technical Considerations

### Frontend (React/TypeScript)
- New component: `FeatureFilesViewer.tsx`
- Subcomponents:
  - `FeatureFilesList` - tree view with filter
  - `MarkdownPreview` - render markdown content
- State management:
  - List of feature files (path, name, displayName, date, isFolder)
  - Currently selected file
  - Filter text
  - Expanded folder states
- Display logic:
  - Parse date prefix from filename (YYYY-MM-DD-)
  - Remove date prefix for display
  - Sort by parsed date (most recent first)
  - Handle files without date prefix gracefully

### Backend (Tauri)
- New command: `list_feature_files()` - returns file tree structure from `.prompts/features/`
- New command: `read_feature_file(path: String)` - returns file content as string
- File watching (optional future enhancement): detect when feature files are added/removed/changed

### File Discovery
- Scan `.prompts/features/` directory recursively
- Include all `.md` files
- Build tree structure preserving folder hierarchy
- Parse date prefix (YYYY-MM-DD-) from filenames
- Sort by date descending (most recent first), then alphabetically for same date
- Folders remain sorted alphabetically

### Error Handling
- If `.prompts/features/` doesn't exist: show "No features directory found"
- If directory is empty: show "No feature files defined yet"
- If file read fails: show error message in preview area
- Handle markdown rendering errors gracefully

## Constraints
- **Read-only**: No editing, creating, or deleting files in this version
- **Markdown files only**: Only show `.md` files
- **No external links**: Markdown preview should not open external links (or warn before opening)
- **Left column only**: This feature appears in the left navigation column on all tabs
- **Date prefix convention**: Assumes files follow YYYY-MM-DD- naming convention

## Non-Goals (For This Version)
- Editing feature files in-app
- Creating new feature files from UI
- Deleting or renaming files
- Version history or diff view
- Search within file contents (only filter by name)
- Syntax highlighting beyond standard markdown

## Acceptance Criteria
- [ ] Feature Files Viewer section appears in left column on all tabs
- [ ] Visual divider separates mode tabs from Feature Files section
- [ ] All `.md` files from `.prompts/features/` are listed
- [ ] File names displayed without date prefix (e.g., "add-copilot-integration")
- [ ] Files sorted by date (most recent first) based on filename date prefix
- [ ] Folder structure is preserved and navigable
- [ ] Folders can be expanded and collapsed
- [ ] Filter box filters the list in real-time (case-insensitive)
- [ ] Clicking a file shows its markdown content below
- [ ] Markdown is properly rendered (headings, lists, code blocks, emphasis)
- [ ] Empty states are handled (no files, no directory)
- [ ] Error states are handled (file read failure)
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

## Future Enhancements (Not in Scope)
- Edit feature files directly in-app
- Drag-and-drop to reorganize
- Create new feature files from template
- Delete/rename files
- Real-time file watching
- Full-text search within files


created by naide