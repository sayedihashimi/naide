import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, Star } from 'lucide-react';
import { getProjectPath } from '../utils/fileSystem';
import ConfirmDialog from './ConfirmDialog';

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
  onChatDeleted: () => void; // Callback when a chat is deleted (to refresh if needed)
  isOpen: boolean;
  onClose: () => void;
  favoriteSessions: string[];
  onToggleFavorite: (filename: string) => void;
}

const ChatHistoryDropdown: React.FC<ChatHistoryDropdownProps> = ({
  projectName,
  projectPath,
  onLoadChat,
  onChatDeleted,
  isOpen,
  onClose,
  favoriteSessions,
  onToggleFavorite,
}) => {
  const [chatSessions, setChatSessions] = useState<ChatSessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    filename: string;
    chatInfo: string;
  }>({
    isOpen: false,
    filename: '',
    chatInfo: '',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadChatSessions = useCallback(async () => {
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
  }, [projectName, projectPath]);

  // Load chat sessions when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadChatSessions();
    }
  }, [isOpen, loadChatSessions]);

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

  const handleToggleFavoriteClick = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chat selection
    onToggleFavorite(filename);
  };

  const handleDeleteClick = (session: ChatSessionMetadata, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chat selection
    
    // Format chat info for confirmation dialog
    const chatInfo = `Date: ${formatDate(session.last_modified)}\nMode: ${session.mode}\nMessages: ${session.message_count}`;
    
    setConfirmDialog({
      isOpen: true,
      filename: session.filename,
      chatInfo,
    });
  };

  const handleConfirmDelete = async () => {
    const { filename } = confirmDialog;
    
    try {
      const actualPath = projectPath || await getProjectPath(projectName);
      
      // Call backend to delete (move to trash)
      await invoke('delete_chat_session', {
        projectPath: actualPath,
        filename,
      });
      
      // Close confirmation dialog
      setConfirmDialog({ isOpen: false, filename: '', chatInfo: '' });
      
      // Reload chat list
      await loadChatSessions();
      
      // Notify parent that a chat was deleted
      onChatDeleted();
      
      console.log(`[ChatHistory] Chat moved to trash: ${filename}`);
    } catch (error) {
      console.error('[ChatHistory] Error deleting chat:', error);
      setError('Failed to move chat to trash');
      setConfirmDialog({ isOpen: false, filename: '', chatInfo: '' });
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialog({ isOpen: false, filename: '', chatInfo: '' });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    
    // Reset time to midnight for accurate day comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = nowOnly.getTime() - dateOnly.getTime();
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
      className="absolute bottom-full left-0 mb-2 w-96 max-h-96 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50"
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
          {(() => {
            // Split chats into favorites and non-favorites in a single pass
            const favoritedChats: ChatSessionMetadata[] = [];
            const otherChats: ChatSessionMetadata[] = [];
            
            for (const session of chatSessions) {
              if (favoriteSessions.includes(session.filename)) {
                favoritedChats.push(session);
              } else {
                otherChats.push(session);
              }
            }

            const renderChatItem = (session: ChatSessionMetadata) => {
              const isFavorited = favoriteSessions.includes(session.filename);
              
              return (
                <div
                  key={session.filename}
                  className="relative group border-b border-zinc-700 last:border-b-0"
                >
                  <div className="flex items-start hover:bg-zinc-700 transition-colors">
                    {/* Star icon button */}
                    <button
                      onClick={(e) => handleToggleFavoriteClick(session.filename, e)}
                      className="flex-shrink-0 p-3 pl-4 hover:scale-110 transition-transform"
                      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star
                        size={16}
                        className={isFavorited
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-zinc-600 hover:text-zinc-400"
                        }
                      />
                    </button>
                    
                    {/* Chat content button */}
                    <button
                      onClick={() => handleChatClick(session.filename)}
                      className="flex-1 text-left py-3 pr-4"
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
                  </div>
                  
                  {/* Delete button - shows on hover */}
                  <button
                    onClick={(e) => handleDeleteClick(session, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Delete chat"
                    title="Move to trash"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            };

            return (
              <>
                {/* Favorites section */}
                {favoritedChats.map(renderChatItem)}
                
                {/* Separator between favorites and other chats */}
                {favoritedChats.length > 0 && otherChats.length > 0 && (
                  <div className="border-b border-zinc-700 my-1"></div>
                )}
                
                {/* Other chats section */}
                {otherChats.map(renderChatItem)}
              </>
            );
          })()}
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Move Chat to Trash?"
        message={`This chat will be moved to trash and removed from your history.\n\n${confirmDialog.chatInfo}`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        destructive={false}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default ChatHistoryDropdown;
