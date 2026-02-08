---
Status: planned
Area: ui, chat, copilot
Created: 2026-02-08
LastUpdated: 2026-02-08
---

# Feature: Terminal Command Output Visible in Chat
**Status**: 🟡 PLANNED

## Summary
When Copilot executes terminal commands (e.g., `npm install`, `npm run build`, `dotnet build`), the command and its output should appear inline in the chat window as collapsible/expandable blocks. Output streams in near real-time. These command output blocks are **ephemeral** — they are visible during the session but are NOT persisted to chat session files. On reload, they are replaced with a simple placeholder like "(command executed)".

---

## Goals
- Give users visibility into what terminal commands Copilot is running and their output
- Stream output in near real-time so users can follow progress
- Keep the chat clean with collapsible sections (collapsed by default)
- Avoid bloating chat session files with large command output
- Work in both Planning and Building modes

---

## Non-Goals
- Interactive terminal (users cannot type input into running commands)
- ANSI color/formatting support (plain text only for MVP)
- Filtering or searching command output
- Re-running failed commands from the UI
- Persisting command output across sessions

---

## Problem Statement
When Copilot runs terminal commands during a session (builds, installs, tests), users have zero visibility into what's happening. They see the AI "thinking" but can't tell:
- Which commands are being executed
- Whether the command is still running or finished
- What the output/errors look like
- Why a build might be failing

This is especially frustrating for longer commands like `npm install` or `dotnet build` where output streams over several seconds. Users need to see this output to understand what the AI is doing and to diagnose issues.

---

## Core Behavior

### Command Output Block

When Copilot executes a terminal command, a **command output block** appears in the chat between assistant messages (or within the assistant's streaming response). Each block contains:

1. **Header** (always visible):
   - Expand/collapse chevron (▶/▼)
   - Command text in monospace font (e.g., `npm run build`)
   - Status indicator: spinner while running, ✓ on success, ✗ on failure
   - Collapsed by default

2. **Body** (visible when expanded):
   - Full command output in monospace font
   - Scrollable if output is long (max-height ~300px)
   - Output streams in near real-time as it's produced
   - Dark background (zinc-950) to visually distinguish from chat messages

### Visual Layout

**Collapsed (default):**
```
┌──────────────────────────────────────────────┐
│ ▶ $ npm run build                        ✓   │
└──────────────────────────────────────────────┘
```

**Expanded:**
```
┌──────────────────────────────────────────────┐
│ ▼ $ npm run build                        ✓   │
├──────────────────────────────────────────────┤
│ > naide-desktop@0.1.0 build                  │
│ > vite build                                 │
│                                              │
│ vite v5.4.14 building for production...      │
│ ✓ 1234 modules transformed.                 │
│ dist/index.html  0.46 kB │ gzip: 0.30 kB    │
│ dist/assets/index-abc123.js  145.67 kB       │
│                                              │
│ Build completed in 3.2s                      │
└──────────────────────────────────────────────┘
```

**Running (spinner):**
```
┌──────────────────────────────────────────────┐
│ ▼ $ npm install                          ⟳   │
├──────────────────────────────────────────────┤
│ added 45 packages in 2s                      │
│ ░░░░░░░░░░░ (still streaming...)             │
└──────────────────────────────────────────────┘
```

**Failed:**
```
┌──────────────────────────────────────────────┐
│ ▶ $ npm run build                        ✗   │
└──────────────────────────────────────────────┘
```

### Timing & Placement

Command output blocks appear **at the point in the conversation where the command is executed**. Since Copilot streams its response and interleaves text with tool calls, the flow looks like:

```
[Assistant message text streaming...]
"Let me build the project to verify..."

[Command block: $ npm run build]
  (output streams in real-time)

[Assistant message continues streaming...]
"The build succeeded. Now let me run the tests..."

[Command block: $ npm test]
  (output streams in real-time)

[Assistant message continues...]
"All 42 tests passed."
```

### Collapse/Expand Behavior
- **Default state**: Collapsed
- **While running**: Automatically expanded (so users can see live output)
- **After completion**: Automatically collapses after 2 seconds
- **Manual toggle**: User can click the header to expand/collapse at any time
- **Manual override**: If user manually expands/collapses during execution, the auto-collapse on completion is disabled for that block

---

## Persistence Model

### During Session (In-Memory)
- Command output blocks are stored in React component state
- They are rendered inline in the chat message list
- Full output is available for expand/collapse interaction

### On Save to Disk (chat-active.json / archived chats)
- Command output blocks are **NOT saved** to chat session files
- When the chat is serialized for persistence, command blocks are replaced with a placeholder message:
  - Content: `(command executed)`
  - Stored as a regular message with a special flag or type

### On Load from Disk
- The placeholder `(command executed)` messages are rendered as simple, non-expandable text
- They serve as a historical record that a command ran, without the output

### Message Structure

**In-memory (during session):**
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'command';  // New 'command' role
  content: string;           // For 'command': the full output text
  timestamp: string;
  // New fields for command messages:
  command?: string;          // The command that was run (e.g., "npm run build")
  commandStatus?: 'running' | 'success' | 'error';
  isExpanded?: boolean;      // UI state
}
```

**On disk (serialized):**
```typescript
// Command messages are saved as:
{
  id: "...",
  role: "command",
  content: "(command executed)",   // Placeholder only
  timestamp: "...",
  command: "npm run build",        // Keep the command name for context
  commandStatus: "success"         // Keep the final status
}
```

---

## Technical Implementation

### SSE Event Extensions

The sidecar already emits `tool_start`, `tool_progress`, and `tool_complete` SSE events. Extend these to include command execution details:

**New SSE event: `command_start`**
```json
{
  "type": "command_start",
  "data": {
    "commandId": "cmd-abc123",
    "command": "npm run build",
    "toolCallId": "tc-xyz"
  }
}
```

**New SSE event: `command_output`**
```json
{
  "type": "command_output",
  "data": {
    "commandId": "cmd-abc123",
    "output": "vite v5.4.14 building for production...\n"
  }
}
```

**New SSE event: `command_complete`**
```json
{
  "type": "command_complete",
  "data": {
    "commandId": "cmd-abc123",
    "exitCode": 0,
    "success": true
  }
}
```

### Sidecar Changes (`src/copilot-sidecar/src/index.ts`)

The sidecar needs to detect when Copilot SDK is executing a terminal/shell command (via tool execution events) and forward the output incrementally.

**Detecting command execution:**
The Copilot SDK uses tools like `runCommand`, `executeCommand`, `terminal`, or `shell` to run terminal commands. When a `tool.execution_start` event fires with a tool name matching a command execution pattern:

1. Extract the command string from the tool arguments
2. Emit a `command_start` SSE event
3. During `tool.execution_progress` events, check if the progress message contains command output and emit `command_output` SSE events
4. On `tool.execution_complete`, emit `command_complete` with success/failure status

**Implementation approach:**

```typescript
// In tool.execution_start handler
const COMMAND_TOOLS = ['run_command', 'execute_command', 'run_in_terminal', 
                       'shell', 'bash', 'powershell', 'terminal'];

