---
Status: planned
Area: ui, chat
Created: 2026-02-09
LastUpdated: 2026-02-09
---

# Feature: Favorite Chat Sessions
**Status**: 🟡 PLANNED

## Summary
Allow users to mark chat sessions as favorites using a star icon. Favorited chats appear at the top of the Chat History dropdown, separated from non-favorited chats. The star icon is available both in the dropdown (next to each chat) and in the active chat's header area. Favorite state is persisted in `.naide/project-config.json`.

---

## Goals
- Let users mark important chat sessions as favorites for quick access
- Surface favorited chats at the top of the Chat History dropdown
- Provide toggling from both the dropdown and the active chat view
- Persist favorites per-project across app restarts

---

## Non-Goals
- Pinning chats to a separate sidebar or panel
- Sorting favorites by any criteria other than last modified date
- Confirmation dialog when unfavoriting
- Limiting the number of favorites
- Favoriting the active (unsaved) chat before it's archived

---

## Problem Statement
As users accumulate many chat sessions, finding important conversations becomes difficult. The Chat History dropdown shows all archived chats sorted by date, but there's no way to mark key conversations for quick retrieval. Users may have planning discussions or decisions they frequently reference, and these get buried under newer chats.

---

## Core Behavior

### Star Icon in Chat History Dropdown

**Placement**: Left side of each chat item, before the date text.

**Appearance**:
- **Not favorited**: Outline star icon (Lucide `Star`), subtle color (`text-zinc-600`)
- **Favorited**: Filled star icon (Lucide `Star` with `fill="currentColor"`), gold/yellow color (`text-yellow-400`)
- **Hover (not favorited)**: Outline star brightens (`text-zinc-400`)
- **Size**: 16px icon, minimum 24×24px clickable area

**Click behavior**:
- Clicking the star **toggles** the favorite state immediately
- Clicking the star does **not** trigger chat selection (use `stopPropagation`)
- No confirmation dialog for favoriting or unfavoriting
- The dropdown stays open and the list reorders immediately

### Star Icon in Chat View Header

**Placement**: In the chat header area, near the "New Chat" (+) and "Chat History" (clock) buttons. Positioned to the right of the chat history button.

**Appearance**:
- Same styling as dropdown: outline when not favorited, filled gold when favorited
- **Only visible when viewing an archived chat** (a chat that has been saved and has a filename)
- **Hidden for the initial/new chat** that hasn't been archived yet (there's no file to associate the favorite with)

**Click behavior**:
- Toggles favorite state for the currently loaded chat
- Updates the dropdown list if it's open

### Dropdown List Ordering

The Chat History dropdown is divided into two visual sections:

1. **Favorites section** (top):
   - All favorited chats, sorted by **last modified date** (most recent first)
   - Each item shows the filled star icon
   - A subtle visual separator (thin line or slight spacing) below this section

2. **Other chats section** (below):
   - All non-favorited chats, sorted by **last modified date** (most recent first)
   - Each item shows the outline star icon

If there are no favorites, the separator is not shown and the list appears as it does today.

### Visual Separator

Between the favorites section and the other chats section:
- A thin horizontal line (`border-b border-zinc-700`) with small vertical margin (`my-1`)
- Only rendered when there is at least one favorite AND at least one non-favorite

---

## Persistence

### Storage Location
`.naide/project-config.json` (existing per-project config file)

### Schema Addition
Add a `favoriteSessions` array to the existing `ProjectConfig`:

```typescript
interface ProjectConfig {
  projectName?: string;
  lastChatSession?: string | null;
  selectedApp?: { ... };
  openTabs?: PersistedTabsState;
  favoriteSessions?: string[];  // NEW: array of favorite chat filenames
}
```

**Example:**
```json
{
  "projectName": "my-project",
  "lastChatSession": "chat-active.json",
  "favoriteSessions": [
    "2026-02-08-chat-1738972800000-abc123.json",
    "2026-02-05-chat-1738713600000-def456.json"
  ],
  "selectedApp": { ... },
  "openTabs": { ... }
}
```

### Persistence Logic
- **On favorite toggle**: Read current `project-config.json`, add/remove the filename from `favoriteSessions`, write back
- **On load**: Read `favoriteSessions` array, use it to determine star state for each chat in the dropdown
- **Stale entries**: If a favorited chat file no longer exists (deleted or moved to trash), silently ignore it during display. Optionally clean up stale entries when writing.
- **Non-fatal**: If read/write fails, continue without persistence. Log a warning.

### Read/Write Pattern
Follow the same merge pattern used in `tabPersistence.ts`:
1. Read existing `project-config.json`
2. Update only the `favoriteSessions` field
3. Preserve all other fields
4. Write back the merged config

---

## Technical Implementation

### Frontend Changes

#### New Utility: `favoritePersistence.ts`

Create a new utility (or extend `tabPersistence.ts`) for favorite operations:

