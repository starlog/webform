# @webform/common 공통 타입 패키지 구현 계획

## 1. 개요

`@webform/common` 패키지는 WebForm 프로젝트의 모든 패키지(designer, runtime, server)가 공유하는 타입 정의와 유틸리티를 제공한다. PRD.md 섹션 3.3(폼 정의 스키마), 4.1.2(도구상자 컨트롤 25종), 4.2.2(UIPatch 프로토콜)을 기반으로 설계한다.

## 2. 파일 구조

```
packages/common/src/
├── types/
│   ├── form.ts          # FormDefinition, ControlDefinition, ControlType 등
│   ├── events.ts        # EventHandlerDefinition, FormContext, EventArgs
│   ├── datasource.ts    # DataSourceDefinition, DataBindingDefinition
│   └── protocol.ts      # UIPatch, WebSocket 메시지 타입
├── utils/
│   ├── validation.ts    # validateFormDefinition, sanitizeQueryInput
│   └── serialization.ts # serialize/deserialize FormDefinition
├── __tests__/
│   ├── index.test.ts    # (기존) VERSION 확인
│   ├── validation.test.ts
│   ├── serialization.test.ts
│   └── events.test.ts
└── index.ts             # 모든 타입/유틸 re-export
```

## 3. 타입 상세 설계

### 3.1 `types/form.ts` — 폼 정의 핵심 타입

#### FontDefinition

```typescript
interface FontDefinition {
  family: string;       // e.g., "Segoe UI", "맑은 고딕"
  size: number;         // pt 단위
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}
```

#### FormProperties

PRD 3.3에서 정의된 폼 속성을 그대로 반영한다.

```typescript
interface FormProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;                                      // CSS 색상값
  font: FontDefinition;
  startPosition: 'CenterScreen' | 'Manual' | 'CenterParent';
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
}
```

#### ControlType (25종 유니언)

PRD 4.1.2의 Phase 1~3 전체 컨트롤을 유니언 타입으로 정의한다.

```typescript
type ControlType =
  // Phase 1 - 기본 컨트롤 (11종)
  | 'Button'
  | 'Label'
  | 'TextBox'
  | 'CheckBox'
  | 'RadioButton'
  | 'ComboBox'
  | 'ListBox'
  | 'NumericUpDown'
  | 'DateTimePicker'
  | 'ProgressBar'
  | 'PictureBox'
  // Phase 1 - 컨테이너 (4종)
  | 'Panel'
  | 'GroupBox'
  | 'TabControl'
  | 'SplitContainer'
  // Phase 2 - 데이터 컨트롤 (5종)
  | 'DataGridView'
  | 'BindingNavigator'
  | 'Chart'
  | 'TreeView'
  | 'ListView'
  // Phase 3 - 고급 컨트롤 (5종)
  | 'MenuStrip'
  | 'ToolStrip'
  | 'StatusStrip'
  | 'RichTextBox'
  | 'WebBrowser';
```

**설계 근거**: 각 Phase별로 주석을 달아 어떤 컨트롤이 어떤 단계에 해당하는지 코드에서 바로 확인할 수 있게 한다.

#### CONTROL_TYPES 상수 배열

타입과 별개로 런타임에서 순회 가능하도록 `as const` 배열도 함께 제공한다.

```typescript
const CONTROL_TYPES = [
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl', 'SplitContainer',
  'DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView',
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
] as const;
```

#### AnchorStyle, DockStyle

PRD 4.1.3의 Anchor & Dock 레이아웃 시스템을 반영한다.

```typescript
// Anchor: 여러 방향 조합 가능 (비트 플래그 패턴 대신 객체 사용)
interface AnchorStyle {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

// Dock: 한 방향만 선택
type DockStyle = 'None' | 'Top' | 'Bottom' | 'Left' | 'Right' | 'Fill';
```

**설계 근거**: WinForm의 `AnchorStyles`는 비트 플래그(enum)지만, TypeScript에서는 `{ top, bottom, left, right }` 객체가 더 직관적이고 JSON 직렬화에 유리하다.

#### ControlDefinition

PRD 3.3 그대로 구현하되, `properties`는 `Record<string, unknown>`으로 타입 안전성을 높인다.

```typescript
interface ControlDefinition {
  id: string;                              // UUID
  type: ControlType;
  name: string;                            // e.g., "btnSubmit", "txtName"
  properties: Record<string, unknown>;     // 컨트롤별 속성 (text, items 등)
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: ControlDefinition[];          // 컨테이너 컨트롤 전용
  anchor: AnchorStyle;
  dock: DockStyle;
  tabIndex: number;
  visible: boolean;
  enabled: boolean;
}
```

