# [Phase2] SwaggerParser 서비스 구현 계획

> Task ID: `swagger-parser-plan`
> Phase: phase2-parallel (SwaggerConnector 프로젝트)
> 작성일: 2026-03-01

---

## 1. 현재 구조 분석

### 1.1 `packages/server/package.json` — 의존성 현황

현재 dependencies에 YAML 관련 라이브러리가 없다. 추가 필요:

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `js-yaml` | ^4.x | YAML 파싱 (Swagger/OpenAPI 스펙) |
| `@types/js-yaml` | ^4.x | TypeScript 타입 정의 (devDependencies) |

**추가 위치**:
- `js-yaml`: dependencies 섹션 (`jsonwebtoken` 뒤, `mongodb` 앞 — 알파벳순)
- `@types/js-yaml`: devDependencies 섹션 (`@types/express` 뒤)

### 1.2 기존 서비스 구조 패턴 (EventEngine.ts, SandboxRunner.ts)

**임포트 패턴**:
```typescript
import type { ... } from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';  // .js 확장자 사용
```

**인터페이스 패턴** (SandboxRunner.ts:9-16):
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

**특징**:
- `export interface`로 외부 공개, 다른 서비스에서 `import type`으로 사용
- 서비스 파일 상단에 인터페이스 정의 후 함수/클래스 구현
- `.js` 확장자 임포트 (ESM)
- SandboxRunner는 class, EventEngine도 class — 하지만 SwaggerParser는 순수 파싱 유틸리티이므로 **함수 기반** 설계가 적합

---

## 2. SwaggerParser.ts 설계

### 2.1 파일 위치

`packages/server/src/services/SwaggerParser.ts` (신규 생성)

### 2.2 인터페이스 정의

```typescript
export interface SwaggerOperation {
  operationId: string;     // 'listPets', 'getPetById', 'createPet' 등
  method: string;          // 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'
  path: string;            // '/pets/{petId}'
  pathParams: string[];    // ['petId']
  queryParams: string[];   // ['limit', 'offset']
  hasRequestBody: boolean; // POST/PUT/PATCH에서 requestBody 존재 여부
  summary?: string;        // 선택적 설명
}

export interface ParsedSwaggerSpec {
  title: string;           // spec.info.title
  version: string;         // spec.info.version
  baseUrl: string;         // servers[0].url 또는 host+basePath
  operations: SwaggerOperation[];
}
```

### 2.3 함수 시그니처

```typescript
export function parseSwaggerSpec(specYaml: string): ParsedSwaggerSpec
```

- **입력**: Swagger/OpenAPI YAML 문자열
- **출력**: `ParsedSwaggerSpec` 객체
- **에러**: 잘못된 YAML → `Error('SwaggerParser: YAML 파싱 실패: ...')` throw

---

## 3. 파싱 로직 상세 설계

### 3.1 YAML → JSON 파싱

```typescript
import yaml from 'js-yaml';

let spec: Record<string, unknown>;
try {
  spec = yaml.load(specYaml) as Record<string, unknown>;
} catch (err) {
  throw new Error(`SwaggerParser: YAML 파싱 실패: ${(err as Error).message}`);
}
```

- `yaml.load()` 사용 (`safeLoad`는 deprecated)
- 파싱 실패 시 명확한 에러 메시지 포함

### 3.2 OpenAPI 버전 감지

| 필드 | 값 | 버전 |
|------|---|------|
| `spec.openapi` | `'3.0.x'`, `'3.1.x'` 등 | OpenAPI 3.x |
| `spec.swagger` | `'2.0'` | Swagger 2.x |

### 3.3 baseUrl 추출

**OpenAPI 3.x**:
```typescript
const servers = spec.servers as Array<{ url: string }> | undefined;
baseUrl = servers?.[0]?.url ?? '';
```

