---
Status: in-progress
Area: copilot, planning
Created: 2026-02-01
LastUpdated: 2026-02-01
---

# Feature: Building Mode Implementation
**Status**: 🔵 IN PROGRESS

## Summary
Implement Building mode in the chat interface to enable AI-assisted code implementation and maintenance. Building mode updates both application code and specification files, keeping them synchronized. This transforms Naide from a planning-only tool into a full-cycle development assistant.

---

## Goals
- Enable code generation and modification based on specs
- Maintain automatic synchronization between code and specs
- Verify changes with builds and tests
- Support iterative development with immediate feedback
- Preserve the safety-first philosophy for non-pro developers

---

## Non-Goals
- Full IDE replacement (remain focused on AI-assisted workflows)
- Manual code editing interface (users should communicate intent via chat)
- Advanced debugging tools (basic error reporting is sufficient)
- Multi-file refactoring without user confirmation

---

## Problem Statement
Currently, Naide can help users plan and specify applications in Planning mode, but cannot implement them. Users must either:
1. Switch to another tool to write code manually, or
2. Copy AI suggestions and paste them elsewhere

This breaks the workflow and defeats the purpose of an integrated AI assistant for non-pro developers.

Building mode bridges this gap by allowing the AI to implement what was planned.

---

## Core Behavior

### When Building Mode is Active
1. **AI can modify**:
   - Application source code under `src/`
   - Test files
   - Configuration files (with restrictions)
   - UI components and assets

2. **AI must also update**:
   - `.prompts/plan/app-spec.md` when app behavior changes
   - `.prompts/plan/data-spec.md` when data models change
   - `.prompts/features/<feature>.md` when features are added/modified
   - `.prompts/plan/rules.md` when new conventions are established

3. **AI must verify**:
   - Code builds successfully
   - Existing tests pass (or document expected breakages)
   - New functionality matches spec

### Safety Guardrails
**Protected Files** (read-only even in Building mode):
- `.env` and `.env.*` (credentials)
- `package-lock.json` / `yarn.lock` (unless `package.json` changed)
- `.git/**` (version control)
- `node_modules/**` (dependencies)

**User Confirmation Required For**:
- Deleting files
- Modifying build configuration (`vite.config.ts`, `tauri.conf.json`, `Cargo.toml`)
- Installing new dependencies
- Major refactoring (>5 files changed)

**Automatic Actions Allowed**:
- Creating new files
- Modifying existing source files
- Updating spec files
- Running builds/tests for verification

---

## Workflow

### Standard Building Flow
```
User: "Add a dark mode toggle to the settings page"

AI:
1. Read current specs and code
2. Plan the implementation approach
3. Create/modify necessary files:
   - src/components/DarkModeToggle.tsx
   - src/styles/themes.css
   - Update src/pages/Settings.tsx
4. Update specs:
   - .prompts/features/dark-mode.md
   - .prompts/plan/app-spec.md
5. Verify:
   - Run build
   - Run tests
6. Report:
   - What was implemented
   - What specs were updated
   - Build/test results
```

### Error Recovery Flow
```
If build/test fails:
1. AI analyzes error output
2. AI attempts fix (up to 2 retries)
3. If still failing:
   - Revert changes (optional)
   - Write learning to .prompts/learnings/
   - Report failure to user with diagnosis
   - Ask for guidance
```

### Iterative Development Flow
```
User: "The button is too small"

AI:
1. Locate button component
2. Adjust styling
3. Verify build
4. Update relevant feature spec
5. Report change
```

---

## System Prompt Requirements

### Building Mode System Prompt
Located at: `.prompts/system/building.system.md` (already exists)

Key instructions:
- Read specs before coding
- Update specs after coding
- Verify builds/tests after changes
- Explain both code AND spec changes
- Write learnings on errors/corrections
- Follow existing code style and conventions
- Ask before major changes

### Context Assembly Order
1. Base system prompt
2. **Building mode system prompt** ← activated in this mode
3. Learnings from `.prompts/learnings/**`
4. Specs from `.prompts/plan/**`
5. Feature files from `.prompts/features/**`
6. Conversation summary
7. Recent messages
8. Current user message

---

## API Changes

