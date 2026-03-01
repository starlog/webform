# 컨트롤 조작 Tools 구현 계획

## 개요

`packages/mcp/src/tools/controls.ts` — MCP-SERVER.md 섹션 2.3에 정의된 8개 컨트롤 조작 Tools를 구현한다.

폼 수정 없이 개별 컨트롤을 편리하게 추가/수정/삭제하는 **고수준 Tool**로, 내부적으로 `get_form` → 조작 → `update_form` 패턴으로 구현한다. 기존 Express 서버의 REST API를 `apiClient`를 통해 호출한다.

## 1. 파일 구조

```
packages/mcp/src/
├── tools/
│   ├── index.ts            (수정 — registerControlTools export 추가)
│   └── controls.ts         (신규 — 8개 Tool + 헬퍼 함수)
├── utils/
│   ├── autoPosition.ts     (신규 — 자동 배치 알고리즘)
│   ├── controlDefaults.ts  (신규 — 컨트롤 타입별 기본값)
│   └── index.ts            (수정 — 새 유틸 export 추가)
└── server.ts               (수정 — registerControlTools 호출 활성화)
```

## 2. Tool 목록 및 API 매핑

컨트롤 조작 Tool은 직접적인 REST 엔드포인트가 없다. 내부적으로 기존 폼 관리 API를 조합하여 구현한다.

| # | Tool 이름 | 내부 API 호출 | 비고 |
|---|-----------|--------------|------|
| 1 | `add_control` | GET `/api/forms/:formId` → PUT `/api/forms/:formId` | 단일 컨트롤 추가 |
| 2 | `update_control` | GET → PUT | 속성/위치/크기 수정 |
| 3 | `remove_control` | GET → PUT | 컨트롤 삭제 |
| 4 | `move_control` | GET → PUT | 위치 이동 |
| 5 | `resize_control` | GET → PUT | 크기 변경 |
| 6 | `batch_add_controls` | GET → PUT | 여러 컨트롤 일괄 추가 |
| 7 | `list_control_types` | (로컬 데이터) | CONTROL_TYPES 반환 |
| 8 | `get_control_schema` | (로컬 데이터) | 타입별 속성 스키마 반환 |

## 3. 컨트롤 조작 헬퍼 함수 (`tools/controls.ts` 내부)

### 3.1 공통 패턴: get_form → 변환 → update_form

모든 조작 Tool은 아래 패턴을 따른다:

```typescript
async function withFormUpdate<T>(
  formId: string,
  fn: (form: FormData) => T
): Promise<{ result: T; formVersion: number }> {
  // 1. 현재 폼 조회
  const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
  const form = res.data;

  // 2. 조작 수행
  const result = fn(form);

  // 3. 폼 업데이트 (낙관적 잠금)
  const updated = await apiClient.put<MutateFormResponse>(
    `/api/forms/${formId}`,
    { version: form.version, controls: form.controls }
  );

  return { result, formVersion: updated.data.version };
}
```

### 3.2 addControlToForm()

```typescript
function addControlToForm(
  form: FormData,
  control: {
    type: ControlType;
    name: string;
    properties?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    parentId?: string;
  }
): { controlId: string } {
  // 1. 이름 중복 검사
  const existing = form.controls.find(c => c.name === control.name);
  if (existing) throw new Error(`컨트롤 이름 '${control.name}'이 이미 존재합니다.`);

  // 2. 컨트롤 ID 생성 (UUID)
  const id = crypto.randomUUID();

  // 3. 기본값 적용 (CONTROL_DEFAULTS에서 가져옴)
  const defaults = CONTROL_DEFAULTS[control.type];
  const size = control.size || defaults.size;
  const position = control.position || autoPosition(form.controls, size, control.parentId);
  const properties = { ...defaults.properties, ...control.properties };

  // 4. ControlDefinition 구성
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

  // 5. parentId가 있으면 해당 컨테이너의 children에 추가
  if (control.parentId) {
    const parent = findControlById(form.controls, control.parentId);
    if (!parent) throw new Error(`부모 컨트롤 '${control.parentId}'을 찾을 수 없습니다.`);
    if (!isContainerType(parent.type)) throw new Error(`'${parent.type}'은 컨테이너 타입이 아닙니다.`);
    parent.children = parent.children || [];
    parent.children.push(newControl);
  } else {
    form.controls.push(newControl);
  }

  return { controlId: id };
}
```