**`properties: Record<string, unknown>` 선택 근거**:
- PRD에서 `Record<string, any>`로 명시했으나, `unknown`이 더 타입 안전하다.
- 각 ControlType별 상세 프로퍼티 타입은 designer/runtime에서 개별 정의한다 (이 패키지에서는 범용 타입만 제공).

#### FormDefinition

PRD 3.3 그대로 구현한다.

```typescript
interface FormDefinition {
  id: string;
  name: string;
  version: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
}
```

---

### 3.2 `types/events.ts` — 이벤트 시스템

#### EventHandlerDefinition

PRD 3.3의 이벤트 핸들러 정의를 그대로 반영한다.

```typescript
interface EventHandlerDefinition {
  controlId: string;
  eventName: string;                       // e.g., "onClick", "onTextChanged"
  handlerType: 'server' | 'client';
  handlerCode: string;                     // TypeScript/JavaScript 코드
}
```

#### EventArgs

서버 이벤트 핸들러에 전달되는 이벤트 인자.

```typescript
interface EventArgs {
  type: string;                            // 이벤트 타입명
  timestamp: number;                       // 이벤트 발생 시각 (ms)
  [key: string]: unknown;                  // 추가 데이터 (마우스 좌표, 키 코드 등)
}
```

#### COMMON_EVENTS / CONTROL_EVENTS

PRD 4.1.5에 정의된 이벤트 목록을 상수로 제공한다.

```typescript
const COMMON_EVENTS = [
  'Click', 'DoubleClick',
  'MouseEnter', 'MouseLeave', 'MouseDown', 'MouseUp', 'MouseMove',
  'KeyDown', 'KeyUp', 'KeyPress',
  'Enter', 'Leave',
  'Validating', 'Validated',
  'VisibleChanged', 'EnabledChanged',
] as const;

const CONTROL_EVENTS: Record<string, readonly string[]> = {
  TextBox: ['TextChanged', 'KeyPress'],
  ComboBox: ['SelectedIndexChanged', 'DropDown', 'DropDownClosed'],
  CheckBox: ['CheckedChanged'],
  RadioButton: ['CheckedChanged'],
  DataGridView: ['CellClick', 'CellValueChanged', 'RowEnter', 'SelectionChanged'],
  NumericUpDown: ['ValueChanged'],
  DateTimePicker: ['ValueChanged'],
  ListBox: ['SelectedIndexChanged'],
  TabControl: ['SelectedIndexChanged'],
  TreeView: ['AfterSelect', 'AfterExpand', 'AfterCollapse'],
  ListView: ['SelectedIndexChanged', 'ItemActivate'],
};

// 폼 레벨 이벤트 (Form 자체에 바인딩)
const FORM_EVENTS = [
  'Load', 'Shown', 'FormClosing', 'FormClosed', 'Resize',
] as const;
```

#### FormContext (서버 이벤트 핸들러용)

PRD 4.1.5의 `ctx` 객체 인터페이스. 서버 이벤트 엔진이 핸들러에 주입하는 컨텍스트.

```typescript
interface ControlProxy {
  [property: string]: unknown;             // 컨트롤 속성 접근 (text, foreColor 등)
}

interface DataSourceProxy {
  collection(name: string): CollectionProxy;
}

interface CollectionProxy {
  find(filter?: Record<string, unknown>): Promise<unknown[]>;
  findOne(filter?: Record<string, unknown>): Promise<unknown | null>;
  insertOne(doc: Record<string, unknown>): Promise<{ insertedId: string }>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

interface FormContext {
  formId: string;
  controls: Record<string, ControlProxy>;      // controlName → proxy
  dataSources: Record<string, DataSourceProxy>; // dataSourceName → proxy
  showDialog(formName: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formName: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
}

interface DialogResult {
  dialogResult: 'OK' | 'Cancel';
  data: Record<string, unknown>;
}
```

**설계 근거**:
- `ControlProxy`와 `DataSourceProxy`는 실제 구현은 서버 패키지에서 하고, 타입 정의만 여기서 제공한다.
- `CollectionProxy`는 PRD 4.1.5 예시코드의 `ctx.dataSources.userDB.collection('users').insertOne(...)` 패턴을 반영한다.

---

### 3.3 `types/datasource.ts` — 데이터소스 및 바인딩

PRD 4.1.6의 데이터소스 정의를 그대로 구현한다.

#### DataSourceDefinition

```typescript
interface DataSourceDefinition {
  id: string;
  name: string;                            // e.g., "userDB"
  type: 'database' | 'restApi' | 'static';
  config: DatabaseConfig | RestApiConfig | StaticConfig;
}
```

#### DatabaseConfig

```typescript
interface DatabaseConfig {
  dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite';
  connectionString: string;                // 암호화 저장
  database: string;
}
```

