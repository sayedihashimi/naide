# Bug: Base System Prompt Not Required

**Type:** Bug Fix  
**Priority:** High  
**Status:** Open

---

## Problem Statement

The `base.system.md` system prompt file is currently loaded with only a warning if missing, rather than being enforced as required. This means critical instructions (like FILE LOCATION RULES) may not be sent to Copilot, leading to incorrect behavior.

**Current behavior:**
- If `base.system.md` doesn't exist, a warning is logged and the sidecar continues without it
- Copilot may receive incomplete or missing instructions

**Expected behavior:**
- If `base.system.md` is missing, the sidecar should fail with a clear error
- Copilot requests should not proceed without the base system prompt

---

## Root Cause

In `src/copilot-sidecar/src/index.ts`, the `loadSystemPrompts()` function (lines 112-175) uses optional loading:

```typescript
if (existsSync(basePath)) {
  systemPrompt += readFileSync(basePath, 'utf-8') + '\n\n';
} else {
  console.warn('[Sidecar] Base system prompt not found');
}
```

This allows the sidecar to continue even when the base prompt is missing, which can cause:
- Missing critical instructions (like file location rules)
- Inconsistent AI behavior
- Hard-to-debug issues when prompts are incomplete

---

## Proposed Solution

1. **Make base prompt required**: Throw an error if `base.system.md` is missing
2. **Improve error message**: Provide clear guidance on where the file should be located
3. **Add validation**: Check for base prompt existence during sidecar startup
4. **Update tests**: Ensure tests cover the missing file scenario

---

## Scope

### In Scope
- Modify `loadSystemPrompts()` to throw error if base prompt is missing
- Add clear error messages with file path
- Update error handling in endpoint handlers
- Add startup validation (optional)
- Update related tests

### Out of Scope
- Changes to mode-specific prompt loading (those can remain optional for now)
- Changes to other prompt files
- UI changes (error will surface through existing error handling)

---

## Acceptance Criteria

- [ ] `loadSystemPrompts()` throws error if `base.system.md` is missing
- [ ] Error message includes full expected file path
- [ ] Sidecar startup validates base prompt exists (optional but recommended)
- [ ] Copilot endpoints return 500 error if base prompt is missing
- [ ] Tests verify error handling for missing base prompt
- [ ] No regressions in existing functionality
- [ ] Sidecar logs clear error message

---

## Files Affected

- `src/copilot-sidecar/src/index.ts` - Update `loadSystemPrompts()` function
- `src/copilot-sidecar/src/index.ts` - Add startup validation (optional)
- `src/copilot-sidecar/tests/` - Update tests for error handling

---

## Testing

### Manual Testing
1. Delete `base.system.md` temporarily
2. Start sidecar - should fail with clear error
3. Restore file - sidecar should start normally
4. Try to make Copilot request with missing file - should return error

### Automated Tests
- Add test case for missing `base.system.md`
- Verify error message format
- Verify no request proceeds without base prompt

---

## Related Issues

- Related to: `.prompts/learnings/project-organization.md` (file location confusion)
- Depends on: System prompts in `.prompts/system/` being present
