import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

export function handleRuntimeConnection(ws: WebSocket, _req: IncomingMessage): void {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      ws.send(JSON.stringify({
        type: 'eventResult',
        payload: {
          success: true,
          patches: [],
          _echo: message,
        },
      }));
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
      }));
    }
  });

  ws.on('close', () => {
    // 정리 로직
  });
}
