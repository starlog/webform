import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '@webform/common';
import { apiClient, ApiError, validateObjectId, withOptimisticRetry } from '../utils/index.js';

// --- API 응답 타입 ---

interface EventHandlerDefinition {
  controlId: string;
  eventName: string;
  handlerType: 'server' | 'client';
  handlerCode: string;
}

interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: Array<{ id: string; name: string; type: string; [key: string]: unknown }>;
  eventHandlers: EventHandlerDefinition[];
}

interface GetFormResponse {
  data: FormData;
}

interface MutateFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
  };
}

interface RuntimeEventResponse {
  success: boolean;
  patches: Array<{
    type: string;
    target: string;
    payload: Record<string, unknown>;
  }>;
  error?: string;
  logs?: Array<{
    level: string;
    message: string;
    timestamp?: number;
  }>;
  errorLine?: number;
}

// --- 헬퍼 ---

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

// --- 커스텀 에러 ---

class HandlerExistsError extends Error {
  constructor(
    public controlId: string,
    public eventName: string,
  ) {
    super(`Handler already exists: ${controlId}.${eventName}`);
  }
}

class HandlerNotFoundError extends Error {
  constructor(
    public controlId: string,
    public eventName: string,
  ) {
    super(`Handler not found: ${controlId}.${eventName}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`Control not found: ${controlId}`);
  }
}

// --- withEventHandlerMutation: get → 조작 → put (낙관적 잠금 + 자동 재시도) ---

async function withEventHandlerMutation<T>(
  formId: string,
  mutate: (form: FormData) => T,
  maxRetries = 2,
): Promise<{ result: T; form: FormData; updatedVersion: number }> {
  const { result, data: form } = await withOptimisticRetry({
    fetch: async () => {
      const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
      return res.data;
    },
    mutate,
    save: async (form) => {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        eventHandlers: form.eventHandlers,
      });
      form.version = updated.data.version;
    },
    maxRetries,
  });
  return { result, form, updatedVersion: form.version };
}

// --- 공통 에러 핸들러 ---

function handleEventToolError(error: unknown, formId: string) {
  if (error instanceof HandlerExistsError) {
    return toolError(
      `이미 존재하는 핸들러입니다: controlId=${error.controlId}, eventName=${error.eventName}. update_event_handler를 사용하세요.`,
    );
  }
  if (error instanceof HandlerNotFoundError) {
    return toolError(
      `핸들러를 찾을 수 없습니다: controlId=${error.controlId}, eventName=${error.eventName}`,
    );
  }
  if (error instanceof ControlNotFoundError) {
    return toolError(`컨트롤을 찾을 수 없습니다: controlId=${error.controlId}`);
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return toolError(`폼을 찾을 수 없습니다: ${formId}`);
    if (error.status === 409) {
      return toolError(
        '버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. 다시 시도하세요.',
      );
    }
    return toolError(error.message);
  }
  if (error instanceof Error) {
    if (error.message.includes('유효하지 않은')) return toolError(error.message);
  }
  throw error;
}

// --- Tool 등록 ---

export function registerEventTools(server: McpServer): void {
  // 1. add_event_handler
  server.tool(
    'add_event_handler',
    `폼의 컨트롤에 이벤트 핸들러를 등록합니다. 내부적으로 get_form → eventHandlers 배열 추가 → update_form 패턴으로 동작합니다.

핸들러 코드는 TypeScript로 작성하며, ctx 객체를 통해 컨트롤 조작/메시지 표시/HTTP 요청 등을 수행합니다:
- ctx.controls['컨트롤이름'].text/checked/value/... (읽기/쓰기)
- ctx.sender: 이벤트 발생 컨트롤의 현재 상태
- ctx.eventArgs: 이벤트 인자 ({type, timestamp, ...})
- ctx.showMessage(text, title?, type?): 메시지 대화상자 ('info'|'warning'|'error')
- ctx.navigate(formId, params?): 다른 폼으로 이동
- ctx.http.get/post/put/patch/delete(url, body?): HTTP 요청 → {status, ok, data}
- ctx.getRadioGroupValue(groupName): 라디오 그룹 선택값

예시: ctx.controls.txtName.text = ''; ctx.showMessage('저장 완료', '알림', 'info');`,
    {
      formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
      controlId: z
        .string()
        .describe('이벤트를 바인딩할 컨트롤 ID (폼 레벨 이벤트는 "_form")'),
      eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged, Load)'),
      handlerCode: z
        .string()
        .describe('핸들러 코드 (TypeScript). ctx 객체를 사용하여 컨트롤 조작'),
      handlerType: z
        .enum(['server', 'client'])
        .optional()
        .default('server')
        .describe('핸들러 실행 위치 (기본: server)'),
    },
    async ({ formId, controlId, eventName, handlerCode, handlerType }) => {
      try {
        validateObjectId(formId, 'formId');

        const { form, updatedVersion } = await withEventHandlerMutation(formId, (f) => {
          const exists = f.eventHandlers.some(
            (h) => h.controlId === controlId && h.eventName === eventName,
          );
          if (exists) {
            throw new HandlerExistsError(controlId, eventName);
          }

          if (controlId !== '_form') {
            const controlExists = f.controls.some((c) => c.id === controlId);
            if (!controlExists) {
              throw new ControlNotFoundError(controlId);
            }
          }

          f.eventHandlers.push({ controlId, eventName, handlerType, handlerCode });
        });

        return toolResult({
          formId: form._id,
          controlId,
          eventName,
          handlerType,
          totalHandlers: form.eventHandlers.length,
          version: updatedVersion,
        });
      } catch (error) {
        return handleEventToolError(error, formId);
      }
    },
  );

  // 2. update_event_handler
  server.tool(
    'update_event_handler',
    `기존 이벤트 핸들러의 코드를 수정합니다. controlId + eventName으로 대상 핸들러를 식별합니다.

ctx 객체 사용법은 add_event_handler 설명을 참고하세요.`,
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('컨트롤 ID'),
      eventName: z.string().describe('이벤트 이름'),
      handlerCode: z.string().describe('새 핸들러 코드'),
    },
    async ({ formId, controlId, eventName, handlerCode }) => {
      try {
        validateObjectId(formId, 'formId');

        const { form, updatedVersion } = await withEventHandlerMutation(formId, (f) => {
          const handler = f.eventHandlers.find(
            (h) => h.controlId === controlId && h.eventName === eventName,
          );
          if (!handler) {
            throw new HandlerNotFoundError(controlId, eventName);
          }

          handler.handlerCode = handlerCode;
        });

        return toolResult({
          formId: form._id,
          controlId,
          eventName,
          updated: true,
          version: updatedVersion,
        });
      } catch (error) {
        return handleEventToolError(error, formId);
      }
    },
  );

  // 3. remove_event_handler
  server.tool(
    'remove_event_handler',
    '이벤트 핸들러를 삭제합니다. controlId + eventName으로 대상을 식별합니다.',
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('컨트롤 ID'),
      eventName: z.string().describe('이벤트 이름'),
    },
    async ({ formId, controlId, eventName }) => {
      try {
        validateObjectId(formId, 'formId');

        const { form, updatedVersion } = await withEventHandlerMutation(formId, (f) => {
          const idx = f.eventHandlers.findIndex(
            (h) => h.controlId === controlId && h.eventName === eventName,
          );
          if (idx === -1) {
            throw new HandlerNotFoundError(controlId, eventName);
          }

          f.eventHandlers.splice(idx, 1);
        });

        return toolResult({
          formId: form._id,
          controlId,
          eventName,
          removed: true,
          remainingHandlers: form.eventHandlers.length,
          version: updatedVersion,
        });
      } catch (error) {
        return handleEventToolError(error, formId);
      }
    },
  );

  // 4. list_event_handlers
  server.tool(
    'list_event_handlers',
    '폼에 등록된 모든 이벤트 핸들러를 조회합니다. 각 핸들러의 controlId, eventName, handlerType, handlerCode를 포함합니다.',
    {
      formId: z.string().describe('폼 ID'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');

        const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
        const form = res.data;

        const controlNameMap = new Map<string, string>();
        for (const c of form.controls) {
          controlNameMap.set(c.id, c.name);
        }

        const handlers = form.eventHandlers.map((h) => ({
          controlId: h.controlId,
          controlName:
            h.controlId === '_form' ? '(Form)' : (controlNameMap.get(h.controlId) ?? h.controlId),
          eventName: h.eventName,
          handlerType: h.handlerType,
          handlerCode: h.handlerCode,
        }));

        return toolResult({
          formId: form._id,
          handlers,
          totalCount: handlers.length,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) return toolError(`폼을 찾을 수 없습니다: ${formId}`);
          return toolError(error.message);
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 5. list_available_events
  server.tool(
    'list_available_events',
    '특정 컨트롤 타입에서 사용 가능한 이벤트 목록을 반환합니다. COMMON_EVENTS(모든 컨트롤 공통) + CONTROL_EVENTS(타입별 특화)를 합산합니다. controlType을 "Form"으로 지정하면 폼 레벨 이벤트(Load, Shown 등)를 반환합니다.',
    {
      controlType: z
        .string()
        .describe('컨트롤 타입 (예: Button, TextBox, DataGridView, Form)'),
    },
    async ({ controlType }) => {
      if (controlType === 'Form') {
        return toolResult({
          controlType: 'Form',
          events: [...FORM_EVENTS],
          totalCount: FORM_EVENTS.length,
        });
      }

      const specificEvents = CONTROL_EVENTS[controlType] ?? [];
      const allEvents = [...COMMON_EVENTS, ...specificEvents];

      return toolResult({
        controlType,
        commonEvents: [...COMMON_EVENTS],
        specificEvents,
        allEvents,
        totalCount: allEvents.length,
      });
    },
  );

  // 6. test_event_handler
  server.tool(
    'test_event_handler',
    `이벤트 핸들러 코드를 실제 런타임 환경에서 테스트 실행합니다. isolated-vm 샌드박스에서 격리 실행되며, 실행 결과로 UI 패치(UIPatch) 배열과 콘솔 로그를 반환합니다.

폼이 반드시 published 상태여야 합니다 (publish_form 먼저 호출). mockFormState를 제공하면 해당 상태로 시작하고, 미지정 시 빈 상태로 실행합니다.`,
    {
      formId: z.string().describe('폼 ID (published 상태여야 함)'),
      controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
      eventName: z.string().describe('발생시킬 이벤트 이름 (예: Click)'),
      mockFormState: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional()
        .describe('테스트용 폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
    },
    async ({ formId, controlId, eventName, mockFormState }) => {
      try {
        validateObjectId(formId, 'formId');

        const body = {
          controlId,
          eventName,
          eventArgs: { type: eventName, timestamp: Date.now() },
          formState: mockFormState ?? {},
        };

        const res = await apiClient.post<RuntimeEventResponse>(
          `/api/runtime/forms/${formId}/events`,
          body,
        );

        if (res.error) {
          const errorMsg = res.errorLine
            ? `핸들러 실행 오류: ${res.error} (line ${res.errorLine})`
            : `핸들러 실행 오류: ${res.error}`;
          return toolError(errorMsg);
        }

        return toolResult({
          success: true,
          patches: res.patches,
          logs: res.logs ?? [],
          patchCount: res.patches?.length ?? 0,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return toolError(
              `폼을 찾을 수 없습니다: ${formId}. 폼이 published 상태인지 확인하세요 (publish_form 호출 필요).`,
            );
          }
          return toolError(error.message);
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );
}
