# Naide (Not An IDE)

Spec-driven AI development tools for developers of all experience levels.

## Overview

Naide provides AI-powered environments for building applications using GitHub Copilot. Two versions are available:

- **Desktop App**: A Tauri-based application for non-professional developers
- **VS Code Extension**: A native extension for professional developers using VS Code

Both share the same spec-driven workflow using `.prompts/` directories but target different audiences with appropriate interfaces.

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
│   ├── naide-desktop/    # Tauri React app (for non-professional developers)
│   │   ├── src/          # React source code
│   │   └── src-tauri/    # Rust/Tauri backend
│   ├── naide-vscode/     # VS Code extension (for professional developers)
│   │   ├── src/          # TypeScript source code
│   │   └── dist/         # Compiled extension
│   └── copilot-sidecar/  # Node.js sidecar service (desktop app only)
└── README.md             # This file
```

## Which Version to Use?

### Desktop App (Naide Desktop)
**Best for**: Non-professional developers, beginners, visual learners

- Custom 3-column interface
- Built-in file viewer and editor
- Guided planning with Q&A
- Application preview iframe
- No VS Code required

**Get started**: See [Desktop App README](src/naide-desktop/README.md)

### VS Code Extension (Naide for VS Code)
**Best for**: Professional developers, VS Code users

- Native Copilot Chat integration
- Uses VS Code's editor, file explorer, terminal
- Slash commands: `/plan`, `/build`, `/analyze`
- Lightweight (16 KB)
- GitHub Copilot subscription required

**Get started**: See [VS Code Extension README](src/naide-vscode/README.md)

## Architecture

### Desktop App Components

- **Frontend**: Tauri desktop app built with React 19, TypeScript, and Vite
- **Sidecar**: Node.js service providing GitHub Copilot SDK integration
- **Communication**: HTTP API on `localhost:3001`

### VS Code Extension Components

- **Chat Participant**: Registers `@naide` in Copilot Chat
- **Prompt Loader**: Reads system prompts, specs, and features from workspace
- **Learnings Tool**: `search_learnings` language model tool
- **VS Code Integration**: Uses native Language Model API

## Prerequisites

### Desktop App
- **Node.js** 18 or later
- **npm** (comes with Node.js)
- **Rust** and Tauri CLI
- **GitHub Copilot CLI** (required for AI features)
  - Install: Follow instructions at https://github.com/github/gh-copilot
  - Authenticate: Run `copilot` then `/login`

### VS Code Extension
- **VS Code** 1.99.0 or later
- **GitHub Copilot extension** (with active subscription)
- **Node.js** 18+ (for development only)

## Getting Started

### Desktop App Installation

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

- **Desktop App**:
  - [Desktop App README](src/naide-desktop/README.md) - Detailed setup and development info
  - [Desktop App Troubleshooting](src/naide-desktop/TROUBLESHOOTING.md) - Common issues and solutions
- **VS Code Extension**:
  - [VS Code Extension README](src/naide-vscode/README.md) - User guide
  - [VS Code Extension Installation](src/naide-vscode/INSTALL.md) - Setup instructions
  - [Implementation Details](src/naide-vscode/IMPLEMENTATION.md) - Technical documentation
- **Project Documentation**:
  - [Project Overview](.prompts/naide-prototype.overview.md) - Prototype specifications
  - [Testing Documentation](.prompts/tech/testing.md) - Testing infrastructure details
  - [Feature Specifications](.prompts/features/) - All feature specs

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

### Desktop App
- **Frontend Framework**: React 19 with TypeScript
- **Desktop Framework**: Tauri 2.x (Rust-based)
- **Build Tool**: Vite with rolldown-vite and React SWC plugin
- **Styling**: Tailwind CSS 4.x
- **Routing**: React Router DOM 7.x
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint 9.x with TypeScript ESLint
- **Sidecar**: Node.js 18+ with Express and GitHub Copilot SDK

### VS Code Extension
- **Language**: TypeScript with strict mode
- **VS Code API**: Language Model API, Chat Participant API
- **Build Tool**: TypeScript compiler
- **Linting**: ESLint 9.x with TypeScript ESLint
- **Package Size**: 15.91 KB

## License

Copyright (c) 2026 Sayed Ibrahim Hashimi. All rights reserved.

This software is proprietary and confidential. See [LICENSE](LICENSE) for full details.

## Contributing

This is a prototype project. Please refer to the issue tracker for planned features and known issues.
