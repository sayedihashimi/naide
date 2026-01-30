# UI — Screen 1: Intent Capture (Naide)

Implement Screen 1 based on the approved mockup, updated to match the Planning Mode styling (dark UI, panels, typography).

## Route
- Screen 1 must be the default route: `/`

## Purpose
Let a non-pro user describe what they want to build. Do NOT mention code, frameworks, IDEs, or CLIs.

## Layout requirements (text-based mockup)
Use this as the layout reference (approximate spacing; match the vibe and hierarchy):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Naide                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  What do you want to build?                                              │
│  Describe the problem you're trying to solve. We'll handle the details.  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ [Large multiline text area ... ]                        [💡] [⛶] │  │
│  │                                                                    │  │
│  │ Placeholder examples rotate or pick one:                           │  │
│  │  - "I want an app for my team to track customer requests..."       │  │
│  │  - "I have a spreadsheet that's getting messy..."                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Quick starts:                                                           │
│   [ Track something ] [ Replace a spreadsheet ] [ For a team ]           │
│   [ Private internal tool ] [ Public app ]                               │
│                                                                          │
│                                                   [ Continue → ]         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Design notes:
- Screen background: dark
- Main content centered in a panel/card
- Subtle border/shadow; rounded corners (consistent with Planning Mode)
- Use Inter font for all UI text; keep typography similar to Planning Mode.
- **No subtitle** under "Naide" branding

## Components
Screen 1 should include:
1. **Naide branding header**
   - "Naide" wordmark only (no subtitle)
2. **Headline** + short supporting text (copy can be inspired by Planning Mode; not exact)
3. **Large textarea** with control buttons
   - Controlled component
   - Placeholder text includes example prompts (static or rotating; static acceptable for v1)
   - **AI Assist button** (💡 lightbulb icon, yellow, bottom-right area): Placeholder for AI assistance
   - **Expand/Collapse button** (⛶ resize icon, gray, bottom-right corner): Toggles textarea height
4. **5 chips** (buttons/pills)
   - Clicking inserts starter prompt text into textarea
   - Do NOT toggle selection; chips are insert-only
5. **Continue button**
   - Always enabled
   - Primary style button matching Planning Mode CTA style

## Textarea controls
Position two icon buttons in the bottom-right corner of the textarea:
- **AI Assist**: Left button, lightbulb icon, yellow (rgb(250, 204, 21) / yellow-400)
- **Expand/Collapse**: Right button, resize icon, gray
- Buttons should have hover effects and tooltips

## Chip behavior (required)
Provide 5 chips with starter prompts. Example mapping (you can adjust wording, keep intent):
- Track something → inserts: "I want an app to track ___ over time, with status and notes."
- Replace a spreadsheet → inserts: "I have a spreadsheet for ___ that is getting hard to manage. I want an easier app."
- For a team → inserts: "I want a shared app for my team to ___ with roles and permissions."
- Private internal tool → inserts: "I want an internal tool for my company to ___ and keep data private."
- Public app → inserts: "I want a public app where users can ___ and manage their own accounts."

Insertion rules:
- If textarea is empty → insert full text
- If textarea has content → append with a blank line before the inserted text

## Continue behavior (required)
- Continue is always enabled.
- On click:
  - If textarea trimmed is empty → show **modal dialog**
    - Title: "Describe what you want to build"
    - Body: "Add a short description so Naide can create a plan."
    - Buttons: "OK" (closes modal, focuses textarea)
  - Else:
    - Navigate to `/planning`
    - Pass `initialIntentText` (the textarea text) to Planning Mode
    - Planning Mode should pre-fill this into the Overview section.

## Modal requirements
- Use accessible dialog semantics (`role="dialog"`, `aria-modal="true"`)
- Trap focus
- Escape closes
- Clicking backdrop closes (optional but preferred)
- On close: focus returns to textarea

## Out of scope
- No network calls
- No file system operations
- No Copilot SDK integration
- AI Assist button is a placeholder only (no functionality yet)
