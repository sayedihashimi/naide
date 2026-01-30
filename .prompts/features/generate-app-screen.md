# Feature: Generate App Screen (3-column layout)

## Goal
When the user clicks Generate App in Planning Mode, navigate to a new screen that sets up the next phase of Naide:
- Left column: navigation
- Center column: large chat area (conversation UI shell only)
- Right column: running app preview area (placeholder only)

This feature is UI layout only. Do not implement any AI functionality or app preview functionality yet.

---

## Scope (this iteration)
- Add a new route/screen for “Generate App”
- Hook up Planning Mode’s Generate App button to navigate to it
- Implement a 3-column layout with correct visual hierarchy and spacing
- Add placeholder controls/content in each column
- Keep styling consistent with existing Planning Mode mockup (dark mode, panels, typography)

Do NOT implement:
- Copilot SDK integration
- real chat sending/streaming
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
│               │  │ Input row:                              │  │  Status panel (optional) │
│               │  │ [ message input..................... ]  │  │  - “Not running yet”     │
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
   - Subtitle: “Talk to Naide to generate and refine your app.” (or similar)

2. Transcript panel:
   - Scrollable area
   - Include 1–2 placeholder assistant messages:
     - “I’m ready. I’ll generate an app based on your plan.”
     - “Before I start, anything you want to emphasize?”

3. Input row:
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

---

## Right column: Running app preview (placeholder)

Implement:
- Panel title: Running App
- Large empty state:
  - Text: “Your app will appear here once generated.”
  - Subtext: “Not running yet.”

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
- Center chat area shows placeholder messages and input row
- Right panel shows a clear “not running” state
- No AI or runtime functionality is implemented