### 3.3 updateControlInForm()

```typescript
function updateControlInForm(
  form: FormData,
  controlId: string,
  updates: {
    properties?: Record<string, unknown>;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
  }
): void {
  const control = findControlById(form.controls, controlId);
  if (!control) throw new Error(`컨트롤 '${controlId}'을 찾을 수 없습니다.`);

  // 속성 병합 (기존 속성 유지, 새 속성으로 덮어쓰기)
  if (updates.properties) {
    control.properties = { ...control.properties, ...updates.properties };
  }
  if (updates.position) {
    control.position = snapToGrid(updates.position);
  }
  if (updates.size) {
    control.size = updates.size;
  }
}
```

### 3.4 removeControlFromForm()

```typescript
function removeControlFromForm(
  form: FormData,
  controlId: string
): { removedName: string } {
  // 1. 컨트롤 찾기 (중첩 구조 탐색)
  const { control, parent, index } = findControlWithParent(form.controls, controlId);
  if (!control) throw new Error(`컨트롤 '${controlId}'을 찾을 수 없습니다.`);

  // 2. 삭제
  const removedName = control.name;
  if (parent) {
    parent.children!.splice(index, 1);
  } else {
    form.controls.splice(index, 1);
  }

  // 3. 관련 이벤트 핸들러, 데이터 바인딩도 같이 정리
  form.eventHandlers = form.eventHandlers.filter(h => h.controlId !== controlId);
  form.dataBindings = form.dataBindings.filter(b => b.controlId !== controlId);

  return { removedName };
}
```

### 3.5 유틸리티 함수

```typescript
// 컨트롤 ID로 중첩 구조 내 컨트롤 찾기
function findControlById(
  controls: ControlDefinition[],
  id: string
): ControlDefinition | undefined;

// 컨트롤과 부모 정보 함께 찾기
function findControlWithParent(
  controls: ControlDefinition[],
  id: string
): { control: ControlDefinition | undefined; parent: ControlDefinition | undefined; index: number };

// 컨테이너 타입 여부 확인
function isContainerType(type: ControlType): boolean {
  return ['Panel', 'GroupBox', 'TabControl', 'SplitContainer', 'Card', 'Collapse'].includes(type);
}

// 16px 그리드 스냅
function snapToGrid(position: { x: number; y: number }, gridSize = 16): { x: number; y: number } {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

// 타입별 기본 dock 스타일
function getDefaultDock(type: ControlType): DockStyle {
  switch (type) {
    case 'MenuStrip': case 'ToolStrip': return 'Top';
    case 'StatusStrip': return 'Bottom';
    default: return 'None';
  }
}
```

## 4. 자동 배치 알고리즘 (`utils/autoPosition.ts`)

컨트롤 추가 시 `position` 미지정이면 자동 배치한다.

### 4.1 알고리즘 설계

```typescript
export function autoPosition(
  existingControls: ControlDefinition[],
  newSize: { width: number; height: number },
  parentId?: string
): { x: number; y: number } {
  // 1. parentId가 있으면 해당 컨테이너 내부 컨트롤만 대상
  const siblings = parentId
    ? findControlById(existingControls, parentId)?.children || []
    : existingControls.filter(c => !isDocked(c));

  // 2. 겹치지 않는 위치 찾기
  return findNonOverlappingPosition(siblings, newSize);
}
```

### 4.2 겹침 방지 로직

