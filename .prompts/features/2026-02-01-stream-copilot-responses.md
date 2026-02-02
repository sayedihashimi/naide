---
Status: planned
Area: chat, copilot
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# Feature: Stream Copilot Responses in Chat

## Summary
Improve Naide’s chat experience by streaming Copilot responses incrementally instead of waiting for the full response before rendering.

This makes the app feel faster, more interactive, and more natural—especially for longer planning conversations.

Streaming applies to **Planning mode** first. Building and Analyzing modes may remain stubbed or non-streaming for now.

---

## Goals
- Render Copilot responses incrementally (token-by-token or chunk-by-chunk)
- Reduce perceived latency in chat
- Preserve correctness and safety when updating spec files
- Keep the implementation simple and reliable for a desktop app

---

## Non-Goals
- Streaming partial file writes
- Live-editing spec files mid-response
- Advanced cursor/typing animations
- Streaming for Building or Analyzing modes (for now)

---

## Architecture Overview

Naide uses a Node sidecar to communicate with the Copilot SDK.

Streaming should be implemented in this flow:

Naide UI  
→ Node sidecar (streaming endpoint)  
→ Copilot SDK  
→ Copilot CLI (server mode)  

The sidecar is responsible for:
- Receiving incremental tokens from Copilot
- Forwarding them immediately to the UI
- Buffering the full response for post-processing

---

## Sidecar Requirements

### Streaming API
Expose a streaming endpoint from the sidecar, for example:

POST /api/copilot/stream  
Content-Type: text/event-stream  

The endpoint should:
- Start Copilot inference
- Forward partial output as it arrives
- End the stream when Copilot completes or errors

Server-Sent Events (SSE) is the preferred transport.

---

### Token Handling
- Consume incremental tokens or text chunks from the Copilot SDK
- Emit each chunk to the client immediately
- Accumulate the full response internally

Do NOT wait for the full response before emitting output.

---

## UI Requirements

### Chat Rendering
- When a streaming response starts:
  - Create a new assistant message in the chat
- As chunks arrive:
  - Append text to the existing message
  - Avoid re-rendering the full message each time
- When streaming ends:
  - Mark the message as complete

Optional:
- Show a subtle “typing” indicator while streaming

---

## Planning Mode Safety Rules

When mode == Planning:

- Stream output to the UI immediately
- Buffer the complete response internally
- Only after the stream completes:
  - Parse the final response
  - Apply file updates to:
    - .prompts/plan/**
    - .prompts/features/**
    - .prompts/learnings/**
- Never write spec or feature files mid-stream

This prevents partial or corrupted specs.

---

## Error Handling

- If streaming fails mid-response:
  - Stop streaming
  - Show a simple error message in chat
  - Do not write any files
- If Copilot CLI is not installed or not logged in:
  - Do not start streaming
  - Show the existing “install/sign in” message

---

## Mode Behavior

### Planning
- Streaming enabled
- Specs updated after completion

### Building
- For now, return: “Building coming soon”
- No streaming required

### Analyzing
- For now, return: “Analyzing coming soon”
- No streaming required

---

## Spec Updates
Update specs to reflect streaming behavior:
- Update .prompts/plan/app-spec.md (or relevant UX spec)
- Update SPEC_CHANGELOG.md noting streaming support in chat

---

## Acceptance Criteria
- Copilot responses appear incrementally in the chat UI
- The UI no longer blocks while waiting for full responses
- Planning mode updates spec files only after completion
- No partial or corrupted file writes occur
- App builds and runs successfully (tauri dev)

---

## Implementation Notes
- Prefer Server-Sent Events (SSE) over WebSockets for MVP
- Keep streaming logic isolated in the sidecar
- Buffering + streaming must both be supported
- This feature is foundational for a high-quality chat experience

---

## Related Files
- .prompts/features/2026-02-01-add-copilot-integration.md
- .prompts/features/2026-02-01-conversation-memory.md
- .prompts/system/base.system.md
- .prompts/system/planning.system.md
