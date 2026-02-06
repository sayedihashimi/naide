---
Status: planned
Area: ui, layout
Created: 2026-02-06
LastUpdated: 2026-02-06
---

# Feature: Left Column Redesign — Remove Navigation, Improve Features, Add Files Section
**Status**: 🟡 PLANNED

## Summary
Redesign the left column of the Generate App screen to:
1. **Remove** the Navigation section entirely (it has no functionality)
2. **Update** the Features section layout (remove unnecessary dividers, add expand/collapse, add bottom divider)
3. **Add** a new Files section below Features for browsing project files with lazy loading

---

## Goals
- Simplify the left column by removing non-functional UI
- Make the Features section visually cleaner
- Give users visibility into their project's file structure without leaving the app
- Keep the file tree lightweight with lazy-loaded, on-demand fetching

---

## Non-Goals
- File editing or viewing from the Files section (future enhancement — will wire to tabs later)
- Full IDE-style file explorer with drag-and-drop, rename, or delete
- File content search or full-text indexing
- Watching for external file changes in real-time (future enhancement)

---

## Current State

The left column (`w-80`, `bg-zinc-900`) has two sections:

1. **Navigation** — Contains three buttons: "Generate" (active), "Activity" (disabled), "Files" (disabled). None have working functionality.
2. **Features** — Contains a heading with bottom border, then `FeatureFilesViewer` component (filter bar, view options gear, file tree, markdown preview in tabs).

**Component structure:**
- `GenerateAppScreen.tsx` — renders left column
- `FeatureFilesViewer.tsx` — manages feature file listing, filtering, view options
- `FeatureFilesList.tsx` — renders tree view with collapsible folders

---

## Changes

### 1. Remove Navigation Section

**Remove entirely:**
```
<!-- DELETE THIS BLOCK -->
<div className="p-4 border-b border-zinc-800">
  <h2>Navigation</h2>
  <nav>
    <button>Generate</button>
    <button disabled>Activity</button>
    <button disabled>Files</button>
  </nav>
</div>
```

The Features section becomes the first (topmost) section in the left column.

---

### 2. Update Features Section

**Layout changes:**
- **Remove** the divider (border-b) on the heading container that appears between the "Features" heading and the filter text box
- **Remove** the divider after the filter text box (if present)
- **Add** an expand/collapse chevron icon to the **left** of the "Features" heading
- **Add** a horizontal divider at the **bottom** of the Features section (after the file list ends)
- **Default state**: Expanded (file list and filter visible)

**Expand/collapse behavior:**
- When collapsed: only the "Features" heading row is visible (with the chevron pointing right)
- When expanded: heading + filter bar + gear icon + file list are all visible (chevron pointing down)
- Clicking the heading row or chevron toggles expand/collapse
- State is in-memory only (resets to expanded on app restart)

**Visual:**
```
Expanded:
▼ FEATURES
  [Filter features...] ⚙
  ▶ bugs/
    add-copilot-integration
    building-mode
    ...
────────────────────────────

Collapsed:
▶ FEATURES
────────────────────────────
```

---

### 3. Add Files Section

Add a new section below the Features section for browsing project files.

**Heading**: "FILES" (same uppercase tracking-wider style as "FEATURES")

**Layout:**
- Expand/collapse chevron to the left of the "Files" heading (same pattern as Features)
- **Default state**: Collapsed
- Below the heading (when expanded): filter text box + file tree
- Filter text box: placeholder "Filter files...", real-time case-insensitive filtering

**File tree behavior:**
- **Lazy loading**: On initial expand, fetch only the **root-level** files and folders
- **On folder expand**: Fetch that folder's immediate children (one level at a time)
- Folders show a chevron (▶/▼) and folder icon; files show a file-type icon
- Folders are expandable/collapsible; clicking toggles children visibility
- Files are clickable but **no action is wired up yet** (future: open in tab)

**Icons:**
- Use file-type-specific icons based on file extension:
  - `.ts`, `.tsx` → TypeScript icon (or blue file icon)
  - `.js`, `.jsx` → JavaScript icon (or yellow file icon)
  - `.json` → JSON icon (or gear/config icon)
  - `.md` → Markdown icon (or document icon)
  - `.rs` → Rust icon (or orange file icon)
  - `.css` → CSS icon (or paint/style icon)
  - `.html` → HTML icon (or globe icon)
  - `.toml`, `.yaml`, `.yml` → Config icon
  - Default → generic file icon
