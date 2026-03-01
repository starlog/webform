import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---

export interface RuntimeEventResponse {
  success: boolean;
  patches: Array<{
    type: string;
    target: string;
    payload: Record<string, unknown>;
  }>;
  error?: string;
  logs?: Array<{
    type: string;
    args: string[];
    timestamp: number;
  }>;
  errorLine?: number;
  traces?: Array<{
    line: number;
    column: number;
    timestamp: number;
    variables: Record<string, string>;
    duration?: number;
    ctxControls?: Record<string, string>;
  }>;
}

interface RuntimeFormDefinition {
  id: string;
  name: string;
  version: number;
  properties: Record<string, unknown>;
  controls: Array<Record<string, unknown>>;
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: string;
  }>;
  dataBindings?: Array<Record<string, unknown>>;
}

interface AppLoadResponse {
  shell: {
    id: string;
    projectId: string;
    name: string;
    version: number;
    properties: Record<string, unknown>;
    controls: Array<Record<string, unknown>>;
    eventHandlers: Array<{
      controlId: string;
      eventName: string;
      handlerType: string;
    }>;
    startFormId?: string;
  } | null;
  startForm: RuntimeFormDefinition;
}

// --- 헬퍼 ---

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

export function handleRuntimeToolError(error: unknown, resourceId: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(
        `리소스를 찾을 수 없습니다: ${resourceId}. 폼/Shell이 published 상태인지 확인하세요.`,
      );
    }
    if (error.status === 400) {
      return toolError(`잘못된 요청: ${error.detail || error.message}`);
    }
    return toolError(error.message);
  }
  if (error instanceof Error && error.message.includes('유효하지 않은')) {
    return toolError(error.message);
  }
  throw error;
}

// --- Tool 등록 ---

export function registerRuntimeTools(server: McpServer): void {
  // 1. execute_event
  server.tool(
    'execute_event',
    `폼의 이벤트를 런타임 환경에서 실행합니다. published 상태의 폼에서만 동작합니다.

isolated-vm 샌드박스에서 서버 핸들러 코드를 실행하고, UI 패치(UIPatch) 배열과 콘솔 로그를 반환합니다.
formState를 제공하면 해당 상태에서 시작하고, 미지정 시 빈 상태로 실행합니다.
eventArgs를 제공하면 ctx.eventArgs에 전달됩니다.

폼이 published 상태가 아니면 404 에러를 반환합니다 (publish_form 먼저 호출).`,
    {
      formId: z.string().describe('폼 ID (published 상태여야 함)'),
      controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
      eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged, Load)'),
      formState: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional()
        .describe('폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
      eventArgs: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('이벤트 인자 (ctx.eventArgs에 전달). 미지정 시 기본값 사용'),
    },
    async ({ formId, controlId, eventName, formState, eventArgs }) => {
      try {
        validateObjectId(formId, 'formId');

        const body = {
          controlId,
          eventName,
          eventArgs: { type: eventName, timestamp: Date.now(), ...eventArgs },
          formState: formState ?? {},
        };

        const res = await apiClient.post<RuntimeEventResponse>(
          `/api/runtime/forms/${formId}/events`,
          body,
        );

        if (res.error) {
          const errorMsg = res.errorLine
            ? `핸들러 실행 오류 (line ${res.errorLine}): ${res.error}`
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
        return handleRuntimeToolError(error, formId);
      }
    },
  );

  // 2. get_runtime_form
  server.tool(
    'get_runtime_form',
    `퍼블리시된 폼을 런타임 형식으로 로드합니다. published 상태가 아닌 폼은 404를 반환합니다.

런타임 형식은 서버 핸들러만 노출하며(코드 미포함), 데이터 바인딩 정보를 포함합니다.
폼의 현재 상태를 확인하거나 런타임 테스트 전 폼 구조를 검토할 때 사용합니다.`,
    {
      formId: z.string().describe('폼 ID (published 상태여야 함)'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');

        const res = await apiClient.get<RuntimeFormDefinition>(
          `/api/runtime/forms/${formId}`,
        );

        return toolResult(res);
      } catch (error) {
        return handleRuntimeToolError(error, formId);
      }
    },
  );

  // 3. get_runtime_app
  server.tool(
    'get_runtime_app',
    `프로젝트의 앱을 런타임 형식으로 로드합니다. Shell 정의(있으면)와 시작 폼을 일괄 반환합니다.

Shell이 없는 프로젝트는 shell: null로 반환됩니다.
formId를 지정하면 shell.startFormId 대신 해당 폼을 시작 폼으로 사용합니다.
Shell과 시작 폼 모두 published 상태여야 합니다.`,
    {
      projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
      formId: z.string().optional().describe('시작 폼 ID (미지정 시 shell.startFormId 사용)'),
    },
    async ({ projectId, formId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const url = formId
          ? `/api/runtime/app/${projectId}?formId=${formId}`
          : `/api/runtime/app/${projectId}`;

        const res = await apiClient.get<AppLoadResponse>(url);

        return toolResult(res);
      } catch (error) {
        return handleRuntimeToolError(error, projectId);
      }
    },
  );
}
