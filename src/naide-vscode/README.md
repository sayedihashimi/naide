# Naide VS Code Extension

A spec-driven AI development assistant that integrates with GitHub Copilot Chat. Naide helps professional developers plan and build applications with full project context from specifications, features, and past learnings.

## Features

- **Chat Participant**: Type `@naide` in the Copilot Chat panel to interact
- **Conversation Context**: Maintains full conversation history within a chat session
- **File Operations**: Can create and edit files in your workspace using language model tools
- **Multiple Modes**: 
  - `/plan` — Create or update specifications without modifying code (default)
  - `/build` — Implement code changes based on specifications
- **Project Context**: Automatically loads:
  - System prompts (bundled with extension)
  - Specifications from `.prompts/plan/` (in your workspace)
  - Feature files from `.prompts/features/` (in your workspace)
- **Learning Search**: Uses the `search_learnings` tool to retrieve relevant learnings from past interactions

## Requirements

- VS Code 1.99.0 or later
- GitHub Copilot extension (with active subscription)
- A Naide project structure (see below)

## Getting Started

### 1. Install the Extension

Install the extension from the VS Code Marketplace or from a `.vsix` file:

```bash
code --install-extension naide-0.1.0.vsix
```

### 2. Open a Naide Project

Open a workspace folder that contains a `.prompts/` directory with the following structure:

```
your-project/
├── .prompts/
│   ├── plan/            # Project specifications (intent.md, app-spec.md, etc.)
│   ├── features/        # Feature specifications
│   └── learnings/       # Project learnings from past interactions
└── ... (your code)
```

**Note**: System prompts are bundled with the extension - you don't need to copy them to your workspace.

If you don't have this structure, you can initialize it manually or ask `@naide` to help set it up.

### 3. Start Chatting

Open the Copilot Chat panel (Ctrl+Shift+I or Cmd+Shift+I) and type:

```
@naide add a login page with email/password
```

Or use slash commands for specific modes:

```
@naide /plan design an authentication system
@naide /build implement the dark mode toggle from the spec
```

## Extension Settings

This extension contributes the following settings:

- `naide.specsPath`: Path to specifications directory (default: `.prompts/plan`)
- `naide.featuresPath`: Path to features directory (default: `.prompts/features`)
- `naide.learningsPath`: Path to learnings directory (default: `.prompts/learnings`)

**Note**: System prompts are bundled with the extension and cannot be customized via settings.

## How It Works

### Modes

**Planning Mode** (`/plan`)
- Creates or updates specifications only
- Does not modify code
- Use when you want to think through a feature before implementing
- Default mode when no slash command is specified

**Building Mode** (`/build`)
- Implements code changes based on specifications
- Updates specs as needed
- Use when you're ready to implement

### Project Context

When you invoke `@naide`, it automatically loads:

1. **System Prompts**: Instructions that guide the AI's behavior
   - `base.system.md` — Core instructions (always loaded)
   - Mode-specific prompts — Based on the selected mode
   
2. **Project Specifications**: Your project's plan and structure
   - `intent.md` — Project goals and vision
   - `app-spec.md` — Application architecture
   - `data-spec.md` — Data models and schemas
   - `rules.md` — Project conventions and rules
   - `tasks.json` — Task tracking

3. **Feature Specifications**: Detailed feature documentation
   - All `.md` files from `.prompts/features/`
   - Excludes `removed-features/` and `bugs/` directories

### Learning Search Tool

The extension registers a `naide_searchLearnings` tool that the language model can call during a conversation. This tool:

- Searches `.prompts/learnings/` for relevant content
- Scores matches by keyword relevance
- Returns the top 5 most relevant learnings
- Helps avoid repeating past mistakes

The AI automatically uses this tool when appropriate, but you can also prompt it:

```
@naide search learnings about React testing
```

## Differences from Desktop App

The VS Code extension is designed for **professional developers** and uses VS Code's native features:

| Aspect | Desktop App | VS Code Extension |
|--------|-------------|-------------------|
| **UI** | Custom 3-column layout | VS Code native UI |
| **Chat** | Custom chat panel | Copilot Chat panel |
| **File viewing** | Custom tabs | VS Code editor tabs |
| **File browsing** | Custom panel | VS Code file explorer |
| **Running apps** | Custom preview | VS Code terminal + debug |
| **Mode selection** | Dropdown | Slash commands |

## Development

### Setup

```bash
cd src/naide-vscode
npm install
```

### Building

```bash
npm run compile
```

### Testing

Open the extension in VS Code and press F5 to launch the Extension Development Host.

### Packaging

```bash
npm run package
```

This creates a `.vsix` file that can be installed in VS Code.

## Troubleshooting

### No language model available

Make sure GitHub Copilot is installed and active:
1. Install the GitHub Copilot extension
2. Sign in with your GitHub account
3. Ensure you have an active Copilot subscription

### No workspace open

Naide requires a workspace folder to function. Open a folder in VS Code before using `@naide`.

### No `.prompts/` directory

If your project doesn't have a `.prompts/` directory, you can:
1. Create it manually with the structure shown above
2. Ask `@naide` to initialize the structure for you

### System prompts not found

Make sure your `.prompts/system/` directory contains at least `base.system.md`. You can copy these from the Naide repository or create your own.

## Related Projects

- [Naide Desktop App](https://github.com/sayedihashimi/naide) — Desktop application for non-professional developers
- [Naide Specification](https://github.com/sayedihashimi/naide/tree/main/.prompts) — System prompts and documentation

## License

See the main Naide repository for license information.

---

created by naide
