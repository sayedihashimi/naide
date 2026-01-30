# Data Specification

## File System Structure

### Repository Root
```
/
├── .prompts/
│   ├── features/          # Feature specifications
│   ├── plan/             # Planning documents
│   ├── system/           # System prompts
│   └── ...
├── .naide/
│   └── learnings/        # Project memory/learnings
├── src/
│   ├── naide-desktop/    # Tauri React app
│   └── copilot-sidecar/  # Node.js sidecar service
└── ...
```

## Data Models

### ChatMessage
```typescript
interface ChatMessage {
  id: string;              // Unique identifier
  role: 'user' | 'assistant';
  content: string;         // Message text
  timestamp: string;       // ISO 8601 timestamp
}
```

### Copilot API Request
```typescript
interface CopilotRequest {
  mode: 'Planning' | 'Building' | 'Analyzing';
  message: string;
  workspaceRoot: string;
  contextFiles?: string[];  // Optional context files
}
```

### Copilot API Response
```typescript
interface CopilotResponse {
  replyText: string;
  actions?: Array<{
    type: string;
    path: string;
    content: string;
  }>;
  error?: string;
}
```

## Persistent Storage

### Chat Sessions
- Stored using Tauri's file system plugin
- Per-project chat history
- Loaded on app startup

### Learnings
- Markdown files in `.naide/learnings/`
- Grouped by category (e.g., ui-and-layout.md, build-and-tooling.md)
- Each entry timestamped with context

### Planning Documents
- Markdown files in `.prompts/plan/`
- Version controlled with the repository
- Updated by Copilot in Planning mode

## Security Constraints

### File Write Permissions
Sidecar can only write to:
- `.prompts/plan/**`
- `.prompts/features/**`
- `.naide/learnings/**`

All other paths are blocked for safety.
