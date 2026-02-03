import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';

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

export class StatusEventEmitter extends EventEmitter {
  private idCounter = 0;

  emitStatus(
    type: StatusEventType,
    status: StatusEventStatus,
    message: string,
    details?: string
  ): StatusEvent {
    const event: StatusEvent = {
      id: `status-${Date.now()}-${this.idCounter++}`,
      type,
      status,
      message,
      details,
      timestamp: Date.now(),
    };

    this.emit('status', event);
    return event;
  }

  emitFileRead(filePath: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('file_read', status, `Reading ${filePath}`, filePath);
  }

  emitFileWrite(filePath: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('file_write', status, `Writing ${filePath}`, filePath);
  }

  emitAnalysis(message: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('analysis', status, message);
  }

  emitBuild(message: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('build', status, message);
  }

  emitTest(message: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('test', status, message);
  }

  emitApiCall(message: string, status: StatusEventStatus = 'in_progress'): StatusEvent {
    return this.emitStatus('api_call', status, message);
  }
}

// Create a WebSocket server for status events
export function createStatusWebSocketServer(
  server: any,
  statusEmitter: StatusEventEmitter
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request: any, socket: any, head: any) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    
    if (pathname === '/api/status') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Broadcast status events to all connected clients
  wss.on('connection', (ws: WebSocket) => {
    console.log('[StatusWS] Client connected');

    const statusHandler = (event: StatusEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    };

    statusEmitter.on('status', statusHandler);

    ws.on('close', () => {
      console.log('[StatusWS] Client disconnected');
      statusEmitter.off('status', statusHandler);
    });

    ws.on('error', (error) => {
      console.error('[StatusWS] WebSocket error:', error);
    });
  });

  return wss;
}
