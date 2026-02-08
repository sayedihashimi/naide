import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import GenerateAppScreen from './GenerateAppScreen';
import { AppProvider } from '../context/AppContext';

// Helper to create a mock streaming response
const createStreamingResponse = (content: string) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send delta event
      const deltaEvent = `data: ${JSON.stringify({ type: 'delta', data: { content } })}\n\n`;
      controller.enqueue(encoder.encode(deltaEvent));
      
      // Send done event
      const doneEvent = `data: ${JSON.stringify({ type: 'done', data: { fullResponse: content } })}\n\n`;
      controller.enqueue(encoder.encode(doneEvent));
      
      controller.close();
    }
  });
  
  return {
    ok: true,
    body: stream,
  };
};

// Mock fetch
global.fetch = vi.fn();

// Mock file system utilities
vi.mock('../utils/fileSystem', () => ({
  createAllProjectFiles: vi.fn().mockResolvedValue(undefined),
  initializeProject: vi.fn().mockResolvedValue(undefined),
  saveSectionToFile: vi.fn().mockResolvedValue(undefined),
  loadProjectData: vi.fn().mockResolvedValue({}),
  checkProjectExists: vi.fn().mockResolvedValue(false),
  getProjectPath: vi.fn().mockResolvedValue('/mock/path/MyApp'),
  updateLastUsedProject: vi.fn().mockResolvedValue(undefined),
  loadConfig: vi.fn().mockResolvedValue({ lastUsedProject: null, projects: [] }),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

// Mock chat persistence utilities
vi.mock('../utils/chatPersistence', () => ({
  loadChatSession: vi.fn().mockResolvedValue([]),
  saveChatSession: vi.fn().mockResolvedValue(undefined),
}));

const renderGenerateAppScreen = () => {
  return render(
    <BrowserRouter>
      <AppProvider>
        <GenerateAppScreen />
      </AppProvider>
    </BrowserRouter>
  );
};

describe('GenerateAppScreen', () => {
  it('uses fixed viewport height to prevent app expansion', () => {
    const { container } = renderGenerateAppScreen();
    
    // The root div should use h-screen (fixed height) not min-h-screen (can grow)
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toHaveClass('h-screen');
    expect(rootDiv).not.toHaveClass('min-h-screen');
  });

  it('renders the Generate App screen with 3-column layout', async () => {
    renderGenerateAppScreen();

    // Check header
    expect(screen.getByRole('heading', { name: 'Naide' })).toBeInTheDocument();

    // Navigation section has been removed, so these buttons no longer exist
    expect(screen.queryByRole('button', { name: 'Generate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Files' })).not.toBeInTheDocument();

    // Check center chat area
    expect(screen.getByRole('heading', { name: 'Generate App' })).toBeInTheDocument();
    expect(screen.getByText(/Talk to Naide to generate and refine your app/i)).toBeInTheDocument();
    
    // Wait for welcome messages to load (Planning mode by default)
    expect(await screen.findByText(/I'm in Planning Mode/i)).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText(/Type your message.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

    // Check right preview panel header
    expect(screen.getByRole('heading', { name: 'Running App' })).toBeInTheDocument();
  });

  it('has Features and Files sections in left column', () => {
    renderGenerateAppScreen();

    // Check for Features heading (use getAllByText since there are multiple matches)
    const featuresHeadings = screen.getAllByText(/Features/i);
    expect(featuresHeadings.length).toBeGreaterThan(0);
    
    // Check for Files heading
    expect(screen.getByRole('heading', { name: /Files/i })).toBeInTheDocument();
  });

  it('has Features section expanded by default', () => {
    renderGenerateAppScreen();

    // Features section should be visible with filter input
    expect(screen.getByPlaceholderText(/Filter features.../i)).toBeInTheDocument();
  });

  it('has enabled chat input but Send disabled when empty', async () => {
    renderGenerateAppScreen();

    // Wait for component to load
    await screen.findByPlaceholderText(/Type your message.../i);

    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Input should be enabled
    expect(messageInput).not.toBeDisabled();
    // Send button should be disabled when input is empty
    expect(sendButton).toBeDisabled();
  });

  it('has app runner controls in right panel', () => {
    renderGenerateAppScreen();

    // Right panel should have the Running App heading
    expect(screen.getByRole('heading', { name: 'Running App' })).toBeInTheDocument();
  });

  it('displays placeholder assistant messages', async () => {
    renderGenerateAppScreen();

    // Wait for welcome messages to load (Planning mode by default)
    expect(await screen.findByText(/I'm in Planning Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/What would you like to plan or refine in your specifications?/i)).toBeInTheDocument();
  });

  it('has mode selector dropdown with three options', async () => {
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);

    const modeSelect = screen.getByLabelText(/Mode:/i);
    expect(modeSelect).toBeInTheDocument();
    
    // Check all three options exist
    const options = Array.from(modeSelect.querySelectorAll('option'));
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Planning');
    expect(options[1]).toHaveTextContent('Building');
    expect(options[2]).toHaveTextContent('Analyzing');
  });

  it('defaults to Planning mode', async () => {
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);

    const modeSelect = screen.getByLabelText(/Mode:/i) as HTMLSelectElement;
    expect(modeSelect.value).toBe('Planning');
    
    // Check Planning mode description is shown
    expect(screen.getByText(/Create\/update specs only/i)).toBeInTheDocument();
  });

  it('changes welcome messages when mode is changed', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);

    const modeSelect = screen.getByLabelText(/Mode:/i);

    // Initially Planning mode messages
    expect(await screen.findByText(/I'm in Planning Mode/i)).toBeInTheDocument();

    // Switch to Building mode
    await user.selectOptions(modeSelect, 'Building');

    // Should see Building mode messages
    expect(await screen.findByText(/I'm in Building Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/What feature would you like me to build or modify?/i)).toBeInTheDocument();
  });

  it('shows correct description for each mode', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);

    const modeSelect = screen.getByLabelText(/Mode:/i);

    // Planning mode
    expect(screen.getByText(/Create\/update specs only/i)).toBeInTheDocument();

    // Switch to Building mode
    await user.selectOptions(modeSelect, 'Building');
    expect(await screen.findByText(/Update code and specs/i)).toBeInTheDocument();

    // Switch to Analyzing mode
    await user.selectOptions(modeSelect, 'Analyzing');
    // Use getAllByText to handle multiple matches and check that the span has the text
    const comingSoonElements = screen.getAllByText(/Coming soon/i);
    expect(comingSoonElements.length).toBeGreaterThan(0);
    // Check that one of them is the span with the specific class
    const descSpan = comingSoonElements.find(el => el.className.includes('text-xs'));
    expect(descSpan).toBeInTheDocument();
  });

  it('does not change messages when mode is changed after chat is initialized', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);

    // Mock fetch to return a Planning mode streaming response
    (global.fetch as any).mockResolvedValueOnce(createStreamingResponse('Planning mode response'));

    // Send a message to initialize the chat
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    await user.type(messageInput, 'Test message');
    await user.keyboard('{Control>}{Enter}{/Control}');

    // Wait for user message and response
    expect(await screen.findByText('Test message')).toBeInTheDocument();
    expect(await screen.findByText('Planning mode response')).toBeInTheDocument();

    // Now change the mode
    const modeSelect = screen.getByLabelText(/Mode:/i);
    await user.selectOptions(modeSelect, 'Building');

    // The original messages should still be there
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('Planning mode response')).toBeInTheDocument();
    
    // The Planning mode welcome messages should still be visible
    expect(screen.getByText(/I'm in Planning Mode/i)).toBeInTheDocument();
    
    // The Building mode welcome messages should NOT appear
    expect(screen.queryByText(/I'm in Building Mode/i)).not.toBeInTheDocument();
  });

  it('enables Send button when user types message', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Initially disabled
    expect(sendButton).toBeDisabled();

    // Type a message
    await user.type(messageInput, 'Hello');

    // Should be enabled now
    expect(sendButton).not.toBeDisabled();
  });

  it('has expand/collapse button for textarea', async () => {
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const expandButton = screen.getByTitle(/Expand/i);
    expect(expandButton).toBeInTheDocument();
  });

  it('toggles textarea height when expand/collapse button is clicked', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const expandButton = screen.getByTitle(/Expand/i);

    // Initially compact (h-20)
    expect(messageInput).toHaveClass('h-20');

    // Click to expand
    await user.click(expandButton);

    // Should be expanded (h-40)
    expect(messageInput).toHaveClass('h-40');

    // Click to collapse
    const collapseButton = screen.getByTitle(/Collapse/i);
    await user.click(collapseButton);

    // Should be compact again
    expect(messageInput).toHaveClass('h-20');
  });

  it('sends message when Send button is clicked', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Mock fetch to return a Planning mode streaming response
    (global.fetch as any).mockResolvedValueOnce(createStreamingResponse('Planning mode response'));

    // Type a message
    await user.type(messageInput, 'Test message');
    await user.click(sendButton);

    // User message should appear
    expect(await screen.findByText('Test message')).toBeInTheDocument();
    
    // Assistant response should appear
    expect(await screen.findByText('Planning mode response')).toBeInTheDocument();
  });

  it('sends message when Ctrl+Enter is pressed', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);

    // Mock fetch to return a Planning mode streaming response
    (global.fetch as any).mockResolvedValueOnce(createStreamingResponse('Planning mode response'));

    // Type a message
    await user.type(messageInput, 'Test message');
    
    // Press Ctrl+Enter
    await user.keyboard('{Control>}{Enter}{/Control}');

    // User message should appear
    expect(await screen.findByText('Test message')).toBeInTheDocument();
    
    // Assistant response should appear
    expect(await screen.findByText('Planning mode response')).toBeInTheDocument();
  });

  it('adds new line when Enter is pressed without Ctrl', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i) as HTMLTextAreaElement;

    // Type a message
    await user.type(messageInput, 'Line 1');
    
    // Press Enter (without Ctrl)
    await user.keyboard('{Enter}');
    await user.type(messageInput, 'Line 2');

    // Should have multiline content
    expect(messageInput.value).toContain('Line 1\nLine 2');
  });

  it('sends message in Building mode', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);
    
    const modeSelect = screen.getByLabelText(/Mode:/i);
    await user.selectOptions(modeSelect, 'Building');

    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Mock fetch should not be called in Building mode tests since it returns stub
    // Type a message
    await user.type(messageInput, 'Build something');
    await user.click(sendButton);

    // User message should appear
    expect(await screen.findByText('Build something')).toBeInTheDocument();
  });

  it('sends message in Analyzing mode', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);
    
    const modeSelect = screen.getByLabelText(/Mode:/i);
    await user.selectOptions(modeSelect, 'Analyzing');

    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Type a message
    await user.type(messageInput, 'Analyze something');
    await user.click(sendButton);

    // User message should appear
    expect(await screen.findByText('Analyze something')).toBeInTheDocument();
  });

  it('renders markdown in assistant messages', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Mock fetch to return a markdown streaming response
    const markdownContent = 'Here is some **bold** text and *italic* text.\n\n- Item 1\n- Item 2\n\nAnd a `code` snippet.';
    (global.fetch as any).mockResolvedValueOnce(createStreamingResponse(markdownContent));

    // Type a message
    await user.type(messageInput, 'Test markdown');
    await user.click(sendButton);

    // Wait for response
    await screen.findByText(/Here is some/i);
    
    // Check markdown elements are rendered
    const boldText = screen.getByText('bold');
    expect(boldText.tagName).toBe('STRONG');
    
    const italicText = screen.getByText('italic');
    expect(italicText.tagName).toBe('EM');
    
    const codeText = screen.getByText('code');
    expect(codeText.tagName).toBe('CODE');
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders markdown in user messages', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Mock fetch to return a simple response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ replyText: 'Got it' }),
    });

    // Type a message with markdown
    await user.type(messageInput, 'Please create a **function** for me');
    await user.click(sendButton);

    // Wait for user message to appear
    await screen.findByText(/Please create a/i);
    
    // Check markdown is rendered in user message
    const boldText = screen.getByText('function');
    expect(boldText.tagName).toBe('STRONG');
  });

  describe('Stop Button', () => {
    it('shows Stop button when loading', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      // Initially, Send button should be present
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
      expect(screen.queryByTitle(/Stop request/i)).not.toBeInTheDocument();

      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch to return a delayed streaming response
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(createStreamingResponse('Response'));
          }, 1000);
        })
      );

      // Type and send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Stop button should appear when loading
      expect(await screen.findByTitle(/Stop request/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    });

    it('cancels request when Stop button is clicked', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch with a controller that can be tracked
      const abortMock = vi.fn();
      (global.fetch as any).mockImplementationOnce(() => {
        const mockController = { abort: abortMock };
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, 100);
        });
      });

      // Type and send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Wait for Stop button to appear
      const stopButton = await screen.findByTitle(/Stop request/i);
      
      // Click Stop button
      await user.click(stopButton);

      // Should show "Cancelled by user" message
      expect(await screen.findByText('Cancelled by user')).toBeInTheDocument();
      
      // Send button should reappear
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    });

    it('preserves partial content when cancelled', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch that returns partial content before being cancelled
      const encoder = new TextEncoder();
      (global.fetch as any).mockImplementationOnce(() => ({
        ok: true,
        body: new ReadableStream({
          async start(controller) {
            // Send partial content
            const deltaEvent = `data: ${JSON.stringify({ type: 'delta', data: { content: 'Partial response' } })}\n\n`;
            controller.enqueue(encoder.encode(deltaEvent));
            
            // Wait a bit then close (simulating cancellation)
            await new Promise(resolve => setTimeout(resolve, 100));
            controller.close();
          }
        })
      }));

      // Type and send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Wait for Stop button
      const stopButton = await screen.findByTitle(/Stop request/i);
      
      // Wait for partial content to appear
      await screen.findByText('Partial response');
      
      // Click Stop
      await user.click(stopButton);

      // Both partial content and cancellation message should be visible
      expect(screen.getByText('Partial response')).toBeInTheDocument();
      expect(await screen.findByText('Cancelled by user')).toBeInTheDocument();
    });

    it('removes empty placeholder when cancelled before response', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch that never returns content
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(() => {
          // Never resolves - simulating waiting for response
        })
      );

      // Type and send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Wait for Stop button
      const stopButton = await screen.findByTitle(/Stop request/i);
      
      // Should show "Copilot is working..." while waiting
      expect(await screen.findByText(/Copilot is working on your request/i)).toBeInTheDocument();
      
      // Click Stop
      await user.click(stopButton);

      // Should only show cancellation message, not empty placeholder
      expect(await screen.findByText('Cancelled by user')).toBeInTheDocument();
      expect(screen.queryByText(/Copilot is working on your request/i)).not.toBeInTheDocument();
    });

    it('supports Ctrl+X keyboard shortcut to cancel', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch that delays
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(createStreamingResponse('Response'));
          }, 1000);
        })
      );

      // Type and send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Wait for Stop button to confirm loading state
      await screen.findByTitle(/Stop request/i);
      
      // Press Ctrl+X
      await user.keyboard('{Control>}x{/Control}');

      // Should show cancellation message
      expect(await screen.findByText('Cancelled by user')).toBeInTheDocument();
      
      // Send button should reappear
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    });

    it('styles "Cancelled by user" message differently', async () => {
      const user = userEvent.setup();
      renderGenerateAppScreen();

      await screen.findByPlaceholderText(/Type your message.../i);
      
      const messageInput = screen.getByPlaceholderText(/Type your message.../i);

      // Mock fetch that never completes
      (global.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

      // Send a message
      await user.type(messageInput, 'Test');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Stop the request
      const stopButton = await screen.findByTitle(/Stop request/i);
      await user.click(stopButton);

      // Find the cancellation message
      const cancelMessage = await screen.findByText('Cancelled by user');
      
      // Check it has the correct styling classes
      expect(cancelMessage).toHaveClass('text-zinc-500');
      expect(cancelMessage).toHaveClass('italic');
      expect(cancelMessage).toHaveClass('text-sm');
    });
  });
});
