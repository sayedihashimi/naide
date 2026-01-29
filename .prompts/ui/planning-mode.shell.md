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
│ Data           │ A: [textarea with 💡 and ⛶]        │   (clickable)        │
│ Access & Rules │                                      │ - Assumptions        │
│ Assumptions    │                                      │   (+ X more ↕)       │
│ Plan Status    │                                      │ - Risks/Notes        │
│ ─────────────  │                                      │                      │
│ Code           │                                      │                      │
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
7. **Code** (separated at bottom with divider line)

## Code Section (required)
The Code section displays a read-only list of files that will be generated:
- Overview → Intent.md
- Features → AppSpec.md
- Data → DataSpec.md
- Access & Rules → Rules.md
- Assumptions → Assumptions.md
- Plan Status → Tasks.json

Display format:
- Each file shown with document icon, filename (monospace font), section name, and file type badge
- **Not editable**: User cannot modify this list
- Visual styling: cards with hover effects, consistent with dark theme

## Initial state (required)
When entering Planning Mode from Screen 1:
- Select **Overview** by default
- Pre-fill Overview's first answer with `initialIntentText` under a prompt like:
  - "What do you want to build?"
- Right panel shows a brief summary (can be placeholders)

## Guided Q&A mechanics (required)
- Each section shows 3–5 question cards.
- Cards have:
  - question text
  - input control (text field, textarea, toggles)
  - optional helper text
- Keep questions non-technical.

**Textarea controls**: Each textarea includes two icon buttons:
- **AI Assist button** (💡 lightbulb, yellow): Placeholder for future AI assistance
- **Expand/Collapse button** (⛶ resize, gray): Toggles between compact (h-24) and expanded (h-64) height

**Important**: Editing any answer should mark the plan as **dirty**.

## Plan dirty / rebuild behavior (required)
- Maintain `planDirty: boolean`
- Default: `false` when Planning Mode first loads with the Screen 1 text inserted (treat insertion as "current")
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
- **Missing info** (list with clickable links)
  - Each item is a button that navigates to the corresponding section
  - Shows first 5 items by default
  - **"+X more" link**: Clickable to expand/collapse full list
  - When expanded, shows "less" link to collapse
- **Assumptions** (list)
- **Notes** (free text, optional)

These can be static placeholders initially but should update minimally:
- Missing info: if some key fields are empty, list them (simple check)
- Assumptions: show 1–2 example items

## Navigation
- Sidebar click switches section
- Preserve entered values per section (state)
- Plan dirty state remains true until rebuild
- Missing info items navigate to corresponding sections when clicked

## Out of scope
- No actual artifact file generation
- No Copilot SDK calls
- No persistence required
- AI Assist button functionality (placeholder only)
