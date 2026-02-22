# Phase 2: 코드 계측 및 실행 추적 구현 계획

## 개요

Phase 1에서 구현한 console.log 브릿지와 에러 마커 기능 위에, AST 파싱 기반 코드 계측(instrumentation)을 추가하여 각 문(statement)의 실행 여부, 변수 값 스냅샷, 실행 시간을 자동으로 추적하는 기능을 구현한다.

## 현재 상태 (Phase 1 완료)

### 기존 구현
- **SandboxRunner** (`packages/server/src/services/SandboxRunner.ts`)
  - isolated-vm 기반 샌드박스 격리 실행
  - `wrapHandlerCode()`로 console 객체 주입 (`__logs` 배열 수집)
  - `extractErrorLine()`으로 에러 줄 번호 추출
  - `SandboxResult`: `{ success, value?, error?, errorLine? }`
  - 래퍼 구조: IIFE 내부에 `__messages`, `__logs`, `__stringify`, `console`, `ctx.showMessage`, `ctx.http`, `sender` 주입 후 사용자 코드 실행

- **Debug API** (`packages/server/src/routes/debug.ts`)
  - `POST /api/debug/execute`: 코드 테스트 실행
  - 요청: `{ code, formState, controlId }`
  - 응답: `{ success, logs, error?, errorLine?, controlChanges? }`
  - development 환경 전용

- **EventEditor** (`packages/designer/src/components/EventEditor/EventEditor.tsx`)
  - Monaco Editor + 디버그 콘솔 (704줄)
  - Run 버튼 (▶), F5 단축키
  - 에러 마커 (빨간 물결 밑줄 + glyph margin)
  - 성공 시 녹색 glyph

- **프로토콜 타입** (`packages/common/src/types/protocol.ts`)
  - `DebugLog`: `{ type, args, timestamp }`
  - `EventResponse`: `logs?`, `errorLine?` 필드

### Phase 2에서 확장할 부분
1. `CodeInstrumenter` 서비스 신규 생성 → AST 계측
2. `SandboxRunner`에 debugMode 옵션 추가 → 계측 코드 실행
3. 프로토콜 타입에 `TraceEntry` 추가
4. Debug API에 traces 반환
5. EventEditor에 인라인 변수값 표시 + 변수 감시 패널

---

## 1. AST 파서: acorn + astring

### 선정 이유
- **acorn**: 경량(~130KB), ECMAScript 2020 지원, 표준 ESTree AST 출력
- **astring**: AST → 코드 변환. ESTree 호환, 소스맵 지원
- 둘 다 순수 JavaScript, isolated-vm 외부(서버 측)에서 실행하므로 호환성 문제 없음

### 설치
```bash
pnpm --filter @webform/server add acorn astring
pnpm --filter @webform/server add -D @types/estree
```

### 동작 흐름
```
사용자 코드 (string)
  → acorn.parse() → ESTree AST
  → AST 순회 + __trace() 삽입
  → astring.generate() → 계측된 코드 (string)
  → SandboxRunner에서 실행
```

---

## 2. __trace() 함수 설계

### 시그니처
```javascript
__trace(line, column, varNames, varValues)
```

### 파라미터
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `line` | `number` | 원본 코드의 줄 번호 (1-based) |
| `column` | `number` | 원본 코드의 컬럼 번호 (0-based) |
| `varNames` | `string[]` | 현재 스코프에서 추적할 변수 이름 배열 |
| `varValues` | `any[]` | 해당 변수들의 현재 값 배열 |

### 샌드박스 주입 코드

```javascript
var __traces = [];
var __traceStart = null;
var __trace = function(line, col, varNames, varValues) {
  var now = Date.now();
  var vars = {};
  for (var i = 0; i < varNames.length; i++) {
    try {
      vars[varNames[i]] = __stringify(varValues[i]);
    } catch(e) {
      vars[varNames[i]] = '<error>';
    }
  }
  // 이전 trace의 duration 계산
  if (__traces.length > 0 && __traceStart !== null) {
    __traces[__traces.length - 1].duration = now - __traceStart;
  }
  __traceStart = now;
  __traces.push({ line: line, column: col, timestamp: now, variables: vars });
};
```

### 변수 캡처 전략
- `varNames`와 `varValues`를 분리하여 전달 → eval 없이 변수값 캡처
- 계측 시점에 스코프 내 변수명을 정적으로 분석하여 `varNames` 배열 생성
- 실행 시점에 해당 변수들의 값을 `varValues` 배열로 전달

