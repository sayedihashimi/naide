---
Status: shipped
Area: copilot, infra
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# Title: Initial Copilot SDK + Copilot CLI integration (Planning mode only; Building/Analyzing stubbed)

**Status**: ✅ IMPLEMENTED in PR #13

## Summary
Add initial integration to Naide using GitHub Copilot SDK (which uses GitHub Copilot CLI in server mode). The user will install and authenticate Copilot CLI outside of Naide before launching the app. If the user submits a request in Naide and Copilot CLI is missing or not logged in, show a basic UI message telling them to install/sign in and try again.

## Implementation Summary

The Copilot integration was implemented with the following architecture:

1. **Node.js Sidecar**: Created at `src/copilot-sidecar/` with TypeScript
   - Runs as HTTP server on `http://localhost:3001`
   - Uses `@github/copilot-sdk` package
   - Auto-started by Tauri on application launch
   - Built with `npm run build` which compiles TypeScript to `dist/index.js`

2. **Auto-Start Mechanism**: Tauri spawns the sidecar automatically
   - Tauri's `lib.rs` starts the sidecar using Node.js
   - Sidecar path: `src/copilot-sidecar/dist/index.js`
   - Logs sidecar startup with PID to console
   - Accessible at `http://localhost:3001`

3. **Endpoints Implemented**: 
   - `POST /api/copilot/chat` - Main chat endpoint for Copilot interactions
   - Health check endpoint for connection verification

---

## Original Requirements

For this initial integration:
- Enable Copilot-backed behavior for Planning workflows (see details below).
- In Building or Analyzing mode, do NOT call Copilot yet; just respond “Building coming soon” / “Analyzing coming soon”.
- Implement learnings capture to `.naide/learnings/` (see details).

Context / Current App
- Naide is a Tauri desktop app (React + Vite) with:
  - Screen 1 (intent capture)
  - Planning Mode (section-based guided Q&A; Rebuild Plan gating)
  - Generate App screen with 3 columns and a chat UI in the center
- The Generate App screen has a mode dropdown: Planning / Building / Analyzing.

Core Requirements

1) Add Node sidecar for Copilot SDK
- Create a Node/TypeScript sidecar service responsible for all Copilot SDK calls.
- The Tauri app (frontend/backend) communicates with the sidecar over localhost HTTP (or another simple local IPC).
- The sidecar must:
  - Use @github/copilot-sdk
  - Start/connect to Copilot CLI server mode (as required by the SDK)
  - Expose a minimal API endpoint that Naide can call, e.g.:
    - POST /api/copilot/chat
      - request: { mode, message, workspaceRoot, contextFiles? }
      - response: { replyText, actions? }
- Keep the sidecar simple and minimal; do not over-architect.

2) Authentication / prerequisite behavior
- Users must install Copilot CLI and sign in outside the app before using Naide.
- On any Copilot request, if:
  - Copilot CLI is not installed OR
  - Copilot CLI is installed but not signed in / auth not available OR
  - Sidecar fails to start Copilot server
  Then:
  - Do not crash
  - Show a basic UI message:
    “Copilot CLI is not installed or not signed in. Please install GitHub Copilot CLI and run `copilot` then `/login`, then try again.”
- Implement this as a simple error state in the chat UI (no fancy UX required yet).

3) Mode behavior (MVP gating)
- The Generate App page has a dropdown with:
  - Planning
  - Building
  - Analyzing

Behavior:
- If mode == Building:
  - Do NOT call Copilot yet.
  - On submit: append assistant reply “Building coming soon”.
- If mode == Analyzing:
  - Do NOT call Copilot yet.
  - On submit: append assistant reply “Analyzing coming soon”.
- If mode == Planning:
  - Call Copilot via the sidecar.
  - Copilot should act as a planning expert:
    - Ask questions to gather missing info required to make the requested change
    - Update the planning spec files under `.prompts/plan/**`
    - Update/create feature files under `.prompts/features/**` if the change requires it
    - Keep specs synchronized with user intent and implementation plan

IMPORTANT: The chat UI is on the Generate App screen, but Planning mode behavior should update planning artifacts in the repo.

