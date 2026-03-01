# MCP 데이터소스 Tools 구현 계획

## 1. 개요

MCP-SERVER.md 섹션 2.6에 정의된 데이터소스 관련 7개 Tool을 구현한다.
기존 서버 API 라우트(`packages/server/src/routes/datasources.ts`)와 `DataSourceService`를 MCP Tool로 래핑하는 방식이다.

### 대상 Tools

| Tool 이름 | HTTP 매핑 | 설명 |
|-----------|-----------|------|
| `list_datasources` | `GET /api/datasources` | 데이터소스 목록 조회 |
| `get_datasource` | `GET /api/datasources/:id` | 데이터소스 상세 조회 (config 복호화) |
| `create_datasource` | `POST /api/datasources` | 데이터소스 생성 |
| `update_datasource` | `PUT /api/datasources/:id` | 데이터소스 수정 |
| `delete_datasource` | `DELETE /api/datasources/:id` | 데이터소스 삭제 (soft delete) |
| `test_datasource_connection` | `POST /api/datasources/:id/test` | 연결 테스트 |
| `query_datasource` | `POST /api/datasources/:id/query` | 쿼리 실행 |

---

## 2. 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `packages/mcp/src/tools/datasources.ts` | **신규** | 7개 데이터소스 Tool 구현 |
| `packages/mcp/src/tools/index.ts` | 수정 | `registerDatasourceTools` export 추가 |
| `packages/mcp/src/server.ts` | 수정 | `registerDatasourceTools` 호출 추가 |

---

## 3. 구현 패턴

기존 `forms.ts`, `projects.ts` 패턴을 그대로 따른다.

```typescript
// 파일 구조
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// API 응답 타입
interface DataSourceSummary { ... }
interface DataSourceDetail { ... }
// ...

// 헬퍼
function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}
function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

// 등록
export function registerDatasourceTools(server: McpServer): void { ... }
```

### 에러 처리 패턴

모든 Tool 핸들러에서 동일 패턴 적용:
```typescript
catch (error) {
  if (error instanceof ApiError) return toolError(error.message);
  if (error instanceof Error && error.message.includes('유효하지 않은'))
    return toolError(error.message);
  throw error;
}
```

---

## 4. 각 Tool 상세 설계

### 4.1 list_datasources

**설명:** `데이터소스 목록을 조회합니다. 프로젝트, 타입 필터, 이름 검색, 페이지네이션을 지원합니다.`

**Zod 스키마:**
```typescript
{
  projectId: z.string().optional()
    .describe('프로젝트 ID (미지정 시 전체)'),
  type: z.enum(['database', 'restApi', 'static']).optional()
    .describe('데이터소스 타입 필터'),
  search: z.string().optional()
    .describe('이름 검색어'),
  page: z.number().int().positive().optional()
    .describe('페이지 번호 (기본값: 1)'),
  limit: z.number().int().positive().max(100).optional()
    .describe('페이지당 항목 수 (기본값: 20, 최대: 100)'),
}
```

**구현 로직:**
1. URLSearchParams로 쿼리 파라미터 조합
2. `GET /api/datasources?{params}` 호출
3. 응답에서 config 없이 요약 정보만 반환