#### RestApiConfig / AuthConfig

```typescript
interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'apiKey';
  credentials?: Record<string, string>;    // username/password, token, apiKey 등
}

interface RestApiConfig {
  baseUrl: string;
  headers: Record<string, string>;
  auth: AuthConfig;
}
```

#### StaticConfig

```typescript
interface StaticConfig {
  data: unknown[];
}
```

#### DataBindingDefinition

```typescript
interface DataBindingDefinition {
  controlId: string;
  controlProperty: string;                 // e.g., "text", "items", "dataSource"
  dataSourceId: string;
  dataField: string;                       // 필드명 또는 복합 경로
  bindingMode: 'oneWay' | 'twoWay' | 'oneTime';
}
```

---

### 3.4 `types/protocol.ts` — SDUI 프로토콜

#### UIPatch

PRD 4.2.2의 UI 패치 프로토콜을 그대로 반영한다.

```typescript
interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate';
  target: string;                          // controlId 또는 formId
  payload: Record<string, unknown>;
}
```

#### 이벤트 요청/응답 (서버 이벤트 실행 프로토콜)

```typescript
// 클라이언트 → 서버: 이벤트 발생 전달
interface EventRequest {
  formId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  formState: Record<string, Record<string, unknown>>;  // controlId → properties 스냅샷
}

// 서버 → 클라이언트: 이벤트 처리 결과
interface EventResponse {
  success: boolean;
  patches: UIPatch[];
  error?: string;
}
```

#### WebSocket 메시지 타입

디자이너 실시간 동기화와 런타임 이벤트 통신에 사용되는 WebSocket 메시지를 유니언으로 정의한다.

```typescript
// 디자이너 WebSocket 메시지
type DesignerWsMessage =
  | { type: 'controlAdded'; payload: ControlDefinition }
  | { type: 'controlUpdated'; payload: { controlId: string; changes: Record<string, unknown> } }
  | { type: 'controlRemoved'; payload: { controlId: string } }
  | { type: 'formPropertiesUpdated'; payload: Partial<FormProperties> }
  | { type: 'syncRequest'; payload: { formId: string } }
  | { type: 'syncResponse'; payload: FormDefinition };

// 런타임 WebSocket 메시지
type RuntimeWsMessage =
  | { type: 'event'; payload: EventRequest }
  | { type: 'eventResult'; payload: EventResponse }
  | { type: 'uiPatch'; payload: UIPatch[] }
  | { type: 'dataRefresh'; payload: { controlId: string; data: unknown[] } }
  | { type: 'error'; payload: { code: string; message: string } };

// 통합 WebSocket 메시지 타입
type WsMessage = DesignerWsMessage | RuntimeWsMessage;
```

**설계 근거**:
- 태그드 유니언(`type` 필드)을 사용하여 TypeScript의 narrowing 기능을 활용한다.
- 디자이너와 런타임 메시지를 분리하되, 통합 타입도 제공한다.

---

## 4. 유틸리티 상세 설계

### 4.1 `utils/validation.ts`

#### validateFormDefinition

`FormDefinition` 객체의 구조적 유효성을 검증한다.

```typescript
function validateFormDefinition(form: unknown): { valid: boolean; errors: string[] }
```

**검증 항목**:
1. `id`: 비어있지 않은 string
2. `name`: 비어있지 않은 string
3. `version`: 양의 정수
4. `properties`: FormProperties 필수 필드 존재 (title, width, height)
5. `controls`: 배열, 각 항목이 유효한 ControlDefinition
6. `eventHandlers`: 배열, 각 항목이 유효한 EventHandlerDefinition
7. `dataBindings`: 배열, 각 항목이 유효한 DataBindingDefinition

#### validateControlDefinition

```typescript
function validateControlDefinition(control: unknown): { valid: boolean; errors: string[] }
```

**검증 항목**:
1. `id`: 비어있지 않은 string
2. `type`: CONTROL_TYPES 배열에 포함
3. `name`: 비어있지 않은 string
4. `position`: `{ x: number, y: number }` (음수 허용 — 캔버스 밖 배치 가능)
5. `size`: `{ width: number > 0, height: number > 0 }`
6. `children`: 존재 시 배열, 각 항목 재귀 검증
7. `anchor`: `{ top, bottom, left, right }` 모두 boolean
8. `dock`: DockStyle 값 중 하나
9. `tabIndex`: 0 이상 정수
10. `visible`, `enabled`: boolean

#### sanitizeQueryInput (NoSQL 인젝션 방지)

PRD 5.2의 보안 요구사항에 따라, 사용자 입력에서 위험한 MongoDB 연산자를 제거한다.

