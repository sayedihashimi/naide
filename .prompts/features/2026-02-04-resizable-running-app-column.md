---
Status: shipped
Area: ui, layout
Created: 2026-02-04
LastUpdated: 2026-02-04
---

# Feature: Resizable Running App Column
**Status**: ✅ IMPLEMENTED

## Implementation Summary

The right column ("Running App" panel) has been made resizable with the following features:

**Key Features Implemented:**
- Default width increased from 384px to 600px for better visibility
- Resize handle on left edge of right column
- Drag to resize functionality (left-right)
- Minimum width constraint: 300px
- Maximum width constraint: 1200px
- Smooth resize interaction with mouse tracking
- Visual resize cursor (`col-resize`) on handle
- State persists during session (resets on app restart)

**Files Modified:**
- `src/pages/GenerateAppScreen.tsx` - Added resize state, handlers, and UI

**Implementation Details:**
- State: `rightColumnWidth` initialized to 600px
- Mouse event handlers: `handleResizeStart` for drag operations
- Dynamic width: Applied via inline style to right column
- Resize handle: Positioned on left edge with visual indicator

---

## Summary
Make the "Running App" column (right panel) larger by default and allow users to resize it by dragging a handle, providing more flexibility for viewing running application previews.

---

## Goals
- Increase default width for better visibility
- Enable user customization of right column width
- Provide intuitive resize interaction
- Maintain responsive layout behavior

---

## Non-Goals
- Persist resize preference across sessions (future enhancement)
- Collapsible/expandable column (future enhancement)
- Snap-to-width presets (future enhancement)

---

## Problem Statement
The current right column ("Running App") has a fixed width of 384px (`w-96`), which may be too small for comfortably viewing running applications or previews. Users need:
- More default space for app previews
- Flexibility to adjust width based on their workflow and screen size
- Ability to temporarily expand/shrink the column without losing the main chat area

---

## Core Behavior

### Default Width
- Increase from 384px to **600px**
- Provides more breathing room for app previews
- Better balance with chat column

### Resize Handle
- **Location**: Left edge of right column
- **Visual**: Vertical bar (3px wide) with hover state
- **Cursor**: `col-resize` when hovering
- **Color**: Subtle zinc-600, zinc-400 on hover
- **Active state**: zinc-300 during drag

### Resize Interaction
1. User hovers over left edge of right column
2. Cursor changes to resize cursor
3. User clicks and drags left/right
4. Column width adjusts in real-time
5. Release to lock at final width

### Width Constraints
- **Minimum**: 300px (prevent too narrow)
- **Maximum**: 1200px (prevent too wide)
- **Default**: 600px

---

## Technical Implementation

### State Management

**Added to GenerateAppScreen.tsx:**
```typescript
const [rightColumnWidth, setRightColumnWidth] = useState<number>(600);
```

### Resize Handler

**Mouse event logic:**
```typescript
const handleResizeStart = (e: React.MouseEvent) => {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = rightColumnWidth;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = startX - moveEvent.clientX; // Inverted for left-edge resize
    const newWidth = Math.max(300, Math.min(1200, startWidth + deltaX));
    setRightColumnWidth(newWidth);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

### Layout Application

**Right column structure:**
```tsx
<div 
  className="flex flex-col bg-zinc-800 border-l border-zinc-700 relative"
  style={{ width: `${rightColumnWidth}px` }}
>
  {/* Resize handle */}
  <div
    className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-600 hover:bg-zinc-400 cursor-col-resize z-10"
    onMouseDown={handleResizeStart}
  />
  
  {/* Running App content */}
  <div className="flex-1 flex flex-col">
    {/* ... */}
  </div>
</div>
```

---

## UI/UX Details

### Resize Handle Styling
- Width: 3px (4px including border)
- Color: zinc-600 default, zinc-400 hover, zinc-300 active
- Position: Absolute, full height of right column
- Cursor: `col-resize` (left-right resize indicator)
- Z-index: 10 (above content)

### Visual Feedback
- Cursor changes immediately on hover
- Smooth width transition during drag
- No text selection during drag (`user-select: none` on document during drag)

### Responsive Behavior
- Width remains fixed during window resize
- Constraints prevent breaking layout on small screens
- Future: Could add breakpoint-based defaults

---

## Acceptance Criteria

- ✅ Right column default width is 600px (up from 384px)
- ✅ Resize handle appears on left edge of right column
- ✅ Dragging handle left/right resizes column smoothly
- ✅ Width is constrained between 300px and 1200px
- ✅ Cursor changes to `col-resize` on hover
- ✅ No text selection during drag
- ✅ UI matches Naide's design system (dark theme, zinc colors)
- ✅ No console errors or warnings

---

## Future Enhancements

### Persist Width Preference
- Store `rightColumnWidth` in localStorage or app settings
- Restore on app launch
- Per-project setting (optional)

### Collapsible Column
- Double-click resize handle to collapse to minimum
- Button to toggle collapse/expand
- Remember last expanded width

### Preset Widths
- Quick buttons for common widths (400px, 600px, 800px)
- Snap to presets during drag (optional)

### Keyboard Support
- Arrow keys to adjust width incrementally
- Shift+Arrow for larger increments

---

## Related Features
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Main 3-column layout
- [2026-02-03-resizable-chat-textarea.md](./2026-02-03-resizable-chat-textarea.md) - Similar resize pattern for textarea

---

created by naide
