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

/**
 * TabControl의 tabs 배열에 id가 없으면 UUID를 부여하고,
 * 각 탭에 대응하는 Panel 자식을 자동 생성한다.
 * (디자이너의 DesignerCanvas 드롭 로직과 동일한 구조)
 */
function ensureTabControlChildren(
  ctrl: ControlDefinition,
): void {
  const tabs = ctrl.properties.tabs as Array<{ title: string; id?: string }> | undefined;
  if (!tabs || !Array.isArray(tabs)) return;

  // 1. 각 탭에 id 부여
  for (const tab of tabs) {
    if (!tab.id) {
      tab.id = crypto.randomUUID();
    }
  }

  // 2. 이미 Panel 자식이 있으면 (tabId 기반) 건너뜀
  ctrl.children = ctrl.children || [];
  const existingTabIds = new Set(
    ctrl.children
      .filter((c) => c.type === 'Panel' && c.properties.tabId)
      .map((c) => c.properties.tabId as string),
  );

  for (const tab of tabs) {
    if (existingTabIds.has(tab.id!)) continue;
    const panel: ControlDefinition = {
      id: crypto.randomUUID(),
      type: 'Panel',
      name: `tabPage_${tab.title.replace(/\s+/g, '')}`,
      properties: { tabId: tab.id!, borderStyle: 'None' },
      position: { x: 0, y: 0 },
      size: { width: ctrl.size.width, height: ctrl.size.height },
      anchor: { top: true, bottom: false, left: true, right: false },
      dock: 'None' as const,
      tabIndex: 0,
      visible: true,
      enabled: true,
    };
    ctrl.children.push(panel);
  }
}

/**
 * TabControl에 직접 자식을 추가하려 할 때, 활성 탭의 Panel로 리다이렉트한다.
 * tabIndex가 주어지면 해당 탭의 Panel을 사용하고, 없으면 selectedIndex(기본 0)를 사용.
 */
function resolveTabControlParent(
  parent: ControlDefinition,
  tabIndex?: number,
): ControlDefinition {
  if (parent.type !== 'TabControl') return parent;

  const tabs = parent.properties.tabs as Array<{ title: string; id: string }> | undefined;
  if (!tabs || !Array.isArray(tabs)) return parent;

  const idx = tabIndex ?? (parent.properties.selectedIndex as number) ?? 0;
  const targetTabId = tabs[idx]?.id;
  if (!targetTabId) return parent;

  // TabControl의 children 중 해당 tabId를 가진 Panel 찾기
  const panel = parent.children?.find(
    (c) => c.type === 'Panel' && (c.properties.tabId as string) === targetTabId,
  );
  return panel ?? parent;
}

/**
 * Collapse의 panels 배열에 대응하는 Panel 자식을 자동 생성한다.
 * (디자이너의 DesignerCanvas 드롭 로직과 동일한 구조)
 */
// Collapse 헤더 높이: padding(8+8) + font(~17px) + border(1px) ≈ 34px
// 디자이너 CollapseControl의 HEADER_HEIGHT(33) + border와 동일
const COLLAPSE_HEADER_HEIGHT = 34;

function ensureCollapseChildren(ctrl: ControlDefinition): void {
  const panels = ctrl.properties.panels as Array<{ title: string; key: string }> | undefined;
  if (!panels || !Array.isArray(panels)) return;

  ctrl.children = ctrl.children || [];
  const existingKeys = new Set(
    ctrl.children
      .filter((c) => c.type === 'Panel' && c.properties.collapseKey)
      .map((c) => c.properties.collapseKey as string),
  );

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    if (existingKeys.has(panel.key)) continue;
    // Panel y-position: 해당 패널 콘텐츠 영역의 시작 위치
    // 모든 헤더(0..i)가 위에 쌓이므로 (i+1) * COLLAPSE_HEADER_HEIGHT
    const panelY = (i + 1) * COLLAPSE_HEADER_HEIGHT;
    const panelCtrl: ControlDefinition = {
      id: crypto.randomUUID(),
      type: 'Panel',
      name: `collapsePanel_${panel.key}`,
      properties: { _parentId: ctrl.id, collapseKey: panel.key, borderStyle: 'None' },
      position: { x: 0, y: panelY },
      size: { width: ctrl.size.width, height: ctrl.size.height - panelY },
      anchor: { top: true, bottom: false, left: true, right: false },
      dock: 'None' as const,
      tabIndex: 0,
      visible: true,
      enabled: true,
    };
    ctrl.children.push(panelCtrl);
  }
}

