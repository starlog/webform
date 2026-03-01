# [Phase3] SandboxRunner 통합 계획 - SwaggerConnector

## 1. 현재 구조 분석

### 1.1 SandboxRunner.ts 분석 결과

#### MongoConnectorInfo 인터페이스 (9-16행)
```typescript
export interface MongoConnectorInfo {
  controlName: string;
  connectionString: string;
  database: string;
  defaultCollection: string;
  queryTimeout: number;
  maxResultCount: number;
}
```

#### SandboxOptions (18-27행)
```typescript
export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;
  mongoConnectors?: MongoConnectorInfo[];
  shellMode?: boolean;
  appState?: Record<string, unknown>;
  currentFormId?: string;
  params?: Record<string, unknown>;
}
```

#### runCode() 흐름 (38-119행)
1. TypeScript → JavaScript 트랜스파일
2. debugMode 시 CodeInstrumenter 적용
3. `wrapHandlerCode()` 호출 (mongoConnectors 전달)
4. isolate 생성 → context 생성
5. `blockDangerousGlobals()` → `injectContext()` 호출
6. script 컴파일 → 실행 → 결과 반환

#### injectContext() 패턴 (139-228행)
- `__ctx__`: ExternalCopy로 컨텍스트 객체 주입
- `__httpHandler`: `ivm.Reference(async (method, url, body?) => ...)` — `validateSandboxUrl()` 호출 후 `fetch()` 수행, `new ivm.ExternalCopy({ status, ok, data }).copyInto()` 반환
- `__mongoHandler`: `ivm.Reference(async (controlName, operation, collection, arg1?, arg2?) => ...)` — connectorMap에서 조회 후 MongoDB 작업 수행, `ivm.ExternalCopy` 반환

#### wrapHandlerCode() 메서드 주입 패턴 (237-476행)
- IIFE `(function(ctx) { ... })(__ctx__)` 구조
- mongoConnectors.map()으로 각 커넥터별 메서드 주입 코드 생성:
  ```javascript
  ctx.controls['name'] = ctx.controls['name'] || {};
  ctx.controls['name'].find = function(collection, filter) {
    return __mongoHandler.applySyncPromise(undefined, [...args]);
  };
  ```
- `applySyncPromise(undefined, [arg1, arg2, ...])` 패턴으로 async handler 동기 호출

### 1.2 EventEngine.ts 분석 결과

#### extractMongoConnectors() (302-322행)
- `controls` 배열을 재귀 순회 (`walk()` 함수)
- `ctrl.type === 'MongoDBConnector'` 조건으로 필터
- `ctrl.properties`에서 connectionString, database 등 추출
- `MongoConnectorInfo[]` 반환

#### executeEvent()에서 전달 방식 (54-114행)
```typescript
const mongoConnectors = this.extractMongoConnectors(formDef.controls);
const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
});
```

#### executeShellEvent()에서도 동일 패턴 (116-186행)
```typescript
const mongoConnectors = this.extractMongoConnectors(shellDef.controls);
const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
  shellMode: true,
  appState: appStateCopy,
  currentFormId: payload.currentFormId,
});
```

### 1.3 SwaggerParser.ts 참조 (이미 구현됨)
```typescript
export interface SwaggerOperation {
  operationId: string;   // 'listPets', 'getPetById'
  method: string;         // 'GET', 'POST', ...
  path: string;           // '/pets/{petId}'
  pathParams: string[];   // ['petId']
  queryParams: string[];  // ['limit', 'offset']
  hasRequestBody: boolean;
  summary?: string;
}
```

---

## 2. SandboxRunner.ts 수정 계획

### 2.1 SwaggerConnectorInfo 인터페이스 추가

**위치**: `MongoConnectorInfo` 인터페이스 아래 (16행 이후)

```typescript
export interface SwaggerConnectorInfo {
  controlName: string;
  operations: SwaggerOperation[];  // SwaggerParser에서 import
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  timeout: number;
}
```

**필요한 import 추가**:
```typescript
import type { SwaggerOperation } from './SwaggerParser.js';
```

### 2.2 SandboxOptions 수정

**위치**: SandboxOptions 인터페이스 내 `mongoConnectors` 아래 (23행 이후)

```typescript
swaggerConnectors?: SwaggerConnectorInfo[];
```

### 2.3 runCode()에서 swaggerConnectors 추출

**위치**: `const mongoConnectors = ...` 아래 (46행 이후)

```typescript
const swaggerConnectors = options?.swaggerConnectors ?? [];
```

### 2.4 wrapHandlerCode() 시그니처 확장

**현재 시그니처** (237-244행):
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

**수정 후**:
```typescript
private wrapHandlerCode(
  code: string,
  debugMode?: boolean,
  mongoConnectors: MongoConnectorInfo[] = [],
  swaggerConnectors: SwaggerConnectorInfo[] = [],
  shellMode?: boolean,
  currentFormId?: string,
  params?: Record<string, unknown>,
): string
```

### 2.5 runCode()에서 wrapHandlerCode 호출 수정

