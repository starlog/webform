import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---

interface DataBindingDef {
  controlId: string;
  controlProperty: string;
  dataSourceId: string;
  dataField: string;
  bindingMode: string;
}

interface ControlDef {
  id: string;
  name: string;
  type: string;
  children?: ControlDef[];
  [key: string]: unknown;
}

interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: ControlDef[];
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: string;
    handlerCode: string;
  }>;
  dataBindings: DataBindingDef[];
  properties: Record<string, unknown>;
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

// --- 헬퍼 ---

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

// --- 커스텀 에러 ---

class BindingExistsError extends Error {
  constructor(
    public controlId: string,
    public controlProperty: string,
  ) {
    super(`Binding already exists: ${controlId}.${controlProperty}`);
  }
}

class BindingNotFoundError extends Error {
  constructor(
    public controlId: string,
    public controlProperty: string,
  ) {
    super(`Binding not found: ${controlId}.${controlProperty}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`Control not found: ${controlId}`);
  }
}

// --- 컨트롤 탐색 헬퍼 (재귀, children 포함) ---

function findControlById(controls: ControlDef[], id: string): ControlDef | undefined {
  for (const ctrl of controls) {
    if (ctrl.id === id) return ctrl;
    if (ctrl.children) {
      const found = findControlById(ctrl.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// --- withDatabindingMutation: get → 조작 → put (낙관적 잠금 + 자동 재시도) ---

async function withDatabindingMutation<T>(
  formId: string,
  mutate: (form: FormData) => T,
  maxRetries = 2,
): Promise<{ result: T; form: FormData; updatedVersion: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
    const form = res.data;

    if (!form.dataBindings) {
      form.dataBindings = [];
    }

    const result = mutate(form);

    try {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        dataBindings: form.dataBindings,
      });
      return { result, form, updatedVersion: updated.data.version };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}

// --- 공통 에러 핸들러 ---

function handleDatabindingToolError(error: unknown, formId: string) {
  if (error instanceof BindingExistsError) {
    return toolError(
      `이미 존재하는 바인딩입니다: controlId=${error.controlId}, controlProperty=${error.controlProperty}. remove_data_binding 후 다시 추가하세요.`,
    );
  }
  if (error instanceof BindingNotFoundError) {
    return toolError(
      `바인딩을 찾을 수 없습니다: controlId=${error.controlId}, controlProperty=${error.controlProperty}`,
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

export function registerDatabindingTools(server: McpServer): void {
  // 1. add_data_binding
  server.tool(
    'add_data_binding',
    `폼의 컨트롤 속성에 데이터 바인딩을 추가합니다. 내부적으로 get_form → dataBindings 배열 추가 → update_form 패턴으로 동작합니다.

데이터 바인딩은 컨트롤의 특정 속성(예: text, value, dataSource)을 데이터소스의 필드와 연결합니다.
- oneWay: 데이터소스 → 컨트롤 (단방향, 기본값)
- twoWay: 양방향 바인딩 (컨트롤 값 변경 시 데이터소스에도 반영)
- oneTime: 초기 로드 시점에만 바인딩

예시: DataGridView의 dataSource 속성을 데이터소스의 users 필드에 바인딩`,
    {
      formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
      controlId: z.string().describe('바인딩할 컨트롤 ID'),
      controlProperty: z
        .string()
        .describe('컨트롤의 속성명 (예: text, value, dataSource, checked)'),
      dataSourceId: z.string().describe('데이터를 제공할 DataSource ID'),
      dataField: z
        .string()
        .describe('DataSource에서 가져올 필드명 (예: users, name, email)'),
      bindingMode: z
        .enum(['oneWay', 'twoWay', 'oneTime'])
        .optional()
        .default('oneWay')
        .describe('바인딩 방향 (기본: oneWay)'),
    },
    async ({ formId, controlId, controlProperty, dataSourceId, dataField, bindingMode }) => {
      try {
        validateObjectId(formId, 'formId');

        const { form, updatedVersion } = await withDatabindingMutation(formId, (f) => {
          // 컨트롤 존재 검증
          const control = findControlById(f.controls, controlId);
          if (!control) {
            throw new ControlNotFoundError(controlId);
          }

          // 중복 바인딩 검사
          const exists = f.dataBindings.some(
            (b) => b.controlId === controlId && b.controlProperty === controlProperty,
          );
          if (exists) {
            throw new BindingExistsError(controlId, controlProperty);
          }

          f.dataBindings.push({
            controlId,
            controlProperty,
            dataSourceId,
            dataField,
            bindingMode,
          });
        });

        return toolResult({
          formId: form._id,
          controlId,
          controlProperty,
          dataSourceId,
          dataField,
          bindingMode,
          totalBindings: form.dataBindings.length,
          formVersion: updatedVersion,
        });
      } catch (error) {
        return handleDatabindingToolError(error, formId);
      }
    },
  );

  // 2. remove_data_binding
  server.tool(
    'remove_data_binding',
    '데이터 바인딩을 삭제합니다. controlId + controlProperty로 대상 바인딩을 식별합니다.',
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('컨트롤 ID'),
      controlProperty: z.string().describe('바인딩된 속성명'),
    },
    async ({ formId, controlId, controlProperty }) => {
      try {
        validateObjectId(formId, 'formId');

        const { form, updatedVersion } = await withDatabindingMutation(formId, (f) => {
          const idx = f.dataBindings.findIndex(
            (b) => b.controlId === controlId && b.controlProperty === controlProperty,
          );
          if (idx === -1) {
            throw new BindingNotFoundError(controlId, controlProperty);
          }

          f.dataBindings.splice(idx, 1);
        });

        return toolResult({
          formId: form._id,
          controlId,
          controlProperty,
          removed: true,
          remainingBindings: form.dataBindings.length,
          formVersion: updatedVersion,
        });
      } catch (error) {
        return handleDatabindingToolError(error, formId);
      }
    },
  );

  // 3. list_data_bindings
  server.tool(
    'list_data_bindings',
    '폼에 설정된 모든 데이터 바인딩 목록을 조회합니다. 각 바인딩의 controlId, controlProperty, dataSourceId, dataField, bindingMode를 포함합니다.',
    {
      formId: z.string().describe('폼 ID'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');

        const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
        const form = res.data;
        const dataBindings = form.dataBindings ?? [];

        // 컨트롤 이름 매핑 (재귀 탐색)
        const bindings = dataBindings.map((b) => {
          const control = findControlById(form.controls, b.controlId);
          return {
            controlId: b.controlId,
            controlName: control?.name ?? b.controlId,
            controlProperty: b.controlProperty,
            dataSourceId: b.dataSourceId,
            dataField: b.dataField,
            bindingMode: b.bindingMode,
          };
        });

        return toolResult({
          formId: form._id,
          bindings,
          totalCount: bindings.length,
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
}