**계측 예시:**
```javascript
// 원본 코드
var name = "홍길동";
var age = 30;
console.log(name, age);

// 계측 후
__trace(1, 0, [], []);
var name = "홍길동";
__trace(2, 0, ["name"], [name]);
var age = 30;
__trace(3, 0, ["name", "age"], [name, age]);
console.log(name, age);
```

- 각 Statement 실행 **직전**에 `__trace`를 삽입
- VariableDeclaration **이후**에는 새로 선언된 변수를 포함한 추가 `__trace` 삽입
- 이렇게 하면 변수 선언 직후의 값을 캡처할 수 있음

---

## 3. CodeInstrumenter 클래스 설계

### 파일 위치
`packages/server/src/services/CodeInstrumenter.ts`

### 인터페이스

```typescript
export interface InstrumentResult {
  instrumentedCode: string;
  sourceLineCount: number;
  success: boolean;
  error?: string;
}

export class CodeInstrumenter {
  /**
   * 사용자 코드를 계측하여 __trace() 호출을 삽입한다.
   * 파싱 실패 시 원본 코드를 그대로 반환한다.
   */
  instrument(code: string): InstrumentResult;
}
```

### AST 순회 및 계측 로직

#### 3.1 파싱
```typescript
import * as acorn from 'acorn';

const ast = acorn.parse(code, {
  ecmaVersion: 2020,
  sourceType: 'script',
  locations: true,  // 줄/컬럼 정보 포함
});
```

- `locations: true`로 각 노드의 `loc.start.line`, `loc.start.column` 정보를 포함

#### 3.2 스코프 변수 추적

AST를 순회하면서 각 스코프에서 선언된 변수를 추적한다:

```typescript
interface ScopeInfo {
  variables: string[];  // 이 스코프에서 선언된 변수명
  parent?: ScopeInfo;   // 부모 스코프
}
```

변수 선언을 수집하는 노드 타입:
- `VariableDeclaration` → `var`, `let`, `const` 선언자의 id.name
- `FunctionDeclaration` → 함수 이름
- 함수 매개변수 → `params[].name`

현재 스코프에서 접근 가능한 모든 변수를 반환:
```typescript
function getVisibleVariables(scope: ScopeInfo): string[] {
  const vars: string[] = [];
  let current: ScopeInfo | undefined = scope;
  while (current) {
    vars.push(...current.variables);
    current = current.parent;
  }
  return [...new Set(vars)];  // 중복 제거
}
```

#### 3.3 Statement 계측 대상

다음 Statement 타입에 `__trace()` 호출을 삽입한다:

| AST 노드 타입 | 삽입 위치 |
|--------------|---------|
| `ExpressionStatement` | 직전 |
| `VariableDeclaration` | 직전 + 직후 (변수값 캡처) |
| `ReturnStatement` | 직전 |
| `IfStatement` | 직전 |
| `ForStatement` | 루프 본문 시작 |
| `WhileStatement` | 루프 본문 시작 |
| `ForInStatement` | 루프 본문 시작 |
| `ForOfStatement` | 루프 본문 시작 |
| `SwitchStatement` | 직전 |
| `ThrowStatement` | 직전 |
| `TryStatement` | try 블록 시작 |

#### 3.4 __trace 노드 생성

계측할 `__trace()` 호출을 ESTree `ExpressionStatement` 노드로 생성:

```typescript
function createTraceNode(
  line: number,
  column: number,
  variables: string[],
): estree.ExpressionStatement {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: '__trace' },
      arguments: [
        { type: 'Literal', value: line },
        { type: 'Literal', value: column },
        {
          type: 'ArrayExpression',
          elements: variables.map(v => ({ type: 'Literal', value: v })),
        },
        {
          type: 'ArrayExpression',
          elements: variables.map(v => ({ type: 'Identifier', name: v })),
        },
      ],
      optional: false,
    },
  };
}
```

#### 3.5 코드 생성

```typescript
import { generate } from 'astring';

const instrumentedCode = generate(modifiedAst);
```

#### 3.6 에러 안전 처리

