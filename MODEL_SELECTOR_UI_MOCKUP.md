# Model Selector UI Mockup

## Location
The Model selector is located in the chat input area, positioned to the LEFT of the existing Mode dropdown.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chat Header Area                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [+ New Chat] [🕐 History]  ⭐ (if archived chat)                  │
│                                                                     │
│  Model: [Claude Opus 4.5 ▾]    Mode: [Planning ▼]                 │
│         └─────────────────┘          └──────────┘                  │
│           NEW DROPDOWN                EXISTING                      │
│                                                                     │
│  Planning: Create/update specs and plans without code changes      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │  Type your message here...                                     │ │
│  │                                                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  [Send] [Stop]                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Dropdown States

### Loading State
```
Model: [Loading...] (disabled, gray text)
```

### Error State
```
Model: [Error] (red text)
```

### Normal State (Expanded)
```
Model: [Claude Opus 4.5 ▾]
       ┌─────────────────────────┐
       │ Claude Opus 4.5        │ ← Selected
       │ Claude Opus 4          │
       │ Claude Sonnet 4.5      │
       │ GPT-4o                 │
       │ GPT-4                  │
       │ O1 Preview             │
       └─────────────────────────┘
```

## Styling

### Model Selector
- **Background:** `bg-zinc-900` (dark gray)
- **Border:** `border-zinc-700` (medium gray)
- **Text:** `text-gray-100` (light gray)
- **Size:** `text-sm` (small)
- **Padding:** `px-2 py-1` (compact)
- **Focus:** `focus:ring-2 focus:ring-blue-500` (blue outline on focus)

### Label
- **Text:** "Model:"
- **Style:** `text-sm text-gray-400`
- **Position:** Left of dropdown

### Error State
- **Text:** "Error"
- **Style:** `text-xs text-red-400`

### Loading State
- **Text:** "Loading..."
- **Style:** `text-xs text-gray-500`

## Behavior

1. **On Mount:**
   - Shows "Loading..." while fetching models
   - Fetches models from sidecar
   - Loads saved selection or uses default
   - Populates dropdown with models

2. **On Change:**
   - Updates state immediately
   - Saves to global settings (async)
   - Logs the change
   - Used in next chat request

3. **On Error:**
   - Shows "Error" text
   - App continues to work with SDK default
   - Can be retried by restarting app

## Example User Flow

1. User opens app for first time
2. Model selector shows "Loading..."
3. Models are fetched (Claude Opus 4.5, GPT-4o, etc.)
4. Dropdown shows "Claude Opus 4.5" (default)
5. User sends messages → uses Claude Opus 4.5
6. User changes to "GPT-4o"
7. Selection is saved to settings
8. User sends messages → uses GPT-4o
9. User closes app
10. User reopens app
11. Model selector shows "GPT-4o" (restored from settings)

## Integration with Existing UI

The model selector fits naturally into the existing chat interface:
- **Consistent styling** with Mode dropdown
- **Similar size and layout**
- **Non-intrusive placement**
- **Follows existing patterns**

The UI maintains the app's clean, professional aesthetic while adding powerful functionality.