- Folders → folder icon (open when expanded, closed when collapsed)

**Hidden folders/files** (never shown, even if present):
- `node_modules`
- `.git`
- `bin`
- `obj`
- `dist`

**Sorting:**
- Folders first, then files
- Alphabetical within each group (case-insensitive)

**Visual:**
```
Collapsed:
▶ FILES

Expanded:
▼ FILES
  [Filter files...] 
  ▶ 📁 .prompts
  ▶ 📁 src
    📄 package.json
    📄 README.md
    📄 tsconfig.json
```

---

## Technical Implementation

### Backend (Tauri/Rust)

**New command**: `list_project_files`

```rust
#[tauri::command]
async fn list_project_files(
    project_path: String,
    relative_path: Option<String>,  // None = root, Some("src") = src/ contents
) -> Result<Vec<ProjectFileNode>, String>
```

**Return type:**
```rust
#[derive(Serialize)]
struct ProjectFileNode {
    name: String,           // "src", "package.json"
    path: String,           // Relative path from project root: "src", "src/components"
    is_folder: bool,
    file_extension: Option<String>,  // "ts", "json", "md", etc.
}
```

**Logic:**
- Read the directory at `project_path / relative_path` (or project_path if relative_path is None)
- Return **immediate children only** (no recursion)
- Exclude hidden items from the exclusion list (`node_modules`, `.git`, `bin`, `obj`, `dist`)
- Sort: folders first (alphabetical), then files (alphabetical)
- Return the file extension for each file (for icon selection)

### Frontend Components

**New component**: `ProjectFilesViewer.tsx`
- Manages the Files section state
- Handles filter text, expanded/collapsed folders, lazy loading
- Calls `list_project_files` Tauri command on folder expand
- Caches loaded directories to avoid re-fetching on collapse/expand

**New component**: `ProjectFilesList.tsx`
- Renders the file tree with icons
- Recursive tree structure similar to `FeatureFilesList.tsx`
- On folder click: if children not loaded → call backend to fetch, then expand
- On file click: no-op for now (future: open in tab)

**New utility**: `projectFiles.ts` (or extend existing utils)
- `listProjectFiles(projectPath, relativePath?)` — Tauri invoke wrapper
- `getFileIcon(extension)` — returns the appropriate icon component for a file extension

**Modify**: `GenerateAppScreen.tsx`
- Remove Navigation section JSX
- Add expand/collapse state for Features section
- Add `ProjectFilesViewer` component below Features section
- Add bottom divider after Features section

**Modify**: `FeatureFilesViewer.tsx`
- Remove the top border/divider on the heading container
- Accept `isExpanded` and `onToggle` props from parent (or manage internally)

### Icon Strategy

Use Lucide React icons (already a dependency):
- `Folder` / `FolderOpen` for directories
- `FileText` for `.md`
- `FileCode` for `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`
- `FileJson` for `.json`
- `File` for generic/default
- `FileType` or `Palette` for `.css`
- `Globe` for `.html`
- `Settings` for `.toml`, `.yaml`, `.yml`

If Lucide doesn't have all variants, use `File` with a small colored dot or badge to indicate type.

---

## UI/UX Details

### Section Heading Style
Both "FEATURES" and "FILES" sections use:
- `text-xs font-semibold text-gray-500 uppercase tracking-wider`
- Chevron icon (ChevronRight when collapsed, ChevronDown when expanded) to the left
- Entire heading row is clickable to toggle expand/collapse
- Cursor: pointer on heading row

### Filter Text Box (Files)
- Same styling as the Features filter: dark input, placeholder text
- Position: directly below the "FILES" heading when expanded
- Real-time filtering: hides files/folders that don't match (case-insensitive, matches name only)
- When filtering is active, all matching folders are auto-expanded to show matching children

### Divider
- A single `border-b border-zinc-800` divider separates the Features section from the Files section
- No divider above the first section (Features) since Navigation is removed

### Scroll Behavior
- The entire left column is `overflow-hidden` with each section handling its own scroll
- Features file list: scrollable within its allocated space
- Files file tree: scrollable within its allocated space
- When both sections are expanded, they share the available vertical space:
  - Features takes its natural height (up to ~40% of available space)
  - Files takes remaining space
  - Both become independently scrollable if content overflows