```typescript
instrument(code: string): InstrumentResult {
  const lineCount = code.split('\n').length;

  if (!code.trim()) {
    return { instrumentedCode: code, sourceLineCount: lineCount, success: true };
  }

  try {
    const ast = acorn.parse(code, { ... });
    // ... AST 변환 ...
    const instrumentedCode = generate(modifiedAst);
    return { instrumentedCode, sourceLineCount: lineCount, success: true };
  } catch (err) {
    // 파싱 실패 시 원본 코드 그대로 반환 (계측 없이 실행)
    return {
      instrumentedCode: code,
      sourceLineCount: lineCount,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

#### 3.7 루프 안전장치

무한 루프 방지를 위해 루프 내부의 `__trace` 호출 횟수에 상한을 둔다:

```javascript
var __traceCount = 0;
var __TRACE_LIMIT = 10000;
var __trace = function(line, col, varNames, varValues) {
  __traceCount++;
  if (__traceCount > __TRACE_LIMIT) {
    throw new Error('Trace limit exceeded (possible infinite loop)');
  }
  // ... 기존 로직 ...
};
```

---

## 4. TraceEntry 타입 설계

### 파일: `packages/common/src/types/protocol.ts`

```typescript
export interface TraceEntry {
  line: number;           // 원본 코드 줄 번호 (1-based)
  column: number;         // 원본 코드 컬럼 (0-based)
  timestamp: number;      // 실행 시점 (Date.now())
  variables: Record<string, string>;  // 변수명 → 문자열화된 값
  duration?: number;      // 이전 trace부터 이 trace까지 소요 시간 (ms)
}
```

### EventResponse 확장

```typescript
export interface EventResponse {
  success: boolean;
  patches: UIPatch[];
  error?: string;
  logs?: DebugLog[];
  errorLine?: number;
  traces?: TraceEntry[];     // ← 추가
}
```

### index.ts export 추가

```typescript
export type { TraceEntry } from './types/protocol';
```

---

## 5. SandboxRunner 통합

### 파일: `packages/server/src/services/SandboxRunner.ts`

### 5.1 SandboxOptions 확장

```typescript
export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;    // ← 추가
}
```

### 5.2 SandboxResult 확장

```typescript
export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorLine?: number;
  traces?: TraceEntry[];  // ← 추가
}
```

### 5.3 runCode() 수정

```typescript
async runCode(
  code: string,
  context: Record<string, unknown>,
  options?: SandboxOptions,
): Promise<SandboxResult> {
  const debugMode = options?.debugMode ?? false;

  let codeToRun = code;
  if (debugMode) {
    const instrumenter = new CodeInstrumenter();
    const result = instrumenter.instrument(code);
    codeToRun = result.instrumentedCode;
  }

  const wrappedCode = this.wrapHandlerCode(codeToRun, { debugMode });
  // ... isolate 생성, 실행 ...

  // 결과 처리
  if (debugMode) {
    const rv = result.value as Record<string, unknown>;
    const traces = rv?.__traces as TraceEntry[] | undefined;
    // 마지막 trace의 duration 계산
    return { success: true, value: result.value, traces };
  }
  return { success: true, value: result.value };
}
```

### 5.4 wrapHandlerCode() 수정

```typescript
private wrapHandlerCode(code: string, opts?: { debugMode?: boolean }): string {
  const debugPreamble = opts?.debugMode ? `
    var __traces = [];
    var __traceStart = null;
    var __traceCount = 0;
    var __TRACE_LIMIT = 10000;
    var __trace = function(line, col, varNames, varValues) {
      __traceCount++;
      if (__traceCount > __TRACE_LIMIT) {
        throw new Error('Trace limit exceeded (possible infinite loop)');
      }
      var now = Date.now();
      var vars = {};
      for (var i = 0; i < varNames.length; i++) {
        try { vars[varNames[i]] = __stringify(varValues[i]); }
        catch(e) { vars[varNames[i]] = '<error>'; }
      }
      if (__traces.length > 0 && __traceStart !== null) {
        __traces[__traces.length - 1].duration = now - __traceStart;
      }
      __traceStart = now;
      __traces.push({ line: line, column: col, timestamp: now, variables: vars });
    };
  ` : '';

  const traceReturn = opts?.debugMode ? ', traces: __traces' : '';

  return `
    (function(ctx) {
      var __messages = [];
      var __logs = [];
      var __stringify = function(val) { ... };
      var console = { ... };
      ${debugPreamble}
      ctx.showMessage = ...;
      ctx.http = ...;
      var sender = ctx.sender;
      (function() {
        ${code}
      })();
      return { controls: ctx.controls, messages: __messages, logs: __logs${traceReturn} };
    })(__ctx__)
  `;
}
```

### 5.5 에러 시 trace 수집

에러 발생 시에도 에러 전까지 수집된 traces를 반환해야 한다. Phase 1의 try/catch 패턴과 동일하게 적용:

```javascript
try {
  (function() { /* 사용자 코드 */ })();
} catch(e) {
  // 마지막 trace의 duration 계산
  if (__traces.length > 0 && __traceStart !== null) {
    __traces[__traces.length - 1].duration = Date.now() - __traceStart;
  }
  return { controls: ctx.controls, messages: __messages, logs: __logs,
           traces: __traces, __error: e.message, __stack: e.stack };
}
```

> **참고**: 현재 SandboxRunner는 에러를 isolated-vm 레벨에서 catch하고 있으며, 래퍼 내부 try/catch는 없다. Phase 2에서는 debugMode일 때만 래퍼 내부 try/catch를 추가하여 에러 전까지의 traces를 보존한다. debugMode=false일 때는 기존 동작을 유지한다.

---

## 6. Debug API 확장

### 파일: `packages/server/src/routes/debug.ts`

### 요청 확장
```typescript
const { code, formState, controlId, debugMode } = req.body as {
  code: string;
  formState: Record<string, Record<string, unknown>>;
  controlId?: string;
  debugMode?: boolean;  // ← 추가 (기본값: true)
};
```

### SandboxRunner 호출
```typescript
const result = await sandboxRunner.runCode(code, ctx, {
  timeout: env.SANDBOX_TIMEOUT_MS,
  memoryLimit: env.SANDBOX_MEMORY_LIMIT_MB,
  debugMode: debugMode !== false,  // 기본적으로 활성화
});
```

### 응답 확장
```typescript
// 성공 시
res.json({
  success: true,
  logs,
  controlChanges,
  traces: result.traces,        // ← 추가
  executionTime,                // ← 전체 실행 시간
});

