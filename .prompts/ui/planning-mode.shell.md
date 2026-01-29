# UI — Planning Mode Shell (Naide)

Planning Mode is a **section-based guided Q&A** that persists after app creation (though app creation is out of scope for v1).
For this prototype, implement the *shell* UI and core state transitions.

## Route
- Planning Mode route: `/planning`

## Purpose
Turn the user's Screen 1 intent into a structured plan. In v1, this is UI-only.

## Layout requirements (text-based mockup)
Match the approved Planning Mode mockup:

- **Left sidebar**: sections
- **Center**: guided questions for the selected section
- **Right panel**: Review / Assumptions / Notes summary
- **Footer**: "Plan is out of date → Rebuild Plan" and primary action

Suggested layout (approx):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Naide                                                                       │
├───────────────┬──────────────────────────────────────┬──────────────────────┤
│ Sidebar        │ Guided Q&A (center)                  │ Review (right)       │
│               │                                      │                      │
│ Overview       │ [Section Title]                     │ Plan summary         │
│ Features       │ Q: ...                              │ - Missing info       │
│ Data           │ A: ...                              │ - Assumptions        │
│ Access & Rules │                                      │ - Risks/Notes        │
│ Assumptions    │                                      │                      │
│ Plan Status    │                                      │                      │
├───────────────┴──────────────────────────────────────┴──────────────────────┤
│  Plan is out of date.  [ Rebuild Plan ]                 [ Generate App ]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sections (required)
Sidebar sections (v1):
1. Overview
2. Features
3. Data
4. Access & Rules
5. Assumptions
6. Plan Status

## Initial state (required)
When entering Planning Mode from Screen 1:
- Select **Overview** by default
- Pre-fill Overview’s first answer with `initialIntentText` under a prompt like:
  - "What do you want to build?"
- Right panel shows a brief summary (can be placeholders)

## Guided Q&A mechanics (required)
- Each section shows 3–5 question cards.
- Cards have:
  - question text
  - input control (text field, textarea, toggles)
  - optional helper text
- Keep questions non-technical.

**Important**: Editing any answer should mark the plan as **dirty**.

## Plan dirty / rebuild behavior (required)
- Maintain `planDirty: boolean`
- Default: `false` when Planning Mode first loads with the Screen 1 text inserted (treat insertion as “current”)
- If user edits any answer → `planDirty = true`
- Footer state:
  - When `planDirty = true`:
    - show label: "Plan is out of date"
    - enable + highlight **Rebuild Plan** button
    - disable (or visually deemphasize) **Generate App** button (Generate App is a stub anyway)
  - When user clicks **Rebuild Plan**:
    - simulate a rebuild (short fake progress state is optional)
    - set `planDirty = false`
    - show a small confirmation (toast or inline message): "Plan rebuilt"

## Generate App button (stub)
- Present on the footer for realism
- Disabled if plan is dirty
- For v1: clicking it can show a placeholder dialog: "Coming soon"

## Right review panel (required, placeholder ok)
Include sections:
- Missing info (list)
- Assumptions (list)
- Notes (free text, optional)
These can be static placeholders initially but should update minimally:
- Missing info: if some key fields are empty, list them (simple check)
- Assumptions: show 1–2 example items

## Navigation
- Sidebar click switches section
- Preserve entered values per section (state)
- Plan dirty state remains true until rebuild

## Out of scope
- No actual artifact file generation
- No Copilot SDK calls
- No persistence required
