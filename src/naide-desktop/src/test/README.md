# Test Suite for Naide Desktop

This directory contains the testing infrastructure and integration tests for the Naide desktop application.

## Test Files Created

### Component Tests
- **`../components/Modal.test.tsx`** - Tests for the Modal component
  - Modal rendering and visibility
  - Accessibility attributes (aria-modal, role="dialog")
  - User interactions (OK button, backdrop click, Escape key)
  - Focus trap behavior

- **`../components/MessageContent.test.tsx`** - Tests for message rendering
  - Markdown rendering in messages
  - Code block syntax highlighting
  - Link handling

### Page Tests
- **`../pages/GenerateAppScreen.test.tsx`** - Tests for Generate App Screen
  - 3-column layout rendering
  - Mode selector (Planning/Building/Analyzing)
  - Chat interface
  - Message sending and receiving
  - Textarea controls (expand/collapse)
  - Keyboard shortcuts (Ctrl+Enter)
  - Markdown rendering in messages

### Utility Tests
- **`../utils/fileSystem.test.ts`** - Tests for file system utilities
  - Config loading and saving
  - Path resolution
  - Error handling
  - Tauri API mocking

## Test Setup

### Configuration Files
- **`setup.ts`** - Global test setup
  - Imports @testing-library/jest-dom matchers
  - Mocks Tauri APIs (fs, dialog, core)
  - Configures ResizeObserver mock
  - Sets up cleanup between tests

- **`../vitest.config.ts`** - Vitest configuration
  - Environment: jsdom
  - Setup files reference
  - Coverage configuration
  - Path aliases

## Test Coverage

The test suite covers:

### Generate App Screen (Single Chat Interface)
✓ 3-column layout (navigation, chat, preview)
✓ Mode selector dropdown (Planning/Building/Analyzing)
✓ Chat message rendering
✓ Markdown support in messages
✓ Message input with expand/collapse
✓ Send button and keyboard shortcuts
✓ Welcome messages per mode
✓ Stub responses for Building/Analyzing modes

### Technical Requirements
✓ Modal accessibility (focus trap, Escape key)
✓ Keyboard navigation
✓ State management
✓ Single route (`/`)
✓ Chat persistence

## Mocked Dependencies

The following Tauri APIs are mocked for testing:

```typescript
// Core Tauri functions
@tauri-apps/api/core
  - invoke()

// File system dialogs
@tauri-apps/plugin-dialog
  - open()

// File system operations
@tauri-apps/plugin-fs
  - exists()
  - readTextFile()
  - writeTextFile()
  - mkdir()
  - readDir()

// Path utilities
@tauri-apps/api/path
  - documentDir()
  - join()
```

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run testonly

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Current Status

All tests pass successfully. The application has been simplified to a single chat-driven interface.

## Writing New Tests

When adding new components or features:

1. Create a `.test.tsx` file next to the component
2. Import testing utilities from `@testing-library/react`
3. Mock Tauri APIs as needed
4. Test from the user's perspective
5. Include accessibility tests

Example:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Result')).toBeInTheDocument()
  })
})
```
