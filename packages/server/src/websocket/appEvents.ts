import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type {
  EventRequest,
  ShellEventRequest,
  ApplicationShellDefinition,
} from '@webform/common';
import { Form } from '../models/Form.js';
import { ShellService } from '../services/ShellService.js';
import { EventEngine } from '../services/EventEngine.js';
import type { ShellDocument } from '../models/Shell.js';

const eventEngine = new EventEngine();
const shellService = new ShellService();

/** App WebSocket 메시지 타입 (RuntimeWsMessage + initAppState) */
interface AppWsMessage {
  type: string;
  payload?: unknown;
}

/** ShellDocument → ApplicationShellDefinition 변환 */
function toShellDef(shell: ShellDocument): ApplicationShellDefinition {
  return {
    id: shell._id.toString(),
    projectId: shell.projectId,
    name: shell.name,
    version: shell.version,
    properties: shell.properties,
    controls: shell.controls,
    eventHandlers: shell.eventHandlers,
    startFormId: shell.startFormId,
  };
}

export function handleAppConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  // /ws/runtime/app/:projectId
  const projectId = url.pathname.split('/').pop() ?? '';

  // 클라이언트별 appState 관리
  let appState: Record<string, unknown> = {};

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as AppWsMessage;

      if (message.type === 'initAppState') {
        // 클라이언트에서 초기 appState 전송
        appState =
          (message as { payload: Record<string, unknown> }).payload || {};
        return;
      }

      if (message.type !== 'event') {
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: {
              code: 'INVALID_TYPE',
              message: `Unsupported message type: ${message.type}`,
            },
          }),
        );
        return;
      }

      const payload = message.payload as EventRequest;
      const scope = payload.scope ?? 'form';

      if (scope === 'shell') {
        await handleShellEvent(ws, projectId, payload, appState);
      } else {
        await handleFormEvent(ws, payload);
      }
    } catch {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
        }),
      );
    }
  });

  ws.on('close', () => {
    // 정리 로직
  });
}

async function handleShellEvent(
  ws: WebSocket,
  projectId: string,
  payload: EventRequest,
  appState: Record<string, unknown>,
): Promise<void> {
  const shell = await shellService.getPublishedShell(projectId);
  if (!shell) {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: {
          code: 'SHELL_NOT_FOUND',
          message: 'Shell not found or not published',
        },
      }),
    );
    return;
  }

  const shellDef = toShellDef(shell);

  // EventRequest → ShellEventRequest 변환
  const shellReq: ShellEventRequest = {
    projectId,
    controlId: payload.controlId,
    eventName: payload.eventName,
    eventArgs: payload.eventArgs,
    shellState: payload.formState, // formState 필드를 shellState로 매핑
    currentFormId: payload.formId,
  };

  const result = await eventEngine.executeShellEvent(projectId, shellReq, shellDef, appState);

  ws.send(
    JSON.stringify({
      type: 'eventResult',
      payload: result,
    }),
  );

  if (result.success && result.patches.length > 0) {
    // appState 업데이트 (서버 측 상태 반영)
    for (const patch of result.patches) {
      if (patch.type === 'updateAppState') {
        Object.assign(appState, patch.payload);
      }
    }

    ws.send(
      JSON.stringify({
        type: 'uiPatch',
        payload: result.patches,
        scope: 'shell',
      }),
    );
  }
}

async function handleFormEvent(ws: WebSocket, payload: EventRequest): Promise<void> {
  const formId = payload.formId;
  const form = await Form.findById(formId);
  if (!form || form.status !== 'published') {
    ws.send(
      JSON.stringify({
        type: 'error',
        payload: {
          code: 'FORM_NOT_FOUND',
          message: 'Form not found or not published',
        },
      }),
    );
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

  ws.send(
    JSON.stringify({
      type: 'eventResult',
      payload: result,
    }),
  );

  if (result.success && result.patches.length > 0) {
    ws.send(
      JSON.stringify({
        type: 'uiPatch',
        payload: result.patches,
        scope: 'form',
      }),
    );
  }
}
