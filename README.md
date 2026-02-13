# Naide (Not An IDE)

A desktop application prototype for non-professional developers to create and maintain applications using AI assistance.

## Overview

Naide is a Tauri-based desktop app that provides an AI-powered environment for building applications without requiring extensive programming knowledge. It leverages GitHub Copilot to assist users through planning, building, and analyzing their projects.

## Features

- **AI-Assisted Planning**: Interactive planning mode with guided specification creation
- **Multi-Mode Interface**: Switch between Planning, Building, and Analyzing modes
- **Chat Interface**: Natural conversation with AI to develop your application
- **Project Management**: Create, load, and switch between projects seamlessly
- **File Persistence**: Automatic saving of plans, specifications, and chat history
- **Markdown Support**: Full markdown rendering with code blocks, tables, and links
- **Project File Links**: Click links in chat to open project files directly in the editor

## Architecture

### Components

- **Frontend**: Tauri desktop app built with React 19, TypeScript, and Vite
- **Sidecar**: Node.js service providing GitHub Copilot SDK integration
- **Communication**: HTTP API on `localhost:3001`

### Project Structure

```
/
├── .prompts/              # AI prompts and specifications
│   ├── features/          # Feature specifications
│   ├── plan/             # Planning documents
│   └── system/           # System prompts for AI
├── .naide/
│   └── learnings/        # Project memory (runtime-created)
├── src/
│   ├── naide-desktop/    # Tauri React app
│   │   ├── src/          # React source code
│   │   └── src-tauri/    # Rust/Tauri backend
│   └── copilot-sidecar/  # Node.js sidecar service
└── README.md             # This file
```

## Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node.js)
- **Rust** and Tauri CLI
- **GitHub Copilot CLI** (required for AI features)
  - Install: Follow instructions at https://github.com/github/gh-copilot
  - Authenticate: Run `copilot` then `/login`

## Getting Started

### Installation

```bash
# Navigate to the desktop app directory
cd src/naide-desktop

# Install dependencies
npm install
```

**⚠️ Important**: Always run `npm install` after pulling changes, as new dependencies may have been added.

### Running the Application

The sidecar is automatically built and started when you run the Tauri app:

```bash
# Development mode (from src/naide-desktop)
npm run tauri:dev
```

The app will:
1. Build the sidecar automatically
2. Start the Tauri app
3. Launch the sidecar in the background

**Note**: File watching is disabled by default (`--no-watch` flag). This allows you to use Naide to modify its own code without triggering automatic reloads.

### Building for Production

```bash
# Build the application (from src/naide-desktop)
npm run tauri:build
```

This automatically builds the sidecar and creates a production-ready application bundle.

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run testonly

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Usage

### Planning Mode

- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/` and `.prompts/features/`
- Does not modify code
- Interactive guided Q&A to define your application

### Building Mode

*Coming soon* - Will update both code and specifications

### Analyzing Mode

*Coming soon* - Will analyze code and provide insights

## Documentation

- [Desktop App README](src/naide-desktop/README.md) - Detailed setup and development info
- [Desktop App Troubleshooting](src/naide-desktop/TROUBLESHOOTING.md) - Common issues and solutions
- [Project Overview](.prompts/naide-prototype.overview.md) - Prototype specifications
- [Testing Documentation](.prompts/tech/testing.md) - Testing infrastructure details

## Development

### Optional: Manual Sidecar Development

If you want to run the sidecar separately for development:

```bash
# From src/copilot-sidecar
npm install
npm run dev
```

The sidecar will run on `http://localhost:3001`.

Then start the Tauri app normally from `src/naide-desktop`:

```bash
npm run tauri:dev
```

### Linting

```bash
# From src/naide-desktop
npm run lint
```

## Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Desktop Framework**: Tauri 2.x (Rust-based)
- **Build Tool**: Vite with rolldown-vite and React SWC plugin
- **Styling**: Tailwind CSS 4.x
- **Routing**: React Router DOM 7.x
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint 9.x with TypeScript ESLint
- **Sidecar**: Node.js 18+ with Express and GitHub Copilot SDK

## License

Copyright (c) 2026 Sayed Ibrahim Hashimi. All rights reserved.

This software is proprietary and confidential. See [LICENSE](LICENSE) for full details.

## Contributing

This is a prototype project. Please refer to the issue tracker for planned features and known issues.
