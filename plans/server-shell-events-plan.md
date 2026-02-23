# Server Shell 이벤트 엔진 및 WebSocket 계획

## 1. 현재 EventEngine 처리 흐름 분석

### EventEngine.executeEvent() (EventEngine.ts:52-112)

```
EventRequest 수신
  ↓
1. formDef.eventHandlers에서 핸들러 검색
   (controlId + eventName + handlerType='server' 매칭)
  ↓
2. buildControlMaps()로 ID↔NAME 매핑 구축
   (controls 배열 재귀 순회, idToName/nameToId Map 생성)
  ↓
3. formState를 NAME 키로 변환
   (사용자 코드가 ctx.controls.lblStatus 같은 이름으로 접근하기 위함)
  ↓
4. ctx 객체 구성
   { formId, controls: buildControlsContext(formStateByName),
     sender: formStateByName[senderName], eventArgs }
  ↓
5. mongoConnectors 추출 (MongoDBConnector 타입 컨트롤 검색)
  ↓
6. SandboxRunner.runCode(handler.handlerCode, ctx, options) 실행
  ↓
7. extractPatches()로 결과에서 UIPatch 추출
   (NAME→ID 역변환 포함)
  ↓
8. EventResponse { success, patches, logs, traces } 반환
```

### extractPatches() (EventEngine.ts:114-156)

- `result.value.operations[]` 배열에서 UIPatch 추출
- `type: 'updateProperty'`인 경우 target을 NAME→ID 역변환
- 그 외 타입(showDialog, navigate 등)은 그대로 전달
- `result.value.logs[]`에서 DebugLog 추출

## 2. 현재 SandboxRunner ctx 객체 목록

### 외부 주입 ctx (EventEngine → SandboxRunner)

| 속성 | 타입 | 설명 |
|------|------|------|
| `formId` | string | 현재 폼 ID |
| `controls` | Record<name, props> | NAME 키 컨트롤 상태 |
| `sender` | Record<string, unknown> | 이벤트 발생 컨트롤 |
| `eventArgs` | EventArgs | 이벤트 인자 |

### wrapHandlerCode()에서 생성되는 ctx 메서드 (SandboxRunner.ts:254-401)

| 메서드 | 설명 | 생성 UIPatch |
|--------|------|-------------|
| `ctx.showMessage(text, title, type)` | 대화상자 표시 | `{ type: 'showDialog', target: '_system', payload: { text, title, dialogType } }` |
| `ctx.navigate(formId, params)` | 폼 전환 | `{ type: 'navigate', target: '_system', payload: { formId, params } }` |
| `ctx.http.get/post/put/patch/delete` | HTTP 요청 | - (값 반환) |
| `ctx.getRadioGroupValue(groupName)` | 라디오 그룹 값 | - (값 반환) |
| `ctx.controls[name].find/findOne/...` | MongoDB 쿼리 (MongoDBConnector) | - (값 반환) |
| `console.log/warn/error/info` | 로그 | - (logs에 수집) |

### wrapHandlerCode() 내부 변수

- `__operations[]` — UIPatch 수집 배열
- `__logs[]` — DebugLog 수집 배열
- `__lastSnapshot` — controls 초기 스냅샷 (변경 감지용)
- `__flushChanges()` — controls 변경 diff → updateProperty 오퍼레이션 생성
- `__traces[]` (debugMode) — 디버그 트레이스

**핵심 패턴**: `ctx.navigate()`나 `ctx.showMessage()` 호출 시 먼저 `__flushChanges()`를 호출하여 현재까지의 컨트롤 변경사항을 수집한 후, 해당 오퍼레이션을 `__operations[]`에 추가.

## 3. Shell 이벤트 처리 분기 로직 설계

### 3.1 ShellEventRequest vs EventRequest 판별

```typescript
// EventEngine에 새 메서드 추가
async executeShellEvent(
  projectId: string,
  payload: ShellEventRequest,
  shellDef: ApplicationShellDefinition,
  appState: Record<string, unknown>,
  options?: ExecuteEventOptions,
): Promise<EventResponse>
```

- 기존 `executeEvent()`는 그대로 유지 (하위 호환)
- Shell 이벤트는 별도 메서드 `executeShellEvent()`로 처리
- 호출자(runtimeEvents.ts 또는 runtime.ts)가 scope에 따라 분기

### 3.2 Shell 이벤트 처리 흐름

