# Phase 1: console.log 브릿지 및 에러 마커 구현 계획

## 개요

Designer의 EventEditor에서 사용자가 작성한 이벤트 핸들러 코드를 테스트 실행하고,
`console.log/warn/error/info` 출력을 캡처하여 디버그 콘솔에 표시하며,
에러 발생 시 Monaco Editor에 줄 번호 기반 에러 마커를 표시하는 기능을 구현한다.

## 현재 아키텍처 분석

### SandboxRunner (`packages/server/src/services/SandboxRunner.ts`)
- `isolated-vm` 기반 샌드박스에서 사용자 코드를 격리 실행
- `wrapHandlerCode()`가 사용자 코드를 IIFE로 감싸서 실행
- 현재 반환값: `{ controls: ctx.controls, messages: __messages }`
- `__messages` 배열로 `ctx.showMessage()` 호출을 수집하는 패턴이 이미 존재 → **동일 패턴으로 `__logs` 수집 가능**
- 래퍼 코드가 사용자 코드 앞에 약 **12줄**을 추가 (에러 줄 번호 오프셋 계산 시 필요)

### EventEngine (`packages/server/src/services/EventEngine.ts`)
- `SandboxRunner.runCode()` 결과에서 `controls`, `messages`를 추출하여 UIPatch 생성
- `extractPatches()`에서 `messages` → `showDialog` 패치 변환
- logs는 UIPatch가 아닌 EventResponse의 직접 필드로 전달해야 함

### Protocol Types (`packages/common/src/types/protocol.ts`)
- `EventResponse`: `{ success, patches, error? }` — logs 필드 없음
- `EventRequest`: formState를 포함하므로 디버그 API에서도 동일 구조 활용 가능

### EventEditor (`packages/designer/src/components/EventEditor/EventEditor.tsx`)
- Monaco Editor를 모달 형태로 렌더링 (80vw × 70vh)
- `FORM_CONTEXT_TYPES` 문자열로 TypeScript IntelliSense 타입 제공
- Ctrl+S 저장, Escape 닫기 단축키 등록
- 현재 디버그 콘솔 없음, Run 버튼 없음

### Runtime useEventHandlers (`packages/runtime/src/hooks/useEventHandlers.ts`)
- 서버 이벤트: `apiClient.postEvent()` → `response.patches` → `applyPatches()`
- logs가 EventResponse에 포함되면 런타임에서도 로그를 수신할 수 있으나, Phase 1에서는 **Designer 디버그 콘솔에만 집중**

## 구현 계획

### Task 1: SandboxRunner에 console 객체 주입
**파일**: `packages/server/src/services/SandboxRunner.ts`

`wrapHandlerCode()` 수정:

```javascript
(function(ctx) {
  var __messages = [];
  var __logs = [];                          // ← 추가

  // console 브릿지
  var console = {                           // ← 추가
    log: function() { __logs.push({ type: 'log',   args: __argsToStrings(arguments), timestamp: Date.now() }); },
    warn: function() { __logs.push({ type: 'warn',  args: __argsToStrings(arguments), timestamp: Date.now() }); },
    error: function() { __logs.push({ type: 'error', args: __argsToStrings(arguments), timestamp: Date.now() }); },
    info: function() { __logs.push({ type: 'info',  args: __argsToStrings(arguments), timestamp: Date.now() }); },
  };

  function __argsToStrings(args) {          // ← 추가
    var result = [];
    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] === 'string') result.push(args[i]);
      else {
        try { result.push(JSON.stringify(args[i])); }
        catch(e) { result.push(String(args[i])); }
      }
    }
    return result;
  }

  ctx.showMessage = function(text, title, type) { ... };
  ctx.http = { ... };

  var sender = ctx.sender;
  (function() {
    ${code}
  })();

  return { controls: ctx.controls, messages: __messages, logs: __logs };  // ← logs 추가
})(__ctx__)
```

**에러 줄 번호 추출 개선**:
- catch 블록에서 에러 메시지의 stack trace 파싱
- isolated-vm 에러 형식: `"SyntaxError: ... at line X, column Y"` 또는 `"vmName:X:Y"`
- 래퍼 코드가 추가하는 줄 수(오프셋)를 계산하여 사용자 코드 기준 줄 번호로 변환
- `SandboxResult`에 `errorLine?: number`, `errorColumn?: number` 필드 추가

```typescript
export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorLine?: number;    // ← 추가
  errorColumn?: number;  // ← 추가
  logs?: DebugLog[];     // ← 추가 (에러 발생 시에도 에러 전까지의 로그 반환)
}
```

