# Feature: SwaggerConnector (비-UI 커넥터 컨트롤)

## 개요

Swagger/OpenAPI 스펙 파일(YAML)을 수신하여 해당 서버의 REST 클라이언트를 자동 생성하는 비-UI 컨트롤.
MongoDBConnector와 동일한 패턴으로 구현하며, 이벤트 핸들러에서 `ctx.controls.{elementName}.{operationId}(...)` 형태로 사용한다.

---

## 1. 사용자 경험 (UX)

### 1.1 Designer에서의 사용

1. 툴박스에서 SwaggerConnector를 폼에 드래그
2. PropertyPanel에서 속성 설정:
   - **specYaml**: Monaco Editor로 OpenAPI YAML 붙여넣기 (커스텀 에디터)
   - **baseUrl**: 서버 주소 오버라이드 (스펙의 servers[0].url 대신 사용)
   - **defaultHeaders**: 공통 헤더 (JSON, 예: `{"Authorization": "Bearer xxx"}`)
   - **timeout**: 요청 타임아웃 (ms, 기본 10000)
3. 폼 캔버스에 점선 테두리의 비시각적 인디케이터 표시 (API 정보 요약)

### 1.2 이벤트 핸들러에서의 사용

```typescript
// operationId 기반 호출
const pets = await ctx.controls.petApi.listPets({ query: { limit: 10 } });
const pet = await ctx.controls.petApi.getPetById({ path: { petId: 123 } });
const created = await ctx.controls.petApi.createPet({ body: { name: 'Buddy', tag: 'dog' } });
const updated = await ctx.controls.petApi.updatePet({
  path: { petId: 123 },
  body: { name: 'Buddy Jr' }
});
await ctx.controls.petApi.deletePet({ path: { petId: 123 } });

// 결과를 DataGridView에 바인딩
ctx.controls.gridPets.dataSource = pets.data;

// 에러 처리
const result = await ctx.controls.petApi.getPetById({ path: { petId: 999 } });
if (!result.ok) {
  ctx.showMessage('펫을 찾을 수 없습니다: ' + result.status, '오류', 'error');
}
```

### 1.3 메서드 호출 규약

```typescript
ctx.controls.{connectorName}.{operationId}(options?)

// options 구조:
{
  path?: Record<string, string | number>,   // URL 경로 파라미터 (/pets/{petId})
  query?: Record<string, unknown>,          // 쿼리스트링 파라미터
  body?: unknown,                           // 요청 본문 (POST/PUT/PATCH)
  headers?: Record<string, string>,         // 추가 헤더 (defaultHeaders와 병합)
}

// 반환값:
{
  status: number,    // HTTP 상태 코드
  ok: boolean,       // 200-299 여부
  data: unknown,     // 응답 본문 (JSON 파싱됨)
}
```

---

## 2. 아키텍처 설계

### 2.1 패키지별 변경 범위

```
packages/
├── common/
│   └── src/types/
│       ├── form.ts              # CONTROL_TYPES에 'SwaggerConnector' 추가
│       └── events.ts            # SwaggerConnector 이벤트 정의
├── server/
│   └── src/services/
│       ├── EventEngine.ts       # extractSwaggerConnectors() 추가
│       ├── SandboxRunner.ts     # Swagger 핸들러 주입 + 래퍼 코드 생성
│       └── SwaggerParser.ts     # [신규] YAML 파싱 + operationId 추출
├── designer/
│   └── src/
│       ├── controls/
│       │   ├── SwaggerConnectorControl.tsx  # [신규] 디자이너 표시 컴포넌트
│       │   └── registry.ts                 # 레지스트리 등록
│       └── components/PropertyPanel/
│           ├── controlProperties.ts         # PropertyMeta 정의
│           └── editors/
│               └── SwaggerSpecEditor.tsx     # [신규] YAML 편집 커스텀 에디터
├── runtime/
│   └── src/controls/
│       ├── SwaggerConnector.tsx  # [신규] return null (비-UI)
│       └── registry.ts          # 레지스트리 등록
└── mcp/
    └── src/utils/
        └── controlDefaults.ts   # 기본값 정의
```

