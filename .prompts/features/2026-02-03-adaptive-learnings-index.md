---
Status: planned
Area: copilot, learnings, performance
Created: 2026-02-03
LastUpdated: 2026-02-03
---

# Feature: Adaptive Learnings Index System
**Status**: 🟡 PLANNED

## Summary
Implement an adaptive system for loading and filtering learnings that automatically adjusts its behavior based on the number of learnings in a user's project. Small projects load all learnings directly, while larger projects use an auto-generated index for intelligent filtering.

---

## Goals
- Automatically adapt to projects with varying numbers of learnings (1 to 100+)
- Maintain optimal performance as learnings accumulate
- Provide intelligent relevance filtering for large learning sets
- Keep the system transparent and predictable
- Minimize token usage for large projects

---

## Non-Goals
- Manual index creation or maintenance (must be automatic)
- Vector embeddings or semantic search (too complex for MVP)
- Cross-project learning sharing (future enhancement)
- Learning versioning or history tracking

---

## Problem Statement

**Current Situation:**
Naide loads ALL learning files on every Copilot request. This works perfectly for the Naide repo itself (2-5 learnings) and small user projects (<10 learnings).

**The Challenge:**
User projects may accumulate 20, 50, or 100+ learnings over months of use. Loading all learnings becomes:
- **Inefficient**: Most learnings irrelevant to current request
- **Expensive**: Wasting tokens on unrelated context
- **Slow**: Reading and parsing many files on every request

**The Solution:**
A progressive enhancement system that automatically switches strategies based on learning count:
- **0-10 learnings**: Load all (current behavior)
- **11-30 learnings**: Use index for filtering
- **31+ learnings**: Advanced filtering with topic-based selection

---

## Core Behavior

### Automatic Strategy Selection

When sidecar processes a Copilot request:

1. **Count learnings** in `.prompts/learnings/`
2. **Choose strategy**:
   - ≤10 files → **Load All** (no index needed)
   - 11-30 files → **Index Filter** (load relevant subset)
   - 31+ files → **Topic Filter** (load by topic match)
3. **Execute strategy** and include filtered learnings in prompt

### Strategy 1: Load All (0-10 learnings)

**Behavior:**
- Read all `.md` files from `.prompts/learnings/`
- Include full content in prompt
- No filtering or processing

**When:**
- Learning count ≤ 10
- Total learning tokens < 5,000

**Why:**
- Simple, reliable, low overhead
- Covers Naide itself and most small projects
- No risk of missing relevant context

---

### Strategy 2: Index Filter (11-30 learnings)

**Trigger:**
- 11-30 learning files
- OR total tokens > 5,000 but < 15,000

**Index Structure:**
Auto-generated `learnings-index.json`:
```json
{
  "version": 1,
  "generated": "2026-02-03T17:35:00Z",
  "learningCount": 15,
  "learnings": [
    {
      "file": "ui-components.md",
      "topics": ["react", "components", "styling"],
      "keywords": ["button", "modal", "form", "tailwind"],
      "summary": "UI component patterns and styling conventions",
      "tokenCount": 450
    },
    {
      "file": "api-integration.md",
      "topics": ["api", "http", "fetch", "error-handling"],
      "keywords": ["api", "fetch", "axios", "timeout", "retry"],
      "summary": "API call patterns and error handling strategies",
      "tokenCount": 380
    }
  ]
}
```

**Index Generation:**
- Triggered when learning count crosses threshold (10 → 11)
- Regenerated when learnings are added/modified
- Stored in `.prompts/learnings/learnings-index.json`
- Excluded from prompt (metadata only)

**Filtering Process:**
1. Parse user message and conversation context
2. Extract key terms (nouns, verbs, technical terms)
3. Match against `keywords` and `topics` in index
4. Rank learnings by relevance score
5. Load top 5-7 most relevant learnings
6. Include in prompt

**Relevance Scoring:**
```
score = (keyword_matches * 2) + (topic_matches * 3)
```

---

### Strategy 3: Topic Filter (31+ learnings)

**Trigger:**
- 31+ learning files
- OR total tokens > 15,000

**Enhanced Index:**
Same structure as Strategy 2, plus:
```json
{
  "topics": {
    "ui": ["ui-components.md", "styling-patterns.md", "forms.md"],
    "api": ["api-integration.md", "graphql-queries.md"],
    "build": ["build-errors.md", "ci-cd-learnings.md"]
  },
  "categories": {
    "frontend": ["ui", "routing"],
    "backend": ["api", "database"],
    "infra": ["build", "deploy"]
  }
}
```

**Filtering Process:**
1. Determine request category from mode and message
   - Planning mode + "UI" → frontend topics
   - Building mode + "API" → backend topics
2. Load only learnings from relevant topics
3. Apply keyword filtering within selected topics
4. Load top 5-7 learnings

