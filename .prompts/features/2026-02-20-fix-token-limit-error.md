---
Status: planned
Area: copilot, chat, performance
Created: 2026-02-20
LastUpdated: 2026-02-20
---

# Feature: Fix Token Limit Error — System Messages, Feature Search Service, and History Truncation
**Status**: 🟡 PLANNED

## Summary
Resolve the recurring "Message exceeds token limit" error by making three targeted changes to how Naide assembles prompts for the language model:

1. **Move instructions to a system message** — use `LanguageModelChatMessage.User` with a system-instruction role prefix instead of prepending instructions to the first user message.
2. **Create a feature search service** — replace loading *all* feature files into every request with an on-demand tool (like the learnings service) that the AI calls to retrieve only the features relevant to the current prompt.
3. **Truncate/summarize conversation history** — cap conversation history to a reasonable size; when exceeded, keep the last 2 user messages verbatim and summarize the rest.

---

## Goals
- Eliminate the "Message exceeds token limit" error
- Reduce per-request token usage significantly
- Keep prompt assembly predictable and bounded
- Maintain full context quality (the AI still gets what it needs)
- Follow existing patterns (learnings service) for consistency

---

## Non-Goals
- Implementing vector/semantic search for features (future enhancement)
- Changing the learnings service itself
- Modifying spec file loading (`.prompts/plan/`) — these are small and always relevant
- Cross-session memory or persistence changes

---

## Problem Statement

**Current situation** (in `participant.ts`):

1. System prompts, all spec files, and **all feature files** are concatenated into a single `instructions` string.
2. This `instructions` string is prepended to the **first user message** in the conversation, not sent as a separate system message.
3. The **full conversation history** (every prior turn) is included with no truncation.
4. As conversations grow and feature files accumulate, the total message payload exceeds the model's token limit.

**Result**: The VS Code language model API throws `"Message exceeds token limit"`, which surfaces as a generic error in chat.

**Evidence**: Multiple prior fix attempts exist in git history (`copilot/fix-message-token-limit-error`, `copilot/fix-token-limit-error`, etc.) — none have resolved the root cause.

---

## Change 1: Move Instructions to a System Message

### Current Behavior
Instructions (system prompt + specs + features) are prepended to the first user message:

```typescript
// Current: instructions crammed into user message
messages[0] = vscode.LanguageModelChatMessage.User(
  `${fullInstructions}\n\n---\n\n${firstMessageText}`
);
```

### New Behavior
Instructions are sent as a **dedicated system message** at the start of the messages array, separate from any user message.

```typescript
// New: instructions as a standalone system-level message
const systemMessage = vscode.LanguageModelChatMessage.User(
  `[SYSTEM INSTRUCTIONS]\n\n${systemPrompt}\n\n${specs}\n\n${workspaceContext}`
);
messages.unshift(systemMessage);
```

> **Note**: The VS Code `LanguageModelChatMessage` API does not expose a `System` role directly. The convention is to use a `User` message with a clear `[SYSTEM INSTRUCTIONS]` prefix as the first message. This keeps instructions cleanly separated from conversation content without duplicating them into user messages.

### Implementation Details

**File**: `src/naide-vscode/src/participant.ts`

1. Build the system instruction content from: system prompts + spec files + workspace context.
2. **Do NOT include feature file content** in this message (see Change 2).
3. Create a `User` message with a `[SYSTEM INSTRUCTIONS]` prefix and insert it as `messages[0]`.
4. Append conversation history messages after the system message.
5. Append the current user prompt as the final message — do NOT prepend instructions to it.

### What Changes
| Aspect | Before | After |
|--------|--------|-------|
| Instructions location | Prepended to first user message | Dedicated first message |
| Feature files | Included in instructions | Loaded on-demand via tool |
| First user message | Instructions + original prompt | Original prompt only |
| Current user message | Instructions + prompt (if no history) | Prompt only |

---

## Change 2: Feature Search Service (Tool)