### 2.2 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Designer                                                                │
│                                                                         │
│  1. 사용자가 SwaggerConnector 추가                                     │
│  2. PropertyPanel에서 specYaml(YAML 전문) 입력                         │
│  3. ControlDefinition.properties에 저장                                │
│     { specYaml: "openapi: 3.0...", baseUrl: "...", ... }               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ MongoDB 저장
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MongoDB (Form Document)                                                 │
│                                                                         │
│  controls: [{                                                           │
│    id: "ctrl-swagger-1",                                                │
│    type: "SwaggerConnector",                                            │
│    name: "petApi",                                                      │
│    properties: {                                                        │
│      specYaml: "openapi: '3.0.3'\ninfo:\n  title: Petstore...",        │
│      baseUrl: "https://api.example.com",                               │
│      defaultHeaders: '{"Authorization":"Bearer xxx"}',                  │
│      timeout: 10000                                                     │
│    }                                                                    │
│  }]                                                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ 이벤트 발생 시
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ EventEngine                                                             │
│                                                                         │
│  1. extractSwaggerConnectors(formDef.controls)                          │
│     → SwaggerConnectorInfo[] 반환                                       │
│  2. SwaggerParser.parse(specYaml)                                       │
│     → operationId 목록, 경로, 메서드, 파라미터 구조 추출                │
│  3. SandboxRunner.runCode(code, ctx, { swaggerConnectors })             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SandboxRunner (isolated-vm)                                             │
│                                                                         │
│  1. __swaggerHandler 주입 (ivm.Reference)                               │
│     → 호스트에서 실제 HTTP 요청 수행                                    │
│  2. wrapHandlerCode에서 각 operation마다 메서드 생성:                    │
│     ctx.controls['petApi'].listPets = function(opts) { ... }            │
│     ctx.controls['petApi'].getPetById = function(opts) { ... }          │
│  3. 사용자 코드 실행                                                    │
│     const pets = await ctx.controls.petApi.listPets({ query: {limit:10} })│
│  4. __swaggerHandler가 호스트에서 fetch 수행 → 결과 반환                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 상세 구현 계획

### 3.1 Phase 1: 타입 정의 및 공통 모듈

#### 3.1.1 `packages/common/src/types/form.ts`

```typescript
// CONTROL_TYPES 배열에 추가
export const CONTROL_TYPES = [
  // ... 기존 타입들 ...
  'SwaggerConnector',
] as const;
```

#### 3.1.2 `packages/common/src/types/events.ts`

```typescript
// CONTROL_EVENTS에 추가
SwaggerConnector: ['Connected', 'Error', 'RequestCompleted'],
```

---

### 3.2 Phase 2: SwaggerParser (서버)

#### 3.2.1 `packages/server/src/services/SwaggerParser.ts` [신규]

YAML 파싱하여 operationId와 엔드포인트 정보를 추출하는 순수 유틸리티.

```typescript
import yaml from 'js-yaml';

export interface SwaggerOperation {
  operationId: string;       // 메서드명으로 사용
  method: string;            // GET, POST, PUT, PATCH, DELETE
  path: string;              // /pets/{petId}
  pathParams: string[];      // ['petId']
  queryParams: string[];     // ['limit', 'offset']
  hasRequestBody: boolean;   // POST/PUT/PATCH에서 body 유무
  summary?: string;          // 설명 (디자이너 표시용)
}

export interface ParsedSwaggerSpec {
  title: string;
  version: string;
  baseUrl: string;           // servers[0].url
  operations: SwaggerOperation[];
}

export function parseSwaggerSpec(specYaml: string): ParsedSwaggerSpec;
```

**파싱 로직:**

1. `js-yaml`로 YAML → JSON 변환
2. OpenAPI 3.x와 Swagger 2.x 모두 지원
3. `paths` 순회:
   - 각 `path` + `method` 조합에서 `operationId` 추출
   - operationId 미지정 시 자동 생성: `method + path → camelCase`
     - `GET /pets/{petId}` → `getPetsPetId`
     - `POST /users` → `postUsers`
   - pathParams: `{param}` 패턴 추출
   - queryParams: `parameters[].in === 'query'` 추출
   - hasRequestBody: `requestBody` 존재 여부
4. `servers[0].url`에서 baseUrl 추출 (Swagger 2.x: `host` + `basePath`)
5. 중복 operationId 검출 시 경고 로그 + 숫자 접미사 (`listPets`, `listPets2`)

**operationId 자동 생성 규칙:**

```
METHOD + PATH → camelCase
GET    /pets              → getPets
GET    /pets/{petId}      → getPetById      (단수 감지 시)
POST   /pets              → createPet
PUT    /pets/{petId}      → updatePet
DELETE /pets/{petId}      → deletePet
PATCH  /pets/{petId}      → patchPet

// 기본 fallback (위 규칙 매칭 실패 시):
GET    /api/v2/users      → getApiV2Users
POST   /api/v2/users      → postApiV2Users
```

