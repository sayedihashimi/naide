# Copilot Instructions for Naide

## Project Overview

Naide (Not An IDE) is a desktop application prototype designed for non-professional developers to create and maintain applications using AI assistance. The project consists of two main components:

- **Frontend**: Tauri desktop app built with React 19, TypeScript, and Vite
- **Sidecar**: Node.js service providing Copilot SDK integration

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Desktop Framework**: Tauri 2.x (Rust-based)
- **Build Tool**: Vite with React SWC plugin
- **Styling**: Tailwind CSS 4.x
- **Routing**: React Router DOM 7.x
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint 9.x with TypeScript ESLint
- **Sidecar**: Node.js 18+ with Express and GitHub Copilot SDK
- **Communication**: HTTP API on localhost:3001

## Coding Standards

### TypeScript
- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use type inference where appropriate
- Define interfaces for complex data structures
- Use `interface` for public API types

### React
- Use functional components with hooks
- Prefer named exports for components
- Use React 19 features and best practices
- Keep components small and focused
- Use proper React hooks dependency arrays

### Code Style
- Use modern ES6+ syntax
- Prefer arrow functions for callbacks
- Use async/await over raw promises
- Use descriptive variable and function names
- Keep functions small and single-purpose

### File Organization
- Components in appropriate directories under `src/`
- Keep related files together
- Use index files for clean exports when appropriate
- Separate business logic from UI components

## Testing Guidelines

- Write tests using Vitest and React Testing Library
- Test components in isolation when possible
- Use `@testing-library/jest-dom` matchers
- Test user interactions, not implementation details
- Run tests with `npm test` in the `src/naide-desktop` directory

## Building and Running

### Development
```bash
# From src/naide-desktop
npm install
npm run tauri:dev  # This automatically builds the sidecar
```

### Sidecar Development (Optional)
```bash
# From src/copilot-sidecar
npm install
npm run dev
```

### Building
```bash
# From src/naide-desktop
npm run tauri:build  # This automatically builds the sidecar
```

### Testing
```bash
# From src/naide-desktop
npm test           # Run tests in watch mode
npm run testonly   # Run tests once
```

### Linting
```bash
# From src/naide-desktop
npm run lint
```

## Project Structure

```
/
├── .github/              # GitHub configuration
├── .naide/
│   └── learnings/       # Project memory (runtime-created)
├── .prompts/
│   ├── features/        # Feature specifications
│   ├── plan/           # Planning documents
│   └── system/         # System prompts for AI
├── src/
│   ├── naide-desktop/  # Tauri React app
│   │   ├── src/        # React source code
│   │   └── src-tauri/  # Rust/Tauri backend
│   └── copilot-sidecar/ # Node.js sidecar service
```

## Important Notes

- The sidecar is automatically built and started by the Tauri app
- The app uses GitHub Copilot CLI which must be installed and authenticated
- The frontend communicates with the sidecar via HTTP on port 3001
- `.prompts/` directory contains AI-specific prompts and specifications
- `.naide/learnings/` is created at runtime for project memory

## Application Modes

### Planning Mode
- AI-assisted planning and specification creation
- Updates files under `.prompts/plan/` and `.prompts/features/`
- Does not modify code

### Building Mode (Future)
- Will update both code and specifications
- Currently returns stub implementation

### Analyzing Mode (Future)
- Will analyze code and provide insights
- Currently returns stub implementation

## Dependencies

- Ensure Node.js 18+ is installed
- Rust and Tauri CLI must be available
- GitHub Copilot CLI must be installed and authenticated

## Common Tasks

- **Add a new React component**: Create in `src/naide-desktop/src/components/` with TypeScript
- **Modify sidecar API**: Update `src/copilot-sidecar/src/` TypeScript files
- **Update Tauri backend**: Modify Rust code in `src/naide-desktop/src-tauri/`
- **Add new feature spec**: Create markdown in `.prompts/features/`
- **Update planning docs**: Modify files in `.prompts/plan/`

## Do's and Don'ts

### Do:
- Use TypeScript for type safety
- Write tests for new functionality
- Keep the sidecar build automated (don't require manual steps)
- Use existing React 19 patterns and hooks
- Follow the established project structure
- Update relevant documentation when making changes

### Don't:
- Don't use `any` type unless absolutely necessary
- Don't create components without proper TypeScript interfaces
- Don't modify the automatic sidecar build process
- Don't add dependencies without considering bundle size
- Don't bypass ESLint rules without good reason
- Don't modify `.naide/learnings/` manually (it's runtime-created)
