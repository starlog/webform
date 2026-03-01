# 이벤트 핸들러 Tools 구현 계획

## 개요

`packages/mcp/src/tools/events.ts` — MCP-SERVER.md 섹션 2.4에 정의된 6개 이벤트 핸들러 Tools를 구현한다.

이벤트 핸들러는 폼의 `eventHandlers` 배열에 저장되며, `get_form` → 조작 → `update_form` 패턴으로 CRUD를 수행한다.
`test_event_handler`는 런타임 API(`POST /api/runtime/forms/:id/events`)를 호출하여 핸들러 코드를 실제 실행한다.

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts        (수정 — registerEventTools export 추가)
└── events.ts       (신규 — 6개 Tool 정의)
```

## 2. Tool-API 엔드포인트 매핑

| # | Tool 이름 | 내부 동작 | 서버 엔드포인트 | 비고 |
|---|-----------|-----------|----------------|------|
| 1 | `add_event_handler` | get_form → push → update_form | `GET /api/forms/:id` + `PUT /api/forms/:id` | eventHandlers 배열에 추가 |
| 2 | `update_event_handler` | get_form → find & replace → update_form | `GET /api/forms/:id` + `PUT /api/forms/:id` | controlId+eventName으로 매칭 |
| 3 | `remove_event_handler` | get_form → filter → update_form | `GET /api/forms/:id` + `PUT /api/forms/:id` | controlId+eventName으로 삭제 |
| 4 | `list_event_handlers` | get_form → extract | `GET /api/forms/:id` | eventHandlers 배열 반환 |
| 5 | `list_available_events` | 정적 데이터 참조 | — (서버 호출 불필요) | COMMON_EVENTS + CONTROL_EVENTS |
| 6 | `test_event_handler` | 런타임 이벤트 실행 | `POST /api/runtime/forms/:id/events` | SandboxRunner 격리 실행 |

## 3. EventHandlerDefinition 타입 참조

`packages/common/src/types/events.ts`에 정의된 타입:

```typescript
interface EventHandlerDefinition {
  controlId: string;                    // 핸들러가 바인딩된 컨트롤 ID
  eventName: string;                    // 이벤트명 (예: 'Click', 'TextChanged')
  handlerType: 'server' | 'client';    // 실행 위치
  handlerCode: string;                  // 사용자 작성 코드 (TypeScript/JavaScript)
}
```

## 4. 이벤트 목록 상수 참조

`packages/common/src/types/events.ts`에 정의된 상수:

### 4.1 COMMON_EVENTS (모든 컨트롤 공통)

```typescript
const COMMON_EVENTS = [
  'Click', 'DoubleClick',
  'MouseEnter', 'MouseLeave', 'MouseDown', 'MouseUp', 'MouseMove',
  'KeyDown', 'KeyUp', 'KeyPress',
  'Enter', 'Leave',
  'Validating', 'Validated',
  'VisibleChanged', 'EnabledChanged',
];
```

### 4.2 CONTROL_EVENTS (컨트롤 타입별 특화)

```typescript
const CONTROL_EVENTS: Record<string, string[]> = {
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
  SpreadsheetView: ['CellChanged', 'RowAdded', 'RowDeleted', 'SelectionChanged', 'DataLoaded'],
  JsonEditor: ['ValueChanged'],
  MongoDBView: ['DataLoaded', 'SelectionChanged', 'CellValueChanged', 'DocumentInserted', 'DocumentUpdated', 'DocumentDeleted', 'Error'],
  GraphView: ['DataLoaded'],
  MenuStrip: ['ItemClicked'],
  ToolStrip: ['ItemClicked'],
  StatusStrip: ['ItemClicked'],
  RichTextBox: ['TextChanged', 'SelectionChanged'],
  WebBrowser: ['Navigated', 'DocumentCompleted'],
  Chart: ['SeriesClicked', 'DataLoaded'],
  SplitContainer: ['SplitterMoved'],
  BindingNavigator: ['PositionChanged', 'ItemClicked'],
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  Slider: ['ValueChanged'],
  Switch: ['CheckedChanged'],
  Upload: ['FileSelected', 'UploadCompleted', 'UploadFailed'],
  Alert: ['Closed'],
  Tag: ['TagAdded', 'TagRemoved', 'TagClicked'],
  Tooltip: ['VisibleChanged'],
  Collapse: ['ActiveKeyChanged'],
};
```

### 4.3 FORM_EVENTS (폼 레벨)

```typescript
const FORM_EVENTS = [
  'Load', 'Shown', 'FormClosing', 'FormClosed', 'Resize',
  'OnLoading', 'BeforeLeaving',
];
```

## 5. 각 Tool 상세 설계

### 5.1 add_event_handler

```typescript
server.tool(
  'add_event_handler',
  `폼의 컨트롤에 이벤트 핸들러를 등록합니다. 내부적으로 get_form → eventHandlers 배열 추가 → update_form 패턴으로 동작합니다.

핸들러 코드는 TypeScript로 작성하며, ctx 객체를 통해 컨트롤 조작/메시지 표시/HTTP 요청 등을 수행합니다:
- ctx.controls['컨트롤이름'].text/checked/value/... (읽기/쓰기)
- ctx.sender: 이벤트 발생 컨트롤의 현재 상태
- ctx.eventArgs: 이벤트 인자 ({type, timestamp, ...})
- ctx.showMessage(text, title?, type?): 메시지 대화상자 ('info'|'warning'|'error')
- ctx.navigate(formId, params?): 다른 폼으로 이동
- ctx.http.get/post/put/patch/delete(url, body?): HTTP 요청 → {status, ok, data}
- ctx.getRadioGroupValue(groupName): 라디오 그룹 선택값

예시: ctx.controls.txtName.text = ''; ctx.showMessage('저장 완료', '알림', 'info');`,
  {
    formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
    controlId: z.string().describe('이벤트를 바인딩할 컨트롤 ID (폼 레벨 이벤트는 "_form")'),
    eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged, Load)'),
    handlerCode: z.string().describe('핸들러 코드 (TypeScript). ctx 객체를 사용하여 컨트롤 조작'),
    handlerType: z.enum(['server', 'client']).optional().default('server')
      .describe('핸들러 실행 위치 (기본: server)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)` — 현재 폼 조회
3. 중복 검사: 동일 `(controlId, eventName)` 핸들러가 이미 존재하면 에러 반환
4. `controlId`가 `_form`이 아닌 경우, 해당 컨트롤이 폼에 존재하는지 검증
5. `eventHandlers` 배열에 새 핸들러 추가:
   ```typescript
   form.eventHandlers.push({
     controlId,
     eventName,
     handlerType: handlerType ?? 'server',
     handlerCode,
   });
   ```
6. `apiClient.put('/api/forms/' + formId, { version: form.version, eventHandlers: form.eventHandlers })`
7. 409 충돌 시 에러 메시지 반환
8. 성공 시 반환:

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"controlId\": \"btnSave\", \"eventName\": \"Click\", \"handlerType\": \"server\", \"totalHandlers\": 5, \"version\": 4 }"
  }]
}
```

### 5.2 update_event_handler

```typescript
server.tool(
  'update_event_handler',
  `기존 이벤트 핸들러의 코드를 수정합니다. controlId + eventName으로 대상 핸들러를 식별합니다.

ctx 객체 사용법은 add_event_handler 설명을 참고하세요.`,
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('컨트롤 ID'),
    eventName: z.string().describe('이벤트 이름'),
    handlerCode: z.string().describe('새 핸들러 코드'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)` — 현재 폼 조회
3. `eventHandlers` 배열에서 `(controlId, eventName)` 매칭 핸들러 검색
4. 없으면 에러: `"핸들러를 찾을 수 없습니다: controlId={controlId}, eventName={eventName}"`
5. 매칭된 핸들러의 `handlerCode` 업데이트
6. `apiClient.put('/api/forms/' + formId, { version: form.version, eventHandlers: form.eventHandlers })`
7. 409 충돌 시 에러 메시지 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"controlId\": \"btnSave\", \"eventName\": \"Click\", \"updated\": true, \"version\": 5 }"
  }]
}
```

### 5.3 remove_event_handler

```typescript
server.tool(
  'remove_event_handler',
  '이벤트 핸들러를 삭제합니다. controlId + eventName으로 대상을 식별합니다.',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('컨트롤 ID'),
    eventName: z.string().describe('이벤트 이름'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)` — 현재 폼 조회
3. `eventHandlers` 배열에서 `(controlId, eventName)` 매칭 핸들러 검색
4. 없으면 에러: `"핸들러를 찾을 수 없습니다: controlId={controlId}, eventName={eventName}"`
5. `filter()`로 해당 핸들러 제거
6. `apiClient.put('/api/forms/' + formId, { version: form.version, eventHandlers: filteredHandlers })`
7. 409 충돌 시 에러 메시지 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"controlId\": \"btnSave\", \"eventName\": \"Click\", \"removed\": true, \"remainingHandlers\": 3, \"version\": 5 }"
  }]
}
```

### 5.4 list_event_handlers

```typescript
server.tool(
  'list_event_handlers',
  '폼에 등록된 모든 이벤트 핸들러를 조회합니다. 각 핸들러의 controlId, eventName, handlerType, handlerCode를 포함합니다.',
  {
    formId: z.string().describe('폼 ID'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)` — 폼 조회
3. `eventHandlers` 배열을 추출하여 반환
4. 각 핸들러에 컨트롤 이름 정보 추가 (controls 배열에서 controlId → name 매핑)

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"handlers\": [{ \"controlId\": \"ctrl-001\", \"controlName\": \"btnSave\", \"eventName\": \"Click\", \"handlerType\": \"server\", \"handlerCode\": \"ctx.showMessage(...)\" }, ...], \"totalCount\": 3 }"
  }]
}
```

### 5.5 list_available_events

```typescript
server.tool(
  'list_available_events',
  '특정 컨트롤 타입에서 사용 가능한 이벤트 목록을 반환합니다. COMMON_EVENTS(모든 컨트롤 공통) + CONTROL_EVENTS(타입별 특화)를 합산합니다. controlType을 "Form"으로 지정하면 폼 레벨 이벤트(Load, Shown 등)를 반환합니다.',
  {
    controlType: z.string().describe('컨트롤 타입 (예: Button, TextBox, DataGridView, Form)'),
  },
  handler
);
```

**핸들러 로직**:
1. `controlType === 'Form'`인 경우: FORM_EVENTS 반환
2. 그 외: COMMON_EVENTS + CONTROL_EVENTS[controlType] (있는 경우) 합산 반환
3. 서버 API 호출 불필요 — `@webform/common`에서 상수를 import하여 사용

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"controlType\": \"TextBox\", \"commonEvents\": [\"Click\", \"DoubleClick\", ...], \"specificEvents\": [\"TextChanged\", \"KeyPress\"], \"allEvents\": [\"Click\", \"DoubleClick\", ..., \"TextChanged\", \"KeyPress\"] }"
  }]
}
```

### 5.6 test_event_handler

```typescript
server.tool(
  'test_event_handler',
  `이벤트 핸들러 코드를 실제 런타임 환경에서 테스트 실행합니다. isolated-vm 샌드박스에서 격리 실행되며, 실행 결과로 UI 패치(UIPatch) 배열과 콘솔 로그를 반환합니다.

폼이 반드시 published 상태여야 합니다 (publish_form 먼저 호출). mockFormState를 제공하면 해당 상태로 시작하고, 미지정 시 빈 상태로 실행합니다.`,
  {
    formId: z.string().describe('폼 ID (published 상태여야 함)'),
    controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
    eventName: z.string().describe('발생시킬 이벤트 이름 (예: Click)'),
    mockFormState: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
      .describe('테스트용 폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
  },
  handler
);
```

**API 호출**: `POST /api/runtime/forms/:id/events`

**요청 본문**:
```json
{
  "controlId": "ctrl-001",
  "eventName": "Click",
  "eventArgs": { "type": "Click", "timestamp": 1234567890 },
  "formState": {
    "ctrl-001": { "text": "저장", "enabled": true },
    "ctrl-002": { "text": "", "visible": true }
  }
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `mockFormState`가 없으면 빈 객체 사용
3. `eventArgs` 자동 생성: `{ type: eventName, timestamp: Date.now() }`
4. `apiClient.post<EventResponse>('/api/runtime/forms/' + formId + '/events', body)`
5. 응답에서 `patches`, `logs`, `error`, `errorLine` 추출

**반환값 (성공)**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"success\": true, \"patches\": [{ \"type\": \"updateProperty\", \"target\": \"ctrl-002\", \"payload\": { \"text\": \"Hello\" } }], \"logs\": [{ \"level\": \"log\", \"message\": \"처리 완료\" }], \"patchCount\": 1 }"
  }]
}
```

**반환값 (실행 에러)**:
```json
{
  "content": [{
    "type": "text",
    "text": "핸들러 실행 오류: ReferenceError: undefinedVar is not defined (line 3)"
  }],
  "isError": true
}
```

## 6. get_form → update_form 패턴 헬퍼

add/update/remove_event_handler에서 공통으로 사용하는 패턴을 헬퍼 함수로 추출:

```typescript
interface FormData {
  _id: string;
  version: number;
  controls: Array<{ id: string; name: string; [key: string]: unknown }>;
  eventHandlers: EventHandlerDefinition[];
}