**의존성 추가:**

```bash
pnpm --filter @webform/server add js-yaml
pnpm --filter @webform/server add -D @types/js-yaml
```

---

### 3.3 Phase 3: SandboxRunner 통합

#### 3.3.1 SwaggerConnectorInfo 타입

```typescript
// SandboxRunner.ts에 추가
export interface SwaggerConnectorInfo {
  controlName: string;                    // 컨트롤 이름 (예: 'petApi')
  operations: SwaggerOperation[];         // 파싱된 operation 목록
  baseUrl: string;                        // 최종 baseUrl (오버라이드 반영)
  defaultHeaders: Record<string, string>; // 기본 헤더
  timeout: number;                        // 타임아웃 (ms)
}
```

#### 3.3.2 EventEngine.extractSwaggerConnectors()

MongoDBConnector의 `extractMongoConnectors()`와 동일한 패턴.

```typescript
private extractSwaggerConnectors(controls: ControlDefinition[]): SwaggerConnectorInfo[] {
  const connectors: SwaggerConnectorInfo[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      if (ctrl.type === 'SwaggerConnector') {
        const specYaml = (ctrl.properties.specYaml as string) || '';
        if (!specYaml) continue;  // 스펙 없으면 건너뜀

        const parsed = parseSwaggerSpec(specYaml);
        const baseUrlOverride = (ctrl.properties.baseUrl as string) || '';
        let headers: Record<string, string> = {};
        try {
          headers = JSON.parse((ctrl.properties.defaultHeaders as string) || '{}');
        } catch { /* ignore */ }

        connectors.push({
          controlName: ctrl.name,
          operations: parsed.operations,
          baseUrl: baseUrlOverride || parsed.baseUrl,
          defaultHeaders: headers,
          timeout: (ctrl.properties.timeout as number) || 10000,
        });
      }
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);
  return connectors;
}
```

**EventEngine.executeEvent() 수정:**

```typescript
// 기존 mongoConnectors 추출 아래에 추가
const swaggerConnectors = this.extractSwaggerConnectors(formDef.controls);

const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
  debugMode: options?.debugMode,
  mongoConnectors,
  swaggerConnectors,   // ← 추가
});
```

#### 3.3.3 SandboxRunner - __swaggerHandler 주입

MongoDBConnector의 `__mongoHandler`와 동일한 패턴.

```typescript
// injectContext()에 추가
if (swaggerConnectors.length > 0) {
  const connectorMap = new Map<string, SwaggerConnectorInfo>();
  for (const sc of swaggerConnectors) {
    connectorMap.set(sc.controlName, sc);
  }

  const swaggerHandler = new ivm.Reference(
    async (
      controlName: string,
      operationId: string,
      optionsJson: string,
    ) => {
      const info = connectorMap.get(controlName);
      if (!info) throw new Error(`SwaggerConnector "${controlName}" not found`);

      const op = info.operations.find(o => o.operationId === operationId);
      if (!op) throw new Error(`Operation "${operationId}" not found in "${controlName}"`);

      const opts = optionsJson ? JSON.parse(optionsJson) : {};
      const pathParams = opts.path || {};
      const queryParams = opts.query || {};
      const body = opts.body;
      const extraHeaders = opts.headers || {};

      // URL 구성
      let url = info.baseUrl + op.path;
      // Path 파라미터 치환: /pets/{petId} → /pets/123
      for (const [key, val] of Object.entries(pathParams)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(val)));
      }
      // Query 파라미터 추가
      const queryEntries = Object.entries(queryParams);
      if (queryEntries.length > 0) {
        const qs = queryEntries
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        url += '?' + qs;
      }

      // URL 보안 검증
      await validateSandboxUrl(url);

      // 헤더 병합
      const headers: Record<string, string> = {
        ...info.defaultHeaders,
        ...extraHeaders,
      };
      if (body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }

      // HTTP 요청 수행
      const res = await fetch(url, {
        method: op.method.toUpperCase(),
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(info.timeout),
      });

      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }

      return new ivm.ExternalCopy({
        status: res.status,
        ok: res.ok,
        data,
      }).copyInto();
    },
  );
  await jail.set('__swaggerHandler', swaggerHandler);
}
```

#### 3.3.4 SandboxRunner - wrapHandlerCode 메서드 주입

