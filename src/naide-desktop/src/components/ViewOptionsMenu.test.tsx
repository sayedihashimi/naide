import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ViewOptionsMenu from './ViewOptionsMenu';
import type { ViewOptions } from '../utils/featureFiles';

describe('ViewOptionsMenu', () => {
  const defaultOptions: ViewOptions = {
    show_bugs: false,
    show_removed: false,
    show_raw: false,
  };

  it('renders all three checkbox options', () => {
    const mockOnChange = vi.fn();
    const mockOnClose = vi.fn();
    
    render(
      <ViewOptionsMenu
        options={defaultOptions}
        onChange={mockOnChange}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Show bugs')).toBeInTheDocument();
    expect(screen.getByText('Show removed features')).toBeInTheDocument();
    expect(screen.getByText('Show raw filenames')).toBeInTheDocument();
  });

  it('shows correct initial checkbox states', () => {
    const mockOnChange = vi.fn();
    const mockOnClose = vi.fn();
    const options: ViewOptions = {
      show_bugs: true,
      show_removed: false,
      show_raw: true,
    };
    
    render(
      <ViewOptionsMenu
        options={options}
        onChange={mockOnChange}
        onClose={mockOnClose}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // show_bugs
    expect(checkboxes[1]).not.toBeChecked(); // show_removed
    expect(checkboxes[2]).toBeChecked(); // show_raw
  });

  it('calls onChange when checkbox is clicked', () => {
    const mockOnChange = vi.fn();
    const mockOnClose = vi.fn();
    
    render(
      <ViewOptionsMenu
        options={defaultOptions}
        onChange={mockOnChange}
        onClose={mockOnClose}
      />
    );

    const bugsCheckbox = screen.getByLabelText(/Show bugs/i);
    fireEvent.click(bugsCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith({
      show_bugs: true,
      show_removed: false,
      show_raw: false,
    });
  });

  it('closes menu when clicking outside', () => {
    const mockOnChange = vi.fn();
    const mockOnClose = vi.fn();
    
    render(
      <div>
        <ViewOptionsMenu
          options={defaultOptions}
          onChange={mockOnChange}
          onClose={mockOnClose}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    const outsideElement = screen.getByTestId('outside');
    fireEvent.mouseDown(outsideElement);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close menu when clicking inside', () => {
    const mockOnChange = vi.fn();
    const mockOnClose = vi.fn();
    
    render(
      <ViewOptionsMenu
        options={defaultOptions}
        onChange={mockOnChange}
        onClose={mockOnClose}
      />
    );

    const menuLabel = screen.getByText('Show bugs');
    fireEvent.mouseDown(menuLabel);

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