// 실패 시 (에러 전까지의 traces 포함)
res.json({
  success: false,
  logs: [],
  error: result.error,
  errorLine: result.errorLine,
  traces: result.traces,        // ← 에러 전까지의 traces
});
```

---

## 7. Monaco Editor 시각화

### 파일: `packages/designer/src/components/EventEditor/EventEditor.tsx`

### 7.1 인라인 변수값 표시

디버그 실행 후 traces를 받아 각 줄 끝에 변수값을 인라인 텍스트로 표시한다.

```
1  var name = "홍길동";           // name = "홍길동"
2  var age = 30;                 // age = 30
3  console.log(name, age);       // name = "홍길동", age = 30
4  if (age > 20) {               // age = 30
5    name = "성인: " + name;     // name = "성인: 홍길동"
6  }
```

**구현 방식: `afterContentClassName` + CSS `::after`**

각 줄에 대해 Monaco `IModelDecorationOptions`를 설정:

```typescript
interface TraceDecoration {
  range: monaco.IRange;
  options: {
    afterContentClassName: string;  // CSS 클래스
    after: {
      content: string;              // 변수값 텍스트
      inlineClassName: string;      // 인라인 CSS 클래스
    };
  };
}
```

**CSS 스타일:**
```css
.debug-inline-value {
  color: #888;
  font-style: italic;
  margin-left: 24px;
  opacity: 0.8;
}
```

**동적 CSS 주입:** traces의 각 줄에 대해 고유 CSS 클래스를 생성하고 `::after` content로 변수값을 표시한다. Monaco의 `IModelDecorationOptions.after` 객체를 사용:

```typescript
function createTraceDecorations(
  traces: TraceEntry[],
  monaco: MonacoInstance,
): monaco.editor.IModelDeltaDecoration[] {
  // 줄 번호별로 마지막 trace를 선택 (같은 줄이 여러 번 실행된 경우)
  const lineTraces = new Map<number, TraceEntry>();
  for (const t of traces) {
    lineTraces.set(t.line, t);  // 마지막 실행의 변수값 사용
  }

  const decorations: monaco.editor.IModelDeltaDecoration[] = [];

  for (const [line, trace] of lineTraces) {
    const varEntries = Object.entries(trace.variables);
    if (varEntries.length === 0) continue;

    const text = varEntries
      .map(([k, v]) => `${k} = ${v}`)
      .join(', ');

    decorations.push({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        after: {
          content: `  // ${text}`,
          inlineClassName: 'debug-inline-value',
        },
      },
    });
  }

  return decorations;
}
```

### 7.2 실행 흐름 시각화

| 줄 상태 | glyph margin | 줄 배경 |
|---------|-------------|---------|
| 실행됨 | 녹색 점 | 없음 (기본) |
| 미실행 | 없음 | 반투명 회색 배경 |
| 에러 줄 | 빨간 점 | 빨간 배경 (Phase 1 기존) |
| 느린 줄 (≥100ms) | 주황 점 | 없음 |

**미실행 줄 판별:**
- 코드의 총 줄 수에서 traces에 등장한 줄 번호를 제외
- 주석/빈 줄은 미실행 처리하지 않음 (AST 파싱 결과로 판별)

```css
.debug-executed-glyph {
  background-color: #4caf50;
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin-left: 4px;
  margin-top: 6px;
}
.debug-unexecuted-line {
  background-color: rgba(128, 128, 128, 0.1);
}
.debug-slow-glyph {
  background-color: #ff9800;
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin-left: 4px;
  margin-top: 6px;
}
```

### 7.3 실행 요약

디버그 콘솔 상단에 실행 요약 정보를 표시:

```
━━ Execution Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5/8 lines executed | 234ms total | 3 variables tracked
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```typescript
interface ExecutionSummary {
  executedLines: number;
  totalLines: number;
  totalTime: number;       // ms
  trackedVariables: number;
}
```