### Overview
Create a `naide_searchFeatures` tool that works identically to the existing `naide_searchLearnings` tool. Instead of loading all feature files into every request, the AI calls this tool to retrieve only the features relevant to its current task.

### Current Behavior
`loadFeatureFiles()` in `prompts.ts` reads **every** `.md` file under `.prompts/features/` recursively and concatenates them all into the prompt. With 40+ feature files, this alone can consume thousands of tokens.

### New Behavior
- Feature files are **not** loaded automatically into the prompt.
- A `naide_searchFeatures` tool is registered (like `naide_searchLearnings`).
- The system prompt instructs the AI to call `naide_searchFeatures` with relevant keywords when it needs feature context.
- The tool returns only matching features, scored by relevance.

### Tool Definition

**Name**: `naide_searchFeatures`

**Description**: Search project feature specifications (`.prompts/features/`) for relevant context based on keywords. Returns matching feature specs that contain requirements, acceptance criteria, and implementation details.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "keywords": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Keywords to search for in feature files (e.g., ['chat', 'history', 'token'])"
    }
  },
  "required": ["keywords"]
}
```

**Output**: Formatted markdown text with matching feature file contents, ranked by relevance.

### Implementation Details

**New file**: `src/naide-vscode/src/features.ts`

Follow the exact pattern established by `learnings.ts`:

1. **`registerFeaturesTool(context)`** — Registers the `naide_searchFeatures` LM tool via `vscode.lm.registerTool()`.
2. **`searchFeatures(workspaceRoot, keywords)`** — Core search logic:
   - Read `.prompts/features/` directory recursively
   - Filter to `.md` files, exclude `removed-features/` and `bugs/` subdirectories
   - If no keywords provided, return list of available feature files
   - Normalize keywords and score each file:
     - Filename match: +3 per keyword
     - Content match: +1 per occurrence
   - Sort by score descending
   - Return top 5 matches with full content
   - Include a "CRITICAL" header instructing the AI to apply these specs

### Relevance Scoring
Match the algorithm used in `learnings.ts`:
```
score = (filename_keyword_matches * 3) + content_keyword_occurrences
```

### System Prompt Updates

**File**: `src/naide-vscode/src/prompts.ts`

Add feature tool instructions to `loadSystemPrompts()` (similar to the existing learnings tool instructions):

```
FEATURE SPECIFICATIONS INSTRUCTIONS:
You have access to the naide_searchFeatures tool to retrieve relevant feature specifications.

WHEN TO USE:
- At the START of each new task, search for relevant features using keywords from the user's request
- When working on a topic that may have an existing feature spec
- When you need to check acceptance criteria or implementation details for a feature

HOW TO USE:
- Call naide_searchFeatures with an array of keywords relevant to the current task
- Example: naide_searchFeatures({ keywords: ["chat", "history"] }) for chat history work
- Example: naide_searchFeatures({ keywords: ["token", "limit", "memory"] }) for token management

