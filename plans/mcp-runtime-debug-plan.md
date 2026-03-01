# 런타임/디버그 Tools 구현 계획

## 개요

`packages/mcp/src/tools/runtime.ts` 및 `packages/mcp/src/tools/debug.ts` — MCP-SERVER.md 섹션 2.9에 정의된 4개 런타임/디버그 Tools를 구현한다.

런타임 Tools는 퍼블리시된 폼을 로드하고 이벤트를 실행하는 기능을 제공하며, 디버그 Tool은 코드 실행 시 라인별 트레이스(변수 상태 캡처)를 포함한 결과를 반환한다. 기존 서버의 런타임 API(`/api/runtime/...`)를 래핑하며, 인증이 불필요한 공개 엔드포인트를 사용한다.

### 기존 test_event_handler와의 관계

`events.ts`에 이미 `test_event_handler` Tool이 존재한다. 이 Tool은 디자이너에서 핸들러 코드를 작성한 후 빠르게 테스트하는 용도로, 간단한 `mockFormState`만 받는다. 새로운 런타임 Tools는 다음과 같이 차별화된다:

| 비교 | test_event_handler (기존) | execute_event (신규) | debug_execute (신규) |
|------|--------------------------|---------------------|---------------------|
| 목적 | 핸들러 코드 빠른 테스트 | 런타임 환경 이벤트 실행 | 디버그 추적 포함 실행 |
| eventArgs | 자동 생성 | 사용자 지정 가능 | 자동 생성 |
| formState | mockFormState (선택) | formState (선택) | formState (선택) |
| 트레이스 | 없음 | 없음 | **있음** (라인별 변수 상태) |
| 응답 상세도 | patches + logs | patches + logs | patches + logs + **traces** |

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts        (수정 — registerRuntimeTools, registerDebugTools export 추가)
├── runtime.ts      (신규 — execute_event, get_runtime_form, get_runtime_app)
└── debug.ts        (신규 — debug_execute)

packages/mcp/src/
└── server.ts       (수정 — registerRuntimeTools, registerDebugTools 호출 추가)
```

## 2. 서버 API 엔드포인트 매핑

### 2.1 기존 런타임 엔드포인트 (인증 불필요)

| # | Tool 이름 | HTTP 메서드 | 서버 엔드포인트 | 비고 |
|---|-----------|-------------|----------------|------|
| 1 | `execute_event` | POST | `/api/runtime/forms/:id/events` | published 폼만 |
| 2 | `get_runtime_form` | GET | `/api/runtime/forms/:id` | published 폼만 |
| 3 | `get_runtime_app` | GET | `/api/runtime/app/:projectId` | Shell + 시작 폼 |

### 2.2 서버 수정이 필요한 엔드포인트

| # | Tool 이름 | HTTP 메서드 | 서버 엔드포인트 | 비고 |
|---|-----------|-------------|----------------|------|
| 4 | `debug_execute` | POST | `/api/runtime/forms/:id/events` | **debugMode 옵션 추가 필요** |

현재 `POST /api/runtime/forms/:id/events` 라우트는 `EventEngine.executeEvent()`에 `options` 파라미터를 전달하지 않는다. `debug_execute`가 트레이스를 받으려면 요청 body에 `debugMode` 필드를 추가하고 이를 `EventEngine`에 전달해야 한다.

**서버 수정 사항** (`packages/server/src/routes/runtime.ts`, POST /forms/:id/events):

```typescript
// 기존 (line 139-143)
const result = await eventEngine.executeEvent(req.params.id, payload, formDef);

