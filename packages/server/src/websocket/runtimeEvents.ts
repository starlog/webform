import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { EventRequest, RuntimeWsMessage } from '@webform/common';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';

const eventEngine = new EventEngine();

export function handleRuntimeConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as RuntimeWsMessage;

      if (message.type !== 'event') {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_TYPE', message: `Unsupported message type: ${message.type}` },
        }));
        return;
      }

      const payload = message.payload as EventRequest;

      const form = await Form.findById(formId);
      if (!form || form.status !== 'published') {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'FORM_NOT_FOUND', message: 'Form not found or not published' },
        }));
        return;
      }

      const formDef = {
        id: form._id.toString(),
        name: form.name,
        version: form.version,
        properties: form.properties,
        controls: form.controls,
        eventHandlers: form.eventHandlers,
        dataBindings: form.dataBindings,
      };

      const result = await eventEngine.executeEvent(formId, payload, formDef);

      ws.send(JSON.stringify({
        type: 'eventResult',
        payload: result,
      }));

      if (result.success && result.patches.length > 0) {
        ws.send(JSON.stringify({
          type: 'uiPatch',
          payload: result.patches,
        }));
      }
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
