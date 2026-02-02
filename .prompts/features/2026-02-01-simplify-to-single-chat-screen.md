---
Status: planned
Area: ui, planning
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# Feature: Simplify Naide to a single chat-driven screen (Generate App only)

## Summary
Refactor the Naide prototype to remove:
- Screen 1 (Intent Capture)
- Screen 2 (Planning Mode UI with sections, text areas, and plan review)

After this change, the **Generate App page** becomes the **only UI screen** and the **default route**.  
All planning and feature definition will now happen through the **chat experience** on that page.

This is a **structural simplification**, not a redesign.

---

## Goals
- Make the Generate App page the only screen users interact with
- Preserve all existing project-related functionality:
  - project load/create on startup
  - project selection
  - writing/updating spec files
  - feature files
  - learnings
- Shift planning from form-based UI to **chat-driven, continuous spec updates**
- Reduce UI complexity while keeping the repo structure intact

---

## Explicit Non-Goals
- Do NOT redesign the Generate App UI
- Do NOT change the 3-column layout
- Do NOT remove or simplify spec files
- Do NOT implement new Building or Analyzing functionality
- Do NOT delete historical spec files (we will archive them)

---

## UI / Routing Changes

### Remove Screens
Delete the following UI screens, routes, and components:
- Screen 1: Intent Capture
- Planning Mode screen (sections + text areas + plan review)

These should be **fully removed** (not just hidden).

### Default Screen
- The Generate App page becomes the default route (`/`)
- App should launch directly into this page

### Keep Generate App UI
- Keep the existing 3-column layout:
  - Left navigation
  - Center chat interface
  - Right “running app” placeholder
- Keep the mode dropdown:
  - Planning
  - Building
  - Analyzing

---

## Startup Behavior (IMPORTANT: preserve Screen 1 project logic)
Previously, Screen 1 contained logic to load or create a project and/or establish the “current project/workspace”.
That startup behavior must remain.

New requirement:
- When the app starts (on launch), Naide must still perform the same project load/create logic as it did when Screen 1 existed.
- This must happen even though Screen 1 is removed.
- If the logic currently lives inside Screen 1 components, refactor it into shared startup/project services and call it from the app initialization path (root route / app bootstrap).

Do not remove any of the “project scaffolding / ensure project exists” behaviors.
Only remove the Screen 1 UI.

---

## Planning Workflow (New Model)

Planning is now **chat-driven only**.

There is:
- No separate Planning Mode screen
- No “Rebuild Plan” button
- No planDirty gating

Instead:
- Specs are updated **continuously** as the user chats with the AI in Planning mode.

### When mode == Planning
On each user message:
1) Interpret the user’s intent
2) Ask follow-up questions if required
3) Apply defaults where appropriate
4) Update spec files immediately to reflect the current understanding

### Files that MUST be kept in sync
Copilot is allowed (and required) to create/update:
- `.prompts/plan/**`
  - intent.md
  - app-spec.md
  - data-spec.md
  - rules.md
  - tasks.json
- `.prompts/features/**`
- `.prompts/learnings/**`

Specs should never drift from what the chat has established.

---

## Feature File Contract (Still Enforced)
- Every feature must have a dedicated file under:
  `.prompts/features/`
- If the user requests a new feature via chat:
  - Create a new feature file
- If the user modifies an existing feature:
  - Update the corresponding feature file

---

## Removed Feature Archival (NEW REQUIREMENT)

### New folder
Create a folder:
- `.prompts/features/removed-features/`

### When a feature is removed
Instead of deleting the feature file:
1) Move the file into `.prompts/features/removed-features/`
2) Edit the file to clearly mark it as removed and historical.

### Required “removed” header
At the very top of the moved file, add a section like:

REMOVED FEATURE (HISTORICAL ONLY)
- Status: Removed
- RemovedAt: <YYYY-MM-DD HH:mm (local time)>
- Notes: This feature has been removed from Naide. This file is retained for historical reference only.

Also include a short explanation of what replaced it (1–3 bullets).

### Apply to Naide now
As part of this refactor:
- Move `.prompts/ui/screen-1.intent-capture.md` to:
  `.prompts/features/removed-features/screen-1.intent-capture.md`
- Move `.prompts/ui/planning-mode.shell.md` to:
  `.prompts/features/removed-features/planning-mode.shell.md`

Then edit both moved files to include the “REMOVED FEATURE” header with date/time and a short note that the app now uses a single chat-driven screen.

IMPORTANT:
- Do NOT delete these files.
- Do NOT leave them in `.prompts/ui/`.

After moving, the `.prompts/ui/` folder may be removed if it is empty and unused.

---

## Learnings (Project Memory)
- Learnings are written to `.prompts/learnings/`
- Only record high-value, reusable learnings:
  - AI was corrected by the user
  - AI had to adjust due to an error or bad assumption
- Group learnings into reasonably sized markdown files
- Avoid noise and session-specific notes

---

## Building / Analyzing Modes (Unchanged for Now)

When mode == Building:
- Do NOT call Copilot
- Append assistant reply:
  “Building coming soon”

When mode == Analyzing:
- Do NOT call Copilot
- Append assistant reply:
  “Analyzing coming soon”

---

## Preserve Project-Related Capabilities
Although UI screens are removed:
- Do NOT remove underlying logic for:
  - project creation
  - project selection
  - file system writes
  - spec updates
  - feature updates
  - learnings

If code was previously only reachable from the removed screens:
- Refactor it into shared utilities
- Keep behavior intact

---

## Spec & Changelog Updates
- Update `SPEC_CHANGELOG.md` to record:
  - Removal of Screen 1 and Planning Mode UI
  - Transition to chat-driven planning
  - Introduction of `removed-features/` archival approach

---

## Acceptance Criteria
- App launches directly into the Generate App page
- On startup, Naide still performs the same project load/create behavior previously done by Screen 1
- Screen 1 and Planning Mode UI are fully removed from the app
- Generate App page still renders correctly (3 columns + dropdown)
- Rebuild Plan UI/state is fully removed
- Planning mode chat continuously updates:
  - `.prompts/plan/**`
  - `.prompts/features/**`
  - `.prompts/learnings/**`
- Building/Analyzing modes respond with “coming soon”
- Removed feature files are archived under:
  - `.prompts/features/removed-features/`
  and contain the required “REMOVED FEATURE” header with date/time
- App builds and runs successfully (`tauri dev`)

---

## Implementation Guidance
- Keep the diff focused
- Prefer deletion over hiding (for UI code)
- Preserve existing file-writing behavior
- Preserve startup project load/create behavior
- Update specs alongside code changes
- Ensure routes and imports are cleaned up