```
ShellEventRequest 수신 (projectId, controlId, eventName, shellState, currentFormId)
  ↓
1. shellDef.eventHandlers에서 핸들러 검색
   (controlId + eventName + handlerType='server' 매칭)
  ↓
2. buildControlMaps()로 Shell controls ID↔NAME 매핑 구축
  ↓
3. shellState를 NAME 키로 변환
  ↓
4. ctx 객체 구성 (Shell 전용 필드 포함)
   {
     formId: null,             // Shell은 formId 없음
     controls: shellStateByName,
     sender: shellStateByName[senderName],
     eventArgs: payload.eventArgs,
     currentFormId: payload.currentFormId,
     appState: deepCopy(appState),
   }
  ↓
5. SandboxRunner.runCode(handler.handlerCode, ctx, {
     ...options,
     shellMode: true,         // Shell 모드 플래그
     appState: deepCopy(appState),
   })
  ↓
6. Shell 전용 extractPatches:
   - updateProperty → updateShell로 변환 (NAME→ID 역변환)
   - navigate, closeApp, updateAppState 패치 포함
   - appState diff → updateAppState UIPatch 생성
  ↓
7. EventResponse { success, patches, logs, traces } 반환
```

### 3.3 EventEngine 코드 변경 위치

**파일**: `packages/server/src/services/EventEngine.ts`

**추가 import** (line 1-11):
```typescript
import type {
  ApplicationShellDefinition,
  ShellEventRequest,
} from '@webform/common';
```

**새 메서드 추가** (executeEvent 메서드 아래, line 112 이후):
```typescript
async executeShellEvent(
  projectId: string,
  payload: ShellEventRequest,
  shellDef: ApplicationShellDefinition,
  appState: Record<string, unknown>,
  options?: ExecuteEventOptions,
): Promise<EventResponse> {
  const handler = shellDef.eventHandlers.find(
    (h) => h.controlId === payload.controlId
      && h.eventName === payload.eventName
      && h.handlerType === 'server',
  );

  if (!handler) {
    return {
      success: false,
      patches: [],
      error: `No server handler found: ${payload.controlId}.${payload.eventName}`,
    };
  }

  // Shell controls ID↔NAME 매핑
  const { idToName, nameToId } = buildControlMaps(shellDef.controls);
  const shellStateById = JSON.parse(JSON.stringify(payload.shellState));
  const shellStateByName = convertToNameKeyed(shellStateById, idToName);

  const senderName = idToName.get(payload.controlId) ?? payload.controlId;
  const appStateCopy = JSON.parse(JSON.stringify(appState));

  const ctx = {
    formId: null,
    controls: buildControlsContext(shellStateByName),
    sender: shellStateByName[senderName] ?? {},
    eventArgs: payload.eventArgs,
    currentFormId: payload.currentFormId,
    appState: appStateCopy,
  };

  const mongoConnectors = this.extractMongoConnectors(shellDef.controls);

  const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
    debugMode: options?.debugMode,
    mongoConnectors,
    shellMode: true,
    appState: appStateCopy,
  });

  if (!result.success) {
    return {
      success: false,
      patches: [],
      error: result.error,
      errorLine: result.errorLine,
      traces: result.traces,
    };
  }

  const { patches, logs } = this.extractShellPatches(result.value, nameToId, appState);

  return {
    success: true,
    patches,
    logs,
    traces: result.traces,
  };
}
```

**새 메서드 — extractShellPatches** (extractPatches 아래):
```typescript
private extractShellPatches(
  resultValue: unknown,
  nameToId: Map<string, string>,
  originalAppState: Record<string, unknown>,
): { patches: UIPatch[]; logs?: DebugLog[] } {
  const patches: UIPatch[] = [];
  let logs: DebugLog[] | undefined;

  if (
    resultValue
    && typeof resultValue === 'object'
    && 'operations' in (resultValue as Record<string, unknown>)
  ) {
    const rv = resultValue as Record<string, unknown>;

    if (Array.isArray(rv.operations)) {
      for (const op of rv.operations) {
        const o = op as { type: string; target: string; payload: unknown };
        if (o.type === 'updateProperty') {
          // Shell 컨트롤 변경: updateProperty → updateShell로 변환
          const resolvedId = nameToId.get(o.target) ?? o.target;
          patches.push({
            type: 'updateShell',
            target: resolvedId,
            payload: o.payload as Record<string, unknown>,
          });
        } else {
          // navigate, closeApp, showDialog 등은 그대로
          patches.push(o as UIPatch);
        }
      }
    }

    if (Array.isArray(rv.logs)) {
      logs = rv.logs as DebugLog[];
    }

    // appState 변경 감지
    if (rv.appState && typeof rv.appState === 'object') {
      const newAppState = rv.appState as Record<string, unknown>;
      const changed: Record<string, unknown> = {};
      let hasChanges = false;

      for (const [key, value] of Object.entries(newAppState)) {
        if (JSON.stringify(originalAppState[key]) !== JSON.stringify(value)) {
          changed[key] = value;
          hasChanges = true;
        }
      }
      // 삭제된 키 감지
      for (const key of Object.keys(originalAppState)) {
        if (!(key in newAppState)) {
          changed[key] = undefined;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        patches.push({
          type: 'updateAppState',
          target: '_system',
          payload: changed,
        });
      }
    }
  }

  return { patches, logs };
}
```