**Example:**
- User: "Add a dark mode toggle"
- Category: frontend
- Topics: ["ui", "styling"]
- Load: ui-components.md, styling-patterns.md, theme-switching.md
- Skip: All api, build, database learnings

---

## Index Generation

### When to Generate/Update

**Auto-generate when:**
- Learning count crosses threshold (10→11 or 30→31)
- New learning file is created
- Existing learning file is modified
- Manual regeneration requested (future: CLI command)

**Index File Location:**
```
.prompts/learnings/learnings-index.json
```

**Generation Process:**

1. **Read all learning files**
2. **Extract metadata**:
   - Count tokens (approximate)
   - Extract keywords (frequency analysis)
   - Identify topics (from headers, key terms)
   - Generate summary (first 2-3 sentences)
3. **Build index structure**
4. **Write to JSON file**
5. **Log generation**: "Generated learnings index (15 files, 6,234 tokens)"

### Keyword Extraction Algorithm

```typescript
function extractKeywords(content: string): string[] {
  // 1. Strip markdown formatting
  // 2. Tokenize into words
  // 3. Remove stop words (the, and, or, etc.)
  // 4. Count frequency
  // 5. Return top 10-15 unique terms
}
```

### Topic Identification

```typescript
function identifyTopics(content: string, filename: string): string[] {
  const topics: string[] = [];
  
  // 1. Check filename (ui-components.md → "ui", "components")
  // 2. Check top-level headers (## API Integration → "api")
  // 3. Check keyword clusters (many "react" mentions → "react")
  
  return topics;
}
```

---

## Implementation Plan

### Phase 1: Index Generation ✅
- [ ] Create index generator function
- [ ] Implement keyword extraction
- [ ] Implement topic identification
- [ ] Add token counting
- [ ] Write index to JSON file
- [ ] Add regeneration triggers

### Phase 2: Load All Strategy (Baseline) ✅
- [ ] Implement learning counter
- [ ] Keep existing load-all behavior for ≤10 files
- [ ] Add logging for strategy selection

### Phase 3: Index Filter Strategy ✅
- [ ] Implement relevance scoring
- [ ] Add keyword matching logic
- [ ] Filter and load top N learnings
- [ ] Test with 15-20 learning files

### Phase 4: Topic Filter Strategy ✅
- [ ] Implement category detection
- [ ] Add topic grouping to index
- [ ] Filter by category + relevance
- [ ] Test with 35+ learning files

### Phase 5: Performance & Polish ✅
- [ ] Add caching for index reads
- [ ] Optimize file I/O
- [ ] Add performance metrics logging
- [ ] Add admin/debug commands (optional)

---

## Technical Details

### File Structure

```
.prompts/learnings/
├── learnings-index.json          # Auto-generated (gitignored)
├── ui-components.md
├── api-integration.md
├── build-errors.md
└── ... (user's learning files)
```

### Index Schema

```typescript
interface LearningsIndex {
  version: number;                 // Schema version (start at 1)
  generated: string;               // ISO timestamp
  learningCount: number;           // Total files indexed
  totalTokens: number;             // Approximate total
  learnings: LearningMetadata[];
  topics?: Record<string, string[]>; // Topic groupings (Strategy 3)
}

interface LearningMetadata {
  file: string;                    // Filename (relative)
  topics: string[];                // Identified topics
  keywords: string[];              // Top keywords
  summary: string;                 // Brief description
  tokenCount: number;              // Approximate tokens
  lastModified: string;            // ISO timestamp
}
```

### Sidecar Integration

**Current code location**: `src/copilot-sidecar/src/index.ts` (lines 531-547)

**New function**: `loadRelevantLearnings(userMessage, mode, workspaceRoot)`

```typescript
async function loadRelevantLearnings(
  userMessage: string,
  mode: string,
  workspaceRoot: string
): Promise<string> {
  const learningsDir = path.join(workspaceRoot, '.prompts', 'learnings');
  const learningFiles = await fs.readdir(learningsDir).filter(f => f.endsWith('.md'));
  const count = learningFiles.length;
  
  // Strategy selection
  if (count <= 10) {
    return await loadAllLearnings(learningsDir);
  } else if (count <= 30) {
    return await loadFilteredLearnings(learningsDir, userMessage, mode);
  } else {
    return await loadTopicFilteredLearnings(learningsDir, userMessage, mode);
  }
}
```

### Index Regeneration Triggers

**Watch for changes:**
- File creation: `fs.watch()` on `.prompts/learnings/`
- File modification: Check timestamps
- Threshold crossing: After loading learnings

