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

### Copilot API Request
```typescript
interface CopilotRequest {
  mode: 'Planning' | 'Building' | 'Analyzing';
  message: string;
  workspaceRoot: string;
  contextFiles?: string[];            // Optional context files
  conversationContext?: ConversationContext; // Conversation memory
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
   - `.naide/learnings/**` - Learnings from past interactions

#### Prompt Assembly Order
1. Base system prompt
2. Mode system prompt
3. Relevant learnings
4. Relevant spec + feature files
5. Conversation summary (mid-term)
6. Recent messages (short-term)
7. Current user message

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