// 수정
const debugMode = (req.body as { debugMode?: boolean }).debugMode === true;
const result = await eventEngine.executeEvent(req.params.id, payload, formDef, {
  debugMode,
});
```

이 수정은 기존 동작에 영향을 주지 않는다 (`debugMode` 미지정 시 기본값 `false`).

## 3. 서버 API 요청/응답 형식 참조

### 3.1 POST /api/runtime/forms/:id/events

**요청 (EventRequest)**:
```typescript
{
  controlId: string;           // 이벤트 발생 컨트롤 ID (필수)
  eventName: string;           // 이벤트 이름 (필수)
  eventArgs: EventArgs;        // 이벤트 인자 { type, timestamp, ...추가속성 }
  formState: Record<string, Record<string, unknown>>;  // ID 키 컨트롤 상태 (필수)
  appState?: Record<string, unknown>;   // Shell 앱 상태
  scope?: 'shell' | 'form';            // 스코프
  debugMode?: boolean;                  // 디버그 모드 (서버 수정 후)
}
```

**응답 (EventResponse)**:
```typescript
{
  success: boolean;
  patches: UIPatch[];          // UI 업데이트 패치 배열
  error?: string;              // 에러 메시지
  logs?: DebugLog[];           // 콘솔 로그 [{type, args, timestamp}]
  errorLine?: number;          // 에러 발생 줄번호
  traces?: TraceEntry[];       // 디버그 추적 (debugMode=true 시)
}
```

**UIPatch 타입**:
```typescript
{
  type: 'updateProperty' | 'addControl' | 'removeControl' |
        'showDialog' | 'navigate' | 'updateShell' | 'updateAppState' | 'closeApp';
  target: string;
  payload: Record<string, unknown>;
}
```

**TraceEntry 타입**:
```typescript
{
  line: number;                              // 소스 코드 줄번호
  column: number;                            // 소스 코드 열번호
  timestamp: number;                         // 실행 시각
  variables: Record<string, string>;         // 해당 시점 변수 상태 (JSON 문자열)
  duration?: number;                         // 실행 소요 시간
  ctxControls?: Record<string, string>;      // ctx.controls 스냅샷
}
```

### 3.2 GET /api/runtime/forms/:id

**응답 (RuntimeFormDefinition)**:
```typescript
{
  id: string;
  name: string;
  version: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: Array<{       // 서버 핸들러만 노출 (코드 미포함)
    controlId: string;
    eventName: string;
    handlerType: 'server';
  }>;
  dataBindings?: DataBindingDefinition[];
}
```

### 3.3 GET /api/runtime/app/:projectId

**쿼리 파라미터**: `?formId=<id>` (선택, shell.startFormId 오버라이드)

**응답 (AppLoadResponse)**:
```typescript
{
  shell: ShellDefinition | null;   // Shell 정의 (없으면 null)
  startForm: RuntimeFormDefinition; // 시작 폼 정의
}
```

**ShellDefinition**:
```typescript
{
  id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: 'server';
  }>;
  startFormId?: string;
}
```

## 4. 각 Tool 상세 설계

### 4.1 execute_event

```typescript
server.tool(
  'execute_event',
  `폼의 이벤트를 런타임 환경에서 실행합니다. published 상태의 폼에서만 동작합니다.

isolated-vm 샌드박스에서 서버 핸들러 코드를 실행하고, UI 패치(UIPatch) 배열과 콘솔 로그를 반환합니다.
formState를 제공하면 해당 상태에서 시작하고, 미지정 시 빈 상태로 실행합니다.
eventArgs를 제공하면 ctx.eventArgs에 전달됩니다.

폼이 published 상태가 아니면 404 에러를 반환합니다 (publish_form 먼저 호출).`,
  {
    formId: z.string().describe('폼 ID (published 상태여야 함)'),
    controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
    eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged, Load)'),
    formState: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional()
      .describe('폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
    eventArgs: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('이벤트 인자 (ctx.eventArgs에 전달). 미지정 시 기본값 사용'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. eventArgs 구성: 지정된 경우 `{ type: eventName, timestamp: Date.now(), ...eventArgs }`, 미지정 시 `{ type: eventName, timestamp: Date.now() }`
3. 요청 body 구성: `{ controlId, eventName, eventArgs, formState: formState ?? {} }`
4. `apiClient.post<RuntimeEventResponse>('/api/runtime/forms/' + formId + '/events', body)`
   - **주의**: 런타임 엔드포인트는 인증 불필요하므로 `apiClient` 대신 직접 fetch 사용 또는 apiClient에 인증 없는 메서드 필요
5. 응답의 `error` 필드가 있으면 에러 반환 (errorLine 포함)
6. 성공 시 `patches`, `logs`, `patchCount` 반환

**런타임 엔드포인트 호출 시 인증 이슈**:

`apiClient`는 모든 요청에 인증 토큰을 포함한다. 런타임 엔드포인트(`/api/runtime/...`)는 인증 미들웨어 이전에 등록되므로 토큰이 있어도 문제없다. 따라서 `apiClient`를 그대로 사용할 수 있다.

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"success\": true, \"patches\": [...], \"logs\": [...], \"patchCount\": 2 }"
  }]
}
```

### 4.2 debug_execute

```typescript
server.tool(
  'debug_execute',
  `이벤트 핸들러를 디버그 모드로 실행합니다. 일반 실행 결과(패치, 로그)에 추가로 실행 트레이스(라인별 변수 상태 캡처)를 반환합니다.

CodeInstrumenter가 각 statement 앞에 추적 코드를 삽입하여, 실행 중 변수 값과 ctx.controls 상태를 기록합니다.
핸들러 코드 디버깅, 변수 흐름 추적, 성능 분석에 활용합니다.

폼이 published 상태여야 합니다.`,
  {
    formId: z.string().describe('폼 ID (published 상태여야 함)'),
    controlId: z.string().describe('이벤트를 발생시킬 컨트롤 ID'),
    eventName: z.string().describe('이벤트 이름 (예: Click, TextChanged)'),
    formState: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional()
      .describe('폼 상태 (컨트롤 ID → 속성 맵). 미지정 시 빈 상태로 실행'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. 요청 body 구성:
   ```typescript
   {
     controlId,
     eventName,
     eventArgs: { type: eventName, timestamp: Date.now() },
     formState: formState ?? {},
     debugMode: true,  // 서버에 디버그 모드 요청
   }
   ```
3. `apiClient.post<RuntimeEventResponse>('/api/runtime/forms/' + formId + '/events', body)`
4. 응답의 `error` 필드가 있으면 에러 반환 (errorLine, traces 포함)
5. 성공 시 `patches`, `logs`, `traces`, `patchCount`, `traceCount` 반환

**반환값 (성공)**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"success\": true, \"patches\": [...], \"logs\": [...], \"traces\": [{\"line\": 1, \"column\": 0, \"timestamp\": 1709..., \"variables\": {\"x\": \"5\"}, \"ctxControls\": {\"txtName\": \"{\\\"text\\\": \\\"hello\\\"}\"} }, ...], \"patchCount\": 2, \"traceCount\": 8 }"
  }]
}
```

**반환값 (에러)**:
```json
{
  "content": [{
    "type": "text",
    "text": "핸들러 실행 오류 (line 3): Cannot read property 'text' of undefined\n\n실행 트레이스:\nL1: x = 5\nL2: name = ctx.controls.txtName.text → \"hello\"\nL3: (에러 발생)"
  }],
  "isError": true
}
```

에러 시에도 traces가 있으면 포함하여 반환한다 — 에러 발생 직전까지의 실행 흐름을 확인할 수 있어 디버깅에 유용하다.

### 4.3 get_runtime_form

```typescript
server.tool(
  'get_runtime_form',
  `퍼블리시된 폼을 런타임 형식으로 로드합니다. published 상태가 아닌 폼은 404를 반환합니다.

런타임 형식은 서버 핸들러만 노출하며(코드 미포함), 데이터 바인딩 정보를 포함합니다.
폼의 현재 상태를 확인하거나 런타임 테스트 전 폼 구조를 검토할 때 사용합니다.`,
  {
    formId: z.string().describe('폼 ID (published 상태여야 함)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<RuntimeFormDefinition>('/api/runtime/forms/' + formId)`
3. 응답 데이터를 그대로 반환 (서버가 이미 런타임 형식으로 변환)

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"id\": \"...\", \"name\": \"LoginForm\", \"version\": 3, \"properties\": {...}, \"controls\": [...], \"eventHandlers\": [{\"controlId\": \"ctrl_1\", \"eventName\": \"Click\", \"handlerType\": \"server\"}], \"dataBindings\": [...] }"
  }]
}
```

### 4.4 get_runtime_app

```typescript
server.tool(
  'get_runtime_app',
  `프로젝트의 앱을 런타임 형식으로 로드합니다. Shell 정의(있으면)와 시작 폼을 일괄 반환합니다.

Shell이 없는 프로젝트는 shell: null로 반환됩니다.
formId를 지정하면 shell.startFormId 대신 해당 폼을 시작 폼으로 사용합니다.
Shell과 시작 폼 모두 published 상태여야 합니다.`,
  {
    projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
    formId: z.string().optional().describe('시작 폼 ID (미지정 시 shell.startFormId 사용)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. URL 구성: `/api/runtime/app/${projectId}` + (formId 있으면 `?formId=${formId}`)
3. `apiClient.get<AppLoadResponse>(url)`
4. 응답 데이터를 그대로 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"shell\": { \"id\": \"...\", \"projectId\": \"...\", \"name\": \"MyApp\", ... }, \"startForm\": { \"id\": \"...\", \"name\": \"MainForm\", ... } }"
  }]
}
```

## 5. API 응답 타입 정의

### 5.1 runtime.ts

```typescript
// GET /api/runtime/forms/:id 응답
interface RuntimeFormDefinition {
  id: string;
  name: string;
  version: number;
  properties: Record<string, unknown>;
  controls: Array<Record<string, unknown>>;
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: string;
  }>;
  dataBindings?: Array<Record<string, unknown>>;
}

