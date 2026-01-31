# Testing — Vitest + React Testing Library (Naide Desktop)

This document describes the testing infrastructure for the Naide desktop application.

## Testing Stack

The Naide desktop app uses:
- **Vitest** - Fast unit test framework (integrates seamlessly with Vite)
- **@testing-library/react** - React component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **@testing-library/jest-dom** - Custom DOM matchers
- **jsdom** - DOM implementation for tests

## Running Tests

Available test commands in `package.json`:
- `npm test` - Run tests in watch mode
- `npm run testonly` - Run tests once
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report

## Vite Configuration

The project uses two separate Vite configurations:
- **rolldown-vite** for development and production builds (`npm run dev`, `npm run build`)
- **Standard vite** for testing (`npm test`)

This dual setup allows us to benefit from rolldown-vite's performance in development while maintaining full test compatibility with Vitest.

## Test Structure

### Test Files Location
Tests are colocated with source files using the `.test.tsx` or `.test.ts` naming convention:
- `src/components/Modal.test.tsx` - Modal component tests
- `src/components/MessageContent.test.tsx` - Message rendering tests
- `src/pages/GenerateAppScreen.test.tsx` - Generate App screen tests
- `src/utils/fileSystem.test.ts` - File system utility tests

### Test Setup
- `src/test/setup.ts` - Global test setup and Tauri API mocks
- `vitest.config.ts` - Vitest configuration (uses standard Vite)
- `vite.config.ts` - Development configuration (uses rolldown-vite)

## Test Coverage

Tests cover the following requirements:

### Generate App Screen (Single Chat Interface)
- ✓ 3-column layout rendering (navigation, chat, preview)
- ✓ Mode selector dropdown (Planning/Building/Analyzing)
- ✓ Chat interface with message rendering
- ✓ Message input with expand/collapse
- ✓ Send button and keyboard shortcuts (Ctrl+Enter)
- ✓ Welcome messages per mode
- ✓ Stub responses for Building/Analyzing modes
- ✓ Markdown rendering in chat messages

### Components
- ✓ Modal accessibility (focus trap, escape key, backdrop click)
- ✓ Modal dialog semantics (role, aria attributes)
- ✓ Markdown content rendering
- ✓ Code block syntax highlighting

### File Persistence
- ✓ Config loading and saving
- ✓ Project file operations (mocked in tests)
- ✓ Chat session persistence

## Tauri API Mocking

Tauri APIs are mocked in `src/test/setup.ts`:
- `@tauri-apps/api/core` - Core Tauri functions
- `@tauri-apps/plugin-dialog` - File system dialogs
- `@tauri-apps/plugin-fs` - File system operations

This allows tests to run without a full Tauri environment.

## Writing New Tests

When adding new features, follow these guidelines:

1. **Unit tests**: Test individual components and functions in isolation
2. **Integration tests**: Test user flows across multiple components
3. **Accessibility**: Include tests for keyboard navigation and screen readers
4. **Mocking**: Mock Tauri APIs and file system operations
5. **User-centric**: Test from the user's perspective using Testing Library queries

Example test structure:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Updated Text')).toBeInTheDocument()
  })
})
```

## Continuous Integration

Tests should be run:
- Before committing code
- In CI/CD pipelines
- Before merging pull requests

The test suite is designed to be fast and reliable for development workflows.

## Current Status

All tests pass successfully (49 tests). The application has been simplified to use a single chat-driven interface.

## Notes

- Tests use `jsdom` for DOM implementation
- Tauri desktop environment is not required to run tests
- Tests focus on user behavior and requirements, not implementation details
- All tests are written in TypeScript for type safety
- Development uses rolldown-vite for performance; testing uses standard vite for compatibility
