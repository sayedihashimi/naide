import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatHistoryDropdown from './ChatHistoryDropdown';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock fileSystem utilities
vi.mock('../utils/fileSystem', () => ({
  getProjectPath: vi.fn().mockResolvedValue('/mock/path'),
}));

const { invoke } = await import('@tauri-apps/api/core');

describe('ChatHistoryDropdown', () => {
  const mockOnLoadChat = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={false}
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render empty state when no chat sessions exist', async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No archived chats yet')).toBeInTheDocument();
    });
  });

  it('should load and display chat sessions', async () => {
    const mockSessions = [
      {
        filename: 'chat-2026-02-01-001.json',
        last_modified: Date.now() / 1000,
        message_count: 5,
        mode: 'Planning',
        first_user_message: 'Hello, this is a test message',
      },
    ];

    vi.mocked(invoke).mockResolvedValue(mockSessions);

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('5 messages')).toBeInTheDocument();
      expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
    });
  });

  it('should call onLoadChat when a chat session is clicked', async () => {
    const mockSessions = [
      {
        filename: 'chat-2026-02-01-001.json',
        last_modified: Date.now() / 1000,
        message_count: 5,
        mode: 'Planning',
        first_user_message: 'Hello',
      },
    ];

    vi.mocked(invoke).mockResolvedValue(mockSessions);

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    // Find the button containing the chat session (not the delete button)
    const chatButtons = screen.getAllByRole('button');
    const chatButton = chatButtons.find(btn => btn.textContent?.includes('Planning'));
    expect(chatButton).toBeDefined();
    
    fireEvent.click(chatButton!);

    expect(mockOnLoadChat).toHaveBeenCalledWith('chat-2026-02-01-001.json');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display error message on load failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Failed to load'));

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
    });
  });

  it('should close dropdown when ESC key is pressed', async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should truncate long messages', async () => {
    const longMessage = 'a'.repeat(100);
    const mockSessions = [
      {
        filename: 'chat-2026-02-01-001.json',
        last_modified: Date.now() / 1000,
        message_count: 5,
        mode: 'Planning',
        first_user_message: longMessage,
      },
    ];

    vi.mocked(invoke).mockResolvedValue(mockSessions);

    render(
      <ChatHistoryDropdown
        projectName="test-project"
        onLoadChat={mockOnLoadChat}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const truncatedText = screen.getByText(/aaa.*\.\.\./);
      expect(truncatedText).toBeInTheDocument();
    });
  });
});
