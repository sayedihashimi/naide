# Data Specification

## File System Structure

### Repository Root
```
/
├── .prompts/
│   ├── features/          # Feature specifications
│   │   ├── bugs/          # Bug reports
│   │   └── removed-features/  # Archived removed features
│   ├── plan/             # Planning documents
│   ├── system/           # System prompts
│   └── learnings/        # Project learnings
├── .naide/                # Per-project runtime state (gitignored)
│   ├── chatsessions/     # Chat history files
│   │   └── trash/        # Soft-deleted chats
│   └── project-config.json  # Project-local settings (tabs, app selection)
├── src/
│   ├── naide-desktop/    # Tauri React app
│   │   ├── src/          # React source code
│   │   └── src-tauri/    # Rust/Tauri backend
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

### ConversationSummary (Mid-Term Memory)
```typescript
interface ConversationSummary {
  decisions: string[];        // Key decisions made
  constraints: string[];      // Active constraints/requirements
  acceptedDefaults: string[]; // Defaults user accepted
  rejectedOptions: string[];  // Options user rejected
  openQuestions: string[];    // Outstanding questions
  updatedAt: string;          // ISO 8601 timestamp
}
```

### ConversationContext
```typescript
interface ConversationContext {
  summary: ConversationSummary | null;  // Mid-term memory
  recentMessages: ChatMessage[];         // Short-term memory (last 6-10)
  totalMessageCount: number;             // Total messages in session
}
```

### Tab
```typescript
interface Tab {
  id: string;                    // Unique ID (file path or 'generate-app')
  type: 'chat' | 'feature-file' | 'project-file';
  label: string;                 // Display name
  filePath?: string;             // For file tabs
  isPinned: boolean;             // Always true (temporary tabs removed)
  isTemporary: boolean;          // Always false (temporary tabs removed)
  hasUnsavedChanges?: boolean;   // Dot indicator on tab
}
```

### AppInfo (Rust)
```rust
struct AppInfo {
  app_type: String,       // "npm" or "dotnet"
  project_file: String,   // Relative path (e.g., "frontend" or "src/Api/Api.csproj")
  command: String,         // Run command (e.g., "npm run dev")
  display_name: String,    // Human-readable name
}
```

### StatusEvent (WebSocket)
```typescript
interface StatusEvent {
  id: string;
  type: 'file_read' | 'file_write' | 'analysis' | 'build' | 'test' | 'api_call';
  status: 'in_progress' | 'complete' | 'error';
  message: string;
  details?: string;
  timestamp: number;
}
```

### ProjectFileNode (Rust)
```rust
struct ProjectFileNode {
  name: String,                    // "src", "package.json"
  path: String,                    // Relative path from project root
  is_folder: bool,
  file_extension: Option<String>,  // "ts", "json", "md", etc.
}
```

### Copilot API Request
```typescript
interface CopilotRequest {
  mode: 'Auto' | 'Planning' | 'Building' | 'Analyzing';
  message: string;
  workspaceRoot: string;
  contextFiles?: string[];            // Optional context files
  conversationContext?: ConversationContext; // Conversation memory
}
```

### Copilot API Response (Streaming)
Streaming endpoint uses Server-Sent Events (SSE):
- `data: {"chunk": "partial text"}` — incremental content
- `data: {"done": true}` — stream complete

Non-streaming response:
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

### Conversation Memory Model

#### Three-Layer Memory Architecture
1. **Short-Term Memory**: Rolling buffer of last 6-10 messages
   - Stored in React state (not persisted to disk)
   - Sent verbatim with each request
   - Preserves conversational flow

2. **Mid-Term Memory**: Conversation summary
   - Stored in React state (not persisted to disk)
   - Updated incrementally from AI responses
   - Contains: decisions, constraints, defaults, rejections, open questions

3. **Long-Term Memory**: Repository files (authoritative)
   - `.prompts/plan/**` - Spec files
   - `.prompts/features/**` - Feature specs
   - `.prompts/learnings/**` - Learnings from past interactions (accessed via `search_learnings` tool)

#### Prompt Assembly Order
1. Base system prompt
2. Mode system prompt
3. Spec files from `.prompts/plan/`
4. Feature files from `.prompts/features/`
5. Conversation summary (mid-term)
6. Recent messages (short-term)
7. Current user message

Note: Learnings are no longer bulk-loaded. They are retrieved on-demand via the `search_learnings` Copilot SDK tool.

### Chat Sessions
- Stored in `<project-root>/.naide/chatsessions/`
- Active session: `chat-active.json`
- Archived sessions: `YYYY-MM-DD-chat-{timestamp}-{random}.json`
- Soft-deleted sessions: `.naide/chatsessions/trash/`
- Per-project chat history, loaded on app startup

### Tab State
- Stored in `<project-root>/.naide/project-config.json`
- Saved on tab changes (debounced 1s), project switch, and unmount
- Restored after project load

### App Selection
- Stored in `<project-root>/.naide/project-config.json`
- Persists which app to run when multiple detected
- Restored on project load

### Global Settings
- Location: OS-appropriate app data directory
  - Windows: `%AppData%/com.naide.desktop/naide-settings.json`
  - macOS: `~/Library/Application Support/com.naide.desktop/naide-settings.json`
  - Linux: `~/.config/com.naide.desktop/naide-settings.json`
- Contains: last used project, recent projects list (max 10)

### Learnings
- Markdown files in `.prompts/learnings/`
- Grouped by category (e.g., ui-and-layout.md, build-and-tooling.md)
- Each entry timestamped with context
- Retrieved via `search_learnings` tool with keyword matching

### Planning Documents
- Markdown files in `.prompts/plan/`
- Version controlled with the repository
- Updated by Copilot in Planning mode

### Log Files
- Location: `%temp%/com.naide.desktop/logs/naide-{timestamp}.log`
- Single file per app run, shared between Rust backend and Node.js sidecar
- Tauri passes path via `NAIDE_LOG_FILE` environment variable

## Security Constraints

### File Write Permissions (Planning Mode)
Sidecar can only write to:
- `.prompts/plan/**`
- `.prompts/features/**`
- `.prompts/learnings/**`

### File Write Permissions (Building Mode)
Additionally allowed:
- `src/**`
- `public/**`
- Application source code files

### Always Blocked
- `.env` and `.env.*`
- `.git/**`
- `node_modules/**`
- `package-lock.json` / `yarn.lock` (unless package.json changed)

### Frontend File Operations
- `read_project_file` and `write_project_file` Tauri commands use path canonicalization
- `starts_with` checks ensure operations stay within project directory boundaries
