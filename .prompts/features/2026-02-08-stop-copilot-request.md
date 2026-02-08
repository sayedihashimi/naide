---
Status: planned
Area: ui, chat, copilot
Created: 2026-02-08
LastUpdated: 2026-02-08
---

# Feature: Stop Button to Cancel Copilot Requests
**Status**: 🟡 PLANNED

## Summary
Replace the Send button with a Stop button while a Copilot request is in progress. Clicking the Stop button cancels the current/pending Copilot request, leaves any partially streamed content in the chat, and appends a "Cancelled by user" message. Also supports `Ctrl+X` keyboard shortcut.

---

## Goals
- Give users a clear, obvious way to cancel an ongoing Copilot request
- Prevent wasted time waiting for unwanted or runaway responses
- Preserve any partial response already received
- Provide clear visual feedback that the request was cancelled

---

## Non-Goals
- Retry or resume a cancelled request (user can re-send manually)
- Undo the cancellation
- Cancel individual file write operations (those happen after stream completes)
- Server-side cancellation on the Copilot SDK side (best-effort client-side abort)

---

## Problem Statement
When a Copilot request is in progress (streaming or waiting for a response), users have no way to cancel it. If the AI is generating a long, unwanted response, or the user realizes they asked the wrong question, they must wait for the entire response to finish before they can interact again. This is frustrating and wastes time.

---

## Core Behavior

### Button Replacement
- **When idle** (no request in progress): Show the **Send** button (existing behavior)
- **When loading** (`isLoading === true`): Replace the Send button with a **Stop** button in the same position
- Only one button is visible at a time — they swap in place

### Stop Button Appearance
- **Icon**: Square stop icon (Lucide `Square` icon, filled)
- **Color**: Red background (`bg-red-600`, hover: `bg-red-500`)
- **Text**: Icon only (no text label) — or "Stop" text if space permits
- **Size**: Same dimensions as the Send button
- **Position**: Exact same position as the Send button (replaces it)

### Click Behavior
When the Stop button is clicked:
1. **Abort the HTTP request**: Close the SSE/fetch connection to `/api/copilot/stream`
2. **Keep partial content**: Whatever text has been streamed into the assistant message stays visible
3. **Append cancellation message**: Add a new assistant message: *"Cancelled by user"*
4. **Reset loading state**: Set `isLoading` to `false`
5. **Re-enable input**: The Send button reappears, textarea is re-enabled
6. **Stop the working indicator**: The brightness pulsing animation on the assistant icon stops
7. **Clear activity status**: The ActivityStatusBar clears (or shows "Cancelled")

### Keyboard Shortcut
- **`Ctrl+X`** (Windows/Linux) triggers the same cancel action as clicking Stop
- Active only when `isLoading` is true
- When `isLoading` is false, `Ctrl+X` does its normal behavior (cut text)

### Partial Response Handling
- If streaming has started and some content was received:
  - The partial content remains in the last assistant message as-is
  - A separate "Cancelled by user" message is appended after it
- If no content was received yet (still waiting for first chunk):
  - Remove the empty assistant message placeholder
  - Append only the "Cancelled by user" message
- The "Cancelled by user" message should be styled distinctly (e.g., italic, muted color) so it's visually different from normal assistant responses

### Post-Cancellation State
- No file writes occur (file writes happen after stream completion, which was aborted)
- Conversation summary is NOT updated from the partial response
- The partial content is included in message history (it was visible to the user)
- The "Cancelled by user" message is included in message history
- User can immediately type and send a new message

---

## Technical Implementation

### Frontend (GenerateAppScreen.tsx)

#### AbortController Pattern

Store an `AbortController` ref that can be used to cancel the fetch request:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);
```

**On send** (in `handleSendMessage`):
```typescript
const controller = new AbortController();
abortControllerRef.current = controller;

// Pass controller.signal to the fetch call
const response = await fetch(`http://localhost:3001/api/copilot/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: controller.signal,  // <-- enables cancellation
});
```

**On stop** (new `handleStopRequest` function):
```typescript
const handleStopRequest = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
  
  // Clean up the partial message
  setMessages(prev => {
    const updated = [...prev];
    const lastMsg = updated[updated.length - 1];
    
    // If last message is an empty assistant placeholder, remove it
    if (lastMsg?.role === 'assistant' && !lastMsg.content.trim()) {
      updated.pop();
    }
    
    // Append cancellation message
    updated.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Cancelled by user',
      timestamp: new Date().toISOString(),
    });
    
    return updated;
  });
  
  setIsLoading(false);
};
```

**Error handling in stream reader:**
When the fetch is aborted, the stream reader throws an `AbortError`. The existing error handling should catch this and NOT show it as an error:

```typescript
try {
  // ... stream reading loop
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    // User cancelled — handled by handleStopRequest, do nothing
    return;
  }
  // ... existing error handling
}
```

#### Button Rendering

Replace the current Send button section:

```tsx
{isLoading ? (
  <button
    onClick={handleStopRequest}
    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
    title="Stop request (Ctrl+X)"
  >
    <Square size={18} fill="currentColor" />
  </button>
) : (
  <button
    onClick={handleSendMessage}
    disabled={!messageInput.trim()}
    className={`px-4 py-2 rounded-lg transition-colors ${
      !messageInput.trim()
        ? 'bg-zinc-800 text-gray-500 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700 text-white'
    }`}
  >
    Send
  </button>
)}
```

#### Keyboard Shortcut

Add a keydown listener for `Ctrl+X`:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'x' && isLoading) {
      e.preventDefault();
      handleStopRequest();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isLoading]);