**Regeneration logic:**
```typescript
async function maybeRegenerateIndex(learningsDir: string) {
  const indexPath = path.join(learningsDir, 'learnings-index.json');
  const learningFiles = await fs.readdir(learningsDir);
  
  // Check if regeneration needed
  if (!await fs.exists(indexPath)) {
    return await generateIndex(learningsDir);
  }
  
  const index = await readIndex(indexPath);
  const currentCount = learningFiles.filter(f => f.endsWith('.md')).length;
  
  if (currentCount !== index.learningCount) {
    return await generateIndex(learningsDir);
  }
  
  // Check if files modified since index generation
  // ... (compare timestamps)
}
```

---

## Performance Considerations

### Token Savings

**Example project with 40 learnings:**

| Strategy | Learnings Loaded | Tokens | Savings |
|----------|------------------|--------|---------|
| Load All | 40 files | 18,000 | 0% |
| Topic Filter | 7 files | 3,150 | 82% |

**Typical request:**
- User message: 150 tokens
- Specs/features: 2,000 tokens
- Learnings (filtered): 3,000 tokens
- **Total savings**: ~15,000 tokens per request

### File I/O Optimization

- Cache index in memory for request duration
- Only regenerate when files actually change
- Use async file operations
- Batch file reads where possible

### Fallback Behavior

If index generation fails:
- Log error
- Fall back to Load All strategy
- Continue request processing
- Retry index generation on next request

---

## User-Facing Behavior

### Transparent Operation

Users should NOT need to know about the index system:
- No UI changes
- No configuration required
- No manual maintenance
- Works automatically

### Optional Visibility

**Future enhancement**: Admin/debug commands
```bash
# View index stats
naide learnings:index

# Force regeneration
naide learnings:reindex

# Show which learnings would be loaded for a query
naide learnings:test "add dark mode"
```

---

## Error Handling

### Index Generation Failures

**If keyword extraction fails:**
- Use empty keywords array
- Continue with filename-based topics

**If file read fails:**
- Skip that learning in index
- Log warning
- Continue with remaining files

**If entire generation fails:**
- Log error
- Delete partial index file
- Fall back to Load All strategy

### Filtering Failures

**If relevance scoring fails:**
- Load first N learnings alphabetically
- Log warning
- Continue request

**If no learnings match:**
- Load top 3 learnings by recency
- Ensures some context is always included

---

## Testing Strategy

### Unit Tests

1. **Index generation**:
   - Extract keywords from sample text
   - Identify topics from content
   - Generate valid JSON structure

2. **Relevance scoring**:
   - Keyword matching
   - Topic matching
   - Combined scoring

3. **Strategy selection**:
   - Correct strategy for different counts
   - Threshold boundary cases (10, 11, 30, 31)

### Integration Tests

1. **Create test project** with varying learning counts:
   - 5 learnings → verify Load All
   - 15 learnings → verify Index Filter
   - 35 learnings → verify Topic Filter

2. **Index regeneration**:
   - Add file → index updates
   - Modify file → index updates
   - Cross threshold → index regenerates

3. **End-to-end**:
   - Submit request
   - Verify correct learnings loaded
   - Verify prompt contains relevant context

### Performance Tests

- Measure time to generate index (target <500ms for 50 files)
- Measure time to filter learnings (target <100ms)
- Verify token reduction (target 70%+ savings for 40+ learnings)

---

## Migration Path

### Existing Projects

**On first request after update:**
1. Count learnings
2. If count > 10, generate index automatically
3. Log: "Generated learnings index for faster loading"
4. Continue with request

**No user action required**

### Rollback Safety

If index system causes issues:
- Delete `learnings-index.json`
- Falls back to Load All strategy
- System continues working normally

---

## Acceptance Criteria

- [ ] System automatically counts learnings on each request
- [ ] Load All strategy works for ≤10 learnings
- [ ] Index generates automatically when needed
- [ ] Index Filter strategy reduces token usage for 11-30 learnings
- [ ] Topic Filter strategy reduces token usage for 31+ learnings
- [ ] Index regenerates when learnings change
- [ ] No user-facing changes (transparent operation)
- [ ] System logs strategy selection and index generation
- [ ] Graceful fallback if index generation fails
- [ ] Performance: index generation <500ms for 50 files
- [ ] Performance: filtering <100ms per request
- [ ] Token savings: 70%+ reduction for 40+ learnings

---

## Future Enhancements

### Phase 2: Semantic Search
- Use embeddings for better relevance matching
- Requires external service or local model
- Higher accuracy but more complexity

### Phase 3: Learning Analytics
- Track which learnings are most used
- Identify redundant or outdated learnings
- Suggest learning consolidation

### Phase 4: Cross-Project Learning
- Share learnings across projects (opt-in)
- Organization-wide learning repositories
- Privacy-preserving aggregation

---

## Related Features
- [2026-02-01-add-copilot-integration.md](./2026-02-01-add-copilot-integration.md) - Copilot SDK integration
- [2026-02-01-conversation-memory.md](./2026-02-01-conversation-memory.md) - Memory architecture

---

created by naide
