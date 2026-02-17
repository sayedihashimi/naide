---
Status: planned
Area: vscode, copilot, extension
Created: 2026-02-17
LastUpdated: 2026-02-17
---

# Feature: Naide as a VS Code Copilot Chat Extension
**Status**: 🟡 PLANNED

## Summary
Build a native VS Code extension that registers a **Copilot Chat participant** (`@naide`). Users interact with Naide by typing `@naide` in the Copilot Chat panel. The extension provides the same spec-driven development workflow as the desktop app but uses VS Code's native UI for everything — file viewing, editing, terminal, file explorer — and targets **professional developers**.

No standalone UI. No sidecar. No custom chat panel. Pure VS Code integration.

---

## Goals
- Register a `@naide` Copilot Chat participant with slash commands for modes
- Reuse the spec-driven workflow: `.prompts/plan/**`, `.prompts/features/**`, `.prompts/learnings/**`
- Reuse system prompts from `.prompts/system/` (adapted for pro developers)
- Provide `search_learnings` as a registered tool
- Support modes: Auto (default), Planning, Building, Analyzing — via slash commands
- Let VS Code handle: chat history, file viewing/editing, terminals, file explorer, tabs
- Ship as a standalone VSIX installable from the Marketplace

---

## Non-Goals
- Custom webview panels or sidebar UI
- Custom chat persistence (Copilot Chat handles this)
- Custom file viewer/editor (VS Code handles this)
- Running apps from the extension (users have VS Code's terminal and debug tools)
- Replicating the desktop app's left panel, tab system, or 3-column layout
- Supporting non-professional developers (desktop app serves that audience)

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│  VS Code                            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Copilot Chat Panel          │    │
│  │                             │    │
│  │ User: @naide add a login    │    │
│  │       page                  │    │
│  │                             │    │
│  │ Naide: I'll plan this out.. │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ File Explorer│ │ Editor Tabs  │  │
│  │ (native)     │ │ (native)     │  │
│  └──────────────┘ └──────────────┘  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Terminal (native)           │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘

Extension internals:
┌─────────────────────────────────────┐
│ @naide Chat Participant             │
│                                     │
│  ├─ Slash commands: /plan /build    │
│  │   /analyze (no slash = Auto)     │
│  │                                  │
│  ├─ System prompt loader            │
│  │   (reads .prompts/system/*.md)   │
│  │                                  │
│  ├─ Spec/feature file loader        │
│  │   (reads .prompts/plan/**,       │
│  │    .prompts/features/**)         │
│  │                                  │
│  ├─ search_learnings tool           │
│  │   (registered via vscode.lm)     │
│  │                                  │
│  └─ Response handler                │
│      (streams markdown responses)   │
└─────────────────────────────────────┘
```

---

## Interaction Model

### How Users Interact
Users type in the **Copilot Chat panel** (the standard GitHub Copilot Chat):

```
@naide add a login page with email/password
@naide /plan design an authentication system
@naide /build implement the dark mode toggle from the spec
@naide /analyze review the API error handling
```

### What Naide Does
1. Reads the user's message and determines mode (Auto, or explicit via slash command)
2. Loads system prompts from `.prompts/system/`
3. Loads spec files from `.prompts/plan/`
4. Loads feature files from `.prompts/features/`
5. Assembles the full context and sends it as participant instructions
6. The Copilot language model generates a response with Naide's context
7. Response is streamed back to the Copilot Chat panel as markdown

### Slash Commands

| Command | Mode | Description |
|---------|------|-------------|
| *(none)* | Auto | Default — Copilot infers planning vs building |
| `/plan` | Planning | Create/update specs only, no code changes |
| `/build` | Building | Implement code changes, update specs |
| `/analyze` | Analyzing | Analyze code and provide insights |

---

## VS Code Extension Structure

### Project Location
```
src/naide-vscode/
├── package.json          # Extension manifest
├── tsconfig.json
├── src/
│   ├── extension.ts      # Entry point — activate/deactivate
│   ├── participant.ts    # Chat participant registration and handler
│   ├── prompts.ts        # System prompt and spec file loading
│   ├── learnings.ts      # search_learnings tool implementation
│   └── modes.ts          # Mode definitions and slash command config
├── .vscodeignore
└── README.md
```

### package.json (Key Fields)

```json
{
  "name": "naide",
  "displayName": "Naide",
  "description": "Spec-driven AI development assistant — plan, build, and analyze with project context",
  "version": "0.1.0",
  "publisher": "naide",
  "engines": {
    "vscode": "^1.99.0"
  },
  "categories": ["AI", "Chat"],
  "extensionDependencies": [
    "github.copilot-chat"
  ],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "chatParticipants": [
      {
        "id": "naide.chat",
        "name": "naide",
        "fullName": "Naide",
        "description": "Spec-driven AI development assistant",
        "isSticky": true,
        "commands": [
          {
            "name": "plan",
            "description": "Create or update specifications without modifying code"
          },
          {
            "name": "build",
            "description": "Implement code changes based on specifications"
          },
          {
            "name": "analyze",
            "description": "Analyze code quality, architecture, and patterns"
          }
        ]
      }
    ],
    "languageModelTools": [
      {
        "name": "naide_searchLearnings",
        "displayName": "Search Project Learnings",
        "description": "Search project learnings (.prompts/learnings/) for relevant context based on keywords. Returns matching learnings that contain corrections, constraints, and past decisions.",
        "parametersSchema": {
          "type": "object",
          "properties": {
            "keywords": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Keywords to search for in learnings (e.g., ['react', 'testing'])"
            }
          },
          "required": ["keywords"]
        }
      }
    ]
  }
}
```

---

## Implementation Details

### extension.ts — Entry Point

```typescript
import * as vscode from 'vscode';
import { registerNaideParticipant } from './participant';
import { registerLearningsTool } from './learnings';

export function activate(context: vscode.ExtensionContext) {
  registerNaideParticipant(context);
  registerLearningsTool(context);
}

export function deactivate() {}
```

### participant.ts — Chat Participant

The core of the extension. Registers the `@naide` chat participant and handles requests.

**Key responsibilities:**
1. Receive user messages from Copilot Chat
2. Determine mode from slash command (or Auto if none)
3. Load and assemble system prompts + spec context
4. Send the request to the language model with Naide's instructions
5. Stream the response back to the user

```typescript
import * as vscode from 'vscode';
import { loadSystemPrompts, loadSpecFiles, loadFeatureFiles } from './prompts';
import { getModeFromCommand } from './modes';

export function registerNaideParticipant(context: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant('naide.chat', handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
  context.subscriptions.push(participant);
}

const handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) => {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    stream.markdown('Please open a workspace folder to use Naide.');
    return;
  }

  const mode = getModeFromCommand(request.command);
  const systemPrompt = await loadSystemPrompts(workspaceRoot, mode);
  const specs = await loadSpecFiles(workspaceRoot);
  const features = await loadFeatureFiles(workspaceRoot);

  const instructions = [systemPrompt, specs, features].filter(Boolean).join('\n\n');

  // Reference the search_learnings tool so Copilot can use it
  const learningsTool = vscode.lm.tools.filter(
    tool => tool.name === 'naide_searchLearnings'
  );

  const messages = [
    vscode.LanguageModelChatMessage.User(request.prompt)
  ];

  // Use the language model with Naide's context as instructions
  const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o'
  });

  if (models.length === 0) {
    stream.markdown('No language model available. Ensure GitHub Copilot is active.');
    return;
  }

  const chatRequest = await models[0].sendRequest(
    messages,
    {
      instructions: instructions,
      tools: learningsTool
    },
    token
  );

  // Stream the response
  for await (const fragment of chatRequest.text) {
    stream.markdown(fragment);
  }
};
```

> **Note:** This is illustrative pseudocode. The actual implementation will follow the latest VS Code Chat extensions API, which may differ in details (e.g., tool invocation handling, model selection). The implementer should consult the [VS Code Chat extensions guide](https://code.visualstudio.com/api/extension-guides/chat) and [language model API](https://code.visualstudio.com/api/extension-guides/language-model) for current patterns.

### prompts.ts — System Prompt & Spec Loading

Reads prompt files from the workspace. Reuses the same `.prompts/` structure as the desktop app.

**System prompts loaded (in order):**
1. `.prompts/system/base.system.md`
2. Mode-specific prompt (based on slash command or Auto):
   - Auto: `.prompts/system/auto.system.md` + both `planning.system.md` and `building.system.md`
   - Planning: `.prompts/system/planning.system.md`
   - Building: `.prompts/system/building.system.md`
   - Analyzing: `.prompts/system/analyzing.system.md`

**Spec files loaded:**
- `.prompts/plan/intent.md`
- `.prompts/plan/app-spec.md`
- `.prompts/plan/data-spec.md`
- `.prompts/plan/rules.md`
- `.prompts/plan/tasks.json`

**Feature files loaded:**
- All `.md` files from `.prompts/features/` (recursive, excluding `removed-features/` and `bugs/`)

**Adaptation for pro developers:**
The system prompts may need minor adjustments for the VS Code audience (less hand-holding, more technical language). This can be done via:
- A new section appended to the system prompt: "You are interacting with a professional developer in VS Code..."
- Or separate VS Code–specific prompt overlays (future enhancement)

For MVP, reuse the existing prompts as-is. They work well for all developers.

### learnings.ts — search_learnings Tool

Registered as a VS Code language model tool. The Copilot language model can call this tool during a conversation to retrieve relevant learnings.

**Implementation mirrors the sidecar's `searchLearnings` function:**
1. Read `.md` files from `.prompts/learnings/`
2. Score each file by keyword matches (filename match = +3, content occurrence = +1)
3. Return top 5 matches

```typescript
import * as vscode from 'vscode';

export function registerLearningsTool(context: vscode.ExtensionContext) {
  const tool = vscode.lm.registerTool('naide_searchLearnings', {
    invoke: async (options, token) => {
      const params = options.parameters as { keywords: string[] };
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

      if (!workspaceRoot) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('No workspace open.')
        ]);
      }

      const result = await searchLearnings(workspaceRoot, params.keywords);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(result)
      ]);
    }
  });

  context.subscriptions.push(tool);
}
```

### modes.ts — Mode Configuration

Maps slash commands to modes and provides mode-specific configuration.

```typescript
export type NaideMode = 'Auto' | 'Planning' | 'Building' | 'Analyzing';

export function getModeFromCommand(command: string | undefined): NaideMode {
  switch (command) {
    case 'plan': return 'Planning';
    case 'build': return 'Building';
    case 'analyze': return 'Analyzing';
    default: return 'Auto';
  }
}
```

---

## What Is Reused From the Desktop App

### Fully Reused (Files on Disk)
- **System prompts**: `.prompts/system/base.system.md`, `planning.system.md`, `building.system.md`, `analyzing.system.md`, `auto.system.md`
- **Spec files**: `.prompts/plan/**` (intent.md, app-spec.md, data-spec.md, rules.md, tasks.json)
- **Feature files**: `.prompts/features/**`
- **Learnings**: `.prompts/learnings/**`
- **Bug convention**: `.prompts/features/bugs/`

### Reused as Patterns (Reimplemented in Extension)
- **`searchLearnings` algorithm**: Same keyword scoring logic, reimplemented using `vscode.workspace.fs` instead of Node `fs`
- **Safe file write logic**: Path validation, blocked patterns — reimplemented for the extension if file writes are needed
- **Prompt assembly order**: Same ordering (base → mode → specs → features → learnings instructions)
- **Conversation memory instructions**: Appended to system prompt (though Copilot Chat handles history natively, the summary format can still be useful for long conversations)

### Not Reused
- **Copilot sidecar** (`src/copilot-sidecar/`): Not needed — VS Code's Copilot API replaces it entirely
- **Tauri backend** (`src-tauri/`): Not needed — no desktop shell
- **React frontend** (`src/naide-desktop/src/`): Not needed — no custom UI
- **Custom chat persistence**: Copilot Chat handles this
- **Custom tab system**: VS Code handles this
- **App runner**: VS Code's terminal and debug tools handle this
- **WebSocket status events**: Not needed in VS Code context
- **Proxy server**: Not needed

---

## File Operations in the Extension

### Reading Files
Use `vscode.workspace.fs.readFile()` for all file reads. This works with VS Code's virtual file system and handles remote workspaces.

### Writing Files (Planning/Building Mode)
When the AI creates or updates spec files, it does so through the language model's built-in tools (code actions, file edits). The extension does NOT need custom file write logic — Copilot Chat's built-in edit capabilities handle this.

If direct file writes are needed (e.g., for learnings), use `vscode.workspace.fs.writeFile()` with the same path validation logic as the sidecar.

### Opening Files for the User
When a response references a file, use VS Code's URI scheme and markdown links. Users click to open files in the editor:

```markdown
I've updated the spec: [app-spec.md](.prompts/plan/app-spec.md)
```

Or programmatically:
```typescript
stream.reference(vscode.Uri.joinPath(workspaceRoot, '.prompts/plan/app-spec.md'));
```

---

## Differences From Desktop App

| Aspect | Desktop App | VS Code Extension |
|--------|------------|-------------------|
| **Audience** | Non-professional developers | Professional developers |
| **UI** | Custom 3-column layout | VS Code native UI |
| **Chat** | Custom chat panel with memory | Copilot Chat panel |
| **Chat history** | Custom persistence in `.naide/chatsessions/` | Copilot Chat native history |
| **File viewing** | Custom tab system + markdown preview | VS Code editor tabs |
| **File browsing** | Custom left panel (Features + Files) | VS Code file explorer |
| **Running apps** | Custom iframe preview + proxy | VS Code terminal + debug |
| **AI backend** | Node.js sidecar + Copilot SDK | VS Code Language Model API |
| **Mode selection** | Dropdown in chat input area | Slash commands (`/plan`, `/build`, `/analyze`) |
| **Status events** | WebSocket + ActivityStatusBar | Progress notifications or output channel (if needed) |
| **Model selection** | Custom dropdown | VS Code handles model selection |
| **Settings** | Custom `naide-settings.json` | VS Code settings (`settings.json`) |

---

## Configuration (VS Code Settings)

The extension exposes configuration via VS Code's standard settings:

```json
{
  "naide.systemPromptsPath": ".prompts/system",
  "naide.specsPath": ".prompts/plan",
  "naide.featuresPath": ".prompts/features",
  "naide.learningsPath": ".prompts/learnings"
}
```

Defaults match the standard Naide project structure. Users can override if their project uses different paths.

---

## Progress & Status Reporting

Instead of the desktop app's WebSocket-based ActivityStatusBar, use VS Code's native progress APIs:

```typescript
stream.progress('Reading project specifications...');
stream.progress('Loading feature files...');
```

These appear as subtle progress indicators in the Copilot Chat panel.

---

## Error Handling

### No Workspace Open
```
Please open a workspace folder to use @naide.
```

### No `.prompts/` Directory
```
No Naide project structure found. Would you like me to initialize one?
Create `.prompts/system/`, `.prompts/plan/`, `.prompts/features/`, and `.prompts/learnings/` directories with starter files.
```

### Copilot Not Available
The extension declares `github.copilot-chat` as a dependency. If Copilot is not installed/active, VS Code handles the error (extension won't activate).

### System Prompt Files Missing
- Log a warning
- Continue with whatever prompts are available
- The base system prompt should be required; mode-specific prompts are optional

---

## Development & Building

### Setup
```bash
cd src/naide-vscode
npm install
```

### Development
```bash
# Open in VS Code, press F5 to launch Extension Development Host
code src/naide-vscode
```

### Building
```bash
cd src/naide-vscode
npm run compile        # TypeScript compilation
npx @vscode/vsce package   # Create .vsix file
```

### Testing
```bash
cd src/naide-vscode
npm test              # Run extension tests
```

### Linting
```bash
cd src/naide-vscode
npm run lint          # ESLint
```

---

## Acceptance Criteria

### Core Functionality
- [ ] Extension activates when `@naide` is typed in Copilot Chat
- [ ] `/plan` slash command activates Planning mode
- [ ] `/build` slash command activates Building mode
- [ ] `/analyze` slash command activates Analyzing mode
- [ ] No slash command defaults to Auto mode
- [ ] System prompts load from `.prompts/system/` in the workspace
- [ ] Spec files load from `.prompts/plan/`
- [ ] Feature files load from `.prompts/features/`
- [ ] `search_learnings` tool is registered and callable by the language model
- [ ] Responses stream back to the Copilot Chat panel as markdown
- [ ] File references in responses are clickable and open in VS Code editor

### Prompt Assembly
- [ ] Prompts assemble in correct order: base → mode → specs → features → learnings instructions
- [ ] Auto mode loads both planning and building prompts
- [ ] Missing prompt files are handled gracefully (warning, not error)

### Project Structure
- [ ] Extension lives in `src/naide-vscode/`
- [ ] TypeScript strict mode enabled
- [ ] ESLint configured
- [ ] Compiles without errors
- [ ] Package produces valid `.vsix`

### Error Handling
- [ ] No workspace → clear message
- [ ] No `.prompts/` → offer to initialize
- [ ] Missing system prompts → warning, continue with available prompts
- [ ] Copilot not available → extension doesn't activate (dependency check)

---

## Implementation Phases

### Phase 1: Scaffold & Basic Participant
- Create `src/naide-vscode/` project with `package.json`, `tsconfig.json`
- Register the `@naide` chat participant
- Implement basic handler that echoes the user's message
- Verify it works in Extension Development Host

### Phase 2: System Prompt & Spec Loading
- Implement `prompts.ts` to read `.prompts/system/`, `.prompts/plan/`, `.prompts/features/`
- Assemble prompts in correct order
- Pass as instructions to the language model
- Verify Naide responds with project-aware context

### Phase 3: Slash Commands & Modes
- Implement `/plan`, `/build`, `/analyze` slash commands
- Auto mode (no command) loads auto + both mode prompts
- Verify mode-specific behavior

### Phase 4: search_learnings Tool
- Implement and register the `naide_searchLearnings` language model tool
- Port the keyword scoring algorithm from the sidecar
- Verify the LM can call the tool and receive results

### Phase 5: Polish & Packaging
- Add extension icon
- Write README.md for the extension
- Configure `.vscodeignore`
- Test on Windows, macOS, Linux
- Package as `.vsix`

---

## Future Enhancements

### Project Initialization Command
- Command palette: `Naide: Initialize Project`
- Creates `.prompts/` directory structure with starter files
- Creates `.prompts/system/` with default system prompts

### Spec File Tree View
- Optional tree view in the activity bar showing `.prompts/features/` files
- Quick navigation to specs without using the file explorer

### Status Bar Integration
- Show current Naide mode in the VS Code status bar
- Click to change default mode

### Multi-Root Workspace Support
- Support multiple workspace folders with separate `.prompts/` directories
- Let the user choose which workspace context to use

### Custom Model Selection
- Allow users to configure preferred model via VS Code settings
- Pass model preference to language model API

---

## Related Features
- [2026-02-10-auto-mode.md](./2026-02-10-auto-mode.md) — Auto mode behavior (reused via system prompt)
- [2026-02-04-search-learnings-tool.md](./2026-02-04-search-learnings-tool.md) — search_learnings tool (reimplemented for VS Code)
- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) — Original Copilot SDK integration (desktop app)
- [2026-02-01-building-mode.md](./2026-02-01-building-mode.md) — Building mode behavior (reused via system prompt)

---

created by naide
