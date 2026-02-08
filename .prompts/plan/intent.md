# Intent

## Project Vision
Naide ("Not An IDE") is a desktop application for non-professional developers to create and maintain applications using AI assistance. It is spec-driven: repo prompt/spec files are the durable source of truth, not the chat transcript.

## Current Intent
The core platform is built and functional. Planning and Building modes work with Copilot SDK integration. The focus is now on enhancing the development experience: app running/preview, file browsing, and UI polish.

## Completed Goals
- ✅ Planning mode with Copilot-backed behavior (streaming, conversation memory)
- ✅ Building mode with Copilot-backed code generation
- ✅ Learnings capture with `search_learnings` tool for on-demand retrieval
- ✅ Safe file operations with path allowlisting
- ✅ Single-screen chat-driven UI with tab system
- ✅ App detection and running (npm + .NET) with iframe preview
- ✅ Chat session management (new chat, history, delete)
- ✅ Project management (recent projects, last used, remove from list)
- ✅ Feature file viewer with edit mode
- ✅ Project file browser with lazy loading
- ✅ Real-time AI activity status via WebSocket
- ✅ Persistent file logging (shared between Rust and Node.js)

## Open Goals
- Stub Analyzing mode — not yet implemented
- Adaptive learnings index — planned for large projects with many learnings
- Project file watcher — auto-detect new runnable apps during Building mode
