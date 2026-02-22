# 서버 이벤트 엔진 구현 계획

## 1. 개요

서버 사이드 이벤트 핸들러를 `isolated-vm` 샌드박스 내에서 안전하게 실행하고, 실행 결과로 발생한 컨트롤 속성 변경을 `UIPatch[]`로 변환하여 클라이언트에 반환하는 이벤트 엔진을 구현한다. PRD 섹션 4.1.5(이벤트 시스템)와 5.2(보안)를 기반으로 한다.

### 1.1 현재 상태

- `@webform/common`에 모든 핵심 타입 정의 완료: `FormContext`, `ControlProxy`, `UIPatch`, `EventRequest`, `EventResponse`, `RuntimeWsMessage`
- `packages/server`에 `isolated-vm ^5.0.0` 의존성 설치됨
- `config/index.ts`에 `SANDBOX_TIMEOUT_MS`, `SANDBOX_MEMORY_LIMIT_MB` 환경 변수 정의됨
- `routes/runtime.ts`: 빈 라우터 (스텁)
- `websocket/runtimeEvents.ts`: echo 동작만 구현
- `websocket/designerSync.ts`: room 기반 브로드캐스트 구현됨
- `models/Form.ts`: `eventHandlers` 배열 포함
- `utils/validation.ts`에 `sanitizeQueryInput` 구현 완료

### 1.2 구현 대상 파일

```
packages/server/src/
├── services/
│   ├── SandboxRunner.ts          # [신규] isolated-vm 샌드박스 실행기
│   ├── ControlProxy.ts           # [신규] 속성 변경 추적 Proxy 팩토리
│   └── EventEngine.ts            # [신규] 이벤트 엔진 오케스트레이터
├── routes/
│   └── runtime.ts                # [수정] 런타임 API 엔드포인트 전체 구현
└── websocket/
    ├── runtimeEvents.ts          # [수정] WS 이벤트 → EventEngine 연동
    └── designerSync.ts           # [수정] 디자이너 동기화 강화
```

---

## 2. SandboxRunner — isolated-vm 샌드박스 실행기

### 2.1 역할

사용자가 작성한 이벤트 핸들러 JavaScript 코드를 `isolated-vm`의 격리된 환경에서 실행한다. 타임아웃과 메모리 제한을 적용하고, 위험한 전역 객체 접근을 차단한다.

### 2.2 파일: `packages/server/src/services/SandboxRunner.ts`

