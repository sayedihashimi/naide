---
Status: planned
Area: ui, chat
Created: 2026-02-03
LastUpdated: 2026-02-03
---

# Feature: Chat History Viewer
**Status**: 🟡 PLANNED

## Summary
Add a UI component that allows users to view and load previous chat sessions. Users can click a clock icon above the chat area to see a dropdown list of archived chats and select one to open.

---

## Goals
- Enable users to access archived chat sessions
- Display chat metadata (date, mode, message count, preview)
- Allow users to switch between different chat sessions
- Provide visual indication of current vs archived chats

---

## Non-Goals
- Search within chat history (future enhancement)
- Delete or rename chat sessions (future enhancement)
- Chat session organization/folders (future enhancement)
- Export chat sessions (future enhancement)
- Chat session merging or splitting

---

## Problem Statement
Currently, Naide saves chat sessions to `.naide/chatsessions/` when users click the "New Chat" button, but there is no way to view or load these archived chats from the UI. Users can only work with the active chat session, making it impossible to revisit previous conversations or context.

---

## Core Behavior

### UI Location
- **Clock icon** positioned next to the "New Chat" (+) button
- When clicked, opens a dropdown below the button
- Dropdown displays a list of archived chat sessions
- Clicking outside the dropdown closes it

### Chat List Display
Each chat session item shows:
- **Primary text**: Date/time of last message (e.g., "Today at 2:30 PM", "Yesterday", "Feb 1, 2026")
- **Secondary text**: 
  - Mode badge (Planning/Building/Analyzing)
  - Message count (e.g., "12 messages")
  - First user message preview (truncated to ~50 chars)

### Loading a Chat
When user clicks on an archived chat:
1. Save current active chat if it has unsaved changes
2. Load selected chat from file
3. Replace current chat state with loaded messages and summary
4. Update UI to show loaded conversation
5. Close dropdown

### Empty State
If no archived chats exist:
- Show message: "No archived chats yet"
- Display only when dropdown is opened

---

## Technical Implementation

### Backend (Tauri)

**New command**: `list_chat_sessions(project_path: String)`
- Scans `.naide/chatsessions/` directory
- Returns array of chat metadata:
  ```typescript
  {
    filename: string,
    lastModified: number,
    messageCount: number,
    mode: string,
    firstUserMessage: string
  }
  ```
- Excludes `chat-active.json` (current session)
- Sorts by lastModified descending (most recent first)

**New command**: `load_chat_session(project_path: String, filename: String)`
- Reads chat file from `.naide/chatsessions/{filename}`
- Returns full chat session data
- Validates file exists and is valid JSON
- Returns error if file is corrupted or missing

### Frontend Changes

**New Component**: `ChatHistoryDropdown.tsx`
- Manages dropdown state (open/closed)
- Fetches chat list on open
- Renders list of chat sessions
- Handles chat selection and loading
- Click-outside detection to close

**State Management** (in `GenerateAppScreen.tsx`):
- Add state: `showChatHistory: boolean`
- Add function: `handleLoadChat(filename: string)`
- Add function: `toggleChatHistory()`

**Integration**:
- Add clock icon button next to "New Chat" button
- Position dropdown below the icon
- Use existing `loadChatSession` utility from `chatPersistence.ts`
- Extend `loadChatSession` to accept optional filename parameter

---

## UI/UX Details

### Button Styling
- Clock icon (from Lucide React or similar)
- Same size/style as "New Chat" button
- Hover state matches existing buttons
- Tooltip: "View chat history"

### Dropdown Styling
- Dark theme (zinc-800 background)
- Maximum height: ~400px (scrollable if more items)
- Minimum width: 300px
- Positioned absolutely below clock icon
- Drop shadow for depth
- Border: subtle zinc-700

### Chat Item Styling
- Padding: 12px 16px
- Hover: zinc-700 background
- Active/selected state (if applicable)
- Text hierarchy:
  - Date: text-sm font-semibold
  - Mode badge: inline, colored (green/blue/purple)
  - Preview: text-xs text-zinc-400, truncated with ellipsis

### Keyboard Support
- ESC key closes dropdown
- Arrow keys navigate list (optional for MVP)
- Enter key loads selected chat (optional for MVP)

---

## File System Structure

### Chat Files Location
```
<project-root>/.naide/chatsessions/
├── chat-active.json          (current session, not shown in history)
├── chat-2026-02-01T14-30-45.json
├── chat-2026-02-01T16-22-10.json
└── chat-2026-02-02T09-15-33.json
```