```typescript
const GRID_SIZE = 16;   // 16px 그리드
const GAP = 16;         // 컨트롤 간 최소 간격
const START_X = 16;     // 시작 X 좌표
const START_Y = 16;     // 시작 Y 좌표
const MAX_WIDTH = 800;  // 폼 기본 너비 (기준)

function findNonOverlappingPosition(
  existingControls: ControlDefinition[],
  newSize: { width: number; height: number }
): { x: number; y: number } {
  if (existingControls.length === 0) {
    return { x: START_X, y: START_Y };
  }

  // 전략: 기존 컨트롤들 아래에 순차 배치
  // 1. 기존 컨트롤들의 최대 하단 Y 좌표 계산
  let maxBottom = 0;
  for (const ctrl of existingControls) {
    const bottom = ctrl.position.y + ctrl.size.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  // 2. 마지막 컨트롤 아래 GAP 만큼 여백 두고 배치
  const candidate = { x: START_X, y: maxBottom + GAP };

  // 3. 겹침 확인 → 겹치면 Y를 더 아래로 이동
  while (hasOverlap(existingControls, candidate, newSize)) {
    candidate.y += GRID_SIZE;
  }

  // 4. 그리드 스냅
  return snapToGrid(candidate, GRID_SIZE);
}

function hasOverlap(
  controls: ControlDefinition[],
  position: { x: number; y: number },
  size: { width: number; height: number }
): boolean {
  for (const ctrl of controls) {
    if (
      position.x < ctrl.position.x + ctrl.size.width + GAP &&
      position.x + size.width + GAP > ctrl.position.x &&
      position.y < ctrl.position.y + ctrl.size.height + GAP &&
      position.y + size.height + GAP > ctrl.position.y
    ) {
      return true;
    }
  }
  return false;
}
```

### 4.3 Docked 컨트롤 제외

`dock`이 'None'이 아닌 컨트롤(MenuStrip, ToolStrip, StatusStrip 등)은 자동 배치 대상에서 제외한다. 이들은 dock 속성에 따라 폼 가장자리에 자동 배치된다.

```typescript
function isDocked(control: ControlDefinition): boolean {
  return control.dock !== 'None';
}
```

## 5. 컨트롤 타입별 기본값 (`utils/controlDefaults.ts`)

`packages/designer/src/stores/designerStore.ts`의 `getDefaultSize()`와 `getDefaultProperties()`를 기반으로, MCP 서버용 CONTROL_DEFAULTS를 구성한다.

### 5.1 구조

```typescript
import type { ControlType } from '@webform/common';

interface ControlDefault {
  size: { width: number; height: number };
  properties: Record<string, unknown>;
  description: string;       // AI가 참고할 한국어 설명
  category: string;          // 분류 (기본/컨테이너/데이터/고급/Extra)
  isContainer: boolean;      // 자식 컨트롤을 가질 수 있는지
}

export const CONTROL_DEFAULTS: Record<ControlType, ControlDefault> = { ... };
```

### 5.2 44개 타입 전체 기본값

#### Phase 1 — 기본 컨트롤 (11종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `Button` | 75 × 23 | `{ text: 'Button' }` | 클릭 버튼 |
| `Label` | 100 × 23 | `{ text: 'Label' }` | 텍스트 레이블 |
| `TextBox` | 100 × 23 | `{ text: '' }` | 텍스트 입력 필드 |
| `CheckBox` | 104 × 24 | `{ text: 'CheckBox', checked: false }` | 체크박스 |
| `RadioButton` | 104 × 24 | `{ text: 'RadioButton', checked: false, groupName: 'default' }` | 라디오 버튼 |
| `ComboBox` | 121 × 23 | `{ items: [], selectedIndex: -1 }` | 드롭다운 선택 |
| `ListBox` | 120 × 96 | `{ items: [], selectedIndex: -1 }` | 목록 선택 |
| `NumericUpDown` | 120 × 23 | `{ value: 0, minimum: 0, maximum: 100 }` | 숫자 입력 |
| `DateTimePicker` | 200 × 23 | `{ format: 'Short' }` | 날짜/시간 선택 |
| `ProgressBar` | 100 × 23 | `{ value: 0, minimum: 0, maximum: 100 }` | 진행 표시줄 |
| `PictureBox` | 100 × 50 | `{ sizeMode: 'Normal' }` | 이미지 표시 |

#### Phase 1 — 컨테이너 (4종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `Panel` | 200 × 100 | `{ borderStyle: 'None' }` | 패널 컨테이너 |
| `GroupBox` | 200 × 100 | `{ text: 'GroupBox' }` | 그룹 박스 컨테이너 |
| `TabControl` | 200 × 100 | `{ tabs: [{title:'TabPage1',...},{title:'TabPage2',...}], selectedIndex: 0 }` | 탭 컨테이너 |
| `SplitContainer` | 150 × 100 | `{}` | 분할 패널 |

#### Phase 2 — 데이터 컨트롤 (5종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `DataGridView` | 240 × 150 | `{ columns: [] }` | 데이터 그리드 |
| `BindingNavigator` | 100 × 23 | `{}` | 데이터 네비게이터 |
| `Chart` | 100 × 23 | `{}` | 차트 |
| `TreeView` | 100 × 23 | `{}` | 트리 뷰 |
| `ListView` | 100 × 23 | `{}` | 리스트 뷰 |