```typescript
import ivm from 'isolated-vm';
import { env } from '../config/index.js';

export interface SandboxOptions {
  timeout?: number;       // ms, 기본값: env.SANDBOX_TIMEOUT_MS (5000)
  memoryLimit?: number;   // MB, 기본값: env.SANDBOX_MEMORY_LIMIT_MB (128)
}

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

export class SandboxRunner {
  /**
   * 격리된 VM에서 코드를 실행한다.
   *
   * @param code - 실행할 JavaScript 코드 (함수 본문)
   * @param context - 샌드박스 내부에 주입할 컨텍스트 객체
   * @param options - 타임아웃, 메모리 제한
   * @returns 실행 결과 또는 에러
   */
  async runCode(
    code: string,
    context: Record<string, unknown>,
    options?: SandboxOptions,
  ): Promise<SandboxResult> {
    const timeout = options?.timeout ?? env.SANDBOX_TIMEOUT_MS;
    const memoryLimit = options?.memoryLimit ?? env.SANDBOX_MEMORY_LIMIT_MB;

    const isolate = new ivm.Isolate({ memoryLimit });

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      // 1. 위험한 전역 객체 차단
      await this.blockDangerousGlobals(jail);

      // 2. 컨텍스트 객체 주입
      await this.injectContext(jail, context);

      // 3. 핸들러 코드를 래핑하여 컴파일
      const wrappedCode = this.wrapHandlerCode(code);
      const script = await isolate.compileScript(wrappedCode);

      // 4. 실행 (타임아웃 적용)
      const result = await script.run(vmContext, { timeout });

      return { success: true, value: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    } finally {
      isolate.dispose();
    }
  }

  /**
   * process, require, eval 등 위험한 전역 객체를 undefined로 설정
   */
  private async blockDangerousGlobals(jail: ivm.Reference<Record<string, unknown>>): Promise<void> {
    const blocked = [
      'process', 'require', 'eval', 'Function',
      '__dirname', '__filename', 'module', 'exports',
      'globalThis', 'setTimeout', 'setInterval',
      'setImmediate', 'queueMicrotask',
    ];

    for (const name of blocked) {
      await jail.set(name, undefined);
    }
  }

  /**
   * 컨텍스트 객체를 샌드박스 전역에 주입
   *
   * 주의: isolated-vm의 Reference/ExternalCopy를 사용하여
   * 호스트 ↔ 게스트 간 데이터를 안전하게 전달한다.
   */
  private async injectContext(
    jail: ivm.Reference<Record<string, unknown>>,
    context: Record<string, unknown>,
  ): Promise<void> {
    // ctx 객체를 ExternalCopy로 전달
    await jail.set('__ctx__', new ivm.ExternalCopy(context).copyInto());

    // 콜백 함수들은 Reference로 전달 (showDialog, navigate 등)
    // → EventEngine에서 콜백 Reference를 context에 포함시킴
  }

  /**
   * 핸들러 코드를 즉시 실행 함수(IIFE)로 래핑
   *
   * 사용자 코드: ctx.controls.lblStatus.text = '클릭됨';
   * 래핑 결과:   (function(ctx) { ctx.controls.lblStatus.text = '클릭됨'; })(__ctx__)
   */
  private wrapHandlerCode(code: string): string {
    return `(function(ctx) { ${code} })(__ctx__)`;
  }
}
```

### 2.3 핵심 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| Isolate 재사용 | **매 실행마다 새 Isolate 생성/폐기** | 메모리 누수 방지, 핸들러 간 격리 보장 |
| 코드 래핑 | IIFE 패턴 | 사용자 코드가 `ctx` 파라미터를 통해 FormContext에 접근 |
| 전역 차단 | `process`, `require`, `eval`, `Function` 등 | PRD 5.2 보안 요구사항 준수 |
| 타임아웃 | isolated-vm 네이티브 `timeout` 옵션 | CPU 무한 루프 차단, 5초 기본 |

### 2.4 isolated-vm 데이터 전달 전략

isolated-vm은 V8 격리 환경이므로 호스트와 게스트 간 데이터 전달에 제약이 있다. 다음 전략을 사용한다:

```
┌─────────────────────────────────────────────────────────────┐
│                      Host (Node.js)                         │
│                                                             │
│  1. formState를 plain object로 직렬화                       │
│  2. ExternalCopy로 게스트에 전달                             │
│  3. 게스트에서 코드 실행                                     │
│  4. 실행 후 변경된 상태를 ExternalCopy로 회수                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Guest (isolated-vm)                   │  │
│  │                                                       │  │
│  │  __ctx__ = { controls: {...}, sender: {...} }         │  │
│  │  → 사용자 코드가 ctx.controls.xxx.prop = value 실행   │  │
│  │  → 변경 사항이 __ctx__ 객체에 반영됨                    │  │
│  │  → 실행 완료 후 __ctx__ 를 호스트로 반환                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**실제 구현 방식 (Proxy 없이 diff 기반):**

isolated-vm 내부에서는 JavaScript Proxy를 사용할 수 없다. 대신 다음 전략을 사용한다:

1. **Before snapshot**: 실행 전 `formState`를 deep clone하여 보관
2. **코드 실행**: 사용자 코드가 plain object의 속성을 직접 수정
3. **After diff**: 실행 후 변경된 상태와 before snapshot을 비교
4. **UIPatch 생성**: 차이점을 `UIPatch[]`로 변환

이 방식은 ControlProxy.ts에서 구현한다.

---

## 3. ControlProxy — 속성 변경 추적

### 3.1 역할

이벤트 핸들러 실행 전후의 컨트롤 상태를 비교하여 변경된 속성을 `UIPatch[]`로 변환한다.

### 3.2 파일: `packages/server/src/services/ControlProxy.ts`

```typescript
import type { UIPatch } from '@webform/common';

