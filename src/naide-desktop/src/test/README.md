# Test Suite for Naide Desktop

This directory contains the testing infrastructure and integration tests for the Naide desktop application.

## Test Files Created

### Component Tests
- **`../components/Modal.test.tsx`** - Tests for the Modal component
  - Modal rendering and visibility
  - Accessibility attributes (aria-modal, role="dialog")
  - User interactions (OK button, backdrop click, Escape key)
  - Focus trap behavior

### Page Tests
- **`../pages/Screen1.test.tsx`** - Tests for Screen 1 (Intent Capture)
  - Branding and UI rendering
  - 5 quick start chips with text insertion
  - Continue button behavior (always enabled)
  - Modal display on empty continue
  - Navigation to Planning Mode
  - Textarea controls (AI assist, expand/collapse)
  - User input handling

- **`../pages/PlanningMode.test.tsx`** - Tests for Planning Mode
  - Section navigation (Overview, Features, Data, etc.)
  - Code section rendering
  - Update plan and Generate App buttons
  - Project name display
  - Section switching behavior
  - Plan dirty state management

### Utility Tests
- **`../utils/fileSystem.test.ts`** - Tests for file system utilities
  - Config loading and saving
  - Path resolution
  - Error handling
  - Tauri API mocking

### Integration Tests
- **`integration.test.tsx`** - End-to-end user flow tests
  - Screen 1 to Planning Mode navigation
  - Chip insertion workflow
  - Modal interaction and recovery
  - Multiple chip insertions
  - Keyboard navigation and accessibility
  - File persistence triggers

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

The test suite covers all major requirements from `.prompts/`:

### Screen 1 Requirements (from `.prompts/ui/screen-1.intent-capture.md`)
✓ Branding ("Naide" only, no subtitle)
✓ 5 chips with starter prompts
✓ Chip insertion behavior (empty vs. existing content)
✓ Continue button (always enabled)
✓ Modal on empty continue
✓ Modal accessibility (focus trap, Escape key)
✓ Navigation to Planning Mode

### Planning Mode Requirements (from `.prompts/ui/planning-mode.shell.md`)
✓ Section navigation
✓ Code section with file mappings
✓ Plan dirty state tracking
✓ Update plan functionality
✓ Generate App button (stub)
✓ Project name in title bar
✓ Textarea controls in Q&A sections

### Technical Requirements (from `.prompts/tech/desktop-setup.md`)
✓ Modal accessibility (focus trap, Escape key)
✓ Keyboard navigation
✓ State management
✓ Routing (`/` and `/planning`)

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
npm test -- --run

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Current Status

**Note**: Tests are fully written but currently have compatibility issues with rolldown-vite. See `.prompts/tech/testing.md` for details and resolution options.

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