if (COMMAND_TOOLS.some(t => toolName.includes(t))) {
  const command = extractCommandFromArgs(args);
  const commandId = `cmd-${event.data.toolCallId}`;
  
  sendEvent('command_start', {
    commandId,
    command,
    toolCallId: event.data.toolCallId
  });
  
  // Track this tool call as a command execution
  activeCommands.set(event.data.toolCallId, { commandId, command });
}

// In tool.execution_progress handler
const activeCmd = activeCommands.get(event.data.toolCallId);
if (activeCmd && event.data.progressMessage) {
  sendEvent('command_output', {
    commandId: activeCmd.commandId,
    output: event.data.progressMessage
  });
}

// In tool.execution_complete handler
const activeCmd = activeCommands.get(event.data.toolCallId);
if (activeCmd) {
  sendEvent('command_complete', {
    commandId: activeCmd.commandId,
    exitCode: event.data.exitCode ?? (event.data.success ? 0 : 1),
    success: event.data.success !== false
  });
  activeCommands.delete(event.data.toolCallId);
}
```

**Note:** The exact tool names used by the Copilot SDK for command execution need to be verified by logging `event.data.toolName` during actual Building mode sessions. The list above is a best guess and should be refined during implementation.

### Frontend Changes (`GenerateAppScreen.tsx`)

#### New SSE Event Handlers

In the streaming event processing loop (around line 616), add handlers:

```typescript
case 'command_start': {
  const { commandId, command } = eventData.data;
  // Insert a command message into the chat
  const cmdMessage: ChatMessage = {
    id: commandId,
    role: 'command',
    content: '',
    timestamp: new Date().toISOString(),
    command: command,
    commandStatus: 'running',
    isExpanded: true,  // Auto-expand while running
  };
  setMessages(prev => [...prev, cmdMessage]);
  break;
}

