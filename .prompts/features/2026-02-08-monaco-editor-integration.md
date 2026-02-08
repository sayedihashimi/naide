---
Status: planned
Area: ui, editor
Created: 2026-02-08
LastUpdated: 2026-02-08
---

# Feature: Monaco Editor Integration
**Status**: 🟡 PLANNED

## Summary
Integrate the [Monaco Editor](https://github.com/microsoft/monaco-editor) into Naide's tab system to replace the plain `<textarea>` used for editing files. Monaco provides syntax highlighting, line numbers, and a professional editing experience consistent with VS Code.

**Key behavior:**
- **Markdown files (.md)**: Preview mode shows rendered markdown (current behavior). Edit mode opens Monaco editor.
- **Code/text files (all non-.md)**: Preview mode shows Monaco in **read-only** mode (with syntax highlighting and line numbers). Edit mode switches Monaco to **read-write**.
- **File size limit**: Only open files smaller than **1 MB**.

---

## Goals
- Replace the plain `<textarea>` with Monaco editor for all file editing
- Provide syntax highlighting and line numbers in both read-only and edit modes
- Keep rendered markdown preview for `.md` files in view mode
- Maintain all existing keyboard shortcuts (Ctrl+S to save, ESC to cancel)
- Match Naide's dark theme

---

## Non-Goals
- IntelliSense / autocomplete (future enhancement)
- Multi-cursor editing features (available by default in Monaco, no custom work needed)
- Minimap (disable for MVP to save space; can enable later)
- Find/replace UI beyond Monaco's built-in (Ctrl+F works by default)
- File creation or deletion from the editor
- Split editor / side-by-side view
- Custom language support or LSP integration

---

## Problem Statement
Currently, Naide uses a plain `<textarea>` for editing files in both `FeatureFileTab` and `ProjectFileTab`. This provides no syntax highlighting, no line numbers, and a poor editing experience — especially for code files. Non-professional developers benefit from visual cues like syntax coloring to understand file structure, and line numbers to reference specific locations.

Monaco Editor is the same editor that powers VS Code, making it a natural fit for a development-adjacent tool like Naide. It provides a rich editing experience out of the box.

---

## Core Behavior

### File Type Behavior Matrix

| File Extension | Preview Mode | Edit Mode |
|---------------|-------------|-----------|
| `.md` | Rendered markdown (MarkdownPreview) | Monaco editor (language: `markdown`) |
| `.ts`, `.tsx` | Monaco read-only (language: `typescript`) | Monaco read-write |
| `.js`, `.jsx` | Monaco read-only (language: `javascript`) | Monaco read-write |
| `.json` | Monaco read-only (language: `json`) | Monaco read-write |
| `.cs` | Monaco read-only (language: `csharp`) | Monaco read-write |
| `.rs` | Monaco read-only (language: `rust`) | Monaco read-write |
| `.css` | Monaco read-only (language: `css`) | Monaco read-write |
| `.html` | Monaco read-only (language: `html`) | Monaco read-write |
| `.yaml`, `.yml` | Monaco read-only (language: `yaml`) | Monaco read-write |
| `.toml` | Monaco read-only (language: `toml`) | Monaco read-write |
| `.xml`, `.csproj` | Monaco read-only (language: `xml`) | Monaco read-write |
| `.sh`, `.bash` | Monaco read-only (language: `shell`) | Monaco read-write |
| `.py` | Monaco read-only (language: `python`) | Monaco read-write |
| `.sql` | Monaco read-only (language: `sql`) | Monaco read-write |
| All other text | Monaco read-only (language: `plaintext`) | Monaco read-write |

### File Size Limit
- **Maximum file size**: 1 MB (1,048,576 bytes)
- Files exceeding this limit show a message: "This file is too large to open (> 1 MB)."
- The size check happens **before** reading file content
- Requires a new backend command to check file size without reading the full content

### FeatureFileTab Behavior (`.md` files only)
- **Preview mode** (default): Rendered markdown via `MarkdownPreview` — **no change** from current behavior
- **Edit mode** (click Edit button): Monaco editor replaces the current `<textarea>`
  - Language: `markdown`
  - Theme: Naide dark theme
  - Save/Cancel toolbar remains above the editor
  - Ctrl+S saves, ESC cancels — same as today

### ProjectFileTab Behavior (any file type)
- **Markdown files (.md)**:
  - Preview mode: Rendered markdown via `MarkdownPreview` (new — currently shows `<pre>` text)
  - Edit mode: Monaco editor (language: `markdown`)
- **Code/text files (non-.md)**:
  - Preview mode: Monaco editor in **read-only** mode with syntax highlighting and line numbers
  - Edit mode: Monaco editor switches to **read-write** mode
  - The transition from read-only to read-write should feel seamless (no flicker, same scroll position)

### Edit Button Behavior
- For `.md` files: Edit button appears in toolbar (same as today)
- For code files: Edit button appears in toolbar. In preview, Monaco is read-only. Clicking Edit enables editing.
- Visual distinction: when in read-only mode, the Edit button and a "Read-only" badge are visible

---

## Technical Implementation

### Package Selection

**Package**: `@monaco-editor/react` (React wrapper for Monaco Editor)

**Why this package:**
- Official React wrapper maintained by the Monaco team
- Handles Monaco lifecycle (mount/unmount) properly with React
- Supports lazy loading (Monaco bundles are ~2-3MB)
- Simple API: `<Editor />` component with `value`, `language`, `theme`, `options` props
- Well-maintained, widely used (10M+ weekly npm downloads)

**Bundling strategy:**
- `@monaco-editor/react` loads Monaco from CDN by default
- For a Tauri desktop app, configure Monaco to load from local bundle using `loader.config()`
- Install both `@monaco-editor/react` and `monaco-editor` as dependencies
- Configure the loader to use the local `monaco-editor` package

```typescript
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });
```

**Dependencies to install:**
```bash
cd src/naide-desktop
npm install @monaco-editor/react monaco-editor
```

### New Component: `MonacoEditorWrapper.tsx`

Create a reusable wrapper component that encapsulates Monaco configuration:

```typescript
// src/naide-desktop/src/components/MonacoEditorWrapper.tsx

interface MonacoEditorWrapperProps {
  value: string;
  language: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}
```

**Responsibilities:**
- Configure Monaco loader to use local bundle (not CDN)
- Apply Naide dark theme
- Set standard options (line numbers, font, word wrap, minimap off)
- Handle value changes and forward to parent
- Manage editor lifecycle (mount/unmount)

**Editor Options (MVP):**
```typescript
const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: props.readOnly,
  minimap: { enabled: false },
  lineNumbers: 'on',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,    // Auto-resize when container changes
  tabSize: 2,
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
};
```

### Theme Configuration

Define a custom Naide dark theme that matches the app's zinc color palette:

```typescript
monaco.editor.defineTheme('naide-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],       // Inherit all syntax highlighting from vs-dark
  colors: {
    'editor.background': '#18181b',          // zinc-900
    'editor.foreground': '#f4f4f5',          // zinc-100
    'editorLineNumber.foreground': '#71717a', // zinc-500
    'editorLineNumber.activeForeground': '#a1a1aa', // zinc-400
    'editor.selectionBackground': '#3f3f46',  // zinc-700
    'editor.lineHighlightBackground': '#27272a', // zinc-800
    'editorCursor.foreground': '#3b82f6',     // blue-500
    'editorWidget.background': '#27272a',     // zinc-800
    'editorWidget.border': '#3f3f46',         // zinc-700
    'input.background': '#27272a',            // zinc-800
    'input.border': '#3f3f46',                // zinc-700
    'dropdown.background': '#27272a',         // zinc-800
    'dropdown.border': '#3f3f46',             // zinc-700
  },
});
```

This ensures the Monaco editor blends seamlessly with Naide's existing dark UI.

### Language Detection Utility

Create a utility function to map file extensions to Monaco language identifiers:

```typescript
// src/naide-desktop/src/utils/languageDetection.ts

export function getMonacoLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'md': 'markdown',
    'cs': 'csharp',
    'rs': 'rust',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'htm': 'html',
    'xml': 'xml',
    'csproj': 'xml',
    'sln': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'sh': 'shell',
    'bash': 'shell',
    'py': 'python',
    'sql': 'sql',
    'go': 'go',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'r': 'r',
    'dockerfile': 'dockerfile',
    'gitignore': 'plaintext',
    'env': 'plaintext',
    'log': 'plaintext',
    'txt': 'plaintext',
    'lock': 'plaintext',
  };
  
  // Check full filename for special cases
  const fullNameMap: Record<string, string> = {
    'Dockerfile': 'dockerfile',
    'Makefile': 'plaintext',
    'Cargo.toml': 'toml',
    'Cargo.lock': 'toml',
  };
  
  return fullNameMap[fileName] || languageMap[ext] || 'plaintext';
}

export function isMarkdownFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.md');
}
```

### File Size Check

**Backend command**: `get_file_size`

```rust
#[tauri::command]
async fn get_file_size(project_path: String, relative_path: String) -> Result<u64, String> {
    let full_path = Path::new(&project_path).join(&relative_path);
    
    // Security: ensure path is within project
    let canonical = full_path.canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    let project_canonical = Path::new(&project_path).canonicalize()
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;
    
    if !canonical.starts_with(&project_canonical) {
        return Err("Path is outside project directory".to_string());
    }
    
    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    Ok(metadata.len())
}
```

**Frontend usage:**
```typescript
const MAX_FILE_SIZE = 1_048_576; // 1 MB

const fileSize = await invoke<number>('get_file_size', { projectPath, relativePath: filePath });
if (fileSize > MAX_FILE_SIZE) {
  setLoadError(`This file is too large to open (${formatFileSize(fileSize)} > 1 MB)`);
  return;
}
```

### Changes to FeatureFileTab.tsx

**Edit mode only** — replace `<textarea>` with `MonacoEditorWrapper`:

```diff
- <textarea
-   value={editedContent}
-   onChange={handleContentChange}
-   className="flex-1 p-4 bg-zinc-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
-   placeholder="Enter markdown content..."
- />
+ <div className="flex-1">
+   <MonacoEditorWrapper
+     value={editedContent}
+     language="markdown"
+     readOnly={false}
+     onChange={(value) => {
+       setEditedContent(value);
+       setHasUnsavedChanges(value !== fileContent);
+     }}
+   />
+ </div>
```

**Preview mode**: No change — continues to use `MarkdownPreview`.

### Changes to ProjectFileTab.tsx

More significant changes since behavior varies by file type:

**Preview mode for `.md` files**: Show `MarkdownPreview` (currently shows `<pre>` text)

**Preview mode for non-`.md` files**: Show `MonacoEditorWrapper` in read-only mode

**Edit mode for all files**: Show `MonacoEditorWrapper` in read-write mode

```tsx
// Simplified rendering logic
{loadError ? (
  <ErrorDisplay message={loadError} />
) : isEditing ? (
  <div className="flex-1">
    <MonacoEditorWrapper
      value={editedContent}
      language={getMonacoLanguage(fileName)}
      readOnly={false}
      onChange={(value) => {
        setEditedContent(value);
        setHasUnsavedChanges(value !== fileContent);
      }}
    />
  </div>
) : isMarkdownFile(fileName) ? (
  <div className="flex-1 overflow-y-auto">
    <MarkdownPreview content={fileContent} fileName={fileName} onEdit={handleToggleEdit} canEdit={!!fileContent} />
  </div>
) : (
  <div className="flex-1">
    <MonacoEditorWrapper
      value={fileContent || ''}
      language={getMonacoLanguage(fileName)}
      readOnly={true}
    />
  </div>
)}
```

**Add MarkdownPreview import** to ProjectFileTab (currently not imported).

### Vite Configuration

Monaco Editor requires special Vite configuration for web workers:

```typescript
// vite.config.ts - add Monaco worker configuration
import { defineConfig } from 'vite';

export default defineConfig({
  // ... existing config
  optimizeDeps: {
    include: ['monaco-editor'],
  },
});
```

If web workers don't load properly in Tauri, an alternative is to use the `@monaco-editor/react` loader with the bundled `monaco-editor` package, which handles worker setup internally.

---

## UI/UX Details

### Editor Appearance
- **Background**: zinc-900 (`#18181b`) — matches Naide panels
- **Font**: JetBrains Mono (same as existing monospace text)
- **Font size**: 14px
- **Line numbers**: On (zinc-500 color, zinc-400 for active line)
- **Minimap**: Off (save horizontal space)
- **Word wrap**: On (prevent horizontal scrolling for prose files)
- **Cursor**: Blue (blue-500) to match Naide's accent color

### Read-Only Visual Indicators
When Monaco is in read-only mode (preview of code files):
- A subtle "Read-only" badge in the toolbar (next to the Edit button)
- The cursor style changes to default (not text insertion)
- The editor background can be very slightly different (optional, may not be needed)

### Toolbar States

**Preview mode (.md file):**
```
┌─────────────────────────────────────────────────────────────┐
│ .prompts/features/some-feature.md                    [Edit] │
├─────────────────────────────────────────────────────────────┤
│ [Rendered markdown content]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Preview mode (code file):**
```
┌─────────────────────────────────────────────────────────────┐
│ src/components/App.tsx              Read-only         [Edit] │
├─────────────────────────────────────────────────────────────┤
│ 1 │ import React from 'react';                              │
│ 2 │ import { useState } from 'react';                       │
│ 3 │                                                         │
│ 4 │ const App: React.FC = () => {                           │
└─────────────────────────────────────────────────────────────┘
```

**Edit mode (any file):**
```
┌─────────────────────────────────────────────────────────────┐
│ src/components/App.tsx    Editing        [Cancel]    [Save] │
├─────────────────────────────────────────────────────────────┤
│ 1 │ import React from 'react';                              │
│ 2 │ import { useState } from 'react';                       │
│ 3 │                                     ← cursor here       │
└─────────────────────────────────────────────────────────────┘
```

### Loading State
Monaco takes a moment to initialize on first load (~500ms). Show a loading placeholder:
- Centered text: "Loading editor..." with a subtle spinner
- Same background color as the editor (zinc-900) to prevent flash

The `@monaco-editor/react` package provides a `loading` prop for this:
```tsx
<Editor loading={<EditorLoadingPlaceholder />} ... />
```

---

## Keyboard Shortcuts

All existing shortcuts continue to work:
- **Ctrl+S / Cmd+S**: Save file (in edit mode)
- **ESC**: Cancel editing (return to preview mode)

Monaco's built-in shortcuts also work automatically:
- **Ctrl+F / Cmd+F**: Find
- **Ctrl+H / Cmd+H**: Find and replace (edit mode only)
- **Ctrl+Z / Cmd+Z**: Undo
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo
- **Ctrl+/ / Cmd+/**: Toggle line comment (edit mode only)

**Shortcut conflicts to handle:**
- Ctrl+S is intercepted by the tab component before reaching Monaco — this is correct behavior (triggers save)
- ESC is intercepted by the tab component — this is correct behavior (triggers cancel)

---

## Error Handling

### File Too Large
- Show message: "This file is too large to open (X MB > 1 MB limit)"
- No editor loaded, no content fetched
- Edit button hidden

### Binary Files
- If file content contains null bytes or is not valid UTF-8, the backend `read_project_file` already returns an error
- Show: "This file cannot be displayed (binary or unsupported encoding)"

### Monaco Load Failure
- If Monaco fails to initialize (rare):
  - Show fallback: the current `<textarea>` approach as a degraded experience
  - Log error for debugging

### File Read/Write Errors
- Same handling as current implementation (error message in content area)
- No changes needed

---

## Edge Cases

### Tab Switching with Monaco
- Monaco editor state (scroll position, selection) is preserved when switching tabs because tabs use `display: none/flex` (not unmounting)
- The `automaticLayout: true` option ensures Monaco resizes correctly when a tab becomes visible again

### Unsaved Changes Detection
- Monaco's `onChange` callback fires on every edit
- Compare current Monaco value with original `fileContent` to detect unsaved changes
- Same logic as current textarea, just different event source

### Read-Only to Edit Mode Transition
- When switching from read-only to edit mode for a code file:
  - Ideally, update the Monaco `readOnly` option without unmounting
  - If using the same `<Editor>` component, changing the `options.readOnly` prop should work
  - Preserve scroll position and cursor position during the transition

### File Renamed or Deleted Externally
- Same handling as current implementation: show error on next reload
- No additional Monaco-specific handling needed

---

## Dependencies

### New npm Packages
```bash
cd src/naide-desktop
npm install @monaco-editor/react monaco-editor
```

- `@monaco-editor/react` — React wrapper component
- `monaco-editor` — Core Monaco editor (local bundle, not CDN)

### Bundle Size Impact
- `monaco-editor` is ~2-3 MB (gzipped: ~800KB)
- This is a one-time cost; Monaco is lazy-loaded on first editor open
- Acceptable for a desktop application (not a web SPA)

---

## Files to Create

- `src/naide-desktop/src/components/MonacoEditorWrapper.tsx` — Reusable Monaco wrapper with Naide theme
- `src/naide-desktop/src/utils/languageDetection.ts` — File extension → Monaco language mapping

## Files to Modify

### Frontend
- `src/naide-desktop/src/components/FeatureFileTab.tsx` — Replace `<textarea>` with Monaco in edit mode
- `src/naide-desktop/src/components/ProjectFileTab.tsx` — Add Monaco for read-only preview (code files), MarkdownPreview for .md, Monaco for edit mode
- `src/naide-desktop/package.json` — Add `@monaco-editor/react` and `monaco-editor` dependencies
- `src/naide-desktop/vite.config.ts` — Add Monaco-related Vite configuration (if needed for workers)

### Backend
- `src/naide-desktop/src-tauri/src/lib.rs` — Add `get_file_size` command and register it

---

## Implementation Phases

### Phase 1: Setup & Wrapper Component
- Install npm packages
- Create `MonacoEditorWrapper.tsx` with Naide dark theme
- Create `languageDetection.ts` utility
- Configure Vite for Monaco (if needed)
- Verify Monaco loads and renders correctly in isolation

### Phase 2: FeatureFileTab Integration
- Replace `<textarea>` in edit mode with `MonacoEditorWrapper`
- Keep `MarkdownPreview` for view mode (unchanged)
- Verify save/cancel/keyboard shortcuts work
- Test unsaved changes detection

### Phase 3: ProjectFileTab Integration
- Add `MarkdownPreview` for `.md` files in preview mode
- Add `MonacoEditorWrapper` in read-only mode for code files in preview mode
- Add `MonacoEditorWrapper` in read-write mode for edit mode
- Add file size check with `get_file_size` backend command
- Verify read-only → edit mode transition preserves state

### Phase 4: Polish & Testing
- Test with various file types (.ts, .json, .md, .cs, .html, .css, etc.)
- Test file size limit (try opening > 1 MB file)
- Test tab switching preserves Monaco state
- Verify no performance regressions
- Run existing tests, update any affected tests

---

## Acceptance Criteria

- [ ] `@monaco-editor/react` and `monaco-editor` packages installed
- [ ] `MonacoEditorWrapper` component created with Naide dark theme
- [ ] **FeatureFileTab**: Edit mode uses Monaco editor (not textarea)
- [ ] **FeatureFileTab**: Preview mode still shows rendered markdown (unchanged)
- [ ] **ProjectFileTab**: `.md` files show rendered markdown in preview mode
- [ ] **ProjectFileTab**: Code files show Monaco read-only in preview mode
- [ ] **ProjectFileTab**: Edit mode uses Monaco editor for all file types
- [ ] Monaco shows syntax highlighting based on file extension
- [ ] Monaco shows line numbers
- [ ] Minimap is disabled
- [ ] Editor uses Naide dark theme (zinc-900 background, blue cursor)
- [ ] Ctrl+S saves in edit mode
- [ ] ESC cancels editing and returns to preview mode
- [ ] Files > 1 MB show "too large" message and don't load
- [ ] Tab switching preserves Monaco editor state (no flicker, maintains scroll)
- [ ] Read-only to edit transition is seamless (no remount, preserves scroll)
- [ ] Loading state shown while Monaco initializes
- [ ] `get_file_size` Tauri command implemented with path security check
- [ ] App builds and runs successfully
- [ ] Existing tests pass (or are updated to reflect changes)
- [ ] No console errors or warnings

---

## Future Enhancements

### IntelliSense / Autocomplete
- TypeScript/JavaScript type-aware completions
- Requires integration with TypeScript language service
- Could use Monaco's built-in TypeScript support

### Custom Keybindings
- Allow users to configure editor keybindings
- Vim mode (via `monaco-vim` package)

### Minimap Toggle
- Add option to show/hide minimap per user preference
- Settings stored in project config

### Diff View
- Show file changes in a diff editor (Monaco has built-in diff editor)
- Useful for reviewing AI-generated changes

### Multi-File Search
- Leverage Monaco's search capabilities across open tabs

### Font Size Preference
- Allow users to adjust editor font size
- Persist in settings

---

## Related Features
- [2026-02-06-feature-file-tabs.md](./2026-02-06-feature-file-tabs.md) — Tab system (Monaco renders inside tabs)
- [2026-02-06-left-column-redesign.md](./2026-02-06-left-column-redesign.md) — Files section (opens files in tabs)
- [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) — Feature file browsing

---

created by naide