#### Phase 3 — 고급 컨트롤 (10종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `MenuStrip` | 800 × 24 | `{ items: [{text:'파일',...},{text:'편집',...},...] }` | 메뉴 바 (dock: Top) |
| `ToolStrip` | 800 × 25 | `{ items: [{type:'button',text:'새로 만들기',...},...] }` | 도구 모음 (dock: Top) |
| `StatusStrip` | 800 × 22 | `{ items: [{type:'label',text:'준비',spring:true}] }` | 상태 표시줄 (dock: Bottom) |
| `RichTextBox` | 300 × 150 | `{ text: '', readOnly: false, scrollBars: 'Both' }` | 서식 있는 텍스트 |
| `WebBrowser` | 400 × 300 | `{ url: 'about:blank', allowNavigation: true }` | 웹 브라우저 |
| `SpreadsheetView` | 400 × 300 | `{ columns: [], data: [], readOnly: false, showToolbar: true, ... }` | 스프레드시트 |
| `JsonEditor` | 300 × 250 | `{ value: {}, readOnly: false, expandDepth: 1 }` | JSON 편집기 |
| `MongoDBView` | 450 × 350 | `{ connectionString: '', database: '', collection: '', ... }` | MongoDB 뷰어 |
| `GraphView` | 400 × 300 | `{ graphType: 'Bar', title: '', showLegend: true, showGrid: true }` | 그래프 뷰 |
| `MongoDBConnector` | 120 × 40 | `{ connectionString: '', database: '', defaultCollection: '', ... }` | MongoDB 연결 |

#### Extra Elements — Step 1 (6종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `Slider` | 200 × 30 | `{ value: 0, minimum: 0, maximum: 100, orientation: 'Horizontal', showValue: true }` | 슬라이더 |
| `Switch` | 120 × 30 | `{ checked: false, text: '', onText: 'ON', offText: 'OFF' }` | 토글 스위치 |
| `Upload` | 300 × 120 | `{ uploadMode: 'DropZone', text: 'Click or drag file to upload', borderStyle: 'Dashed' }` | 파일 업로드 |
| `Alert` | 300 × 50 | `{ message: 'Alert message', description: '', alertType: 'Info', showIcon: true, closable: false, banner: false }` | 알림 |
| `Tag` | 200 × 30 | `{ tags: ['Tag1','Tag2'], tagColor: 'Default', closable: false, addable: false }` | 태그 |
| `Divider` | 300 × 24 | `{ text: '', orientation: 'Horizontal', textAlign: 'Center', lineStyle: 'Solid' }` | 구분선 |

#### Extra Elements — Step 2 (6종)

| 타입 | 기본 크기 | 주요 기본 속성 | 설명 |
|------|-----------|---------------|------|
| `Card` | 300 × 200 | `{ title: 'Card Title', subtitle: '', showHeader: true, showBorder: true, hoverable: false, size: 'Default', borderRadius: 8 }` | 카드 컨테이너 |
| `Badge` | 80 × 30 | `{ count: 0, overflowCount: 99, showZero: false, dot: false, status: 'Default', text: '', badgeColor: '' }` | 배지 |
| `Avatar` | 40 × 40 | `{ imageUrl: '', text: 'U', shape: 'Circle' }` | 아바타 |
| `Tooltip` | 100 × 30 | `{ title: 'Tooltip text', placement: 'Top', trigger: 'Hover' }` | 툴팁 |
| `Collapse` | 300 × 200 | `{ panels: [{title:'Panel 1',key:'1'},{title:'Panel 2',key:'2'}], activeKeys: '1', accordion: false, bordered: true, expandIconPosition: 'Start' }` | 접기/펼치기 컨테이너 |
| `Statistic` | 150 × 80 | `{ title: 'Statistic', value: '0', prefix: '', suffix: '', precision: 0, showGroupSeparator: true, valueColor: '' }` | 통계 표시 |

### 5.3 데이터 소스

기본값은 `packages/designer/src/stores/designerStore.ts`의 `getDefaultSize()`(109행)와 `getDefaultProperties()`(154행)에서 직접 가져온다. MCP 패키지에서 이를 독립적으로 복제하여 유지한다.

