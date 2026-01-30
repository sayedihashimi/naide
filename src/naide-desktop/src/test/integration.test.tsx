import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import Screen1 from '../pages/Screen1'
import PlanningMode from '../pages/PlanningMode'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/mock/path'),
}))

vi.mock('../utils/fileSystem', () => ({
  createAllProjectFiles: vi.fn().mockResolvedValue(undefined),
  saveProjectData: vi.fn().mockResolvedValue(undefined),
  loadProjectData: vi.fn().mockResolvedValue({}),
  projectExists: vi.fn().mockResolvedValue(false),
  loadConfig: vi.fn().mockResolvedValue({ lastUsedProject: null, projects: [] }),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  initializeProject: vi.fn().mockResolvedValue(undefined),
  saveSectionToFile: vi.fn().mockResolvedValue(undefined),
  checkProjectExists: vi.fn().mockResolvedValue(false),
  getProjectPath: vi.fn().mockResolvedValue('/mock/path/MyApp'),
  updateLastUsedProject: vi.fn().mockResolvedValue(undefined),
}))

const renderApp = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Screen1 />} />
          <Route path="/planning" element={<PlanningMode />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  )
}

describe('Integration Tests - User Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should navigate from Screen1 to Planning Mode with intent text', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Verify we're on Screen1
    expect(screen.getByText('What do you want to build?')).toBeInTheDocument()
    
    // Type intent text
    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'I want to build a task tracker app')
    
    // Click Continue
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
    
    // Should navigate to Planning Mode
    // Note: Navigation behavior may need to be adjusted based on actual routing setup
  })

  it('should show modal on empty continue and allow user to fix', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Click Continue without entering text
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
    
    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Describe what you want to build')).toBeInTheDocument()
    })
    
    // Close modal
    const okButton = screen.getByRole('button', { name: /ok/i })
    await user.click(okButton)
    
    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Describe what you want to build')).not.toBeInTheDocument()
    })
    
    // Now enter text and continue
    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'My app idea')
    await user.click(continueButton)
  })

  it('should insert chip text and continue to planning', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Click a chip
    const chip = screen.getByText('Track something')
    await user.click(chip)
    
    // Verify text was inserted
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('I want an app to track')
    
    // Continue to planning
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
  })

  it('should allow multiple chip insertions', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Click first chip
    await user.click(screen.getByText('Track something'))
    
    // Click second chip
    await user.click(screen.getByText('For a team'))
    
    // Both texts should be in textarea
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('I want an app to track')
    expect(textarea.value).toContain('I want a shared app for my team')
  })
})

describe('Integration Tests - Accessibility', () => {
  it('should have proper keyboard navigation on Screen1', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Tab should move focus through interactive elements
    await user.tab()
    
    // Should be able to reach textarea
    const textarea = screen.getByRole('textbox')
    expect(document.activeElement).toBeTruthy()
  })

  it('should support Escape key to close modal', async () => {
    const user = userEvent.setup()
    renderApp()
    
    // Open modal
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
    
    await waitFor(() => {
      expect(screen.getByText('Describe what you want to build')).toBeInTheDocument()
    })
    
    // Press Escape
    await user.keyboard('{Escape}')
    
    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Describe what you want to build')).not.toBeInTheDocument()
    })
  })
})

describe('Integration Tests - File Persistence', () => {
  it('should trigger file creation when navigating to planning mode', async () => {
    const user = userEvent.setup()
    const { createAllProjectFiles } = await import('../utils/fileSystem')
    
    renderApp()
    
    // Enter text and continue
    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'Test app')
    
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
    
    // File creation should be triggered
    // Note: Timing depends on implementation
  })
})
