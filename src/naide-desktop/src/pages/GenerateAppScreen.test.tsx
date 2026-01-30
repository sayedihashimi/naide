import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import GenerateAppScreen from './GenerateAppScreen';
import { AppProvider } from '../context/AppContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the Generate App screen with 3-column layout', async () => {
    renderGenerateAppScreen();

    // Check header
    expect(screen.getByRole('heading', { name: 'Naide' })).toBeInTheDocument();

    // Check left navigation
    expect(screen.getByRole('button', { name: 'Planning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument();

    // Check center chat area
    expect(screen.getByRole('heading', { name: 'Generate App' })).toBeInTheDocument();
    expect(screen.getByText(/Talk to Naide to generate and refine your app/i)).toBeInTheDocument();
    
    // Wait for welcome messages to load (Planning mode by default)
    expect(await screen.findByText(/I'm in Planning Mode/i)).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText(/Type your message.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

    // Check right preview panel
    expect(screen.getByRole('heading', { name: 'Running App' })).toBeInTheDocument();
    expect(screen.getByText(/Your app will appear here once generated/i)).toBeInTheDocument();
    expect(screen.getByText(/Not running yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('has Generate button highlighted in navigation', () => {
    renderGenerateAppScreen();

    const generateButton = screen.getByRole('button', { name: 'Generate' });
    expect(generateButton).toHaveClass('bg-zinc-800', 'text-gray-100', 'font-medium');
  });

  it('has disabled Activity and Files buttons', () => {
    renderGenerateAppScreen();

    const activityButton = screen.getByRole('button', { name: 'Activity' });
    const filesButton = screen.getByRole('button', { name: 'Files' });

    expect(activityButton).toBeDisabled();
    expect(filesButton).toBeDisabled();
    expect(activityButton).toHaveClass('text-gray-500', 'cursor-not-allowed');
    expect(filesButton).toHaveClass('text-gray-500', 'cursor-not-allowed');
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

  it('has disabled preview control buttons', () => {
    renderGenerateAppScreen();

    const startButton = screen.getByRole('button', { name: 'Start' });
    const stopButton = screen.getByRole('button', { name: 'Stop' });

    expect(startButton).toBeDisabled();
    expect(stopButton).toBeDisabled();
  });

  it('navigates back to Planning Mode when Planning button is clicked', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    const planningButton = screen.getByRole('button', { name: 'Planning' });
    await user.click(planningButton);

    expect(mockNavigate).toHaveBeenCalledWith('/planning');
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

    // Mock fetch to return a Planning mode response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ replyText: 'Planning mode response' }),
    });

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

    // Mock fetch to return a Planning mode response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ replyText: 'Planning mode response' }),
    });

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

    // Mock fetch to return a Planning mode response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ replyText: 'Planning mode response' }),
    });

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

  it('returns "Building coming soon" when in Building mode', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByLabelText(/Mode:/i);
    
    const modeSelect = screen.getByLabelText(/Mode:/i);
    await user.selectOptions(modeSelect, 'Building');

    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Type a message
    await user.type(messageInput, 'Build something');
    await user.click(sendButton);

    // User message should appear
    expect(await screen.findByText('Build something')).toBeInTheDocument();
    
    // Should get stub response
    expect(await screen.findByText('Building coming soon')).toBeInTheDocument();
  });

  it('returns "Analyzing coming soon" when in Analyzing mode', async () => {
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
    
    // Should get stub response
    expect(await screen.findByText('Analyzing coming soon')).toBeInTheDocument();
  });

  it('renders markdown in assistant messages', async () => {
    const user = userEvent.setup();
    renderGenerateAppScreen();

    await screen.findByPlaceholderText(/Type your message.../i);
    
    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    // Mock fetch to return a markdown response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        replyText: 'Here is some **bold** text and *italic* text.\n\n- Item 1\n- Item 2\n\nAnd a `code` snippet.' 
      }),
    });

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
});