```

Note: Only intercept `Ctrl+X` when `isLoading` is true. When not loading, let the browser handle it normally (cut text).

### Sidecar Considerations

No sidecar changes are strictly required. When the frontend aborts the fetch:
- The SSE connection closes
- The sidecar's response stream will encounter a write error (client disconnected)
- The sidecar should handle this gracefully (it likely already does — broken pipe / connection reset errors are common with SSE)
- Verify the sidecar doesn't crash or log excessive errors when the client disconnects mid-stream

### WebSocket (ActivityStatusBar)

When the request is cancelled:
- The WebSocket connection stays open (it's shared across requests)
- Any in-progress status events naturally stop since the sidecar stops processing
- Optionally: emit a `session_complete` event from the frontend side to trigger the auto-hide timer
- Or: simply clear the status events in the frontend when stop is clicked

---

## "Cancelled by user" Message Styling

The cancellation message should be visually distinct from normal assistant messages:

```tsx
// In message rendering
{message.content === 'Cancelled by user' ? (
  <div className="text-zinc-500 italic text-sm">
    Cancelled by user
  </div>
) : (
  <MarkdownPreview content={message.content} />
)}
```

- Color: Muted (`text-zinc-500`)
- Style: Italic
- Size: Slightly smaller than normal messages (`text-sm`)
- No assistant icon decoration (or use a different icon like `XCircle`)

---

## Edge Cases

### Double-Click Stop
- Debounce or disable the Stop button after first click to prevent double-abort

### Stop During "Copilot is thinking..." Phase
- No content has been received yet
- Remove the empty placeholder message
- Append "Cancelled by user"
- Reset loading state

### Stop After Stream Complete But Before File Writes
- The stream has finished but file writes from the response haven't been applied yet
- Since file writes happen after stream completion in the current architecture, and we abort the stream, file writes should not occur
- Verify this behavior — if the response was fully received before abort, file writes may still trigger

### Network Error vs User Cancel
- `AbortError` (from `AbortController`) = user cancel → show "Cancelled by user"
- Other errors (network timeout, server error) = error → show error message (existing behavior)
- These must be distinguished in the catch block

### Cancel When No Request is Active
- Stop button only appears when `isLoading` is true, so this shouldn't happen
- `Ctrl+X` is only intercepted when `isLoading` is true

---

## Acceptance Criteria

- [ ] Send button is replaced by Stop button when `isLoading` is true
- [ ] Stop button has a red square icon
- [ ] Clicking Stop cancels the active Copilot request
- [ ] Partial streamed content is preserved in the chat
- [ ] "Cancelled by user" message is appended (styled distinctly: italic, muted)
- [ ] Empty assistant placeholder is removed if no content was received
- [ ] `isLoading` is set to false after cancellation
- [ ] Send button reappears and textarea is re-enabled
- [ ] Copilot working indicator (brightness pulse) stops
- [ ] `Ctrl+X` triggers cancellation when loading
- [ ] `Ctrl+X` performs normal cut behavior when not loading
- [ ] No file writes occur after cancellation
- [ ] Sidecar handles client disconnect gracefully (no crash, no excessive errors)
- [ ] No console errors from the abort
- [ ] App builds and all existing tests pass

---

## Files to Modify

### Frontend
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx`:
  - Add `abortControllerRef`
  - Create `handleStopRequest` function
  - Pass `signal` to fetch call in streaming logic
  - Handle `AbortError` in stream reader catch block
  - Replace Send button with conditional Stop/Send rendering
  - Add `Ctrl+X` keyboard listener
  - Style "Cancelled by user" messages

### Sidecar (Verify Only)
- `src/copilot-sidecar/src/index.ts`:
  - Verify graceful handling of client disconnect during SSE stream
  - No changes expected, but verify no crash or excessive error logging

---

## Testing Strategy

### Unit Tests
- Verify Stop button renders when `isLoading` is true
- Verify Send button renders when `isLoading` is false
- Verify "Cancelled by user" message styling

### Integration Tests
- Send a message, click Stop mid-stream → verify partial content preserved + cancellation message
- Send a message, press `Ctrl+X` mid-stream → same behavior as click
- Verify `Ctrl+X` doesn't interfere with text cutting when not loading

### Manual Testing
- [ ] Send message, click Stop while "Copilot is thinking..." → placeholder removed, cancellation shown
- [ ] Send message, click Stop mid-stream → partial content stays, cancellation appended
- [ ] After cancellation, send a new message → works normally
- [ ] `Ctrl+X` cancels when loading
- [ ] `Ctrl+X` cuts text when not loading
- [ ] No errors in console after cancellation
- [ ] Sidecar logs show clean disconnect (no crash)
- [ ] Working indicator stops on cancel
- [ ] Activity status bar clears on cancel

---

## Dependencies

### Frontend
- Lucide React `Square` icon (already available)
- `AbortController` API (native browser, no package needed)

### Backend
- No new dependencies

---

## Related Features
- [2026-02-01-stream-copilot-responses.md](./2026-02-01-stream-copilot-responses.md) — Streaming architecture being cancelled
- [2026-02-05-copilot-working-indicator.md](./2026-02-05-copilot-working-indicator.md) — Working indicator that stops on cancel
- [2026-02-03-ai-activity-status-display.md](./2026-02-03-ai-activity-status-display.md) — Activity status that clears on cancel
- [2026-02-01-generate-app-screen.md](./2026-02-01-generate-app-screen.md) — Main chat UI with Send button

---

created by naide