**현재** (72-79행):
```typescript
const wrappedCode = this.wrapHandlerCode(
  codeToRun, debugMode, mongoConnectors,
  shellMode, options?.currentFormId, options?.params,
);
```

**수정 후**:
```typescript
const wrappedCode = this.wrapHandlerCode(
  codeToRun, debugMode, mongoConnectors, swaggerConnectors,
  shellMode, options?.currentFormId, options?.params,
);
```

### 2.6 injectContext() 시그니처 확장

**현재** (139-143행):
```typescript
private async injectContext(
  jail: ivm.Reference<Record<string, unknown>>,
  context: Record<string, unknown>,
  mongoConnectors: MongoConnectorInfo[] = [],
): Promise<void>
```

**수정 후**:
```typescript
private async injectContext(
  jail: ivm.Reference<Record<string, unknown>>,
  context: Record<string, unknown>,
  mongoConnectors: MongoConnectorInfo[] = [],
  swaggerConnectors: SwaggerConnectorInfo[] = [],
): Promise<void>
```

### 2.7 injectContext()에서 __swaggerHandler 주입

**위치**: `__mongoHandler` 주입 블록 아래 (227행 이후)

```typescript
if (swaggerConnectors.length > 0) {
  const connectorMap = new Map<string, SwaggerConnectorInfo>();
  for (const sc of swaggerConnectors) {
    connectorMap.set(sc.controlName, sc);
  }

  const swaggerHandler = new ivm.Reference(
    async (controlName: string, operationId: string, optionsJson: string) => {
      const info = connectorMap.get(controlName);
      if (!info) {
        throw new Error(`SwaggerConnector "${controlName}" not found`);
      }

      const op = info.operations.find((o) => o.operationId === operationId);
      if (!op) {
        throw new Error(`SwaggerConnector "${controlName}": operation "${operationId}" not found`);
      }

      const opts = JSON.parse(optionsJson) as {
        path?: Record<string, unknown>;
        query?: Record<string, unknown>;
        body?: unknown;
        headers?: Record<string, string>;
      };

      // URL 구성: path 파라미터 치환
      let resolvedPath = op.path;
      if (opts.path) {
        for (const [key, val] of Object.entries(opts.path)) {
          resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(val)));
        }
      }

      // query string 추가
      let queryString = '';
      if (opts.query) {
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(opts.query)) {
          if (val !== undefined && val !== null) {
            params.append(key, String(val));
          }
        }
        const qs = params.toString();
        if (qs) queryString = '?' + qs;
      }

      const url = info.baseUrl + resolvedPath + queryString;

      // SSRF 방어
      await validateSandboxUrl(url);

      // headers 병합: defaultHeaders + extraHeaders + Content-Type
      const headers: Record<string, string> = { ...info.defaultHeaders };
      if (opts.headers) {
        Object.assign(headers, opts.headers);
      }
      if (opts.body && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }

      // HTTP 요청 수행
      const res = await fetch(url, {
        method: op.method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(info.timeout),
      });

      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }

      return new ivm.ExternalCopy({ status: res.status, ok: res.ok, data }).copyInto();
    },
  );
  await jail.set('__swaggerHandler', swaggerHandler);
}
```

### 2.8 injectContext() 호출 수정

**현재** (86행):
```typescript
await this.injectContext(jail, context, mongoConnectors);
```

**수정 후**:
```typescript
await this.injectContext(jail, context, mongoConnectors, swaggerConnectors);
```

### 2.9 wrapHandlerCode()에 operation 메서드 주입 코드 추가

**위치**: mongoConnectors.map() 블록 아래 (441행 이후, `ctx.getRadioGroupValue` 이전)

```typescript
${(swaggerConnectors || []).map((sc) => `
        ctx.controls['${sc.controlName}'] = ctx.controls['${sc.controlName}'] || {};
${sc.operations.map((op) => `        ctx.controls['${sc.controlName}']['${op.operationId}'] = function(opts) {
          return __swaggerHandler.applySyncPromise(undefined, [
            '${sc.controlName}',
            '${op.operationId}',
            JSON.stringify(opts || {})
          ]);
        };`).join('\n')}
`).join('')}
```

**생성되는 사용자 코드 예시**:
```javascript
// 사용자가 이벤트 핸들러에서 사용하는 방식:
const result = ctx.controls.petApi.listPets({ query: { limit: 10 } });
// → { status: 200, ok: true, data: [...] }

const pet = ctx.controls.petApi.getPetById({ path: { petId: 123 } });
// → { status: 200, ok: true, data: { id: 123, name: 'Fido' } }

const created = ctx.controls.petApi.createPet({
  body: { name: 'Rex', type: 'dog' },
  headers: { 'X-Custom': 'value' }
});
```

---

## 3. EventEngine.ts 수정 계획

### 3.1 import 추가

**위치**: 기존 import 블록 (11-13행 이후)

```typescript
import { parseSwaggerSpec } from './SwaggerParser.js';
import type { SwaggerConnectorInfo } from './SandboxRunner.js';
```

### 3.2 extractSwaggerConnectors() private 메서드 추가

**위치**: `extractMongoConnectors()` 메서드 아래 (322행 이후)

