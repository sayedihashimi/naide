# Feature Files Viewer Implementation

This document describes the implementation of the Feature Files Viewer component for Naide.

## Overview

The Feature Files Viewer displays all feature specification files from `.prompts/features/` in a tree view in the left navigation column. Users can browse, filter, and view feature files directly in the app.

## Architecture

### Backend (Rust/Tauri)

#### Commands

1. **`list_feature_files(project_path: String)`**
   - Scans `.prompts/features/` directory recursively
   - Returns a tree structure of folders and markdown files
   - Parses date prefixes from filenames (YYYY-MM-DD-)
   - Sorts files by date (most recent first)
   - Located in: `src-tauri/src/lib.rs`

2. **`read_feature_file(project_path: String, file_path: String)`**
   - Reads the content of a specific feature file
   - Validates that the path is within `.prompts/features/` (security)
   - Returns file content as a string
   - Located in: `src-tauri/src/lib.rs`

#### Data Structures

```rust
struct FeatureFileNode {
    name: String,          // Display name (without date prefix)
    full_name: String,     // Full filename
    path: String,          // Relative path from .prompts/features/
    date: Option<String>,  // Parsed date (YYYY-MM-DD)
    is_folder: bool,
    children: Option<Vec<FeatureFileNode>>,
}
```

### Frontend (React/TypeScript)

#### Components

1. **`FeatureFilesViewer.tsx`**
   - Main component that orchestrates the feature viewer
   - Manages state for file list, filter, and selected file
   - Loads files when project changes
   - Located in: `src/components/`

2. **`FeatureFilesList.tsx`**
   - Renders the tree view of files and folders
   - Handles folder expand/collapse
   - Highlights selected file
   - Located in: `src/components/`

3. **`MarkdownPreview.tsx`**
   - Displays the rendered markdown content of selected file
   - Reuses `MessageContent` component for markdown rendering
   - Located in: `src/components/`

#### Utilities

**`featureFiles.ts`**
- `listFeatureFiles()` - Calls Tauri command to list files
- `readFeatureFile()` - Calls Tauri command to read file content
- `filterFeatureFiles()` - Client-side filtering logic

## Features

### Date Prefix Handling

Files with date prefixes (e.g., `2026-02-01-feature-name.md`) are:
- Displayed without the date prefix ("feature-name")
- Sorted by date (most recent first)
- Files without date prefixes appear at the bottom

### Filtering

The filter box provides real-time, case-insensitive filtering that:
- Matches against file names (display names)
- Matches against folder names
- Shows folders if they match or contain matching files
- Updates instantly as user types

### Tree Navigation

- Folders can be expanded/collapsed
- Files are displayed with appropriate icons
- Selected file is highlighted
- Folder structure is preserved

## UI Layout

```
┌─────────────────────────────────────┐
│ Navigation (buttons)                │
├─────────────────────────────────────┤
│ Feature Files                       │
│ ┌─────────────────────────────────┐ │
│ │ Filter: [text input]            │ │
│ ├─────────────────────────────────┤ │
│ │ File Tree (scrollable)          │ │
│ │   ▼ bugs/                       │ │
│ │     - fix-issue                 │ │
│ │   - feature-name                │ │
│ ├─────────────────────────────────┤ │
│ │ Markdown Preview (fixed height) │ │
│ │ [rendered markdown content]     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Testing

All components have comprehensive unit tests:

- `FeatureFilesList.test.tsx` - 6 tests
- `MarkdownPreview.test.tsx` - 3 tests
- `featureFiles.test.ts` - 5 tests

Run tests with:
```bash
npm test
```

## Files Modified/Created

### Created Files
- `src/naide-desktop/src/components/FeatureFilesViewer.tsx`
- `src/naide-desktop/src/components/FeatureFilesList.tsx`
- `src/naide-desktop/src/components/MarkdownPreview.tsx`
- `src/naide-desktop/src/utils/featureFiles.ts`
- `src/naide-desktop/src/components/FeatureFilesList.test.tsx`
- `src/naide-desktop/src/components/MarkdownPreview.test.tsx`
- `src/naide-desktop/src/utils/featureFiles.test.ts`

### Modified Files
- `src/naide-desktop/src-tauri/src/lib.rs` - Added Tauri commands
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` - Integrated viewer

## Future Enhancements

The following features are not in the current implementation but could be added:

- Edit feature files in-app
- Create new feature files from template
- Delete/rename files
- Real-time file watching for external changes
- Full-text search within file contents
- Keyboard navigation
- Drag-and-drop to reorganize
