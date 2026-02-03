import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DraggableModal from './DraggableModal'

describe('DraggableModal', () => {
  it('should not render when isOpen is false', () => {
    render(
      <DraggableModal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(
      <DraggableModal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <DraggableModal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <DraggableModal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    // Click the backdrop (first div with fixed positioning)
    const backdrop = document.querySelector('.fixed.inset-0')
    if (backdrop) {
      await user.click(backdrop as HTMLElement)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should call onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <DraggableModal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should use default dimensions', () => {
    render(
      <DraggableModal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Test content</p>
      </DraggableModal>
    )
    const modal = document.querySelector('.fixed.z-50') as HTMLElement
    expect(modal?.style.width).toBe('800px')
    expect(modal?.style.height).toBe('600px')
  })

  it('should use custom initial dimensions', () => {
    render(
      <DraggableModal 
        isOpen={true} 
        onClose={vi.fn()} 
        title="Test Modal"
        initialWidth={1000}
        initialHeight={700}
      >
        <p>Test content</p>
      </DraggableModal>
    )
    const modal = document.querySelector('.fixed.z-50') as HTMLElement
    expect(modal?.style.width).toBe('1000px')
    expect(modal?.style.height).toBe('700px')
  })
})
