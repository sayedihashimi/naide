---
Status: planned
Area: ui, planning
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# Feature: Feature Files Viewer

## Overview
Add a UI component to the Planning tab that displays all feature files from `.prompts/features/`, allowing users to browse and view their contents in a read-only markdown preview.

## Motivation
Users need visibility into what features have been defined in their project. Currently, feature files exist but there's no built-in way to view them without leaving the app or using file system tools.

## User-Facing Behavior

### Location
- **Planning tab ONLY** (not on Generate, Activity, or Files tabs)
- Replaces the "Running App" section currently shown on the Planning tab

### UI Layout
The feature viewer consists of three components stacked vertically:

1. **Filter Box** (top)
   - Text input field
   - Placeholder: "Filter features..."
   - Real-time filtering (case-insensitive)
   - Filters both file names and folder names

2. **File List** (middle)
   - Tree view showing all `.md` files from `.prompts/features/**`
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
1. User switches to Planning tab
2. Feature Files Viewer section is visible (replacing "Running App" section)
3. User sees a list of all feature files organized by folder structure
4. User can type in filter box to narrow down the list
5. User can click folders to expand/collapse them
6. User clicks on a feature file name
7. Markdown content of that file appears in the preview area below

## Technical Considerations

### Frontend (React/TypeScript)
- New component: `FeatureFilesViewer.tsx`
- Subcomponents:
  - `FeatureFilesList` - tree view with filter
  - `MarkdownPreview` - render markdown content
- State management:
  - List of feature files (path, name, isFolder)
  - Currently selected file
  - Filter text
  - Expanded folder states

### Backend (Tauri)
- New command: `list_feature_files()` - returns file tree structure from `.prompts/features/`
- New command: `read_feature_file(path: String)` - returns file content as string
- File watching (optional future enhancement): detect when feature files are added/removed/changed

### File Discovery
- Scan `.prompts/features/` directory recursively
- Include all `.md` files
- Build tree structure preserving folder hierarchy
- Sort alphabetically (folders first, then files)

### Error Handling
- If `.prompts/features/` doesn't exist: show "No features directory found"
- If directory is empty: show "No feature files defined yet"
- If file read fails: show error message in preview area
- Handle markdown rendering errors gracefully

## Constraints
- **Read-only**: No editing, creating, or deleting files in this version
- **Markdown files only**: Only show `.md` files
- **No external links**: Markdown preview should not open external links (or warn before opening)
- **Planning tab only**: This feature should not appear on other tabs

## Non-Goals (For This Version)
- Editing feature files in-app
- Creating new feature files from UI
- Deleting or renaming files
- Version history or diff view
- Search within file contents (only filter by name)
- Syntax highlighting beyond standard markdown

## Acceptance Criteria
- [ ] Feature Files Viewer section appears on Planning tab only
- [ ] "Running App" section is removed from Planning tab
- [ ] All `.md` files from `.prompts/features/` are listed
- [ ] Folder structure is preserved and navigable
- [ ] Folders can be expanded and collapsed
- [ ] Filter box filters the list in real-time (case-insensitive)
- [ ] Clicking a file shows its markdown content below
- [ ] Markdown is properly rendered (headings, lists, code blocks, emphasis)
- [ ] Empty states are handled (no files, no directory)
- [ ] Error states are handled (file read failure)
- [ ] UI is responsive and performs well with 50+ files

## Affected Specs & Components
- **UI Spec**: Update to document Planning tab layout change
- **App Spec**: Add this feature to the features list
- **Frontend**: 
  - Modify Planning tab component to include `FeatureFilesViewer`
  - Remove "Running App" section from Planning tab
  - Create new `FeatureFilesViewer` component
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
