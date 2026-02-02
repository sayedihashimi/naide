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
