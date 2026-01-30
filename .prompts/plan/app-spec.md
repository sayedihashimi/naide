# App Specification

## Overview
Naide is a Tauri desktop application with a React + Vite frontend that helps non-professional developers create and maintain applications using AI assistance.

## Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Sidecar**: Node.js + TypeScript service for Copilot SDK integration
- **Communication**: HTTP API between frontend and sidecar (localhost:3001)

## Core Features

### 1. Planning Mode
- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/**` and `.prompts/features/**`
- Reads and applies learnings from `.naide/learnings/**`
- Does not modify code files

### 2. Building Mode (Stub)
- Returns "Building coming soon" message
- Will eventually update code and specs

### 3. Analyzing Mode (Stub)
- Returns "Analyzing coming soon" message
- Will eventually analyze code and provide insights

## User Interface

### Generate App Screen
- **Left Panel**: Navigation sidebar
- **Center Panel**: Chat interface with mode selector
- **Right Panel**: Running app preview (not yet functional)

### Mode Selector
Dropdown with three options:
- Planning (Create/update specs only)
- Building (Update code and specs)
- Analyzing (Coming soon)

## Data Flow
1. User types message in chat
2. Frontend calls sidecar API at `/api/copilot/chat`
3. Sidecar loads system prompts and learnings
4. Sidecar calls Copilot SDK (or returns stub for Building/Analyzing)
5. Response displayed in chat
6. Files updated as needed (Planning mode only)