### Sidecar Endpoint
**Endpoint**: `POST /api/copilot/chat`

**Request Body**:
```typescript
{
  mode: "building",  // ← changed from "planning"
  message: string,
  workspaceRoot: string,
  conversationSummary?: ConversationSummary,
  recentMessages: Message[]
}
```

**Response Body**:
```typescript
{
  replyText: string,
  actions?: {
    filesCreated: string[],
    filesModified: string[],
    filesDeleted: string[],
    specsUpdated: string[],
    buildResult?: { success: boolean, output: string },
    testResult?: { success: boolean, output: string }
  },
  conversationSummary?: ConversationSummary
}
```

### Frontend Changes
- Enable Building mode in dropdown (remove "Coming soon" label)
- Show file operations in chat (expandable details)
- Display build/test results inline
- Add "Revert last change" option if build fails

---

## File Operation Strategy

### Implementation Approach
The sidecar must bridge Copilot SDK capabilities with Naide's file system needs.

**Option A: Direct File Writing** (Recommended for MVP)
- Sidecar receives file paths and content from Copilot response
- Sidecar validates paths (allowlist check)
- Sidecar writes files directly
- Returns list of changes to frontend

**Option B: Patch/Diff Based**
- Sidecar returns diffs/patches
- Frontend applies them with user review
- More control but more complex

Recommendation: Start with Option A for speed, add Option B later if needed.

### Path Validation Rules
```typescript
// Allowed paths
const ALLOWED_WRITE_PATHS = [
  'src/**',
  'public/**',
  '.prompts/plan/**',
  '.prompts/features/**',
  '.prompts/learnings/**'
];

// Blocked paths (even with wildcard match)
const BLOCKED_PATHS = [
  '.env',
  '.env.*',
  'node_modules/**',
  '.git/**',
  'package-lock.json',
  'yarn.lock'
];
```

---

## Verification Strategy

### Build Verification
After code changes:
```typescript
const buildCommand = detectBuildCommand(workspaceRoot);
// e.g., "npm run build", "cargo build", etc.

const result = await runCommand(buildCommand, { timeout: 120000 });
if (!result.success) {
  return { error: 'Build failed', output: result.stderr };
}
```

### Test Verification
If tests exist:
```typescript
const testCommand = detectTestCommand(workspaceRoot);
// e.g., "npm test", "npm run testonly", "cargo test"

const result = await runCommand(testCommand, { timeout: 180000 });
if (!result.success) {
  // Don't fail completely, but report
  return { warning: 'Tests failed', output: result.stderr };
}
```

### Command Detection
- Check for scripts in `package.json`
- Check for `Cargo.toml` (Rust projects)
- Fall back to standard commands
- Cache results per workspace

---

## Spec Synchronization

### Requirement
**CRITICAL**: Every code change must be accompanied by spec updates in the same Copilot interaction.

### Implementation
1. Copilot response includes both code changes and spec updates
2. Sidecar applies them atomically (all or nothing)
3. Response clearly lists which specs were updated
4. UI displays spec changes alongside code changes

### Example Spec Update
When adding dark mode feature:

**Code changes**:
- `src/components/DarkModeToggle.tsx` (created)
- `src/contexts/ThemeContext.tsx` (created)
- `src/App.tsx` (modified)

**Spec changes**:
- `.prompts/features/dark-mode.md` (created) - full feature description
- `.prompts/plan/app-spec.md` (modified) - add to features list
- `.prompts/plan/data-spec.md` (modified) - add theme preference to user settings

---

## Error Handling

### Build Errors
1. Parse error output
2. Identify likely cause
3. Attempt fix
4. If fix fails:
   - Write learning to `.prompts/learnings/build-and-tooling.md`
   - Report to user with explanation
   - Suggest reverting or manual intervention

### File Operation Errors
- Permission denied → Report to user, suggest checking file permissions
- Path not allowed → Report violation, explain safety rules
- File not found → Report, suggest checking project structure

### Copilot SDK Errors
- Connection error → "Cannot reach Copilot service"
- Auth error → Show Copilot CLI login instructions
- Timeout → "Request took too long, please try again"

---

## UI/UX Considerations

### Chat Display Example
```
User: Add dark mode toggle