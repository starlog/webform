import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES } from '@webform/common';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

// --- API 응답 타입 ---

interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: Array<Record<string, unknown>>;
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: string;
    handlerCode: string;
  }>;
  dataBindings: Array<{
    controlId: string;
    controlProperty: string;
    dataSourceId: string;
    dataField: string;
    bindingMode: string;
  }>;
  properties: Record<string, unknown>;
}

interface GetFormResponse {
  data: FormData;
}

// --- 검증 타입 ---

interface ValidationError {
  type: string;
  message: string;
  controlId?: string;
  controlName?: string;
}

interface ValidationWarning {
  type: string;
  message: string;
}

// --- 검증 헬퍼 ---

function flattenControls(
  controls: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const ctrl of controls) {
    result.push(ctrl);
    if (Array.isArray(ctrl.children)) {
      result.push(...flattenControls(ctrl.children as Array<Record<string, unknown>>));
    }
  }
  return result;
}

function countDuplicates(
  items: Array<Record<string, unknown>>,
  key: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const val = item[key];
    if (typeof val === 'string' && val) {
      counts.set(val, (counts.get(val) || 0) + 1);
    }
  }
  return new Map([...counts].filter(([, count]) => count > 1));
}

// --- 검색 헬퍼 ---

interface FlatControl extends Record<string, unknown> {
  parentId: string | null;
  depth: number;
}

function flattenControlsWithDepth(
  controls: Array<Record<string, unknown>>,
  parentId: string | null,
  depth: number,
): FlatControl[] {
  const result: FlatControl[] = [];
  for (const ctrl of controls) {
    result.push({ ...ctrl, parentId, depth });
    if (Array.isArray(ctrl.children)) {
      result.push(
        ...flattenControlsWithDepth(
          ctrl.children as Array<Record<string, unknown>>,
          ctrl.id as string,
          depth + 1,
        ),
      );
    }
  }
  return result;
}

// --- Tool 등록 ---