에러 발생 시에도 이미 수집된 logs를 반환하기 위해, logs 수집을 래퍼 반환값이 아닌 별도 메커니즘으로 처리:
- `__logs`를 jail의 전역 변수로 설정하고, 에러 발생 후에도 `jail.get('__logs')`로 수집
- 또는 더 간단하게: wrapHandlerCode를 try/catch로 감싸서 에러 시에도 `{ ..., logs: __logs }` 반환

```javascript
(function(ctx) {
  var __messages = [];
  var __logs = [];
  var console = { ... };
  function __argsToStrings(args) { ... }
  ctx.showMessage = ...;
  ctx.http = ...;
  var sender = ctx.sender;
  try {
    (function() {
      ${code}
    })();
  } catch(e) {
    return { controls: ctx.controls, messages: __messages, logs: __logs, __error: e.message, __stack: e.stack };
  }
  return { controls: ctx.controls, messages: __messages, logs: __logs };
})(__ctx__)
```

이렇게 하면 에러를 자바스크립트 내부에서 잡으므로 isolated-vm 예외가 아닌 정상 반환값으로 처리되며,
에러 전까지의 logs도 함께 반환된다. SandboxRunner.runCode()에서 `__error` 존재 여부로 성공/실패를 판단한다.

### Task 2: 프로토콜 타입 확장
**파일**: `packages/common/src/types/protocol.ts`, `packages/common/src/index.ts`

```typescript
// protocol.ts에 추가
export interface DebugLog {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

export interface EventResponse {
  success: boolean;
  patches: UIPatch[];
  error?: string;
  logs?: DebugLog[];       // ← 추가
  errorLine?: number;      // ← 추가
  errorColumn?: number;    // ← 추가
}
```

`index.ts`에서 `DebugLog` export 추가.

### Task 3: EventEngine에서 logs/errorLine 전달
**파일**: `packages/server/src/services/EventEngine.ts`

`executeEvent()` 수정:
- `result.value`에서 `logs`, `__error`, `__stack` 추출
- 에러가 있으면 `{ success: false, patches: [], error, logs, errorLine }` 반환
- 성공이면 기존 패치 생성 후 `{ success: true, patches, logs }` 반환

```typescript
async executeEvent(...): Promise<EventResponse> {
  // ... 기존 로직 ...
  const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx);

  if (!result.success) {
    return {
      success: false, patches: [], error: result.error,
      logs: result.logs,           // ← 에러 시에도 로그 포함
      errorLine: result.errorLine,
    };
  }

  const rv = result.value as Record<string, unknown>;
  const logs = rv?.logs as DebugLog[] | undefined;

  // __error가 있으면 사용자 코드 런타임 에러
  if (rv?.__error) {
    const errorLine = this.parseErrorLine(rv.__stack as string);
    const patches = this.extractPatches(before, result.value);
    return { success: false, patches, error: String(rv.__error), logs, errorLine };
  }

  const patches = this.extractPatches(before, result.value);
  return { success: true, patches, logs };
}
```

`extractPatches()`는 기존 그대로 유지 (controls diff + messages → showDialog).

### Task 4: 에러 줄 번호 추출 로직
**파일**: `packages/server/src/services/EventEngine.ts` (또는 SandboxRunner)

사용자 코드 내부에서 잡은 에러의 stack trace에서 줄 번호를 추출:

```typescript
private parseErrorLine(stack?: string): number | undefined {
  if (!stack) return undefined;
  // 래퍼 IIFE 내부의 사용자 코드 시작 줄 오프셋
  const WRAPPER_LINE_OFFSET = 14; // wrapHandlerCode의 ${code} 앞 줄 수

  // V8 stack trace 형식: "at <anonymous>:LINE:COL"
  const match = stack.match(/:(\d+):(\d+)/);
  if (match) {
    const rawLine = parseInt(match[1], 10);
    return Math.max(1, rawLine - WRAPPER_LINE_OFFSET);
  }
  return undefined;
}
```

오프셋은 `wrapHandlerCode()` 수정 후 실제 줄 수를 세어 정확히 결정한다.

### Task 5: 디버그 실행 API 엔드포인트
**파일**: `packages/server/src/routes/debug.ts` (신규), `packages/server/src/routes/index.ts`