```typescript
// wrapHandlerCode()의 MongoDBConnector 코드 생성 아래에 추가
${swaggerConnectors.map((sc) => `
  ctx.controls['${sc.controlName}'] = ctx.controls['${sc.controlName}'] || {};
  ${sc.operations.map((op) => `
  ctx.controls['${sc.controlName}']['${op.operationId}'] = function(opts) {
    return __swaggerHandler.applySyncPromise(undefined, [
      '${sc.controlName}',
      '${op.operationId}',
      JSON.stringify(opts || {})
    ]);
  };`).join('')}
`).join('')}
```

**생성 결과 예시:**

```javascript
ctx.controls['petApi'] = ctx.controls['petApi'] || {};
ctx.controls['petApi']['listPets'] = function(opts) {
  return __swaggerHandler.applySyncPromise(undefined, [
    'petApi', 'listPets', JSON.stringify(opts || {})
  ]);
};
ctx.controls['petApi']['getPetById'] = function(opts) {
  return __swaggerHandler.applySyncPromise(undefined, [
    'petApi', 'getPetById', JSON.stringify(opts || {})
  ]);
};
ctx.controls['petApi']['createPet'] = function(opts) {
  return __swaggerHandler.applySyncPromise(undefined, [
    'petApi', 'createPet', JSON.stringify(opts || {})
  ]);
};
// ...
```

---

### 3.4 Phase 4: Designer UI

#### 3.4.1 `SwaggerConnectorControl.tsx` [신규]

```typescript
// MongoDBConnectorControl과 동일한 패턴
export function SwaggerConnectorControl({ properties, size }: DesignerControlProps) {
  const specYaml = (properties.specYaml as string) || '';
  const baseUrl = (properties.baseUrl as string) || '';
  const hasSpec = specYaml.length > 0;

  // 간단한 파싱으로 정보 추출 (디자이너용)
  let title = 'Swagger API';
  let endpointCount = 0;
  if (hasSpec) {
    // YAML에서 title과 paths 개수만 간이 추출
    const titleMatch = specYaml.match(/title:\s*['"]?([^'"\n]+)/);
    if (titleMatch) title = titleMatch[1].trim();
    endpointCount = (specYaml.match(/^\s+(get|post|put|patch|delete):/gm) || []).length;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      border: '1px dashed #d9d9d9',
      borderRadius: 4,
      backgroundColor: '#fafafa',
      width: size.width, height: size.height,
    }}>
      <span style={{ fontSize: 16 }}>🔗</span>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: '0.8em', color: '#999' }}>
          {hasSpec
            ? `${endpointCount} endpoints` + (baseUrl ? ` | ${baseUrl}` : '')
            : 'Not configured'}
        </div>
      </div>
    </div>
  );
}
```

#### 3.4.2 PropertyPanel 속성 정의 (`controlProperties.ts`)

```typescript
const swaggerConnectorProps: PropertyMeta[] = [
  {
    name: 'name',
    label: 'Name',
    category: 'Design',
    editorType: 'text',
  },
  {
    name: 'properties.specYaml',
    label: 'Swagger Spec (YAML)',
    category: 'Data',
    editorType: 'swaggerSpec',   // 커스텀 에디터
  },
  {
    name: 'properties.baseUrl',
    label: 'Base URL (Override)',
    category: 'Data',
    editorType: 'text',
    description: '미지정 시 스펙의 servers[0].url 사용',
  },
  {
    name: 'properties.defaultHeaders',
    label: 'Default Headers',
    category: 'Data',
    editorType: 'code',          // JSON 에디터
    description: 'JSON 형식: {"Authorization": "Bearer xxx"}',
  },
  {
    name: 'properties.timeout',
    label: 'Timeout (ms)',
    category: 'Behavior',
    editorType: 'number',
    min: 1000,
    max: 60000,
    defaultValue: 10000,
  },
];

CONTROL_PROPERTY_META['SwaggerConnector'] = swaggerConnectorProps;
```

#### 3.4.3 `SwaggerSpecEditor.tsx` [신규] - 커스텀 PropertyPanel 에디터

Monaco Editor 기반의 YAML 편집기:
- YAML 구문 강조
- 붙여넣기 시 자동 검증 (유효한 OpenAPI 스펙인지)
- 검증 결과 표시 (title, version, endpoint 수)
- 파일 Import 버튼 (로컬 .yaml/.yml 파일 로드)

---

### 3.5 Phase 5: Runtime 컴포넌트

#### 3.5.1 `SwaggerConnector.tsx` [신규]

