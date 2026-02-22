import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

const rooms = new Map<string, Set<WebSocket>>();

export function handleDesignerConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  if (!rooms.has(formId)) {
    rooms.set(formId, new Set());
  }
  rooms.get(formId)!.add(ws);

  ws.on('message', (data) => {
    const clients = rooms.get(formId);
    if (!clients) return;

    for (const client of clients) {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on('close', () => {
    rooms.get(formId)?.delete(ws);
    if (rooms.get(formId)?.size === 0) {
      rooms.delete(formId);
    }
  });
}
