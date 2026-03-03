import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '@webform/common';
import { apiClient, ApiError, validateObjectId, withOptimisticRetry, toolResult, toolError } from '../utils/index.js';

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

// --- 커스텀 에러 ---

class HandlerExistsError extends Error {
  constructor(
    public controlId: string,
    public eventName: string,
  ) {
    super(`이미 존재하는 핸들러: ${controlId}.${eventName}`);
  }
}

class HandlerNotFoundError extends Error {
  constructor(
    public controlId: string,
    public eventName: string,
  ) {
    super(`핸들러를 찾을 수 없음: ${controlId}.${eventName}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`컨트롤을 찾을 수 없음: ${controlId}`);
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
      `이미 존재하는 핸들러입니다: ${error.controlId}.${error.eventName}`,
      {
        code: 'HANDLER_ALREADY_EXISTS',
        details: { controlId: error.controlId, eventName: error.eventName, formId },
        suggestion: 'update_event_handler로 기존 핸들러 코드를 수정하세요.',
      },
    );
  }
  if (error instanceof HandlerNotFoundError) {
    return toolError(
      `핸들러를 찾을 수 없습니다: ${error.controlId}.${error.eventName}`,
      {
        code: 'HANDLER_NOT_FOUND',
        details: { controlId: error.controlId, eventName: error.eventName, formId },
        suggestion: 'list_event_handlers로 현재 핸들러 목록을 확인하세요.',
      },
    );
  }
  if (error instanceof ControlNotFoundError) {
    return toolError(
      `컨트롤을 찾을 수 없습니다 (controlId: ${error.controlId})`,
      {
        code: 'CONTROL_NOT_FOUND',
        details: { controlId: error.controlId, formId },
        suggestion: 'get_form으로 폼의 컨트롤 목록을 확인하세요. 폼 레벨 이벤트는 controlId를 "_form"으로 지정하세요.',
      },
    );
  }
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
        code: 'FORM_NOT_FOUND',
        details: { formId },
        suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
      });
    }
    if (error.status === 409) {
      return toolError(
        '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
        {
          code: 'VERSION_CONFLICT',
          details: { formId },
          suggestion: 'get_form으로 최신 버전을 조회 후 다시 시도하세요.',
        },
      );
    }
    return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { formId } });
  }
  if (error instanceof Error) {
    if (error.message.includes('유효하지 않은'))
      return toolError(error.message, { code: 'VALIDATION_ERROR' });
  }
  throw error;
}

// --- Tool 등록 ---

export function registerEventTools(server: McpServer): void {
  // 1. add_event_handler
  server.tool(
    'add_event_handler',
    `폼의 컨트롤에 새 이벤트 핸들러를 등록합니다. 이미 등록된 핸들러를 수정하려면 update_event_handler를 사용하세요.

controlId에 "_form"을 지정하면 폼 레벨 이벤트(Load, Shown 등)를 등록합니다.
사용 가능한 이벤트 목록은 list_available_events로 확인하세요.

핸들러 코드는 JavaScript/TypeScript로 작성하며, ctx 객체를 통해 런타임 기능을 사용합니다:

■ 컨트롤 조작 (읽기/쓰기):
  ctx.controls['컨트롤이름'].text = '새 값';
  ctx.controls.txtName.visible = false;
  ctx.controls.chkAgree.checked = true;
  ctx.controls.numAge.value = 25;
  ctx.controls.grid1.dataSource = [...];

■ ComboBox 선택값 읽기 (주의!):
  ComboBox는 selectedValue를 저장하지 않습니다. 반드시 items[selectedIndex]로 값을 읽으세요.
  const items = ctx.controls.cmbCity.items;
  const idx = ctx.controls.cmbCity.selectedIndex;
  const value = (idx >= 0 && idx < items.length) ? items[idx] : '';
  쓰기: ctx.controls.cmbCity.selectedIndex = 2;

■ 이벤트 정보:
  ctx.sender — 이벤트를 발생시킨 컨트롤의 현재 속성
  ctx.eventArgs — 이벤트 인자 ({type, timestamp, ...})

■ UI 함수:
  ctx.showMessage(text, title?, type?) — 메시지 대화상자 (type: 'info'|'warning'|'error')
  ctx.navigate(formId, params?) — 다른 폼으로 이동

■ HTTP 요청:
  const res = await ctx.http.get(url) → {status, ok, data}
  const res = await ctx.http.post(url, body)
  ctx.http.put / ctx.http.patch / ctx.http.delete 도 사용 가능

■ 유틸리티:
  ctx.getRadioGroupValue(groupName) — 라디오 그룹의 선택값 반환

■ DataSourceConnector (PostgreSQL, MySQL, MSSQL 등 SQL DB 커넥터):
  주의: 메서드는 동기식으로 호출합니다 (await 불필요, async/await 사용 금지).
  ctx.controls.connName.rawQuery(sql, params?) — SQL 직접 실행, 결과 배열 반환
  ctx.controls.connName.query(params) — 구조화된 쿼리 실행
  ctx.controls.connName.execute(sql, params?) — INSERT/UPDATE/DELETE 실행, {affectedRows} 반환
  ctx.controls.connName.tables() — 테이블 목록 반환
  ctx.controls.connName.testConnection() — 연결 테스트

  예시 (PostgreSQL):
    const rows = ctx.controls.pgConn.rawQuery('SELECT * FROM users WHERE dept = $1', ['Engineering']);
    ctx.controls.grid1.dataSource = rows;
    const result = ctx.controls.pgConn.execute('UPDATE users SET active = $1 WHERE id = $2', [false, 5]);

■ MongoDBConnector (MongoDB 커넥터):
  주의: 메서드는 동기식으로 호출합니다 (await 불필요, async/await 사용 금지).
  ctx.controls.connName.find(collection, filter?) — 문서 배열 반환
  ctx.controls.connName.findOne(collection, filter?) — 단일 문서 반환
  ctx.controls.connName.insertOne(collection, doc) — 문서 삽입
  ctx.controls.connName.updateOne(collection, filter, update) — 문서 수정
  ctx.controls.connName.deleteOne(collection, filter) — 문서 삭제
  ctx.controls.connName.count(collection, filter?) — 문서 수 반환

  예시:
    const users = ctx.controls.mongoConn.find('users', { active: true });
    ctx.controls.grid1.dataSource = users;

■ SwaggerConnector (REST API 커넥터):
  주의: 메서드는 동기식으로 호출합니다 (await 불필요, async/await 사용 금지).
  ctx.controls.connName.operationId(opts?) — Swagger에 정의된 operationId로 호출. opts: {pathParams?, queryParams?, body?}

■ DataGridView 주의사항:
  1) columns 정의 시 반드시 field와 headerText를 사용하세요. name/header는 데이터 매핑에 사용되지 않습니다.
     올바른 예: { field: 'email', headerText: '이메일', width: 200 }
     잘못된 예: { name: 'email', header: '이메일', width: 200 }  ← 데이터가 표시되지 않음
  2) 다른 쿼리 결과를 표시할 때는 columns를 dataSource보다 먼저 설정하세요.
     columns를 변경하지 않으면 이전 컬럼 정의가 유지되어 데이터가 매핑되지 않습니다.
     ctx.controls.grid1.columns = [{ field: 'dept', headerText: '부서', width: 150 }, ...];
     ctx.controls.grid1.dataSource = results;
  3) columns를 생략하면 데이터의 키에서 자동 생성됩니다 (headerText = 키 이름).

