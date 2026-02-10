import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileEdit,
  Brain,
  Hammer,
  FlaskConical,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export type StatusEventType = 'file_read' | 'file_write' | 'analysis' | 'build' | 'test' | 'api_call' | 'session_complete';
export type StatusEventStatus = 'in_progress' | 'complete' | 'error';

export interface StatusEvent {
  id: string;
  type: StatusEventType;
  status: StatusEventStatus;
  message: string;
  details?: string;
  timestamp: number;
}

const AUTO_REMOVE_DELAY = 2000; // 2 seconds
const DEFAULT_HEIGHT = 120; // ~5 lines
const MAX_HEIGHT = 240; // ~10 lines
const MIN_HEIGHT = 24; // very small minimum

const getIconForEvent = (event: StatusEvent) => {
  // Status-based icons take precedence
  if (event.status === 'in_progress') {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }
  if (event.status === 'complete') {
    return <CheckCircle className="w-4 h-4" />;
  }
  if (event.status === 'error') {
    return <XCircle className="w-4 h-4" />;
  }

  // Type-based icons for other cases
  switch (event.type) {
    case 'file_read':
      return <Search className="w-4 h-4" />;
    case 'file_write':
      return <FileEdit className="w-4 h-4" />;
    case 'analysis':
      return <Brain className="w-4 h-4" />;
    case 'build':
      return <Hammer className="w-4 h-4" />;
    case 'test':
      return <FlaskConical className="w-4 h-4" />;
    case 'api_call':
      return <Bot className="w-4 h-4" />;
    default:
      return <Bot className="w-4 h-4" />;
  }
};

const getColorForStatus = (status: StatusEventStatus): string => {
  switch (status) {
    case 'in_progress':
      return 'text-blue-400';
    case 'complete':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const truncatePath = (path: string, maxLength: number = 60): string => {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return '...' + path.slice(-(maxLength - 3));
};

const ActivityStatusBar: React.FC = () => {
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [paneHeight, setPaneHeight] = useState<number>(DEFAULT_HEIGHT);
  const wsRef = useRef<WebSocket | null>(null);
  const removeTimersRef = useRef<Map<string, number>>(new Map());
  const autoHideTimerRef = useRef<number | null>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);

  // WebSocket connection management
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001/api/status');

      ws.onopen = () => {
        console.log('[ActivityStatusBar] Connected to status WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const statusEvent: StatusEvent = JSON.parse(event.data);
          
          // Handle session_complete - auto-hide after 10 seconds
          if (statusEvent.type === 'session_complete') {
            if (autoHideTimerRef.current) {
              window.clearTimeout(autoHideTimerRef.current);
            }
            autoHideTimerRef.current = window.setTimeout(() => {
              setStatusEvents([]);
              autoHideTimerRef.current = null;
            }, 10000); // 10 seconds
            return; // Don't add session_complete to the events list
          }
          
          setStatusEvents((prev) => {
            // Check if we should update an existing event (same file path for file operations)
            // This prevents duplicates when we get in_progress followed by complete
            if (statusEvent.details && (statusEvent.type === 'file_read' || statusEvent.type === 'file_write')) {
              const existingIndex = prev.findIndex(
                e => e.details === statusEvent.details && 
                     e.type === statusEvent.type &&
                     e.status === 'in_progress'
              );
              
              if (existingIndex >= 0 && statusEvent.status === 'complete') {
                // Replace the in_progress event with the complete event
                const updated = [...prev];
                updated[existingIndex] = statusEvent;
                return updated;
              }
            }
            
            // Add new event
            const updated = [...prev, statusEvent];
            return updated;
          });

          // Auto-remove completed events after delay
          if (statusEvent.status === 'complete') {
            const timer = window.setTimeout(() => {
              setStatusEvents((prev) => prev.filter((e) => e.id !== statusEvent.id));
              removeTimersRef.current.delete(statusEvent.id);
            }, AUTO_REMOVE_DELAY);
            
            removeTimersRef.current.set(statusEvent.id, timer);
          }
        } catch (error) {
          console.error('[ActivityStatusBar] Error parsing status event:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[ActivityStatusBar] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[ActivityStatusBar] WebSocket closed, attempting to reconnect...');
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      // Clear all removal timers
      removeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removeTimersRef.current.clear();
      
      // Clear auto-hide timer
      if (autoHideTimerRef.current) {
        window.clearTimeout(autoHideTimerRef.current);
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [statusEvents]);

  // Resize handler — drag up to expand, drag down to shrink
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = paneHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + deltaY));
      setPaneHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Don't render if no events
  if (statusEvents.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900 border-t border-zinc-700 font-mono text-xs relative">
      {/* Resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-zinc-600 transition-colors z-10"
        onMouseDown={handleResizeStart}
      />
      {/* Scrollable events container */}
      <div
        ref={eventsContainerRef}
        className="overflow-y-auto px-4 py-2 pt-3"
        style={{ maxHeight: `${paneHeight}px` }}
      >
        <div className="max-w-3xl mx-auto space-y-1">
          {statusEvents.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-2 ${getColorForStatus(event.status)}`}
            >
              <span className="flex-shrink-0">{getIconForEvent(event)}</span>
              <span className="truncate">{truncatePath(event.message)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityStatusBar;