/**
 * Collapse에 직접 자식을 추가하려 할 때, 대상 패널의 Panel로 리다이렉트한다.
 * tabIndex가 주어지면 해당 패널(0부터)을 사용하고, 없으면 첫 번째 활성 패널 사용.
 */
function resolveCollapseParent(
  parent: ControlDefinition,
  tabIndex?: number,
): ControlDefinition {
  if (parent.type !== 'Collapse') return parent;

  const panels = parent.properties.panels as Array<{ title: string; key: string }> | undefined;
  if (!panels || !Array.isArray(panels)) return parent;

  let targetKey: string | undefined;
  if (tabIndex !== undefined) {
    targetKey = panels[tabIndex]?.key;
  } else {
    // 첫 번째 활성 패널 또는 첫 패널
    const activeKeys = parent.properties.activeKeys as string | undefined;
    if (activeKeys) {
      targetKey = activeKeys.split(',').map((s) => s.trim()).filter(Boolean)[0];
    }
    if (!targetKey) targetKey = panels[0]?.key;
  }
  if (!targetKey) return parent;

  const panel = parent.children?.find(
    (c) => c.type === 'Panel' && (c.properties.collapseKey as string) === targetKey,
  );
  return panel ?? parent;
}

function addControlToForm(
  form: FormData,
  control: {
    type: ControlType;
    name: string;
    properties?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    parentId?: string;
    tabIndex?: number;
  },
): { controlId: string; position: { x: number; y: number }; size: { width: number; height: number } } {
  const existing = findControlByName(form.controls, control.name);
  if (existing) throw new Error(`컨트롤 이름 '${control.name}'이 이미 존재합니다.`);

  const id = crypto.randomUUID();
  const defaults = CONTROL_DEFAULTS[control.type];
  const size = control.size || defaults.size;
  const properties = { ...defaults.properties, ...control.properties };

  // parentId가 TabControl/Collapse를 가리키면 실제 Panel로 먼저 해석
  let resolvedParentId = control.parentId;
  if (control.parentId) {
    let parent = findControlById(form.controls, control.parentId);
    if (!parent)
      throw new Error(`부모 컨트롤 '${control.parentId}'을 찾을 수 없습니다.`);
    if (!isContainerType(parent.type))
      throw new Error(
        `'${parent.type}'은 컨테이너 타입이 아닙니다. Panel, GroupBox, TabControl, SplitContainer, Card, Collapse만 가능합니다.`,
      );
    parent = resolveTabControlParent(parent, control.tabIndex);
    parent = resolveCollapseParent(parent, control.tabIndex);
    resolvedParentId = parent.id;
  }

  const position = control.position
    ? snapToGrid(control.position)
    : autoPosition(form.controls, size, resolvedParentId);

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

  // TabControl 생성 시 탭 Panel 자식 자동 생성
  if (control.type === 'TabControl') {
    ensureTabControlChildren(newControl);
  }
  // Collapse 생성 시 패널 Panel 자식 자동 생성
  if (control.type === 'Collapse') {
    ensureCollapseChildren(newControl);
  }

  if (resolvedParentId) {
    const parent = findControlById(form.controls, resolvedParentId)!;
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

// --- 컨트롤별 상세 속성 스키마 오버라이드 ---

const CONTROL_PROPERTY_SCHEMAS: Partial<
  Record<string, Record<string, { type: string; default?: unknown; description: string; options?: string[]; formats?: Record<string, { description: string; example: unknown }> }>>
> = {
  Chart: {
    chartType: {
      type: 'enum',
      options: ['Line', 'Bar', 'Column', 'Area', 'StackedBar', 'StackedArea', 'Pie', 'Doughnut', 'Scatter', 'Radar'],
      default: 'Column',
      description: '차트 유형',
    },
    colors: {
      type: 'string',
      default: '',
      description: '커스텀 색상 팔레트 (쉼표 구분, 예: "#ff0000,#00ff00,#0000ff")',
    },
    series: {
      type: 'array',
      default: [],
      description: '차트 데이터 배열. 차트 타입별 형식이 다릅니다. formats 필드를 참고하세요. Nested 형식도 지원: [{ name: "Series1", data: [{ x: "카테고리", y: 숫자 }] }]',
      formats: {
        'Line/Bar/Column/Area/StackedBar/StackedArea': {
          description: 'Cartesian 계열. x는 카테고리(문자열), 나머지 키는 시리즈명(숫자값). StackedBar/StackedArea는 누적 표시',
          example: [
            { x: '1월', sales: 100, profit: 40 },
            { x: '2월', sales: 150, profit: 60 },
            { x: '3월', sales: 120, profit: 50 },
          ],
        },
        'Pie/Doughnut': {
          description: '원형 계열. name은 항목명, value는 수치',
          example: [
            { name: '서울', value: 40 },
            { name: '부산', value: 25 },
            { name: '대구', value: 20 },
            { name: '기타', value: 15 },
          ],
        },
        Scatter: {
          description: '산점도. x는 숫자, 나머지 키는 시리즈명(숫자값)',
          example: [
            { x: 10, series1: 20 },
            { x: 20, series1: 35 },
            { x: 30, series1: 25 },
          ],
        },
        Radar: {
          description: '레이더. x는 축 이름(문자열), 나머지 키는 시리즈명(숫자값)',
          example: [
            { x: '공격', team1: 80, team2: 65 },
            { x: '방어', team1: 70, team2: 85 },
            { x: '속도', team1: 90, team2: 60 },
          ],
        },
      },
    },
    title: {
      type: 'string',
      default: '',
      description: '차트 제목 (상단에 표시)',
    },
    xAxisTitle: {
      type: 'string',
      default: '',
      description: 'X축 제목 (Cartesian 계열에서 사용)',
    },
    yAxisTitle: {
      type: 'string',
      default: '',
      description: 'Y축 제목 (Cartesian 계열에서 사용)',
    },
    showLegend: {
      type: 'boolean',
      default: true,
      description: '범례 표시 여부',
    },
    showGrid: {
      type: 'boolean',
      default: true,
      description: '그리드 라인 표시 여부',
    },
  },
};

// --- Tool 등록 ---

export function registerControlTools(server: McpServer): void {
  // 1. add_control
  server.tool(
    'add_control',
    `폼에 단일 컨트롤을 추가합니다. 컨트롤 1개만 추가할 때 사용하세요. 여러 컨트롤을 한꺼번에 추가하려면 batch_add_controls를 사용하세요.

position 미지정 시 기존 컨트롤과 겹치지 않도록 자동 배치(16px 그리드 스냅). size 미지정 시 타입별 기본 크기 적용.
parentId를 지정하면 Panel, GroupBox 등 컨테이너 내부에 배치됩니다.
TabControl에 자식을 추가할 때는 parentId에 TabControl ID를 지정하면 자동으로 활성 탭의 Panel에 추가됩니다. tabIndex로 특정 탭을 지정할 수 있습니다.
Collapse에 자식을 추가할 때는 parentId에 Collapse ID를 지정하면 자동으로 활성 패널에 추가됩니다. tabIndex로 특정 패널을 지정할 수 있습니다 (0부터 시작).

주의 — DataGridView columns 속성:
  columns에는 반드시 field와 headerText를 사용하세요. name/header는 데이터 매핑에 사용되지 않습니다.
  올바른 예: { field: 'email', headerText: '이메일', width: 200 }

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
        .describe('부모 컨테이너 컨트롤 ID (Panel, GroupBox, TabControl 등 내부 배치 시)'),
      tabIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('TabControl 자식 추가 시 대상 탭 인덱스 (0부터 시작, 미지정 시 selectedIndex 사용)'),
    },
    async ({ formId, type, name, properties, position, size, parentId, tabIndex }) => {
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
            tabIndex,
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

주의 — DataGridView columns 속성:
  columns에는 반드시 field와 headerText를 사용하세요. name/header는 데이터 매핑에 사용되지 않습니다.
  올바른 예: { field: 'email', headerText: '이메일', width: 200 }

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
            tabIndex: z
              .number()
              .int()
              .min(0)
              .optional()
              .describe('TabControl 자식 추가 시 대상 탭 인덱스 (0부터)'),
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
              tabIndex: ctrl.tabIndex,
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
- 고급: RichTextBox, WebBrowser, SpreadsheetView, JsonEditor, MongoDBView, MongoDBConnector
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

      // 컨트롤별 상세 스키마 오버라이드 적용
      const overrides = CONTROL_PROPERTY_SCHEMAS[controlType];
      if (overrides) {
        Object.assign(availableProperties, overrides);
      }

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