```typescript
// POST /api/debug/execute
// Request:  { code: string, formState?: Record<string, Record<string, unknown>>, controlId?: string }
// Response: { success, logs, error?, errorLine?, errorColumn? }

import { Router } from 'express';
import { SandboxRunner } from '../services/SandboxRunner.js';
import { env } from '../config/index.js';

export const debugRouter = Router();

debugRouter.post('/execute', async (req, res) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { code, formState = {}, controlId } = req.body;
  const runner = new SandboxRunner();
  const ctx = {
    formId: '__debug__',
    controls: formState,
    sender: controlId ? (formState[controlId] ?? {}) : {},
    eventArgs: { type: 'debug', timestamp: Date.now() },
  };

  const result = await runner.runCode(code, ctx);
  // result에서 logs, error, errorLine 추출하여 응답
  res.json({ success: result.success, logs: result.logs, error: result.error, errorLine: result.errorLine });
});
```

`routes/index.ts`에 등록:
```typescript
// 디버그 라우트 (development 전용, 인증 불필요)
import { debugRouter } from './debug.js';
if (env.NODE_ENV !== 'production') {
  apiRouter.use('/debug', debugRouter);
}
```

보안 고려사항:
- production 환경에서 완전 비활성화 (라우터 자체를 등록하지 않음)
- 타임아웃: `env.SANDBOX_TIMEOUT_MS` (기본 5초)
- 메모리 제한: `env.SANDBOX_MEMORY_LIMIT_MB` (기본 128MB)
- 인증 없이 접근 가능 (development 전용이므로)

### Task 6: EventEditor 디버그 콘솔 UI
**파일**: `packages/designer/src/components/EventEditor/EventEditor.tsx`

#### 레이아웃 변경
```
┌──────────────────────────────────────────────┐
│ Header: handlerName — eventName │ [Run] [Save & Close] [Close] │
├──────────────────────────────────────────────┤
│                                              │
│              Monaco Editor (70%)             │
│                                              │
├──────────────────────────────────────────────┤
│ ▼ Console [Clear]                            │
│──────────────────────────────────────────────│
│ [log]  12:34:56  Hello, world!               │  (30%)
│ [warn] 12:34:56  Value is undefined          │
│ [err]  12:34:56  TypeError: ...              │
├──────────────────────────────────────────────┤
│ Ctrl+S: Save │ Escape: Close │ F5: Run       │
└──────────────────────────────────────────────┘
```

#### 상태 관리
```typescript
const [consoleLogs, setConsoleLogs] = useState<DebugLog[]>([]);
const [showConsole, setShowConsole] = useState(false);
const [isRunning, setIsRunning] = useState(false);
```

#### Run 실행 로직
```typescript
const runCode = async () => {
  const code = editorRef.current?.getValue();
  if (!code) return;
  setIsRunning(true);
  setShowConsole(true);

  try {
    const res = await fetch('/api/debug/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, formState: {}, controlId }),
    });
    const data = await res.json();
    setConsoleLogs(prev => [...prev, ...data.logs]);

    if (data.error) {
      // 에러 로그 추가
      setConsoleLogs(prev => [...prev, { type: 'error', args: [data.error], timestamp: Date.now() }]);
      // Monaco 에러 마커 설정
      if (data.errorLine) setErrorMarker(data.errorLine, data.error);
    } else {
      clearErrorMarkers();
    }
  } finally {
    setIsRunning(false);
  }
};
```

#### 디버그 콘솔 컴포넌트 (인라인)
- 스크롤 가능한 `<div>` 영역
- 각 로그 항목: `[type] timestamp args.join(' ')`
- 색상 매핑:
  - `log`: `#d4d4d4` (기본 회색)
  - `info`: `#3794ff` (파란색)
  - `warn`: `#cca700` (노란색)
  - `error`: `#f14c4c` (빨간색)
- Clear 버튼: `setConsoleLogs([])`
- 자동 스크롤: `useEffect` + `scrollIntoView`

### Task 7: Monaco 에러 마커 및 데코레이션
**파일**: `packages/designer/src/components/EventEditor/EventEditor.tsx`

```typescript
// 에러 마커 설정
const setErrorMarker = (line: number, message: string) => {
  const model = editorRef.current?.getModel();
  if (!model || !monacoRef.current) return;

  monacoRef.current.editor.setModelMarkers(model, 'debugger', [{
    severity: monacoRef.current.MarkerSeverity.Error,
    startLineNumber: line,
    startColumn: 1,
    endLineNumber: line,
    endColumn: model.getLineMaxColumn(line),
    message,
  }]);
};

// 에러 줄 glyph margin 데코레이션
const decorationsRef = useRef<string[]>([]);

const setErrorDecoration = (line: number) => {
  const editor = editorRef.current;
  if (!editor) return;

  decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{
    range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
    options: {
      isWholeLine: true,
      className: 'debug-error-line',         // 빨간 배경
      glyphMarginClassName: 'debug-error-glyph', // 빨간 원 아이콘
    },
  }]);
};
```

