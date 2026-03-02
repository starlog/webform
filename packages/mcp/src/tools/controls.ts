import { z } from 'zod';
import crypto from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES, COMMON_EVENTS, CONTROL_EVENTS } from '@webform/common';
import type { ControlType, ControlDefinition, DockStyle } from '@webform/common';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';
import { formCache } from '../utils/cache.js';
import { autoPosition, snapToGrid } from '../utils/autoPosition.js';
import { CONTROL_DEFAULTS } from '../utils/controlDefaults.js';

// --- API 응답 타입 ---

interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: ControlDefinition[];
  eventHandlers: { controlId: string; eventName: string; handlerType: string; handlerCode: string }[];
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
    controls: ControlDefinition[];
  };
}

const CONTAINER_TYPES: ControlType[] = [
  'Panel',
  'GroupBox',
  'TabControl',
  'SplitContainer',
  'Card',
  'Collapse',
];

function isContainerType(type: ControlType): boolean {
  return CONTAINER_TYPES.includes(type);
}

function isValidControlType(type: string): type is ControlType {
  return (CONTROL_TYPES as readonly string[]).includes(type);
}

function getDefaultDock(type: ControlType): DockStyle {
  switch (type) {
    case 'MenuStrip':
    case 'ToolStrip':
      return 'Top';
    case 'StatusStrip':
      return 'Bottom';
    default:
      return 'None';
  }
}

// --- 컨트롤 탐색 유틸리티 ---