// GET /api/runtime/app/:projectId 응답
interface AppLoadResponse {
  shell: {
    id: string;
    projectId: string;
    name: string;
    version: number;
    properties: Record<string, unknown>;
    controls: Array<Record<string, unknown>>;
    eventHandlers: Array<{
      controlId: string;
      eventName: string;
      handlerType: string;
    }>;
    startFormId?: string;
  } | null;
  startForm: RuntimeFormDefinition;
}

// POST /api/runtime/forms/:id/events 응답 (events.ts에도 동일한 타입 존재)
interface RuntimeEventResponse {
  success: boolean;
  patches: Array<{
    type: string;
    target: string;
    payload: Record<string, unknown>;
  }>;
  error?: string;
  logs?: Array<{
    type: string;
    args: string[];
    timestamp: number;
  }>;
  errorLine?: number;
  traces?: Array<{
    line: number;
    column: number;
    timestamp: number;
    variables: Record<string, string>;
    duration?: number;
    ctxControls?: Record<string, string>;
  }>;
}
```

### 5.2 debug.ts

`debug.ts`는 `RuntimeEventResponse`를 사용하므로, 해당 타입을 `runtime.ts`에서 export하거나 동일하게 정의한다. 코드 중복 최소화를 위해 **runtime.ts에서 export**하여 debug.ts에서 import하는 방식을 사용한다.

```typescript
// runtime.ts
export interface RuntimeEventResponse { ... }