/**
 * 폼을 조회하여 eventHandlers를 조작한 뒤 업데이트하는 공통 패턴.
 * mutate 함수에서 eventHandlers 배열을 직접 수정한다.
 */
async function withEventHandlerMutation(
  formId: string,
  mutate: (form: FormData) => void,
): Promise<{ form: FormData; updatedVersion: number }> {
  // 1. 폼 조회
  const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
  const form = res.data;

  // 2. mutate 콜백으로 eventHandlers 조작
  mutate(form);

  // 3. update_form (낙관적 잠금)
  const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
    version: form.version,
    eventHandlers: form.eventHandlers,
  });

  return { form, updatedVersion: updated.data.version };
}
```

### 6.1 사용 예시 (add_event_handler)

```typescript
const { form, updatedVersion } = await withEventHandlerMutation(formId, (f) => {
  // 중복 검사
  const exists = f.eventHandlers.some(
    (h) => h.controlId === controlId && h.eventName === eventName,
  );
  if (exists) {
    throw new HandlerExistsError(controlId, eventName);
  }

  // 컨트롤 존재 검증 (폼 레벨이 아닌 경우)
  if (controlId !== '_form') {
    const controlExists = f.controls.some((c) => c.id === controlId);
    if (!controlExists) {
      throw new ControlNotFoundError(controlId);
    }
  }

  // 추가
  f.eventHandlers.push({ controlId, eventName, handlerType, handlerCode });
});
```

## 7. 낙관적 잠금 및 에러 처리

### 7.1 409 버전 충돌

`withEventHandlerMutation` 내부에서 `update_form` 호출 시 409 에러가 발생할 수 있다:

```typescript
try {
  const result = await withEventHandlerMutation(formId, mutate);
  return toolResult({ ... });
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    return toolError(
      '버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. 다시 시도하세요.',
    );
  }
  if (err instanceof HandlerExistsError) {
    return toolError(
      `이미 존재하는 핸들러입니다: controlId=${err.controlId}, eventName=${err.eventName}. update_event_handler를 사용하세요.`,
    );
  }
  if (err instanceof ControlNotFoundError) {
    return toolError(
      `컨트롤을 찾을 수 없습니다: controlId=${err.controlId}`,
    );
  }
  if (err instanceof HandlerNotFoundError) {
    return toolError(
      `핸들러를 찾을 수 없습니다: controlId=${err.controlId}, eventName=${err.eventName}`,
    );
  }
  if (err instanceof ApiError) {
    return toolError(`API 오류 [${err.status}]: ${err.message}`);
  }
  throw err;
}
```

### 7.2 커스텀 에러 클래스

```typescript
class HandlerExistsError extends Error {
  constructor(public controlId: string, public eventName: string) {
    super(`Handler already exists: ${controlId}.${eventName}`);
  }
}

