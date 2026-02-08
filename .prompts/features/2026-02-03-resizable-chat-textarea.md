---
Status: not-implemented
Area: ui, chat
Created: 2026-02-03
LastUpdated: 2026-02-08
---

# Feature: Resizable Chat Textarea
**Status**: ❌ NOT IMPLEMENTED

> **Note (2026-02-08):** Only the basic expand/collapse toggle exists (switching between fixed `h-20` and `h-40` heights). The drag-to-resize handle, `expandedHeight` state, and dynamic height adjustment described in this spec have **not** been implemented.

## Summary
Add resize functionality to the expanded chat textarea, allowing users to adjust the height dynamically by dragging a resize handle, rather than being limited to fixed collapsed/expanded sizes.

---

## Goals
- Allow users to customize textarea height when expanded
- Provide smooth, intuitive resize interaction
- Remember user's preferred height during the session
- Maintain min/max height constraints for usability

---

## Non-Goals
- Persisting resize preference across sessions (future enhancement)
- Horizontal resizing (textarea spans full width)
- Native browser resize handle (custom implementation for better control)

---

## Problem Statement
Currently, the chat textarea has only two fixed heights:
- Collapsed: h-20 (~80px)
- Expanded: h-40 (~160px)

Users may want more vertical space for composing longer messages, or less space to see more of the chat history. A fixed expanded height doesn't accommodate different use cases and screen sizes.

---

## Current Behavior

**Component**: `src/pages/GenerateAppScreen.tsx` (lines ~400-450)

**State**:
```typescript
const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
```

**Rendering**:
```tsx
<textarea
  className={`${isTextareaExpanded ? 'h-40' : 'h-20'} ...`}
  // ... other props
/>
```

**Expand/Collapse Button**:
- Icon button toggles between ChevronUp and ChevronDown
- Simple boolean toggle

---

## Proposed Solution

### Visual Design
When textarea is expanded, show a **resize handle** in the bottom-right corner:
- Icon: ⋰ or drag indicator (horizontal lines)
- Position: Absolute, bottom-right corner with padding
- Cursor: `ns-resize` (vertical resize cursor)
- Style: Subtle zinc-600 color, zinc-400 on hover

### Interaction Flow
1. User clicks expand button → textarea expands to last known height (or default)
2. User sees resize handle in bottom-right corner
3. User drags handle up/down → textarea height adjusts in real-time
4. Release drag → height locks at final position
5. Click collapse button → textarea returns to collapsed height

### Height Constraints
- **Minimum**: 80px (h-20, collapsed height)
- **Maximum**: 400px (~h-100)
- **Default expanded**: 160px (h-40, current expanded height)

---

## Technical Implementation

### State Changes

**Add new state** to `GenerateAppScreen.tsx`:
```typescript
const [expandedHeight, setExpandedHeight] = useState<number>(160); // Default 160px (h-40)
```

**Update existing state usage**:
- Keep `isTextareaExpanded` boolean for expand/collapse logic
- When expanded: use `expandedHeight` instead of fixed class

### Resize Handle Component

**Location**: Inline in `GenerateAppScreen.tsx` or separate component

**Structure**:
```tsx
{isTextareaExpanded && (
  <div
    className="absolute bottom-1 right-1 cursor-ns-resize text-zinc-600 hover:text-zinc-400"
    onMouseDown={handleResizeStart}
  >
    <svg>...</svg> {/* Resize icon */}
  </div>
)}
```

### Resize Event Handlers

**Mouse event handlers**:
```typescript
const handleResizeStart = (e: React.MouseEvent) => {
  e.preventDefault();
  const startY = e.clientY;
  const startHeight = expandedHeight;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaY = moveEvent.clientY - startY;
    const newHeight = Math.max(80, Math.min(400, startHeight + deltaY));
    setExpandedHeight(newHeight);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

**Key points**:
- Start resize on mousedown
- Track delta from start position
- Clamp to min/max bounds
- Update state during drag
- Clean up listeners on mouseup

### Textarea Height Application

**Replace fixed height classes with dynamic style**:
```tsx
<textarea
  style={{
    height: isTextareaExpanded ? `${expandedHeight}px` : '5rem', // 80px (h-20)
  }}
  className="..." // Remove h-20 and h-40 classes
  // ... other props
/>
```

### Expand/Collapse Button Behavior

**On expand**:
- Set `isTextareaExpanded = true`
- Use existing `expandedHeight` (remembers last size)

**On collapse**:
- Set `isTextareaExpanded = false`
- Keep `expandedHeight` in memory (don't reset)

---

## UI/UX Considerations

### Resize Handle Styling
- Size: 20x20px clickable area
- Icon: Small drag indicator (≡ or ⋰)
- Color: Subtle when idle, brighter on hover
- Visibility: Only shown when expanded

### Visual Feedback
- Cursor changes to `ns-resize` over handle
- Smooth height transition during drag (no lag)
- Prevent text selection during drag (`user-select: none`)

### Accessibility
- Handle should be keyboard accessible (future: arrow keys to resize)
- Screen readers: announce resize capability
- Focus visible state for handle

---

## Edge Cases

1. **User drags beyond min/max**: Clamp to bounds
2. **Fast mouse movement**: Use throttling or RAF for smooth updates
3. **Collapse while resizing**: Stop resize, collapse normally
4. **Window resize**: Textarea height remains in absolute pixels (no adjustment)
5. **Multiple sessions**: Height resets to default (160px) on new session

---

## Implementation Steps

### Phase 1: Add State & Logic ✅
- [ ] Add `expandedHeight` state to GenerateAppScreen
- [ ] Implement `handleResizeStart` and related handlers
- [ ] Update textarea to use dynamic height style

### Phase 2: Resize Handle UI ✅
- [ ] Create resize handle component/element
- [ ] Style with zinc colors, hover states
- [ ] Position in bottom-right corner of textarea
- [ ] Show/hide based on `isTextareaExpanded`

### Phase 3: Polish & Testing ✅
- [ ] Test min/max constraints
- [ ] Test expand/collapse preserves height
- [ ] Test smooth dragging (no jank)
- [ ] Verify cursor behavior
- [ ] Verify no text selection during drag
- [ ] Test on different screen sizes

### Phase 4: Accessibility (Optional)
- [ ] Add keyboard support (arrow keys)
- [ ] Add ARIA labels
- [ ] Test with screen reader

---

## Files to Modify

**Frontend**:
- `src/pages/GenerateAppScreen.tsx` - Add resize logic and handle
- Potentially: Extract to `src/components/ResizableTextarea.tsx` if logic becomes complex

---

## Acceptance Criteria

- [ ] Resize handle appears in bottom-right corner when textarea is expanded
- [ ] Dragging handle up/down changes textarea height smoothly
- [ ] Height is constrained between 80px and 400px
- [ ] Collapsing and re-expanding preserves the custom height
- [ ] Cursor changes to `ns-resize` when hovering over handle
- [ ] No text selection occurs during drag
- [ ] UI matches Naide's design system (dark theme, zinc colors)
- [ ] No console errors or warnings

---

## Future Enhancements

### Persist Height Preference
- Store `expandedHeight` in localStorage or app settings
- Restore on app launch
- Per-project setting (optional)

### Keyboard Support
- Arrow keys to adjust height incrementally
- Shift+Arrow for larger increments
- ESC to cancel resize (return to previous height)

### Smart Height Adjustment
- Auto-expand when pasting large content
- Remember different heights per mode (Planning/Building/Analyzing)

---

## Related Features
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Main chat UI
- [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) - Chat context

---

created by naide
