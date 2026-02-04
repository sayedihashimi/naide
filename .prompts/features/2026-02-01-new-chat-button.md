---
Status: shipped
Area: ui, chat
Created: 2026-02-01
LastUpdated: 2026-02-03
---

# Feature: New Chat Button
**Status**: ✅ IMPLEMENTED

## Summary
Add a "New Chat" button (+ icon) to the Generate App screen that allows users to start a fresh chat conversation. When clicked, the current chat session should be saved to a file for later retrieval, and a new empty chat should be initialized.

The button should be positioned to the left of the Mode dropdown in the chat input area.

---

## Goals
- Enable users to create multiple chat sessions within a single project
- Preserve current chat history before starting a new chat
- Provide clear visual indication of the "new chat" action
- Maintain chat continuity by persisting conversations to disk
- Allow future retrieval of saved chat sessions

---

## Non-Goals
- UI for browsing/loading saved chats (future feature)
- Chat session naming or labeling (future feature)  
- Multi-chat tab interface (future feature)
- Cross-project chat history (out of scope)

---

## UI Changes

### Button Placement
- Add a circular "+" button to the left of the Mode dropdown
- Position: In the input area footer, above the textarea
- Layout: `[+ Button] [Mode: dropdown] [mode description text]`

### Button Styling
- Circular button with "+" icon
- Match existing UI design system (zinc color scheme)
- Size: Similar height to Mode dropdown for visual alignment
- States:
  - Default: zinc-800 background
  - Hover: zinc-700 background
  - Active/Pressed: visual feedback

### Button Behavior
- On click:
  1. Save current chat session to disk
  2. Clear conversation state (messages, summary)
  3. Reset to welcome messages for current mode
  4. Focus the message input textarea

---

## Technical Implementation

### Chat Persistence
- Leverage existing `chatPersistence.ts` utilities
- Save current chat with a date-prefixed filename and unique ID
- File location: Inside project's `.naide/chatsessions/` folder
- Naming convention: `YYYY-MM-DD-chat-{timestamp}-{random}.json`
  - Example: `2026-02-04-chat-1738641825123-a1b2c3.json`
  - Date prefix enables chronological sorting and context
  - Updated: 2026-02-04

### State Management
- Clear `messages` state array
- Reset `conversationSummary` to null
- Reset `chatInitialized` to false
- Maintain current `copilotMode` (don't change mode on new chat)
- Keep `projectName` unchanged

### File Structure
Each saved chat file should contain:
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

## Component Changes

### GenerateAppScreen.tsx
1. Add `handleNewChat` function:
   - Save current session using `saveChatSession`
   - Generate unique chat ID
   - Reset state
   - Initialize with welcome messages

2. Add button UI in input row:
   - Position before Mode selector
   - Wire up onClick handler

3. Update chat loading logic:
   - Ensure saved chats don't auto-load (only load "active" session)
   - Active session: `chat-active.json` or similar

### chatPersistence.ts
1. Add `archiveChatSession` function:
   - Save current session with unique ID
   - Return new session ID

2. Update `saveChatSession` to handle:
   - Active session saves (current behavior)
   - Archived session saves (new behavior)

---

## User Flow

### Starting a New Chat
1. User is in an active chat conversation
2. User clicks the "+" button
3. System saves current chat to disk automatically
4. Chat area clears and shows fresh welcome messages
5. User can start typing immediately
6. Previous chat is preserved and can be loaded later

### Empty Chat Handling
- If current chat has no user messages, clicking "+" does nothing (or shows a subtle indication)
- Don't create empty archived sessions

---

## Future Enhancements
(Not part of this feature, but related)

- Chat history sidebar showing all saved chats
- Click to load a previous chat
- Chat session naming/renaming
- Search across chat history
- Delete archived chats
- Export chat as markdown

---

## Acceptance Criteria
- ✅ "+" button appears to the left of Mode dropdown
- ✅ Button styling matches Naide's design system
- ✅ Clicking button saves current chat to disk
- ✅ Clicking button clears the chat UI
- ✅ New chat initializes with welcome messages for current mode
- ✅ Saved chat file contains all necessary data for future loading
- ✅ Empty chats are not saved (no user messages)
- ✅ App builds and runs successfully
- ✅ No errors in console when creating new chat

---

## Implementation Notes

### Phase 1 (This Feature)
- ✅ Add button UI
- ✅ Implement save-and-reset logic
- ✅ Create archived chat files
- ✅ Test chat state resets properly
- ✅ Updated naming convention to use date prefix (2026-02-04)

### Phase 2 (Future)
- Add chat history UI
- Implement chat loading
- Add chat management (rename, delete)