function findControlById(
  controls: ControlDefinition[],
  id: string,
): ControlDefinition | undefined {
  for (const ctrl of controls) {
    if (ctrl.id === id) return ctrl;
    if (ctrl.children) {
      const found = findControlById(ctrl.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function findControlWithParent(
  controls: ControlDefinition[],
  id: string,
  parent?: ControlDefinition,
): { control: ControlDefinition | undefined; parent: ControlDefinition | undefined; index: number } {
  for (let i = 0; i < controls.length; i++) {
    if (controls[i].id === id) {
      return { control: controls[i], parent, index: i };
    }
    if (controls[i].children) {
      const result = findControlWithParent(controls[i].children!, id, controls[i]);
      if (result.control) return result;
    }
  }
  return { control: undefined, parent: undefined, index: -1 };
}

function findControlByName(
  controls: ControlDefinition[],
  name: string,
): ControlDefinition | undefined {
  for (const ctrl of controls) {
    if (ctrl.name === name) return ctrl;
    if (ctrl.children) {
      const found = findControlByName(ctrl.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

// --- withFormUpdate: get → 조작 → put (낙관적 잠금 + 자동 재시도 + 캐싱) ---

async function withFormUpdate<T>(
  formId: string,
  fn: (form: FormData) => T,
  maxRetries = 2,
): Promise<{ result: T; formVersion: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 첫 시도: 캐시 활용, 재시도: 항상 서버에서 새로 조회
    let form: FormData;
    if (attempt === 0) {
      const cached = formCache.get(formId) as FormData | undefined;
      if (cached) {
        form = JSON.parse(JSON.stringify(cached));
      } else {
        const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
        form = res.data;
      }
    } else {
      formCache.invalidate(formId);
      const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
      form = res.data;
    }

    const result = fn(form);

    try {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        controls: form.controls,
        eventHandlers: form.eventHandlers,
      });
      form.version = updated.data.version;
      // 성공 후 캐시 갱신 — 다음 조작 시 GET 생략 가능
      formCache.set(formId, JSON.parse(JSON.stringify(form)));
      return { result, formVersion: form.version };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        formCache.invalidate(formId);
        continue;
      }
      throw err;
    }
  }

  throw new Error('최대 재시도 횟수 초과');
}

// --- 컨트롤 조작 함수 ---

function addControlToForm(
  form: FormData,
  control: {
    type: ControlType;
    name: string;
    properties?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    parentId?: string;
  },
): { controlId: string; position: { x: number; y: number }; size: { width: number; height: number } } {
  const existing = findControlByName(form.controls, control.name);
  if (existing) throw new Error(`컨트롤 이름 '${control.name}'이 이미 존재합니다.`);

  const id = crypto.randomUUID();
  const defaults = CONTROL_DEFAULTS[control.type];
  const size = control.size || defaults.size;
  const position = control.position
    ? snapToGrid(control.position)
    : autoPosition(form.controls, size, control.parentId);
  const properties = { ...defaults.properties, ...control.properties };

  const newControl: ControlDefinition = {
    id,
    type: control.type,
    name: control.name,
    properties,
    position,
    size,
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: getDefaultDock(control.type),
    tabIndex: form.controls.length,
    visible: true,
    enabled: true,
  };

  if (control.parentId) {
    const parent = findControlById(form.controls, control.parentId);
    if (!parent)
      throw new Error(`부모 컨트롤 '${control.parentId}'을 찾을 수 없습니다.`);
    if (!isContainerType(parent.type))
      throw new Error(
        `'${parent.type}'은 컨테이너 타입이 아닙니다. Panel, GroupBox, TabControl, SplitContainer, Card, Collapse만 가능합니다.`,
      );
    parent.children = parent.children || [];
    parent.children.push(newControl);
  } else {
    form.controls.push(newControl);
  }

  return { controlId: id, position, size };
}

function updateControlInForm(
  form: FormData,
  controlId: string,
  updates: {
    properties?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  },
): { controlName: string; updated: string[] } {
  const control = findControlById(form.controls, controlId);
  if (!control) throw new Error(`컨트롤 '${controlId}'을 찾을 수 없습니다.`);

  const updatedFields: string[] = [];

  if (updates.properties) {
    control.properties = { ...control.properties, ...updates.properties };
    updatedFields.push('properties');
  }
  if (updates.position) {
    control.position = snapToGrid(updates.position);
    updatedFields.push('position');
  }
  if (updates.size) {
    control.size = updates.size;
    updatedFields.push('size');
  }

  return { controlName: control.name, updated: updatedFields };
}

function removeControlFromForm(
  form: FormData,
  controlId: string,
): { removedName: string } {
  const { control, parent, index } = findControlWithParent(form.controls, controlId);
  if (!control) throw new Error(`컨트롤 '${controlId}'을 찾을 수 없습니다.`);

  const removedName = control.name;
  if (parent) {
    parent.children!.splice(index, 1);
  } else {
    form.controls.splice(index, 1);
  }

  form.eventHandlers = form.eventHandlers.filter((h) => h.controlId !== controlId);

  return { removedName };
}

// --- Tool 등록 ---

export function registerControlTools(server: McpServer): void {
  // 1. add_control
  server.tool(
    'add_control',
    `폼에 단일 컨트롤을 추가합니다. 컨트롤 1개만 추가할 때 사용하세요. 여러 컨트롤을 한꺼번에 추가하려면 batch_add_controls를 사용하세요.

position 미지정 시 기존 컨트롤과 겹치지 않도록 자동 배치(16px 그리드 스냅). size 미지정 시 타입별 기본 크기 적용.
parentId를 지정하면 Panel, GroupBox 등 컨테이너 내부에 배치됩니다.

반환값: { controlId, controlName, controlType, position, size, formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      type: z.string().describe('컨트롤 타입 (예: Button, TextBox, Label, DataGridView)'),
      name: z.string().describe('컨트롤 고유 이름 (예: btnSave, txtName, lblTitle)'),
      properties: z
        .record(z.unknown())
        .optional()
        .describe('컨트롤 속성 (타입별 속성 — get_control_schema로 확인 가능)'),
      position: z
        .object({
          x: z.number().min(0),
          y: z.number().min(0),
        })
        .optional()
        .describe('좌표 (미지정 시 자동 배치, 16px 그리드 스냅)'),
      size: z
        .object({
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .optional()
        .describe('크기 (미지정 시 타입별 기본 크기)'),
      parentId: z
        .string()
        .optional()
        .describe('부모 컨테이너 컨트롤 ID (Panel, GroupBox 등 내부 배치 시)'),
    },
    async ({ formId, type, name, properties, position, size, parentId }) => {
      try {
        validateObjectId(formId, 'formId');
        if (!isValidControlType(type)) {
          return toolError(
            `유효하지 않은 컨트롤 타입입니다: '${type}' (사용 가능: ${CONTROL_TYPES.join(', ')})`,
            {
              code: 'INVALID_CONTROL_TYPE',
              details: { type, availableTypes: CONTROL_TYPES },
              suggestion: 'list_control_types로 사용 가능한 타입 목록을 확인하세요.',
            },
          );
        }

        const { result, formVersion } = await withFormUpdate(formId, (form) =>
          addControlToForm(form, {
            type: type as ControlType,
            name,
            properties,
            position,
            size,
            parentId,
          }),
        );

        return toolResult({
          controlId: result.controlId,
          controlName: name,
          controlType: type,
          position: result.position,
          size: result.size,
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 2. update_control
  server.tool(
    'update_control',
    `개별 컨트롤의 속성, 위치, 크기를 수정합니다. 특정 컨트롤 하나를 수정할 때 사용하세요.
폼 전체 속성(title, width, height, theme 등)을 수정하려면 update_form을 사용하세요.

속성은 병합(merge) 방식: 기존 속성을 유지하면서 전달된 속성만 덮어씁니다.
예: properties: { text: '저장' } → text만 변경, 나머지 속성 유지.

반환값: { controlId, controlName, updated: ['properties'|'position'|'size'], formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('수정할 컨트롤 ID'),
      properties: z
        .record(z.unknown())
        .optional()
        .describe('수정할 속성 (병합 — 기존 속성 유지)'),
      position: z
        .object({
          x: z.number().min(0),
          y: z.number().min(0),
        })
        .optional()
        .describe('새 위치'),
      size: z
        .object({
          width: z.number().positive(),
          height: z.number().positive(),
        })
        .optional()
        .describe('새 크기'),
    },
    async ({ formId, controlId, properties, position, size }) => {
      try {
        validateObjectId(formId, 'formId');

        if (!properties && !position && !size) {
          return toolError(
            '수정할 내용을 지정하세요: properties, position, size 중 하나 이상 필요합니다.',
            {
              code: 'MISSING_UPDATE_FIELDS',
              details: { formId, controlId },
            },
          );
        }

        const { result, formVersion } = await withFormUpdate(formId, (form) =>
          updateControlInForm(form, controlId, { properties, position, size }),
        );

        return toolResult({
          controlId,
          controlName: result.controlName,
          updated: result.updated,
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 3. remove_control
  server.tool(
    'remove_control',
    `폼에서 컨트롤을 삭제합니다. 해당 컨트롤에 연결된 이벤트 핸들러도 자동으로 함께 삭제됩니다.

반환값: { removedControlId, removedName, formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('삭제할 컨트롤 ID'),
    },
    async ({ formId, controlId }) => {
      try {
        validateObjectId(formId, 'formId');

        const { result, formVersion } = await withFormUpdate(formId, (form) =>
          removeControlFromForm(form, controlId),
        );

        return toolResult({
          removedControlId: controlId,
          removedName: result.removedName,
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 4. move_control
  server.tool(
    'move_control',
    `컨트롤을 새 위치로 이동합니다. 좌표는 16px 그리드에 자동 스냅됩니다.
위치만 변경할 때 사용하세요. 속성/크기도 함께 변경하려면 update_control을 사용하세요.

반환값: { controlId, controlName, position: {x, y}, formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('이동할 컨트롤 ID'),
      position: z
        .object({
          x: z.number().min(0).describe('X 좌표'),
          y: z.number().min(0).describe('Y 좌표'),
        })
        .describe('새 위치 (16px 그리드 스냅)'),
    },
    async ({ formId, controlId, position }) => {
      try {
        validateObjectId(formId, 'formId');

        const { result, formVersion } = await withFormUpdate(formId, (form) =>
          updateControlInForm(form, controlId, { position }),
        );

        return toolResult({
          controlId,
          controlName: result.controlName,
          position: snapToGrid(position),
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 5. resize_control
  server.tool(
    'resize_control',
    `컨트롤의 크기를 변경합니다. 크기만 변경할 때 사용하세요.
속성/위치도 함께 변경하려면 update_control을 사용하세요.

반환값: { controlId, controlName, size: {width, height}, formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      controlId: z.string().describe('크기를 변경할 컨트롤 ID'),
      size: z
        .object({
          width: z.number().positive().describe('너비 (px)'),
          height: z.number().positive().describe('높이 (px)'),
        })
        .describe('새 크기'),
    },
    async ({ formId, controlId, size }) => {
      try {
        validateObjectId(formId, 'formId');

        const { result, formVersion } = await withFormUpdate(formId, (form) =>
          updateControlInForm(form, controlId, { size }),
        );

        return toolResult({
          controlId,
          controlName: result.controlName,
          size,
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 6. batch_add_controls
  server.tool(
    'batch_add_controls',
    `여러 컨트롤을 한 번에 일괄 추가합니다 (1~50개). 2개 이상의 컨트롤을 추가할 때는 add_control을 반복 호출하지 말고 이 Tool을 사용하세요.
하나의 API 호출로 원자적으로 처리되어 add_control 반복 대비 훨씬 효율적입니다.

position 미지정 시 이전 컨트롤 위치를 고려하여 순차 자동 배치됩니다.

반환값: { addedControls: [{controlId, name, type, position, size}], count, formVersion }`,
    {
      formId: z.string().describe('폼 ID'),
      controls: z
        .array(
          z.object({
            type: z.string().describe('컨트롤 타입'),
            name: z.string().describe('컨트롤 이름'),
            properties: z.record(z.unknown()).optional().describe('컨트롤 속성'),
            position: z
              .object({
                x: z.number().min(0),
                y: z.number().min(0),
              })
              .optional()
              .describe('위치 (미지정 시 자동)'),
            size: z
              .object({
                width: z.number().positive(),
                height: z.number().positive(),
              })
              .optional()
              .describe('크기 (미지정 시 기본)'),
            parentId: z.string().optional().describe('부모 컨테이너 ID'),
          }),
        )
        .min(1)
        .max(50)
        .describe('추가할 컨트롤 배열 (1~50개)'),
    },
    async ({ formId, controls }) => {
      try {
        validateObjectId(formId, 'formId');

        // 타입 일괄 검증
        for (const ctrl of controls) {
          if (!isValidControlType(ctrl.type)) {
            return toolError(
              `유효하지 않은 컨트롤 타입입니다: '${ctrl.type}' (사용 가능: ${CONTROL_TYPES.join(', ')})`,
              {
                code: 'INVALID_CONTROL_TYPE',
                details: { type: ctrl.type, availableTypes: CONTROL_TYPES },
                suggestion: 'list_control_types로 사용 가능한 타입 목록을 확인하세요.',
              },
            );
          }
        }

        // 입력 배열 내 이름 중복 검사
        const names = controls.map((c) => c.name);
        const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
        if (duplicates.length > 0) {
          return toolError(
            `입력 배열 내 이름이 중복됩니다: ${[...new Set(duplicates)].join(', ')}`,
            {
              code: 'DUPLICATE_CONTROL_NAMES',
              details: { duplicates: [...new Set(duplicates)] },
            },
          );
        }

        const { result, formVersion } = await withFormUpdate(formId, (form) => {
          const added: {
            controlId: string;
            name: string;
            type: string;
            position: { x: number; y: number };
            size: { width: number; height: number };
          }[] = [];

          // 순차적으로 추가 (자동 배치 시 이전 컨트롤 위치 반영)
          for (const ctrl of controls) {
            const result = addControlToForm(form, {
              type: ctrl.type as ControlType,
              name: ctrl.name,
              properties: ctrl.properties,
              position: ctrl.position,
              size: ctrl.size,
              parentId: ctrl.parentId,
            });
            added.push({
              controlId: result.controlId,
              name: ctrl.name,
              type: ctrl.type,
              position: result.position,
              size: result.size,
            });
          }

          return added;
        });

        return toolResult({
          addedControls: result,
          count: result.length,
          formVersion,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, {
              code: 'FORM_NOT_FOUND',
              details: { formId },
              suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
            });
          if (error.status === 409)
            return toolError(
              '버전 충돌이 발생했습니다. 폼이 다른 사용자에 의해 수정되었습니다.',
              {
                code: 'VERSION_CONFLICT',
                details: { formId },
                suggestion: '자동 재시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
              },
            );
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        }
        if (error instanceof Error)
          return toolError(error.message, { code: 'OPERATION_ERROR', details: { formId } });
        throw error;
      }
    },
  );

  // 7. list_control_types
  server.tool(
    'list_control_types',
    `사용 가능한 컨트롤 타입 목록을 카테고리별로 조회합니다. 각 타입의 설명, 기본 크기, 컨테이너 여부를 포함합니다.
add_control 또는 batch_add_controls에서 type 파라미터에 사용할 값을 확인할 때 호출하세요.

전체 42개 타입:
- 기본 컨트롤: Button, Label, TextBox, CheckBox, RadioButton, ComboBox, ListBox, NumericUpDown, DateTimePicker, ProgressBar, PictureBox
- 컨테이너: Panel, GroupBox, TabControl, SplitContainer
- 데이터: DataGridView, BindingNavigator, Chart, TreeView, ListView
- 메뉴/도구: MenuStrip, ToolStrip, StatusStrip
- 고급: RichTextBox, WebBrowser, SpreadsheetView, JsonEditor, MongoDBView, GraphView, MongoDBConnector
- 추가 요소: Slider, Switch, Upload, Alert, Tag, Divider, Card, Badge, Avatar, Tooltip, Collapse, Statistic

반환값: { totalTypes, categories: { [카테고리]: [{type, description, defaultSize, isContainer}] } }`,
    {},
    async () => {
      const categories: Record<
        string,
        { type: string; description: string; defaultSize: { width: number; height: number }; isContainer: boolean }[]
      > = {};

      for (const type of CONTROL_TYPES) {
        const def = CONTROL_DEFAULTS[type];
        if (!categories[def.category]) categories[def.category] = [];
        categories[def.category].push({
          type,
          description: def.description,
          defaultSize: def.size,
          isContainer: def.isContainer,
        });
      }

      return toolResult({
        totalTypes: CONTROL_TYPES.length,
        categories,
      });
    },
  );

  // 8. get_control_schema
  server.tool(
    'get_control_schema',
    `특정 컨트롤 타입의 속성 스키마를 조회합니다. 컨트롤의 properties에 어떤 값을 설정할 수 있는지 확인할 때 사용하세요.
설정 가능한 속성명, 타입, 기본값, 사용 가능한 이벤트 목록을 반환합니다.

반환값: { type, description, category, isContainer, defaultSize, defaultProperties, availableProperties, events }`,
    {
      controlType: z
        .string()
        .describe('컨트롤 타입 (예: Button, TextBox, DataGridView)'),
    },
    async ({ controlType }) => {
      if (!isValidControlType(controlType)) {
        return toolError(
          `유효하지 않은 컨트롤 타입입니다: '${controlType}' (사용 가능: ${CONTROL_TYPES.join(', ')})`,
          {
            code: 'INVALID_CONTROL_TYPE',
            details: { type: controlType, availableTypes: CONTROL_TYPES },
            suggestion: 'list_control_types로 사용 가능한 타입 목록을 확인하세요.',
          },
        );
      }

      const def = CONTROL_DEFAULTS[controlType as ControlType];
      const specificEvents = CONTROL_EVENTS[controlType] || [];
      const events = [
        ...COMMON_EVENTS,
        ...specificEvents.filter(
          (e: string) => !(COMMON_EVENTS as readonly string[]).includes(e),
        ),
      ];

      // 기본 속성에서 availableProperties 스키마 생성
      const availableProperties: Record<string, { type: string; default?: unknown; description: string }> = {};
      for (const [key, value] of Object.entries(def.properties)) {
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        availableProperties[key] = {
          type: valueType === 'object' ? 'object' : valueType,
          default: value,
          description: key,
        };
      }

      // 공통 속성 추가
      availableProperties['backColor'] = { type: 'color', description: '배경색' };
      availableProperties['foreColor'] = { type: 'color', description: '글자색' };
      availableProperties['font'] = { type: 'font', description: '폰트 설정' };
      availableProperties['textAlign'] = {
        type: 'enum',
        description: '텍스트 정렬 (TopLeft, TopCenter, TopRight, MiddleLeft, MiddleCenter, MiddleRight, BottomLeft, BottomCenter, BottomRight)',
      };

      return toolResult({
        type: controlType,
        description: def.description,
        category: def.category,
        isContainer: def.isContainer,
        defaultSize: def.size,
        defaultProperties: def.properties,
        availableProperties,
        events,
      });
    },
  );
}