■ 샌드박스 코드 작성 주의사항:
  - 변수 선언 시 const/let 대신 var를 사용하세요 (isolated-vm 호환성).
  - 커넥터 메서드(rawQuery, find 등)는 동기식이므로 await를 사용하지 마세요.
  - ctx.http 메서드(get, post 등)도 동기식으로 결과를 바로 반환합니다.
  - Template literal은 사용 가능하지만, 긴 SQL은 문자열 연결(+)이 더 안전합니다.

코드 예시:
  var res = ctx.http.get('/api/users');
  if (res.ok) {
    ctx.controls.grid1.dataSource = res.data;
  }
  ctx.showMessage('데이터 로드 완료', '알림', 'info');

반환값: { formId, controlId, eventName, handlerType, totalHandlers, version }`,
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
    `기존 이벤트 핸들러의 코드를 수정합니다. 새 핸들러를 등록하려면 add_event_handler를 사용하세요.
controlId + eventName 조합으로 수정할 핸들러를 식별합니다. 핸들러가 존재하지 않으면 에러를 반환합니다.

ctx 객체 사용법은 add_event_handler 설명을 참고하세요.

반환값: { formId, controlId, eventName, updated: true, version }`,
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
    `이벤트 핸들러를 삭제합니다. controlId + eventName 조합으로 삭제할 핸들러를 식별합니다.

