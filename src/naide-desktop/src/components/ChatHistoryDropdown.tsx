import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getProjectPath } from '../utils/fileSystem';

interface ChatSessionMetadata {
  filename: string;
  last_modified: number;
  message_count: number;
  mode: string;
  first_user_message: string;
}

interface ChatHistoryDropdownProps {
  projectName: string;
  projectPath?: string;
  onLoadChat: (filename: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ChatHistoryDropdown: React.FC<ChatHistoryDropdownProps> = ({
  projectName,
  projectPath,
  onLoadChat,
  isOpen,
  onClose,
}) => {
  const [chatSessions, setChatSessions] = useState<ChatSessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadChatSessions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const actualPath = projectPath || await getProjectPath(projectName);
      const sessions = await invoke<ChatSessionMetadata[]>('list_chat_sessions', {
        projectPath: actualPath,
      });
      
      setChatSessions(sessions);
    } catch (err) {
      console.error('[ChatHistory] Error loading chat sessions:', err);
      setError('Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  };

  // Load chat sessions when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadChatSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectName, projectPath]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  const handleChatClick = (filename: string) => {
    onLoadChat(filename);
    onClose();
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Today
    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    // Yesterday
    if (diffDays === 1) {
      return 'Yesterday';
    }
    
    // Within last week
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // Older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateMessage = (message: string, maxLength: number = 50): string => {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  };

  const getModeColor = (mode: string): string => {
    switch (mode) {
      case 'Planning':
        return 'text-green-400';
      case 'Building':
        return 'text-blue-400';
      case 'Analyzing':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 w-96 max-h-96 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50"
    >
      {isLoading && (
        <div className="p-4 text-center text-gray-400">
          Loading chat history...
        </div>
      )}

      {error && (
        <div className="p-4 text-center text-red-400">
          {error}
        </div>
      )}

      {!isLoading && !error && chatSessions.length === 0 && (
        <div className="p-4 text-center text-gray-400">
          No archived chats yet
        </div>
      )}

      {!isLoading && !error && chatSessions.length > 0 && (
        <div className="overflow-y-auto max-h-96">
          {chatSessions.map((session) => (
            <button
              key={session.filename}
              onClick={() => handleChatClick(session.filename)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-b-0"
            >
              <div className="text-sm font-semibold text-gray-200 mb-1">
                {formatDate(session.last_modified)}
              </div>
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className={getModeColor(session.mode)}>
                  {session.mode}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-500">
                  {session.message_count} message{session.message_count !== 1 ? 's' : ''}
                </span>
              </div>
              {session.first_user_message && (
                <div className="text-xs text-zinc-400">
                  {truncateMessage(session.first_user_message)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistoryDropdown;