### 7.4 데코레이션 생명주기

1. **Run 클릭 시**: 이전 데코레이션 제거 → 코드 실행 → 새 데코레이션 설정
2. **코드 편집 시**: `editor.onDidChangeModelContent`로 데코레이션 자동 제거
3. **Clear Debug 버튼**: 모든 디버그 데코레이션 수동 제거

### 7.5 상태 관리 추가

```typescript
const [traces, setTraces] = useState<TraceEntry[]>([]);
const traceDecorationIds = useRef<string[]>([]);
```

### 7.6 runCode() 수정

```typescript
const runCode = useCallback(async () => {
  // ...
  const res = await fetch('/api/debug/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, formState: {}, debugMode: true }),
  });
  const data = await res.json();

  if (data.traces) {
    setTraces(data.traces);
    applyTraceDecorations(data.traces);
  }
  // ...
}, [...]);
```

---

## 8. 변수 감시 패널

### 파일: `packages/designer/src/components/EventEditor/EventEditor.tsx`

### 8.1 디버그 영역 탭 구조

기존 `DebugConsole`을 탭 기반으로 확장:

```
┌──────────────────────────────────────────────────┐
│ Header                                           │
├──────────────────────────────────────────────────┤
│                Monaco Editor (70%)               │
├──────────────────────────────────────────────────┤
│ [Console] [Variables]                 [Clear]    │
├──────────────────────────────────────────────────┤
│ Console 탭:                                      │
│  12:34:56 [log] Hello, world!                    │
│  12:34:56 [log] name = 홍길동                     │
│──────────────────────────────────────────────────│
│ Variables 탭:                                    │
│  Line │ Variable │ Value        │ Type           │
│  ─────┼──────────┼──────────────┼────────────────│
│   1   │ name     │ "홍길동"      │ string         │
│   2   │ age      │ 30           │ number         │
│   3   │ name     │ "성인: 홍길동" │ string  ← 변경 │
├──────────────────────────────────────────────────┤
│ Status Bar                                       │
└──────────────────────────────────────────────────┘
```

### 8.2 Variables 패널 컴포넌트

