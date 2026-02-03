---
Status: shipped
Area: ui
Created: 2026-02-01
LastUpdated: 2026-02-03
---

# Feature: Replace left nav with Planning / Building / Analyzing tabs (remove mode dropdown)
**Status**: 🟡 PARTIALLY IMPLEMENTED

## Implementation Status

The mode selector dropdown has been implemented with Planning, Building, and Analyzing options. However, the left navigation still shows the original "Generate", "Activity", and "Files" buttons instead of mode-based tabs.

**Current State:**
- Mode dropdown exists and works correctly
- Left nav still has "Generate" (active), "Activity" (disabled), "Files" (disabled)
- Mode changes update the chat behavior correctly

**Remaining Work:**
- Replace left nav buttons with "Planning", "Building", "Analyzing" tabs
- Remove the mode dropdown
- Make the active left tab determine the current mode
- Update routing to support mode-based navigation (optional)

## Summary
Update the left navigation on the Generate App page to use mode-based tabs:
- Planning
- Building
- Analyzing

These tabs replace the current left nav items:
- Generate
- Activity
- Files

Once the tabs exist, remove the mode dropdown. The selected tab becomes the current mode.

For this iteration, keep the UI and layout the same across all three tabs. We will customize per-tab UI later.

---

## Goals
- Make the current mode obvious and one-click accessible via left nav tabs
- Remove redundant mode dropdown
- Keep the existing 3-column layout unchanged
- Preserve existing “coming soon” behavior in Building/Analyzing (if applicable)

---

## Non-Goals
- Do not redesign the Generate App screen layout
- Do not add new functionality to Activity/Files (they are being removed)
- Do not customize per-tab UI yet (same UI for all tabs)
- Do not change Copilot integration logic beyond mode selection source

---

## UI Changes

### Left Navigation
Replace the current nav items:
- Generate
- Activity (disabled)
- Files (disabled)

With:
- Planning
- Building
- Analyzing

Behavior:
- All three tabs are enabled and clickable
- Selected tab is visually highlighted (active state)
- Keep styling consistent with the existing sidebar design

### Remove Mode Dropdown
- Remove the mode dropdown from the page entirely
- The active left tab determines mode

---

## Routing / State Model

Pick ONE approach and implement consistently:

### Option A (preferred): Routes represent mode
- `/planning`
- `/building`
- `/analyzing`

Each route renders the same Generate App layout for now, but sets the mode based on the route.
This makes mode “deep-linkable”.

OR

### Option B: Single route, mode in state
- Keep single route (e.g. `/`)
- Clicking a tab updates an in-memory `currentMode` state
- The URL does not change

Either is acceptable, but prefer Option A unless routing is currently fragile.

---

## Mode Behavior (current rules preserved)

### Planning tab
- Uses Planning mode behavior (Copilot enabled, updates `.prompts/plan/**`, `.prompts/features/**`, `.prompts/learnings/**`)

### Building tab
- For now: same UI
- On submit: respond “Building coming soon” (if this is still the project behavior)

### Analyzing tab
- For now: same UI
- On submit: respond “Analyzing coming soon” (if this is still the project behavior)

IMPORTANT:
- Do not change the content or layout per tab in this feature.
- Only change how the mode is selected and displayed.

---

## Spec Updates (required)
When implementing this feature, update spec files to reflect the new UX:
- Update `.prompts/plan/app-spec.md` and/or `.prompts/plan/rules.md` (whichever describes mode selection)
- Update `SPEC_CHANGELOG.md` describing:
  - Left nav now controls mode
  - Mode dropdown removed

---

## Acceptance Criteria
- Left navigation shows: Planning, Building, Analyzing
- Mode dropdown is removed
- Clicking tabs changes the current mode
- UI remains the same across all three modes for now
- Behavior matches the selected mode (Planning uses Copilot; Building/Analyzing “coming soon”)
- App builds and runs (`tauri dev`)
- Specs updated and changelog updated

---

## Notes / Future Work (not in scope)
- Custom UI per mode
- Dedicated Activity/Files surfaces (if needed later)
- More advanced per-mode context injection and memory handling
