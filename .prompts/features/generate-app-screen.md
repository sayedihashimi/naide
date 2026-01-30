# Feature: Generate App Screen (3-column layout)

## Goal
When the user clicks Generate App in Planning Mode, navigate to a new screen that sets up the next phase of Naide:
- Left column: navigation
- Center column: large chat area with mode selector
- Right column: running app preview area (placeholder only)

This feature includes a mode selector for different Copilot chat modes: Planning, Building, and Analyzing.

---

## Copilot Modes

The Generate App screen supports three different modes for the Copilot chat:

### Planning Mode
- **Purpose**: Create and update specification files without touching actual code
- **System Prompts**: Uses planning system prompts from `.prompts/system/planning.system.md`
- **Behavior**: 
  - Goal is to create/update spec files (intent.md, app-spec.md, data-spec.md, rules.md, tasks.json)
  - Does NOT write or modify code
  - Reads context from .prompts/plan/**, .prompts/features/**, .naide/learnings/**
- **Welcome Messages**: Introduces the mode and explains it focuses on specs only
- **Default**: This is the default mode (will be changed to Building mode later)

### Building Mode
- **Purpose**: Update user code and spec files as needed
- **System Prompts**: Uses building system prompts from `.prompts/system/building.system.md`
- **Behavior**:
  - Goal is to implement features and update code
  - Also updates spec files when features change
  - Follows "UI first, then functionality" approach
  - Ensures builds/tests pass after changes
  - Records learnings for future reference
- **Welcome Messages**: Introduces the mode and explains it focuses on implementation

### Analyzing Mode
- **Purpose**: Analyze code and provide insights (coming soon)
- **System Prompts**: No prompts defined yet; will be added later
- **Behavior**: Placeholder mode for future functionality
- **Welcome Messages**: Indicates the mode is coming soon

### Mode Selection UI
- A dropdown is placed near the chat input area (above the textarea)
- Shows the current mode with a brief description
- User can switch modes at any time
- When mode is changed before the first user message, welcome messages update to match the new mode

### Copilot Integration
The actual integration with Copilot SDK will be implemented later. For now:
- Mode selection updates the UI and welcome messages
- Different system prompts are associated with each mode (documented above)
- The selected mode will be passed to the Copilot agent when integration is implemented
- Copilot will use the appropriate system prompt based on the selected mode

---

## Scope (this iteration)
- Add a new route/screen for "Generate App"
- Hook up Planning Mode's Generate App button to navigate to it
- Implement a 3-column layout with correct visual hierarchy and spacing
- Add mode selector dropdown with Planning, Building, and Analyzing options
- Display mode-specific welcome messages
- Add placeholder controls/content in each column
- Keep styling consistent with existing Planning Mode mockup (dark mode, panels, typography)

Do NOT implement:
- Copilot SDK integration (document behavior only)
- real chat sending/streaming with AI
- real app creation/running
- iframe/webview embedding a real app
- persistence

---

## Routing
- Add route: /generate (or /generate-app; pick one and use consistently)
- In Planning Mode:
  - When Generate App is clicked and the plan is not dirty, navigate to the new route
  - If the plan is dirty, keep current behavior (button disabled/deemphasized)

---

## Layout requirements (3 columns)

Overall layout:
- Full window height
- Dark mode only
- Use a grid/flex layout with 3 columns:
  - Left nav: fixed-ish width (approx 240–280px)
  - Center chat: flexible, largest column
  - Right app preview: fixed-ish width (approx 360–440px)
- Consistent padding and panel styling with Planning Mode:
  - Slightly lighter panels than the background
  - Subtle borders
  - Rounded corners

Text-based mockup reference:

┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Naide                                                                                      │
├───────────────┬───────────────────────────────────────────────┬───────────────────────────┤
│ Left Nav      │ Center: Chat                                  │ Right: Running App         │
│               │                                               │                           │
│ • Planning    │  ┌─────────────────────────────────────────┐  │  ┌─────────────────────┐ │
│ • Generate    │  │ Chat transcript area (scroll)           │  │  │ App preview shell    │ │
│ • Activity    │  │                                         │  │  │ (placeholder)        │ │
│ • Files       │  └─────────────────────────────────────────┘  │  └─────────────────────┘ │
│               │  ┌─────────────────────────────────────────┐  │                           │
│               │  │ Mode: [Planning ▼] (Create/update specs)│  │  Status panel (optional) │
│               │  │ Input row:                              │  │  - "Not running yet"     │
│               │  │ [ message input..................... ]  │  │                           │
│               │  │ [ Send ]  [ Attach ] (disabled)         │  │                           │
│               │  └─────────────────────────────────────────┘  │                           │
└───────────────┴───────────────────────────────────────────────┴───────────────────────────┘

---

## Left column: Navigation (placeholder)
Purpose: quick switching between modes later.

Implement a simple vertical nav:
- Planning (links back to /planning)
- Generate (current, highlighted)
- Activity (disabled / no-op)
- Files (disabled / no-op)

Notes:
- Visually match the Planning Mode sidebar
- Disabled items should appear muted and non-interactive

---

## Center column: Chat area (shell only)

Elements:
1. Header row:
   - Title: Generate App
   - Subtitle: "Talk to Naide to generate and refine your app." (or similar)

2. Transcript panel:
   - Scrollable area
   - Display mode-specific welcome messages based on selected mode

3. Mode selector (above input row):
   - Dropdown with options: Planning, Building, Analyzing
   - Shows current mode and brief description
   - Default to Planning mode

4. Input row:
   - Text input or textarea
   - **Expand/Collapse control**: All textareas must include an expand/collapse button (similar to Planning Mode) to toggle between compact and expanded height
   - Buttons:
     - Send (enabled when user types)
     - Attach (disabled)
   - **Keyboard behavior**:
     - Enter: adds a new line
     - Ctrl+Enter (Cmd+Enter on macOS): submits the message

Behavior:
- User can type messages in the textarea
- Ctrl/Cmd+Enter submits the message
- Enter adds a new line without submitting
- Messages are persisted to disk in `.naide/chatsessions/` folder within the project
- Stub response: "naide response coming soon" for all user messages
- Mode changes update welcome messages if chat hasn't been initialized yet

---

## Right column: Running app preview (placeholder)

Implement:
- Panel title: Running App
- Large empty state:
  - Text: "Your app will appear here once generated."
  - Subtext: "Not running yet."

Optional footer:
- Start button (disabled)
- Stop button (disabled)

Do not embed an iframe or real app runtime.

---

## Styling guidance
- Use the same typography scale and spacing as Planning Mode
- Use Inter for UI text
- Use JetBrains Mono sparingly (status labels, etc.)
- Center chat column should feel dominant
- Right preview panel should feel reserved for live content

---

## Acceptance criteria
- Clicking Generate App navigates to the new screen
- 3-column layout renders correctly
- Left nav can return to Planning Mode
- Center chat area shows mode selector dropdown
- Mode selector has three options: Planning (default), Building, Analyzing
- Mode-specific welcome messages display correctly
- Right panel shows a clear "not running" state
- No AI or runtime functionality is implemented