**반환값:**
```json
{
  "datasources": [
    {
      "id": "...",
      "name": "사용자 DB",
      "type": "database",
      "projectId": "...",
      "description": "...",
      "meta": { "dialect": "mongodb" },
      "updatedAt": "..."
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### 4.2 get_datasource

**설명:** `데이터소스의 상세 정보를 조회합니다. 복호화된 config 설정을 포함합니다.`

**Zod 스키마:**
```typescript
{
  datasourceId: z.string().describe('데이터소스 ID (MongoDB ObjectId)'),
}
```

**구현 로직:**
1. `validateObjectId(datasourceId, 'datasourceId')`
2. `GET /api/datasources/${datasourceId}` 호출
3. 응답의 config 포함하여 반환

**반환값:**
```json
{
  "id": "...",
  "name": "사용자 DB",
  "type": "database",
  "projectId": "...",
  "description": "...",
  "config": {
    "connectionString": "mongodb://localhost:27017",
    "database": "webform_users"
  },
  "meta": { "dialect": "mongodb" },
  "createdAt": "...",
  "updatedAt": "..."
}
```

> **참고:** config 복호화는 서버 API 내부에서 처리됨. MCP Tool은 API 응답을 그대로 전달.

---

### 4.3 create_datasource

**설명:** `새 데이터소스를 생성합니다. type에 따라 config 구조가 다릅니다: database(MongoDB 연결), restApi(REST API 엔드포인트), static(정적 JSON 데이터).`

**Zod 스키마:**
```typescript
{
  name: z.string().min(1).max(200)
    .describe('데이터소스 이름 (1~200자)'),
  type: z.enum(['database', 'restApi', 'static'])
    .describe('데이터소스 타입'),
  projectId: z.string()
    .describe('프로젝트 ID'),
  description: z.string().max(500).optional()
    .describe('설명 (최대 500자)'),
  config: z.record(z.unknown())
    .describe(
      '데이터소스 설정. type별 구조:\n' +
      '- database: { dialect: "mongodb", connectionString: string, database: string }\n' +
      '- restApi: { baseUrl: string, headers?: Record<string,string>, auth?: { type: "bearer"|"basic"|"apiKey", token?, username?, password?, apiKey?, headerName? } }\n' +
      '- static: { data: unknown[] }'
    ),
}
```

> **설계 결정:** `config`를 `z.record(z.unknown())`으로 정의하는 이유:
> - 서버 API가 `createDataSourceSchema` (discriminated union)으로 이미 상세 검증을 수행함
> - MCP Tool 레벨에서 discriminated union을 재정의하면 중복 + Tool description이 과도하게 복잡해짐
> - describe에 type별 구조를 명시하여 LLM이 올바른 config를 생성할 수 있도록 가이드

**구현 로직:**
1. `validateObjectId(projectId, 'projectId')`
2. `POST /api/datasources` 호출 (body: `{ name, type, projectId, description, config }`)
3. 생성된 데이터소스 요약 반환

**반환값:**
```json
{
  "id": "...",
  "name": "사용자 DB",
  "type": "database",
  "projectId": "...",
  "description": "..."
}
```

---

### 4.4 update_datasource

**설명:** `데이터소스를 수정합니다. name, description, config를 개별적으로 업데이트할 수 있습니다.`

**Zod 스키마:**
```typescript
{
  datasourceId: z.string()
    .describe('데이터소스 ID'),
  name: z.string().min(1).max(200).optional()
    .describe('새 이름'),
  description: z.string().max(500).optional()
    .describe('새 설명'),
  config: z.record(z.unknown()).optional()
    .describe(
      '수정할 설정 (기존 type에 맞는 구조):\n' +
      '- database: { connectionString: string, database: string, dialect?: string }\n' +
      '- restApi: { baseUrl: string, headers?: Record<string,string>, auth?: object }\n' +
      '- static: { data: unknown[] }'
    ),
}
```

**구현 로직:**
1. `validateObjectId(datasourceId, 'datasourceId')`
2. body 객체에서 undefined가 아닌 필드만 포함
3. `PUT /api/datasources/${datasourceId}` 호출
4. 수정된 데이터소스 요약 반환

**반환값:**
```json
{
  "id": "...",
  "name": "새 이름",
  "type": "database",
  "projectId": "..."
}
```

---

### 4.5 delete_datasource

**설명:** `데이터소스를 삭제합니다 (soft delete).`

**Zod 스키마:**
```typescript
{
  datasourceId: z.string()
    .describe('삭제할 데이터소스 ID'),
}
```

**구현 로직:**
1. `validateObjectId(datasourceId, 'datasourceId')`
2. `DELETE /api/datasources/${datasourceId}` 호출 (204 No Content)
3. 삭제 확인 반환

**반환값:**
```json
{
  "deleted": true,
  "datasourceId": "..."
}
```

---

### 4.6 test_datasource_connection

**설명:** `데이터소스의 연결을 테스트합니다. database 타입은 DB 연결을, restApi 타입은 API 호출을 테스트합니다. static 타입은 항상 성공합니다.`

**Zod 스키마:**
```typescript
{
  datasourceId: z.string()
    .describe('테스트할 데이터소스 ID'),
}
```

**구현 로직:**
1. `validateObjectId(datasourceId, 'datasourceId')`
2. `POST /api/datasources/${datasourceId}/test` 호출
3. 결과 반환

**반환값:**
```json
{
  "success": true,
  "message": "연결 성공"
}
```
또는:
```json
{
  "success": false,
  "message": "연결 실패: ECONNREFUSED"
}
```

> **참고:** test_datasource_connection은 연결 실패를 API가 `{ success: false }` 형태로 반환하는 경우 toolResult로, HTTP 에러(404 등)인 경우 toolError로 처리.

---

### 4.7 query_datasource

**설명:** `데이터소스에 쿼리를 실행합니다. type별 쿼리 형식이 다릅니다: database는 MongoDB 쿼리, restApi는 HTTP 요청 설정, static은 필터 조건.`

**Zod 스키마:**
```typescript
{
  datasourceId: z.string()
    .describe('데이터소스 ID'),
  query: z.record(z.unknown())
    .describe(
      '쿼리 객체 (type별 형식):\n' +
      '- database(mongodb): { collection: string, filter?: object, projection?: object, sort?: object, limit?: number }\n' +
      '- restApi: { method?: string, path?: string, params?: object, body?: object }\n' +
      '- static: { filter?: object, sort?: object, limit?: number }'
    ),
}
```

**구현 로직:**
1. `validateObjectId(datasourceId, 'datasourceId')`
2. `POST /api/datasources/${datasourceId}/query` 호출 (body: query 객체)
3. 쿼리 결과 반환

**반환값:**
```json
{
  "data": [
    { "_id": "...", "name": "John", "email": "john@example.com" },
    { "_id": "...", "name": "Jane", "email": "jane@example.com" }
  ],
  "rowCount": 2
}
```

> **참고:** 서버 API 응답이 `{ data: unknown[] }` 형태이므로, rowCount를 MCP Tool에서 추가 계산하여 편의성 제공.

---

## 5. API 응답 타입 정의

```typescript
// 목록 조회 응답
interface DataSourceSummary {
  _id: string;
  name: string;
  type: 'database' | 'restApi' | 'static';
  projectId: string;
  description: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ListDataSourcesResponse {
  data: DataSourceSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 단일 조회 응답 (config 포함)
interface DataSourceDetail extends DataSourceSummary {
  config: Record<string, unknown>;
}

interface GetDataSourceResponse {
  data: DataSourceDetail;
}

// 생성/수정 응답
interface MutateDataSourceResponse {
  data: DataSourceSummary;
}

// 연결 테스트 응답
interface TestConnectionResponse {
  data: {
    success: boolean;
    message: string;
  };
}

// 쿼리 실행 응답
interface QueryDataSourceResponse {
  data: unknown[];
}
```

---

## 6. server.ts / index.ts 수정

### 6.1 tools/index.ts

```typescript
export { registerProjectTools } from './projects.js';
export { registerFormTools } from './forms.js';
export { registerControlTools } from './controls.js';
export { registerEventTools } from './events.js';
export { registerDatasourceTools } from './datasources.js';  // 추가
```

### 6.2 server.ts

```typescript
import {
  registerProjectTools,
  registerFormTools,
  registerControlTools,
  registerEventTools,
  registerDatasourceTools,  // 추가
} from './tools/index.js';

export function registerTools(server: McpServer): void {
  // Phase 1
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2
  registerControlTools(server);
  registerEventTools(server);

  // Phase 3
  registerDatasourceTools(server);  // 주석 해제 + 추가
}
```

---

## 7. Config 구조 참고 (type별)

서버 validator(`datasourceValidator.ts`)에서 정의한 정확한 구조:

### database
```typescript
{
  dialect: 'mongodb',     // 현재 mongodb만 지원
  connectionString: string,  // 예: "mongodb://localhost:27017"
  database: string,          // 예: "webform_users"
}
```

### restApi
```typescript
{
  baseUrl: string,           // 예: "https://api.example.com"
  headers: Record<string, string>,  // 기본값: {}
  auth?: {
    type: 'bearer' | 'basic' | 'apiKey',
    token?: string,          // bearer용
    username?: string,       // basic용
    password?: string,       // basic용
    apiKey?: string,         // apiKey용
    headerName?: string,     // apiKey 헤더 이름
  }
}
```

### static
```typescript
{
  data: unknown[],           // 정적 JSON 배열
}
```

---

## 8. 구현 순서

1. `packages/mcp/src/tools/datasources.ts` 파일 생성
   - API 응답 타입 정의
   - `toolResult`, `toolError` 헬퍼
   - `registerDatasourceTools` 함수에 7개 Tool 등록
2. `packages/mcp/src/tools/index.ts` 에 export 추가
3. `packages/mcp/src/server.ts` 에 import 및 호출 추가
4. 빌드 확인 (`pnpm --filter @webform/mcp build` 또는 `pnpm typecheck`)

---

## 9. 테스트 계획

기존 Phase 2 테스트(`packages/mcp/src/__tests__/phase2-integration.test.ts`) 패턴을 따라 통합 테스트 작성:

- **list_datasources:** 빈 목록 → 생성 후 목록 확인 → 타입 필터 → 검색
- **create_datasource:** database/restApi/static 각 타입 생성
- **get_datasource:** 생성된 데이터소스 상세 조회 + config 포함 확인
- **update_datasource:** name, description, config 부분 업데이트
- **delete_datasource:** soft delete + 이후 목록에서 제외 확인
- **test_datasource_connection:** static 타입 성공 확인 (DB/API 타입은 실제 연결 필요)
- **query_datasource:** static 타입으로 쿼리 실행 + 결과 확인
- **에러 케이스:** 잘못된 ObjectId, 존재하지 않는 ID (404)
