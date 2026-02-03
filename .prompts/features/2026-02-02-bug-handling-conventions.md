---
Status: shipped
Area: process, documentation
Created: 2026-02-02
LastUpdated: 2026-02-03
---

# Feature: Bug Handling Conventions
**Status**: ✅ IMPLEMENTED

## Summary
Establish clear conventions for how bugs are reported, tracked, and organized in the Naide project. Bugs are treated as a special category of work items that are tracked separately from feature specifications.

---

## Goals
- Provide a consistent structure for bug reports
- Keep bugs organized and easily discoverable
- Differentiate bugs from feature requests
- Maintain historical context for resolved bugs

---

## Non-Goals
- External bug tracking systems (GitHub Issues, Jira, etc.)
- Automated bug detection or reporting
- Bug prioritization frameworks
- SLA or response time policies

---

## Bug File Organization

### Location
All bug reports are stored in:
```
.prompts/features/bugs/
```

This keeps bugs conceptually related to features while maintaining clear separation.

### Naming Convention
Bug files **must** be prefixed with the date in ISO 8601 format:
```
YYYY-MM-DD-brief-description.md
```

**Examples:**
- `2026-02-02-fix-learnings-folder-location.md`
- `2026-02-02-chat-input-loses-focus.md`
- `2026-02-02-sidecar-crashes-on-startup.md`

**Rationale:**
- Matches feature file naming convention
- Provides chronological ordering
- Makes it easy to identify when a bug was reported
- Prevents filename collisions

---

## Bug Report Structure

Each bug report should follow this template:

```markdown
# Bug: [Brief Title]

**Type:** Bug Fix  
**Priority:** [High/Medium/Low]  
**Status:** [Open/In Progress/Fixed/Won't Fix]

---

## Problem Statement

Clear description of the incorrect behavior:
- What is happening now (actual behavior)
- What should happen (expected behavior)
- How this differs from specifications

---

## Reproduction Steps

If applicable:
1. Step-by-step instructions to reproduce the bug
2. Required preconditions or setup
3. Expected vs actual results at each step

---

## Root Cause (if known)

Technical explanation of why the bug occurs:
- Which components/files are involved
- What logic or assumption is incorrect
- Link to relevant code or spec files

---

## Proposed Solution

High-level approach to fix:
- What needs to change
- Which files will be affected
- Any risks or considerations

---

## Scope

### In Scope
- Specific changes required to fix the bug
- Related spec updates
- Test cases to prevent regression

### Out of Scope
- Related but separate issues
- Features that would prevent the bug class
- Major refactoring (unless necessary)

---

## Acceptance Criteria

- [ ] Specific, testable criteria for the fix
- [ ] Verification steps
- [ ] No regressions in related functionality

---

## Files Affected

List of files that need to be modified:
- Path/to/file1.ts - Brief description of change
- Path/to/file2.rs - Brief description of change
- .prompts/plan/spec.md - Spec update required

---

## Testing

How to verify the fix works:
- Manual testing steps
- Automated tests to add/update
- Edge cases to check

---

## Related Issues

Links to related bugs, features, or specs:
- Related feature: `.prompts/features/feature-name.md`
- Depends on: `.prompts/features/bugs/other-bug.md`
- Caused by: Brief explanation
```

---

## Bug Lifecycle

### 1. Creation
- Bug is discovered (by user, AI, or developer)
- Bug file is created in `.prompts/features/bugs/` with date prefix
- Status set to "Open"
- Priority assigned based on impact

### 2. In Progress
- Bug is being actively worked on
- Status updated to "In Progress"
- Implementation approach documented in the file

### 3. Fixed
- Fix is implemented and verified
- Status updated to "Fixed"
- Acceptance criteria checked off
- Related specs updated

### 4. Won't Fix (Optional)
- Decision made not to fix (e.g., by design, too low impact)
- Status updated to "Won't Fix"
- Rationale documented in the file
- File may be moved to `removed-features/` if appropriate

---

## Bug vs Feature Decision

**It's a Bug if:**
- Current behavior contradicts existing specs
- Functionality is broken or doesn't work as designed
- Error, crash, or data corruption occurs
- User cannot complete expected workflow

**It's a Feature if:**
- Requesting new functionality not in specs
- Suggesting improvement to working behavior
- Proposing alternative implementation
- Adding capability that doesn't exist yet

**Gray Areas:**
- Missing functionality implied by spec → Bug
- Poorly designed functionality working as spec'd → Feature (improvement)
- Spec is ambiguous → Clarify spec first, then decide

---

## Priority Guidelines

**High Priority:**
- App crashes or won't start
- Data loss or corruption
- Blocks critical workflows
- Security vulnerability

**Medium Priority:**
- Functionality broken but workaround exists
- Significant UX degradation
- Inconsistent with specs but not blocking

**Low Priority:**
- Minor visual issues
- Edge case failures
- Non-critical feature gaps
- Performance issues with acceptable workaround

---

## Integration with AI Workflows

### Planning Mode
- AI can create bug report files in `.prompts/features/bugs/`
- AI should use the standard template
- AI should link bugs to affected specs

### Building Mode (Future)
- AI can implement bug fixes
- AI must update bug status when fix is implemented
- AI must update related specs if behavior changes

### Learnings
- When bugs reveal incorrect assumptions, write learning to `.prompts/learnings/`
- Reference the bug file in the learning

---

## Archival

### When to Archive
- Bug is fixed and verified in production
- Bug is marked "Won't Fix" and no longer relevant
- Bug is superseded by feature redesign

### How to Archive
1. Move file to `.prompts/features/removed-features/`
2. Add archive header to top of file:
   ```markdown
   ---
   ARCHIVED BUG (HISTORICAL ONLY)
   - Status: [Fixed/Won't Fix/Superseded]
   - ArchivedAt: YYYY-MM-DD HH:mm
   - Resolution: Brief explanation
   ---
   ```
3. Keep original content for reference

---

## Examples

### Example 1: Configuration Bug
**Filename:** `2026-02-02-fix-learnings-folder-location.md`  
**Priority:** High  
**Summary:** Learnings written to `.naide/learnings/` instead of `.prompts/learnings/`

### Example 2: UI Bug
**Filename:** `2026-02-03-chat-input-clears-on-error.md`  
**Priority:** Medium  
**Summary:** User loses typed message when API call fails

### Example 3: Build Bug
**Filename:** `2026-02-03-sidecar-build-fails-windows.md`  
**Priority:** High  
**Summary:** TypeScript compilation error on Windows due to path separator

---

## Maintenance

- Review open bugs monthly
- Update priorities as project evolves
- Archive fixed bugs after stable release
- Update this convention document as process evolves

---

## Success Criteria

✅ All bugs filed in `.prompts/features/bugs/`  
✅ All bug files use date prefix naming  
✅ Bug reports follow standard template  
✅ Status and priority clearly indicated  
✅ Fixed bugs have resolution documented  
✅ Archived bugs moved to `removed-features/`  

---

## Related Documentation

- `.prompts/features/FEATURES_INDEX.md` - Feature tracking
- `.prompts/plan/rules.md` - Project rules and conventions
- `.prompts/learnings/` - Lessons learned from bugs


created by naide