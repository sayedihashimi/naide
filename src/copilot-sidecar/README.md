# Copilot Sidecar Service

This is a Node.js/TypeScript sidecar service that provides Copilot SDK integration for Naide.

## Purpose

The sidecar acts as a bridge between the Tauri app and GitHub Copilot CLI, providing:
- HTTP API for Copilot chat interactions
- System prompt loading from `.prompts/system/`
- Safe file operations (only allowed directories)
- Learnings management

## Prerequisites

- Node.js 18+ 
- GitHub Copilot CLI installed and authenticated
  - Install: Follow instructions at https://github.com/github/gh-copilot
  - Authenticate: Run `copilot` then `/login`

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The sidecar will start on `http://localhost:3001`.

## API Endpoints

### POST /api/copilot/chat

Request body:
```json
{
  "mode": "Planning" | "Building" | "Analyzing",
  "message": "User message",
  "workspaceRoot": "/path/to/workspace",
  "contextFiles": ["optional", "array", "of", "files"]
}
```

Response:
```json
{
  "replyText": "Assistant response",
  "actions": []
}
```

Error response:
```json
{
  "error": "Error message",
  "replyText": "User-friendly error message"
}
```

### GET /health

Health check endpoint.

Response:
```json
{
  "status": "ok",
  "copilotReady": true
}
```

## Mode Behavior

- **Planning**: Calls Copilot SDK, can update `.prompts/plan/**` and `.prompts/features/**`
- **Building**: Returns "Building coming soon" (stub)
- **Analyzing**: Returns "Analyzing coming soon" (stub)

## File Write Safety

The sidecar only allows writes to:
- `.prompts/plan/**`
- `.prompts/features/**`
- `.naide/learnings/**`

Any attempts to write outside these directories will be blocked.

## Learnings

Learnings are stored in `.naide/learnings/` as markdown files, grouped by category.

Each learning entry includes:
- Timestamp
- What happened
- Why it mattered
- What to do next time

## Development Notes

- The sidecar is designed to be simple and minimal
- Currently uses a placeholder for Copilot SDK integration
- Full SDK integration coming in future updates

## License

MIT License - see [LICENSE](../../LICENSE) for details.
