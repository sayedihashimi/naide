---
Status: planned
Area: ui, chat, ux
Created: 2026-02-03
LastUpdated: 2026-02-03
---

# Feature: AI Activity Status Display
**Status**: 🟡 PLANNED

## Summary
Show real-time information about what the AI is doing during operations (files being read/written, analysis steps, etc.) in a persistent status area below the chat. This information is ephemeral and not saved to chat history, similar to VS Code's output panels.

---

## Goals
- Provide transparency into AI operations
- Show file read/write activity in real-time
- Display current operation status
- Keep users informed during long-running tasks
- Maintain clean chat history (status doesn't persist)

---

## Non-Goals
- Saving status messages to chat session files
- Interactive controls in status area (future enhancement)
- Detailed progress bars (keep simple for MVP)
- Log history scrollback (show only current/recent operations)

---

## Problem Statement
When the AI is working on tasks (especially in Building mode), users have no visibility into what's happening. They see a loading state but don't know:
- Which files are being analyzed
- What operations are in progress
- How far along the task is
- Whether the AI is stuck or actively working

This creates anxiety and makes debugging difficult. VS Code solves this with output panels showing detailed operation logs. Naide should provide similar transparency.

---

## Core Behavior

### Status Bar Location
- Position: Between chat messages area and input area
- Always visible (not collapsible in MVP)
- Height: ~100-150px (2-3 lines of status)
- Background: Slightly darker than chat area (zinc-900)

### Status Message Types

**File Operations:**
```
🔍 Reading .prompts/plan/app-spec.md
📝 Writing src/components/StatusBar.tsx
✓ Updated 3 files
```

**Analysis Steps:**
```
🧠 Analyzing project structure...
🔍 Searching for similar components...
✓ Analysis complete
```

**Build/Test Operations:**
```
🔨 Running build...
🧪 Running tests...
✓ Build successful
❌ Tests failed (2 failures)
```

**API Calls:**
```
🤖 Requesting Copilot response...
⏳ Streaming response...
✓ Response complete
```

### Status Lifecycle
1. **Active Operation**: Show with animated icon (spinner/pulse)
2. **Completed**: Show with checkmark, fade after 2 seconds
3. **Error**: Show with X icon, persist until next operation
4. **Multiple Operations**: Stack up to 3 recent items

### Message Format
```
[Icon] [Operation description] [Optional: file path or detail]
```

Examples:
- `🔍 Reading src/App.tsx`
- `📝 Writing .prompts/features/new-feature.md`
- `✓ Analyzed 5 files in 1.2s`
- `❌ Failed to read src/missing.tsx: File not found`

---

## Technical Implementation

### Backend (Sidecar)

**New Event Stream:**
Create a new endpoint for status events:
```typescript
// src/copilot-sidecar/src/statusEvents.ts
export interface StatusEvent {
  id: string;
  type: 'file_read' | 'file_write' | 'analysis' | 'build' | 'test' | 'api_call';
  status: 'in_progress' | 'complete' | 'error';
  message: string;
  details?: string; // File path, error message, etc.
  timestamp: number;
}

export class StatusEventEmitter extends EventEmitter {
  emit(event: StatusEvent) { /* ... */ }
}
```

**Integration Points:**
Emit status events from:
1. File operations (before/after read/write)
2. Copilot API calls (request start, streaming, complete)
3. Build/test commands (start, progress, complete)
4. Analysis steps (spec parsing, code analysis, etc.)

**WebSocket Connection:**
- Use WebSocket for real-time status updates
- Endpoint: `ws://localhost:3001/api/status`
- Client subscribes on component mount
- Server broadcasts events to all connected clients

### Frontend (React)

**New Component:** `ActivityStatusBar.tsx`
```typescript
interface ActivityStatusBarProps {
  // No props needed - manages own WebSocket connection
}

const ActivityStatusBar: React.FC = () => {
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  
  // WebSocket connection management
  // Display last 3 events
  // Auto-remove completed events after 2s
  // Show animated spinner for in_progress
  
  return (
    <div className="status-bar">
      {statusEvents.map(event => (
        <StatusLine key={event.id} event={event} />
      ))}
    </div>
  );
};
```

**Layout Integration:**
Update `GenerateAppScreen.tsx`:
```
┌─────────────────────────────────┐
│ Chat messages (scrollable)      │
│                                 │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 🔍 Reading src/App.tsx...       │ ← New: ActivityStatusBar
│ 📝 Writing feature spec...      │
│ ✓ Updated 3 files               │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ [Type your message...]          │
│ [Send]                          │
└─────────────────────────────────┘
```

**State Management:**
- Store events in component state (no Redux/context needed)
- Auto-expire completed events after 2 seconds
- Keep errors until next operation starts
- Limit to 3 visible events (drop oldest)

---

## UI/UX Details

### Status Bar Styling
- Background: zinc-900 (darker than chat)
- Border top: 1px solid zinc-700
- Padding: 12px 16px
- Font: JetBrains Mono (monospace for alignment)
- Font size: 12px (smaller than chat)

### Status Line Styling
- Height: ~24px per line
- Icon: 16px, left-aligned
- Text: truncate long paths with ellipsis
- Color: 
  - In progress: text-blue-400
  - Complete: text-green-400
  - Error: text-red-400

### Icons
Use Lucide React icons:
- 🔍 Search icon (file read)
- 📝 FileEdit icon (file write)
- 🧠 Brain icon (analysis) 
- 🔨 Hammer icon (build)
- 🧪 Flask icon (test)
- 🤖 Bot icon (API call)
- ✓ CheckCircle icon (success)
- ❌ XCircle icon (error)
- ⏳ Loader2 icon (spinning, in progress)

### Animations
- **In Progress**: Icon rotates/pulses
- **Complete**: Brief green flash, fade out after 2s
- **Error**: Red flash, persist

---

## Example Scenarios

### Scenario 1: File Analysis
```
User: "Add dark mode to the app"

Status bar shows:
1. 🔍 Reading .prompts/plan/app-spec.md
2. 🔍 Reading src/App.tsx
3. 🔍 Reading src/index.css
4. ✓ Analyzed 3 files
5. 🤖 Requesting Copilot response...
6. ⏳ Streaming response...
7. ✓ Response complete
```

### Scenario 2: Building Mode
```
User: "Implement the dark mode feature"

Status bar shows:
1. 📝 Writing src/contexts/ThemeContext.tsx
2. 📝 Writing src/components/ThemeToggle.tsx
3. 📝 Updating src/App.tsx
4. 📝 Updating .prompts/features/2026-02-03-dark-mode.md
5. ✓ Updated 4 files
6. 🔨 Running build...
7. ✓ Build successful
8. 🧪 Running tests...
9. ✓ All tests passed
```

### Scenario 3: Error Handling
```
User: "Update the login component"

Status bar shows:
1. 🔍 Reading src/components/Login.tsx
2. ❌ Failed to read: File not found

(Error persists, AI explains in chat)
```

---

## Error Handling

### WebSocket Connection Failures
- If connection drops: show warning in status bar
- Attempt reconnection every 5 seconds
- Fall back to graceful degradation (hide status bar)

### Long Operations
- If operation takes >30s, add elapsed time
- Example: `🔨 Running build... (45s)`

### File Path Display
- Truncate long paths: `...src/components/LongFileName.tsx`
- Show relative paths from project root
- Hover to see full path (future enhancement)

---

## Acceptance Criteria

- [ ] Status bar appears between chat and input area
- [ ] Status bar shows file read operations
- [ ] Status bar shows file write operations
- [ ] Status bar shows Copilot API calls
- [ ] Status bar shows build/test operations
- [ ] In-progress operations show animated icon
- [ ] Completed operations show checkmark and fade
- [ ] Errors show X icon and persist
- [ ] Maximum 3 events visible at once
- [ ] Status events do NOT save to chat history
- [ ] WebSocket connection handles reconnection
- [ ] UI matches Naide's design system

---

## Future Enhancements

### Phase 2: Expandable Activity Panel
- Click status bar to expand full activity log
- Show complete history for current session
- Search/filter activity log
- Export activity log

### Phase 3: Interactive Controls
- Click file paths to open in popup viewer
- Retry failed operations
- Cancel long-running operations

### Phase 4: Advanced Features
- Progress bars for long operations
- Estimated time remaining
- Group related operations (collapsible)
- Activity log persistence across sessions

---

## Dependencies

### Backend
- `ws` package for WebSocket server
- Event emitter for status broadcasting

### Frontend
- `WebSocket` API (native browser)
- Lucide React icons
- Existing UI components

---

## Testing Strategy

### Unit Tests
- StatusEvent creation and lifecycle
- Event expiration logic (2s timeout)
- Event limiting (max 3 visible)

### Integration Tests
1. Open WebSocket, verify connection
2. Emit file read event, verify display
3. Emit multiple events, verify only 3 shown
4. Emit error event, verify persistence
5. Close WebSocket, verify reconnection

### Manual Testing
- [ ] File operations show in status bar
- [ ] Build/test operations show correctly
- [ ] Errors display and persist
- [ ] Completed items fade after 2s
- [ ] WebSocket reconnects after disconnect
- [ ] Status bar doesn't interfere with chat
- [ ] Long paths truncate properly
- [ ] Performance with rapid events (no lag)

---

## Performance Considerations

- Limit status events to 3 visible (prevent DOM bloat)
- Debounce rapid events (batch file reads)
- Use CSS animations (not JS) for spinners
- Clean up WebSocket on component unmount
- Throttle status bar re-renders

---

## Security Considerations

- Validate WebSocket origin (localhost:3001 only)
- Sanitize file paths before display (prevent XSS)
- Don't expose sensitive file contents in status
- Rate-limit status events (prevent DoS)

---

## Related Features
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Main chat UI
- [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) - File operations that trigger status
- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) - API calls that trigger status

---

created by naide
