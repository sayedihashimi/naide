import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownPreview from './MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders empty state when no content', () => {
    render(<MarkdownPreview content={null} fileName={null} />);
    expect(screen.getByText('Select a feature file to view')).toBeInTheDocument();
  });
  
  it('renders file name and content', () => {
    const content = '# Test Feature\n\nThis is a test feature.';
    render(<MarkdownPreview content={content} fileName="test-feature" />);
    
    expect(screen.getByText('test-feature')).toBeInTheDocument();
    expect(screen.getByText('Test Feature')).toBeInTheDocument();
    expect(screen.getByText('This is a test feature.')).toBeInTheDocument();
  });
  
  it('renders markdown content properly', () => {
    const content = '## Heading\n\n- List item 1\n- List item 2\n\n**Bold text**';
    render(<MarkdownPreview content={content} fileName="markdown-test" />);
    
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('List item 1')).toBeInTheDocument();
    expect(screen.getByText('List item 2')).toBeInTheDocument();
    expect(screen.getByText('Bold text')).toBeInTheDocument();
  });
});