export function registerUtilityTools(server: McpServer): void {
  // 1. validate_form
  server.tool(
    'validate_form',
    `폼 정의 JSON의 유효성을 검증합니다. update_form으로 전체 교체하기 전에 데이터 무결성을 확인할 때 사용하세요.
서버에 저장하지 않고 클라이언트 측에서만 검증합니다.

검증 항목:
- 컨트롤 ID/이름 중복 검사
- 필수 속성 존재 확인 (id, type, name)
- 컨트롤 타입 유효성 (42개 CONTROL_TYPES 확인)
- 이벤트 핸들러 코드 JavaScript 구문 검증
- 이벤트 핸들러/데이터 바인딩의 controlId 참조 유효성

반환값: { valid: boolean, errors: [{type, message, controlId?}], warnings: [{type, message}], summary: {totalControls, errorCount, warningCount} }`,
    {
      formDefinition: z
        .object({
          id: z.string().optional(),
          name: z.string().optional(),
          version: z.number().optional(),
          properties: z.record(z.string(), z.unknown()).optional(),
          controls: z.array(z.record(z.string(), z.unknown())).optional().default([]),
          eventHandlers: z
            .array(
              z.object({
                controlId: z.string(),
                eventName: z.string(),
                handlerType: z.enum(['server', 'client']).optional(),
                handlerCode: z.string(),
              }),
            )
            .optional()
            .default([]),
          dataBindings: z
            .array(
              z.object({
                controlId: z.string(),
                controlProperty: z.string(),
                dataSourceId: z.string(),
                dataField: z.string(),
                bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']).optional(),
              }),
            )
            .optional()
            .default([]),
        })
        .describe('검증할 폼 정의 JSON'),
    },
    async ({ formDefinition }) => {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const controls = formDefinition.controls || [];

      // 1. 컨트롤 재귀 수집 (children 포함)
      const allControls = flattenControls(controls);

      // 2. 컨트롤 ID 중복 검증
      const idCounts = countDuplicates(allControls, 'id');
      for (const [id, count] of idCounts) {
        if (count > 1) {
          errors.push({
            type: 'duplicate_id',
            message: `컨트롤 ID '${id}'가 ${count}번 중복됩니다`,
            controlId: id,
          });
        }
      }

      // 3. 컨트롤 이름 중복 검증
      const nameCounts = countDuplicates(allControls, 'name');
      for (const [name, count] of nameCounts) {
        if (count > 1) {
          errors.push({
            type: 'duplicate_name',
            message: `컨트롤 이름 '${name}'이 ${count}번 중복됩니다`,
            controlName: name,
          });
        }
      }

      // 4. 필수 속성 검증 (id, type, name)
      for (const ctrl of allControls) {
        const missing = ['id', 'type', 'name'].filter((k) => !ctrl[k]);
        if (missing.length > 0) {
          const ctrlLabel = ctrl.name || ctrl.id || '(unknown)';
          errors.push({
            type: 'missing_property',
            message: `컨트롤 '${ctrlLabel}'에 필수 속성이 누락: ${missing.join(', ')}`,
          });
        }
        if (!ctrl.position) {
          warnings.push({
            type: 'missing_position',
            message: `컨트롤 '${ctrl.name}'에 position이 없습니다`,
          });
        }
        if (!ctrl.size) {
          warnings.push({
            type: 'missing_size',
            message: `컨트롤 '${ctrl.name}'에 size가 없습니다`,
          });
        }
      }

      // 5. 컨트롤 타입 유효성 검증
      const validTypes = new Set<string>(CONTROL_TYPES);
      for (const ctrl of allControls) {
        if (ctrl.type && !validTypes.has(ctrl.type as string)) {
          errors.push({
            type: 'invalid_type',
            message: `컨트롤 '${ctrl.name}'의 타입 '${ctrl.type}'이 유효하지 않습니다. 유효한 타입: ${CONTROL_TYPES.join(', ')}`,
          });
        }
      }

      // 6. 이벤트 핸들러 검증
      const controlIds = new Set(
        allControls.map((c) => c.id).filter((id): id is string => typeof id === 'string'),
      );
      for (const handler of formDefinition.eventHandlers || []) {
        // controlId 참조 유효성 (폼 이벤트인 경우 controlId가 'form' 또는 '_form'일 수 있음)
        if (
          handler.controlId !== 'form' &&
          handler.controlId !== '_form' &&
          !controlIds.has(handler.controlId)
        ) {
          errors.push({
            type: 'invalid_handler_ref',
            message: `이벤트 핸들러의 controlId '${handler.controlId}'가 존재하지 않는 컨트롤을 참조합니다`,
          });
        }
        // JavaScript 구문 검증 (new Function으로 파싱 시도)
        try {
          new Function(handler.handlerCode);
        } catch (e) {
          errors.push({
            type: 'handler_syntax_error',
            message: `이벤트 핸들러 (${handler.controlId}.${handler.eventName}) 구문 오류: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      // 7. 데이터 바인딩 참조 검증
      for (const binding of formDefinition.dataBindings || []) {
        if (!controlIds.has(binding.controlId)) {
          errors.push({
            type: 'invalid_binding_ref',
            message: `데이터 바인딩의 controlId '${binding.controlId}'가 존재하지 않는 컨트롤을 참조합니다`,
          });
        }
      }

      // 결과 반환
      const valid = errors.length === 0;
      return toolResult({
        valid,
        errors,
        warnings,
        summary: {
          totalControls: allControls.length,
          totalEventHandlers: (formDefinition.eventHandlers || []).length,
          totalDataBindings: (formDefinition.dataBindings || []).length,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
      });
    },
  );

  // 2. get_server_health
  server.tool(
    'get_server_health',
    `WebForm 서버의 상태를 확인합니다. 다른 Tool 호출 전에 서버가 정상 동작 중인지 확인할 때 사용하세요.
서버 연결 실패 시 "pnpm dev:server" 또는 "./run.sh"로 서버를 시작하세요.

반환값: { status: 'ok'|'degraded', mongodb, redis, responseTime, serverUrl }`,
    {},
    async () => {
      const startTime = Date.now();

      try {
        const baseUrl = process.env.WEBFORM_API_URL || 'http://localhost:4000';
        const res = await fetch(`${baseUrl}/health`);
        const elapsed = Date.now() - startTime;
        const body = (await res.json()) as Record<string, unknown>;

        return toolResult({
          ...body,
          responseTime: `${elapsed}ms`,
          serverUrl: baseUrl,
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        const baseUrl = process.env.WEBFORM_API_URL || 'http://localhost:4000';
        return toolError(
          `서버에 연결할 수 없습니다 (${elapsed}ms 경과)`,
          {
            code: 'SERVER_UNREACHABLE',
            details: {
              serverUrl: baseUrl,
              elapsedMs: elapsed,
              errorMessage: error instanceof Error ? error.message : String(error),
            },
            suggestion: '서버가 실행 중인지 확인하세요. "pnpm dev:server" 또는 "./run.sh"로 서버를 시작할 수 있습니다.',
          },
        );
      }
    },
  );

  // 3. search_controls
  server.tool(
    'search_controls',
    `폼 내 컨트롤을 조건에 따라 검색합니다. 특정 컨트롤의 ID를 찾거나, 특정 타입/속성의 컨트롤을 필터링할 때 사용하세요.
get_form은 전체 컨트롤을 반환하지만, search_controls는 조건에 맞는 컨트롤만 반환합니다.

이름 검색(부분 일치, 대소문자 무시), 타입 필터, 속성 값 검색을 지원합니다.
중첩된 컨테이너(Panel, GroupBox 등) 내부도 재귀 탐색합니다. 여러 조건은 AND 동작.

반환값: { formId, formName, totalControls, matchCount, controls: [{id, name, type, position, size, parentId, depth}] }`,
    {
      formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
      query: z.string().optional().describe('컨트롤 이름 검색 (부분 일치, 대소문자 무시)'),
      type: z.string().optional().describe('컨트롤 타입 필터 (예: Button, TextBox, Panel)'),
      property: z
        .string()
        .optional()
        .describe('속성 검색 (key=value 형식, 예: "text=Submit" 또는 "visible=false")'),
    },
    async ({ formId, query, type, property }) => {
      try {
        validateObjectId(formId, 'formId');

        // 1. 폼 조회
        const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
        const form = res.data;

        // 2. 모든 컨트롤 재귀 수집 (깊이 정보 포함)
        const allControls = flattenControlsWithDepth(form.controls, null, 0);

        // 3. 필터 적용
        let filtered = allControls;

        // 이름 검색 (부분 일치, 대소문자 무시)
        if (query) {
          const q = query.toLowerCase();
          filtered = filtered.filter((c) =>
            (c.name as string | undefined)?.toLowerCase().includes(q),
          );
        }

        // 타입 필터
        if (type) {
          filtered = filtered.filter((c) => c.type === type);
        }

        // 속성 검색 (key=value)
        if (property) {
          const eqIdx = property.indexOf('=');
          if (eqIdx === -1) {
            // key만 지정: 해당 속성이 존재하는 컨트롤
            filtered = filtered.filter((c) => {
              const props = (c.properties || {}) as Record<string, unknown>;
              return property in props;
            });
          } else {
            const key = property.substring(0, eqIdx);
            const value = property.substring(eqIdx + 1);
            filtered = filtered.filter((c) => {
              const props = (c.properties || {}) as Record<string, unknown>;
              // 최상위 속성도 검색 (visible, enabled 등)
              const propVal = props[key] ?? c[key];
              return String(propVal) === value;
            });
          }
        }

        // 4. 결과 포맷팅
        const results = filtered.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          position: c.position,
          size: c.size,
          parentId: c.parentId,
          depth: c.depth,
        }));

        return toolResult({
          formId,
          formName: form.name,
          totalControls: allControls.length,
          matchCount: results.length,
          controls: results,
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
}
