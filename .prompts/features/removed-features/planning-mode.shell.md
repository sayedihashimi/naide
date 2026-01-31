# REMOVED FEATURE (HISTORICAL ONLY)

- Status: Removed
- RemovedAt: 2026-01-31 03:49 (UTC)
- Notes: This feature has been removed from Naide. This file is retained for historical reference only.

## Replacement
- The separate Planning Mode UI with form-based Q&A has been removed
- Planning is now fully chat-driven on the Generate App screen
- Spec files are continuously updated through chat conversations
- No more "Rebuild Plan" button or planDirty state management

---

# UI — Planning Mode Shell (Naide)

Planning Mode is a **section-based guided Q&A** that persists after app creation (though app creation is out of scope for v1).
For this prototype, implement the *shell* UI and core state transitions with full file persistence.

## Route
- Planning Mode route: `/planning`
- App checks for existing project on startup
- If project exists: Load and go directly to Planning Mode
- If no project: Show Screen 1 first

## Purpose
Turn the user's Screen 1 intent into a structured plan. In v1, this includes full file persistence to markdown files.

## Layout requirements (text-based mockup)
Match the approved Planning Mode mockup:

- **Left sidebar**: sections
- **Center**: guided questions for the selected section
- **Right panel**: Review / Assumptions / Notes summary
- **Footer**: "Plan is out of date → Update plan" and primary action
- **Title bar**: Clickable project name with folder icon

Suggested layout (approx):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Naide                                                     [📁 MyApp]         │
├───────────────┬──────────────────────────────────────┬──────────────────────┤
│ Sidebar        │ Guided Q&A (center)                  │ Review (right)       │
│               │                                      │                      │
│ Overview       │ [Section Title]                     │ Plan summary         │
│ Features       │ Q: ...                              │ - Missing info       │
│ Data           │ A: [textarea with 💡 and ⛶]        │   (clickable)        │
│ Access & Rules │    (saves on blur)                   │ - Assumptions        │
│ Assumptions    │                                      │   (+ X more ↕)       │
│ Plan Status    │                                      │ - Risks/Notes        │
│ ─────────────  │                                      │                      │
│ Code           │                                      │                      │
├───────────────┴──────────────────────────────────────┴──────────────────────┤
│  Plan is out of date.  [ Update plan ]                  [ Generate App ]     │
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

When entering Planning Mode from app startup (existing project):
- Load all section data from files
- Populate textareas with saved content
- Select **Overview** by default
- Plan is NOT marked as dirty (freshly loaded state)

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

**Save behavior**:
- Save on textarea blur (when user clicks away)
- Save on text input blur
- Save when "Update plan" clicked
- Save before project switching

**Important**: Editing any answer should mark the plan as **dirty**.

## Plan dirty / rebuild behavior (required)
- Maintain `planDirty: boolean`
- Default: `false` when Planning Mode first loads (either from Screen 1 or from file loading)
- If user edits any answer → `planDirty = true`
- Footer state:
  - When `planDirty = true`:
    - show label: "Plan is out of date"
    - enable + highlight **Update plan** button
    - disable (or visually deemphasize) **Generate App** button (Generate App is a stub anyway)
  - When user clicks **Update plan**:
    - save all changes to files
    - set `planDirty = false`
    - show a small confirmation (toast or inline message): "Plan updated"

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
- Plan dirty state remains true until update
- Missing info items navigate to corresponding sections when clicked

## Project Management
- **Title bar**: Shows project name (e.g., "MyApp") with folder icon
- **Click project name**: 
  - Save current project
  - Show folder picker dialog
  - Load selected project or create new one
  - If project has files: Load and show Planning Mode
  - If empty folder: Create files and show Screen 1

## Out of scope
- No actual app generation
- No Copilot SDK calls
- AI Assist button functionality (placeholder only)
