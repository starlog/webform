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
  // ── 기본 컨트롤 (11종) ──
  Button: {
    text: { type: 'string', default: 'Button', description: '버튼에 표시할 텍스트' },
  },
  Label: {
    text: { type: 'string', default: 'Label', description: '레이블에 표시할 텍스트' },
    autoSize: { type: 'boolean', description: '텍스트에 맞게 크기 자동 조절' },
  },
  TextBox: {
    text: { type: 'string', default: '', description: '입력 필드의 텍스트 값' },
    multiline: { type: 'boolean', description: '여러 줄 입력 허용 여부' },
    readOnly: { type: 'boolean', description: '읽기 전용 여부' },
    passwordChar: { type: 'string', description: '비밀번호 마스킹 문자 (예: "*")' },
    maxLength: { type: 'number', description: '최대 입력 글자 수' },
  },
  CheckBox: {
    text: { type: 'string', default: 'CheckBox', description: '체크박스 옆에 표시할 텍스트' },
    checked: { type: 'boolean', default: false, description: '체크 여부' },
  },
  RadioButton: {
    text: { type: 'string', default: 'RadioButton', description: '라디오 버튼 옆에 표시할 텍스트' },
    checked: { type: 'boolean', default: false, description: '선택 여부' },
    groupName: { type: 'string', default: 'default', description: '라디오 버튼 그룹명 (같은 그룹 내에서 하나만 선택 가능)' },
  },
  ComboBox: {
    items: { type: 'array', default: [], description: '드롭다운 항목 목록 (문자열 배열)', formats: { default: { description: '문자열 배열', example: ['항목1', '항목2', '항목3'] } } },
    selectedIndex: { type: 'number', default: -1, description: '선택된 항목 인덱스 (-1이면 미선택)' },
    dropDownStyle: { type: 'enum', options: ['DropDown', 'DropDownList', 'Simple'], description: '드롭다운 스타일 (DropDown: 편집+선택, DropDownList: 선택만, Simple: 항상 펼침)' },
  },
  ListBox: {
    items: { type: 'array', default: [], description: '목록 항목 (문자열 배열)', formats: { default: { description: '문자열 배열', example: ['항목1', '항목2', '항목3'] } } },
    selectedIndex: { type: 'number', default: -1, description: '선택된 항목 인덱스 (-1이면 미선택)' },
    selectionMode: { type: 'enum', options: ['None', 'One', 'MultiSimple', 'MultiExtended'], description: '선택 모드 (None: 선택 불가, One: 단일, MultiSimple: 다중 클릭, MultiExtended: Shift/Ctrl 다중)' },
  },
  NumericUpDown: {
    value: { type: 'number', default: 0, description: '현재 숫자 값' },
    minimum: { type: 'number', default: 0, description: '최솟값' },
    maximum: { type: 'number', default: 100, description: '최댓값' },
    increment: { type: 'number', description: '증감 단위 (화살표 클릭 시 변경량)' },
  },
  DateTimePicker: {
    value: { type: 'string', description: '날짜/시간 값 (ISO 문자열, 예: "2024-01-15")' },
    format: { type: 'enum', default: 'Short', options: ['Short', 'Long', 'Time', 'Custom'], description: '날짜/시간 표시 형식 (Short: 날짜만, Long: 요일 포함, Time: 시간만, Custom: 사용자 정의)' },
  },
  ProgressBar: {
    value: { type: 'number', default: 0, description: '현재 진행 값' },
    minimum: { type: 'number', default: 0, description: '최솟값' },
    maximum: { type: 'number', default: 100, description: '최댓값' },
  },
  PictureBox: {
    imageUrl: { type: 'string', description: '표시할 이미지 URL' },
    sizeMode: { type: 'enum', default: 'Normal', options: ['Normal', 'StretchImage', 'AutoSize', 'CenterImage', 'Zoom'], description: '이미지 크기 조절 모드 (Normal: 원본, StretchImage: 늘리기, AutoSize: 자동, CenterImage: 가운데, Zoom: 비율 유지 확대)' },
    borderStyle: { type: 'enum', options: ['None', 'FixedSingle', 'Fixed3D'], description: '테두리 스타일' },
  },

  // ── 컨테이너 (4종) ──
  Panel: {
    borderStyle: { type: 'enum', default: 'None', options: ['None', 'FixedSingle', 'Fixed3D'], description: '패널 테두리 스타일' },
    autoScroll: { type: 'boolean', description: '내용이 넘칠 때 자동 스크롤바 표시' },
  },
  GroupBox: {
    text: { type: 'string', default: 'GroupBox', description: '그룹 박스 제목 텍스트' },
  },
  TabControl: {
    tabs: {
      type: 'array',
      default: [{ title: 'TabPage1', id: 'tab-1' }, { title: 'TabPage2', id: 'tab-2' }],
      description: '탭 목록. id는 자동 생성되므로 title만 지정해도 됩니다. 각 탭에 대응하는 Panel 자식이 자동 생성됩니다.',
      formats: { default: { description: '탭 정의 배열', example: [{ title: '탭1', id: 'tab-1' }, { title: '탭2', id: 'tab-2' }] } },
    },
    selectedIndex: { type: 'number', default: 0, description: '활성 탭 인덱스 (0부터 시작)' },
  },
  SplitContainer: {
    orientation: { type: 'enum', options: ['Horizontal', 'Vertical'], description: '분할 방향 (Horizontal: 좌우, Vertical: 상하)' },
    fixedPanel: { type: 'enum', options: ['None', 'Panel1', 'Panel2'], description: '크기 고정할 패널 (None: 비율 유지, Panel1: 첫 번째 고정, Panel2: 두 번째 고정)' },
    splitterDistance: { type: 'number', description: '스플리터 위치 (px, 첫 번째 패널의 크기)' },
    splitterWidth: { type: 'number', description: '스플리터 두께 (px, 기본값 4)' },
    isSplitterFixed: { type: 'boolean', description: '스플리터 고정 여부 (true면 드래그 불가)' },
  },

  // ── 데이터 컨트롤 (5종) ──
  DataGridView: {
    columns: {
      type: 'array',
      default: [],
      description: '그리드 컬럼 정의. 반드시 field와 headerText를 사용하세요.',
      formats: {
        default: {
          description: '컬럼 정의 배열. field: 데이터 매핑 필드명, headerText: 표시할 헤더 텍스트, width: 열 너비(px), sortable: 정렬 가능 여부, editable: 편집 가능 여부',
          example: [
            { field: 'name', headerText: '이름', width: 150 },
            { field: 'email', headerText: '이메일', width: 200, editable: true },
            { field: 'age', headerText: '나이', width: 80, sortable: true },
          ],
        },
      },
    },
    dataSource: {
      type: 'array',
      description: '데이터 배열. 이벤트 핸들러에서 ctx.controls로 동적 설정 가능. columns의 field 값과 매핑됩니다.',
      formats: {
        default: {
          description: '객체 배열. 각 객체의 키는 columns의 field 값과 일치해야 합니다.',
          example: [
            { name: '홍길동', email: 'hong@example.com', age: 30 },
            { name: '김철수', email: 'kim@example.com', age: 25 },
          ],
        },
      },
    },
    readOnly: { type: 'boolean', description: '읽기 전용 여부 (셀 편집 비활성화)' },
  },
  TreeView: {
    nodes: {
      type: 'array',
      default: [],
      description: '트리 노드 데이터. 계층 구조를 children으로 표현합니다.',
      formats: {
        default: {
          description: '트리 노드 배열. text: 표시 텍스트, children: 하위 노드, expanded: 펼침 여부, checked: 체크 여부 (checkBoxes=true일 때)',
          example: [
            { text: '문서', expanded: true, children: [
              { text: '보고서', children: [{ text: '월간보고.pdf' }] },
              { text: '양식', children: [{ text: '신청서.docx' }] },
            ]},
            { text: '사진', expanded: false, children: [{ text: '여행' }] },
          ],
        },
      },
    },
    showLines: { type: 'boolean', default: false, description: '노드 간 연결선 표시 여부' },
    showPlusMinus: { type: 'boolean', default: true, description: '확장/축소 (+/-) 아이콘 표시 여부' },
    checkBoxes: { type: 'boolean', default: false, description: '각 노드에 체크박스 표시 여부' },
    selectedNodePath: { type: 'string', default: '', description: '선택된 노드 경로 (점 구분, 예: "0.1.2"는 첫 번째 노드의 두 번째 자식의 세 번째 자식). 이벤트 핸들러에서 ctx.controls로 읽기/쓰기 가능' },
  },
  ListView: {
    items: {
      type: 'array',
      default: [],
      description: '리스트 항목 데이터',
      formats: {
        default: {
          description: '항목 배열. text: 주 텍스트, subItems: 추가 열 데이터 (Details 모드에서 사용)',
          example: [
            { text: '파일1.txt', subItems: ['10KB', '2024-01-01'] },
            { text: '파일2.pdf', subItems: ['250KB', '2024-02-15'] },
          ],
        },
      },
    },
    columns: {
      type: 'array',
      default: [],
      description: '열 정의 (Details 모드에서 사용)',
      formats: {
        default: {
          description: '열 정의 배열. text/headerText: 헤더 텍스트, field: 필드명, width: 열 너비(px)',
          example: [
            { text: '파일명', width: 200 },
            { text: '크기', width: 80 },
            { text: '수정일', width: 120 },
          ],
        },
      },
    },
    view: { type: 'enum', default: 'Details', options: ['LargeIcon', 'SmallIcon', 'List', 'Details', 'Tile'], description: '보기 모드 (LargeIcon: 큰 아이콘, SmallIcon: 작은 아이콘, List: 목록, Details: 상세, Tile: 타일)' },
    selectedIndex: { type: 'number', default: -1, description: '선택된 항목 인덱스 (-1이면 미선택)' },
    multiSelect: { type: 'boolean', default: false, description: '다중 선택 허용 여부' },
    fullRowSelect: { type: 'boolean', default: true, description: '전체 행 선택 여부 (Details 모드)' },
    gridLines: { type: 'boolean', default: false, description: '그리드 라인 표시 여부 (Details 모드)' },
  },
  BindingNavigator: {
    bindingSource: { type: 'string', default: '', description: '바인딩 대상 컨트롤 이름 (예: DataGridView의 name). 해당 컨트롤의 dataSource 배열을 탐색합니다.' },
    showAddButton: { type: 'boolean', default: true, description: '행 추가(+) 버튼 표시 여부' },
    showDeleteButton: { type: 'boolean', default: true, description: '행 삭제(✕) 버튼 표시 여부' },
  },
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

  // ── 고급 컨트롤 (11종) ──
  MenuStrip: {
    items: {
      type: 'array',
      default: [],
      description: '메뉴 항목 배열. 계층 구조를 children으로 표현합니다.',
      formats: {
        default: {
          description: '메뉴 항목 배열. text: 표시 텍스트, children: 하위 메뉴, shortcut: 단축키, separator: true이면 구분선',
          example: [
            { text: '파일', children: [
              { text: '새로 만들기', shortcut: 'Ctrl+N' },
              { text: '열기', shortcut: 'Ctrl+O' },
              { text: '', separator: true },
              { text: '끝내기' },
            ]},
            { text: '편집', children: [
              { text: '실행 취소', shortcut: 'Ctrl+Z' },
            ]},
          ],
        },
      },
    },
  },
  ToolStrip: {
    items: {
      type: 'array',
      default: [],
      description: '도구 모음 항목 배열',
      formats: {
        default: {
          description: '항목 배열. type: button/separator/label/dropdown. button: text+icon+tooltip, dropdown: text+items(하위 배열)',
          example: [
            { type: 'button', text: '새로 만들기', icon: '📄', tooltip: '새 파일' },
            { type: 'button', text: '저장', icon: '💾' },
            { type: 'separator' },
            { type: 'label', text: '확대:' },
            { type: 'dropdown', text: '100%', items: [{ text: '50%' }, { text: '100%' }, { text: '200%' }] },
          ],
        },
      },
    },
  },
  StatusStrip: {
    items: {
      type: 'array',
      default: [],
      description: '상태 표시줄 항목 배열',
      formats: {
        default: {
          description: '항목 배열. type: label/progressBar/dropDownButton. spring: true이면 남은 공간 차지, value: progressBar의 진행률(0~100)',
          example: [
            { type: 'label', text: '준비', spring: true },
            { type: 'progressBar', value: 75, width: 100 },
            { type: 'label', text: '행: 0' },
          ],
        },
      },
    },
  },
  RichTextBox: {
    text: { type: 'string', default: '', description: 'HTML 서식 텍스트 내용' },
    readOnly: { type: 'boolean', default: false, description: '읽기 전용 여부' },
    scrollBars: { type: 'enum', default: 'Both', options: ['None', 'Horizontal', 'Vertical', 'Both'], description: '스크롤바 표시 방향' },
  },
  WebBrowser: {
    url: { type: 'string', default: 'about:blank', description: '표시할 웹 페이지 URL' },
    allowNavigation: { type: 'boolean', default: true, description: '페이지 내 네비게이션 허용 여부' },
  },
  SpreadsheetView: {
    columns: {
      type: 'array',
      default: [],
      description: '스프레드시트 열 정의',
      formats: {
        default: {
          description: '열 정의 배열. field: 데이터 필드명, headerText: 표시할 헤더 텍스트, width: 열 너비(px)',
          example: [
            { field: 'name', headerText: '이름', width: 150 },
            { field: 'score', headerText: '점수', width: 100 },
          ],
        },
      },
    },
    data: {
      type: 'array',
      default: [],
      description: '스프레드시트 데이터 배열 (각 행은 열 field에 대응하는 키-값 객체)',
      formats: {
        default: {
          description: '행 데이터 배열',
          example: [
            { name: '홍길동', score: 95 },
            { name: '김철수', score: 87 },
          ],
        },
      },
    },
    readOnly: { type: 'boolean', default: false, description: '읽기 전용 여부' },
    showToolbar: { type: 'boolean', default: true, description: '상단 도구 모음 표시 여부' },
    showFormulaBar: { type: 'boolean', default: true, description: '수식 입력줄 표시 여부' },
    showRowNumbers: { type: 'boolean', default: true, description: '행 번호 표시 여부' },
    allowAddRows: { type: 'boolean', default: true, description: '행 추가 허용 여부' },
    allowDeleteRows: { type: 'boolean', default: true, description: '행 삭제 허용 여부' },
    allowSort: { type: 'boolean', default: true, description: '열 정렬 허용 여부' },
    allowFilter: { type: 'boolean', default: false, description: '필터링 허용 여부' },
    dataSource: { type: 'array', description: '데이터 배열 (data의 대안, 객체 배열 형식으로 직접 바인딩)' },
  },
  JsonEditor: {
    value: { type: 'object', default: {}, description: 'JSON 데이터 객체' },
    readOnly: { type: 'boolean', default: false, description: '읽기 전용 여부' },
    expandDepth: { type: 'number', default: 1, description: '기본 펼침 깊이 (0이면 모두 접힘)' },
  },
  MongoDBView: {
    title: { type: 'string', default: '', description: 'MongoDB 뷰어 헤더에 표시할 제목 (미지정 시 "MongoDB: {collection}"으로 표시)' },
    connectionString: { type: 'string', default: '', description: 'MongoDB 연결 문자열 (예: mongodb://localhost:27017)' },
    database: { type: 'string', default: '', description: '데이터베이스 이름' },
    collection: { type: 'string', default: '', description: '컬렉션 이름' },
    columns: { type: 'string', default: '', description: '표시할 컬럼 목록 (쉼표 구분, 예: "name,email,age"). 미지정 시 모든 컬럼 표시' },
    filter: { type: 'string', default: '{}', description: 'MongoDB 쿼리 필터 (JSON 문자열)' },
    pageSize: { type: 'number', default: 50, description: '페이지당 표시할 문서 수' },
    readOnly: { type: 'boolean', default: false, description: '읽기 전용 여부' },
    showToolbar: { type: 'boolean', default: true, description: '도구 모음 표시 여부' },
  },
  MongoDBConnector: {
    connectionString: { type: 'string', default: '', description: 'MongoDB 연결 문자열 (예: mongodb://localhost:27017)' },
    database: { type: 'string', default: '', description: '데이터베이스 이름' },
    defaultCollection: { type: 'string', default: '', description: '기본 컬렉션 이름' },
    queryTimeout: { type: 'number', default: 10000, description: '쿼리 타임아웃 (밀리초)' },
    maxResultCount: { type: 'number', default: 1000, description: '최대 결과 건수' },
  },
  SwaggerConnector: {
    specYaml: { type: 'string', default: '', description: 'Swagger/OpenAPI 스펙 YAML 문자열' },
    baseUrl: { type: 'string', default: '', description: 'API 기본 URL (스펙의 servers를 오버라이드)' },
    defaultHeaders: { type: 'string', default: '{}', description: '기본 HTTP 헤더 (JSON 문자열, 예: {"Authorization": "Bearer token"})' },
    timeout: { type: 'number', default: 10000, description: '요청 타임아웃 (밀리초)' },
  },
  DataSourceConnector: {
    dsType: { type: 'enum', default: 'database', options: ['database', 'restApi', 'static'], description: '데이터소스 유형 (database: SQL DB, restApi: REST API, static: 정적 데이터)' },
    dialect: { type: 'enum', default: 'postgresql', options: ['postgresql', 'mysql', 'mssql'], description: 'DB 종류 (dsType=database일 때만 사용)' },
    host: { type: 'string', default: '', description: 'DB 호스트 (dsType=database)' },
    port: { type: 'number', default: 5432, description: 'DB 포트 (dsType=database)' },
    user: { type: 'string', default: '', description: 'DB 사용자 (dsType=database)' },
    password: { type: 'string', default: '', description: 'DB 비밀번호 (dsType=database)' },
    database: { type: 'string', default: '', description: 'DB 이름 (dsType=database)' },
    ssl: { type: 'boolean', default: false, description: 'SSL 연결 사용 여부 (dsType=database)' },
    baseUrl: { type: 'string', default: '', description: 'API 기본 URL (dsType=restApi)' },
    headers: { type: 'string', default: '{}', description: 'HTTP 헤더 JSON 문자열 (dsType=restApi)' },
    authType: { type: 'enum', default: 'none', options: ['none', 'basic', 'bearer', 'apiKey'], description: '인증 유형 (dsType=restApi, none: 없음, basic: ID/PW, bearer: 토큰, apiKey: API 키)' },
    authCredentials: { type: 'string', default: '{}', description: '인증 자격 증명 JSON (dsType=restApi, authType에 따라 형식 다름)' },
    data: { type: 'string', default: '[]', description: '정적 데이터 JSON 배열 문자열 (dsType=static)' },
    queryTimeout: { type: 'number', default: 10000, description: '쿼리 타임아웃 (밀리초)' },
    maxResultCount: { type: 'number', default: 1000, description: '최대 결과 건수' },
  },

  // ── Extra Elements — Step 1 (6종) ──
  Slider: {
    value: { type: 'number', default: 0, description: '현재 슬라이더 값' },
    minimum: { type: 'number', default: 0, description: '최솟값' },
    maximum: { type: 'number', default: 100, description: '최댓값' },
    step: { type: 'number', description: '증감 단위 (드래그 시 스냅 간격)' },
    orientation: { type: 'enum', default: 'Horizontal', options: ['Horizontal', 'Vertical'], description: '슬라이더 방향' },
    showValue: { type: 'boolean', default: true, description: '현재 값 표시 여부' },
    trackColor: { type: 'string', description: '슬라이더 트랙(배경) 색상 (CSS 색상값)' },
    fillColor: { type: 'string', description: '슬라이더 채워진 부분 색상 (CSS 색상값)' },
  },
  Switch: {
    checked: { type: 'boolean', default: false, description: '토글 상태 (true=ON, false=OFF)' },
    text: { type: 'string', default: '', description: '스위치 옆에 표시할 텍스트' },
    onText: { type: 'string', default: 'ON', description: 'ON 상태일 때 스위치 내부에 표시할 텍스트' },
    offText: { type: 'string', default: 'OFF', description: 'OFF 상태일 때 스위치 내부에 표시할 텍스트' },
    onColor: { type: 'string', description: 'ON 상태 배경색 (CSS 색상값)' },
    offColor: { type: 'string', description: 'OFF 상태 배경색 (CSS 색상값)' },
  },
  Upload: {
    uploadMode: { type: 'enum', default: 'DropZone', options: ['Button', 'DropZone'], description: '업로드 방식 (Button: 버튼 클릭, DropZone: 드래그 앤 드롭 영역)' },
    text: { type: 'string', default: 'Click or drag file to upload', description: '업로드 영역에 표시할 안내 텍스트' },
    borderStyle: { type: 'enum', default: 'Dashed', options: ['None', 'Solid', 'Dashed'], description: '테두리 스타일' },
    accept: { type: 'string', description: '허용 파일 형식 (예: ".jpg,.png" 또는 "image/*")' },
    multiple: { type: 'boolean', description: '다중 파일 선택 허용 여부' },
    maxFileSize: { type: 'number', description: '최대 파일 크기 (바이트)' },
    maxCount: { type: 'number', description: '최대 업로드 파일 수' },
  },
  Alert: {
    message: { type: 'string', default: 'Alert message', description: '알림 메시지 (주 텍스트)' },
    description: { type: 'string', default: '', description: '보조 설명 텍스트' },
    alertType: { type: 'enum', default: 'Info', options: ['Success', 'Info', 'Warning', 'Error'], description: '알림 유형 (색상과 아이콘이 변경됨)' },
    showIcon: { type: 'boolean', default: true, description: '아이콘 표시 여부' },
    closable: { type: 'boolean', default: false, description: '닫기 버튼 표시 여부' },
    banner: { type: 'boolean', default: false, description: '배너 모드 (전체 너비, 테두리 없음)' },
  },
  Tag: {
    tags: { type: 'array', default: ['Tag1', 'Tag2'], description: '태그 문자열 배열', formats: { default: { description: '문자열 배열', example: ['태그1', '태그2', '태그3'] } } },
    tagColor: { type: 'enum', default: 'Default', options: ['Default', 'Blue', 'Green', 'Red', 'Orange', 'Purple', 'Cyan', 'Gold'], description: '태그 색상' },
    closable: { type: 'boolean', default: false, description: '각 태그에 닫기(x) 버튼 표시 여부' },
    addable: { type: 'boolean', default: false, description: '새 태그 추가 버튼(+) 표시 여부' },
  },
  Divider: {
    text: { type: 'string', default: '', description: '구분선 위에 표시할 텍스트 (비어있으면 텍스트 없는 구분선)' },
    orientation: { type: 'enum', default: 'Horizontal', options: ['Horizontal', 'Vertical'], description: '구분선 방향' },
    textAlign: { type: 'enum', default: 'Center', options: ['Left', 'Center', 'Right'], description: '텍스트 위치 (orientation=Horizontal일 때)' },
    lineStyle: { type: 'enum', default: 'Solid', options: ['Solid', 'Dashed', 'Dotted'], description: '선 스타일' },
    lineColor: { type: 'string', description: '구분선 색상 (CSS 색상값)' },
  },

  // ── Extra Elements — Step 2 (6종) ──
  Card: {
    title: { type: 'string', default: 'Card Title', description: '카드 제목' },
    subtitle: { type: 'string', default: '', description: '카드 부제목' },
    showHeader: { type: 'boolean', default: true, description: '헤더 영역 표시 여부' },
    showBorder: { type: 'boolean', default: true, description: '테두리 표시 여부' },
    hoverable: { type: 'boolean', default: false, description: '마우스 호버 시 그림자 효과' },
    size: { type: 'enum', default: 'Default', options: ['Default', 'Small'], description: '카드 크기 (Small: 컴팩트한 패딩)' },
    borderRadius: { type: 'number', default: 8, description: '모서리 둥글기 (px)' },
  },
  Badge: {
    count: { type: 'number', default: 0, description: '배지에 표시할 숫자' },
    overflowCount: { type: 'number', default: 99, description: '최대 표시 숫자 (초과 시 99+ 형태로 표시)' },
    showZero: { type: 'boolean', default: false, description: 'count=0일 때도 표시할지 여부' },
    dot: { type: 'boolean', default: false, description: '숫자 대신 점(dot)으로 표시' },
    status: { type: 'enum', default: 'Default', options: ['Default', 'Success', 'Processing', 'Error', 'Warning'], description: '배지 상태 (색상이 변경됨)' },
    text: { type: 'string', default: '', description: '배지 옆에 표시할 텍스트' },
    badgeColor: { type: 'string', default: '', description: '배지 커스텀 색상 (CSS 색상값)' },
  },
  Avatar: {
    imageUrl: { type: 'string', default: '', description: '아바타 이미지 URL (비어있으면 text 첫 글자 표시)' },
    text: { type: 'string', default: 'U', description: '이미지가 없을 때 표시할 텍스트 (첫 글자만 사용)' },
    shape: { type: 'enum', default: 'Circle', options: ['Circle', 'Square'], description: '아바타 모양' },
  },
  Tooltip: {
    title: { type: 'string', default: 'Tooltip text', description: '툴팁에 표시할 텍스트' },
    placement: { type: 'enum', default: 'Top', options: ['Top', 'Bottom', 'Left', 'Right', 'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'], description: '툴팁 표시 위치' },
    trigger: { type: 'enum', default: 'Hover', options: ['Hover', 'Click', 'Focus'], description: '툴팁 트리거 방식' },
  },
  Collapse: {
    panels: {
      type: 'array',
      default: [{ title: 'Panel 1', key: '1', panelHeight: 0 }, { title: 'Panel 2', key: '2', panelHeight: 0 }],
      description: '아코디언 패널 목록. 각 패널에 대응하는 Panel 자식이 자동 생성됩니다.',
      formats: {
        default: {
          description: '패널 정의 배열. title: 표시 제목, key: 고유 키, panelHeight: 패널 높이(0이면 자동)',
          example: [
            { title: '기본 정보', key: '1', panelHeight: 0 },
            { title: '상세 설정', key: '2', panelHeight: 0 },
          ],
        },
      },
    },
    activeKeys: { type: 'string', default: '1', description: '펼쳐진 패널 키 (쉼표 구분으로 여러 개 가능, 예: "1,2")' },
    accordion: { type: 'boolean', default: false, description: '아코디언 모드 (true면 한 번에 하나의 패널만 펼침)' },
    bordered: { type: 'boolean', default: true, description: '테두리 표시 여부' },
    expandIconPosition: { type: 'enum', default: 'Start', options: ['Start', 'End'], description: '펼침 아이콘 위치 (Start: 왼쪽, End: 오른쪽)' },
  },
  Statistic: {
    title: { type: 'string', default: 'Statistic', description: '통계 제목 (상단에 표시)' },
    value: { type: 'string', default: '0', description: '통계 값 (문자열, 숫자 포맷팅에 사용)' },
    prefix: { type: 'string', default: '', description: '값 앞에 표시할 접두사 (예: "₩", "▲")' },
    suffix: { type: 'string', default: '', description: '값 뒤에 표시할 접미사 (예: "%", "건")' },
    precision: { type: 'number', default: 0, description: '소수점 자릿수' },
    showGroupSeparator: { type: 'boolean', default: true, description: '천 단위 구분자(,) 표시 여부' },
    valueColor: { type: 'string', default: '', description: '값 텍스트 색상 (CSS 색상값)' },
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
