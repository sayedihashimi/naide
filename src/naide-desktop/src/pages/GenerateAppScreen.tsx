import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/useAppContext';
import type { ChatMessage } from '../utils/chatPersistence';
import MessageContent from '../components/MessageContent';
import { open } from '@tauri-apps/plugin-dialog';
import { getProjectPath } from '../utils/fileSystem';

export type CopilotMode = 'Planning' | 'Building' | 'Analyzing';

const MODE_DESCRIPTIONS: Record<CopilotMode, string> = {
  Planning: '(Create/update specs only)',
  Building: '(Update code and specs)',
  Analyzing: '(Coming soon)',
};

const getWelcomeMessages = (mode: CopilotMode): ChatMessage[] => {
  const timestamp = new Date().toISOString();
  
  switch (mode) {
    case 'Planning':
      return [
        {
          id: 'welcome-planning-1',
          role: 'assistant',
          content: "I'm in Planning Mode. I'll help you create and update spec files without touching your code.",
          timestamp,
        },
        {
          id: 'welcome-planning-2',
          role: 'assistant',
          content: 'What would you like to plan or refine in your specifications?',
          timestamp,
        },
      ];
    case 'Building':
      return [
        {
          id: 'welcome-building-1',
          role: 'assistant',
          content: "I'm in Building Mode. I'll help you implement your app and update specs as needed.",
          timestamp,
        },
        {
          id: 'welcome-building-2',
          role: 'assistant',
          content: 'What feature would you like me to build or modify?',
          timestamp,
        },
      ];
    case 'Analyzing':
      return [
        {
          id: 'welcome-analyzing-1',
          role: 'assistant',
          content: "I'm in Analyzing Mode. This mode will be available soon.",
          timestamp,
        },
        {
          id: 'welcome-analyzing-2',
          role: 'assistant',
          content: 'In the future, I will help you analyze your code and provide insights.',
          timestamp,
        },
      ];
    default:
      // Fall through to Planning mode for any unknown modes
      return getWelcomeMessages('Planning');
  }
};

