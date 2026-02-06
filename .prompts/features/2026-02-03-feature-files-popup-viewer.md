---
Status: superseded
Area: ui, features
Created: 2026-02-03
LastUpdated: 2026-02-06
SupersededBy: 2026-02-06-feature-file-tabs.md
---

# Feature: Popup Window for Feature Files Viewer
**Status**: 🟡 PARTIALLY IMPLEMENTED (Inline viewer with edit mode)

## Current Implementation

Instead of a popup window, the feature files viewer is currently implemented as an **inline viewer in the left panel** with the following features:

**Implemented Features:**
- File list tree view with folders
- Filter bar for searching files
- View options menu (show bugs, show removed features, show raw filenames)
- Inline markdown preview (rendered below file list)
- Edit mode with textarea
- Save/Cancel buttons
- Keyboard shortcuts (Ctrl+S/Cmd+S to save, ESC to close edit mode)
- Date-based sorting (most recent first)
- Dark theme styling

**Components:**
- `src/components/FeatureFilesViewer.tsx` - Main viewer component
- `src/components/FeatureFilesList.tsx` - File tree component
- `src/components/ViewOptionsMenu.tsx` - View options dropdown
- `src/components/MarkdownPreview.tsx` - Markdown rendering
- `src/components/Modal.tsx` - Basic modal (not draggable)

**Not Implemented:**
- DraggableModal component
- Popup window functionality
- Drag to reposition
- Resize from corners/edges
- Multiple simultaneous windows

## Summary
Convert the inline feature files preview in the left panel to a movable/resizable popup window. This provides more space for viewing and editing feature files without losing the compact file list navigation.

---

## Goals
- Replace inline preview with popup window
- Enable dragging to reposition window
- Enable resizing from corners/edges
- Maintain edit mode functionality
- Preserve keyboard shortcuts (Ctrl+S/Cmd+S to save, ESC to close)
- Support multiple popup windows for different files (future enhancement)

---

## Non-Goals
- Docking/snapping to screen edges (future enhancement)
- Window state persistence (position/size) (future enhancement)
- Multiple simultaneous popups in this phase

---

## Problem Statement
The current inline preview in the left panel is too small for comfortably reading and editing feature files. Users need more screen space to work with longer documents, but moving the preview to take up more space would compromise the file list navigation.

A popup window solves this by:
- Providing full control over size and position
- Keeping the file list compact and accessible
- Allowing users to move the window to secondary monitors
- Supporting future multi-window workflows

---

## Implementation Plan

### Phase 1: Create DraggableModal Component âœ“
- [ ] Create `src/components/DraggableModal.tsx`
- [ ] Implement drag-from-title-bar functionality
  - Mouse down on title bar starts drag
  - Update position during mouse move
  - Stop drag on mouse up
  - Prevent text selection during drag
- [ ] Implement resize functionality
  - Add resize handle in bottom-right corner
  - Mouse down on handle starts resize
  - Update width/height during mouse move
  - Stop resize on mouse up
  - Enforce minimum dimensions (400x300)
- [ ] Style the modal:
  - Dark theme (zinc-800 background)
  - Title bar with grab cursor
  - Close button (X) in title bar
  - Drop shadow for depth
  - Border (zinc-700)
- [ ] Add props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `title: string`
  - `initialWidth?: number` (default 800)
  - `initialHeight?: number` (default 600)
  - `children: React.ReactNode`

### Phase 2: Simplify FeatureFilesViewer âœ“
- [ ] Remove inline MarkdownPreview from `FeatureFilesViewer.tsx`
- [ ] Remove edit mode state and logic
- [ ] Keep only the file list tree view
- [ ] Update click handler to open popup instead of updating preview
- [ ] Remove vertical split layout (no longer needed)

### Phase 3: Create FeatureFilePopup Component âœ“
- [ ] Create `src/components/FeatureFilePopup.tsx`
- [ ] Accept props:
  - `filePath: string`
  - `fileName: string`
  - `isOpen: boolean`
  - `onClose: () => void`
- [ ] Load file content on mount/path change
- [ ] Implement view/edit mode toggle
- [ ] Implement save/cancel actions
- [ ] Handle keyboard shortcuts:
  - ESC to close
  - Ctrl+S/Cmd+S to save
  - Prevent default browser behavior
- [ ] Use DraggableModal as the container
- [ ] Render MarkdownPreview in view mode
- [ ] Render textarea in edit mode
- [ ] Show save/cancel buttons in edit mode

### Phase 4: Integration âœ“
- [ ] Update `GenerateAppScreen.tsx` (or parent component):
  - Add state for popup (open/closed, current file)
  - Pass popup state to FeatureFilesViewer
  - Render FeatureFilePopup component
- [ ] Wire up click handler in FeatureFilesViewer:
  - Set current file path
  - Open popup
