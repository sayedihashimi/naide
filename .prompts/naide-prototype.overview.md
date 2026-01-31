# Naide Prototype (v0) — Copilot Instructions Overview

You are helping build **Naide** (**Not An IDE**): a desktop app (Windows/macOS/Linux) for *non‑pro developers* to create and maintain apps using AI.

## Current Implementation Status

The following features have been implemented:

### Core Features (Completed)
1. ✅ **Screen 1 — Intent Capture** (PR #2)
   - No "Not An IDE" subtitle
   - Expand/collapse and AI assist controls
   - Starter prompt chips

2. ✅ **Planning Mode Shell** (PR #2)
   - Section-based guided Q&A layout
   - "Plan out of date → Update plan" state
   - File persistence to markdown files

3. ✅ **Generate App Screen** (PR #7, #9, #15)
   - 3-column layout with navigation, chat, and preview panels
   - Mode selector: Planning/Building/Analyzing
   - Interactive chat with markdown rendering
   - Message persistence to `.naide/chatsessions/`

4. ✅ **Copilot Integration** (PR #13)
   - Node.js sidecar with @github/copilot-sdk
   - Auto-start on Tauri launch
   - HTTP API on localhost:3001

5. ✅ **Markdown Support** (PR #15)
   - Full markdown rendering in chat messages
   - Code blocks, lists, tables, links, etc.
   - XSS protection and dark theme styling

6. ✅ **CI/CD** (PR #5)
   - GitHub Actions for ubuntu, windows, macos
   - Automated linting, testing, and builds

7. ✅ **File Persistence System**
   - Auto-save to Documents/naide/projects/{PROJECT_NAME}/
   - Project loading and switching

## Prototype scope (THIS iteration)
Implement only:
1. **Screen 1 — Intent Capture** (no "Not An IDE" subtitle, with expand/collapse and AI assist controls)
2. **Planning Mode Shell** (section-based guided Q&A layout + "Plan out of date → Update plan" state)
3. **Code Section** showing file mappings for each planning section
4. **File Persistence System** - Auto-save to Documents/naide/projects/{PROJECT_NAME}/
5. **Project Loading** - Load existing projects on startup and skip Screen 1
6. **Project Switching** - Folder picker to open different projects
7. Basic navigation + state handoff: Screen 1 → Planning Mode
8. **Copilot SDK integration** via Node.js sidecar (Planning mode only)
9. **Generate App screen** with chat interface and markdown support

## Non-goals (do NOT implement yet)
- No real app generation (Building/Analyzing modes are stubs)
- No authentication, accounts, or cloud sync
- No multi-window, no tray, no auto-updater

## Tech decisions (locked)
- Desktop shell: **Tauri 2** (Rust core, plugins: fs, dialog)
- Frontend: **React 19 + Vite**
- Styling: **Tailwind CSS**
- Theme: **Dark mode only**
- Fonts: bundle **Inter** (UI) + **JetBrains Mono** (monospace)
- Window: default **1200×800**, **resizable**
- Repo layout: app lives under **src/naide-desktop**, sidecar under **src/copilot-sidecar**
- Build commands: `tauri dev` and `tauri build`
- Testing: **Vitest** + **React Testing Library** (see `tech/testing.md`)
- CI/CD: **GitHub Actions** on ubuntu/windows/macos

## UX decisions (locked)
- Screen 1 **Continue** button is **always enabled**
- Screen 1 branding: "Naide" only (no subtitle)
- If Screen 1 textarea is empty and user clicks Continue → show a **modal** prompting for a description
- Screen 1 has **5 chips**; clicking a chip **inserts starter prompt text** into the textarea
- After Continue (with non-empty input) → navigate to **Planning Mode**
  - Insert the Screen 1 text into the appropriate Planning Mode section (Overview → "What do you want to build?")
- **Skip Screen 1** if existing project found - go directly to Planning Mode with loaded data

## File Persistence (implemented)
- **Project location**: Documents/naide/projects/{PROJECT_NAME}/
- **Default project**: "MyApp"
- **Save behavior**: 
  - Save on textarea/input blur
  - Save when "Update plan" clicked
  - Save before project switching
- **File mappings**:
  - Overview → Intent.md
  - Features → AppSpec.md
  - Data → DataSpec.md
  - Access & Rules → Rules.md
  - Assumptions → Assumptions.md
  - Plan Status → Tasks.json
- **Markdown format**: Section heading + question headings + answers

## Project Management (implemented)
- **Startup**: Check for existing project, load if found
- **Project name**: Displayed in title bar (clickable)
- **Project switching**: 
  - Click project name → folder picker
  - Load existing project or create new one
  - Redirect to Screen 1 if new, Planning Mode if existing

## UI Controls (implemented features)
- **Textarea controls**: Each textarea includes two icon buttons in bottom-right corner:
  - **AI Assist button** (lightbulb icon, yellow color): Placeholder for future AI assistance feature
  - **Expand/Collapse button** (resize icon): Toggles textarea height for more/less space
- **Missing Information**: Clickable links that navigate to corresponding sections
- **"+X more" expansion**: Clickable link to show/hide additional missing information items
- **Code Section**: Displays read-only list of files mapped to planning sections (not editable by user)

## Design language goals
- Screen 1 should visually "belong" to Planning Mode (same surfaces, typography, spacing, button style)
- Non‑pro friendly: no mention of IDE/CLI/frameworks on Screen 1
- UI should be close to the approved mockups (not necessarily pixel-perfect)

## How to work (Copilot behavior)
- Follow instructions in the `tech/` and `ui/` docs strictly.
- Prefer small, readable components.
- Avoid overengineering. Keep state simple.
- Use semantic HTML, accessible labels, and keyboard-friendly modal behavior.
- Do not add new dependencies unless explicitly requested.
- **Keep this file and related docs updated** when making changes based on user feedback.

## Deliverables for this prototype
- A runnable Tauri app with:
  - Route `/` = Screen 1 (or redirect to Planning if project exists)
  - Route `/planning` = Planning Mode shell
  - File persistence to Documents folder
  - Project loading and switching capabilities