// debug.ts
import { RuntimeEventResponse } from './runtime.js';
```

## 6. 에러 처리

### 6.1 공통 에러 핸들러

runtime.ts와 debug.ts에서 공유하는 에러 핸들러를 runtime.ts에 정의한다.

```typescript
function handleRuntimeToolError(error: unknown, resourceId: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(
        `리소스를 찾을 수 없습니다: ${resourceId}. 폼/Shell이 published 상태인지 확인하세요.`,
      );
    }
    if (error.status === 400) {
      return toolError(`잘못된 요청: ${error.detail || error.message}`);
    }
    return toolError(error.message);
  }
  if (error instanceof Error && error.message.includes('유효하지 않은')) {
    return toolError(error.message);
  }
  throw error;
}
```

### 6.2 Tool별 에러 분기

| 에러 상황 | HTTP 상태 | 발생 Tool | 메시지 |
|-----------|-----------|-----------|--------|
| 폼 미존재 | 404 | execute_event, debug_execute, get_runtime_form | "폼을 찾을 수 없습니다" |
| 폼 미발행 | 404 | execute_event, debug_execute, get_runtime_form | "폼이 published 상태인지 확인하세요" |
| 필수 필드 누락 | 400 | execute_event, debug_execute | "Missing required fields" |
| 시작 폼 미지정 | 400 | get_runtime_app | "No start form specified" |
| 핸들러 미존재 | 200 (success:false) | execute_event, debug_execute | "No server handler found" |
| 핸들러 실행 에러 | 200 (success:false) | execute_event, debug_execute | 에러 메시지 + 줄번호 |
| 잘못된 ID | 검증 에러 | 모든 Tool | "유효하지 않은 formId/projectId" |

### 6.3 핸들러 실행 에러 처리 (execute_event, debug_execute)

서버는 핸들러 실행 에러를 HTTP 200으로 반환하되 `success: false`와 `error` 필드를 포함한다. 이 경우 `toolError`로 변환하여 반환한다:

```typescript
if (res.error) {
  let errorMsg = `핸들러 실행 오류: ${res.error}`;
  if (res.errorLine) {
    errorMsg = `핸들러 실행 오류 (line ${res.errorLine}): ${res.error}`;
  }
  // debug_execute의 경우 traces도 포함
  return toolError(errorMsg);
}
```

**debug_execute 에러 시 특별 처리**: 에러가 발생하더라도 `traces`가 있으면 에러 메시지와 함께 반환한다. 이를 위해 `toolError` 대신 `toolResult`로 반환하되 `success: false`를 포함한다.

```typescript
// debug_execute에서 에러 + 트레이스가 있는 경우
if (res.error) {
  return toolResult({
    success: false,
    error: res.error,
    errorLine: res.errorLine,
    traces: res.traces ?? [],
    logs: res.logs ?? [],
    traceCount: res.traces?.length ?? 0,
  });
}
```

## 7. 서버 수정 사항

### 7.1 런타임 라우트 debugMode 전달

**파일**: `packages/server/src/routes/runtime.ts`
**위치**: POST `/forms/:id/events` 핸들러 (line 111-149)

```typescript
// 기존 (line 139-143)
const result = await eventEngine.executeEvent(
  req.params.id,
  payload,
  formDef,
);

