# Rules

## Core Principles
1. **Safety First**: Never make silent destructive changes
2. **User Control**: User must understand and approve all changes
3. **Predictability**: Behavior should be consistent and expected
4. **Learning**: Improve from past mistakes and corrections

## File Operations

### Allowed Writes
- `.prompts/plan/**` - Planning documents
- `.prompts/features/**` - Feature specifications
- `.prompts/learnings/**` - Project learnings

### Prohibited Writes (Planning Mode)
- Application source code (allowed in Building mode)
- Configuration files outside allowed directories
- Any file outside the workspace root

### Building Mode Writes
- Application source code in project folder
- Test files and configuration files (with restrictions)
- Protected: `.env`, `.git/**`, `node_modules/**`, lock files

## Learnings Capture

### When to Write a Learning
- User corrects the AI
- Build/test error occurs and AI must adjust
- User provides feedback that changes approach

### Learning Quality
- Must be high-signal and reusable
- No long logs or noise
- Include context: what happened, why it mattered, what to do next time
- Group related learnings in the same file

### Learning Categories
Examples:
- `ui-and-layout.md` - UI/UX lessons
- `routing-and-navigation.md` - Navigation patterns
- `build-and-tooling.md` - Build system issues
- `api-and-data.md` - API and data handling

## Mode-Specific Rules

### Planning Mode
- Only update spec files, never code
- Read all context: README, prompts, specs, learnings
- Ask clarifying questions before making changes
- Propose changes explicitly
- Update specs after user confirms

### Building Mode
- Can update both code and specs
- Must maintain spec/code synchronization
- Run tests before marking complete
- Code placement: new apps in `src/`, existing apps follow patterns
- Protected files: `.env`, `.git/`, `node_modules/`, lock files
- User confirmation required for: deletions, build config changes, new dependencies, major refactoring

### Analyzing Mode (Future)
- Read-only analysis
- No file modifications
- Provide insights and recommendations

## Error Handling

### Copilot CLI Not Available
- Show clear message to user
- Provide installation instructions
- Don't crash or hang

### Network/Connection Errors
- Graceful degradation
- Clear error messages
- Allow retry

### File Operation Errors
- Log errors clearly
- Don't leave partial changes
- Report to user
