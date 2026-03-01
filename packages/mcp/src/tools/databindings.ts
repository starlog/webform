import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

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



// --- 커스텀 에러 ---

class BindingExistsError extends Error {
  constructor(
    public controlId: string,
    public controlProperty: string,
  ) {
    super(`이미 존재하는 바인딩: ${controlId}.${controlProperty}`);
  }
}

class BindingNotFoundError extends Error {
  constructor(
    public controlId: string,
    public controlProperty: string,
  ) {
    super(`바인딩을 찾을 수 없음: ${controlId}.${controlProperty}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`컨트롤을 찾을 수 없음: ${controlId}`);
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
      `이미 존재하는 바인딩입니다: ${error.controlId}.${error.controlProperty}`,
      {
        code: 'BINDING_ALREADY_EXISTS',
        details: { controlId: error.controlId, controlProperty: error.controlProperty, formId },
        suggestion: 'remove_data_binding으로 기존 바인딩을 삭제한 후 다시 추가하세요.',
      },
    );
  }
  if (error instanceof BindingNotFoundError) {
    return toolError(
      `바인딩을 찾을 수 없습니다: ${error.controlId}.${error.controlProperty}`,
      {
        code: 'BINDING_NOT_FOUND',
        details: { controlId: error.controlId, controlProperty: error.controlProperty, formId },
        suggestion: 'list_data_bindings로 현재 바인딩 목록을 확인하세요.',
      },
    );
  }
  if (error instanceof ControlNotFoundError) {
    return toolError(
      `컨트롤을 찾을 수 없습니다 (controlId: ${error.controlId})`,
      {
        code: 'CONTROL_NOT_FOUND',
        details: { controlId: error.controlId, formId },
        suggestion: 'get_form으로 폼의 컨트롤 목록을 확인하세요.',
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

export function registerDatabindingTools(server: McpServer): void {
  // 1. add_data_binding
  server.tool(
    'add_data_binding',
    `폼의 컨트롤 속성을 데이터소스 필드에 바인딩합니다. 데이터소스를 먼저 create_datasource로 생성한 후 사용하세요.
기존 바인딩을 변경하려면 remove_data_binding 후 다시 추가하세요. 현재 바인딩 목록은 list_data_bindings로 확인하세요.

바인딩 모드:
- oneWay (기본): 데이터소스 → 컨트롤 (단방향). 데이터 변경 시 컨트롤 자동 업데이트.
- twoWay: 양방향. 컨트롤 값 변경 시 데이터소스에도 반영.
- oneTime: 초기 로드 시 1회만 바인딩.

예시: DataGridView.dataSource ← 데이터소스.users, TextBox.text ← 데이터소스.userName

반환값: { formId, controlId, controlProperty, dataSourceId, dataField, bindingMode, totalBindings, formVersion }`,
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
    `데이터 바인딩을 삭제합니다. controlId + controlProperty 조합으로 삭제할 바인딩을 식별합니다.
바인딩을 변경하려면 삭제 후 add_data_binding으로 재생성하세요.

반환값: { formId, controlId, controlProperty, removed: true, remainingBindings, formVersion }`,
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
    `폼에 설정된 모든 데이터 바인딩 목록을 조회합니다. 바인딩 추가/삭제 전 현재 상태를 확인할 때 사용하세요.

반환값: { formId, bindings: [{controlId, controlName, controlProperty, dataSourceId, dataField, bindingMode}], totalCount }`,
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