```typescript
// src/naide-desktop/src/utils/favoritePersistence.ts

export async function loadFavoriteSessions(projectPath: string): Promise<string[]>;
export async function saveFavoriteSessions(projectPath: string, favorites: string[]): Promise<void>;
export async function toggleFavoriteSession(projectPath: string, filename: string): Promise<string[]>;
```

**`loadFavoriteSessions`**: Reads `project-config.json`, returns the `favoriteSessions` array (or empty array if not present).

**`saveFavoriteSessions`**: Merges the `favoriteSessions` array into `project-config.json`, preserving other fields.

**`toggleFavoriteSession`**: Loads current favorites, adds or removes the given filename, saves, and returns the updated array.

#### ChatHistoryDropdown Changes

**File**: `src/naide-desktop/src/components/ChatHistoryDropdown.tsx`

**New props:**
```typescript
interface ChatHistoryDropdownProps {
  // ... existing props
  favoriteSessions: string[];
  onToggleFavorite: (filename: string) => void;
}
```

**Rendering changes:**
1. Split `chatSessions` into two lists: `favoritedChats` and `otherChats`
2. Render favorites section first (if any favorites exist)
3. Render separator line (if both sections have items)
4. Render other chats section
5. Add star icon button to each chat item (left of date text)

**Star icon rendering:**
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    onToggleFavorite(chat.filename);
  }}
  className="flex-shrink-0 p-1"
  aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
>
  <Star
    size={16}
    className={isFavorited
      ? "text-yellow-400 fill-yellow-400"
      : "text-zinc-600 hover:text-zinc-400"
    }
  />
</button>
```

#### GenerateAppScreen Changes

**File**: `src/naide-desktop/src/pages/GenerateAppScreen.tsx`

**New state:**
```typescript
const [favoriteSessions, setFavoriteSessions] = useState<string[]>([]);
const [currentChatFilename, setCurrentChatFilename] = useState<string | null>(null);
```

Note: `currentChatFilename` tracks which archived chat file is currently loaded. This is needed to show the star in the chat header and to know which file to favorite. It's `null` for a new/unsaved chat.

**Load favorites on mount / project change:**
```typescript
useEffect(() => {
  if (state.projectPath) {
    loadFavoriteSessions(state.projectPath).then(setFavoriteSessions);
  }
}, [state.projectPath]);
```

**Toggle handler:**
```typescript
const handleToggleFavorite = async (filename: string) => {
  if (!state.projectPath) return;
  const updated = await toggleFavoriteSession(state.projectPath, filename);
  setFavoriteSessions(updated);
};
```

**Pass to ChatHistoryDropdown:**
```tsx
<ChatHistoryDropdown
  // ... existing props
  favoriteSessions={favoriteSessions}
  onToggleFavorite={handleToggleFavorite}
/>
```

**Star in chat header:**
Add a star button next to the Chat History button, visible only when `currentChatFilename` is not null:

```tsx
{currentChatFilename && (
  <button
    onClick={() => handleToggleFavorite(currentChatFilename)}
    className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
    title={favoriteSessions.includes(currentChatFilename)
      ? "Remove from favorites"
      : "Add to favorites"
    }
  >
    <Star
      size={18}
      className={favoriteSessions.includes(currentChatFilename)
        ? "text-yellow-400 fill-yellow-400"
        : "text-zinc-500 hover:text-zinc-300"
      }
    />
  </button>
)}
```

**Track current chat filename:**
- When `handleLoadChat` loads an archived chat, set `currentChatFilename` to the loaded filename
- When `handleNewChat` creates a new chat, set `currentChatFilename` to `null`
- When `archiveChatSession` saves the current chat (e.g., on New Chat click), the returned filename can optionally be stored, but the new chat starts with `null`

### Backend Changes

No backend (Rust) changes required. The `project-config.json` file is already read/written from the frontend using existing Tauri file system commands (`readTextFile`, `writeTextFile`). The favorite persistence follows the same pattern as `tabPersistence.ts`.

---

## UI/UX Details

### Chat Item Layout (Updated)

```
Favorited:
┌──────────────────────────────────────────────────┐
│ ★  Today at 2:30 PM                      [🗑]   │
│    Planning • 12 messages                        │
│    Add dark mode toggle to the app...            │
└──────────────────────────────────────────────────┘