class HandlerNotFoundError extends Error {
  constructor(public controlId: string, public eventName: string) {
    super(`Handler not found: ${controlId}.${eventName}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`Control not found: ${controlId}`);
  }
}
```

## 8. list_available_events 구현 방식

서버 API 호출 없이 `@webform/common`의 상수를 직접 참조:

```typescript
import {
  COMMON_EVENTS,
  CONTROL_EVENTS,
  FORM_EVENTS,
} from '@webform/common';

// list_available_events 핸들러 내부
async ({ controlType }) => {
  if (controlType === 'Form') {
    return toolResult({
      controlType: 'Form',
      events: FORM_EVENTS,
      totalCount: FORM_EVENTS.length,
    });
  }

  const specificEvents = CONTROL_EVENTS[controlType] ?? [];
  const allEvents = [...COMMON_EVENTS, ...specificEvents];

  return toolResult({
    controlType,
    commonEvents: COMMON_EVENTS,
    specificEvents,
    allEvents,
    totalCount: allEvents.length,
  });
}
```

**참고**: `@webform/common`은 이미 `packages/mcp/package.json`의 의존성에 `"@webform/common": "workspace:*"`로 포함되어 있으므로 직접 import 가능.

만약 common에서 상수가 export되지 않는 경우, events.ts 파일 내에 동일한 상수를 정의하여 사용한다.

## 9. test_event_handler 런타임 API 상세

### 9.1 런타임 API 엔드포인트

`POST /api/runtime/forms/:id/events` (packages/server/src/routes/runtime.ts)

### 9.2 요청 형식 (EventRequest)

```typescript
interface EventRequest {
  formId: string;           // URL 경로에서 추출
  controlId: string;        // 이벤트 발생 컨트롤 ID
  eventName: string;        // 이벤트 이름
  eventArgs: EventArgs;     // { type, timestamp, ... }
  formState: Record<string, Record<string, unknown>>;  // 컨트롤 ID → 속성 맵
}
```

### 9.3 응답 형식 (EventResponse)

```typescript
interface EventResponse {
  success: boolean;
  patches: UIPatch[];       // UI 변경 사항
  error?: string;           // 에러 메시지
  logs?: DebugLog[];        // console 출력 기록
  errorLine?: number;       // 에러 발생 줄 번호
  traces?: TraceEntry[];    // 디버그 추적 (debugMode일 때)
}
```

### 9.4 주의사항

- **폼 퍼블리시 필수**: 런타임 API는 published 상태의 폼 정의를 기반으로 동작. 미퍼블리시 폼은 404 에러.
- **formState 필요**: `mockFormState`를 통해 테스트할 컨트롤 상태를 지정해야 의미 있는 테스트 가능.
- **SandboxRunner 격리 실행**: 핸들러 코드는 isolated-vm에서 실행되므로 안전.
- **응답에서 patches 분석**: 핸들러 실행 결과인 `updateProperty`, `showDialog`, `navigate` 등의 UIPatch를 확인하여 정상 동작 여부 판단.

## 10. 타입 정의

```typescript
// 기존 forms.ts에 정의된 타입 재사용
interface GetFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
    properties: Record<string, unknown>;
    controls: Array<{ id: string; name: string; type: string; [key: string]: unknown }>;
    eventHandlers: EventHandlerDefinition[];
    dataBindings: Record<string, unknown>[];
    projectId: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface MutateFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
    controls: Record<string, unknown>[];
    [key: string]: unknown;
  };
}

interface EventHandlerDefinition {
  controlId: string;
  eventName: string;
  handlerType: 'server' | 'client';
  handlerCode: string;
}

// 런타임 이벤트 응답
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
```

## 11. registerEventTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError } from '../utils/apiClient.js';
import { validateObjectId } from '../utils/validators.js';

// @webform/common에서 이벤트 상수 import (가능한 경우)
// import { COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '@webform/common';

export function registerEventTools(server: McpServer): void {
  // 1. add_event_handler
  server.tool('add_event_handler', ...);

  // 2. update_event_handler
  server.tool('update_event_handler', ...);

  // 3. remove_event_handler
  server.tool('remove_event_handler', ...);

  // 4. list_event_handlers
  server.tool('list_event_handlers', ...);

  // 5. list_available_events
  server.tool('list_available_events', ...);

  // 6. test_event_handler
  server.tool('test_event_handler', ...);
}
```

## 12. server.ts 수정

```typescript
import { registerEventTools } from './tools/events.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 이벤트 Tools
  registerEventTools(server);

  // Phase 2 (추가): 컨트롤 Tools
  // registerControlTools(server);
}
```

## 13. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/tools/events.ts` | **신규** — 6개 Tool + 헬퍼 함수 + 타입 정의 |
| 2 | `packages/mcp/src/tools/index.ts` | **수정** — `registerEventTools` export 추가 |
| 3 | `packages/mcp/src/server.ts` | **수정** — `registerEventTools` 호출 활성화 |

## 14. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 6개 Tool이 모두 MCP 서버에 등록됨 (server.tool 호출 6회)
- [ ] add_event_handler: 중복 핸들러 방지, 컨트롤 존재 검증, ctx 사용법 description 포함
- [ ] update_event_handler: controlId+eventName으로 정확한 핸들러 매칭, 미존재 시 에러
- [ ] remove_event_handler: 핸들러 삭제 후 나머지 배열 정상 유지
- [ ] list_event_handlers: 모든 핸들러 + 컨트롤 이름 정보 반환
- [ ] list_available_events: COMMON_EVENTS + CONTROL_EVENTS 합산, Form 타입 시 FORM_EVENTS 반환
- [ ] test_event_handler: 런타임 API 호출, patches/logs/error 정상 반환
- [ ] 409 버전 충돌 시 isError 반환 (add/update/remove)
- [ ] 잘못된 formId(비-ObjectId) 시 검증 에러 반환
- [ ] Tool description에 ctx 객체 사용법 가이드 포함 (add_event_handler)