export type PatchCollector = UIPatch[];

/**
 * 이벤트 실행 전 상태 스냅샷을 생성한다.
 */
export function snapshotState(
  formState: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(formState));
}

/**
 * 이벤트 실행 전후 상태를 비교하여 UIPatch 배열을 생성한다.
 *
 * @param before - 실행 전 스냅샷
 * @param after  - 실행 후 상태
 * @returns 변경된 속성에 대한 UIPatch 배열
 */
export function diffToPatches(
  before: Record<string, Record<string, unknown>>,
  after: Record<string, Record<string, unknown>>,
): UIPatch[] {
  const patches: UIPatch[] = [];

  for (const [controlId, afterProps] of Object.entries(after)) {
    const beforeProps = before[controlId];

    if (!beforeProps) {
      // 새로 추가된 컨트롤 (현재 스코프 외)
      continue;
    }

    const changedProps: Record<string, unknown> = {};
    let hasChanges = false;

    for (const [prop, value] of Object.entries(afterProps)) {
      if (!deepEqual(beforeProps[prop], value)) {
        changedProps[prop] = value;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      patches.push({
        type: 'updateProperty',
        target: controlId,
        payload: changedProps,
      });
    }
  }

  return patches;
}

/**
 * 심층 동등 비교 (JSON 직렬화 가능한 값에 한정)
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

/**
 * FormState에서 controls 컨텍스트 객체를 생성한다.
 * 사용자 코드에서 ctx.controls.txtName.text 형태로 접근 가능.
 *
 * @param formState - { controlId: { prop: value, ... }, ... }
 * @returns plain object (isolated-vm에 전달 가능)
 */
export function buildControlsContext(
  formState: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  // formState를 그대로 사용 (deep clone은 snapshotState에서 처리)
  return formState;
}
```

### 3.3 diff 기반 변경 추적 흐름

```
1. formState 수신 (클라이언트 → 서버)
   { "txtName": { "text": "", "enabled": true },
     "lblStatus": { "text": "", "foreColor": "black" } }

2. snapshotState(formState) → before (deep clone)

3. SandboxRunner.runCode 실행
   - 사용자 코드: ctx.controls.lblStatus.text = '클릭됨'
   - 실행 후 formState:
     { "txtName": { "text": "", "enabled": true },
       "lblStatus": { "text": "클릭됨", "foreColor": "black" } }

4. diffToPatches(before, after) → UIPatch[]
   [{ type: 'updateProperty', target: 'lblStatus', payload: { text: '클릭됨' } }]
```

---

## 4. EventEngine — 이벤트 엔진 오케스트레이터

### 4.1 역할

이벤트 요청을 받아 폼 정의에서 핸들러 코드를 찾고, FormContext를 구성하여 SandboxRunner에서 실행한 뒤, 결과를 UIPatch[]로 반환한다.

### 4.2 파일: `packages/server/src/services/EventEngine.ts`

```typescript
import type {
  EventRequest,
  EventResponse,
  FormDefinition,
  UIPatch,
} from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';
import { snapshotState, diffToPatches, buildControlsContext } from './ControlProxy.js';

export class EventEngine {
  private sandboxRunner = new SandboxRunner();

  /**
   * 이벤트를 실행하고 UIPatch 배열을 반환한다.
   *
   * @param formId  - 폼 ID
   * @param payload - 이벤트 요청 (controlId, eventName, eventArgs, formState)
   * @param formDef - 폼 정의 (eventHandlers 포함)
   * @returns EventResponse (success, patches, error?)
   */
  async executeEvent(
    formId: string,
    payload: EventRequest,
    formDef: FormDefinition,
  ): Promise<EventResponse> {
    // 1. 핸들러 코드 조회
    const handler = formDef.eventHandlers.find(
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

    // 2. 실행 전 상태 스냅샷
    const before = snapshotState(payload.formState);

    // 3. FormContext 구성 (plain object)
    const formState = JSON.parse(JSON.stringify(payload.formState));
    const ctx = {
      formId,
      controls: buildControlsContext(formState),
      sender: formState[payload.controlId] ?? {},
      eventArgs: payload.eventArgs,
      // dataSources, showDialog, navigate: 후속 구현
      // (isolated-vm에서 async 콜백은 Reference로 전달 필요)
    };

    // 4. 샌드박스 실행
    const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx);

    if (!result.success) {
      return {
        success: false,
        patches: [],
        error: result.error,
      };
    }

    // 5. 변경사항 → UIPatch[]
    //    샌드박스 내부에서 ctx.controls.xxx.prop = value 로 수정한 결과를
    //    호스트에서 diff로 추출한다.
    //
    //    주의: isolated-vm에서 ctx 변경이 호스트로 자동 반영되지 않으므로,
    //    래핑 코드에서 변경된 ctx를 반환하도록 한다.
    //    → SandboxRunner.wrapHandlerCode를 수정하여 ctx 반환
    const patches = this.extractPatches(before, result.value, payload.formState);

    return {
      success: true,
      patches,
    };
  }

  /**
   * 샌드박스 실행 결과에서 UIPatch를 추출한다.
   *
   * 전략:
   * - result.value에 변경된 controls 상태가 포함되어 있으면 diff
   * - 없으면 빈 패치 반환
   */
  private extractPatches(
    before: Record<string, Record<string, unknown>>,
    resultValue: unknown,
    originalState: Record<string, Record<string, unknown>>,
  ): UIPatch[] {
    // 샌드박스에서 반환된 ctx.controls를 after 상태로 사용
    if (
      resultValue
      && typeof resultValue === 'object'
      && 'controls' in (resultValue as Record<string, unknown>)
    ) {
      const after = (resultValue as Record<string, unknown>).controls
        as Record<string, Record<string, unknown>>;
      return diffToPatches(before, after);
    }

    return [];
  }
}
```

### 4.3 SandboxRunner 래핑 코드 수정

`wrapHandlerCode`를 수정하여 실행 후 ctx 객체를 반환한다:

```typescript
// SandboxRunner.wrapHandlerCode 최종 버전
private wrapHandlerCode(code: string): string {
  return `
    (function(ctx) {
      ${code}
      return { controls: ctx.controls };
    })(__ctx__)
  `;
}
```

이렇게 하면:
1. 사용자 코드가 `ctx.controls.lblStatus.text = '클릭됨'` 실행
2. IIFE가 `{ controls: { ... } }`를 반환
3. 반환값이 `ExternalCopy`로 호스트에 전달
4. `EventEngine.extractPatches`에서 before/after diff → UIPatch[]

### 4.4 실행 흐름 다이어그램

```
클라이언트                         서버
   │                               │
   │  POST /api/runtime/forms/:id/events
   │  { controlId, eventName,      │
   │    eventArgs, formState }     │
   │──────────────────────────────→│
   │                               │
   │                     ┌─────────┴─────────┐
   │                     │   runtime.ts       │
   │                     │   라우트 핸들러     │
   │                     └─────────┬─────────┘
   │                               │
   │                     ┌─────────┴─────────┐
   │                     │   EventEngine      │
   │                     │   .executeEvent()  │
   │                     └─────────┬─────────┘
   │                               │
   │                     ┌─────────┴─────────┐
   │                     │ 1. 핸들러 코드 조회 │
   │                     │ 2. snapshotState   │
   │                     │ 3. FormContext 구성 │
   │                     └─────────┬─────────┘
   │                               │
   │                     ┌─────────┴─────────┐
   │                     │   SandboxRunner    │
   │                     │   .runCode()       │
   │                     │                    │
   │                     │  ┌──────────────┐  │
   │                     │  │ isolated-vm  │  │
   │                     │  │ 사용자 코드   │  │
   │                     │  │ 실행 (≤5초)  │  │
   │                     │  └──────────────┘  │
   │                     └─────────┬─────────┘
   │                               │
   │                     ┌─────────┴─────────┐
   │                     │ diffToPatches()   │
   │                     │ before vs after    │
   │                     │ → UIPatch[]       │
   │                     └─────────┬─────────┘
   │                               │
   │  { success, patches }         │
   │←──────────────────────────────│
   │                               │
   │  runtimeStore.applyPatches()  │
   │  → UI 업데이트                 │
```

---

## 5. Runtime API 라우트

### 5.1 파일: `packages/server/src/routes/runtime.ts`

현재 빈 스텁인 `runtimeRouter`를 전체 구현한다.

```typescript
import { Router } from 'express';
import type { EventRequest } from '@webform/common';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';

export const runtimeRouter = Router();
const eventEngine = new EventEngine();

/**
 * GET /api/runtime/forms/:id
 * published 상태의 폼 정의만 반환한다.
 */
runtimeRouter.get('/forms/:id', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Form not published');
    }

    res.json({
      id: form._id.toString(),
      name: form.name,
      version: form.version,
      properties: form.properties,
      controls: form.controls,
      eventHandlers: form.eventHandlers.filter(
        (h) => h.handlerType === 'server',
      ),
      dataBindings: form.dataBindings,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/forms/:id/events
 * 이벤트를 실행하고 UIPatch 배열을 반환한다.
 *
 * Request Body: EventRequest
 * Response: EventResponse { success, patches, error? }
 */
runtimeRouter.post('/forms/:id/events', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Form not published');
    }

    const payload = req.body as EventRequest;

    // 필수 필드 검증
    if (!payload.controlId || !payload.eventName || !payload.formState) {
      throw new AppError(400, 'Missing required fields: controlId, eventName, formState');
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

    const result = await eventEngine.executeEvent(
      req.params.id,
      payload,
      formDef,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/forms/:id/data
 * 데이터소스 쿼리를 실행한다. (스텁 — 후속 데이터소스 태스크에서 구현)
 */
runtimeRouter.post('/forms/:id/data', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    // TODO: DataSourceService.executeQuery 구현
    res.json({
      success: true,
      data: [],
      message: 'Data source query not yet implemented',
    });
  } catch (err) {
    next(err);
  }
});
```

### 5.2 응답 형식

| 엔드포인트 | 성공 | 실패 |
|-----------|------|------|
| `GET /forms/:id` | `200` FormDefinition (서버 핸들러만) | `404` Form not found/published |
| `POST /forms/:id/events` | `200` `{ success: true, patches: UIPatch[] }` | `200` `{ success: false, patches: [], error }` 또는 `400`/`404` |
| `POST /forms/:id/data` | `200` `{ success: true, data: [] }` | `404` Form not found |

### 5.3 GET 응답에서 서버 핸들러 필터링

런타임 GET 응답에서는 `handlerType === 'server'`인 핸들러만 포함한다. 클라이언트 핸들러 코드는 별도 경로로 전달되며(디자이너에서 빌드 시 포함), 서버 핸들러의 실제 코드는 보안상 클라이언트에 노출하지 않아야 하므로, 핸들러 목록에서 `handlerCode`를 제거하는 것을 고려한다:

```typescript
eventHandlers: form.eventHandlers
  .filter((h) => h.handlerType === 'server')
  .map((h) => ({
    controlId: h.controlId,
    eventName: h.eventName,
    handlerType: h.handlerType,
    // handlerCode 제외 — 서버에서만 실행
  })),
```

---

## 6. WebSocket 연동

### 6.1 runtimeEvents.ts — 런타임 이벤트 처리

현재 echo 스텁을 EventEngine 연동으로 교체한다.

```typescript
// packages/server/src/websocket/runtimeEvents.ts
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { EventRequest, RuntimeWsMessage } from '@webform/common';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';

const eventEngine = new EventEngine();

export function handleRuntimeConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as RuntimeWsMessage;

      if (message.type !== 'event') {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_TYPE', message: `Unsupported message type: ${message.type}` },
        }));
        return;
      }

      const payload = message.payload as EventRequest;

      // 폼 정의 조회
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

      // EventEngine 실행
      const result = await eventEngine.executeEvent(formId, payload, formDef);

      // 결과 전송
      ws.send(JSON.stringify({
        type: 'eventResult',
        payload: result,
      }));

      // 패치가 있으면 uiPatch도 별도 전송 (다른 클라이언트용 확장 가능)
      if (result.success && result.patches.length > 0) {
        ws.send(JSON.stringify({
          type: 'uiPatch',
          payload: result.patches,
        }));
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
```

### 6.2 designerSync.ts — 디자이너 동기화 강화

기존 room 기반 브로드캐스트에 타입 안전 메시지 처리를 추가한다.

```typescript
// packages/server/src/websocket/designerSync.ts
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { DesignerWsMessage } from '@webform/common';

const rooms = new Map<string, Set<WebSocket>>();

export function handleDesignerConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  // 방 입장
  if (!rooms.has(formId)) {
    rooms.set(formId, new Set());
  }
  rooms.get(formId)!.add(ws);

  ws.on('message', (data) => {
    try {
      // 메시지 유효성 검증
      const message = JSON.parse(data.toString()) as DesignerWsMessage;

      if (!message.type || !message.payload) {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { code: 'INVALID_MESSAGE', message: 'Missing type or payload' },
        }));
        return;
      }

      // 같은 방의 다른 클라이언트에게 브로드캐스트
      const clients = rooms.get(formId);
      if (!clients) return;

      const serialized = JSON.stringify(message);
      for (const client of clients) {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(serialized);
        }
      }
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
      }));
    }
  });

  ws.on('close', () => {
    rooms.get(formId)?.delete(ws);
    if (rooms.get(formId)?.size === 0) {
      rooms.delete(formId);
    }
  });
}

