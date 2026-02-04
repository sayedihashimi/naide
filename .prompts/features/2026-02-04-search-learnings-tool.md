---
Status: implemented
Area: copilot, learnings, tools
Created: 2026-02-04
LastUpdated: 2026-02-04
---

# Feature: Search Learnings Tool
**Status**: ✅ IMPLEMENTED

## Summary
Replace bulk loading of all learnings with a custom Copilot SDK tool that allows Copilot to search for relevant learnings based on keywords. This enables on-demand, contextual retrieval of learnings rather than always including every learning in the system prompt.

---

## Goals
- Reduce token usage by loading only relevant learnings
- Allow Copilot to proactively search for context when needed
- Scale to many learnings without bloating the system prompt
- Maintain relevance by letting Copilot extract keywords from the current task

---

## Non-Goals
- Semantic/vector search (using simple keyword matching)
- User-facing UI for searching learnings
- Automatic learning creation (separate feature)

---

## Problem Statement

**Previous Behavior:**
The sidecar loaded ALL learning files from `.prompts/learnings/` and included them in the system prompt for every request. This wasted tokens on irrelevant learnings and wouldn't scale.

**New Behavior:**
Copilot calls the `search_learnings` tool with keywords relevant to the current task and receives only matching learnings.

---

## Implementation

### Custom Tool Registration

Using the Copilot SDK's `defineTool` API:

```typescript
import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';

const learningsTool = defineTool('search_learnings', {
  description: 'Search project learnings for relevant context based on keywords...',
  parameters: z.object({
    keywords: z.array(z.string()).describe('Keywords to search for...')
  }),
  handler: async ({ keywords }) => {
    return searchLearnings(workspaceRoot, keywords);
  }
});
```

### Keyword Matching Algorithm

The `searchLearnings` function:

1. Normalizes keywords to lowercase
2. Searches each learning file for matches
3. Scores matches by:
   - Filename match: +3 points per keyword
   - Content occurrence: +1 point per occurrence
4. Returns top 5 matches sorted by score

### System Prompt Instructions

Added instructions telling Copilot when and how to use the tool:

```markdown
PROJECT LEARNINGS INSTRUCTIONS:
You have access to the search_learnings tool to retrieve relevant learnings.

WHEN TO USE:
- At the START of each new task
- When working on a topic where past decisions may be relevant
- When you need to recall previous constraints or corrections

HOW TO USE:
- Call search_learnings with keywords from the user's request
- Example: search_learnings({ keywords: ["react", "testing"] })
```

---

## Technical Details

### Files Changed

- `src/copilot-sidecar/src/index.ts`:
  - Added `zod` import
  - Added `defineTool` import from Copilot SDK
  - Replaced `loadLearnings()` with `searchLearnings()`
  - Added `createLearningsTool()` factory function
  - Updated both streaming and non-streaming session creation to include the tool
  - Added learnings tool instructions to system prompt

### Dependencies Added

- `zod`: Required for type-safe tool parameter definitions

### Session Configuration

The tool is registered when creating Copilot sessions:

```typescript
const session = await copilotClient.createSession({
  model: 'gpt-4o',
  workingDirectory: workspace,
  systemMessage: { content: fullSystemPrompt },
  tools: [createLearningsTool(workspace)],
  // ... hooks
});
```

---

## Request Flow

```
User: "Help me set up React testing"
    ↓
Copilot reads system prompt instructions
    ↓
Copilot calls: search_learnings({ keywords: ["react", "testing"] })
    ↓
Tool handler searches .prompts/learnings/
    ↓
Returns: Matching learnings with relevance scores
    ↓
Copilot uses relevant learnings in response
```

---

## Tool Response Format

### When matches found:
```
Found 3 relevant learning(s) for keywords: react, testing

**CRITICAL: Apply these learnings to avoid repeating past mistakes.**

### testing-patterns.md
[content...]

### react-components.md
[content...]
```

### When no matches:
```
No learnings found matching keywords: obscure, topic

Available learning files:
- testing-patterns.md
- react-components.md
- api-conventions.md
```

### When no learnings exist:
```
No learnings found. This is a new project with no recorded learnings yet.
```

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Token usage | All learnings every request | Only relevant learnings |
| Scalability | Degrades with many learnings | Stays constant |
| Relevance | May include unrelated context | Keywords target current task |
| Control | None - automatic inclusion | Copilot decides when to search |

---

## Acceptance Criteria

- [x] Bulk learnings loading removed from system prompt
- [x] search_learnings tool registered with Copilot sessions
- [x] Tool searches by keywords with relevance scoring
- [x] System prompt instructs Copilot to use the tool
- [x] Works in both streaming and non-streaming endpoints
- [x] TypeScript compiles without errors

---

## Related Features

- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) - Copilot SDK integration
- [2026-02-03-adaptive-learnings-index.md](./2026-02-03-adaptive-learnings-index.md) - Alternative approach (planned)

---

<!-- created by naide -->