// 수정
const debugMode = !!(req.body as { debugMode?: boolean }).debugMode;
const result = await eventEngine.executeEvent(
  req.params.id,
  payload,
  formDef,
  { debugMode },
);
```

이 수정은 하위 호환성을 유지한다:
- `debugMode` 미지정 시 `false` → 기존 동작과 동일
- `debugMode: true` 시 `CodeInstrumenter` 계측 활성화 → `traces` 배열 반환

## 8. registerRuntimeTools 함수 구조

```typescript
// packages/mcp/src/tools/runtime.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---
export interface RuntimeEventResponse { ... }
interface RuntimeFormDefinition { ... }
interface AppLoadResponse { ... }

// --- 헬퍼 ---
function toolResult(data: unknown) { ... }
function toolError(message: string) { ... }
export function handleRuntimeToolError(error: unknown, resourceId: string) { ... }

export function registerRuntimeTools(server: McpServer): void {
  // 1. execute_event
  server.tool('execute_event', ...);

  // 2. get_runtime_form
  server.tool('get_runtime_form', ...);

  // 3. get_runtime_app
  server.tool('get_runtime_app', ...);
}
```

## 9. registerDebugTools 함수 구조

```typescript
// packages/mcp/src/tools/debug.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';
import type { RuntimeEventResponse } from './runtime.js';
import { handleRuntimeToolError } from './runtime.js';

