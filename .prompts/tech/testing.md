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
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report

## Current Status

**Note**: The test infrastructure has been set up with comprehensive test cases,  but currently has compatibility issues with the `rolldown-vite` bundler used in this project. The tests are fully written and ready to run once the compatibility issue is resolved. This is a known limitation of using rolldown-vite (an experimental Rust-based Vite implementation) instead of standard Vite.

### Resolution Options:
1. Wait for rolldown-vite to improve test compatibility
2. Use standard Vite for the project instead of rolldown-vite
3. Configure a separate Vite installation specifically for testing

The test files themselves are complete and follow best practices for React testing.

## Test Structure

### Test Files Location
Tests are colocated with source files using the `.test.tsx` or `.test.ts` naming convention:
- `src/components/Modal.test.tsx` - Modal component tests
- `src/pages/Screen1.test.tsx` - Screen 1 page tests
- `src/pages/PlanningMode.test.tsx` - Planning Mode tests
- `src/utils/fileSystem.test.ts` - File system utility tests
- `src/test/integration.test.tsx` - Integration tests

### Test Setup
- `src/test/setup.ts` - Global test setup and Tauri API mocks
- `vitest.config.ts` - Vitest configuration

## Test Coverage

Tests cover the following requirements from the prototype specification:

### Screen 1 (Intent Capture)
- ✓ Branding and UI rendering
- ✓ 5 quick start chips with text insertion
- ✓ Continue button (always enabled)
- ✓ Modal on empty continue
- ✓ Navigation to Planning Mode
- ✓ Textarea controls (AI assist, expand/collapse)
- ✓ Keyboard navigation and accessibility

### Planning Mode
- ✓ Section navigation (Overview, Features, Data, etc.)
- ✓ Code section with file mappings
- ✓ Plan dirty state management
- ✓ Update plan and Generate App buttons
- ✓ Project name in title bar
- ✓ Textarea controls in Q&A sections

### Components
- ✓ Modal accessibility (focus trap, escape key, backdrop click)
- ✓ Modal dialog semantics (role, aria attributes)

### File Persistence
- ✓ Config loading and saving
- ✓ Project file operations (mocked in tests)

### Integration Tests
- ✓ End-to-end user flows
- ✓ Navigation between screens
- ✓ Chip insertion and continue workflow
- ✓ Accessibility features (keyboard navigation)

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

Once the rolldown-vite compatibility is resolved, tests should be run:
- Before committing code
- In CI/CD pipelines
- Before merging pull requests

The test suite is designed to be fast and reliable for development workflows.

## Notes

- Tests use `jsdom` for DOM implementation
- Tauri desktop environment is not required to run tests
- Tests focus on user behavior and requirements, not implementation details
- All tests are written in TypeScript for type safety
- Test infrastructure is complete but awaiting rolldown-vite compatibility fix