### Chat File Format
```json
{
  "id": "unique-chat-id",
  "projectName": "project-name",
  "mode": "Planning",
  "createdAt": "ISO timestamp",
  "savedAt": "ISO timestamp",
  "messages": [...],
  "summary": {...}
}
```

---

## Error Handling

### File Read Errors
- If chat file is corrupted: Show error toast, skip file in list
- If chat file is missing: Remove from list, log warning
- If directory doesn't exist: Show empty state

### Permission Errors
- Show error message: "Cannot access chat history"
- Log error details
- Gracefully degrade (hide button if persistent)

### Load Failures
- If load fails mid-operation: Keep current chat, show error toast
- Don't leave user in broken state
- Provide option to retry

---

## User Flow

### Opening History
1. User clicks clock icon
2. Dropdown appears with loading indicator
3. List of chats loads and displays
4. User can scroll through list

### Loading a Chat
1. User clicks on a chat in the list
2. Current chat auto-saves (if has changes)
3. Selected chat loads
4. UI updates with loaded messages
5. Dropdown closes
6. User can continue conversation

### Creating New Chat
1. User clicks "New Chat" (+) button
2. Current chat archives
3. New empty chat starts
4. Previous chat now appears in history dropdown

---

## Acceptance Criteria

- [ ] Clock icon appears next to "New Chat" button
- [ ] Clicking clock icon opens dropdown
- [ ] Dropdown shows list of archived chats (excluding active)
- [ ] Chats sorted by most recent first
- [ ] Each item shows: date, mode, message count, preview
- [ ] Clicking a chat loads it successfully
- [ ] Current chat auto-saves before loading another
- [ ] Dropdown closes after selection
- [ ] Clicking outside dropdown closes it
- [ ] Empty state shows when no archived chats exist
- [ ] Error handling works for corrupted/missing files
- [ ] Keyboard support (ESC to close)
- [ ] UI matches Naide's design system (dark theme, zinc colors)
- [ ] No console errors or warnings

---

## Future Enhancements

### Phase 2: Search and Filter
- Search box in dropdown
- Filter by mode (Planning/Building/Analyzing)
- Filter by date range
- Full-text search within messages

### Phase 3: Chat Management
- Rename chat sessions
- Delete chat sessions
- Pin favorite chats to top
- Export chat as markdown
- Organize chats into folders/tags

### Phase 4: Advanced Features
- Chat session comparison (diff view)
- Merge multiple chat sessions
- Share chat session (export/import)
- Chat session templates

---

## Dependencies

### Frontend
- Existing `chatPersistence.ts` utilities
- Tauri file system plugin (already in use)
- Lucide React (or similar) for clock icon

### Backend
- Tauri `fs` plugin (already configured)
- Read directory capabilities
- JSON parsing

---

## Testing Strategy

### Unit Tests
- Chat list parsing and sorting
- File name extraction
- Error handling for corrupted files

### Integration Tests
1. Create multiple archived chats, verify list appears
2. Load an archived chat, verify state updates correctly
3. Create new chat while history exists, verify old chat appears in list
4. Test with empty history, verify empty state shows
5. Test with corrupted file, verify graceful error handling

### Manual Testing
- [ ] Open dropdown, verify chats load
- [ ] Load different chats, verify content is correct
- [ ] Test with 0, 1, 5, 20+ archived chats
- [ ] Test keyboard navigation (ESC)
- [ ] Test responsive layout (different window sizes)
- [ ] Verify auto-save before loading

---

## Files to Modify

### Frontend
- `src/pages/GenerateAppScreen.tsx` - Add clock icon and state management
- `src/components/ChatHistoryDropdown.tsx` - New component (create)
- `src/utils/chatPersistence.ts` - Extend `loadChatSession` to accept filename

### Backend
- `src-tauri/src/lib.rs` - Add `list_chat_sessions` and `load_chat_session` commands

---

## Related Features
- [2026-02-01-new-chat-button.md](./2026-02-01-new-chat-button.md) - Creates archived chats
- [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) - Chat session structure
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) - Main chat UI

---

## Security Considerations

- Only read files from `.naide/chatsessions/` (no arbitrary paths)
- Validate all file names before reading
- Sanitize chat content before displaying (prevent XSS)
- Limit file size reads (prevent memory exhaustion)
- Handle malformed JSON gracefully

---

## Performance Considerations

- Lazy load chat list (only when dropdown opens)
- Limit preview text to first 50 characters
- Don't load full message content until chat is selected
- Cache chat list for 30 seconds (avoid repeated file system calls)
- Virtualize list if more than 50 chats (future optimization)

---

created by naide
