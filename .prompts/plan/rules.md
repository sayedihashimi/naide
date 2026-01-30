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
- `.naide/learnings/**` - Project learnings

### Prohibited Writes
- Application source code (unless in Building mode - future)
- Configuration files outside allowed directories
- Any file outside the workspace root

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

### Building Mode (Future)
- Can update both code and specs
- Must maintain spec/code synchronization
- Run tests before marking complete

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