/**
 * 특정 폼의 모든 디자이너 클라이언트에게 메시지를 전송한다.
 * EventEngine이나 API에서 폼 정의가 변경될 때 호출할 수 있다.
 */
export function broadcastToDesigners(formId: string, message: DesignerWsMessage): void {
  const clients = rooms.get(formId);
  if (!clients) return;

  const serialized = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(serialized);
    }
  }
}
```

### 6.3 WebSocket 메시지 흐름

```
[런타임 클라이언트]                    [서버]                     [디자이너]
      │                                │                          │
      │  WS: { type: 'event',          │                          │
      │    payload: EventRequest }      │                          │
      │───────────────────────────────→ │                          │
      │                                 │                          │
      │                       EventEngine.executeEvent()           │
      │                                 │                          │
      │  WS: { type: 'eventResult',     │                          │
      │    payload: EventResponse }     │                          │
      │←─────────────────────────────── │                          │
      │                                 │                          │
      │  WS: { type: 'uiPatch',        │                          │
      │    payload: UIPatch[] }         │                          │
      │←─────────────────────────────── │                          │
      │                                 │                          │
      │                                 │  (폼 정의 변경 시)        │
      │                                 │  WS: designerSync       │
      │                                 │──────────────────────→   │
```

---

## 7. 보안

### 7.1 샌드박스 보안 (PRD 5.2)

| 위협 | 대응 | 구현 위치 |
|------|------|----------|
| 임의 코드 실행 | isolated-vm 격리 (별도 V8 힙) | SandboxRunner |
| CPU 무한 루프 | `timeout: 5000ms` | SandboxRunner.runCode |
| 메모리 폭주 | `memoryLimit: 128MB` | SandboxRunner.runCode |
| process.exit 등 | 전역 객체 차단 | SandboxRunner.blockDangerousGlobals |
| require('fs') 등 | require 차단, 모듈 시스템 없음 | SandboxRunner.blockDangerousGlobals |
| eval / Function | eval, Function 생성자 차단 | SandboxRunner.blockDangerousGlobals |
| NoSQL 인젝션 | sanitizeQueryInput | 데이터소스 쿼리 실행 시 적용 |
| XSS (핸들러 출력) | UIPatch의 text 값은 클라이언트에서 이스케이프 | 런타임 렌더러 책임 |

### 7.2 차단 대상 전역 객체

```typescript
const BLOCKED_GLOBALS = [
  'process',          // Node.js 프로세스 접근
  'require',          // 모듈 로드
  'eval',             // 동적 코드 실행
  'Function',         // Function 생성자로 eval 우회
  '__dirname',        // 파일 시스템 경로
  '__filename',       // 파일 시스템 경로
  'module',           // CommonJS 모듈
  'exports',          // CommonJS exports
  'globalThis',       // 전역 참조 우회
  'setTimeout',       // 비동기 타이머
  'setInterval',      // 비동기 타이머
  'setImmediate',     // 비동기 타이머
  'queueMicrotask',   // 마이크로태스크
];
```

### 7.3 API 보안

- **인증**: 모든 `/api/*` 라우트는 JWT `authenticate` 미들웨어 통과 (기존 구현)
- **published 폼만**: 런타임 API는 `status === 'published'`인 폼만 접근 허용
- **입력 검증**: `EventRequest`의 필수 필드 (`controlId`, `eventName`, `formState`) 검증

---

## 8. 에러 처리

### 8.1 에러 유형

| 에러 | HTTP | EventResponse | 설명 |
|------|------|---------------|------|
| 폼 없음 | `404` | - | Form.findById 실패 |
| 미퍼블리시 | `404` | - | status !== 'published' |
| 필수 필드 누락 | `400` | - | controlId, eventName, formState 누락 |
| 핸들러 없음 | `200` | `{ success: false, error }` | 해당 이벤트 핸들러 미등록 |
| 타임아웃 | `200` | `{ success: false, error }` | 5초 초과 |
| 실행 에러 | `200` | `{ success: false, error }` | 사용자 코드 런타임 에러 |
| 메모리 초과 | `200` | `{ success: false, error }` | 128MB 초과 |

### 8.2 설계 원칙

- **HTTP 에러** (4xx): 요청 자체가 잘못된 경우 (폼 없음, 잘못된 요청)
- **비즈니스 에러** (200 + `success: false`): 요청은 유효하지만 핸들러 실행이 실패한 경우
- 이 구분은 클라이언트가 HTTP 상태로 네트워크/라우팅 문제를, `success` 필드로 비즈니스 로직 문제를 구분할 수 있게 한다.

---

## 9. 테스트 전략

### 9.1 단위 테스트

#### SandboxRunner.test.ts

```typescript
describe('SandboxRunner', () => {
  // 1. 기본 실행
  it('단순 연산 실행: return 1 + 1 === 2', async () => {});

  // 2. 컨텍스트 전달
  it('컨텍스트 접근: ctx.value 반환', async () => {});

  // 3. 타임아웃
  it('무한 루프 → 타임아웃 에러 (timeout: 100ms)', async () => {});

  // 4. 보안
  it('process 접근 차단', async () => {});
  it('require 접근 차단', async () => {});
  it('eval 접근 차단', async () => {});

  // 5. 메모리 제한
  it('대량 메모리 할당 → 에러', async () => {});
});
```

#### ControlProxy.test.ts

```typescript
describe('ControlProxy', () => {
  // 1. snapshotState
  it('deep clone 생성 (원본 변경 영향 없음)', () => {});

  // 2. diffToPatches
  it('속성 변경 시 UIPatch 생성', () => {});
  it('여러 컨트롤 동시 변경 시 복수 UIPatch', () => {});
  it('변경 없으면 빈 배열', () => {});
  it('중첩 객체 변경 감지', () => {});
});
```

#### EventEngine.test.ts

```typescript
describe('EventEngine', () => {
  // 1. 정상 실행
  it('핸들러 실행 → UIPatch 반환', async () => {});

  // 2. 여러 컨트롤 업데이트
  it('복수 컨트롤 속성 변경 → 복수 UIPatch', async () => {});

  // 3. 핸들러 미존재
  it('핸들러 없을 때 error 반환', async () => {});

  // 4. 실행 에러
  it('사용자 코드 에러 시 success: false', async () => {});
});
```

### 9.2 통합 테스트

#### runtime.integration.test.ts

```typescript
describe('Runtime API', () => {
  // supertest + 인메모리 MongoDB (vitest-mongodb 또는 mongodb-memory-server)

  // GET /api/runtime/forms/:id
  it('published 폼 → 200 + FormDefinition', async () => {});
  it('draft 폼 → 404', async () => {});
  it('존재하지 않는 폼 → 404', async () => {});

  // POST /api/runtime/forms/:id/events
  it('이벤트 실행 → UIPatch 배열 응답', async () => {});
  it('필수 필드 누락 → 400', async () => {});

  // POST /api/runtime/forms/:id/data
  it('데이터 쿼리 → 스텁 응답', async () => {});
});
```

### 9.3 실행 명령

```bash
pnpm --filter @webform/server test
```

---

## 10. 향후 확장 고려사항

현재 구현에 포함되지 않지만, 아키텍처에서 고려해야 할 사항들:

### 10.1 DataSource 연동

현재 `ctx.dataSources`는 미구현 상태. 후속 태스크에서:
- isolated-vm의 `Reference` 콜백으로 호스트 측 MongoDB/REST API 호출
- `sanitizeQueryInput` 적용 후 쿼리 실행
- 결과를 `ExternalCopy`로 게스트에 반환

### 10.2 showDialog / navigate

- `showDialog`: 클라이언트에 `showDialog` UIPatch를 전송하고, 클라이언트가 다이얼로그 결과를 다시 서버로 전달하는 비동기 패턴 필요
- `navigate`: `navigate` UIPatch를 전송하여 클라이언트 라우팅

### 10.3 Isolate 풀링

현재는 매 실행마다 Isolate를 생성/폐기한다. 트래픽이 높아지면:
- Isolate 풀을 유지하여 생성 비용 절감
- 풀 크기는 `SANDBOX_POOL_SIZE` 환경 변수로 설정
- 사용 후 컨텍스트만 초기화하여 재사용

### 10.4 캐싱

- 자주 실행되는 핸들러 코드의 `compileScript` 결과 캐싱
- Redis에 폼 정의 캐싱 (현재 매 요청마다 MongoDB 조회)

---

## 11. 구현 순서

| 순서 | 파일 | 의존성 |
|------|------|--------|
| 1 | `services/SandboxRunner.ts` | isolated-vm, config |
| 2 | `services/ControlProxy.ts` | @webform/common (UIPatch) |
| 3 | `services/EventEngine.ts` | SandboxRunner, ControlProxy |
| 4 | `routes/runtime.ts` | EventEngine, Form 모델 |
| 5 | `websocket/runtimeEvents.ts` | EventEngine, Form 모델 |
| 6 | `websocket/designerSync.ts` | @webform/common (DesignerWsMessage) |

테스트도 같은 순서로 작성한다: SandboxRunner → ControlProxy → EventEngine → 통합 테스트.