```typescript
// MongoDBConnector와 동일 — 런타임에서 렌더링하지 않음
export function SwaggerConnector() {
  return null;
}
```

#### 3.5.2 Registry 등록

```typescript
// runtime/src/controls/registry.ts
import { SwaggerConnector } from './SwaggerConnector';
// runtimeControlRegistry에 추가
SwaggerConnector,

// designer/src/controls/registry.ts
import { SwaggerConnectorControl } from './SwaggerConnectorControl';
// designerControlRegistry에 추가
SwaggerConnector: SwaggerConnectorControl,
// controlMetadata에 추가
{ type: 'SwaggerConnector', displayName: 'SwaggerConnector', icon: '🔗', category: 'advanced' },
```

### 3.6 Phase 6: MCP 기본값

#### 3.6.1 `controlDefaults.ts`

```typescript
SwaggerConnector: {
  size: { width: 180, height: 40 },
  properties: {
    specYaml: '',
    baseUrl: '',
    defaultHeaders: '{}',
    timeout: 10000,
  },
  description: 'Swagger/OpenAPI REST 클라이언트',
  category: '고급',
  isContainer: false,
},
```

---

## 4. MongoDB 저장 구조

기존 `ControlDefinition` 스키마를 그대로 사용하며, `properties`에 Swagger 관련 데이터를 저장한다.
별도의 스키마 변경은 필요 없다 (`properties: Schema.Types.Mixed`).

```javascript
// Form Document 내 controls 배열 예시
{
  id: "a1b2c3d4-...",
  type: "SwaggerConnector",
  name: "petApi",
  properties: {
    specYaml: "openapi: '3.0.3'\ninfo:\n  title: Petstore API\n  version: '1.0'\nservers:\n  - url: https://petstore.example.com/v1\npaths:\n  /pets:\n    get:\n      operationId: listPets\n      summary: List all pets\n      parameters:\n        - name: limit\n          in: query\n          schema:\n            type: integer\n      responses:\n        '200':\n          description: A list of pets\n    post:\n      operationId: createPet\n      summary: Create a pet\n      requestBody:\n        content:\n          application/json:\n            schema:\n              type: object\n  /pets/{petId}:\n    get:\n      operationId: getPetById\n      parameters:\n        - name: petId\n          in: path\n          required: true\n      responses:\n        '200':\n          description: A pet",
    baseUrl: "",
    defaultHeaders: "{\"X-API-Key\": \"my-key\"}",
    timeout: 10000
  },
  position: { x: 10, y: 10 },
  size: { width: 180, height: 40 },
  visible: true,
  enabled: true
}
```

**용량 고려:**
- 일반적인 OpenAPI 스펙 YAML: 10KB ~ 500KB
- MongoDB document 최대 크기: 16MB
- 폼당 Swagger 스펙 1~3개 정도면 문제 없음
- 초대형 스펙(1MB+)은 경고 메시지 표시 권장

---

## 5. 보안 고려사항

### 5.1 URL 검증
- 기존 `validateSandboxUrl()` 재사용
- 내부 네트워크(private IP) 접근 차단 (SSRF 방지)
- localhost/127.0.0.1 차단 (단, `WEBFORM_ALLOW_LOCAL=true` 환경변수로 개발 시 허용)

### 5.2 인증 정보 보안
- `defaultHeaders`에 포함된 토큰/API 키는 MongoDB에 평문 저장됨
- 향후 개선: 서버 환경변수 참조 기능 (예: `$env.PET_API_KEY`)
- PropertyPanel에서 값을 마스킹 표시 (password 타입)

### 5.3 요청 제한
- `timeout`: 기본 10초, 최대 60초
- 응답 본문 크기 제한: 5MB (초과 시 truncate)
- 동일 핸들러 내 최대 호출 횟수: 50회 (무한 루프 방지)

---

## 6. 에러 처리

```typescript
// SwaggerHandler 내부 에러 처리
try {
  const result = await ctx.controls.petApi.listPets();
} catch (err) {
  // 에러 시나리오:
  // 1. 네트워크 오류 → "SwaggerConnector 'petApi': 네트워크 연결 실패"
  // 2. 타임아웃    → "SwaggerConnector 'petApi': 요청 시간 초과 (10000ms)"
  // 3. URL 차단    → "SwaggerConnector 'petApi': 보안 정책으로 차단된 URL"
  // 4. 잘못된 operationId → "Operation 'xxx' not found in 'petApi'"
}

// HTTP 에러 (4xx, 5xx)는 throw하지 않고 응답 객체로 반환
const result = await ctx.controls.petApi.getPetById({ path: { petId: 999 } });
// result = { status: 404, ok: false, data: { error: "Not found" } }
```