> **참고**: `@webform/common`의 `CONTROL_TYPES` 배열을 import하여 44개 타입이 누락 없이 모두 포함되도록 보장한다.

## 6. 각 Tool 상세 설계

### 6.1 add_control

```typescript
server.tool(
  'add_control',
  '폼에 컨트롤을 추가합니다. position 미지정 시 자동 배치, size 미지정 시 타입별 기본 크기 적용. 사용 가능한 타입: Button, Label, TextBox, CheckBox, RadioButton, ComboBox, ListBox, NumericUpDown, DateTimePicker, ProgressBar, PictureBox, Panel, GroupBox, TabControl, SplitContainer, DataGridView, Chart, TreeView, ListView, MenuStrip, ToolStrip, StatusStrip, RichTextBox, WebBrowser, SpreadsheetView, JsonEditor, MongoDBView, GraphView, MongoDBConnector, Slider, Switch, Upload, Alert, Tag, Divider, Card, Badge, Avatar, Tooltip, Collapse, Statistic 등 44종',
  {
    formId: z.string().describe('폼 ID'),
    type: z.string().describe('컨트롤 타입 (예: Button, TextBox, Label, DataGridView)'),
    name: z.string().describe('컨트롤 고유 이름 (예: btnSave, txtName, lblTitle)'),
    properties: z.record(z.unknown()).optional()
      .describe('컨트롤 속성 (타입별 속성 — get_control_schema로 확인 가능)'),
    position: z.object({
      x: z.number().min(0),
      y: z.number().min(0),
    }).optional().describe('좌표 (미지정 시 자동 배치, 16px 그리드 스냅)'),
    size: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }).optional().describe('크기 (미지정 시 타입별 기본 크기)'),
    parentId: z.string().optional()
      .describe('부모 컨테이너 컨트롤 ID (Panel, GroupBox 등 내부 배치 시)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `type`이 CONTROL_TYPES에 포함되는지 검증
3. `withFormUpdate(formId, form => addControlToForm(form, { type, name, ... }))`
4. 성공 시: `{ controlId, controlName, controlType, position, size, formVersion }` 반환
5. 에러 시: 이름 중복 → `toolError()`, 부모 컨트롤 미발견 → `toolError()`

**반환값 (성공)**:
```json
{
  "controlId": "a1b2c3d4-...",
  "controlName": "btnSave",
  "controlType": "Button",
  "position": { "x": 16, "y": 16 },
  "size": { "width": 75, "height": 23 },
  "formVersion": 4
}
```

### 6.2 update_control

```typescript
server.tool(
  'update_control',
  '컨트롤의 속성, 위치, 크기를 수정합니다. 속성은 병합 방식으로 적용됩니다 (기존 속성 유지, 전달된 속성만 덮어쓰기).',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('수정할 컨트롤 ID'),
    properties: z.record(z.unknown()).optional()
      .describe('수정할 속성 (병합 — 기존 속성 유지)'),
    position: z.object({
      x: z.number().min(0),
      y: z.number().min(0),
    }).optional().describe('새 위치'),
    size: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }).optional().describe('새 크기'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. properties, position, size 중 하나 이상 필요 (모두 없으면 에러)
3. `withFormUpdate(formId, form => updateControlInForm(form, controlId, { properties, position, size }))`
4. 성공 시: `{ controlId, controlName, updated: ['properties', 'position', 'size'], formVersion }` 반환

### 6.3 remove_control

```typescript
server.tool(
  'remove_control',
  '폼에서 컨트롤을 삭제합니다. 관련 이벤트 핸들러와 데이터 바인딩도 함께 삭제됩니다.',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('삭제할 컨트롤 ID'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `withFormUpdate(formId, form => removeControlFromForm(form, controlId))`
3. 성공 시: `{ removedControlId, removedName, formVersion }` 반환
4. update_form 시 `controls`, `eventHandlers`, `dataBindings` 모두 전송

### 6.4 move_control

```typescript
server.tool(
  'move_control',
  '컨트롤을 새 위치로 이동합니다. 16px 그리드에 스냅됩니다.',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('이동할 컨트롤 ID'),
    position: z.object({
      x: z.number().min(0).describe('X 좌표'),
      y: z.number().min(0).describe('Y 좌표'),
    }).describe('새 위치 (16px 그리드 스냅)'),
  },
  handler
);
```

**핸들러 로직**:
1. 내부적으로 `updateControlInForm` 호출 (position만 변경)
2. `snapToGrid(position)` 적용
3. 성공 시: `{ controlId, controlName, position: { x, y }, formVersion }` 반환

### 6.5 resize_control

```typescript
server.tool(
  'resize_control',
  '컨트롤의 크기를 변경합니다.',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('크기를 변경할 컨트롤 ID'),
    size: z.object({
      width: z.number().positive().describe('너비 (px)'),
      height: z.number().positive().describe('높이 (px)'),
    }).describe('새 크기'),
  },
  handler
);
```

**핸들러 로직**:
1. 내부적으로 `updateControlInForm` 호출 (size만 변경)
2. 성공 시: `{ controlId, controlName, size: { width, height }, formVersion }` 반환

### 6.6 batch_add_controls

```typescript
server.tool(
  'batch_add_controls',
  '여러 컨트롤을 한 번에 일괄 추가합니다. 하나의 update_form 호출로 처리되어 효율적입니다. position 미지정 시 순차 자동 배치됩니다.',
  {
    formId: z.string().describe('폼 ID'),
    controls: z.array(z.object({
      type: z.string().describe('컨트롤 타입'),
      name: z.string().describe('컨트롤 이름'),
      properties: z.record(z.unknown()).optional().describe('컨트롤 속성'),
      position: z.object({
        x: z.number().min(0),
        y: z.number().min(0),
      }).optional().describe('위치 (미지정 시 자동)'),
      size: z.object({
        width: z.number().positive(),
        height: z.number().positive(),
      }).optional().describe('크기 (미지정 시 기본)'),
      parentId: z.string().optional().describe('부모 컨테이너 ID'),
    })).min(1).max(50).describe('추가할 컨트롤 배열 (1~50개)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. 모든 type이 CONTROL_TYPES에 포함되는지 일괄 검증
3. 이름 중복 검사 (컨트롤 간 + 기존 폼 컨트롤과)
4. `withFormUpdate(formId, form => { ... })` 내에서 각 컨트롤을 순차적으로 `addControlToForm` 호출
   - 순차 호출이 중요: 자동 배치 시 이전에 추가된 컨트롤 위치를 반영해야 함
5. 성공 시: `{ addedControls: [{ controlId, name, type, position, size }], count, formVersion }` 반환

### 6.7 list_control_types

```typescript
server.tool(
  'list_control_types',
  '사용 가능한 컨트롤 타입 목록을 카테고리별로 조회합니다. 각 타입의 설명, 기본 크기, 컨테이너 여부를 포함합니다.',
  {},
  handler
);
```

**핸들러 로직**:
1. API 호출 없음 (로컬 CONTROL_DEFAULTS 데이터 사용)
2. 카테고리별로 그룹화하여 반환

**반환값**:
```json
{
  "totalTypes": 44,
  "categories": {
    "기본 컨트롤": [
      { "type": "Button", "description": "클릭 버튼", "defaultSize": { "width": 75, "height": 23 }, "isContainer": false },
      { "type": "Label", "description": "텍스트 레이블", "defaultSize": { "width": 100, "height": 23 }, "isContainer": false },
      ...
    ],
    "컨테이너": [...],
    "데이터": [...],
    "고급": [...],
    "Extra (폼 필수)": [...],
    "Extra (모던 UI)": [...]
  }
}
```

### 6.8 get_control_schema

```typescript
server.tool(
  'get_control_schema',
  '특정 컨트롤 타입의 속성 스키마를 조회합니다. 설정 가능한 속성명, 타입, 기본값, 옵션 등을 확인할 수 있습니다.',
  {
    controlType: z.string().describe('컨트롤 타입 (예: Button, TextBox, DataGridView)'),
  },
  handler
);
```

**핸들러 로직**:
1. `controlType`이 CONTROL_TYPES에 포함되는지 검증
2. `CONTROL_DEFAULTS[controlType]`에서 기본값 가져옴
3. `packages/common`의 이벤트 정보(`COMMON_EVENTS`, `CONTROL_EVENTS`)도 함께 반환

**반환값**:
```json
{
  "type": "Button",
  "description": "클릭 버튼",
  "category": "기본 컨트롤",
  "isContainer": false,
  "defaultSize": { "width": 75, "height": 23 },
  "defaultProperties": { "text": "Button" },
  "availableProperties": {
    "text": { "type": "string", "description": "표시 텍스트" },
    "backColor": { "type": "color", "description": "배경색" },
    "foreColor": { "type": "color", "description": "글자색" },
    "font": { "type": "font", "description": "폰트 설정" },
    "textAlign": { "type": "enum", "options": ["TopLeft", "TopCenter", ...], "description": "텍스트 정렬" },
    "enabled": { "type": "boolean", "default": true, "description": "활성화 여부" },
    "visible": { "type": "boolean", "default": true, "description": "표시 여부" }
  },
  "events": ["Click", "DoubleClick", "MouseEnter", "MouseLeave", ...]
}
```

## 7. 낙관적 잠금 및 자동 재시도

### 7.1 기본 전략

컨트롤 조작 Tool은 `get_form` → `update_form` 사이에 다른 사용자가 폼을 수정하면 409 충돌이 발생할 수 있다.

### 7.2 자동 재시도 적용

MCP-SERVER.md 5.5절의 `withOptimisticRetry` 패턴을 컨트롤 조작에 적용한다. update_form Tool과 달리, 컨트롤 조작 Tool은 **자동 재시도가 안전**하다:

- AI가 명시적으로 전체 controls 배열을 구성하는 것이 아님
- get_form을 다시 하여 최신 상태를 기반으로 조작을 재실행하면 됨

```typescript
async function withOptimisticRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && i < maxRetries) {
        continue; // 최신 폼 다시 조회 후 재시도
      }
      throw err;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}
```

`withFormUpdate`에 재시도 로직을 내장:

```typescript
async function withFormUpdate<T>(
  formId: string,
  fn: (form: FormData) => T,
  maxRetries = 2
): Promise<{ result: T; formVersion: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
    const form = res.data;
    const result = fn(form);
    try {
      const updated = await apiClient.put<MutateFormResponse>(
        `/api/forms/${formId}`,
        { version: form.version, controls: form.controls, eventHandlers: form.eventHandlers, dataBindings: form.dataBindings }
      );
      return { result, formVersion: updated.data.version };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        continue; // 재시도
      }
      throw err;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}
```

## 8. 에러 처리

### 8.1 입력값 검증 에러

| 상황 | 에러 메시지 |
|------|------------|
| formId가 유효하지 않은 ObjectId | `유효하지 않은 formId: '{formId}'` |
| type이 CONTROL_TYPES에 없음 | `유효하지 않은 컨트롤 타입: '{type}'. list_control_types로 사용 가능한 타입을 확인하세요.` |
| 이름 중복 | `컨트롤 이름 '{name}'이 이미 존재합니다.` |
| parentId에 해당하는 컨트롤 없음 | `부모 컨트롤 '{parentId}'을 찾을 수 없습니다.` |
| parentId의 컨트롤이 컨테이너가 아님 | `'{parentType}'은 컨테이너 타입이 아닙니다. Panel, GroupBox, TabControl, SplitContainer, Card, Collapse만 가능합니다.` |
| controlId에 해당하는 컨트롤 없음 | `컨트롤 '{controlId}'을 찾을 수 없습니다.` |
| update_control에 수정 사항 없음 | `수정할 내용을 지정하세요: properties, position, size 중 하나 이상 필요합니다.` |
| batch에 빈 배열 | Zod `.min(1)` 검증으로 자동 처리 |
| batch에 50개 초과 | Zod `.max(50)` 검증으로 자동 처리 |

### 8.2 API 에러

| HTTP 상태 | 처리 |
|-----------|------|
| 404 | `toolError('폼을 찾을 수 없습니다: {formId}')` |
| 409 | 자동 재시도 (최대 2회) → 실패 시 `toolError('버전 충돌: ...')` |
| 기타 | `toolError('API 오류 [{status}]: {message}')` |

## 9. 타입 정의

### 9.1 API 응답 타입 (기존 forms.ts에서 가져옴)

```typescript
// forms.ts에서 이미 정의된 타입 재사용
interface GetFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
    properties: Record<string, unknown>;
    controls: ControlDefinition[];
    eventHandlers: EventHandlerDefinition[];
    dataBindings: DataBindingDefinition[];
    projectId: string;
  };
}

interface MutateFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
    controls: ControlDefinition[];
    [key: string]: unknown;
  };
}
```

### 9.2 헬퍼 함수 내부 타입

```typescript
// FormData — withFormUpdate에서 사용하는 폼 데이터 구조
interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
  properties: Record<string, unknown>;
}
```

## 10. registerControlTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES } from '@webform/common';
import type { ControlType, ControlDefinition } from '@webform/common';
import { apiClient, ApiError } from '../utils/apiClient.js';
import { validateObjectId } from '../utils/validators.js';
import { autoPosition, snapToGrid } from '../utils/autoPosition.js';
import { CONTROL_DEFAULTS } from '../utils/controlDefaults.js';

export function registerControlTools(server: McpServer): void {
  // --- 내부 헬퍼 함수 ---
  // withFormUpdate, addControlToForm, updateControlInForm,
  // removeControlFromForm, findControlById, isContainerType, ...

  // --- 8개 Tool 등록 ---

  // 1. add_control
  server.tool('add_control', ...);

  // 2. update_control
  server.tool('update_control', ...);

  // 3. remove_control
  server.tool('remove_control', ...);

  // 4. move_control
  server.tool('move_control', ...);

  // 5. resize_control
  server.tool('resize_control', ...);

  // 6. batch_add_controls
  server.tool('batch_add_controls', ...);

  // 7. list_control_types
  server.tool('list_control_types', ...);

  // 8. get_control_schema
  server.tool('get_control_schema', ...);
}
```

## 11. server.ts 수정

```typescript
import { registerControlTools } from './tools/controls.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 컨트롤 조작 Tools
  registerControlTools(server);

  // Phase 2 (이벤트 — 별도 태스크)
  // registerEventTools(server);
}
```

## 12. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 | 설명 |
|------|------|------|------|
| 1 | `packages/mcp/src/utils/controlDefaults.ts` | **신규** | 44개 타입의 기본 크기/속성/설명/카테고리 |
| 2 | `packages/mcp/src/utils/autoPosition.ts` | **신규** | 자동 배치 알고리즘 (겹침 방지, 그리드 스냅) |
| 3 | `packages/mcp/src/utils/index.ts` | **수정** | 새 유틸 export 추가 |
| 4 | `packages/mcp/src/tools/controls.ts` | **신규** | 8개 Tool + 헬퍼 함수 |
| 5 | `packages/mcp/src/tools/index.ts` | **수정** | registerControlTools export 추가 |
| 6 | `packages/mcp/src/server.ts` | **수정** | registerControlTools 호출 활성화 |

## 13. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 8개 Tool이 MCP 서버에 등록됨
- [ ] add_control: 타입 검증, 기본값 적용, 자동 배치, parentId 지원
- [ ] update_control: 속성 병합, 위치/크기 변경
- [ ] remove_control: 컨트롤 삭제 + 관련 이벤트/바인딩 정리
- [ ] move_control: 그리드 스냅 적용
- [ ] resize_control: 크기 변경
- [ ] batch_add_controls: 1~50개 일괄 추가, 순차 자동 배치
- [ ] list_control_types: 44개 타입 카테고리별 반환
- [ ] get_control_schema: 타입별 속성/이벤트 정보 반환
- [ ] 낙관적 잠금 409 자동 재시도 (최대 2회)
- [ ] 잘못된 formId/type/controlId 시 적절한 에러 메시지
- [ ] 이름 중복 검사
- [ ] CONTROL_TYPES 44개 누락 없이 CONTROL_DEFAULTS에 포함

## 14. 참고: children 구조와 flattenControls/nestControls

`packages/common/src/utils/controlUtils.ts`에 `flattenControls()`와 `nestControls()` 유틸이 있다.

- `flattenControls`: 중첩 children → 평면 배열 (로드 시, `_parentId` 추가)
- `nestControls`: 평면 배열 → 중첩 children (저장 시, `_parentId` 제거)

**서버 API가 어떤 형식으로 반환하는지 확인 필요**:
- API가 중첩 형식(children)으로 반환하면: 그대로 조작 가능
- API가 평면 형식으로 반환하면: `nestControls()`로 변환 후 저장 필요

> 구현 시 서버 API 응답 형식을 테스트하여 확인한다. 대부분의 경우 서버는 중첩 형식으로 저장/반환하므로, 컨트롤 조작 헬퍼에서 직접 children을 다룬다.
