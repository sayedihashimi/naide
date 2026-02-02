# Fix: .naide Folder Location

**Type:** Bug Fix  
**Priority:** High  
**Status:** Ready for Implementation

---

## Problem

The `.naide` folder (containing `chatsessions/` and `project-config.json`) is currently being created in the **Documents directory** instead of the **project directory** (the directory the user explicitly opens).

This causes:
- Configuration and chat history to be stored in the wrong location
- Potential conflicts when multiple projects are opened
- Loss of project-specific context and settings

---

## Expected Behavior

**General Rule:**  
When a user opens a project directory, the `.naide` folder must be created **inside that project directory**.

**Exception:**  
Only on first launch, before the user has explicitly opened any project, may the app use a fallback location (e.g., Documents folder).

---

## Scope

### In Scope
- Move `.naide` folder creation logic to use the opened project directory
- Ensure `project-config.json` is written to `<project-root>/.naide/`
- Ensure chat sessions are stored in `<project-root>/.naide/chatsessions/`
- Handle the first-launch case when no project is open (fallback to Documents or prompt user)

### Out of Scope
- Migration of existing `.naide` data from Documents to project directories (can be handled separately if needed)
- Changes to the `.naide` folder structure or contents

---

## Technical Details

### Current Incorrect Behavior
```
Documents/
  .naide/
    chatsessions/
    project-config.json
```

### Expected Correct Behavior
```
<user-opened-project-directory>/
  .naide/
    chatsessions/
    project-config.json
```

### Implementation Notes
1. Identify where the code currently references the Documents folder for `.naide`
2. Update to use the project root directory (the directory the user opened)
3. Add a check: if no project is open (first launch), use a temporary fallback or prompt the user to open a project
4. Ensure all file I/O operations for `.naide` use the correct project-relative path

---

## Acceptance Criteria

- [ ] When a user opens a project directory, `.naide/` is created inside that project directory
- [ ] `project-config.json` is written to `<project-root>/.naide/project-config.json`
- [ ] Chat sessions are saved to `<project-root>/.naide/chatsessions/`
- [ ] The Documents folder is **only** used when the app first launches and no project has been opened yet
- [ ] Opening different projects creates separate `.naide` folders in each project
- [ ] No code references the Documents folder for `.naide` except for the first-launch fallback case

---

## Testing

- Open a project directory
- Verify `.naide/` folder is created in that project root
- Create a chat session and verify it's saved in `<project-root>/.naide/chatsessions/`
- Close and reopen the same project; verify existing `.naide` data is loaded correctly
- Open a different project; verify a separate `.naide` folder is created there
- Launch app without opening a project; verify fallback behavior (e.g., prompt or use Documents temporarily)

---

## Notes

- The `.naide` folder should be added to `.gitignore` (if not already) to avoid committing project-local state
- Consider documenting this behavior in the README or user guide

created by naide