IMPORTANT:
- Feature specs contain requirements and acceptance criteria — always check before implementing
- If a relevant feature spec exists, follow its requirements
- If no features are found, proceed based on the user's request
```

### Participant Updates

**File**: `src/naide-vscode/src/participant.ts`

1. **Remove** the call to `loadFeatureFiles()` from prompt assembly.
2. **Remove** features from the `instructions` concatenation.
3. **Register** the `naide_searchFeatures` tool descriptor in the `allTools` array (same pattern as `naide_searchLearnings`).
4. **Add** direct invocation handling for `naide_searchFeatures` in the tool call loop (same pattern as the `naide_searchLearnings` handler).

### Extension Entry Point

**File**: `src/naide-vscode/src/extension.ts`

- Import and call `registerFeaturesTool(context)` during activation (same as `registerLearningsTool`).

### What Changes
| Aspect | Before | After |
|--------|--------|-------|
| Feature loading | All files, every request | On-demand via tool call |
| Token usage (40 features) | ~8,000–15,000 tokens | ~1,500–3,000 tokens (top 5 matches) |
| Relevance | All features, mostly irrelevant | Only matching features |
| AI behavior | Passive (features in context) | Active (AI searches when needed) |

---

## Change 3: Truncate/Summarize Conversation History

### Current Behavior
All prior conversation turns from `context.history` are included verbatim as messages. Long conversations accumulate unbounded history that pushes the total over the token limit.

### New Behavior
Apply a **history budget** measured in characters (as a proxy for tokens). When history exceeds the budget:

1. **Keep the last 2 user messages and their corresponding assistant responses verbatim** (4 messages total) — these provide immediate conversational context.
2. **Summarize** all earlier messages into a single concise summary message inserted before the recent messages.

### History Budget

- **Maximum history characters**: 12,000 (~3,000 tokens at ~4 chars/token)
- **Summary target**: ≤2,000 characters (~500 tokens)
- **Recent messages kept**: Last 2 user turns + their assistant responses (up to 4 messages)

### Summarization Approach

When the history exceeds the budget, generate a summary of the older messages. The summary is a structured, compact representation:

```
[CONVERSATION SUMMARY - Earlier messages summarized to save context space]

Topics discussed:
- <topic 1>
- <topic 2>

Key decisions made:
- <decision 1>
- <decision 2>

Important context:
- <relevant detail>
```

The summary is generated by extracting key information from the older messages:
1. Collect all user prompts and assistant responses that will be truncated.
2. Build a summary by:
   - Listing the user's requests/topics (first ~80 chars of each user message)
   - Noting key decisions from assistant responses (look for bullet points, headers, and conclusions)
   - Keeping total summary under 2,000 characters

### Implementation Details

**File**: `src/naide-vscode/src/participant.ts`

Add a new function:

```typescript
/**
 * Truncates conversation history to fit within token budget.
 * Keeps the last 2 user turns verbatim and summarizes earlier history.
 */
function truncateHistory(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): vscode.LanguageModelChatMessage[] {
  // 1. Convert all turns to messages (existing logic)
  // 2. Measure total character length
  // 3. If under budget (12,000 chars), return all messages as-is
  // 4. If over budget:
  //    a. Identify the last 2 user request turns and their paired responses
  //    b. Summarize all earlier turns into a single summary message
  //    c. Return: [summary message, ...recent messages]
}
```

```typescript
/**
 * Generates a compact summary of conversation messages.
 * Extracts topics, decisions, and key context.
 */
