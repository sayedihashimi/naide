import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/useAppContext';
import type { ChatMessage } from '../utils/chatPersistence';
import {
  type ConversationSummary,
  buildConversationContext,
  parseSummaryFromResponse,
  cleanResponseForDisplay,
  mergeSummary,
} from '../utils/conversationMemory';
import MessageContent from '../components/MessageContent';
import FeatureFilesViewer from '../components/FeatureFilesViewer';
import TabBar, { type Tab } from '../components/TabBar';
import FeatureFileTab from '../components/FeatureFileTab';
import ChatHistoryDropdown from '../components/ChatHistoryDropdown';
import ActivityStatusBar from '../components/ActivityStatusBar';
import AppSelectorDropdown from '../components/AppSelectorDropdown';
import type { FeatureFileNode } from '../utils/featureFiles';
import { open } from '@tauri-apps/plugin-dialog';
import { getProjectPath } from '../utils/fileSystem';
import { getRecentProjects, saveLastProject, type LastProject } from '../utils/globalSettings';
import { logInfo, logError } from '../utils/logger';
import { loadOpenTabs, saveOpenTabs, type PersistedTab } from '../utils/tabPersistence';

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

// Helper function to compute pulsing blue shade based on intensity
const computePulsingBlueColor = (intensity: number): string => {
  const r = Math.floor(37 + (59 - 37) * intensity);
  const g = Math.floor(99 + (130 - 99) * intensity);
  const b = Math.floor(235 + (246 - 235) * intensity);
  return `rgb(${r}, ${g}, ${b})`;
};

