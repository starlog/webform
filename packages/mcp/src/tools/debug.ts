import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, validateObjectId, toolResult } from '../utils/index.js';
import type { RuntimeEventResponse } from './runtime.js';
import { handleRuntimeToolError } from './runtime.js';

// --- Tool 등록 ---

export function registerDebugTools(server: McpServer): void {
  // 1. debug_execute
  server.tool(
    'debug_execute',
    `이벤트 핸들러를 디버그 모드로 실행합니다. execute_event/test_event_handler에서 오류가 발생했을 때 원인을 추적할 때 사용하세요.

일반 실행 결과(patches, logs)에 추가로 실행 트레이스(traces)를 반환합니다.
트레이스에는 각 statement 실행 시점의 라인 번호, 변수 값, ctx.controls 상태가 기록됩니다.
에러 발생 시에도 에러 직전까지의 트레이스를 포함하여 반환합니다.

폼이 published 상태여야 합니다 (publish_form 먼저 호출).

반환값: { success, patches?, error?, errorLine?, traces: [{line, column, timestamp, variables, ctxControls}], logs, patchCount, traceCount }`,
    {
      formId: z.string().describe('폼 ID (published 상태여야 함)'),
      controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
      eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged)'),
      formState: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional()
        .describe('폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
    },
    async ({ formId, controlId, eventName, formState }) => {
      try {
        validateObjectId(formId, 'formId');

        const body = {
          controlId,
          eventName,
          eventArgs: { type: eventName, timestamp: Date.now() },
          formState: formState ?? {},
          debugMode: true,
        };

        const res = await apiClient.post<RuntimeEventResponse>(
          `/api/runtime/forms/${formId}/events`,
          body,
        );

        if (res.error) {
          // 에러 시에도 traces가 있으면 포함하여 반환 (디버깅에 유용)
          return toolResult({
            success: false,
            error: res.error,
            errorLine: res.errorLine,
            traces: res.traces ?? [],
            logs: res.logs ?? [],
            traceCount: res.traces?.length ?? 0,
          });
        }

        return toolResult({
          success: true,
          patches: res.patches,
          logs: res.logs ?? [],
          traces: res.traces ?? [],
          patchCount: res.patches?.length ?? 0,
          traceCount: res.traces?.length ?? 0,
        });
      } catch (error) {
        return handleRuntimeToolError(error, formId);
      }
    },
  );
}