### Loading State
- When a folder is being fetched (lazy load), show a small spinner or "Loading..." text inside the folder
- Replace with children once loaded
- Cache results so re-expanding a folder doesn't re-fetch

### Error State
- If `list_project_files` fails: show "Failed to load files" message in the Files section
- If a specific folder fails to load: show error inline under that folder node

---

## Edge Cases

### No Project Open
- Files section shows: "Open a project to see files" (or simply stays collapsed with nothing to show)

### Empty Directory
- Show: "(empty)" in muted text inside the expanded folder

### Very Deep Nesting
- No artificial depth limit — lazy loading naturally handles this since each level is fetched on demand
- Indentation increases per level (left padding)

### Large Directories
- Backend returns all immediate children (no pagination for MVP)
- Frontend renders all; if performance becomes an issue, virtualization can be added later

### Filter With No Matches
- Show: "No matching files" message

---

## Acceptance Criteria

### Navigation Removal
- [ ] Navigation section is completely removed from the left column
- [ ] No "Generate", "Activity", or "Files" buttons remain
- [ ] Features section is the first item in the left column

### Features Section Updates
- [ ] Divider between "Features" heading and filter is removed
- [ ] Divider after filter is removed (if present)
- [ ] Expand/collapse chevron appears to the left of "FEATURES" heading
- [ ] Clicking heading row toggles expand/collapse
- [ ] Default state is **expanded**
- [ ] When collapsed, only the heading row is visible
- [ ] Horizontal divider appears at the bottom of the Features section

### Files Section
- [ ] "FILES" heading appears below the Features section divider
- [ ] Expand/collapse chevron appears to the left of "FILES" heading
- [ ] Default state is **collapsed**
- [ ] When expanded, a filter text box and file tree are visible
- [ ] Filter text box filters files/folders in real-time (case-insensitive)
- [ ] Root-level files/folders load on first expand (lazy)
- [ ] Expanding a folder fetches its immediate children (one level at a time)
- [ ] Loaded directories are cached (re-expanding doesn't re-fetch)
- [ ] Folders show folder icon (open/closed based on state)
- [ ] Files show type-specific icons based on extension
- [ ] `node_modules`, `.git`, `bin`, `obj`, `dist` are never shown
- [ ] Files/folders are sorted: folders first, then files, alphabetical within each
- [ ] Clicking a file does nothing (future: open in tab)
- [ ] Loading state shown while fetching folder contents
- [ ] Error state shown if fetch fails

### General
- [ ] Left column renders correctly with both sections
- [ ] Scrolling works in both sections independently
- [ ] App builds and runs successfully
- [ ] Existing tests pass (or are updated)
- [ ] No console errors or warnings

---

## Files to Create

- `src/naide-desktop/src/components/ProjectFilesViewer.tsx` — Files section container
- `src/naide-desktop/src/components/ProjectFilesList.tsx` — File tree rendering
- `src/naide-desktop/src/utils/projectFiles.ts` — Backend invoke wrappers and icon mapping

## Files to Modify

- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Remove Navigation, add expand/collapse, add Files section
- `src/naide-desktop/src/components/FeatureFilesViewer.tsx` — Remove top divider, support expand/collapse
- `src/naide-desktop/src-tauri/src/lib.rs` — Register `list_project_files` command

## Files to Create (Backend)

- `src/naide-desktop/src-tauri/src/project_files.rs` — Implementation of `list_project_files`

---

## Future Enhancements

### Wire File Click to Tab System
- Single-click or double-click a file to open it in a tab (similar to feature files)
- Requires extending the tab system to support arbitrary files (not just `.prompts/features/`)

### File Watching
- Watch for file system changes and refresh the tree automatically
- Would require extending the existing file watcher infrastructure

### Context Menu
- Right-click on files for: "Open in tab", "Copy path", "Reveal in file explorer"

### File Creation/Deletion
- Create new files or folders from the Files section
- Delete files with confirmation

---

## Related Features
- [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) — Existing Features section
- [2026-02-06-feature-file-tabs.md](./2026-02-06-feature-file-tabs.md) — Tab system (future: wire file clicks)
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) — Main screen layout

---

created by naide
