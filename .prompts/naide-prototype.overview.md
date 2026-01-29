# Naide Prototype (v0) — Copilot Instructions Overview

You are helping build **Naide** (**Not An IDE**): a desktop app (Windows/macOS/Linux) for *non‑pro developers* to create and maintain apps using AI.

## Prototype scope (THIS iteration)
Implement only:
1. **Screen 1 — Intent Capture** (updated to visually align with Planning Mode)
2. **Planning Mode Shell** (section-based guided Q&A layout + "Plan out of date → Rebuild Plan" state)
3. Basic navigation + state handoff: Screen 1 → Planning Mode
4. No Copilot SDK integration yet (UI-only prototype). No code generation.

## Non-goals (do NOT implement yet)
- No real project creation/update, no file generation, no model calls
- No authentication, accounts, or cloud sync
- No persistence beyond in-memory state (optional: localStorage is allowed but not required)
- No multi-window, no tray, no auto-updater

## Tech decisions (locked)
- Desktop shell: **Tauri** (Rust core, minimal default plugins)
- Frontend: **React + Vite**
- Styling: **Tailwind CSS**
- Theme: **Dark mode only**
- Fonts: bundle **Inter** (UI) + **JetBrains Mono** (monospace)
- Window: default **1200×800**, **resizable**
- Repo layout: app lives under **src/naide-desktop**
- Build commands: `tauri dev` and `tauri build`

## UX decisions (locked)
- Screen 1 **Continue** button is **always enabled**
- If Screen 1 textarea is empty and user clicks Continue → show a **modal** prompting for a description
- Screen 1 has **4–5 chips**; clicking a chip **inserts starter prompt text** into the textarea
- After Continue (with non-empty input) → navigate to **Planning Mode**
  - Insert the Screen 1 text into the appropriate Planning Mode section (Overview → "What do you want to build?")

## Design language goals
- Screen 1 should visually “belong” to Planning Mode (same surfaces, typography, spacing, button style)
- Non‑pro friendly: no mention of IDE/CLI/frameworks on Screen 1
- UI should be close to the approved mockups (not necessarily pixel-perfect)

## How to work (Copilot behavior)
- Follow instructions in the `tech/` and `ui/` docs strictly.
- Prefer small, readable components.
- Avoid overengineering. Keep state simple.
- Use semantic HTML, accessible labels, and keyboard-friendly modal behavior.
- Do not add new dependencies unless explicitly requested.

## Deliverables for this prototype
- A runnable Tauri app with:
  - Route `/` = Screen 1
  - Route `/planning` = Planning Mode shell
  - In-memory app state passed from Screen 1 to Planning Mode
