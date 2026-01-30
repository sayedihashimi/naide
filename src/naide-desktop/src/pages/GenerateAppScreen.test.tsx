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

  it('renders the Generate App screen with 3-column layout', () => {
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
    expect(screen.getByText(/I'm ready. I'll generate an app based on your plan./i)).toBeInTheDocument();
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

  it('has disabled chat input and buttons', () => {
    renderGenerateAppScreen();

    const messageInput = screen.getByPlaceholderText(/Type your message.../i);
    const sendButton = screen.getByRole('button', { name: 'Send' });

    expect(messageInput).toBeDisabled();
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

  it('displays placeholder assistant messages', () => {
    renderGenerateAppScreen();

    expect(screen.getByText(/I'm ready. I'll generate an app based on your plan./i)).toBeInTheDocument();
    expect(screen.getByText(/Before I start, is there anything you want to emphasize or clarify?/i)).toBeInTheDocument();
  });
});
