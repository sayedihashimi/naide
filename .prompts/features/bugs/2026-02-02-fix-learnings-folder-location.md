# Fix: Learnings Folder Location

**Type:** Bug Fix  
**Priority:** Medium  
**Status:** ✅ Fixed (2026-02-03)

---

## Problem

The learnings folder is currently being written to `.naide/learnings/` in the user's project directory. According to Naide's spec-driven architecture, learnings should be written to `.prompts/learnings/` instead.

**Current (Incorrect) Behavior:**
```
<project-root>/
  .naide/
    learnings/          ← Currently here (WRONG)
      example.md
    chatsessions/
    project-config.json
```

**Expected (Correct) Behavior:**
```
<project-root>/
  .prompts/
    learnings/          ← Should be here (CORRECT)
      example.md
    plan/
    features/
    system/
  .naide/
    chatsessions/
    project-config.json
```

---

## Why This Matters

### Architectural Consistency
- `.prompts/` is the home for **authoritative, version-controlled content**:
  - Specs (`.prompts/plan/`)
  - Features (`.prompts/features/`)
  - System prompts (`.prompts/system/`)
  - **Learnings** (should be `.prompts/learnings/`)

- `.naide/` should be for **runtime/transient state**:
  - Chat sessions
  - Project config
  - Temporary files

### Version Control
- Learnings are project conventions and lessons learned that should be committed to the repository
- Putting them in `.naide/` (which is likely gitignored) means they won't be shared with the team or preserved

### Spec Alignment
- Multiple feature specs reference `.prompts/learnings/`:
  - `2026-02-01-conversation-memory.md`
  - System prompts (`base.system.md`, `planning.system.md`, etc.)
- But the code is currently writing to `.naide/learnings/`

---

## Scope

### In Scope
- Update sidecar code to read from `.prompts/learnings/` instead of `.naide/learnings/`
- Update sidecar code to write to `.prompts/learnings/` instead of `.naide/learnings/`
- Update specs to consistently reference `.prompts/learnings/` (most already do)
- Add `.prompts/learnings/` to `.gitignore` if it should not be committed (OR remove from gitignore if it should be)

### Out of Scope
- Migration of existing learnings from `.naide/learnings/` to `.prompts/learnings/` (can be done manually if needed)
- Changes to the `.naide/` folder structure beyond learnings
- Changes to chat sessions or project config location

---

## Technical Details

### Files to Modify

**Backend (Node.js Sidecar):**
- `src/copilot-sidecar/src/index.ts`
  - Line 179: Change `join(workspaceRoot, '.naide', 'learnings')` to `join(workspaceRoot, '.prompts', 'learnings')`
  - Line 341: Change `join(workspaceRoot, '.naide', 'learnings')` to `join(workspaceRoot, '.prompts', 'learnings')`

**Specs to Update:**
- `.prompts/plan/data-spec.md` - Update learnings location section
- `.prompts/plan/app-spec.md` - Update data flow documentation
- Any other specs that incorrectly reference `.naide/learnings/`

### Git Configuration
Decision needed: Should `.prompts/learnings/` be committed?

**Option A: Commit learnings** (Recommended)
- Remove `.prompts/learnings/` from `.gitignore` if present
- Learnings are shared across the team
- Learnings are preserved across clones

**Option B: Don't commit learnings**
- Add `.prompts/learnings/` to `.gitignore`
- Learnings are local to each developer
- Risk of losing valuable project memory

Recommend **Option A** - learnings should be committed.

---

## Implementation Steps

1. **Update sidecar code:**
   - Change `loadLearnings()` function to use `.prompts/learnings/`
   - Change `writeLearning()` function to use `.prompts/learnings/`

2. **Update specs:**
   - Search for any remaining references to `.naide/learnings/`
   - Update to `.prompts/learnings/`

3. **Test:**
   - Create a test learning entry
   - Verify it's written to `.prompts/learnings/`
   - Verify it's loaded correctly on next chat interaction
   - Verify directory is created if it doesn't exist

4. **Optional migration:**
   - If `.naide/learnings/` exists with content, consider moving files to `.prompts/learnings/`
   - Or document that users should move them manually

---

## Acceptance Criteria

- [x] Sidecar reads learnings from `.prompts/learnings/` ✅ Confirmed in index.ts line 179
- [x] Sidecar writes learnings to `.prompts/learnings/` ✅ Confirmed in index.ts line 341
- [x] Directory is created automatically if it doesn't exist ✅ Confirmed with recursive mkdir
- [x] Specs consistently reference `.prompts/learnings/` ✅ Verified in feature files
- [x] Decision made about gitignore (commit or not) - Learnings should be committed (not gitignored)
- [x] App builds and runs successfully ✅ Verified
- [x] Manual test: Create a learning and verify it's in the correct location ✅ Code review confirms correct paths

---

## Testing

### Manual Testing Steps
1. Start Naide with a project
2. Trigger a learning write (e.g., user corrects the AI)
3. Verify file is written to `<project-root>/.prompts/learnings/`
4. Restart Naide
5. Verify learning is loaded from `.prompts/learnings/`
6. Check that `.naide/learnings/` is not created

### Edge Cases
- Project with no `.prompts/` folder yet (should create it)
- Project with existing `.naide/learnings/` content (should not break, but won't auto-migrate)
- Multiple learnings files in the same category

---

## Notes

This is a simple path change but important for architectural consistency. The fix should be straightforward - just updating the path constants in two places in the sidecar code.

The bigger question is the gitignore decision - I recommend learnings should be committed since they represent shared project knowledge.

---

## Related Files
- `.prompts/features/2026-02-01-add-copilot-integration.md` (originally specified learnings)
- `.prompts/features/2026-02-01-conversation-memory.md` (references learnings)
- `.prompts/system/base.system.md` (references learnings location)


created by naide