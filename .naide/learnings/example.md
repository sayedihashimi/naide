# Example Learnings

This file demonstrates the format for learnings. Learnings help the AI improve over time by remembering past corrections and mistakes.

## [2026-01-30T19:00:00.000Z]

### What Happened
Initial setup of Copilot integration required creating a sidecar service separate from the main Tauri app.

### Why It Mattered
The @github/copilot-sdk is a Node.js library and cannot be used directly in Tauri's Rust backend. A separate Node.js process is required.

### What To Do Next Time
For any Node.js-specific integrations, consider a sidecar pattern from the start. This allows the Tauri app to remain lean while leveraging the Node.js ecosystem.

---

*Note: This is an example file. Real learnings will be written automatically when the AI is corrected or when errors occur.*