반환값: { formId, controlId, eventName, removed: true, remainingHandlers, version }`,
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
    `폼에 등록된 모든 이벤트 핸들러 목록을 조회합니다. 핸들러 추가/수정 전 현재 상태를 확인할 때 사용하세요.

반환값: { formId, handlers: [{controlId, controlName, eventName, handlerType, handlerCode}], totalCount }`,
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
          if (error.status === 404) {
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          }
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { formId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 5. list_available_events
  server.tool(
    'list_available_events',
    `특정 컨트롤 타입에서 사용 가능한 이벤트 목록을 반환합니다. add_event_handler에서 eventName에 사용할 값을 확인할 때 호출하세요.

공통 이벤트(Click, DoubleClick 등) + 타입별 특화 이벤트(예: TextBox → TextChanged)를 합산합니다.
controlType을 "Form"으로 지정하면 폼 레벨 이벤트(Load, Shown, FormClosing 등)를 반환합니다.

반환값: { controlType, commonEvents, specificEvents, allEvents, totalCount }`,
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
    `폼에 등록된 이벤트 핸들러를 테스트 목적으로 실행합니다. 디자인 타임에 핸들러 동작을 검증할 때 사용하세요.
실제 런타임에서 사용자 이벤트를 시뮬레이션하려면 execute_event를 사용하세요.

execute_event와의 차이점:
- test_event_handler: mockFormState로 초기 상태를 지정하여 격리 테스트. eventArgs 지정 불가.
- execute_event: formState와 eventArgs를 모두 지정 가능. 실제 런타임 시나리오 재현용.

폼이 published 상태여야 합니다 (publish_form 먼저 호출).
실행 오류 발생 시 debug_execute로 라인별 트레이스를 확인할 수 있습니다.

반환값: { success, patches: [UIPatch], logs: [{level, message}], patchCount }`,
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
          return toolError(
            res.errorLine
              ? `핸들러 실행 오류 (${controlId}.${eventName}, line ${res.errorLine}): ${res.error}`
              : `핸들러 실행 오류 (${controlId}.${eventName}): ${res.error}`,
            {
              code: 'HANDLER_EXECUTION_ERROR',
              details: { formId, controlId, eventName, errorLine: res.errorLine ?? null },
              suggestion: '핸들러 코드의 구문 오류를 확인하세요. debug_execute로 상세 트레이스를 확인할 수 있습니다.',
            },
          );
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
              `폼을 찾을 수 없습니다 (formId: ${formId})`,
              {
                code: 'FORM_NOT_FOUND',
                details: { formId },
                suggestion: '폼이 published 상태인지 확인하세요. publish_form으로 먼저 퍼블리시해야 합니다.',
              },
            );
          }
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { formId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );
}
