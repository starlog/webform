import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES } from '@webform/common';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

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

// --- 헬퍼 ---

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
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
    `폼 정의 JSON의 유효성을 검증합니다.

검증 항목:
- 컨트롤 ID/이름 중복
- 필수 속성 존재 확인 (id, type, name, position, size)
- 컨트롤 타입 유효성 (CONTROL_TYPES 확인)
- 이벤트 핸들러 코드 구문 검증 (JavaScript 파싱)
- 이벤트 핸들러 controlId 참조 유효성
- 데이터 바인딩 controlId 참조 유효성`,
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
    `WebForm 서버의 상태를 확인합니다.

MongoDB 연결 상태, Redis 연결 상태, 서버 응답 시간을 반환합니다.
서버가 비정상이면 status: 'degraded'를 반환합니다.`,
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
        return toolError(
          `서버에 연결할 수 없습니다 (${elapsed}ms 경과). ` +
            `서버가 실행 중인지 확인하세요: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // 3. search_controls
  server.tool(
    'search_controls',
    `폼 내 컨트롤을 조건에 따라 검색합니다.

이름, 타입, 속성 값으로 컨트롤을 필터링합니다. 중첩된 컨테이너 내 컨트롤도 재귀적으로 검색합니다.
여러 조건을 동시에 지정하면 AND 조건으로 동작합니다.`,
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
          if (error.status === 404) return toolError(`폼을 찾을 수 없습니다: formId=${formId}`);
          return toolError(error.message);
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );
}
