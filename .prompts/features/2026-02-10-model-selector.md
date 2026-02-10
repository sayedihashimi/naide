---
Status: planned
Area: ui, copilot, settings
Created: 2026-02-10
LastUpdated: 2026-02-10
---

# Feature: Model Selector — Dynamic Model Discovery and User Selection
**Status**: 🟡 PLANNED

## Summary
Add a model selector dropdown next to the existing Mode dropdown so users can choose which AI model to use. Available models are discovered dynamically from the Copilot SDK. The selected model is a global setting persisted across sessions. Default selection prefers Claude Opus 4.5, falling back to the highest Claude Opus version, then the SDK default.

---

## Goals
- Allow users to choose which AI model powers their Copilot interactions
- Discover available models dynamically from the Copilot SDK
- Display models with friendly names (not raw model IDs)
- Persist the selected model globally across sessions and projects
- Provide sensible defaults with a clear fallback chain

---

## Non-Goals
- Per-project or per-chat model settings
- Model performance comparison or recommendations
- Cost or token limit information per model
- Model parameter tuning (temperature, max tokens, etc.)

---

## Problem Statement
The Copilot model is hardcoded to `gpt-4o` in the sidecar (`src/copilot-sidecar/src/index.ts`, lines 691 and 1161). Users have no way to select or change the model. As new and better models become available, users are stuck on a single hardcoded option with no visibility or control.

---

## Current Behavior

The sidecar creates Copilot sessions with a hardcoded model string:

```typescript
// Line 691 (streaming endpoint)
const session = await copilotClient.createSession({
  model: 'gpt-4o',
  // ...
});

// Line 1161 (non-streaming endpoint)
const session = await copilotClient.createSession({
  model: 'gpt-4o',
  // ...
});
```

No model discovery, user selection, or fallback logic exists.

---

## Core Behavior

### Model Discovery
- Use the Copilot SDK to discover available models (the SDK should offer a method for this)
- Expose a new endpoint: `GET /api/models` that returns the list of available models with friendly names
- Map model IDs to friendly display names (e.g., `claude-opus-4.5` → `Claude Opus 4.5`)

### Default Model Selection Logic
Priority order for default selection:
1. **Claude Opus 4.5** — if available in the model list
2. **Highest Claude Opus version** — if Opus 4.5 is not available, pick the highest versioned Claude Opus model
3. **SDK default** — if no Claude Opus model is available, fall back to the Copilot SDK's default

### Model Selector UI
- Add a dropdown **next to the existing Mode dropdown** in the chat input area
- Display models with friendly names
- Selected model is a **global** setting (persisted in `naide-settings.json`, not per-project)
- On error (model list fetch fails): show an error state and fall back to SDK default

### Request Flow
1. Frontend fetches available models from `GET /api/models` on startup
2. User selects a model (or default is applied)
3. On each chat request, the selected model ID is included in the request body
4. Sidecar passes the model to `createSession()` instead of the hardcoded value
5. If no model is specified in the request, sidecar uses the default selection logic

---

## Technical Implementation

### Sidecar Changes (`src/copilot-sidecar/src/index.ts`)

#### New Endpoint: `GET /api/models`
```typescript
app.get('/api/models', async (req, res) => {
  try {
    const models = await copilotClient.listModels(); // or equivalent SDK method
    const modelList = models.map(m => ({
      id: m.id,
      friendlyName: getFriendlyModelName(m.id),
    }));
    res.json({ models: modelList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to discover models' });
  }
});
```

#### Friendly Name Mapping
```typescript
function getFriendlyModelName(modelId: string): string {
  const knownNames: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'claude-opus-4.5': 'Claude Opus 4.5',
    'claude-sonnet-4': 'Claude Sonnet 4',
    // ... extend as models become available
  };
  return knownNames[modelId] || modelId;
}
```

#### Accept Model in Request Bodies
Update both `/api/copilot/stream` and `/api/copilot/chat` to accept an optional `model` field:
```typescript
const { mode, message, workspaceRoot, model, ...rest } = req.body;

const session = await copilotClient.createSession({
  model: model || getDefaultModel(availableModels),
  // ...
});
```

#### Default Model Selection
```typescript
function getDefaultModel(availableModels: string[]): string {
  // 1. Prefer Claude Opus 4.5
  if (availableModels.includes('claude-opus-4.5')) return 'claude-opus-4.5';
  
  // 2. Highest Claude Opus version
  const opusModels = availableModels
    .filter(m => m.startsWith('claude-opus'))
    .sort()
    .reverse();
  if (opusModels.length > 0) return opusModels[0];
  
  // 3. SDK default (don't specify model, let SDK choose)
  return '';
}
```

### Frontend Changes (`GenerateAppScreen.tsx`)

#### New State
```typescript
const [availableModels, setAvailableModels] = useState<Array<{id: string, friendlyName: string}>>([]);
const [selectedModel, setSelectedModel] = useState<string>('');
const [modelLoadError, setModelLoadError] = useState<boolean>(false);
```

#### Fetch Models on Startup
```typescript
useEffect(() => {
  fetch('http://localhost:3001/api/models')
    .then(res => res.json())
    .then(data => {
      setAvailableModels(data.models);
      // Load saved selection or apply default
      const saved = await loadSelectedModel();
      if (saved && data.models.some(m => m.id === saved)) {
        setSelectedModel(saved);
      } else {
        setSelectedModel(getDefaultModelId(data.models));
      }
    })
    .catch(() => setModelLoadError(true));
}, []);
```