## 4. 신규 ctx 메서드 구현 방법

### 4.1 SandboxRunner 변경

**파일**: `packages/server/src/services/SandboxRunner.ts`

#### SandboxOptions 확장 (line 17-23)

```typescript
export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;
  mongoConnectors?: MongoConnectorInfo[];
  shellMode?: boolean;                       // ← 추가
  appState?: Record<string, unknown>;        // ← 추가
  currentFormId?: string;                    // ← 추가
  params?: Record<string, unknown>;          // ← 추가
}
```

#### injectContext 확장 (line 122-209)

appState를 별도 글로벌로 주입:
```typescript
// injectContext() 내에 추가
if (options.shellMode && options.appState) {
  await jail.set('__appState__', new ivm.ExternalCopy(options.appState).copyInto());
}
```

#### wrapHandlerCode 확장 (line 211 이후)

`wrapHandlerCode` 시그니처에 shellMode 관련 파라미터 추가:

```typescript
private wrapHandlerCode(
  code: string,
  debugMode?: boolean,
  mongoConnectors: MongoConnectorInfo[] = [],
  shellMode?: boolean,
  currentFormId?: string,
  params?: Record<string, unknown>,
): string
```

Shell 모드 전용 코드 블록을 wrapHandlerCode 내에 조건부 삽입:

```javascript
// ctx.navigate(formId, params) 는 이미 존재 (line 319-329)
// 이미 기존 코드에 포함되어 있으므로 그대로 유지

// Shell 모드일 때 추가할 코드
const shellSetup = shellMode ? `
  // currentFormId (읽기 전용)
  ctx.currentFormId = ${JSON.stringify(currentFormId ?? '')};
  ctx.params = ${JSON.stringify(params ?? {})};

  // appState 읽기/쓰기 (변경 추적)
  var __appStateSnapshot = typeof __appState__ !== 'undefined'
    ? JSON.parse(JSON.stringify(__appState__))
    : {};
  ctx.appState = typeof __appState__ !== 'undefined'
    ? JSON.parse(JSON.stringify(__appState__))
    : {};

  // navigateBack
  ctx.navigateBack = function() {
    __flushChanges();
    __operations.push({
      type: 'navigate',
      target: '_system',
      payload: { back: true }
    });
  };

  // navigateReplace
  ctx.navigateReplace = function(formId, params) {
    __flushChanges();
    __operations.push({
      type: 'navigate',
      target: '_system',
      payload: {
        formId: String(formId ?? ''),
        params: params || {},
        replace: true
      }
    });
  };

  // closeApp
  ctx.closeApp = function() {
    __flushChanges();
    __operations.push({
      type: 'closeApp',
      target: '_system',
      payload: {}
    });
  };
` : '';
```

**appState 변경 수집**: Shell 모드일 때 returnValue에 appState를 포함:

```javascript
const returnValue = debugMode
  ? shellMode
    ? '{ operations: __operations, logs: __logs, traces: __traces, appState: ctx.appState }'
    : '{ operations: __operations, logs: __logs, traces: __traces }'
  : shellMode
    ? '{ operations: __operations, logs: __logs, appState: ctx.appState }'
    : '{ operations: __operations, logs: __logs }';
```

이렇게 하면 appState의 변경사항이 SandboxRunner 결과 → EventEngine으로 전달되고,
EventEngine의 `extractShellPatches()`에서 원본과 비교하여 `updateAppState` UIPatch를 생성합니다.

### 4.2 기존 ctx.navigate 유지

현재 `ctx.navigate(formId, params)`는 SandboxRunner.wrapHandlerCode()에서 이미 정의되어 있음 (line 319-329).
이 코드는 Shell/Form 모두에서 사용 가능하므로 변경 없이 유지.

