# Chat History Viewer - Visual Guide

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Naide - Generate App Screen                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Chat Messages Area]                                           │
│                                                                  │
│  Welcome to Planning Mode...                                    │
│  What would you like to plan or refine?                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Input Area                                                      │
│                                                                  │
│  [+] [🕐] Mode: [Planning ▼] (Create/update specs only)        │
│   ↑    ↑                                                        │
│   │    └─ NEW: Clock icon button (Chat History)                │
│   └────── New Chat button                                       │
│                                                                  │
│  [Text input area...]                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## When Clock Icon is Clicked

The dropdown opens **upward** (above the button) to ensure maximum visibility of chat history items:

```
┌─────────────────────────────────────────────────────────────────┐
│       ┌─────────────────────────────────────────────────────────┐
│       │ Chat History                                            │
│       ├─────────────────────────────────────────────────────────┤
│       │ ┌─────────────────────────────────────────────────────┐ │
│       │ │ Today at 2:30 PM                                    │ │
│       │ │ Planning • 12 messages                              │ │
│       │ │ How do I add authentication to my app?              │ │
│       │ └─────────────────────────────────────────────────────┘ │
│       │ ┌─────────────────────────────────────────────────────┐ │
│       │ │ Yesterday                                           │ │
│       │ │ Building • 8 messages                               │ │
│       │ │ Create a login page with email and password         │ │
│       │ └─────────────────────────────────────────────────────┘ │
│       │ ┌─────────────────────────────────────────────────────┐ │
│       │ │ Feb 1, 2026                                         │ │
│       │ │ Planning • 15 messages                              │ │
│       │ │ I need help planning a todo list application        │ │
│       │ └─────────────────────────────────────────────────────┘ │
│       └─────────────────────────────────────────────────────────┘
│       ↑
│  [+] [🕐] Mode: [Planning ▼] (Create/update specs only)        │
│       │ └─────────────────────────────────────────────────────┘ │
│       └─────────────────────────────────────────────────────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Empty State

The dropdown opens upward, showing the empty state:

```
┌─────────────────────────────────────────────────────────────────┐
│       ┌─────────────────────────────────────────────────────────┐
│       │ Chat History                                            │
│       ├─────────────────────────────────────────────────────────┤
│       │                                                         │ │
│       │              No archived chats yet                      │ │
│       │                                                         │ │
│       └─────────────────────────────────────────────────────────┘
│       ↑
│  [+] [🕐] Mode: [Planning ▼] (Create/update specs only)        │
└─────────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Mode Badge Colors
- **Planning**: Green (`text-green-400`)
- **Building**: Blue (`text-blue-400`)
- **Analyzing**: Purple (`text-purple-400`)

### Dropdown Styling
- Background: `bg-zinc-800`
- Border: `border-zinc-700`
- Hover state: `hover:bg-zinc-700`
- Text hierarchy:
  - Date: `text-sm font-semibold text-gray-200`
  - Mode/count: `text-xs text-gray-500`
  - Preview: `text-xs text-zinc-400`

### Button Styling
- Clock icon button matches "New Chat" button styling
- Size: `w-8 h-8`
- Background: `bg-zinc-800`
- Hover: `hover:bg-zinc-700`
- Active: `active:bg-zinc-600`
- Rounded: `rounded-full`

## User Interactions

### 1. Click Clock Icon
**Action**: User clicks the clock icon button  
**Result**: Dropdown appears below the button, loading state shows briefly, then chat list appears

### 2. Click Chat Item
**Action**: User clicks on a chat session in the list  
**Flow**:
1. Current chat auto-saves (if it has user messages)
2. Selected chat loads from disk
3. Messages, mode, and summary restore
4. Dropdown closes
5. Textarea focuses for immediate interaction

### 3. Click Outside Dropdown
**Action**: User clicks anywhere outside the dropdown  
**Result**: Dropdown closes immediately

### 4. Press ESC Key
**Action**: User presses ESC key while dropdown is open  
**Result**: Dropdown closes immediately

### 5. Hover Over Chat Item
**Action**: User hovers over a chat item  
**Result**: Background changes to `zinc-700` (lighter gray)

## Date Formatting Examples

| Timestamp | Display |
|-----------|---------|
| Same day, 2:30 PM | "Today at 2:30 PM" |
| Previous day | "Yesterday" |
| 2 days ago (Monday) | "Monday" |
| 1 week ago | "Jan 27, 2026" |
| Different month | "Feb 1, 2026" |

## Message Preview Truncation

**Original**: "I need help building a comprehensive todo list application with authentication, user profiles, and real-time updates"

**Truncated**: "I need help building a comprehensive todo list a..."

- Maximum length: 50 characters
- Adds "..." if truncated
- Shows first user message from the chat

## Technical Details

### Dropdown Positioning
- `position: absolute`
- `bottom: full` (above the button - opens upward)
- `left: 0` (aligned with button)
- `z-index: 50` (appears above other content)
- `margin-bottom: 0.5rem` (spacing from button)

### Scrolling
- Maximum height: `max-h-96` (384px / ~6 items)
- Overflow: `overflow-y-auto` (scrollable when needed)
- Minimum width: `w-96` (384px)

### Loading State
Shows: "Loading chat history..." centered in dropdown

### Error State
Shows: "Failed to load chat history" in red (`text-red-400`)

## Implementation Files

1. **ChatHistoryDropdown.tsx** - Main component
2. **GenerateAppScreen.tsx** - Integration point
3. **lib.rs** - Backend commands
4. **chatPersistence.ts** - Data loading utilities