**Swagger 2.x**:
```typescript
const scheme = ((spec.schemes as string[]) ?? ['https'])[0];
const host = (spec.host as string) ?? '';
const basePath = (spec.basePath as string) ?? '';
baseUrl = host ? `${scheme}://${host}${basePath}` : '';
```

### 3.4 Paths 순회 및 Operations 추출

```typescript
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
for (const [path, pathItem] of Object.entries(paths)) {
  for (const method of HTTP_METHODS) {
    const operation = pathItem[method] as Record<string, unknown> | undefined;
    if (!operation) continue;
    // operation 추출 로직
  }
}
```

### 3.5 파라미터 추출

**path 파라미터**:
- `path` 문자열에서 `{...}` 패턴 정규식 추출: `/pets/{petId}` → `['petId']`
- `parameters` 배열에서 `in === 'path'` 필터링으로 보완

**query 파라미터**:
- `parameters` 배열에서 `in === 'query'` 필터링
- OpenAPI 3.x: operation 레벨 + pathItem 레벨 parameters 병합
- Swagger 2.x: 동일 구조

```typescript
// path에서 직접 추출
const pathParams = (path.match(/\{(\w+)\}/g) || []).map(p => p.slice(1, -1));

// parameters에서 query 추출
const allParams = [
  ...((pathItem.parameters as Array<Record<string, unknown>>) ?? []),
  ...((operation.parameters as Array<Record<string, unknown>>) ?? []),
];
const queryParams = allParams
  .filter(p => p.in === 'query')
  .map(p => p.name as string);
```

### 3.6 hasRequestBody 판정

**OpenAPI 3.x**: `operation.requestBody` 존재 여부
**Swagger 2.x**: `parameters` 배열에 `in === 'body'` 항목 존재 여부

### 3.7 operationId 자동 생성

operationId가 스펙에 명시되어 있으면 그대로 사용. 없으면 자동 생성:

#### 자동 생성 규칙

| method | path 예시 | 생성 규칙 | 결과 |
|--------|-----------|-----------|------|
| GET | `/pets` | `get` + pluralResource | `getPets` |
| GET | `/pets/{petId}` | `get` + singularResource + `ById` | `getPetById` |
| POST | `/pets` | `create` + singularResource | `createPet` |
| PUT | `/pets/{petId}` | `update` + singularResource | `updatePet` |
| DELETE | `/pets/{petId}` | `delete` + singularResource | `deletePet` |
| PATCH | `/pets/{petId}` | `patch` + singularResource | `patchPet` |

#### method → prefix 매핑

```typescript
const METHOD_PREFIX: Record<string, string> = {
  get: 'get',
  post: 'create',
  put: 'update',
  delete: 'delete',
  patch: 'patch',
};
```

#### 핵심 로직: `generateOperationId(method, path)`

```typescript
function generateOperationId(method: string, path: string): string {
  // 1. path를 세그먼트로 분리: '/api/v2/pets/{petId}/toys' → ['api', 'v2', 'pets', '{petId}', 'toys']
  const segments = path.split('/').filter(Boolean);

  // 2. 리소스 세그먼트만 추출 (파라미터 제외)
  const resourceSegments = segments.filter(s => !s.startsWith('{'));

  // 3. 마지막 세그먼트가 파라미터인지 확인
  const lastIsParam = segments.length > 0 && segments[segments.length - 1].startsWith('{');

  // 4. 마지막 리소스 세그먼트
  const lastResource = resourceSegments[resourceSegments.length - 1] ?? '';

  // 5. prefix 결정
  const prefix = METHOD_PREFIX[method] ?? method.toLowerCase();

  // 6. 단수 변환 (간단한 's' 제거)
  const singular = lastResource.endsWith('s') ? lastResource.slice(0, -1) : lastResource;
  const capitalized = singular.charAt(0).toUpperCase() + singular.slice(1);

  // 7. 조합
  if (lastIsParam && singular) {
    // GET /pets/{petId} → getPetById
    return `${prefix}${capitalized}ById`;
  } else if (lastResource) {
    if (method === 'get') {
      // GET /pets → getPets (복수 유지)
      const cap = lastResource.charAt(0).toUpperCase() + lastResource.slice(1);
      return `${prefix}${cap}`;
    }
    // POST /pets → createPet (단수)
    return `${prefix}${capitalized}`;
  }

  // 8. fallback: method + 전체 path를 camelCase
  //    GET /api/v2/pets → getApiV2Pets
  const camelSegments = resourceSegments.map((s, i) =>
    i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
  ).join('');
  return `${prefix}${camelSegments.charAt(0).toUpperCase() + camelSegments.slice(1)}`;
}
```

### 3.8 중복 operationId 처리

```typescript
const usedIds = new Set<string>();