```typescript
function VariablesPanel({ traces }: { traces: TraceEntry[] }) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  // traces를 줄 번호별로 그룹화
  const lineGroups = useMemo(() => {
    const groups = new Map<number, TraceEntry>();
    for (const t of traces) {
      groups.set(t.line, t);
    }
    return groups;
  }, [traces]);

  // 선택된 줄의 변수 목록
  const currentVars = selectedLine ? lineGroups.get(selectedLine)?.variables ?? {} : {};

  // 이전 줄의 변수와 비교하여 변경 감지
  const prevVars = useMemo(() => { ... }, [selectedLine, traces]);

  return (
    <div style={{ display: 'flex', flex: 1 }}>
      {/* 줄 번호 목록 */}
      <div style={{ width: 80, overflowY: 'auto', borderRight: '1px solid #555' }}>
        {[...lineGroups.keys()].sort((a, b) => a - b).map(line => (
          <div
            key={line}
            onClick={() => setSelectedLine(line)}
            style={{
              padding: '2px 8px',
              backgroundColor: selectedLine === line ? '#094771' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Line {line}
          </div>
        ))}
      </div>

      {/* 변수 테이블 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody>
            {Object.entries(currentVars).map(([name, value]) => (
              <tr
                key={name}
                style={{
                  backgroundColor: prevVars[name] !== value ? '#3d3418' : 'transparent',
                }}
              >
                <td>{name}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 8.3 줄 클릭 연동

Variables 패널에서 줄을 클릭하면 Monaco 에디터에서 해당 줄로 커서를 이동:

```typescript
const handleLineClick = (line: number) => {
  setSelectedLine(line);
  const editor = editorRef.current;
  if (editor) {
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  }
};
```

### 8.4 탭 상태

```typescript
const [activeTab, setActiveTab] = useState<'console' | 'variables'>('console');
```

---

## 파일 변경 요약

| 파일 | 유형 | 변경 내용 |
|------|------|-----------|
| `packages/server/package.json` | 수정 | acorn, astring 의존성 추가 |
| `packages/server/src/services/CodeInstrumenter.ts` | **신규** | AST 기반 코드 계측 서비스 |
| `packages/common/src/types/protocol.ts` | 수정 | `TraceEntry` 인터페이스, `EventResponse`에 `traces?` 추가 |
| `packages/common/src/index.ts` | 수정 | `TraceEntry` export 추가 |
| `packages/server/src/services/SandboxRunner.ts` | 수정 | `debugMode` 옵션, `__trace` 주입, `SandboxResult.traces` |
| `packages/server/src/routes/debug.ts` | 수정 | `debugMode` 파라미터, 응답에 `traces` 포함 |
| `packages/designer/src/components/EventEditor/EventEditor.tsx` | 수정 | 인라인 변수값, 실행 흐름 시각화, Variables 탭 패널 |
| `packages/server/src/__tests__/CodeInstrumenter.test.ts` | **신규** | CodeInstrumenter 단위 테스트 |
| `packages/server/src/__tests__/SandboxRunner.trace.test.ts` | **신규** | 계측 모드 통합 테스트 |

---

## 구현 순서 (의존성 기반)

```
1. debugger-phase2-plan         ← 현재 (이 문서)
   ↓
2. debugger-trace-protocol      (TraceEntry 타입 추가)
   ↓
3. debugger-instrumenter        (CodeInstrumenter 서비스)
   ↓
4. debugger-sandbox-trace       (SandboxRunner debugMode 통합)
   ↓
5. debugger-debug-api-trace     (Debug API traces 반환)
   ↓
6. debugger-inline-values       (Monaco 인라인 변수값 + 실행 흐름)
   ↓
7. debugger-variable-panel      (Variables 탭 패널)
   ↓
8. debugger-phase2-test         (테스트 작성 및 실행)
   ↓
9. debugger-phase2-commit       (커밋)
```

2, 3은 독립적으로 병렬 진행 가능.
6, 7은 5 완료 후 병렬 진행 가능.
8은 3, 4, 5 완료 후 진행.

---

## 테스트 계획

### CodeInstrumenter.test.ts

```
- 기본 변수 선언 코드 계측
  → var x = 1; → __trace(1,0,[],[]) + var x = 1; + __trace(1,0,["x"],[x])

- if/else 분기문 계측
  → if 블록, else 블록 각각에 __trace 삽입 확인

- for/while 루프 계측
  → 루프 본문에 __trace 삽입 확인

- 중첩 스코프 변수 추적
  → 내부 스코프에서 외부 변수도 캡처

- 빈 코드 입력
  → 에러 없이 빈 결과 반환

- 파싱 불가능한 코드
  → success: false, 원본 코드 그대로 반환

- 복합 코드 (함수 선언 + 호출)
  → 함수 내부 statement도 계측
```

### SandboxRunner.trace.test.ts

```
- debugMode=true → traces 배열 반환 확인
- traces에 올바른 줄 번호 기록 확인
- traces에 변수값 캡처 확인 (문자열, 숫자, 객체)
- debugMode=false → traces 없음 (기존 동작 유지)
- 에러 발생 시 에러 전까지의 traces 반환
- 무한 루프 → TRACE_LIMIT 초과 에러
- 기존 console.log + traces 동시 동작
```

### 수동 테스트

1. EventEditor에서 변수 선언 코드 작성
2. F5 실행 → 인라인 변수값 표시 확인
3. Variables 탭에서 줄별 변수값 확인
4. 줄 클릭 → 에디터 커서 이동 확인
5. 에러 코드 실행 → 에러 전까지의 traces 확인
6. 실행 후 코드 편집 → 데코레이션 자동 제거 확인