const GenerateAppScreen: React.FC = () => {
  const { state } = useAppContext();
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('Planning');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat session on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const { loadChatSession } = await import('../utils/chatPersistence');
        const loadedMessages = await loadChatSession(state.projectName);
        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
          setChatInitialized(true);
        } else {
          // Initialize with welcome messages based on mode
          setMessages(getWelcomeMessages(copilotMode));
          // Don't set chatInitialized yet - wait for user interaction
        }
      } catch (error) {
        console.error('[GenerateApp] Error loading chat:', error);
        // Fallback to welcome messages
        setMessages(getWelcomeMessages(copilotMode));
      }
    };
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projectName]); // copilotMode intentionally excluded - mode changes are handled by handleModeChange

  // Save chat when messages change (but only after initialization with user messages)
  useEffect(() => {
    if (messages.length > 0 && chatInitialized) {
      const saveChat = async () => {
        try {
          const { saveChatSession } = await import('../utils/chatPersistence');
          await saveChatSession(state.projectName, messages);
        } catch (error) {
          console.error('[GenerateApp] Error saving chat:', error);
        }
      };
      // Debounce save to avoid excessive writes
      const timer = setTimeout(saveChat, 500);
      return () => clearTimeout(timer);
    }
  }, [messages, state.projectName, chatInitialized]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isLoading) return;

    // Mark chat as initialized on first user message
    if (!chatInitialized) {
      setChatInitialized(true);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: messageInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = messageInput.trim();
    setMessageInput('');
    setIsLoading(true);

    try {
      // For Building and Analyzing modes, use stub responses
      if (copilotMode === 'Building') {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: 'Building coming soon',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        return;
      }

      if (copilotMode === 'Analyzing') {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: 'Analyzing coming soon',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        return;
      }

      // For Planning mode, call the sidecar
      // Get the project path to use as workspace root
      const projectPath = await getProjectPath(state.projectName);
      
      const response = await fetch('http://localhost:3001/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: copilotMode,
          message: userInput,
          workspaceRoot: projectPath,
        }),
      });

      if (!response.ok) {
        // Handle non-OK responses
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: errorData.replyText || errorData.error || 'An error occurred',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        return;
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: data.replyText || data.error || 'An error occurred',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      
      // Focus back on textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error) {
      console.error('[GenerateApp] Error calling sidecar:', error);
      
      const errorMessage: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Unable to connect to the Copilot service. Please make sure the sidecar is running.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
    // Just Enter adds a new line (default behavior)
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleModeChange = (newMode: CopilotMode) => {
    setCopilotMode(newMode);
    // Reset chat with new welcome messages for the mode
    if (!chatInitialized) {
      setMessages(getWelcomeMessages(newMode));
    }
  };

  const handleOpenProjectFolder = async () => {
    try {
      // Get the current project path
      const projectPath = await getProjectPath(state.projectName);
      
      // Open folder selection dialog
      const selectedPath = await open({
        title: 'Select Project Folder',
        directory: true,
        multiple: false,
        defaultPath: projectPath,
      });
      
      if (selectedPath) {
        console.log('[GenerateApp] Selected project folder:', selectedPath);
        // TODO: Load the selected project
        // For now, just log the selection
      }
    } catch (error) {
      console.error('[GenerateApp] Error opening project folder:', error);
    }
  };

  return (
    <div className="h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Naide</h1>
        <button
          onClick={handleOpenProjectFolder}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-100 rounded-lg transition-colors flex items-center gap-2"
          title="Open project folder"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span className="text-sm">{state.projectName}</span>
        </button>
      </div>

      {/* Main content area - 3 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Navigation Sidebar */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Navigation
            </h2>
            <nav>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors bg-zinc-800 text-gray-100 font-medium"
                disabled
              >
                Generate
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors text-gray-500 cursor-not-allowed"
                disabled
              >
                Activity
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded mb-1 transition-colors text-gray-500 cursor-not-allowed"
                disabled
              >
                Files
              </button>
            </nav>
          </div>
        </div>

        {/* Center: Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-2xl font-semibold text-gray-100 mb-1">Generate App</h2>
            <p className="text-sm text-gray-400">
              Talk to Naide to generate and refine your app.
            </p>
          </div>

          {/* Transcript area */}
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className={`flex-1 ${message.role === 'user' ? 'ml-11' : ''}`}>
                    <div className={`rounded-lg p-4 ${
                      message.role === 'assistant'
                        ? 'bg-zinc-900 border border-zinc-800'
                        : 'bg-blue-600'
                    }`}>
                      <MessageContent content={message.content} role={message.role} />
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white animate-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                      <p className="text-gray-400">Thinking...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input row */}
          <div className="border-t border-zinc-800 p-6">
            <div className="max-w-3xl mx-auto">
              {/* Mode selector */}
              <div className="mb-3 flex items-center gap-2">
                <label htmlFor="mode-select" className="text-sm text-gray-400">
                  Mode:
                </label>
                <select
                  id="mode-select"
                  value={copilotMode}
                  onChange={(e) => handleModeChange(e.target.value as CopilotMode)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Planning">Planning</option>
                  <option value="Building">Building</option>
                  <option value="Analyzing">Analyzing</option>
                </select>
                <span className="text-xs text-gray-500">
                  {MODE_DESCRIPTIONS[copilotMode]}
                </span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message... (Ctrl/Cmd+Enter to send)"
                    className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      isExpanded ? 'h-40' : 'h-20'
                    }`}
                  />
                  {/* Expand/Collapse button */}
                  <button
                    onClick={toggleExpand}
                    className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-gray-200 hover:bg-zinc-700 rounded transition-colors"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {isExpanded ? (
                        // Collapse icon
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      ) : (
                        // Expand icon
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      )}
                    </svg>
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isLoading}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !messageInput.trim() || isLoading
                        ? 'bg-zinc-800 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    Send
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center"
                    title="Attach file"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Running App Preview */}
        <div className="w-96 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Running App</h3>

            {/* Empty state */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">Your app will appear here once generated.</p>
              <p className="text-sm text-gray-500">Not running yet</p>
            </div>

            {/* Optional control buttons (disabled) */}
            <div className="mt-6 space-y-2">
              <button
                disabled
                className="w-full px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Start
              </button>
              <button
                disabled
                className="w-full px-4 py-2 bg-zinc-800 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateAppScreen;
