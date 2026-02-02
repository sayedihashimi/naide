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
