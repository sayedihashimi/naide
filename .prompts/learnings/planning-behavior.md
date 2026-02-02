# Planning Mode Behavior Learnings

## Conversation-First Approach (2026-02-02)

**What happened:**
Planning mode was jumping straight to creating projects and files when users made initial requests like "I would like to create a new .NET 10 console app". Instead of asking clarifying questions, it immediately took action.

**Why it mattered:**
- Naide targets non-professional developers who may not express complete requirements upfront
- Acting without clarification leads to wrong assumptions and wasted work
- Planning mode is meant to be a thinking partner and requirements analyst, not an eager implementer
- The conversation should help users discover and articulate what they really need

**What to do next time:**
- **ALWAYS** treat first/second messages as Brainstorming or Questions, never as Proposals
- **NEVER** create files, update specs, or take action on initial requests
- **ALWAYS** respond with clarifying questions first:
  - What is the purpose/goal?
  - What are the requirements and constraints?
  - What is the scope and context?
  - Are there existing components to integrate with?
- Only proceed to creating specs after asking questions AND receiving answers
- Think like a consultant gathering requirements, not a developer rushing to code
- Use the examples in `planning.system.md` as a guide for good conversation patterns

**Key principle:**
Planning mode success is measured by **clarity and understanding**, not speed. Take time to understand before acting.
