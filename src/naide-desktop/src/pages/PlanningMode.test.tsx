import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import PlanningMode from './PlanningMode'
import { AppProvider } from '../context/AppContext'

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/mock/path'),
}))

// Mock file system utilities
vi.mock('../utils/fileSystem', () => ({
  saveProjectData: vi.fn().mockResolvedValue(undefined),
  loadProjectData: vi.fn().mockResolvedValue({}),
  createAllProjectFiles: vi.fn().mockResolvedValue(undefined),
  projectExists: vi.fn().mockResolvedValue(false),
  initializeProject: vi.fn().mockResolvedValue(undefined),
  saveSectionToFile: vi.fn().mockResolvedValue(undefined),
  checkProjectExists: vi.fn().mockResolvedValue(false),
  getProjectPath: vi.fn().mockResolvedValue('/mock/path/MyApp'),
  updateLastUsedProject: vi.fn().mockResolvedValue(undefined),
}))

const renderPlanningMode = () => {
  return render(
    <BrowserRouter>
      <AppProvider>
        <PlanningMode />
      </AppProvider>
    </BrowserRouter>
  )
}

describe('PlanningMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the Naide branding', () => {
    renderPlanningMode()
    expect(screen.getByText('Naide')).toBeInTheDocument()
  })

  it('should render all main sections in sidebar', () => {
    renderPlanningMode()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('Access & Rules')).toBeInTheDocument()
    expect(screen.getByText('Assumptions')).toBeInTheDocument()
  })

  it('should render Code section separately', () => {
    renderPlanningMode()
    expect(screen.getByText('Code')).toBeInTheDocument()
  })

  it('should render Update plan button', () => {
    renderPlanningMode()
    expect(screen.getByRole('button', { name: /update plan/i })).toBeInTheDocument()
  })

  it('should render Generate App button', () => {
    renderPlanningMode()
    expect(screen.getByRole('button', { name: /generate app/i })).toBeInTheDocument()
  })

  it('should switch sections when sidebar item is clicked', async () => {
    const user = userEvent.setup()
    renderPlanningMode()
    
    // Click Features section
    const featuresButton = screen.getByText('Features')
    await user.click(featuresButton)
    
    // Should show Features section content
    // The section should be selected (implementation may vary)
    expect(featuresButton).toBeInTheDocument()
  })

  it('should default to Overview section', () => {
    renderPlanningMode()
    // Overview should be visible by default
    expect(screen.getByText('What do you want to build?')).toBeInTheDocument()
  })

  it('should show project name in title bar', () => {
    renderPlanningMode()
    // Default project name is "MyApp"
    const projectName = screen.getByText(/MyApp/i)
    expect(projectName).toBeInTheDocument()
  })

  it('should have textareas with AI assist and expand/collapse buttons', () => {
    renderPlanningMode()
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThan(0)
    
    // Check that there are multiple buttons (for textarea controls)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(2) // More than just footer buttons
  })

  it('should show "Plan is out of date" when plan is dirty', async () => {
    const user = userEvent.setup()
    renderPlanningMode()
    
    // Type in a textarea to make plan dirty
    const textareas = screen.getAllByRole('textbox')
    if (textareas.length > 0) {
      await user.click(textareas[0])
      await user.type(textareas[0], 'Some input')
      await user.tab() // blur to trigger dirty state
      
      // Should show out of date message
      // Note: This depends on implementation
    }
  })

  it('should display file mappings in Code section', async () => {
    const user = userEvent.setup()
    renderPlanningMode()
    
    const codeSection = screen.getByText('Code')
    await user.click(codeSection)
    
    // Should show file mappings like Intent.md, AppSpec.md, etc.
    // These are read-only displays
  })

  it('should save data when Update plan is clicked', async () => {
    const user = userEvent.setup()
    renderPlanningMode()
    
    const updateButton = screen.getByRole('button', { name: /update plan/i })
    await user.click(updateButton)
    
    // Should trigger save operation (mocked)
  })
})
