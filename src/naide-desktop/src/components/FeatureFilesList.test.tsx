import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeatureFilesList from './FeatureFilesList';
import type { FeatureFileNode } from '../utils/featureFiles';

describe('FeatureFilesList', () => {
  const mockOnFileSelect = vi.fn();
  
  beforeEach(() => {
    mockOnFileSelect.mockClear();
  });
  
  it('renders empty state when no files', () => {
    render(
      <FeatureFilesList
        nodes={[]}
        onFileSelect={mockOnFileSelect}
        selectedPath={null}
      />
    );
    expect(screen.getByText('No feature files found')).toBeInTheDocument();
  });
  
  it('renders file list', () => {
    const files: FeatureFileNode[] = [
      {
        name: 'test-feature',
        full_name: '2026-02-01-test-feature.md',
        path: '2026-02-01-test-feature.md',
        date: '2026-02-01',
        is_folder: false,
        children: null,
      },
    ];
    
    render(
      <FeatureFilesList
        nodes={files}
        onFileSelect={mockOnFileSelect}
        selectedPath={null}
      />
    );
    
    expect(screen.getByText('test-feature')).toBeInTheDocument();
  });
  
  it('calls onFileSelect when file is clicked', async () => {
    const user = userEvent.setup();
    const files: FeatureFileNode[] = [
      {
        name: 'test-feature',
        full_name: '2026-02-01-test-feature.md',
        path: '2026-02-01-test-feature.md',
        date: '2026-02-01',
        is_folder: false,
        children: null,
      },
    ];
    
    render(
      <FeatureFilesList
        nodes={files}
        onFileSelect={mockOnFileSelect}
        selectedPath={null}
      />
    );
    
    const fileButton = screen.getByText('test-feature');
    await user.click(fileButton);
    
    expect(mockOnFileSelect).toHaveBeenCalledWith(files[0]);
  });
  
  it('renders folders with children', () => {
    const files: FeatureFileNode[] = [
      {
        name: 'bugs',
        full_name: 'bugs',
        path: 'bugs',
        date: null,
        is_folder: true,
        children: [
          {
            name: 'fix-issue',
            full_name: '2026-02-01-fix-issue.md',
            path: 'bugs/2026-02-01-fix-issue.md',
            date: '2026-02-01',
            is_folder: false,
            children: null,
          },
        ],
      },
    ];
    
    render(
      <FeatureFilesList
        nodes={files}
        onFileSelect={mockOnFileSelect}
        selectedPath={null}
      />
    );
    
    expect(screen.getByText('bugs')).toBeInTheDocument();
    // Children should not be visible initially (folder is collapsed)
    expect(screen.queryByText('fix-issue')).not.toBeInTheDocument();
  });
  
  it('expands folder when clicked', async () => {
    const user = userEvent.setup();
    const files: FeatureFileNode[] = [
      {
        name: 'bugs',
        full_name: 'bugs',
        path: 'bugs',
        date: null,
        is_folder: true,
        children: [
          {
            name: 'fix-issue',
            full_name: '2026-02-01-fix-issue.md',
            path: 'bugs/2026-02-01-fix-issue.md',
            date: '2026-02-01',
            is_folder: false,
            children: null,
          },
        ],
      },
    ];
    
    render(
      <FeatureFilesList
        nodes={files}
        onFileSelect={mockOnFileSelect}
        selectedPath={null}
      />
    );
    
    const folderButton = screen.getByText('bugs');
    await user.click(folderButton);
    
    // Children should now be visible
    await waitFor(() => {
      expect(screen.getByText('fix-issue')).toBeInTheDocument();
    });
  });
  
  it('highlights selected file', () => {
    const files: FeatureFileNode[] = [
      {
        name: 'test-feature',
        full_name: '2026-02-01-test-feature.md',
        path: '2026-02-01-test-feature.md',
        date: '2026-02-01',
        is_folder: false,
        children: null,
      },
    ];
    
    const { container } = render(
      <FeatureFilesList
        nodes={files}
        onFileSelect={mockOnFileSelect}
        selectedPath="2026-02-01-test-feature.md"
      />
    );
    
    // Check that the selected file has the highlight class
    const fileButton = container.querySelector('.bg-blue-600');
    expect(fileButton).toBeInTheDocument();
    expect(fileButton?.textContent).toContain('test-feature');
  });
});