// --- 헬퍼 ---
function toolResult(data: unknown) { ... }
function toolError(message: string) { ... }

export function registerDebugTools(server: McpServer): void {
  // 1. debug_execute
  server.tool('debug_execute', ...);
}
```

## 10. server.ts 수정

```typescript
import {
  registerProjectTools,
  registerFormTools,
  registerControlTools,
  registerEventTools,
  registerDatasourceTools,
  registerDatabindingTools,
  registerThemeTools,
  registerShellTools,
  registerRuntimeTools,     // 추가
  registerDebugTools,       // 추가
} from './tools/index.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  registerControlTools(server);
  registerEventTools(server);

  // Phase 3: 데이터소스/데이터 바인딩/테마/Shell Tools
  registerDatasourceTools(server);
  registerDatabindingTools(server);
  registerThemeTools(server);
  registerShellTools(server);

  // Phase 4: 런타임/디버그 Tools
  registerRuntimeTools(server);
  registerDebugTools(server);
}
```

## 11. tools/index.ts 수정

```typescript
export { registerProjectTools } from './projects.js';
export { registerFormTools } from './forms.js';
export { registerControlTools } from './controls.js';
export { registerEventTools } from './events.js';
export { registerDatasourceTools } from './datasources.js';
export { registerDatabindingTools } from './databindings.js';
export { registerThemeTools } from './themes.js';
export { registerShellTools } from './shells.js';
export { registerRuntimeTools } from './runtime.js';     // 추가
export { registerDebugTools } from './debug.js';          // 추가
```

## 12. 구현 순서

| 순서 | 파일 | 작업 | 비고 |
|------|------|------|------|
| 1 | `packages/server/src/routes/runtime.ts` | **수정** — POST /forms/:id/events에 debugMode 전달 | 서버 측 |
| 2 | `packages/mcp/src/tools/runtime.ts` | **신규** — 3개 Tool + 타입 + 에러 처리 | MCP 측 |
| 3 | `packages/mcp/src/tools/debug.ts` | **신규** — 1개 Tool (runtime.ts 타입 재사용) | MCP 측 |
| 4 | `packages/mcp/src/tools/index.ts` | **수정** — 2개 export 추가 | MCP 측 |
| 5 | `packages/mcp/src/server.ts` | **수정** — 2개 register 호출 추가 | MCP 측 |

## 13. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] `pnpm --filter @webform/server typecheck` 에러 없음 (서버 수정분)
- [ ] 4개 Tool이 MCP 서버에 등록됨 (server.tool 호출 4회)
- [ ] execute_event: published 폼에 대해 이벤트 실행 → patches 반환
- [ ] execute_event: eventArgs 지정 시 ctx.eventArgs에 전달
- [ ] execute_event: formState 미지정 시 빈 상태로 실행
- [ ] execute_event: 미발행 폼 → 404 에러 + 안내 메시지
- [ ] execute_event: 핸들러 없는 이벤트 → "No server handler found" 에러
- [ ] debug_execute: traces 배열 반환 (라인, 변수 상태 포함)
- [ ] debug_execute: 에러 발생 시에도 traces 포함하여 반환 (success: false)
- [ ] get_runtime_form: published 폼 정의 반환 (서버 핸들러만, 코드 미포함)
- [ ] get_runtime_form: 미발행 폼 → 404 에러
- [ ] get_runtime_app: Shell + 시작 폼 일괄 반환
- [ ] get_runtime_app: Shell 없는 프로젝트 → `shell: null`
- [ ] get_runtime_app: formId 파라미터로 시작 폼 오버라이드
- [ ] 모든 Tool에서 잘못된 ID(비-ObjectId) 시 검증 에러 반환
- [ ] 서버 수정: debugMode 미지정 시 기존 동작과 동일 (하위 호환)
