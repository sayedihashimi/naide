# App Specification

## Overview
Naide is a Tauri desktop application with a React + Vite frontend that helps non-professional developers create and maintain applications using AI assistance.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Sidecar**: Node.js + TypeScript service for Copilot SDK integration
- **Communication**: HTTP API (localhost:3001) + WebSocket (ws://localhost:3001) between frontend and sidecar
- **Proxy**: Lightweight HTTP proxy (localhost:3002) for running app preview with navigation tracking
- **Build System**: GitHub Actions CI/CD for ubuntu-latest, windows-latest, and macos-latest

## Core Features

### 1. Planning Mode
- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/**` and `.prompts/features/**`
- Reads and applies learnings from `.prompts/learnings/**` via `search_learnings` tool
- Does not modify code files
- Interactive chat interface with Copilot integration
- Streaming responses via Server-Sent Events (SSE)

### 2. Building Mode
- AI-assisted code implementation and maintenance
- Updates both application code and specification files
- Uses Copilot SDK with building-specific system prompt
- Code placement rules: new apps in `src/`, existing apps follow patterns
- Safe file writes with path allowlisting

### 3. Analyzing Mode (Stub)
- Returns "Analyzing coming soon" message
- Will eventually analyze code and provide insights

## User Interface

The app launches directly into the Generate App screen (single-screen app). Screen 1 (Intent Capture) and Planning Mode UI were removed in favor of chat-driven planning.

### Generate App Screen (Main & Only Screen)
- **Left Panel**: Two collapsible sections
  - **Features** (expanded by default): File browser for `.prompts/features/` with filter, view options gear menu, tree view with folders, date-based sorting
  - **Files** (collapsed by default): Project file browser with lazy-loaded directory tree, file-type icons, filter bar
  - Both sections have expand/collapse chevrons on headings
- **Center Panel**:
  - **Tab bar**: Generate App tab (always first, never closable) + feature file tabs + project file tabs
  - **Chat interface**: Markdown rendering, streaming responses, conversation memory
  - **Activity status bar**: Real-time AI operation status (file reads/writes, API calls) via WebSocket
  - **Mode selector dropdown**: Auto (default) / Planning / Building / Analyzing
  - **New Chat button** (+): Archives current chat, starts fresh
  - **Chat History button** (clock): Dropdown to load/delete archived chats
  - **Resizable textarea**: Drag handle for custom height, expand/collapse toggle
  - **Keyboard shortcuts**: Enter for newline, Ctrl/Cmd+Enter to submit
  - **Copilot working indicator**: Brightness pulsing animation on assistant icon during processing
- **Right Panel**: Running app preview
  - **App detection**: Automatically detects npm and .NET web projects
  - **App selector dropdown**: Choose which app to run when multiple detected
  - **Play/Stop/Refresh buttons** with visual state indicators
  - **Iframe display**: Running app shown via proxy (localhost:3002) with navigation tracking
  - **Resizable width**: Drag handle on left edge (300px–1200px, default 600px)
  - **Hot reload support**: Auto-refresh on code changes

### Tab System
- VS Code-inspired tab behavior
- Double-click file in left panel opens a pinned tab
- Feature file tabs: view (markdown) and edit (textarea) modes
- Project file tabs: view and edit modes
- Maximum 10 tabs (1 chat + 9 file tabs)
- Tab persistence across sessions via `.naide/project-config.json`
- Context menu: Close, Close All
- Middle-click to close

### Mode Selector
Dropdown with four options:
- Auto — Default (Copilot infers planning vs building, proposes actions, asks for confirmation)
- Planning (Create/update specs only)
- Building (Update code and specs)
- Analyzing — Coming soon

### Project Management
- **Recent projects dropdown**: List of recently opened projects, sorted by most recent
- **Remove from recent**: Trash icon to remove entries (does not delete project)
- **Last used project**: Auto-loads on app launch
- **Project switcher**: Open different project folder

## Data Flow
1. User types message in chat
2. Frontend builds conversation context (summary + recent messages)
3. Frontend calls sidecar streaming API at `/api/copilot/stream`
4. Sidecar assembles full prompt in required order:
   - Base system prompt + mode system prompt
   - Spec files from `.prompts/plan/`
   - Feature files from `.prompts/features/`
   - Conversation summary (mid-term memory)
   - Recent messages (short-term memory)
   - Current user message
5. Copilot SDK called with `search_learnings` tool available for on-demand learning retrieval
6. Response streamed incrementally to UI via SSE
7. Status events broadcast via WebSocket (file operations, API calls)
8. Conversation summary updated from response (if present)
9. Files updated after stream completes (Planning/Building modes)

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
- WebSocket server on localhost:3001 for real-time status events
- Proxy server on localhost:3002 for running app preview
- Custom `search_learnings` tool registered with Copilot SDK for on-demand learning retrieval
- Streaming endpoint (`/api/copilot/stream`) using Server-Sent Events
- Shared log file with Tauri backend via `NAIDE_LOG_FILE` environment variable

## File Logging
- Log files in `%temp%/com.naide.desktop/logs/`
- Single log file per app run: `naide-{timestamp}.log`
- Both Rust backend and Node.js sidecar write to same log file
- Tauri passes log path to sidecar via `NAIDE_LOG_FILE` env var

## App Runner
- Detects npm apps (package.json) and .NET apps (*.csproj)
- npm: runs `dev` > `start` > `serve` > `preview` scripts
- .NET: runs `dotnet watch --non-interactive` with hot reload
- Process tree termination on Windows (`taskkill /T /F`)
- URL detection from stdout with 30-second timeout
- Proxy-based iframe display with navigation tracking and script injection

## Testing
- **Test Framework**: Vitest + React Testing Library
- **Test Command**: `npm run testonly` (excludes integration tests by default)
- **Coverage**: 159+ tests across 25 test suites
- **CI/CD**: Automated testing on all platforms via GitHub Actions
