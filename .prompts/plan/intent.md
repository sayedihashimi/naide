# Intent

## Project Vision
Naide ("Not An IDE") is a spec-driven AI development assistant that helps developers create and maintain applications. It exists in two forms:
- **Desktop App** (Tauri + React): Targets non-professional developers with a standalone UI
- **VS Code Extension**: Targets professional developers as a native Copilot Chat participant (`@naide`)

Both share the same spec-driven workflow: `.prompts/plan/**`, `.prompts/features/**`, `.prompts/learnings/**` are the durable source of truth.

## Current Intent
The desktop app's core platform is built and functional. The current focus is building the **VS Code extension** — a native Copilot Chat participant that brings Naide's spec-driven workflow to professional developers using VS Code's built-in UI for file viewing, editing, and chat.

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
- VS Code extension (`@naide` Copilot Chat participant) — in progress
- Stub Analyzing mode — not yet implemented
- Adaptive learnings index — planned for large projects with many learnings
- Project file watcher — auto-detect new runnable apps during Building mode
