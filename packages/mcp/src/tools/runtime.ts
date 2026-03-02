import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

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

export function handleRuntimeToolError(error: unknown, resourceId: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(
        `리소스를 찾을 수 없습니다 (ID: ${resourceId})`,
        { code: 'RUNTIME_RESOURCE_NOT_FOUND', details: { resourceId }, suggestion: '폼/Shell이 published 상태인지 확인하세요. publish_form 또는 publish_shell을 먼저 호출해야 합니다.' },
      );
    }
    if (error.status === 400) {
      return toolError(`잘못된 요청입니다: ${error.detail || error.message}`, { code: 'BAD_REQUEST', details: { resourceId, serverDetail: error.detail } });
    }
    return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { resourceId } });
  }
  if (error instanceof Error && error.message.includes('유효하지 않은')) {
    return toolError(error.message, { code: 'VALIDATION_ERROR' });
  }
  throw error;
}

// --- Tool 등록 ---

export function registerRuntimeTools(server: McpServer): void {
  // 1. execute_event
  server.tool(
    'execute_event',
    `폼의 이벤트를 실제 런타임 환경에서 실행합니다. 사용자 인터랙션을 시뮬레이션하거나 런타임 동작을 검증할 때 사용하세요.
디자인 타임에 핸들러 코드만 테스트하려면 test_event_handler를 사용하세요.
실행 오류를 디버깅하려면 debug_execute를 사용하세요 (라인별 트레이스 포함).

test_event_handler와의 차이점:
- execute_event: formState + eventArgs를 모두 지정 가능. 실제 런타임 시나리오 재현에 적합.
- test_event_handler: mockFormState만 지정 가능 (eventArgs 미지원). 단순 핸들러 검증용.

isolated-vm 샌드박스에서 서버 핸들러 코드를 격리 실행합니다.
폼이 published 상태여야 합니다 (publish_form 먼저 호출).

반환값: { success, patches: [UIPatch], logs: [{type, args, timestamp}], patchCount }`,
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
          return toolError(errorMsg, { code: 'HANDLER_EXECUTION_ERROR', details: { formId, controlId, eventName, errorLine: res.errorLine ?? null }, suggestion: '핸들러 코드의 구문 오류를 확인하세요. debug_execute로 상세 트레이스를 확인할 수 있습니다.' });
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
    `퍼블리시된 폼을 런타임 형식으로 로드합니다. execute_event 전에 폼 구조를 확인하거나, 런타임 렌더링에 필요한 데이터를 가져올 때 사용하세요.
디자인 타임의 폼 전체 정의(핸들러 코드 포함)를 보려면 get_form을 사용하세요.

런타임 형식: 핸들러 코드 미포함(보안), 이벤트 바인딩 정보만 노출.
published 상태가 아닌 폼은 404를 반환합니다 (publish_form 먼저 호출).

반환값: { id, name, version, properties, controls, eventHandlers: [{controlId, eventName, handlerType}] }`,
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
    `프로젝트의 전체 앱을 런타임 형식으로 로드합니다. Shell(있으면) + 시작 폼을 한 번의 호출로 일괄 반환합니다.
개별 폼만 로드하려면 get_runtime_form을 사용하세요.

Shell이 없는 프로젝트는 shell: null로 반환됩니다.
formId를 지정하면 shell.startFormId 대신 해당 폼을 시작 폼으로 사용합니다.
Shell과 시작 폼 모두 published 상태여야 합니다.

반환값: { shell: {id, name, properties, controls, eventHandlers, startFormId} | null, startForm: RuntimeFormDefinition }`,
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