4) Repo prompt + system prompt loading (required)
- The sidecar must load and include relevant prompt files from the repo when calling Copilot.
- System prompt files live at:
  - `.prompts/system/base.system.md`
  - `.prompts/system/planning.system.md`
  - `.prompts/system/building.system.md`
- For Planning mode calls:
  - Combine base + planning system prompts (or otherwise ensure both are applied)
- Ensure Copilot is instructed to read and obey:
  - `README.naide.md`
  - `.prompts/**`
  - `.prompts/plan/**`
  - `.prompts/features/**`
  - `.naide/learnings/**` (if present)

5) Writing/updating planning specs and feature files
In Planning mode, Copilot must be allowed to:
- Create/update any files under:
  - `.prompts/plan/**`
  - `.prompts/features/**`

Implementation expectation:
- Use Copilot responses to produce concrete file edits (patch/diff approach is preferred).
- Apply edits to the working tree from Naide (either:
  - sidecar returns a patch/diff and Naide applies it, or
  - sidecar writes files directly under the provided workspaceRoot — pick one and implement consistently).
- Keep it safe:
  - Only write under the allowed directories above
  - No arbitrary file writes elsewhere in this MVP

6) Learnings capture (required in this issue)
Implement project memory capture at:
  `.naide/learnings/`

Rules (MVP version):
- When the AI (Copilot) is corrected by the user OR a build/test error occurs and the AI has to adjust:
  - Write a concise learning entry.
- Learnings must be high-signal and reusable. Do NOT dump long logs.
- Group learnings into reasonably sized markdown files so Copilot can ingest them later.
  - Example grouping approach:
    - `.naide/learnings/ui-and-layout.md`
    - `.naide/learnings/routing-and-navigation.md`
    - `.naide/learnings/build-and-tooling.md`
- Each learning entry should include:
  - What happened
  - Why it mattered
  - What to do next time
- Before making decisions in Planning mode, Copilot should read relevant learnings and apply them.

Note: It’s okay if the “novelty detection” is simplistic at first. The important thing is:
- don’t write noise
- do write truly helpful lessons

7) Planning mode conversational behavior (MVP)
When the user submits a planning request in the chat UI:
- Copilot should:
  1) Restate what it understood
  2) Ask the next set of questions needed to proceed (small batch)
  3) Propose defaults
  4) After answers are sufficient:
     - Update `.prompts/plan/**` and `.prompts/features/**` accordingly
     - Summarize what files changed
     - Indicate what’s ready to build next

This issue does NOT require implementing the full Planning Mode UI interactions; only the chat-driven planning + repo file updates.

Non-goals (explicitly out of scope)
- No Building or Analyzing Copilot functionality (stub replies only)
- No app generation / running app preview integration
- No authentication UI inside Naide beyond basic “install/login” error message
- No auto-updater, no telemetry
- No advanced security sandboxing beyond path allowlisting

Acceptance Criteria
- A Node sidecar exists and is used for Copilot SDK calls.
- Planning mode chat submit calls the sidecar and returns an assistant reply.
- If Copilot CLI is missing or not logged in:
  - Naide shows the basic message and does not crash.
- Building/Analyzing mode chat submit returns “Building coming soon” / “Analyzing coming soon” without calling Copilot.
- Planning mode can update repo files under:
  - `.prompts/plan/**`
  - `.prompts/features/**`
- Learnings are written to `.naide/learnings/**` when:
  - the user corrects the AI, or
  - an error forces a correction (build/test failure handling can be minimal; if there are no tests yet, focus on the correction mechanism)
- The app still runs via `tauri dev`.

Implementation Notes / Suggested steps
1) Add sidecar project (Node/TS) and a minimal HTTP API.
2) Wire Tauri app → sidecar call from Generate App chat UI when mode == Planning.
3) Add error handling for missing CLI/not logged in (return a structured error from sidecar).
4) Implement file read injection: send system prompts + relevant repo prompt/spec content to Copilot.
5) Implement safe file writes (only allow `.prompts/plan/**` and `.prompts/features/**`).
6) Add learnings folder support:
   - read existing learnings
   - write new learnings on “correction events”
7) Confirm behaviors and run `tauri dev`.

Notes for Copilot
- Keep changes minimal and focused.
- Do not refactor unrelated UI.
- Prefer plain, predictable code.
- Be explicit about any new scripts required to launch the sidecar during `tauri dev`.
