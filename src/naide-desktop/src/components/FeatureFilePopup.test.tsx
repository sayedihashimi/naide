import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeatureFilePopup from './FeatureFilePopup'
import * as featureFiles from '../utils/featureFiles'

// Mock the featureFiles module
vi.mock('../utils/featureFiles', () => ({
  readFeatureFile: vi.fn(),
  writeFeatureFile: vi.fn(),
}))

describe('FeatureFilePopup', () => {
  const mockReadFeatureFile = vi.mocked(featureFiles.readFeatureFile)
  const mockWriteFeatureFile = vi.mocked(featureFiles.writeFeatureFile)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <FeatureFilePopup
        isOpen={false}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )
    expect(screen.queryByText('test.md')).not.toBeInTheDocument()
  })

  it('should load and display file content when opened', async () => {
    const mockContent = '# Test Content\n\nThis is a test.'
    mockReadFeatureFile.mockResolvedValue(mockContent)

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(mockReadFeatureFile).toHaveBeenCalledWith('/test/project', 'test.md')
    })

    // Title should be present
    expect(screen.getAllByText('test.md').length).toBeGreaterThan(0)
  })

  it('should display error when file fails to load', async () => {
    mockReadFeatureFile.mockRejectedValue(new Error('File not found'))

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load file content')).toBeInTheDocument()
    })
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockReadFeatureFile.mockResolvedValue('# Test')

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={onClose}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(mockReadFeatureFile).toHaveBeenCalled()
    })

    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should switch to edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()
    const mockContent = '# Test Content'
    mockReadFeatureFile.mockResolvedValue(mockContent)

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(mockReadFeatureFile).toHaveBeenCalled()
    })

    // Wait for content to load
    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit file/i })
      expect(editButton).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit file/i })
    await user.click(editButton)

    // Should now be in edit mode with textarea
    const textarea = screen.getByPlaceholderText(/enter markdown content/i)
    expect(textarea).toBeInTheDocument()
    expect(screen.getByText('Editing')).toBeInTheDocument()
  })

  it('should save changes when save button is clicked in edit mode', async () => {
    const user = userEvent.setup()
    const mockContent = '# Test Content'
    mockReadFeatureFile.mockResolvedValue(mockContent)
    mockWriteFeatureFile.mockResolvedValue()

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(mockReadFeatureFile).toHaveBeenCalled()
    })

    // Enter edit mode
    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit file/i })
      expect(editButton).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit file/i })
    await user.click(editButton)

    // Edit content
    const textarea = screen.getByPlaceholderText(/enter markdown content/i)
    await user.clear(textarea)
    await user.type(textarea, '# Updated Content')

    // Save
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockWriteFeatureFile).toHaveBeenCalledWith(
        '/test/project',
        'test.md',
        '# Updated Content'
      )
    })
  })

  it('should cancel edit mode when cancel button is clicked', async () => {
    const user = userEvent.setup()
    const mockContent = '# Test Content'
    mockReadFeatureFile.mockResolvedValue(mockContent)

    // Mock window.confirm to return true
    global.confirm = vi.fn(() => true)

    render(
      <FeatureFilePopup
        isOpen={true}
        onClose={vi.fn()}
        filePath="test.md"
        fileName="test.md"
        projectPath="/test/project"
      />
    )

    await waitFor(() => {
      expect(mockReadFeatureFile).toHaveBeenCalled()
    })

    // Enter edit mode
    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit file/i })
      expect(editButton).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit file/i })
    await user.click(editButton)

    // Edit content
    const textarea = screen.getByPlaceholderText(/enter markdown content/i)
    await user.clear(textarea)
    await user.type(textarea, '# Changed')

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // Should ask for confirmation
    expect(global.confirm).toHaveBeenCalled()

    // Should exit edit mode
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/enter markdown content/i)).not.toBeInTheDocument()
    })
  })
})