Editor options에 `glyphMargin: true` 추가.

CSS 주입 (style 태그):
```css
.debug-error-line { background-color: rgba(255, 0, 0, 0.15); }
.debug-error-glyph { background-color: #f14c4c; border-radius: 50%; margin-left: 4px; }
```

### Task 8: FORM_CONTEXT_TYPES에 console 타입 추가
**파일**: `packages/designer/src/components/EventEditor/EventEditor.tsx`

```typescript
const FORM_CONTEXT_TYPES = `
// ... 기존 타입 ...

interface Console {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
}

declare const console: Console;
`;
```

### Task 9: F5 키보드 단축키
**파일**: `packages/designer/src/components/EventEditor/EventEditor.tsx`

```typescript
// handleMount 내부
editor.addCommand(monaco.KeyCode.F5, () => {
  runCode();
});
```

상태 바 텍스트 업데이트: `Ctrl+S: Save | Escape: Close | F5: Run`

## 파일 변경 요약

| 파일 | 유형 | 변경 내용 |
|------|------|-----------|
| `packages/common/src/types/protocol.ts` | 수정 | `DebugLog` 인터페이스 추가, `EventResponse`에 `logs?`, `errorLine?`, `errorColumn?` 필드 추가 |
| `packages/common/src/index.ts` | 수정 | `DebugLog` export 추가 |
| `packages/server/src/services/SandboxRunner.ts` | 수정 | console 객체 주입, `__logs` 수집, try/catch 래퍼, `SandboxResult`에 `errorLine`, `logs` 추가 |
| `packages/server/src/services/EventEngine.ts` | 수정 | logs/errorLine을 EventResponse에 포함, `parseErrorLine()` 메서드 추가 |
| `packages/server/src/routes/debug.ts` | **신규** | `POST /api/debug/execute` 엔드포인트 |
| `packages/server/src/routes/index.ts` | 수정 | debug 라우터 등록 (development 전용) |
| `packages/designer/src/components/EventEditor/EventEditor.tsx` | 수정 | 디버그 콘솔 UI, Run 버튼, F5 단축키, 에러 마커/데코레이션, console 타입 추가 |

## 구현 순서 (의존성 기반)

```
1. debugger-protocol-extend    (protocol.ts 타입 추가)
   ↓
2. debugger-console-inject     (SandboxRunner console 주입)
   ↓
3. debugger-engine-logs        (EventEngine logs 전달)
   ├→ 4. debugger-test-api     (POST /api/debug/execute)
   └→ 5. debugger-editor-types (FORM_CONTEXT_TYPES에 console 추가)
        ↓
      6. debugger-editor-console-ui  (디버그 콘솔 UI + Run 버튼)
        ↓
      7. debugger-error-markers      (Monaco 에러 마커/데코레이션 + F5)
        ↓
      8. debugger-phase1-test        (테스트 작성 및 실행)
```

## 테스트 계획

### 서버 테스트 (`packages/server/src/__tests__/`)

**SandboxRunner.debug.test.ts**:
- `console.log('hello')` → logs에 `{ type: 'log', args: ['hello'], timestamp }` 캡처
- `console.warn`, `console.error`, `console.info` → 올바른 type으로 캡처
- `console.log({ a: 1 })` → args에 `['{"a":1}']` (JSON.stringify)
- `console.log` 순환 참조 객체 → `String(obj)` 폴백
- 에러 코드 실행 → `errorLine`이 올바른 줄 번호 반환
- 에러 발생 시에도 에러 전까지의 logs가 반환
- 기존 기능 (`ctx.controls`, `ctx.showMessage`, `ctx.http`) 정상 동작 확인

**debug.api.test.ts**:
- `POST /api/debug/execute` 정상 코드 → `{ success: true, logs: [...] }`
- 에러 코드 → `{ success: false, error: '...', errorLine: N, logs: [...] }`
- production 환경 → 404 반환

### 수동 테스트

1. Designer에서 이벤트 편집기 열기
2. `console.log('테스트')` 코드 작성
3. F5 또는 Run 버튼 클릭
4. 디버그 콘솔에 로그 표시 확인
5. 에러 코드 실행 → 에러 마커, 빨간 밑줄 확인
6. `console` 자동완성 동작 확인