```typescript
function sanitizeQueryInput(input: Record<string, unknown>): Record<string, unknown>
```

**차단 대상 연산자** (키 이름이 `$`로 시작):
- `$where` — 임의 JavaScript 실행 가능
- `$function` — 서버 사이드 JavaScript
- `$accumulator` — 서버 사이드 JavaScript
- `$expr` — 집계 표현식 (잠재적 위험)

**처리 방식**:
1. 입력 객체의 모든 키를 재귀적으로 순회
2. 위험한 `$` 연산자 키를 발견하면 해당 키-값 쌍을 제거
3. 중첩 객체/배열 내부도 재귀적으로 처리
4. 안전한 `$` 연산자는 허용 (e.g., `$regex`, `$gt`, `$lt`, `$in`, `$and`, `$or`)
5. 원본 객체를 변경하지 않고 새 객체를 반환 (불변성)

**차단 리스트 접근 방식 선택 근거**:
- 허용 리스트 방식은 정상적인 쿼리까지 차단할 위험이 있다.
- 위험한 연산자만 차단하는 것이 유연하면서도 안전하다.

---

### 4.2 `utils/serialization.ts`

#### serializeFormDefinition

```typescript
function serializeFormDefinition(form: FormDefinition): string
```

- `JSON.stringify`로 직렬화
- 순환 참조 검사 없음 (FormDefinition은 트리 구조이므로 순환 없음)

#### deserializeFormDefinition

```typescript
function deserializeFormDefinition(json: string): FormDefinition
```

- `JSON.parse` 후 `validateFormDefinition` 호출
- 유효하지 않으면 상세 에러 메시지와 함께 Error throw
- 유효하면 FormDefinition 타입으로 반환

---

## 5. `index.ts` Re-export 구조

```typescript
// types
export type {
  FontDefinition,
  FormProperties,
  ControlDefinition,
  FormDefinition,
  AnchorStyle,
  EventHandlerDefinition,
  EventArgs,
  ControlProxy,
  DataSourceProxy,
  CollectionProxy,
  FormContext,
  DialogResult,
  DataSourceDefinition,
  DatabaseConfig,
  RestApiConfig,
  AuthConfig,
  StaticConfig,
  DataBindingDefinition,
  UIPatch,
  EventRequest,
  EventResponse,
  DesignerWsMessage,
  RuntimeWsMessage,
  WsMessage,
} from './types/...';

// type unions & constants
export {
  type ControlType,
  type DockStyle,
  CONTROL_TYPES,
  COMMON_EVENTS,
  CONTROL_EVENTS,
  FORM_EVENTS,
} from './types/...';

// utils
export {
  validateFormDefinition,
  validateControlDefinition,
  sanitizeQueryInput,
  serializeFormDefinition,
  deserializeFormDefinition,
} from './utils/...';

// version
export { VERSION } from '...';
```

---

## 6. 구현 순서

1. **`types/form.ts`** — 가장 기본이 되는 타입. 다른 모든 파일이 여기에 의존.
2. **`types/events.ts`** — FormContext, EventArgs 등. form.ts에 의존.
3. **`types/datasource.ts`** — DataSourceDefinition, DataBindingDefinition. 독립적.
4. **`types/protocol.ts`** — UIPatch, WsMessage. form.ts, events.ts에 의존.
5. **`utils/validation.ts`** — form.ts의 타입을 검증. form.ts에 의존.
6. **`utils/serialization.ts`** — validation.ts에 의존.
7. **`index.ts`** — 모든 모듈 re-export.

---

## 7. 의존성

이 패키지는 **외부 런타임 의존성이 없다** (zero dependencies). 순수 TypeScript 타입과 유틸리티만 포함한다.

개발 의존성:
- `vitest` (이미 루트에 설치됨)
- `typescript` (이미 루트에 설치됨)

---

## 8. 후속 패키지와의 연동

| 사용처 | 사용하는 타입 |
|--------|-------------|
| `@webform/server` - FormService | `FormDefinition`, `validateFormDefinition` |
| `@webform/server` - EventEngine | `FormContext`, `EventArgs`, `EventHandlerDefinition` |
| `@webform/server` - DataSourceService | `DataSourceDefinition`, `sanitizeQueryInput` |
| `@webform/server` - WebSocket | `WsMessage`, `EventRequest`, `EventResponse` |
| `@webform/designer` - Canvas/Store | `ControlDefinition`, `ControlType`, `FormProperties` |
| `@webform/designer` - PropertyPanel | `AnchorStyle`, `DockStyle`, `COMMON_EVENTS` |
| `@webform/runtime` - SDUIRenderer | `FormDefinition`, `ControlDefinition`, `UIPatch` |
| `@webform/runtime` - DataBinder | `DataBindingDefinition` |