Not favorited:
┌──────────────────────────────────────────────────┐
│ ☆  Yesterday                              [🗑]   │
│    Building • 8 messages                         │
│    Implement the login component...              │
└──────────────────────────────────────────────────┘
```

### Dropdown Layout (with favorites)

```
┌──────────────────────────────────────────────┐
│ ★  Today at 2:30 PM                    [🗑] │  ← Favorite
│    Planning • 12 messages                    │
│    Add dark mode toggle to the app...        │
├──────────────────────────────────────────────┤
│ ★  Feb 5, 2026                         [🗑] │  ← Favorite
│    Building • 24 messages                    │
│    Set up authentication system...           │
├──────────────────────────────────────────────┤  ← Separator
│ ☆  Today at 11:00 AM                  [🗑] │  ← Non-favorite
│    Planning • 3 messages                     │
│    Quick question about routing...           │
├──────────────────────────────────────────────┤
│ ☆  Yesterday                           [🗑] │  ← Non-favorite
│    Building • 8 messages                     │
│    Implement login component...              │
└──────────────────────────────────────────────┘
```

### Chat Header Area

```
[+ New Chat] [🕐 History] [★ Favorite]  Mode: [Planning ▼]
```

The star button appears after the history button and is only visible when viewing an archived/loaded chat.

---

## Edge Cases

### Favorite a Chat, Then Delete It
- When a favorited chat is deleted (moved to trash), it disappears from the dropdown
- The filename remains in `favoriteSessions` array but is harmlessly ignored (no matching chat to display)
- Optionally: clean up stale entries when saving favorites

### Load a Favorited Chat, Then Unfavorite from Header
- Unfavoriting from the header immediately updates the `favoriteSessions` state
- If the dropdown is open, the chat moves from favorites section to the other section
- The star in the header changes to outline

### New Chat (No Filename Yet)
- The star icon in the chat header is **hidden** because there's no archived file to associate the favorite with
- Once the chat is archived (via New Chat or project switch), it gets a filename and can be favorited from the dropdown

### All Chats Are Favorited
- No separator line shown (no "other" section)
- List appears the same as today, just with filled stars

### No Chats Are Favorited
- No separator line shown (no "favorites" section)
- List appears the same as today, just with outline stars

### Project Switch
- Favorites are per-project (stored in project's `project-config.json`)
- Switching projects loads that project's favorites
- State resets to the new project's favorites

---

## Acceptance Criteria

- [ ] Star icon (outline) appears on each chat item in the Chat History dropdown
- [ ] Clicking the star toggles between outline (not favorited) and filled gold (favorited)
- [ ] Clicking the star does NOT select/load the chat
- [ ] Favorited chats appear at the top of the dropdown, sorted by last modified date
- [ ] Non-favorited chats appear below, sorted by last modified date
- [ ] A subtle separator line divides favorites from non-favorites (when both exist)
- [ ] Star icon appears in the chat header when viewing an archived/loaded chat
- [ ] Star icon is hidden in the chat header for new/unsaved chats
- [ ] Clicking the header star toggles favorite for the currently loaded chat
- [ ] Favorites are persisted in `.naide/project-config.json` as a `favoriteSessions` string array
- [ ] Favorites persist across app restarts
- [ ] Favorites are per-project (different projects have independent favorites)
- [ ] Deleting a favorited chat removes it from the dropdown (stale entry harmlessly ignored)
- [ ] Dropdown stays open after toggling a favorite
- [ ] No confirmation dialog for favorite/unfavorite actions
- [ ] App builds and all existing tests pass
- [ ] No console errors or warnings

---

## Files to Create

- `src/naide-desktop/src/utils/favoritePersistence.ts` — Load/save/toggle favorite sessions

## Files to Modify

### Frontend
- `src/naide-desktop/src/components/ChatHistoryDropdown.tsx` — Add star icon, split list into favorites/other sections, accept new props
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Add favorite state, track current chat filename, add star to header, pass props to dropdown

---

## Testing Strategy

### Unit Tests
- `favoritePersistence.ts`: Load returns empty array when no config, toggle adds/removes correctly, save merges without overwriting other fields
- `ChatHistoryDropdown`: Favorites render above non-favorites, separator appears only when both sections exist

### Manual Testing
- [ ] Open dropdown, click star on a chat → star fills, chat moves to top
- [ ] Click filled star → star outlines, chat moves to non-favorites section
- [ ] Load an archived chat → star appears in header
- [ ] Click header star → toggles favorite state
- [ ] Create new chat → header star is hidden
- [ ] Restart app → favorites are preserved
- [ ] Switch projects → favorites change to match project
- [ ] Delete a favorited chat → removed from dropdown, no errors
- [ ] Favorite multiple chats → all appear in favorites section, sorted by date

---

## Dependencies

### Frontend
- Lucide React `Star` icon (already available)
- Existing Tauri file system utilities (already in use for project-config.json)

### Backend
- No new backend changes needed

---

## Related Features
- [2026-02-03-chat-history-viewer.md](./2026-02-03-chat-history-viewer.md) — Chat history dropdown (base feature)
- [2026-02-04-delete-chat-sessions.md](./2026-02-04-delete-chat-sessions.md) — Delete interaction with favorites
- [2026-02-01-new-chat-button.md](./2026-02-01-new-chat-button.md) — New chat resets favorite header state

---

created by naide