Shell 모드에서 추가되는 것은 `navigateBack`, `navigateReplace`, `closeApp`, `currentFormId`, `appState`, `params`.

## 5. WebSocket 확장 설계

### 5.1 현재 WebSocket 구조

```
/ws/designer/:formId → designerSync.ts (handleDesignerConnection)
/ws/runtime/:formId  → runtimeEvents.ts (handleRuntimeConnection)
```

- designerSync: rooms Map으로 formId별 클라이언트 관리, 브로드캐스트
- runtimeEvents: formId 기반, 단일 클라이언트 이벤트 처리, Form 조회 → EventEngine

### 5.2 신규 엔드포인트: /ws/runtime/app/:projectId

**파일**: `packages/server/src/websocket/appEvents.ts` (신규)

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { EventRequest, RuntimeWsMessage, ShellEventRequest } from '@webform/common';
import { Form } from '../models/Form.js';
import { Shell } from '../models/Shell.js';
import { EventEngine } from '../services/EventEngine.js';

const eventEngine = new EventEngine();

export function handleAppConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  // /ws/runtime/app/:projectId
  const projectId = url.pathname.split('/').pop() ?? '';

  // 클라이언트별 appState 관리
  let appState: Record<string, unknown> = {};

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as RuntimeWsMessage & { scope?: string };

      if (message.type === 'initAppState') {
        // 클라이언트에서 초기 appState 전송
        appState = (message as { payload: Record<string, unknown> }).payload || {};
        return;
      }

      if (message.type !== 'event') {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_TYPE', message: `Unsupported message type: ${message.type}` },
        }));
        return;
      }

      const payload = message.payload as EventRequest;
      const scope = payload.scope ?? 'form';

      if (scope === 'shell') {
        await handleShellEvent(ws, projectId, payload, appState);
      } else {
        await handleFormEvent(ws, payload);
      }
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
      }));
    }
  });

  ws.on('close', () => {
    // 정리 로직
  });
}

async function handleShellEvent(
  ws: WebSocket,
  projectId: string,
  payload: EventRequest,
  appState: Record<string, unknown>,
): Promise<void> {
  const shell = await Shell.findOne({ projectId, published: true, deletedAt: null });
  if (!shell) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { code: 'SHELL_NOT_FOUND', message: 'Shell not found or not published' },
    }));
    return;
  }

  const shellDef = {
    id: shell._id.toString(),
    projectId: shell.projectId,
    name: shell.name,
    version: shell.version,
    properties: shell.properties,
    controls: shell.controls,
    eventHandlers: shell.eventHandlers,
    startFormId: shell.startFormId,
  };

  // EventRequest → ShellEventRequest 변환
  const shellReq: ShellEventRequest = {
    projectId,
    controlId: payload.controlId,
    eventName: payload.eventName,
    eventArgs: payload.eventArgs,
    shellState: payload.formState, // formState 필드를 shellState로 매핑
    currentFormId: payload.formId,
  };

  const result = await eventEngine.executeShellEvent(
    projectId, shellReq, shellDef, appState,
  );

  ws.send(JSON.stringify({
    type: 'eventResult',
    payload: result,
  }));

  if (result.success && result.patches.length > 0) {
    // appState 업데이트 (서버 측 상태 반영)
    for (const patch of result.patches) {
      if (patch.type === 'updateAppState') {
        Object.assign(appState, patch.payload);
      }
    }

    ws.send(JSON.stringify({
      type: 'uiPatch',
      payload: result.patches,
      scope: 'shell',
    }));
  }
}

async function handleFormEvent(
  ws: WebSocket,
  payload: EventRequest,
): Promise<void> {
  // 기존 runtimeEvents.ts 로직과 동일
  const formId = payload.formId;
  const form = await Form.findById(formId);
  if (!form || form.status !== 'published') {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { code: 'FORM_NOT_FOUND', message: 'Form not found or not published' },
    }));
    return;
  }

  const formDef = {
    id: form._id.toString(),
    name: form.name,
    version: form.version,
    properties: form.properties,
    controls: form.controls,
    eventHandlers: form.eventHandlers,
    dataBindings: form.dataBindings,
  };

  const result = await eventEngine.executeEvent(formId, payload, formDef);

  ws.send(JSON.stringify({
    type: 'eventResult',
    payload: result,
  }));

  if (result.success && result.patches.length > 0) {
    ws.send(JSON.stringify({
      type: 'uiPatch',
      payload: result.patches,
      scope: 'form',
    }));
  }
}
```

### 5.3 WebSocket index.ts 확장

**파일**: `packages/server/src/websocket/index.ts`

```typescript
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { handleDesignerConnection } from './designerSync.js';
import { handleRuntimeConnection } from './runtimeEvents.js';
import { handleAppConnection } from './appEvents.js';        // ← 추가

