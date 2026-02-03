---
Status: shipped
Area: chat, copilot
Created: 2026-02-01
LastUpdated: 2026-02-03
---

# Feature: Conversation Memory & Context Management for Chat
**Status**: ✅ IMPLEMENTED

## Summary
Add proper conversation memory handling to Naide’s chat experience so the AI can remember prior messages, decisions, and constraints within a session.

This feature introduces **structured conversation memory** (short-term + mid-term) and integrates it with Naide’s existing **repo-based long-term memory** (`.prompts/**`, `.prompts/learnings/**).

The goal is to make chat-driven planning and building **coherent, consistent, and scalable**, without relying on unbounded chat transcripts.

---

## Goals
- Ensure the AI remembers prior messages and decisions within a conversation
- Prevent repetition, contradictions, and loss of context
- Keep token usage bounded and predictable
- Leverage Naide’s spec files as the primary source of truth
- Align chat behavior with Naide’s philosophy:
  > *“The app is the memory, not the chat.”*

---

## Non-Goals
- Cross-session memory beyond what is written to disk
- Infinite chat transcript replay
- Relying on implicit model memory
- Implementing vector databases or embeddings (for now)

---

## Memory Model (Three Layers)

### 1) Short-Term Memory: Recent Messages
- Maintain a rolling buffer of the **last 6–10 messages**
  - Includes both user and assistant messages
- Stored in app state (not written to disk)
- Sent verbatim with each Copilot request

Purpose:
- Preserve conversational flow
- Handle follow-ups like “yes”, “no”, “change that”

---

### 2) Mid-Term Memory: Conversation Summary
- Maintain a **single rolling conversation summary**
- Stored in app state
- Updated incrementally as the conversation evolves

The summary should capture:
- Key decisions
- Constraints
- Accepted defaults
- Rejected options
- Open questions

---

### 3) Long-Term Memory: Repo Files (Authoritative)
- `.prompts/plan/**`
- `.prompts/features/**`
- `.prompts/learnings/**`

Specs are the source of truth; chat memory is supporting context.

---

## Prompt Assembly Order (REQUIRED)
1) Base system prompt  
2) Mode system prompt  
3) Relevant learnings  
4) Relevant spec + feature files  
5) Conversation summary  
6) Recent messages  
7) Current user message  

---

## Acceptance Criteria
- AI remembers prior messages
- No repetition of settled decisions
- Stable token usage
- App builds and runs
