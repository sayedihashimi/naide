# Spec Files Changelog

This document tracks updates made to specification files based on merged PRs.

## 2026-01-31: Conversation Memory & Context Management

### Overview
Implemented proper conversation memory handling for Naide's chat experience. The AI can now remember prior messages, decisions, and constraints within a session through a three-layer memory model.

### Changes Made

#### New Utility: `conversationMemory.ts`
Created `src/naide-desktop/src/utils/conversationMemory.ts` with:
- `ConversationSummary` interface (decisions, constraints, defaults, rejections, questions)
- `ConversationContext` interface (summary + recent messages + total count)
- `getRecentMessages()` - extracts last 6-10 messages for short-term memory
- `buildConversationContext()` - builds context object for API requests
- `parseSummaryFromResponse()` - extracts summary updates from AI responses
- `cleanResponseForDisplay()` - removes summary markers from displayed responses
- `mergeSummary()` - merges summary updates incrementally

#### Sidecar Updates
Updated `src/copilot-sidecar/src/index.ts`:
- Added conversation memory types
- New `loadSpecFiles()` function to load `.prompts/plan/**` files
- New `loadFeatureFiles()` function to load `.prompts/features/**` files
- New `formatConversationSummary()` for mid-term memory prompt section
- New `formatRecentMessages()` for short-term memory prompt section
- Updated `/api/copilot/chat` endpoint to accept `conversationContext`
- Implemented proper prompt assembly order:
  1. Base system prompt
  2. Mode system prompt
  3. Learnings
  4. Spec files
  5. Feature files
  6. Conversation summary
  7. Recent messages
  8. Current user message

#### Frontend Updates
Updated `src/naide-desktop/src/pages/GenerateAppScreen.tsx`:
- Added `conversationSummary` state for mid-term memory
- Build and send `conversationContext` with each Planning request
- Extract summary updates from AI responses
- Clean responses for display (remove summary markers)
- Reset summary when switching projects or modes

### Spec Files Updated
- `.prompts/plan/data-spec.md`: Added conversation memory types and architecture
- `.prompts/plan/app-spec.md`: Updated data flow and added memory section
- `.prompts/features/conversation-memory.feature.md`: Marked as IMPLEMENTED

### Memory Model Implementation
1. **Short-Term Memory**: Last 6-10 messages stored in React state
2. **Mid-Term Memory**: Conversation summary updated from AI responses
3. **Long-Term Memory**: Repository files (specs, features, learnings)

### Prompt Assembly Order (Required)
1. Base system prompt
2. Mode system prompt
3. Relevant learnings
4. Relevant spec + feature files
5. Conversation summary
6. Recent messages
7. Current user message

---

## 2026-01-31: Simplify to Single Chat Screen

### Overview
Refactored Naide to use a single chat-driven interface instead of separate Intent Capture and Planning Mode screens. This is a structural simplification maintaining all project functionality through the Generate App screen.

### Changes Made

#### UI Simplification
- **Removed Screen 1 (Intent Capture)**:
  - Deleted `/pages/Screen1.tsx` and associated test file
  - Archived specification to `.prompts/features/removed-features/screen-1.intent-capture.md`
  
- **Removed Planning Mode UI**:
  - Deleted `/pages/PlanningMode.tsx` and associated test file
  - Archived specification to `.prompts/features/removed-features/planning-mode.shell.md`

- **Removed `.prompts/ui/` folder**: Now empty after moving specifications to removed-features

#### Routing Changes
- **Generate App Screen** is now the default and only route (`/`)
- Removed `/planning` route
- App launches directly into Generate App screen

#### State Management
- **Removed from AppContext**:
  - `initialIntentText` field (no longer needed)
  - `planDirty` boolean field
  - `setInitialIntent()` method
  - `setPlanDirty()` method
  
- **Preserved in AppContext**:
  - Project creation and loading logic
  - Section answers storage
  - File system operations
  - Project switching functionality

#### Startup Behavior
- Project load/create logic from Screen 1 moved to `App.tsx` initialization
- App ensures project files exist on startup
- Config loading preserved for last used project

#### Planning Workflow (New Model)
- Planning is now **chat-driven only** through Generate App screen
- No separate Planning Mode screen
- No "Rebuild Plan" button
- No planDirty state management
- Specs updated continuously through chat in Planning mode

#### Feature Archival
- Created `.prompts/features/removed-features/` folder
- Moved removed feature files with "REMOVED FEATURE" header containing:
  - Status: Removed
  - RemovedAt: 2026-01-31 03:49 (UTC)
  - Notes explaining replacement
  - Context about the new chat-driven approach

### Files Modified
- `/src/naide-desktop/src/App.tsx`: Simplified routing, moved startup logic
- `/src/naide-desktop/src/pages/GenerateAppScreen.tsx`: Removed Planning mode navigation
- `/src/naide-desktop/src/context/AppContext.tsx`: Removed planDirty state
- `.prompts/features/removed-features/screen-1.intent-capture.md`: Archived with header
- `.prompts/features/removed-features/planning-mode.shell.md`: Archived with header