function uniqueOperationId(id: string): string {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }
  let counter = 2;
  while (usedIds.has(`${id}${counter}`)) {
    counter++;
  }
  const unique = `${id}${counter}`;
  usedIds.add(unique);
  return unique;
}
```

### 3.9 빈 스펙 / paths 없음 처리

```typescript
if (!spec || typeof spec !== 'object') {
  throw new Error('SwaggerParser: YAML 파싱 실패: 유효한 객체가 아닙니다');
}

// paths가 없으면 빈 operations (에러 아님)
const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
// → operations: []
```

---

## 4. 전체 코드 구조

```typescript
import yaml from 'js-yaml';

// --- 인터페이스 정의 ---
export interface SwaggerOperation { ... }
export interface ParsedSwaggerSpec { ... }

// --- 내부 상수 ---
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const METHOD_PREFIX: Record<string, string> = { ... };

// --- 내부 헬퍼 함수 ---
function generateOperationId(method: string, path: string): string { ... }

// --- 메인 함수 ---
export function parseSwaggerSpec(specYaml: string): ParsedSwaggerSpec {
  // 1. YAML 파싱
  // 2. 메타데이터 추출 (title, version)
  // 3. baseUrl 추출 (OpenAPI 3.x vs Swagger 2.x)
  // 4. paths 순회 → operations 추출
  // 5. 중복 operationId 해결
  // 6. ParsedSwaggerSpec 반환
}
```

**예상 코드 크기**: ~120줄

---

## 5. 의존성 설치 절차

```bash
pnpm --filter @webform/server add js-yaml
pnpm --filter @webform/server add -D @types/js-yaml
```

**package.json 변경 예상**:
```json
"dependencies": {
  ...
  "js-yaml": "^4.x.x",     // ← 추가
  ...
},
"devDependencies": {
  ...
  "@types/js-yaml": "^4.x.x",  // ← 추가
  ...
}
```

---

## 6. 후속 태스크에서의 사용처

| 태스크 | 사용 방식 |
|--------|-----------|
| `swagger-parser-test` | `parseSwaggerSpec()` 단위 테스트 — OpenAPI 3.x, Swagger 2.x, 에러 케이스 |
| `sandbox-integration-impl` | `EventEngine.extractSwaggerConnectors()`에서 `parseSwaggerSpec(ctrl.properties.specYaml)` 호출 → `SwaggerOperation[]` 추출 |
| `sandbox-integration-impl` | `SandboxRunner`의 `SwaggerConnectorInfo.operations` 필드 타입으로 `SwaggerOperation[]` 사용 |

---

## 7. 구현 절차 요약

| 단계 | 작업 | 변경량 |
|------|------|--------|
| 1 | `pnpm --filter @webform/server add js-yaml` | package.json, pnpm-lock.yaml |
| 2 | `pnpm --filter @webform/server add -D @types/js-yaml` | package.json, pnpm-lock.yaml |
| 3 | `SwaggerParser.ts` 신규 생성 | ~120줄 |
| 4 | TypeScript 타입 체크 확인 | 검증 |

**총 변경: 1개 신규 파일 생성, 1개 파일 수정 (package.json), pnpm-lock.yaml 자동 업데이트**