const GenerateAppScreen: React.FC = () => {
  const { state, setProjectName, setProjectPath, loadProject } = useAppContext();
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('Planning');
  // Conversation summary for mid-term memory (persisted in state, not disk)
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  // Recent projects dropdown state
  const [showRecentProjects, setShowRecentProjects] = useState(false);
  const [recentProjects, setRecentProjects] = useState<LastProject[]>([]);
  // Chat history dropdown state
  const [showChatHistory, setShowChatHistory] = useState(false);
  // Feature file popup state
  const [visualIntensity, setVisualIntensity] = useState<number>(1.0);
  
  // Cyclical brightness modulation for assistant icon during processing
  useEffect(() => {
    if (!isLoading) {
      setVisualIntensity(1.0);
      return;
    }
    
    let phaseCounter = 0;
    const timerId = setInterval(() => {
      phaseCounter = (phaseCounter + 0.08) % 2;
      const waveValue = Math.sin(phaseCounter * Math.PI) * 0.35 + 0.65;
      setVisualIntensity(waveValue);
    }, 180);
    
    return () => clearInterval(timerId);
  }, [isLoading]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Ref to track current iframe URL (for immediate access in click handlers)
  const currentIframeUrlRef = useRef<string | null>(null);
  
  // Tab state (replaces featureFilePopup)
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'generate-app', type: 'chat', label: 'Generate App', isPinned: true, isTemporary: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('generate-app');
  const [selectedFeaturePath, setSelectedFeaturePath] = useState<string | null>(null);
  
  // Right column resize state
  const [rightColumnWidth, setRightColumnWidth] = useState(600); // Default: 600px (larger for running app)
  const [isResizingRight, setIsResizingRight] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });
  
  // Running app state
  const [appRunState, setAppRunState] = useState<{
    status: 'none' | 'detecting' | 'ready' | 'starting' | 'running' | 'error';
    type?: 'dotnet' | 'npm';
    projectFile?: string;
    command?: string;
    url?: string;
    errorMessage?: string;
    pid?: number;
    proxyUrl?: string; // Proxied URL that includes script injection
  }>({ status: 'none' });
  
  // App selector state
  const [detectedApps, setDetectedApps] = useState<Array<{
    app_type: string;
    project_file?: string;
    command?: string;
  }>>([]);
  const [showAppSelector, setShowAppSelector] = useState(false);
  const appSelectorRef = useRef<HTMLDivElement>(null);
  
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentIframeUrl, setCurrentIframeUrl] = useState<string | null>(null);

  // Compute display URL: convert proxy URL back to real app URL
  const displayUrl = useMemo(() => {
    if (currentIframeUrl && appRunState.proxyUrl && appRunState.url) {
      try {
        const proxyBase = new URL(appRunState.proxyUrl);
        const appBase = new URL(appRunState.url);
        const current = new URL(currentIframeUrl);
        // Only convert if the current URL is using the proxy
        if (current.host === proxyBase.host) {
          current.host = appBase.host;
          current.protocol = appBase.protocol;
          return current.toString();
        }
      } catch {
        // Fall through to default
      }
    }
    return currentIframeUrl || appRunState.url || '';
  }, [currentIframeUrl, appRunState.proxyUrl, appRunState.url]);

  // Load chat session on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        logInfo(`[GenerateApp] Loading chat session for: projectName=${state.projectName}, projectPath=${state.projectPath}`);
        const { loadChatSession } = await import('../utils/chatPersistence');
        const loadedMessages = await loadChatSession(state.projectName, undefined, state.projectPath || undefined);
        if (loadedMessages.length > 0) {
          logInfo(`[GenerateApp] Loaded ${loadedMessages.length} messages from chat session`);
          setMessages(loadedMessages);
          setChatInitialized(true);
        } else {
          logInfo('[GenerateApp] No existing chat session found, initializing with welcome messages');
          // Initialize with welcome messages based on mode
          setMessages(getWelcomeMessages(copilotMode));
          // Don't set chatInitialized yet - wait for user interaction
        }
      } catch (error) {
        logError(`[GenerateApp] Error loading chat: ${error}`);
        // Fallback to welcome messages
        setMessages(getWelcomeMessages(copilotMode));
      }
    };
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projectName, state.projectPath]); // copilotMode intentionally excluded - mode changes are handled by handleModeChange

  // Save chat when messages change (but only after initialization with user messages)
  useEffect(() => {
    if (messages.length > 0 && chatInitialized) {
      const saveChat = async () => {
        try {
          logInfo(`[GenerateApp] Saving chat session with ${messages.length} messages for: projectName=${state.projectName}, projectPath=${state.projectPath}`);
          const { saveChatSession } = await import('../utils/chatPersistence');
          await saveChatSession(state.projectName, messages, undefined, state.projectPath || undefined);
          logInfo('[GenerateApp] Chat session saved successfully');
        } catch (error) {
          logError(`[GenerateApp] Error saving chat: ${error}`);
        }
      };
      // Debounce save to avoid excessive writes
      const timer = setTimeout(saveChat, 500);
      return () => clearTimeout(timer);
    }
  }, [messages, state.projectName, state.projectPath, chatInitialized]);

  // Load recent projects on mount
  useEffect(() => {
    const loadRecentProjects = async () => {
      const projects = await getRecentProjects();
      setRecentProjects(projects);
    };
    loadRecentProjects();
  }, []);

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecentProjects(false);
      }
    };

    if (showRecentProjects) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showRecentProjects]);

  // Click outside handler to close app selector dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (appSelectorRef.current && !appSelectorRef.current.contains(event.target as Node)) {
        setShowAppSelector(false);
      }
    };

    if (showAppSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAppSelector]);

  // Save tabs to project config when they change (debounced)
  useEffect(() => {
    if (!state.projectPath || tabs.length === 0) {
      return;
    }

    // Debounce saving to avoid too many writes
    const timer = setTimeout(() => {
      saveTabsToProject(state.projectPath!);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tabs, activeTabId, state.projectPath]);

  // Save tabs on component unmount
  useEffect(() => {
    return () => {
      if (state.projectPath && tabs.length > 0) {
        // Note: This is best effort - might not complete if app closes quickly
        saveTabsToProject(state.projectPath);
      }
    };
  }, [state.projectPath, tabs]);

  // Detect runnable app on project load
  useEffect(() => {
    const detectApp = async () => {
      if (!state.projectPath) return;
      
      setAppRunState({ status: 'detecting' });
      logInfo(`[AppRunner] Detecting runnable apps in: ${state.projectPath}`);
      
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { loadSelectedApp } = await import('../utils/appSelection');
        
        // Detect all runnable apps
        const apps = await invoke<Array<{ app_type: string; project_file?: string; command?: string }>>(
          'detect_all_runnable_apps_command',
          { projectPath: state.projectPath }
        );
        
        setDetectedApps(apps);
        
        if (apps.length > 0) {
          logInfo(`[AppRunner] Detected ${apps.length} runnable app(s)`);
          
          // Try to load previously selected app
          const savedApp = await loadSelectedApp(state.projectPath);
          let selectedApp = apps[0]; // Default to first app
          
          // Check if saved app still exists in detected apps
          if (savedApp) {
            const matchingApp = apps.find(
              a => a.app_type === savedApp.app_type && a.project_file === savedApp.project_file
            );
            if (matchingApp) {
              selectedApp = matchingApp;
              logInfo('[AppRunner] Restored previously selected app');
            } else {
              logInfo('[AppRunner] Previously selected app no longer available, using first detected app');
            }
          }
          
          setAppRunState({
            status: 'ready',
            type: selectedApp.app_type as 'dotnet' | 'npm',
            projectFile: selectedApp.project_file,
            command: selectedApp.command,
          });
        } else {
          logInfo('[AppRunner] No runnable app detected');
          setAppRunState({ status: 'none' });
        }
      } catch (error) {
        logError(`[AppRunner] Error detecting app: ${error}`);
        setAppRunState({ status: 'none' });
      }
    };
    
    detectApp();
  }, [state.projectPath]);

  // Listen for navigation tracking from injected script (via postMessage)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Log all messages for debugging
      if (event.data && typeof event.data === 'object') {
        logInfo(`[AppRunner] Received postMessage: ${JSON.stringify(event.data)}`);
      }
      // Validate message structure
      if (event.data && event.data.type === 'naide-navigation' && event.data.url) {
        logInfo(`[AppRunner] Navigation tracked: ${event.data.url}`);
        currentIframeUrlRef.current = event.data.url;
        setCurrentIframeUrl(event.data.url);
      }
    };
    
    window.addEventListener('message', handleMessage);
    logInfo('[AppRunner] Started listening for navigation messages');
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Listen for hot reload events from backend
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenFn = await listen('hot-reload-success', () => {
        logInfo('[AppRunner] Hot reload detected, refreshing iframe');
        if (appRunState.status === 'running' && iframeRef.current) {
          // Use the ref for immediate access to the tracked URL (avoids React closure issues)
          const urlToRefresh = currentIframeUrlRef.current || appRunState.proxyUrl || appRunState.url;
          logInfo(`[AppRunner] Hot reload using tracked URL: ${currentIframeUrlRef.current}`);
          if (urlToRefresh) {
            try {
              const url = new URL(urlToRefresh);
              url.searchParams.set('_refresh', Date.now().toString());
              logInfo(`[AppRunner] Refreshing tracked URL: ${url.toString()}`);
              iframeRef.current.src = url.toString();
            } catch (error) {
              logError(`[AppRunner] Failed to refresh iframe: ${error}`);
            }
          }
        }
      });
    };
    
    if (appRunState.status === 'running') {
      setupListener();
    }
    
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [appRunState.status, appRunState.url, appRunState.proxyUrl]);

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
      // For Analyzing mode, use stub response (not ready yet)
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

      // For Planning and Building modes, call the sidecar with streaming
      // Get the project path to use as workspace root
      const projectPath = state.projectPath || await getProjectPath(state.projectName);
      
      // Build conversation context for memory (short-term + mid-term)
      // Include all messages EXCEPT the one we just added (recentMessages are for context)
      const contextMessages = [...messages]; // messages state hasn't updated yet, so this is correct
      const conversationContext = buildConversationContext(contextMessages, conversationSummary);
      
      console.log('[GenerateApp] Sending with conversation context (streaming):', {
        summaryExists: !!conversationContext.summary,
        recentMessagesCount: conversationContext.recentMessages.length,
        totalMessageCount: conversationContext.totalMessageCount,
      });
      
      // Create assistant message placeholder for streaming
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      
      // Add the empty assistant message to the UI
      setMessages(prev => [...prev, assistantMessage]);
      
      try {
        const response = await fetch('http://localhost:3001/api/copilot/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: copilotMode,
            message: userInput,
            workspaceRoot: projectPath,
            conversationContext,
          }),
        });

        if (!response.ok) {
          // Handle non-OK responses
          const errorText = await response.text().catch(() => 'Unknown error');
          setMessages(prev => 
            prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, content: `Error: ${errorText}` }
                : m
            )
          );
          setIsLoading(false);
          
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          return;
        }

        // Process Server-Sent Events stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            console.log('[GenerateApp] Stream complete');
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines (SSE format)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                
                switch (eventData.type) {
                  case 'delta':
                    // Accumulate content and update the message
                    if (eventData.data?.content) {
                      accumulatedContent += eventData.data.content;
                      setMessages(prev => 
                        prev.map(m => 
                          m.id === assistantMessageId 
                            ? { ...m, content: accumulatedContent }
                            : m
                        )
                      );
                    }
                    break;
                    
                  case 'tool_start':
                    console.log('[GenerateApp] Tool started:', eventData.data?.toolName);
                    break;
                    
                  case 'tool_complete':
                    console.log('[GenerateApp] Tool completed:', eventData.data?.toolCallId);
                    break;
                    
                  case 'done':
                    console.log('[GenerateApp] Stream done');
                    // Use the full buffered response for summary extraction (prefer server's buffer)
                    const fullResponse = eventData.data?.fullResponse !== undefined 
                      ? eventData.data.fullResponse 
                      : accumulatedContent;
                    
                    // Extract conversation summary update from the response (if present)
                    const summaryUpdate = parseSummaryFromResponse(fullResponse);
                    if (summaryUpdate) {
                      console.log('[GenerateApp] Updating conversation summary from AI response');
                      setConversationSummary(prev => mergeSummary(prev, summaryUpdate));
                    }
                    
                    // Clean the response for display (remove summary markers)
                    const cleanedReplyText = cleanResponseForDisplay(accumulatedContent);
                    
                    // Update the message with cleaned content
                    setMessages(prev => 
                      prev.map(m => 
                        m.id === assistantMessageId 
                          ? { ...m, content: cleanedReplyText }
                          : m
                      )
                    );
                    break;
                    
                  case 'error':
                    console.error('[GenerateApp] Stream error:', eventData.data?.message);
                    setMessages(prev => 
                      prev.map(m => 
                        m.id === assistantMessageId 
                          ? { ...m, content: `Error: ${eventData.data?.message || 'Unknown error'}` }
                          : m
                      )
                    );
                    break;
                }
              } catch (parseError) {
                console.error('[GenerateApp] Error parsing SSE event:', parseError, line);
              }
            }
          }
        }
        
        setIsLoading(false);
        
        // Focus back on textarea
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } catch (streamError) {
        console.error('[GenerateApp] Error in streaming:', streamError);
        
        // Provide specific error message based on error type
        let errorMessage = 'An error occurred while streaming the response.';
        if (streamError instanceof TypeError && streamError.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the Copilot service. Please make sure the sidecar is running.';
        } else if (streamError instanceof Error && streamError.message.includes('body')) {
          errorMessage = 'Failed to read the streaming response. Please try again.';
        }
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: errorMessage }
              : m
          )
        );
        setIsLoading(false);
        
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
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
      // Clear conversation summary when switching modes in a fresh session
      setConversationSummary(null);
    }
  };

  const handleNewChat = async () => {
    // Check if there are any user messages to save
    const hasUserMessages = messages.some((m) => m.role === 'user');
    
    if (hasUserMessages) {
      try {
        // Archive the current chat session
        const { archiveChatSession } = await import('../utils/chatPersistence');
        const archivedId = await archiveChatSession(
          state.projectName,
          messages,
          copilotMode,
          conversationSummary,
          state.projectPath || undefined
        );
        
        if (archivedId) {
          console.log('[GenerateApp] Archived chat session:', archivedId);
        }
      } catch (error) {
        console.error('[GenerateApp] Error archiving chat session:', error);
        // Continue with new chat even if archiving fails
      }
    }
    
    // Reset state for new chat
    setChatInitialized(false);
    setMessages(getWelcomeMessages(copilotMode));
    setConversationSummary(null);
    
    // Focus the textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLoadChat = async (filename: string) => {
    logInfo(`[GenerateApp] Loading chat from history: ${filename}`);
    
    // Save current chat if it has user messages
    const hasUserMessages = messages.some((m) => m.role === 'user');
    if (hasUserMessages && chatInitialized) {
      try {
        const { saveChatSession } = await import('../utils/chatPersistence');
        await saveChatSession(
          state.projectName,
          messages,
          undefined,
          state.projectPath || undefined
        );
        logInfo('[GenerateApp] Current chat saved before loading from history');
      } catch (error) {
        logError(`[GenerateApp] Error saving current chat: ${error}`);
        // Continue with loading even if save fails
      }
    }
    
    try {
      // Load the selected chat session
      const { loadFullChatSession } = await import('../utils/chatPersistence');
      const session = await loadFullChatSession(
        state.projectName,
        filename,
        state.projectPath || undefined
      );
      
      if (session) {
        logInfo(`[GenerateApp] Loaded chat session from history: ${session.id}`);
        setMessages(session.messages);
        
        // Restore mode if available
        if (session.mode) {
          setCopilotMode(session.mode as CopilotMode);
        }
        
        // Restore summary if available
        if (session.summary) {
          setConversationSummary(session.summary as ConversationSummary);
        } else {
          setConversationSummary(null);
        }
        
        setChatInitialized(true);
        
        // Focus the textarea
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } else {
        logError('[GenerateApp] Failed to load chat session from history');
      }
    } catch (error) {
      logError(`[GenerateApp] Error loading chat from history: ${error}`);
    }
  };

  const handleChatDeleted = async () => {
    logInfo('[GenerateApp] Chat deleted, checking if we need to create a new chat');
    
    // Check if there are any archived chats left
    const { invoke } = await import('@tauri-apps/api/core');
    const actualPath = state.projectPath || await getProjectPath(state.projectName);
    const remainingChats = await invoke<any[]>('list_chat_sessions', {
      projectPath: actualPath,
    });
    
    logInfo(`[GenerateApp] Remaining chats after deletion: ${remainingChats.length}`);
    
    // If no chats remain, or if we just deleted the active chat,
    // create a new empty chat
    const hasUserMessages = messages.some((m) => m.role === 'user');
    
    if (remainingChats.length === 0 || hasUserMessages) {
      logInfo('[GenerateApp] Creating new empty chat after deletion');
      handleNewChat();
    }
  };

  const handleOpenProjectFolder = async () => {
    try {
      // Get the current project path
      const projectPath = state.projectPath || await getProjectPath(state.projectName);
      
      // Save current tabs before switching
      if (state.projectPath) {
        await saveTabsToProject(state.projectPath);
      }
      
      // Open folder selection dialog
      const selectedPath = await open({
        title: 'Select Project Folder',
        directory: true,
        multiple: false,
        defaultPath: projectPath,
      });
      
      if (selectedPath && typeof selectedPath === 'string') {
        console.log('[GenerateApp] Selected project folder:', selectedPath);
        
        // Save the selected path to settings (this also adds to recent projects)
        await saveLastProject(selectedPath);
        console.log('[GenerateApp] Saved project to settings');
        
        // Extract project name from the path (cross-platform)
        const pathParts = selectedPath.split(/[/\\]/);
        const newProjectName = pathParts[pathParts.length - 1];
        
        // Clear conversation summary for new project
        setConversationSummary(null);
        
        // Reset tabs to just chat tab
        resetTabsToChat();
        
        // Update project name and path (this will trigger the loadChat useEffect)
        setProjectName(newProjectName);
        setProjectPath(selectedPath);
        
        // Try to load the project
        const loaded = await loadProject(selectedPath);
        if (loaded) {
          console.log('[GenerateApp] Successfully loaded project:', newProjectName);
          // The loadChat useEffect will automatically load the last chat session
          
          // Load saved tabs for this project
          await loadTabsFromProject(selectedPath);
          
          // Reload recent projects to include the newly opened project
          const projects = await getRecentProjects();
          setRecentProjects(projects);
        } else {
          console.log('[GenerateApp] Project not found, will create on first interaction');
        }
      }
    } catch (error) {
      console.error('[GenerateApp] Error opening project folder:', error);
    }
  };

  const handleToggleDropdown = () => {
    setShowRecentProjects(!showRecentProjects);
  };

  const handleSelectRecentProject = async (projectPath: string) => {
    try {
      console.log('[GenerateApp] Selected recent project:', projectPath);
      
      // Save current tabs before switching
      if (state.projectPath) {
        await saveTabsToProject(state.projectPath);
      }
      
      // Save the selected path to settings (this updates last accessed time)
      await saveLastProject(projectPath);
      console.log('[GenerateApp] Updated project in settings');
      
      // Extract project name from the path (cross-platform)
      const pathParts = projectPath.split(/[/\\]/);
      const newProjectName = pathParts[pathParts.length - 1];
      
      // Clear conversation summary for new project
      setConversationSummary(null);
      
      // Reset tabs to just chat tab
      resetTabsToChat();
      
      // Update project name and path (this will trigger the loadChat useEffect)
      setProjectName(newProjectName);
      setProjectPath(projectPath);
      
      // Try to load the project
      const loaded = await loadProject(projectPath);
      if (loaded) {
        console.log('[GenerateApp] Successfully loaded project:', newProjectName);
        // The loadChat useEffect will automatically load the last chat session
        
        // Load saved tabs for this project
        await loadTabsFromProject(projectPath);
      } else {
        console.log('[GenerateApp] Project not found at path:', projectPath);
        console.log('[GenerateApp] A new project structure will be created on first interaction');
      }
      
      // Close dropdown
      setShowRecentProjects(false);
    } catch (error) {
      console.error('[GenerateApp] Error selecting recent project:', error);
    }
  };

  const handleFeatureFileSelect = (file: FeatureFileNode, clickType: 'single' | 'double') => {
    const isPinned = clickType === 'double';
    handleOpenFeatureTab(file, isPinned);
  };

  const handleOpenFeatureTab = (file: FeatureFileNode, isPinned: boolean) => {
    const tabId = file.path; // Use file path as unique tab ID
    
    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      // If double-clicking an existing temporary tab, promote it to pinned
      if (isPinned && existingTab.isTemporary) {
        setTabs(tabs.map(t => 
          t.id === tabId 
            ? { ...t, isPinned: true, isTemporary: false }
            : t
        ));
      }
      // Switch to the existing tab
      setActiveTabId(tabId);
      setSelectedFeaturePath(file.path);
      return;
    }
    
    // Check if we're at max tabs (10 total)
    const MAX_TABS = 10;
    let newTabs = [...tabs];
    
    if (newTabs.length >= MAX_TABS) {
      // Try to replace a temporary tab
      const tempTabIndex = newTabs.findIndex(t => t.type === 'feature-file' && t.isTemporary);
      if (tempTabIndex >= 0) {
        // Replace the temporary tab
        newTabs.splice(tempTabIndex, 1);
      } else {
        // All tabs are pinned, show warning
        alert('Maximum tabs reached. Close a tab to open another file.');
        return;
      }
    }
    
    // If opening a new temporary tab, close existing temporary tab
    if (!isPinned) {
      newTabs = newTabs.filter(t => !t.isTemporary);
    }
    
    // Create new tab
    const newTab: Tab = {
      id: tabId,
      type: 'feature-file',
      label: file.name,
      filePath: file.path,
      isPinned,
      isTemporary: !isPinned,
      hasUnsavedChanges: false,
    };
    
    newTabs.push(newTab);
    setTabs(newTabs);
    setActiveTabId(tabId);
    setSelectedFeaturePath(file.path);
  };

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.type === 'feature-file') {
      setSelectedFeaturePath(tab.filePath || null);
    } else {
      setSelectedFeaturePath(null);
    }
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((currentTabs) => {
      const tab = currentTabs.find(t => t.id === tabId);
      if (!tab || tab.type === 'chat') {
        return currentTabs; // Don't close chat tab
      }
      
      // Check for unsaved changes
      if (tab.hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Discard?')) {
          return currentTabs;
        }
      }
      
      // Remove the tab
      const newTabs = currentTabs.filter(t => t.id !== tabId);
      
      // If closing the active tab, switch to another tab
      if (activeTabId === tabId) {
        // Find the tab to activate (prefer the one to the left, or the first one)
        const closedIndex = currentTabs.findIndex(t => t.id === tabId);
        const newActiveTab = newTabs[Math.max(0, closedIndex - 1)] || newTabs[0];
        setActiveTabId(newActiveTab.id);
        if (newActiveTab.type === 'feature-file') {
          setSelectedFeaturePath(newActiveTab.filePath || null);
        } else {
          setSelectedFeaturePath(null);
        }
      }
      
      return newTabs;
    });
  };

  const handleCloseAllTabs = () => {
    setTabs((currentTabs) => {
      // Check if any tabs have unsaved changes
      const tabsWithChanges = currentTabs.filter(t => t.type === 'feature-file' && t.hasUnsavedChanges);
      if (tabsWithChanges.length > 0) {
        const fileNames = tabsWithChanges.map(t => t.label).join(', ');
        if (!confirm(`You have unsaved changes in: ${fileNames}. Discard all?`)) {
          return currentTabs;
        }
      }
      
      // Close all feature file tabs, keep only chat tab
      const chatTab = currentTabs.find(t => t.type === 'chat');
      if (chatTab) {
        setActiveTabId(chatTab.id);
        setSelectedFeaturePath(null);
        return [chatTab];
      }
      
      return currentTabs;
    });
  };

  // Helper function to reset tabs to just the chat tab (used when switching projects)
  const resetTabsToChat = () => {
    setTabs((currentTabs) => {
      const chatTab = currentTabs.find(t => t.type === 'chat');
      if (chatTab) {
        setActiveTabId(chatTab.id);
        setSelectedFeaturePath(null);
        return [chatTab];
      }
      return currentTabs;
    });
  };

  // Save current tabs to project config
  const saveTabsToProject = async (projectPath: string) => {
    try {
      // Convert tabs to persisted format (exclude hasUnsavedChanges)
      const persistedTabs: PersistedTab[] = tabs.map(tab => ({
        id: tab.id,
        type: tab.type,
        label: tab.label,
        filePath: tab.filePath,
        isPinned: tab.isPinned,
        isTemporary: tab.isTemporary,
      }));
      
      await saveOpenTabs(projectPath, {
        tabs: persistedTabs,
        activeTabId,
      });
      
      logInfo(`[TabPersistence] Saved ${persistedTabs.length} tabs for project`);
    } catch (error) {
      logError(`[TabPersistence] Error saving tabs: ${error}`);
    }
  };

  // Load tabs from project config
  const loadTabsFromProject = async (projectPath: string) => {
    try {
      const savedState = await loadOpenTabs(projectPath);
      
      if (!savedState || !savedState.tabs || savedState.tabs.length === 0) {
        logInfo('[TabPersistence] No saved tabs found');
        return;
      }
      
      // Validate that files still exist by checking if they're feature files
      // Convert persisted tabs back to full Tab format
      const restoredTabs: Tab[] = savedState.tabs.map(tab => ({
        ...tab,
        hasUnsavedChanges: false, // Always start with no unsaved changes
      }));
      
      // Filter out any tabs for files that might have been deleted
      // Keep chat tab and any feature file tabs (we'll let the component handle missing files)
      const validTabs = restoredTabs.filter(tab => 
        tab.type === 'chat' || (tab.type === 'feature-file' && tab.filePath)
      );
      
      if (validTabs.length > 0) {
        setTabs(validTabs);
        
        // Restore active tab if it still exists, otherwise default to chat
        const activeTab = validTabs.find(t => t.id === savedState.activeTabId);
        if (activeTab) {
          setActiveTabId(savedState.activeTabId);
          if (activeTab.type === 'feature-file') {
            setSelectedFeaturePath(activeTab.filePath || null);
          }
        } else {
          // Active tab no longer exists, default to chat
          const chatTab = validTabs.find(t => t.type === 'chat');
          if (chatTab) {
            setActiveTabId(chatTab.id);
            setSelectedFeaturePath(null);
          }
        }
        
        logInfo(`[TabPersistence] Restored ${validTabs.length} tabs`);
      }
    } catch (error) {
      logError(`[TabPersistence] Error loading tabs: ${error}`);
    }
  };

  const handleTabContentChange = (tabId: string, hasChanges: boolean) => {
    setTabs(tabs.map(t => 
      t.id === tabId 
        ? { ...t, hasUnsavedChanges: hasChanges }
        : t
    ));
  };

  const handleTabSave = (tabId: string) => {
    // Promote to pinned if temporary
    setTabs(tabs.map(t => 
      t.id === tabId 
        ? { ...t, isPinned: true, isTemporary: false, hasUnsavedChanges: false }
        : t
    ));
  };

  const handleTabStartEdit = (tabId: string) => {
    // Promote to pinned if temporary
    setTabs(tabs.map(t => 
      t.id === tabId 
        ? { ...t, isPinned: true, isTemporary: false }
        : t
    ));
  };

  // Handle right column resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: rightColumnWidth,
    };
  };

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) {
        const deltaX = resizeStartRef.current.x - e.clientX; // Inverted because left edge
        const newWidth = Math.max(300, Math.min(800, resizeStartRef.current.width + deltaX)); // Min 300px, Max 800px
        setRightColumnWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingRight) {
        setIsResizingRight(false);
      }
    };

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingRight]);

  // Handle app selection from dropdown
  const handleSelectApp = async (app: { app_type: string; project_file?: string; command?: string }) => {
    if (!state.projectPath) return;
    
    logInfo(`[AppRunner] User selected app: ${app.app_type} ${app.project_file || 'root'}`);
    
    setAppRunState({
      status: 'ready',
      type: app.app_type as 'dotnet' | 'npm',
      projectFile: app.project_file,
      command: app.command,
    });
    setShowAppSelector(false);
    
    // Persist selection
    try {
      const { saveSelectedApp } = await import('../utils/appSelection');
      await saveSelectedApp(state.projectPath, app);
    } catch (error) {
      logError(`[AppRunner] Failed to save app selection: ${error}`);
      // Non-fatal, continue without persistence
    }
  };

  // Handle Play button click
  const handlePlayClick = async () => {
    if (!state.projectPath || appRunState.status !== 'ready') return;
    
    setAppRunState(prev => ({ ...prev, status: 'starting' }));
    logInfo(`[AppRunner] Starting ${appRunState.type} app`);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ pid: number; url?: string }>(
        'start_app',
        {
          projectPath: state.projectPath,
          appInfo: {
            app_type: appRunState.type,
            project_file: appRunState.projectFile,
            command: appRunState.command,
          },
        }
      );
      
      logInfo(`[AppRunner] App started with PID ${result.pid}, URL: ${result.url || 'not detected'}`);
      
      // Now start the proxy to inject tracking script
      let proxyUrl: string | undefined;
      if (result.url) {
        try {
          logInfo(`[AppRunner] Starting proxy for URL: ${result.url}`);
          const proxyResponse = await fetch('http://localhost:3001/api/proxy/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl: result.url }),
          });
          
          if (proxyResponse.ok) {
            const proxyData = await proxyResponse.json();
            proxyUrl = proxyData.proxyUrl;
            logInfo(`[AppRunner] Proxy started: ${proxyUrl} -> ${result.url}`);
          } else {
            logError('[AppRunner] Failed to start proxy, using direct URL');
          }
        } catch (error) {
          logError(`[AppRunner] Failed to start proxy: ${error}, using direct URL`);
        }
      }
      
      setAppRunState({
        status: 'running',
        type: appRunState.type,
        projectFile: appRunState.projectFile,
        command: appRunState.command,
        url: result.url,
        proxyUrl,
        pid: result.pid,
      });
      
      // Reset current URL tracking
      currentIframeUrlRef.current = null;
      setCurrentIframeUrl(null);
    } catch (error) {
      logError(`[AppRunner] Failed to start app: ${error}`);
      setAppRunState({
        status: 'error',
        type: appRunState.type,
        projectFile: appRunState.projectFile,
        command: appRunState.command,
        errorMessage: String(error),
      });
    }
  };

  // Handle Stop button click
  const handleStopClick = async () => {
    if (appRunState.status !== 'running') return;
    
    logInfo('[AppRunner] Stopping app');
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_app');
      
      // Stop the proxy if it was started
      if (appRunState.proxyUrl) {
        try {
          logInfo('[AppRunner] Stopping proxy');
          await fetch('http://localhost:3001/api/proxy/stop', {
            method: 'POST',
          });
          logInfo('[AppRunner] Proxy stopped');
        } catch (error) {
          logError(`[AppRunner] Failed to stop proxy: ${error}`);
        }
      }
      
      logInfo('[AppRunner] App stopped');
      setAppRunState({
        status: 'ready',
        type: appRunState.type,
        projectFile: appRunState.projectFile,
        command: appRunState.command,
      });
      
      // Clear current URL tracking
      currentIframeUrlRef.current = null;
      setCurrentIframeUrl(null);
    } catch (error) {
      logError(`[AppRunner] Failed to stop app: ${error}`);
      setAppRunState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: String(error),
        command: prev.command,
      }));
    }
  };

  // Handle Refresh button click
  const handleRefreshClick = () => {
    if (appRunState.status === 'running' && iframeRef.current) {
      logInfo('[AppRunner] Refreshing iframe (bypassing cache)');
      // Use the ref for immediate access to the tracked URL (avoids React closure issues)
      const urlToRefresh = currentIframeUrlRef.current || appRunState.proxyUrl || appRunState.url || '';
      logInfo(`[AppRunner] Current tracked URL: ${currentIframeUrlRef.current}, using: ${urlToRefresh}`);
      if (urlToRefresh) {
        try {
          const url = new URL(urlToRefresh);
          // Remove old refresh param if exists
          url.searchParams.delete('_refresh');
          url.searchParams.set('_refresh', Date.now().toString());
          logInfo(`[AppRunner] Refreshing to: ${url.toString()}`);
          iframeRef.current.src = url.toString();
        } catch {
          // If URL parsing fails, just refresh as-is
          logInfo(`[AppRunner] Refreshing to: ${urlToRefresh}`);
          iframeRef.current.src = urlToRefresh;
        }
      }
    }
  };

  return (
    <div className="h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Naide</h1>
        <div className="flex items-center gap-2 relative" ref={dropdownRef}>
          {/* Current project button with dropdown */}
          <button
            onClick={handleToggleDropdown}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-100 rounded-lg transition-colors flex items-center gap-2"
            title="Recent projects"
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
            <svg
              className={`w-4 h-4 transition-transform ${showRecentProjects ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Open project folder button */}
          <button
            onClick={handleOpenProjectFolder}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-gray-100 rounded-lg transition-colors"
            title="Open a different project folder"
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
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
          </button>

          {/* Recent projects dropdown */}
          {showRecentProjects && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              {recentProjects.length > 0 ? (
                <div className="py-2">
                  {recentProjects.map((project, index) => {
                    const projectName = project.path.split(/[/\\]/).pop() || project.path;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSelectRecentProject(project.path)}
                        className="w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors text-gray-100 flex flex-col"
                      >
                        <span className="text-sm font-medium">{projectName}</span>
                        <span className="text-xs text-gray-400 truncate">{project.path}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                  No recent projects
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content area - 3 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Navigation Sidebar */}
        <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
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
          
          {/* Divider and Features section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Features
              </h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <FeatureFilesViewer 
                onFileSelect={handleFeatureFileSelect}
                selectedPath={selectedFeaturePath}
              />
            </div>
          </div>
        </div>

        {/* Center: Tabbed Area (Chat + Feature Files) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleCloseTab}
            onTabCloseAll={handleCloseAllTabs}
          />

          {/* Chat Tab Content - hidden with CSS when not active to preserve state */}
          <div 
            className="flex-1 flex flex-col overflow-hidden"
            style={{ display: activeTabId === 'generate-app' ? 'flex' : 'none' }}
          >
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
                {messages.map((message, idx) => {
                  const finalMessageInList = idx === messages.length - 1;
                  const applyWorkingVisual = message.role === 'assistant' && isLoading && finalMessageInList;
                  
                  const computedBlueShade = applyWorkingVisual 
                    ? computePulsingBlueColor(visualIntensity)
                    : 'rgb(37, 99, 235)';
                  
                  return (
                  <div key={message.id} className="flex gap-3">
                    {message.role === 'assistant' && (
                      <div 
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: computedBlueShade,
                          opacity: applyWorkingVisual ? visualIntensity : 1.0,
                        }}
                      >
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
                        {message.role === 'assistant' && !message.content && isLoading ? (
                          <p className="text-gray-400 animate-pulse">Copilot is working on your request...</p>
                        ) : (
                          <MessageContent content={message.content} role={message.role} />
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
                {/* Loading indicator - only shown before assistant placeholder is added */}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex gap-3">
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: computePulsingBlueColor(visualIntensity),
                        opacity: visualIntensity,
                      }}
                    >
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
                    <div className="flex-1">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <p className="text-gray-400">Copilot is thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Status Bar - between chat and input */}
            <ActivityStatusBar />

            {/* Input row */}
            <div className="border-t border-zinc-800 p-6">
              <div className="max-w-3xl mx-auto">
                {/* Mode selector with New Chat and Chat History buttons */}
                <div className="mb-3 flex items-center gap-2">
                  {/* New Chat button */}
                  <button
                    onClick={handleNewChat}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-gray-100 transition-colors"
                    title="New Chat"
                    aria-label="Start new chat"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                  {/* Chat History button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowChatHistory(!showChatHistory)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-gray-100 transition-colors"
                      title="View chat history"
                      aria-label="View chat history"
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
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                    <ChatHistoryDropdown
                      projectName={state.projectName}
                      projectPath={state.projectPath || undefined}
                      onLoadChat={handleLoadChat}
                      onChatDeleted={handleChatDeleted}
                      isOpen={showChatHistory}
                      onClose={() => setShowChatHistory(false)}
                    />
                  </div>
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

          {/* Feature File Tabs Content */}
          {tabs.filter(t => t.type === 'feature-file').map(tab => (
            <div 
              key={tab.id}
              className="flex-1 overflow-hidden"
              style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
            >
              {state.projectPath && tab.filePath && (
                <FeatureFileTab
                  filePath={tab.filePath}
                  fileName={tab.label}
                  projectPath={state.projectPath}
                  isActive={activeTabId === tab.id}
                  onContentChange={(hasChanges) => handleTabContentChange(tab.id, hasChanges)}
                  onSave={() => handleTabSave(tab.id)}
                  onStartEdit={() => handleTabStartEdit(tab.id)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Right: Running App Preview */}
        <div 
          className="relative bg-zinc-900 border-l border-zinc-800 overflow-y-auto"
          style={{ width: `${rightColumnWidth}px` }}
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 hover:w-1.5 bg-transparent hover:bg-blue-500 cursor-ew-resize transition-all z-10"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          />
          
          <div className="p-6">
            {/* Header with Play/Stop button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Running App</h3>
              
              {/* Play/Stop button */}
              {appRunState.status === 'ready' && (
                <button
                  onClick={handlePlayClick}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 transition-colors"
                  title="Run app"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
              
              {appRunState.status === 'starting' && (
                <button
                  disabled
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 cursor-not-allowed"
                  title="Starting..."
                >
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </button>
              )}
              
              {appRunState.status === 'running' && (
                <div className="flex gap-2">
                  {/* Refresh button */}
                  <button
                    onClick={handleRefreshClick}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
                    title="Refresh app"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  {/* Stop button */}
                  <button
                    onClick={handleStopClick}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
                    title="Stop app"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </button>
                </div>
              )}
              
              {appRunState.status === 'error' && (
                <button
                  onClick={handlePlayClick}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
                  title="Retry"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Content based on status */}
            {appRunState.status === 'none' && (
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
                <p className="text-gray-300 mb-2">No runnable app detected</p>
                <p className="text-sm text-gray-500">This project doesn't appear to have a web app</p>
              </div>
            )}

            {appRunState.status === 'detecting' && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-blue-500 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-gray-300">Detecting runnable app...</p>
              </div>
            )}

            {appRunState.status === 'ready' && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 text-green-500 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-300 mb-2">Ready to run</p>
                
                {/* App info with dropdown if multiple apps */}
                <div className="text-sm text-gray-500">
                  Detected: {appRunState.type} app
                  {appRunState.projectFile && (
                    <><br /><span className="text-xs">{appRunState.projectFile}</span></>
                  )}
                  
                  {/* Dropdown for multiple apps */}
                  <AppSelectorDropdown
                    apps={detectedApps}
                    selectedApp={{ type: appRunState.type, projectFile: appRunState.projectFile }}
                    isOpen={showAppSelector}
                    onToggle={() => setShowAppSelector(!showAppSelector)}
                    onSelect={handleSelectApp}
                    buttonText="Switch app"
                    dropdownRef={appSelectorRef}
                  />
                </div>
              </div>
            )}

            {appRunState.status === 'starting' && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-blue-500 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-gray-300 mb-2">Starting app...</p>
                <p className="text-sm text-gray-500">This may take a few moments</p>
              </div>
            )}

            {appRunState.status === 'running' && (
              <>
                {appRunState.url && (
                  <div className="mb-4 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
                    <p className="text-sm text-gray-400">
                      Current:{' '}
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {displayUrl}
                      </a>
                    </p>
                  </div>
                )}
                
                {appRunState.url ? (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 250px)' }}>
                    <iframe
                      ref={iframeRef}
                      src={appRunState.proxyUrl || appRunState.url}
                      className="w-full h-full"
                      title="Running App"
                      onLoad={() => logInfo(`[AppRunner] iframe loaded: ${iframeRef.current?.src || 'unknown'}`)}
                    />
                  </div>
                ) : (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center">
                    <p className="text-gray-300 mb-2">App is running</p>
                    <p className="text-sm text-gray-500">URL not detected. Check terminal for localhost address.</p>
                  </div>
                )}
              </>
            )}

            {appRunState.status === 'error' && (
              <div className="bg-zinc-800 border border-red-900/50 rounded-lg p-8 text-center">
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 text-red-500 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-red-400 mb-2">Failed to start app</p>
                {appRunState.errorMessage && (
                  <p className="text-sm text-gray-400 font-mono mt-4 text-left bg-zinc-900 p-3 rounded">
                    {appRunState.errorMessage}
                  </p>
                )}
                
                {/* Dropdown for multiple apps - allow switching after error */}
                <AppSelectorDropdown
                  apps={detectedApps}
                  selectedApp={{ type: appRunState.type, projectFile: appRunState.projectFile }}
                  isOpen={showAppSelector}
                  onToggle={() => setShowAppSelector(!showAppSelector)}
                  onSelect={handleSelectApp}
                  buttonText="Try different app"
                  dropdownRef={appSelectorRef}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateAppScreen;