function summarizeOlderMessages(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>
): string {
  // Extract user topics (first ~80 chars of each user message)
  // Extract key points from assistant responses
  // Format as structured summary
  // Cap at 2,000 characters
}
```

**Integration point**: Replace the current history-building loop in `createHandler()` with a call to `truncateHistory()`.

### What Changes
| Aspect | Before | After |
|--------|--------|-------|
| History size | Unbounded | ≤12,000 chars (~3,000 tokens) |
| Long conversations | Token limit error | Graceful summarization |
| Recent context | All messages | Last 2 user turns verbatim |
| Older context | All messages verbatim | Compact summary |

---

## Combined Token Budget

After all three changes, the prompt assembly for a typical request:

| Component | Before (est.) | After (est.) |
|-----------|---------------|--------------|
| System prompts | ~2,000 tokens (in user msg) | ~2,000 tokens (system msg) |
| Spec files | ~1,000 tokens (in user msg) | ~1,000 tokens (system msg) |
| Feature files (40 files) | ~8,000 tokens (all loaded) | ~1,500 tokens (top 5 via tool) |
| Conversation history (20 turns) | ~6,000 tokens (unbounded) | ~3,000 tokens (capped) |
| Current user message | ~200 tokens | ~200 tokens |
| **Total** | **~17,200 tokens** | **~7,700 tokens** |

This keeps requests well within typical model limits (32K–128K tokens) even for large projects with long conversations.

---

## Implementation Plan

### Phase 1: System Message Separation
- [ ] Refactor prompt assembly in `participant.ts` to use a dedicated system instruction message
- [ ] Remove instruction prepending from user messages
- [ ] Verify model receives and follows system instructions correctly
- [ ] Test with first turn (no history) and subsequent turns (with history)

### Phase 2: Feature Search Service
- [ ] Create `src/naide-vscode/src/features.ts` following `learnings.ts` pattern
- [ ] Implement `registerFeaturesTool()` with `naide_searchFeatures` tool
- [ ] Implement `searchFeatures()` with keyword matching and relevance scoring
- [ ] Add feature tool instructions to system prompt in `prompts.ts`
- [ ] Register tool in `extension.ts` activation
- [ ] Add tool descriptor and direct invocation handler in `participant.ts`
- [ ] Remove `loadFeatureFiles()` call from prompt assembly
- [ ] Test: AI calls tool and receives relevant features

### Phase 3: History Truncation
- [ ] Implement `truncateHistory()` function in `participant.ts`
- [ ] Implement `summarizeOlderMessages()` helper
- [ ] Replace current history-building loop with `truncateHistory()` call
- [ ] Test with short conversations (under budget — no truncation)
- [ ] Test with long conversations (over budget — summary + recent messages)

### Phase 4: Integration Testing
- [ ] End-to-end test: long conversation with many feature files
- [ ] Verify no "Message exceeds token limit" error
- [ ] Verify AI still has adequate context for quality responses
- [ ] Verify feature search returns relevant results
- [ ] Verify conversation summary preserves key decisions

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/naide-vscode/src/participant.ts` | Refactor prompt assembly: system message, remove feature loading, add history truncation, add feature tool handler |
| `src/naide-vscode/src/features.ts` | **New file** — `registerFeaturesTool()` and `searchFeatures()` |
| `src/naide-vscode/src/prompts.ts` | Add feature tool instructions to system prompt; remove or deprecate `loadFeatureFiles()` |
| `src/naide-vscode/src/extension.ts` | Import and register feature search tool |

---

## Testing Strategy

### Unit Tests
1. **`searchFeatures()`** — keyword matching, scoring, top-N selection
2. **`truncateHistory()`** — under budget returns all, over budget summarizes
3. **`summarizeOlderMessages()`** — extracts topics and decisions, respects char limit

### Manual Tests
1. Start a new conversation — verify system instructions are applied
2. Have a 20+ turn conversation — verify no token limit error
3. Ask the AI about a specific feature — verify it calls `naide_searchFeatures`
4. Check logs — verify history truncation triggers and summary content

---

## Error Handling

### Feature Search Failures
- If `.prompts/features/` doesn't exist → return "No feature files found"
- If file read fails → skip that file, continue with others
- If no keywords match → return list of available feature files

### History Truncation Failures
- If summary generation fails → fall back to keeping only the last 4 messages (no summary)
- If character counting fails → fall back to keeping last 10 messages

---

## Acceptance Criteria

- [ ] Instructions are sent as a dedicated first message, not prepended to user messages
- [ ] Feature files are NOT loaded automatically into every request
- [ ] `naide_searchFeatures` tool is registered and callable by the AI
- [ ] AI receives relevant feature specs when it searches for them
- [ ] Conversation history is capped at ~12,000 characters
- [ ] Long conversations get summarized (older turns) + recent turns kept verbatim
- [ ] No "Message exceeds token limit" error in conversations of 20+ turns
- [ ] Total prompt size stays under ~8,000 tokens for typical requests
- [ ] All existing functionality continues to work (no regressions)
- [ ] System logs show history truncation events and feature search calls

---

## Related Features
- [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) — Memory architecture and prompt assembly order
- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) — Copilot SDK integration
- [2026-02-03-adaptive-learnings-index.md](./2026-02-03-adaptive-learnings-index.md) — Learnings service (pattern to follow)

---

created by naide
