# Bug: Missing spaces between text segments in streamed Copilot responses

**Type:** Bug Fix  
**Priority:** Medium  
**Status:** Fixed

---

## Problem Statement

When Copilot interleaves text with tool calls during a streaming response, the text segments get concatenated without any whitespace separator. This produces output like:

```
Now let me read the key files:Let me search more specifically...
```

Instead of the expected:

```
Now let me read the key files:

Let me search more specifically...
```

---

## Root Cause

The Copilot SDK emits multiple "turns" when tool calls are interspersed with text responses. Each turn produces `assistant.message_delta` events whose content is pushed to `responseBuffer` and sent as `delta` SSE events.

When a new turn starts (after tool calls complete), the sidecar sends a `turn_start` event but does NOT insert any whitespace separator. The frontend concatenates the new turn's deltas directly onto the previous content.

**Two issues:**
1. The sidecar's `responseBuffer.join('')` concatenates all chunks without separators, affecting the `fullResponse` in the `done` event
2. The frontend's `accumulatedContent += eventData.data.content` concatenates without separators between turns

---

## Solution

In the sidecar's `assistant.turn_start` handler, when `responseBuffer` already has content that doesn't end with a newline, push `\n\n` to the buffer and send it as a `delta` event. This ensures:
- The frontend naturally accumulates the separator via its existing delta handler
- The `responseBuffer.join('')` includes the separator in `fullResponse`

**File changed:** `src/copilot-sidecar/src/index.ts` — `assistant.turn_start` handler

---

## Acceptance Criteria

- [x] Text segments separated by tool calls have proper paragraph breaks between them
- [x] The `fullResponse` in the `done` event includes the separators
- [x] No extra whitespace is added within a single turn's content
- [x] TypeScript compiles without errors
