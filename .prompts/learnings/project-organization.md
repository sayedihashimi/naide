# Project Organization Learnings

## Bug File Location (2026-02-02)

**What happened:**
A bug fix file (`fix-naide-folder-location.md`) was initially created directly in `.prompts/features/` instead of in the designated `.prompts/features/bugs/` subfolder.

**Why it mattered:**
- Mixing bugs and features in the same flat directory makes it harder to distinguish between new functionality and fixes
- The project has established conventions (documented in `.prompts/features/2026-02-02-bug-handling-conventions.md`) that all bug reports should be organized under `.prompts/features/bugs/`
- Proper organization helps maintain clarity about what's a feature vs a bug fix, especially for AI-assisted workflows

**What to do next time:**
- **Always** create bug reports in `.prompts/features/bugs/`, not directly in `.prompts/features/`
- Use the date-prefixed naming convention: `YYYY-MM-DD-brief-description.md`
- Follow the bug report template specified in the bug handling conventions
- When in doubt, refer to `.prompts/features/2026-02-02-bug-handling-conventions.md` for the complete guidelines

**Quick reference:**
- ✅ Correct: `.prompts/features/bugs/2026-02-02-fix-something.md`
- ❌ Incorrect: `.prompts/features/2026-02-02-fix-something.md`

---

## Date Prefix Enforcement (2026-02-02)

**What happened:**
The AI was sometimes creating feature and bug files without the required date prefix (e.g., `feature-name.md` instead of `2026-02-02-feature-name.md`), even though the naming convention was documented in bug handling conventions.

**Why it mattered:**
- Date prefixes provide chronological ordering and context
- They prevent filename collisions
- They make it easy to identify when features/bugs were created
- This convention is critical for project organization and is documented in `.prompts/features/2026-02-02-bug-handling-conventions.md`
- Without explicit enforcement in system prompts, the AI may miss this requirement

**What to do next time:**
- **ALWAYS** prefix feature and bug filenames with current date: `YYYY-MM-DD-description.md`
- Check system prompts (`base.system.md` and `planning.system.md`) to ensure naming conventions are explicit
- When creating files in `.prompts/features/**` or `.prompts/features/bugs/**`, verify the filename follows the pattern
- Use ISO 8601 date format (e.g., `2026-02-02`)

**Key principle:**
If a naming convention is critical but not enforced, add it explicitly to system prompts where file creation is instructed.

---

## Bug Documentation Workflow (2026-02-03)

**What happened:**
When fixing a bug (converting absolute paths to relative paths in AI status messages), the AI made the code changes but did not automatically create a bug report file or update the relevant feature specifications. The user had to ask whether these documentation tasks were done, then explicitly request them.

**Why it mattered:**
- Naide follows a spec-driven approach where documentation is as important as code
- Bug fixes should be documented for:
  - Historical context (what was wrong and why)
  - Future reference (preventing similar bugs)
  - Completeness (specs should match implementation)
- The project has established conventions in `.prompts/features/2026-02-02-bug-handling-conventions.md` that require bug documentation
- Waiting for user prompting adds friction and breaks the workflow

**What to do next time:**
- **ALWAYS** create a bug report file when fixing a bug:
  - Location: `.prompts/features/bugs/YYYY-MM-DD-brief-description.md`
  - Use the bug report template from bug handling conventions
  - Document: problem, root cause, solution, files affected, testing
- **ALWAYS** update relevant specs when behavior changes:
  - Feature specs in `.prompts/features/YYYY-MM-DD-*.md`
  - Planning specs in `.prompts/plan/**` if applicable
  - Update "Implementation Summary" or similar sections
- **Do this in the same response** as making code changes (not as a follow-up)
- Before completing any bug fix task, ask: "Have I documented this in `.prompts/`?"

**Key principle:**
Bug fixes are incomplete without documentation. Code changes + bug report + spec updates = complete work.

**Quick checklist for bug fixes:**
- ✅ Code changes made
- ✅ Bug report created in `.prompts/features/bugs/`
- ✅ Relevant specs updated
- ✅ Testing notes documented
