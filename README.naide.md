# Naide (Not An IDE) — Prototype

This repo contains a prototype of **Naide**, a desktop app for non‑pro developers to create and maintain apps using AI.

## What this prototype includes
- Screen 1: Intent Capture (chips, textarea, Continue modal behavior)
- Planning Mode shell: section-based guided Q&A layout with a dirty-state footer:
  - "Plan is out of date → Rebuild Plan"
- Navigation: Screen 1 → Planning Mode with initial intent text prefilled
- **NEW**: Copilot SDK integration via Node.js sidecar
  - Planning mode with AI-assisted specification creation
  - Building and Analyzing modes (stub implementations)
  - Learnings capture system

## Architecture

### Components
- **Frontend**: Tauri app with React + Vite (`src/naide-desktop`)
- **Sidecar**: Node.js service for Copilot SDK integration (`src/copilot-sidecar`)

### Communication
The frontend communicates with the sidecar via HTTP API on `localhost:3001`.

## Prerequisites

- Node.js 18+
- Rust and Tauri CLI
- GitHub Copilot CLI (install and authenticate before using)
  - Install: Follow instructions at https://github.com/github/gh-copilot
  - Authenticate: Run `copilot` then `/login`

## How to run

### 1. Start the sidecar

From `src/copilot-sidecar`:

```sh
npm install
npm run dev
```

The sidecar will run on `http://localhost:3001`.

### 2. Start the Tauri app

From `src/naide-desktop`:

```sh
npm install
npm run tauri:dev
```

## How to build

### Build the sidecar
From `src/copilot-sidecar`:

```sh
npm run build
```

### Build the Tauri app
From `src/naide-desktop`:

```sh
npm run tauri:build
```

## Project Structure

```
/
├── .prompts/
│   ├── features/          # Feature specifications
│   ├── plan/             # Planning documents
│   └── system/           # System prompts for AI
├── .naide/
│   └── learnings/        # Project memory (created at runtime)
├── src/
│   ├── naide-desktop/    # Tauri React app
│   └── copilot-sidecar/  # Node.js sidecar service
└── README.naide.md       # This file
```

## Modes

### Planning Mode
- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/**` and `.prompts/features/**`
- Does not modify code

### Building Mode (Coming Soon)
- Will update both code and specs
- Currently returns "Building coming soon"

### Analyzing Mode (Coming Soon)
- Will analyze code and provide insights
- Currently returns "Analyzing coming soon"

## Next steps
- Complete Copilot SDK integration (currently using placeholder)
- Implement Building mode functionality
- Implement Analyzing mode functionality
- Add automatic learnings capture on corrections
