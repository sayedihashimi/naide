# App Specification

## Overview
Naide is a Tauri desktop application with a React + Vite frontend that helps non-professional developers create and maintain applications using AI assistance.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Sidecar**: Node.js + TypeScript service for Copilot SDK integration
- **Communication**: HTTP API between frontend and sidecar (localhost:3001)
- **Build System**: GitHub Actions CI/CD for ubuntu-latest, windows-latest, and macos-latest

## Core Features

### 1. Planning Mode
- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/**` and `.prompts/features/**`
- Reads and applies learnings from `.naide/learnings/**`
- Does not modify code files
- Interactive chat interface with Copilot integration

### 2. Building Mode (Stub)
- Returns "Building coming soon" message
- Will eventually update code and specs

### 3. Analyzing Mode (Stub)
- Returns "Analyzing coming soon" message
- Will eventually analyze code and provide insights

## User Interface

### Screen 1: Intent Capture
- Initial screen for project creation
- Starter prompt chips for common use cases
- Navigation to Planning Mode

### Planning Mode
- Section-based guided Q&A
- File persistence to markdown files
- Project management with folder picker

### Generate App Screen
- **Left Panel**: Navigation sidebar (Planning/Generate/Activity/Files)
- **Center Panel**: 
  - Interactive chat interface with markdown rendering support
  - Mode selector dropdown (Planning/Building/Analyzing)
  - Message persistence to `.naide/chatsessions/`
  - Expand/collapse textarea control
  - Keyboard shortcuts (Enter for newline, Ctrl/Cmd+Enter to submit)
- **Right Panel**: Running app preview (placeholder, not yet functional)

### Mode Selector
Dropdown with three options:
- Planning (Create/update specs only) - Default
- Building (Update code and specs) - Coming soon
- Analyzing (Coming soon)

## Data Flow
1. User types message in chat
2. Frontend builds conversation context (summary + recent messages)
3. Frontend calls sidecar API at `/api/copilot/chat`
4. Sidecar assembles full prompt in required order:
   - Base system prompt + mode system prompt
   - Learnings from `.naide/learnings/`
   - Spec files from `.prompts/plan/`
   - Feature files from `.prompts/features/`
   - Conversation summary (mid-term memory)
   - Recent messages (short-term memory)
   - Current user message
5. Sidecar calls Copilot SDK (or returns stub for Building/Analyzing)
6. Response displayed in chat with markdown rendering
7. Conversation summary updated from response (if present)
8. Files updated as needed (Planning mode only)

## Conversation Memory
- **Short-Term Memory**: Rolling buffer of last 6-10 messages in app state
- **Mid-Term Memory**: Conversation summary updated incrementally
- **Long-Term Memory**: Repo files (specs, features, learnings) are authoritative
- Token usage stays bounded by limiting recent messages
- Summary tracks: decisions, constraints, accepted defaults, rejected options, open questions

## Copilot Sidecar Integration
- Auto-started by Tauri on application launch
- Built with TypeScript, compiled to `src/copilot-sidecar/dist/index.js`
- Uses `@github/copilot-sdk` for AI interactions
- Exposes HTTP API on localhost:3001
- Logs startup with PID to console

## Testing
- **Test Framework**: Vitest + React Testing Library
- **Test Command**: `npm run testonly` (excludes integration tests by default)
- **Coverage**: 81+ tests across UI components and utilities
- **CI/CD**: Automated testing on all platforms via GitHub Actions
