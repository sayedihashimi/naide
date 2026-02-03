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

export type StatusEventType = 'file_read' | 'file_write' | 'analysis' | 'build' | 'test' | 'api_call';
export type StatusEventStatus = 'in_progress' | 'complete' | 'error';

export interface StatusEvent {
  id: string;
  type: StatusEventType;
  status: StatusEventStatus;
  message: string;
  details?: string;
  timestamp: number;
}

const MAX_VISIBLE_EVENTS = 3;
const AUTO_REMOVE_DELAY = 2000; // 2 seconds

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
  const wsRef = useRef<WebSocket | null>(null);
  const removeTimersRef = useRef<Map<string, number>>(new Map());

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
          
          setStatusEvents((prev) => {
            // Add new event
            const updated = [...prev, statusEvent];
            
            // Keep only last MAX_VISIBLE_EVENTS
            const trimmed = updated.slice(-MAX_VISIBLE_EVENTS);
            
            return trimmed;
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
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Don't render if no events
  if (statusEvents.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900 border-t border-zinc-700 px-4 py-3 font-mono text-xs">
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
  );
};

export default ActivityStatusBar;