- [ ] Test full workflow:
  - Click file in list
  - Popup opens
  - View file content
  - Switch to edit mode
  - Make changes
  - Save changes
  - Close popup
  - Verify file list still works

### Phase 5: Polish & Testing âœ“
- [ ] Handle edge cases:
  - File load errors
  - Save errors
  - Unsaved changes warning (if navigating away)
- [ ] Ensure popup doesn't go off-screen (optional: constraint logic)
- [ ] Test keyboard navigation thoroughly
- [ ] Test on different screen sizes
- [ ] Verify accessibility (focus management, ARIA labels)
- [ ] Update any relevant specs/docs

---

## Technical Details

### DraggableModal Component

**State:**
```typescript
const [position, setPosition] = useState({ x: 100, y: 100 });
const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
const [isDragging, setIsDragging] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
```

**Drag Logic:**
- On title bar mousedown: capture start position
- On mousemove: calculate delta, update position
- On mouseup: stop dragging
- Use `user-select: none` during drag

**Resize Logic:**
- On resize handle mousedown: capture start position and size
- On mousemove: calculate new dimensions
- Enforce min width/height (400x300)
- On mouseup: stop resizing

**Rendering:**
- Use absolute positioning
- Apply transform for position
- Render children in content area
- Z-index to ensure it's above other content

---

## UI/UX Considerations

### Window Appearance
- Title bar: dark (zinc-900), height ~40px
- Title text: left-aligned with padding
- Close button: right-aligned, hover state
- Content area: zinc-800 background
- Resize handle: subtle corner indicator (â‹° or similar)

### Interactions
- Dragging: smooth, no lag
- Resizing: visual feedback during resize
- Closing: ESC key or X button
- Focus: popup receives focus when opened
- Background: optional dimmed overlay (future)

### States
- **Viewing**: Markdown rendered, edit button visible
- **Editing**: Textarea with save/cancel buttons
- **Saving**: Brief loading state (optional)
- **Error**: Toast notification or inline error

---

## File Structure Changes

**New Files:**
- `src/components/DraggableModal.tsx` - Reusable draggable/resizable modal
- `src/components/FeatureFilePopup.tsx` - Feature file viewer/editor in popup

**Modified Files:**
- `src/components/FeatureFilesViewer.tsx` - Remove inline preview, add popup trigger
- `src/pages/GenerateAppScreen.tsx` - Add popup state and rendering

**Unchanged:**
- `src/components/MarkdownPreview.tsx` - Reused in popup
- `src/utils/fileSystem.ts` - Same file operations
- Backend commands - No changes needed

---

## Acceptance Criteria

- [ ] Clicking a file in the list opens a popup window
- [ ] Popup window can be dragged by the title bar
- [ ] Popup window can be resized from bottom-right corner
- [ ] Popup displays file content with proper markdown rendering
- [ ] Edit mode works (toggle, textarea, save/cancel)
- [ ] Keyboard shortcuts work (ESC to close, Ctrl+S to save)
- [ ] File list remains visible and functional
- [ ] Closing popup returns to normal state
- [ ] Multiple files can be opened sequentially (closes previous)
- [ ] No console errors or warnings
- [ ] UI matches Naide's design system (dark theme, zinc colors)

---

## Future Enhancements

### Multiple Popups
- Allow multiple files open simultaneously
- Each in its own window
- Tab switching or window management

### Window State Persistence
- Remember last position/size per user
- Restore on next open
- localStorage or settings file

### Advanced Features
- Maximize/minimize buttons
- Snap to screen edges/quadrants
- Pin window to stay on top
- Search within file (Ctrl+F)

---

## Dependencies

- React 19 hooks (useState, useEffect, useRef)
- Lucide React icons (for close, resize indicators)
- Existing MarkdownPreview component
- Existing file system utilities

---

## Testing Strategy

### Unit Tests
- DraggableModal drag calculations
- DraggableModal resize boundaries
- FeatureFilePopup save/cancel logic

### Integration Tests
1. Open file, verify content loads
2. Drag popup, verify position updates
3. Resize popup, verify dimensions change
4. Edit mode: make changes, save, verify file updates
5. Edit mode: make changes, cancel, verify no file changes
6. Keyboard: ESC closes popup
7. Keyboard: Ctrl+S saves changes in edit mode

### Manual Testing
- [ ] Test on Windows (primary target)
- [ ] Test on macOS (if applicable)
- [ ] Test with small screens (1366x768)
- [ ] Test with large screens (4K)
- [ ] Test with multiple monitors
- [ ] Verify accessibility (screen reader, keyboard-only)

---

## Related Features
- [2026-02-01-feature-files-viewer.md](./2026-02-01-feature-files-viewer.md) - Original inline viewer
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Main UI layout

---

created by naide