---

## 7. 구현 순서 및 파일 목록

### Step 1: 타입 및 파서 (서버 기반)
| 파일 | 작업 |
|------|------|
| `packages/common/src/types/form.ts` | CONTROL_TYPES에 `'SwaggerConnector'` 추가 |
| `packages/common/src/types/events.ts` | CONTROL_EVENTS에 SwaggerConnector 이벤트 추가 |
| `packages/server/package.json` | `js-yaml`, `@types/js-yaml` 의존성 추가 |
| `packages/server/src/services/SwaggerParser.ts` | **[신규]** YAML 파싱 유틸리티 |
| `packages/server/src/services/SwaggerParser.test.ts` | **[신규]** 파서 단위 테스트 |

### Step 2: SandboxRunner 통합
| 파일 | 작업 |
|------|------|
| `packages/server/src/services/SandboxRunner.ts` | SwaggerConnectorInfo 타입, __swaggerHandler 주입, wrapHandlerCode 확장 |
| `packages/server/src/services/EventEngine.ts` | extractSwaggerConnectors(), runCode 호출 시 전달 |

### Step 3: Runtime 컴포넌트
| 파일 | 작업 |
|------|------|
| `packages/runtime/src/controls/SwaggerConnector.tsx` | **[신규]** `return null` |
| `packages/runtime/src/controls/registry.ts` | 레지스트리 등록 |

### Step 4: Designer UI
| 파일 | 작업 |
|------|------|
| `packages/designer/src/controls/SwaggerConnectorControl.tsx` | **[신규]** 디자이너 표시 |
| `packages/designer/src/controls/registry.ts` | 레지스트리 등록 |
| `packages/designer/src/components/PropertyPanel/controlProperties.ts` | PropertyMeta 추가 |
| `packages/designer/src/components/PropertyPanel/editors/SwaggerSpecEditor.tsx` | **[신규]** YAML 에디터 |

### Step 5: MCP 지원
| 파일 | 작업 |
|------|------|
| `packages/mcp/src/utils/controlDefaults.ts` | 기본값 정의 |

### Step 6: 테스트
| 파일 | 작업 |
|------|------|
| `packages/server/src/__tests__/SwaggerParser.test.ts` | **[신규]** YAML 파싱 테스트 |
| `packages/server/src/__tests__/SwaggerConnector.integration.test.ts` | **[신규]** SandboxRunner 통합 테스트 |

---

## 8. 테스트 케이스

### 8.1 SwaggerParser 단위 테스트

- OpenAPI 3.0 YAML 파싱 → operationId 추출
- Swagger 2.0 YAML 파싱 → 하위 호환성
- operationId 미지정 시 자동 생성 검증
- path 파라미터 추출 (`/pets/{petId}` → `['petId']`)
- query 파라미터 추출
- requestBody 감지
- 잘못된 YAML → 에러 처리
- 빈 paths → 빈 operations 배열

### 8.2 SandboxRunner 통합 테스트

- SwaggerConnector가 ctx.controls에 메서드 주입되는지 확인
- operationId로 메서드 호출 가능한지 확인
- path/query/body 파라미터 올바르게 전달되는지 확인
- 응답 형식 (`{ status, ok, data }`) 검증
- 에러 시나리오 (네트워크 실패, 타임아웃)
- 다수의 SwaggerConnector 동시 사용

### 8.3 E2E 시나리오

1. Designer에서 SwaggerConnector 추가 + 스펙 설정
2. Button에 Click 핸들러 작성: `ctx.controls.api.listPets()`
3. 폼 퍼블리시 → Runtime에서 실행
4. 버튼 클릭 → API 호출 → DataGridView에 결과 표시

---

## 9. 향후 확장 가능성

- **스펙 URL 로드**: YAML 파일 대신 URL 입력으로 자동 fetch
- **인증 스킴 지원**: OAuth2, API Key 등 OpenAPI security schemes 통합
- **요청/응답 로깅**: 디버그 모드에서 모든 API 호출 기록
- **Mock 모드**: 스펙의 example 데이터로 모의 응답 생성 (서버 없이 테스트)
- **타입 검증**: 스펙의 schema를 기반으로 요청/응답 데이터 검증
- **GraphQL 지원**: 별도 GraphQLConnector로 확장
