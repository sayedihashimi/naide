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

---

## Write Files Immediately After Producing Plans (2026-02-03)

**What happened:**
The AI was producing detailed feature plans in chat responses but not writing the feature files to `.prompts/features/YYYY-MM-DD-description.md` until the user explicitly asked to implement. This created a gap where detailed plans existed only in chat, not as persistent specifications.

**Why it mattered:**
- Naide is spec-driven: specifications are the source of truth, not chat transcripts
- Planning mode's deliverable IS the specification file, not just a chat response
- Users expect that when they see a detailed plan, it has been saved to the project
- The spec files need to exist for Building mode to reference them
- Waiting for "implement" delays the creation of the authoritative documentation

**What to do next time:**
- **ALWAYS** write the feature file immediately after producing a detailed plan
- If you've described scope, behavior, acceptance criteria, and implementation guidance → write the file
- Do NOT wait for the user to say "implement" or "create the file"
- The specification IS the deliverable in Planning mode
- After writing files, present a summary of what was created/updated

**Key principle:**
In Planning mode, creating the specification file is not preparation for implementation—it IS the implementation. Write files as soon as you have enough information to create a build-ready spec.

---

## Learnings Must Be Applied (2026-02-03)

**What happened:**
User noticed that Copilot was not consistently applying lessons from `.prompts/learnings/` files, repeating mistakes that had already been documented and corrected.

**Why it mattered:**
- Learnings exist to prevent repeating past mistakes
- If learnings aren't applied, the same errors occur repeatedly, wasting user time
- Learnings represent expensive lessons learned through trial and error
- Ignoring learnings defeats the purpose of the project memory system

**Root cause:**
1. **Prompt placement**: Learnings were loaded BEFORE specs/features, making them less prominent
2. **Weak framing**: The learnings section had no emphasis on importance or application
3. **No enforcement**: System prompts mentioned reading learnings but didn't enforce applying them

**What was fixed:**
1. **Reordered prompt assembly**: Learnings now come AFTER specs/features (fresher in context)
2. **Stronger framing**: Added "CRITICAL: Read these learnings carefully before making decisions"
3. **Explicit instructions**: System prompts now explicitly require checking and applying learnings

**What to do next time:**
- **ALWAYS** scan `.prompts/learnings/**` BEFORE making any significant decision
- **If a learning contradicts your initial approach, follow the learning** (it exists because that approach was already tried and failed)
- Learnings are corrections, not suggestions—they override general assumptions
- Before creating files, updating specs, or writing code: check for relevant learnings
- If a learning says "never do X", then never do X—even if it seems reasonable

**Key principle:**
Learnings are project-specific truths learned through experience. They have higher authority than general best practices because they represent what actually works (or doesn't work) in THIS specific project.
