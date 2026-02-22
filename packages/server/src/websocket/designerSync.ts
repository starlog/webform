import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { DesignerWsMessage } from '@webform/common';

const rooms = new Map<string, Set<WebSocket>>();

export function handleDesignerConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  if (!rooms.has(formId)) {
    rooms.set(formId, new Set());
  }
  rooms.get(formId)!.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as DesignerWsMessage;

      if (!message.type || !message.payload) {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_MESSAGE', message: 'Missing type or payload' },
        }));
        return;
      }

      const clients = rooms.get(formId);
      if (!clients) return;

      const serialized = JSON.stringify(message);
      for (const client of clients) {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(serialized);
        }
      }
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
      }));
    }
  });

  ws.on('close', () => {
    rooms.get(formId)?.delete(ws);
    if (rooms.get(formId)?.size === 0) {
      rooms.delete(formId);
    }
  });
}

export function broadcastToDesigners(formId: string, message: DesignerWsMessage): void {
  const clients = rooms.get(formId);
  if (!clients) return;

  const serialized = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(serialized);
    }
  }
}