case 'command_output': {
  const { commandId, output } = eventData.data;
  setMessages(prev =>
    prev.map(m =>
      m.id === commandId
        ? { ...m, content: m.content + output }
        : m
    )
  );
  break;
}

case 'command_complete': {
  const { commandId, success } = eventData.data;
  setMessages(prev =>
    prev.map(m =>
      m.id === commandId
        ? { 
            ...m, 
            commandStatus: success ? 'success' : 'error',
            // Auto-collapse after 2 seconds (unless user manually toggled)
          }
        : m
    )
  );
  // Schedule auto-collapse after 2 seconds
  setTimeout(() => {
    setMessages(prev =>
      prev.map(m =>
        m.id === commandId && !m.userToggled
          ? { ...m, isExpanded: false }
          : m
      )
    );
  }, 2000);
  break;
}
```

### New Component: `CommandOutputBlock.tsx`

```typescript
interface CommandOutputBlockProps {
  command: string;
  output: string;
  status: 'running' | 'success' | 'error';
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Rendering:**
- Header with chevron, command text (`$` prefix, monospace), and status icon
- Body with scrollable `<pre>` element for output
- Click handler on header toggles expand/collapse

**Styling:**
- Container: `bg-zinc-950 border border-zinc-800 rounded-lg my-2`
- Header: `px-4 py-2 flex items-center cursor-pointer hover:bg-zinc-900`
- Command text: `font-mono text-sm text-zinc-300`
- Output area: `px-4 py-2 max-h-[300px] overflow-y-auto`
- Output text: `font-mono text-xs text-zinc-400 whitespace-pre-wrap`
- Status icons:
  - Running: `Loader2` (spinning, blue-400)
  - Success: `CheckCircle` (green-400)
  - Error: `XCircle` (red-400)

### Chat Persistence Changes (`chatPersistence.ts`)

Update the save logic to strip command output when persisting:

```typescript
function serializeMessagesForDisk(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(m => {
    if (m.role === 'command') {
      return {
        ...m,
        content: '(command executed)',
        isExpanded: undefined,  // Don't persist UI state
        userToggled: undefined,
      };
    }
    return m;
  });
}
```

### Message Rendering Changes

In the message list rendering section of `GenerateAppScreen.tsx`, add handling for `command` role messages:

```tsx
{messages.map((message, idx) => {
  if (message.role === 'command') {
    return (
      <CommandOutputBlock
        key={message.id}
        command={message.command || ''}
        output={message.content}
        status={message.commandStatus || 'success'}
        isExpanded={message.isExpanded ?? false}
        onToggle={() => handleToggleCommandBlock(message.id)}
      />
    );
  }
  // ... existing user/assistant rendering
})}
```

For loaded-from-disk command messages (content is "(command executed)"):
```tsx
if (message.role === 'command' && message.content === '(command executed)') {
  return (
    <div className="my-2 px-4 py-2 text-zinc-500 text-sm italic font-mono">
      $ {message.command} — (command executed)
    </div>
  );
}
```

---

## Edge Cases

### Multiple Commands in Sequence
- Each command gets its own block with its own `commandId`
- They appear in chronological order in the chat
- Only the currently running command auto-expands

### Very Long Output
- Output area has `max-height: 300px` with `overflow-y: auto`
- Auto-scrolls to bottom as new output arrives (while running)
- User can scroll up to review earlier output

### Command Output During Text Streaming
- The assistant message text and command blocks can interleave
- The command block is inserted as a separate message between text segments
- Assistant text before the command is in one message, text after is in the continuation

### Empty Output
- Some commands produce no stdout/stderr
- Show the command header with status, no expandable body
- Or show "(no output)" in the body when expanded

### Command With Only Stderr
- Treat stderr and stdout the same — show all output in the block
- Error output appears in the same stream

### Session Reload
- After reloading a chat from disk, command messages show as:
  `$ npm run build — (command executed)`
- No expand/collapse available (output was not persisted)

### Command Cancelled (via Stop button)
- If user clicks Stop during a command, the command block shows with error status
- Output up to the cancellation point is preserved (in memory)
- On disk: same `(command executed)` placeholder

---

## UI/UX Details

### Styling Guide
- **Container**: Distinct from chat bubbles — no rounded chat bubble style, use a flat card
- **Background**: `bg-zinc-950` (darker than chat messages at `bg-zinc-900`)
- **Border**: `border-zinc-800`, 1px, rounded-lg
- **Margin**: `my-2` (8px vertical gap from surrounding messages)
- **Header font**: Monospace (JetBrains Mono), `text-sm`
- **Output font**: Monospace (JetBrains Mono), `text-xs`
- **Output color**: `text-zinc-400` (slightly muted)
- **Status icons**: 18px, positioned on the right side of the header

### Auto-Scroll Behavior
- While a command is running, the output area auto-scrolls to the bottom
- If the user manually scrolls up, auto-scroll pauses
- Auto-scroll resumes if the user scrolls back to the bottom

### Accessibility
- Expand/collapse uses `aria-expanded` attribute
- Command text is readable by screen readers
- Status changes announced via `aria-live="polite"` region

---

## Acceptance Criteria

- [ ] When Copilot executes a terminal command, a command output block appears in the chat
- [ ] The block shows the command name with `$` prefix in monospace font
- [ ] Output streams in near real-time as the command produces it
- [ ] Block is collapsed by default but auto-expands while the command is running
- [ ] Block auto-collapses 2 seconds after command completion
- [ ] User can manually expand/collapse by clicking the header
- [ ] Manual toggle overrides auto-collapse behavior
- [ ] Status indicators: spinner (running), checkmark (success), X (error)
- [ ] Output area is scrollable with max-height ~300px
- [ ] Command output blocks are NOT saved to chat session files
- [ ] On disk, command messages are stored as "(command executed)" with command name and status
- [ ] Loaded-from-disk command messages show as non-expandable `$ command — (command executed)`
- [ ] Works in both Planning and Building modes
- [ ] Multiple sequential commands each get their own block
- [ ] Empty command output handled gracefully
- [ ] App builds and all existing tests pass
- [ ] No console errors or warnings

---

## Files to Create

- `src/naide-desktop/src/components/CommandOutputBlock.tsx` — New component for rendering command blocks

## Files to Modify

### Sidecar
- `src/copilot-sidecar/src/index.ts` — Add `command_start`, `command_output`, `command_complete` SSE events; detect command tool executions

### Frontend
- `src/naide-desktop/src/pages/GenerateAppScreen.tsx` — Handle new SSE events, render command blocks in message list, command toggle handler
- `src/naide-desktop/src/utils/chatPersistence.ts` — Strip command output on save, handle command messages on load
- `src/naide-desktop/src/components/MessageContent.tsx` — May need updates if command blocks are rendered within message content

### Types
- Update `ChatMessage` interface to include `command`, `commandStatus`, `isExpanded`, `userToggled` fields (wherever it's defined)

---

## Implementation Notes

### Discovering Tool Names
The exact tool names used by the Copilot SDK for command execution are not fully documented. During implementation:
1. Add logging to `tool.execution_start` to capture all tool names
2. Run a Building mode session that triggers commands
3. Identify the exact tool name patterns (e.g., `runCommand`, `executeInTerminal`, etc.)
4. Update the `COMMAND_TOOLS` list accordingly

### Output Chunking
The `tool.execution_progress` event may deliver output in varying chunk sizes. The frontend should handle:
- Single-character chunks (unlikely but possible)
- Multi-line chunks
- Large chunks (buffer and render efficiently)

Consider debouncing UI updates if chunks arrive very rapidly (e.g., batch updates every 50ms).

---

## Future Enhancements

### ANSI Color Support
- Parse ANSI escape codes and render with appropriate colors
- Libraries like `ansi-to-html` or `ansi-to-react` could help

### Copy Output
- Add a "Copy" button to the command block header
- Copies the full output to clipboard

### Re-Run Command
- Add a "Re-run" button to re-execute a failed command
- Would need to integrate with the sidecar's command execution

### Persist Output (Optional)
- Allow users to "pin" command output for persistence
- Pinned blocks would be saved to chat session files

### Filter/Search Output
- For very long outputs, add a search box within the expanded block

---

## Dependencies

### Frontend
- Lucide React icons: `ChevronRight`, `ChevronDown`, `Loader2`, `CheckCircle`, `XCircle` (already available)
- No new packages required

### Sidecar
- No new packages required (uses existing SSE and tool event infrastructure)

---

## Related Features
- [2026-02-01-stream-copilot-responses.md](./2026-02-01-stream-copilot-responses.md) — SSE streaming architecture
- [2026-02-03-ai-activity-status-display.md](./2026-02-03-ai-activity-status-display.md) — Status events via WebSocket (complementary, not replaced)
- [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) — Building mode triggers command execution
- [2026-02-08-stop-copilot-request.md](./2026-02-08-stop-copilot-request.md) — Stop button interaction with running commands

---

created by naide
