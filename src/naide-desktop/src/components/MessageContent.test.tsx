import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageContent from './MessageContent';

describe('MessageContent', () => {
  it('renders plain text content', () => {
    render(<MessageContent content="Hello, world!" role="assistant" />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders markdown bold text', () => {
    render(<MessageContent content="This is **bold** text" role="assistant" />);
    const boldElement = screen.getByText('bold');
    expect(boldElement.tagName).toBe('STRONG');
  });

  it('renders markdown italic text', () => {
    render(<MessageContent content="This is *italic* text" role="assistant" />);
    const italicElement = screen.getByText('italic');
    expect(italicElement.tagName).toBe('EM');
  });

  it('renders markdown code inline', () => {
    render(<MessageContent content="Use `console.log()` to debug" role="assistant" />);
    const codeElement = screen.getByText('console.log()');
    expect(codeElement.tagName).toBe('CODE');
    expect(codeElement).toHaveClass('text-blue-300');
  });

  it('renders markdown code blocks', () => {
    const codeBlock = '```javascript\nconst x = 10;\n```';
    render(<MessageContent content={codeBlock} role="assistant" />);
    const codeElement = screen.getByText(/const x = 10/);
    expect(codeElement.tagName).toBe('CODE');
  });

  it('renders markdown links', () => {
    render(<MessageContent content="Visit [Google](https://google.com)" role="assistant" />);
    const linkElement = screen.getByRole('link', { name: 'Google' });
    expect(linkElement).toHaveAttribute('href', 'https://google.com');
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders markdown unordered lists', () => {
    const listContent = '- Item 1\n- Item 2\n- Item 3';
    render(<MessageContent content={listContent} role="assistant" />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders markdown ordered lists', () => {
    const listContent = '1. First\n2. Second\n3. Third';
    render(<MessageContent content={listContent} role="assistant" />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('renders markdown headings', () => {
    const headingContent = '# Heading 1\n## Heading 2\n### Heading 3';
    render(<MessageContent content={headingContent} role="assistant" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Heading 3' })).toBeInTheDocument();
  });

  it('renders markdown blockquotes', () => {
    render(<MessageContent content="> This is a quote" role="assistant" />);
    const quoteElement = screen.getByText('This is a quote');
    expect(quoteElement.closest('blockquote')).toBeInTheDocument();
  });

  it('applies correct text color for assistant role', () => {
    const { container } = render(<MessageContent content="Test" role="assistant" />);
    const outerDiv = container.querySelector('div');
    expect(outerDiv).toHaveClass('text-gray-100');
  });

  it('applies correct text color for user role', () => {
    const { container } = render(<MessageContent content="Test" role="user" />);
    const outerDiv = container.querySelector('div');
    expect(outerDiv).toHaveClass('text-white');
  });

  it('renders GitHub Flavored Markdown tables', () => {
    const tableContent = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
    render(<MessageContent content={tableContent} role="assistant" />);
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Header 2')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();
    expect(screen.getByText('Cell 2')).toBeInTheDocument();
  });

  it('renders GitHub Flavored Markdown strikethrough', () => {
    render(<MessageContent content="This is ~~strikethrough~~ text" role="assistant" />);
    const strikethroughElement = screen.getByText('strikethrough');
    expect(strikethroughElement.tagName).toBe('DEL');
  });

  it('renders multiple markdown elements together', () => {
    const complexContent = '# Title\n\nThis is **bold** and *italic*.\n\n- Item 1\n- Item 2\n\n`code`';
    render(<MessageContent content={complexContent} role="assistant" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
  });
});