```typescript
private extractSwaggerConnectors(controls: ControlDefinition[]): SwaggerConnectorInfo[] {
  const connectors: SwaggerConnectorInfo[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      if (ctrl.type === 'SwaggerConnector') {
        const specYaml = (ctrl.properties.specYaml as string) || '';
        if (!specYaml) {
          // specYaml 미설정 시 건너뜀
          if (ctrl.children) walk(ctrl.children);
          continue;
        }

        let parsed;
        try {
          parsed = parseSwaggerSpec(specYaml);
        } catch (err) {
          console.warn(
            `[EventEngine] SwaggerConnector "${ctrl.name}" specYaml 파싱 실패:`,
            (err as Error).message,
          );
          if (ctrl.children) walk(ctrl.children);
          continue;
        }

        // baseUrl 오버라이드: ctrl.properties.baseUrl이 있으면 우선 사용
        const baseUrl = (ctrl.properties.baseUrl as string) || parsed.baseUrl;

        // defaultHeaders 파싱
        let defaultHeaders: Record<string, string> = {};
        const headersStr = (ctrl.properties.defaultHeaders as string) || '{}';
        try {
          defaultHeaders = JSON.parse(headersStr);
        } catch {
          // JSON 파싱 실패 시 빈 객체
        }

        const timeout = (ctrl.properties.timeout as number) || 10000;

        connectors.push({
          controlName: ctrl.name,
          operations: parsed.operations,
          baseUrl,
          defaultHeaders,
          timeout,
        });
      }
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);
  return connectors;
}
```

### 3.3 executeEvent() 수정

**현재** (89-94행):
```typescript
const mongoConnectors = this.extractMongoConnectors(formDef.controls);

const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
});
```

**수정 후**:
```typescript
const mongoConnectors = this.extractMongoConnectors(formDef.controls);
const swaggerConnectors = this.extractSwaggerConnectors(formDef.controls);

const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
  swaggerConnectors,
});
```

### 3.4 executeShellEvent() 수정

**현재** (158-166행):
```typescript
const mongoConnectors = this.extractMongoConnectors(shellDef.controls);

const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
  shellMode: true,
  appState: appStateCopy,
  currentFormId: payload.currentFormId,
});
```

**수정 후**:
```typescript
const mongoConnectors = this.extractMongoConnectors(shellDef.controls);
const swaggerConnectors = this.extractSwaggerConnectors(shellDef.controls);

const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
  swaggerConnectors,
  shellMode: true,
  appState: appStateCopy,
  currentFormId: payload.currentFormId,
});
```

---

## 4. 변경 영향 분석

### 변경 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `SandboxRunner.ts` | 수정 | SwaggerConnectorInfo 추가, injectContext/wrapHandlerCode 확장 |
| `EventEngine.ts` | 수정 | extractSwaggerConnectors 추가, executeEvent/executeShellEvent 수정 |

### 기존 기능 영향
- MongoDBConnector: **변경 없음** — 기존 코드에 추가 코드만 붙임
- ctx.http: **변경 없음** — 독립적인 HTTP 헬퍼로 그대로 유지
- 디버그 모드: **영향 없음** — wrapHandlerCode의 trace/debug 로직 미변경

### 보안 고려사항
- `validateSandboxUrl()` 호출로 SSRF 방어
- `AbortSignal.timeout(info.timeout)`으로 타임아웃 적용
- JSON.stringify/parse 경계에서 데이터 직렬화

### 에러 처리 전략
- specYaml 파싱 실패 → `console.warn` 후 해당 커넥터만 건너뜀 (전체 이벤트 실행 중단하지 않음)
- operation 미발견 → Error throw (사용자 코드 버그)
- HTTP 에러 응답(4xx, 5xx) → throw하지 않고 `{ status, ok: false, data }` 반환

---

## 5. 사용자 코드 API 요약

SwaggerConnector가 설정된 경우, 사용자는 이벤트 핸들러에서 다음과 같이 사용:

```typescript
// GET 요청 (query 파라미터)
const result = ctx.controls.petApi.listPets({ query: { limit: 10 } });
// → { status: 200, ok: true, data: [...] }

// GET 요청 (path 파라미터)
const pet = ctx.controls.petApi.getPetById({ path: { petId: 123 } });
// → { status: 200, ok: true, data: { id: 123, name: 'Fido' } }

// POST 요청 (body + 커스텀 headers)
const created = ctx.controls.petApi.createPet({
  body: { name: 'Rex', type: 'dog' },
  headers: { 'X-Custom': 'value' },
});

// PUT 요청 (path + body)
ctx.controls.petApi.updatePet({
  path: { petId: 123 },
  body: { name: 'Rex Updated' },
});

// DELETE 요청
ctx.controls.petApi.deletePet({ path: { petId: 123 } });
```

각 메서드의 opts 파라미터 구조:
```typescript
{
  path?: Record<string, unknown>;     // path 파라미터 값
  query?: Record<string, unknown>;    // query string 파라미터
  body?: unknown;                     // request body (JSON)
  headers?: Record<string, string>;   // 추가 HTTP 헤더
}
```
