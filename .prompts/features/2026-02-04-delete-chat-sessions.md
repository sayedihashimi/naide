---
Status: planned
Area: ui, chat
Created: 2026-02-04
LastUpdated: 2026-02-04
---

# Feature: Delete Chat Sessions
**Status**: 🟡 PLANNED

## Summary
Add the ability to delete archived chat sessions from the chat history dropdown. Users can click a delete icon next to each chat to remove it permanently. If the user deletes the only remaining chat, a new empty chat is automatically created.

---

## Goals
- Allow users to remove unwanted chat sessions from history
- Prevent clutter in chat history
- Use soft-delete (move to trash) to enable recovery if needed
- Provide clear confirmation to avoid accidental deletions
- Maintain usability when last chat is deleted (auto-create new chat)

---

## Non-Goals
- Restore functionality from trash (future enhancement)
- Auto-delete from trash after N days (future enhancement)
- Undo delete functionality (future enhancement)
- Bulk delete operations (future enhancement)
- Export before delete (future enhancement)

---

## Problem Statement
Users accumulate chat sessions over time, and some become irrelevant or cluttered. Currently, there's no way to remove old chats from the history dropdown. This leads to:
- Long, cluttered chat history lists
- Difficulty finding relevant chats
- No way to clean up test/mistake chats
- Potential confusion with many similar-looking chats

Additionally, users may accidentally delete important chats. A soft-delete approach (trash folder) provides a safety net while keeping the history dropdown clean.

---

## Recommended Approach

**Delete Button in Chat History Dropdown**

Add a small delete icon (trash/X) next to each chat item in the existing ChatHistoryDropdown component.

**Why this approach:**
- Most discoverable for non-professional developers
- Familiar pattern (email, file managers)
- Direct and clear action
- No additional UI surfaces needed
- Works within existing dropdown component

---

## Core Behavior

### Delete Button Placement
- **Location:** Right side of each chat item in history dropdown
- **Icon:** Trash icon (Lucide `Trash2` or similar)
- **Size:** Small (16px), subtle color (zinc-500)
- **Hover:** Brighter color (zinc-300), slight scale

### User Flow
1. User opens chat history dropdown
2. User hovers over a chat item → delete icon appears/highlights
3. User clicks delete icon
4. Confirmation dialog appears: "Move this chat to trash?"
5. User confirms → chat file moves to trash, dropdown updates
6. If this was the only chat → new empty chat auto-creates

### Confirmation Dialog
**Title:** "Move Chat to Trash?"

**Message:**
```
This chat will be moved to trash and removed from your history.

Date: [Chat date]
Mode: [Planning/Building/Analyzing]
Messages: [Count]
```

**Buttons:**
- Cancel (default focus)
- Move to Trash (amber/warning style, less aggressive than red)

### Special Case: Last Chat Deletion
**Behavior when deleting the only chat:**
1. Move the chat file to trash
2. Immediately create a new empty chat
3. Load welcome messages for current mode
4. Close dropdown
5. User sees fresh chat, ready to start

**Why auto-create:**
- Prevents "no chat loaded" broken state
- Maintains expected workflow
- User can immediately continue working

### Trash Folder Structure
```
<project-root>/.naide/chatsessions/
├── chat-active.json              (current session)
├── chat-2026-02-01T14-30-45.json
├── chat-2026-02-02T09-15-33.json
└── trash/                         (soft-deleted chats)
    ├── chat-2026-01-28T10-20-15.json
    └── chat-2026-01-30T16-45-22.json
```

**Trash folder behavior:**
- Deleted chats are moved (not copied) to `trash/` subdirectory
- Files in trash are NOT shown in chat history dropdown
- Trash folder is created automatically if it doesn't exist
- Original filenames are preserved

---

## Technical Implementation

### Frontend Changes

**Component:** `ChatHistoryDropdown.tsx`

**Add delete handler:**
```typescript
const handleDeleteChat = async (filename: string, e: React.MouseEvent) => {
  e.stopPropagation(); // Prevent chat selection
  
  // Show confirmation dialog
  const confirmed = await showConfirmDialog({
    title: "Move Chat to Trash?",
    message: `This chat will be moved to trash and removed from your history.`,
    confirmText: "Move to Trash",
    cancelText: "Cancel",
    destructive: false
  });
  
  if (!confirmed) return;
  
  try {
    // Move file to trash
    await invoke('delete_chat_session', { 
      projectPath: actualProjectPath,
      filename 
    });
    
    // Refresh chat list
    await loadChatList();
    
    // Check if we just deleted the active chat or the only chat
    if (isActiveChat(filename) || chatList.length === 0) {
      // Create new empty chat
      handleNewChat();
    }
    
    // Show success toast (optional)
    showToast({ message: "Chat moved to trash", type: "success" });
    
  } catch (error) {
    console.error('Failed to move chat to trash:', error);
    showToast({ message: "Failed to move chat to trash", type: "error" });
  }
};
```