export function initWebSocket(server: Server): void {
  const designerWss = new WebSocketServer({ noServer: true });
  designerWss.on('connection', handleDesignerConnection);

  const runtimeWss = new WebSocketServer({ noServer: true });
  runtimeWss.on('connection', handleRuntimeConnection);

  const appWss = new WebSocketServer({ noServer: true });     // ← 추가
  appWss.on('connection', handleAppConnection);               // ← 추가

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/ws/designer/')) {
      designerWss.handleUpgrade(req, socket, head, (ws) => {
        designerWss.emit('connection', ws, req);
      });
    } else if (pathname.startsWith('/ws/runtime/app/')) {     // ← 추가 (순서 중요: /ws/runtime/app/ 먼저)
      appWss.handleUpgrade(req, socket, head, (ws) => {
        appWss.emit('connection', ws, req);
      });
    } else if (pathname.startsWith('/ws/runtime/')) {
      runtimeWss.handleUpgrade(req, socket, head, (ws) => {
        runtimeWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  console.log('[ws] WebSocket server initialized');
}
```

**중요**: `/ws/runtime/app/` 경로가 `/ws/runtime/` 보다 먼저 매칭되도록 순서 배치.

## 6. 수정할 코드 섹션 정확한 위치 및 요약

### 파일별 변경 사항

| # | 파일 | 변경 유형 | 변경 위치 | 설명 |
|---|------|----------|----------|------|
| 1 | `services/SandboxRunner.ts` | 수정 | line 17-23 | `SandboxOptions`에 `shellMode`, `appState`, `currentFormId`, `params` 추가 |
| 2 | `services/SandboxRunner.ts` | 수정 | line 33-42 | `runCode()`에서 새 options 파라미터를 `wrapHandlerCode()`에 전달 |
| 3 | `services/SandboxRunner.ts` | 수정 | line 66 | `wrapHandlerCode` 호출 시 shellMode 관련 인자 추가 |
| 4 | `services/SandboxRunner.ts` | 수정 | line 122-209 | `injectContext()`에서 `__appState__` 글로벌 주입 |
| 5 | `services/SandboxRunner.ts` | 수정 | line 211-401 | `wrapHandlerCode()`에 shellMode 분기, `navigateBack`/`navigateReplace`/`closeApp`/`currentFormId`/`appState`/`params` ctx 설정, returnValue에 appState 포함 |
| 6 | `services/EventEngine.ts` | 수정 | line 1-11 | `ShellEventRequest`, `ApplicationShellDefinition` import 추가 |
| 7 | `services/EventEngine.ts` | 추가 | line 112 이후 | `executeShellEvent()` 메서드 추가 |
| 8 | `services/EventEngine.ts` | 추가 | line 156 이후 | `extractShellPatches()` 메서드 추가 |
| 9 | `websocket/appEvents.ts` | 신규 | 전체 | Per-project WebSocket 핸들러 (Shell/Form 이벤트 라우팅) |
| 10 | `websocket/index.ts` | 수정 | line 3 | `handleAppConnection` import 추가 |
| 11 | `websocket/index.ts` | 수정 | line 6-31 | `appWss` 생성 및 `/ws/runtime/app/` 경로 매칭 추가 |

### 변경하지 않는 파일

- `websocket/runtimeEvents.ts` — 기존 `/ws/runtime/:formId` 핸들러 그대로 유지 (하위 호환)
- `websocket/designerSync.ts` — 변경 없음
- `services/ControlProxy.ts` — 변경 없음
- `packages/common/src/types/protocol.ts` — 이미 UIPatch에 `updateShell`/`updateAppState`/`closeApp` 추가됨, `EventRequest`에 `scope`/`appState` 추가됨

### 구현 순서

1. **SandboxRunner.ts 수정** — shellMode 지원, ctx 확장
2. **EventEngine.ts 수정** — executeShellEvent + extractShellPatches 추가
3. **appEvents.ts 신규** — per-project WebSocket 핸들러
4. **index.ts 수정** — appEvents 등록
5. **테스트 작성** — shell-events.test.ts