#### Dropdown UI (Next to Mode Dropdown)
```tsx
<select
  value={selectedModel}
  onChange={(e) => {
    setSelectedModel(e.target.value);
    saveSelectedModel(e.target.value);
  }}
  className="bg-zinc-800 text-gray-300 text-sm rounded px-2 py-1 border border-zinc-700"
>
  {availableModels.map(m => (
    <option key={m.id} value={m.id}>{m.friendlyName}</option>
  ))}
</select>
```

#### Pass Model to Requests
Include the selected model in the fetch body for streaming and non-streaming requests:
```typescript
body: JSON.stringify({
  mode: copilotMode,
  message: messageInput,
  workspaceRoot: state.projectPath,
  model: selectedModel,
  // ...
})
```

### Settings Persistence

#### Backend (`settings.rs`)
Add `selected_model` to `GlobalSettings`:
```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GlobalSettings {
    pub version: u32,
    pub last_used_project: Option<LastProject>,
    pub recent_projects: Vec<LastProject>,
    #[serde(default)]
    pub project_link_domains: Vec<String>,
    #[serde(default)]
    pub selected_model: Option<String>,  // NEW
}
```

#### Frontend (`globalSettings.ts`)
```typescript
export async function loadSelectedModel(): Promise<string | null> {
  try {
    return await invoke<string | null>('load_selected_model');
  } catch { return null; }
}

export async function saveSelectedModel(modelId: string): Promise<void> {
  try {
    await invoke('save_selected_model', { model: modelId });
  } catch (error) {
    console.error('Failed to save selected model:', error);
  }
}
```

---

## Error Handling

### Model Discovery Fails
- Log the error
- Show a subtle warning near the dropdown: "Could not load models"
- Fall back to SDK default (don't specify a model in createSession)
- Allow user to retry

### Previously Selected Model Unavailable
- If the model saved in settings is not in the current available list:
  - Apply the default selection logic (Opus 4.5 → highest Opus → SDK default)
  - Update the saved setting to the new default

### Network Errors During Model Fetch
- Use a retry with exponential backoff (max 3 attempts)
- If all retries fail, proceed without a model selector (hidden or disabled dropdown)

---

## UI/UX Details

### Dropdown Placement
```
[+ New Chat] [🕐 History]     Model: [Claude Opus 4.5 ▾]  Mode: [Planning ▼]
```

### Dropdown Styling
- Match the existing Mode dropdown styling (zinc-800 bg, zinc-700 border, gray-300 text)
- Label: "Model:" in `text-xs text-gray-500` to the left of the dropdown
- Same height as the Mode dropdown

### Loading State
- While models are being fetched: show "Loading..." in the dropdown (disabled)
- After load: show the selected model

### Error State
- If fetch fails: show "Model: Error" with a retry icon
- Tooltip: "Failed to load available models. Click to retry."

---

## Acceptance Criteria

- [ ] Model selector dropdown appears next to the Mode dropdown
- [ ] Available models are fetched dynamically from the Copilot SDK via `GET /api/models`
- [ ] Models display friendly names (not raw IDs)
- [ ] Default selection: Claude Opus 4.5 → highest Claude Opus → SDK default
- [ ] Selected model is persisted globally in `naide-settings.json`
- [ ] Selected model is restored on app restart
- [ ] Selected model is sent to the sidecar with each request
- [ ] Sidecar uses the provided model in `createSession()`
- [ ] If model discovery fails, show an error and fall back to SDK default
- [ ] If the previously selected model is no longer available, fall back to default selection logic
- [ ] Hardcoded `gpt-4o` is removed from both streaming and non-streaming paths
- [ ] App builds and runs successfully
- [ ] No console errors or warnings

---

## Files to Modify

### Sidecar
- `src/copilot-sidecar/src/index.ts` — Add `GET /api/models` endpoint, accept `model` parameter in request bodies, remove hardcoded `gpt-4o`

### Frontend
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Add model selector dropdown, fetch models, pass model to requests
- `src/naide-desktop/src/utils/globalSettings.ts` — Add `loadSelectedModel` and `saveSelectedModel` functions

### Backend
- `src/naide-desktop/src-tauri/src/settings.rs` — Add `selected_model` field to `GlobalSettings`
- `src/naide-desktop/src-tauri/src/lib.rs` — Add Tauri commands for model settings

---

## Testing Strategy

### Manual Testing
- [ ] Verify model list loads on app startup
- [ ] Verify default model selection follows the priority order
- [ ] Verify selected model persists across app restarts
- [ ] Verify changing the model mid-session uses the new model for subsequent requests
- [ ] Verify error handling when SDK model discovery fails
- [ ] Verify fallback behavior when previously selected model becomes unavailable

---

## Future Enhancements

### Model Details
- Show model capabilities or descriptions in a tooltip
- Display token limits or context window size

### Per-Project Model Override
- Allow projects to override the global model selection
- Useful for projects that require specific model capabilities

### Model Favorites
- Star frequently used models
- Pin favorites to the top of the dropdown

---

## Related Features
- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) — Original Copilot SDK integration where model was hardcoded
- [2026-02-10-auto-mode.md](./2026-02-10-auto-mode.md) — Auto mode uses whichever model is selected

---

created by naide