**Update chat item rendering:**
```tsx
<div className="chat-item" onClick={() => handleLoadChat(chat.filename)}>
  {/* Existing chat info */}
  <div className="chat-info">
    <span className="chat-date">{formatDate(chat.lastModified)}</span>
    <span className="chat-preview">{chat.firstUserMessage}</span>
  </div>
  
  {/* Delete button */}
  <button
    className="delete-button"
    onClick={(e) => handleDeleteChat(chat.filename, e)}
    aria-label="Delete chat"
  >
    <Trash2 size={16} />
  </button>
</div>
```

**Styling considerations:**
- Delete button hidden by default, shows on hover
- Use `stopPropagation()` to prevent chat selection when clicking delete
- Red hover state for destructive action
- Smooth fade-in animation

---

### Backend Changes (Tauri)

**New command:** `delete_chat_session`

**File:** `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn delete_chat_session(
    project_path: String,
    filename: String
) -> Result<(), String> {
    // Validate filename (security: prevent path traversal)
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename".to_string());
    }
    
    // Construct paths
    let chatsessions_dir = Path::new(&project_path)
        .join(".naide")
        .join("chatsessions");
    
    let source_path = chatsessions_dir.join(&filename);
    let trash_dir = chatsessions_dir.join("trash");
    let dest_path = trash_dir.join(&filename);
    
    // Check source file exists
    if !source_path.exists() {
        return Err("Chat file not found".to_string());
    }
    
    // Create trash directory if it doesn't exist
    if !trash_dir.exists() {
        fs::create_dir_all(&trash_dir)
            .map_err(|e| format!("Failed to create trash directory: {}", e))?;
    }
    
    // Move the file to trash
    fs::rename(&source_path, &dest_path)
        .map_err(|e| format!("Failed to move file to trash: {}", e))?;
    
    log::info!("Moved chat session to trash: {}", filename);
    
    Ok(())
}
```

**Register command:**
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... existing commands
        delete_chat_session,
    ])
```

---

### Confirmation Dialog Component

**Create reusable component:** `ConfirmDialog.tsx`

```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button onClick={onCancel} autoFocus>
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={destructive ? "destructive" : ""}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## UI/UX Details

### Delete Button Styling
- **Default:** Invisible or very subtle (zinc-600)
- **Hover (item):** Visible (zinc-500)
- **Hover (button):** Bright and red (red-400)
- **Active:** Slightly darker red (red-500)
- **Size:** 16px icon, 24px clickable area (includes padding)
- **Position:** Absolute right, vertically centered

### Chat Item Layout
```
┌────────────────────────────────────────────────┐
│ Today at 2:30 PM                     [Trash]   │
│ Planning • 12 messages                         │
│ Add dark mode toggle to the app...            │
└────────────────────────────────────────────────┘
```

### Confirmation Dialog Styling
- **Overlay:** Semi-transparent dark (zinc-900/80)
- **Dialog:** Centered, zinc-800 background
- **Width:** 400px max
- **Border:** Subtle zinc-700
- **Shadow:** Large drop shadow
- **Buttons:** 
  - Cancel: Secondary style, default focus
  - Delete: Red background, white text

### Animations
- Delete button: Fade in on hover (150ms)
- Confirmation dialog: Fade + scale in (200ms)
- Chat item removal: Fade out (150ms)

---

## Error Handling

### File Move Errors
**Scenario:** File doesn't exist, permission denied, or trash directory creation fails

**Behavior:**
- Show error toast: "Failed to move chat to trash"
- Log error details to console
- Keep dropdown open
- Chat remains in list (allow retry)

### Network/State Errors
**Scenario:** State becomes inconsistent (deleted file still in list)

**Behavior:**
- Refresh chat list from file system
- If file gone, remove from UI
- If file still there, keep in list

### Active Chat Deletion
**Scenario:** User deletes the currently open chat

**Behavior:**
- Move the file to trash
- Create new empty chat
- Load welcome messages
- Close dropdown
- Smooth transition (no broken state)

---

## Edge Cases

### Deleting While Chat is Sending
**Behavior:**
- Disable delete button while message is in flight
- Or: Allow delete, but warn "Delete chat with unsaved message?"

### Rapid Deletions
**Behavior:**
- Debounce delete operations
- Disable delete button during deletion
- Prevent double-delete attempts

### No Chats Remaining
**Behavior:**
- Automatically create new empty chat
- Show welcome messages
- Dropdown shows empty state next time

### Deleting from Different Instance
**Behavior:**
- If file is moved to trash externally, handle gracefully
- Show "Chat no longer exists" if load fails
- Refresh list automatically

### Trash Directory Management
**Behavior:**
- Trash directory is created automatically on first delete
- If trash directory is deleted externally, recreate it on next delete
- Files in trash are never shown in chat history dropdown
- Trash folder location: `.naide/chatsessions/trash/`

---

## Security Considerations