### Files Deleted
- `/src/naide-desktop/src/pages/Screen1.tsx`
- `/src/naide-desktop/src/pages/Screen1.test.tsx`
- `/src/naide-desktop/src/pages/PlanningMode.tsx`
- `/src/naide-desktop/src/pages/PlanningMode.test.tsx`
- `.prompts/ui/` directory (now empty)

### Preserved Functionality
- Project creation and loading
- Project selection and switching
- Spec file writing/updating
- Feature file management
- Learnings storage
- Chat persistence
- Mode selector (Planning/Building/Analyzing)
- 3-column layout
- File system operations

---

## 2026-01-31: Updated specs based on PRs #2-#19

### Files Updated

#### 1. `.prompts/features/add-copilot-integration.md`
- **Status**: Added "✅ IMPLEMENTED in PR #13" header
- **Changes**: 
  - Added implementation summary section describing Node.js sidecar architecture
  - Documented auto-start mechanism by Tauri
  - Listed implemented endpoints (POST /api/copilot/chat, health check)
  - Noted sidecar location, build process, and HTTP server details

#### 2. `.prompts/features/generate-app-screen.md`
- **Status**: Added "✅ IMPLEMENTED in PR #7, #9, #15" header
- **Changes**:
  - Added implementation summary covering three PRs:
    - PR #7: Base 3-column layout and chat interface
    - PR #9: Mode selector dropdown
    - PR #15: Markdown rendering support
  - Updated "Center column: Chat area" section to document markdown rendering features
  - Updated input row section to mark expand/collapse and keyboard shortcuts as implemented
  - Noted chat persistence to `.naide/chatsessions/default-chat.json`
  - Documented XSS protection and dark theme styling
  - Updated stub response note to reference Copilot integration in PR #13

#### 3. `.prompts/plan/app-spec.md`
- **Changes**:
  - Updated architecture section with React 19, Tauri 2, and GitHub Actions CI/CD
  - Expanded Planning Mode description to include Copilot integration
  - Added Screen 1 section documenting Intent Capture screen
  - Expanded Generate App Screen section with detailed feature list:
    - Markdown rendering support
    - Message persistence
    - Expand/collapse textarea
    - Keyboard shortcuts
  - Updated Mode Selector section to show Planning as default
  - Added Copilot Sidecar Integration section describing auto-start, build process, API, and logging
  - Added Testing section documenting Vitest, test commands, coverage, and CI/CD integration

#### 4. `.prompts/tech/desktop-setup.md`
- **Changes**:
  - Updated folder layout to include `src/copilot-sidecar/`
  - Added "TypeScript Best Practices (from PR #17)" section:
    - Interface extensions over index signatures
    - Type compatibility with library expectations
    - Avoiding redundant property declarations
  - Added "CI/CD Setup (Implemented in PR #5)" section:
    - Build matrix for ubuntu/windows/macos
    - Build steps including lint, test, build
    - Configuration details (triggers, TypeScript/ESLint exclusions, bundle identifier)
  - Updated build verification section to include:
    - Generate App screen route
    - Test and lint commands
    - Multi-platform build verification

#### 5. `.prompts/naide-prototype.overview.md`
- **Changes**:
  - Added "Current Implementation Status" section listing all completed features:
    - Screen 1 (PR #2)
    - Planning Mode (PR #2)
    - Generate App Screen (PR #7, #9, #15)
    - Copilot Integration (PR #13)
    - Markdown Support (PR #15)
    - CI/CD (PR #5)
    - File Persistence System
  - Updated prototype scope to include Copilot SDK integration and Generate App screen
  - Updated tech decisions to reference Tauri 2, React 19, and CI/CD
  - Updated repo layout to include copilot-sidecar folder
  - Removed references to "rolldown-vite" (simplified to just Vite)

### PRs Reviewed

The following PRs were reviewed for important changes:

1. **PR #2**: Build Naide desktop prototype (Tauri app, file persistence, Planning Mode)
2. **PR #5**: Add CI/CD support using GitHub Actions
3. **PR #7**: Add Generate App screen with interactive chat and persistence
4. **PR #9**: Add mode selector to Generate App page (Planning/Building/Analyzing)
5. **PR #13**: Add Copilot SDK integration via Node.js sidecar with auto-start
6. **PR #15**: Add markdown rendering to Generate App chat messages
7. **PR #17**: Fix TypeScript error in MessageContent code component
8. **PR #19**: Remove unused PathBuf import (minor cleanup)

### Minor PRs Not Requiring Spec Updates

- **PR #4**: Fix 9 failing tests and add CI-ready test command (infrastructure only)
- **PR #17**: TypeScript fix (added best practices to desktop-setup.md)
- **PR #19**: Code cleanup (unused import removal)

## Notes

All spec files have been updated to reflect the current implementation state as of January 31, 2026. The updates focus on:

1. Marking implemented features with status badges
2. Adding implementation summary sections
3. Documenting architecture changes (sidecar, CI/CD)
4. Recording best practices learned during implementation (TypeScript patterns)
5. Updating technical details (versions, commands, file structures)

The spec files now serve as both:
- Historical requirements documentation (original intent)
- Current implementation documentation (what was actually built)