### Path Validation
- **Validate filename:** No path traversal (`../`, `..\\`)
- **Restrict to chatsessions:** Only move files from `.naide/chatsessions/` to `.naide/chatsessions/trash/`
- **No arbitrary paths:** User cannot specify full paths

### Confirmation Required
- **Always confirm:** No "delete without confirmation" option (in MVP)
- **Clear messaging:** Make it clear chat goes to trash (not permanent deletion)

### Permissions
- **Check write access:** Verify user has permission to delete
- **Error handling:** Graceful failure if permission denied

---

## Acceptance Criteria

- [ ] Delete icon appears next to each chat in history dropdown
- [ ] Delete icon is subtle by default, prominent on hover
- [ ] Clicking delete icon shows confirmation dialog
- [ ] Confirmation dialog shows chat details (date, mode, message count)
- [ ] Clicking "Cancel" closes dialog, no changes made
- [ ] Clicking "Move to Trash" moves chat file to trash folder
- [ ] After deletion, dropdown updates (chat removed from list)
- [ ] Trash folder is created automatically if it doesn't exist
- [ ] If deleting active chat, new empty chat is created
- [ ] If deleting only chat, new empty chat is created
- [ ] Error toast shows if move to trash fails
- [ ] Files in trash folder do not appear in chat history dropdown
- [ ] Success toast shows on successful deletion (optional)
- [ ] Clicking delete does NOT trigger chat selection
- [ ] Keyboard support: ESC closes confirmation dialog
- [ ] UI matches Naide's design system (dark theme, zinc colors)
- [ ] No console errors or warnings

---

## Testing Strategy

### Unit Tests
- Filename validation (prevent path traversal)
- Delete handler logic (state updates)
- Confirmation dialog behavior

### Integration Tests
1. **Delete archived chat:**
   - Open dropdown, delete a chat
   - Verify file moved to trash folder (not deleted)
   - Verify chat removed from dropdown list
   - Verify file exists in `.naide/chatsessions/trash/`

2. **Delete active chat:**
   - Open a chat, then delete it from history
   - Verify new chat is created
   - Verify welcome messages appear

3. **Delete only chat:**
   - With one chat in history, delete it
   - Verify new empty chat is created
   - Verify no broken state

4. **Cancel deletion:**
   - Click delete, then cancel
   - Verify chat is NOT deleted
   - Verify file still exists

5. **Error handling:**
   - Simulate permission error
   - Verify error toast appears
   - Verify chat remains in list

6. **Trash folder creation:**
   - Delete trash folder manually
   - Delete a chat
   - Verify trash folder is recreated automatically
   - Verify file is moved to trash successfully

### Manual Testing
- [ ] Test delete button visibility (hover states)
- [ ] Test confirmation dialog appearance
- [ ] Test successful deletion (file moved to trash)
- [ ] Test trash folder creation (if doesn't exist)
- [ ] Verify files in trash don't appear in dropdown
- [ ] Test error scenarios (permission denied)
- [ ] Test keyboard navigation (ESC to cancel)
- [ ] Test with 1, 5, 20 chats in history
- [ ] Test deleting active vs inactive chats
- [ ] Verify no memory leaks (many deletions)

---

## Future Enhancements

### Phase 2: Trash Management UI
- Add "View Trash" option in chat history dropdown or settings
- Display list of trashed chats with restore option
- Add "Empty Trash" button to permanently delete all trashed chats
- Add "Restore" button next to each trashed chat
- Auto-delete from trash after 30 days (configurable)

### Phase 3: Undo Delete
- Keep deleted file in memory for 10 seconds
- Show "Undo" toast after deletion
- Restore file if user clicks undo

### Phase 4: Bulk Delete
- Checkboxes to select multiple chats
- "Delete Selected" button
- Confirmation shows count (e.g., "Delete 5 chats?")

### Phase 5: Export Before Delete
- "Export before deleting" checkbox in confirmation
- Save chat as markdown to user-selected location
- Then proceed with deletion

---

## Files to Modify

### Frontend
- `src/components/ChatHistoryDropdown.tsx` - Add delete button and handler
- `src/components/ConfirmDialog.tsx` - New component (create)
- `src/pages/GenerateAppScreen.tsx` - Handle active chat deletion, auto-create new chat

### Backend
- `src-tauri/src/lib.rs` - Add `delete_chat_session` command

### Utilities
- `src/utils/chatPersistence.ts` - Optional: add `deleteChatSession` wrapper

---

## Dependencies

### Frontend
- Existing `ChatHistoryDropdown` component
- Lucide React for Trash2 icon
- Toast notification system (or create simple one)

### Backend
- Tauri `fs` plugin (already configured)
- Path validation logic

---

## Related Features
- [2026-02-03-chat-history-viewer.md](./2026-02-03-chat-history-viewer.md) - Chat history dropdown (base feature)
- [2026-02-01-new-chat-button.md](./2026-02-01-new-chat-button.md) - New chat creation logic (reused for auto-create)
- [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) - Chat session structure

---

created by naide
