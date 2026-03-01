# 폼 관리 Tools 구현 계획

## 개요

`packages/mcp/src/tools/forms.ts` — MCP-SERVER.md 섹션 2.2에 정의된 8개 폼 관리 Tools를 구현한다.

기존 Express 서버의 `/api/forms` REST API를 `apiClient`를 통해 호출하고, MCP SDK의 `server.tool()` 형식으로 결과를 반환한다.

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts        (수정 — registerFormTools export 추가)
└── forms.ts        (신규 — 8개 Tool 정의)
```

## 2. Tool-API 엔드포인트 매핑

| # | Tool 이름 | HTTP 메서드 | 서버 엔드포인트 | 비고 |
|---|-----------|-------------|----------------|------|
| 1 | `list_forms` | GET | `/api/forms?projectId&page&limit&search&status` | 페이지네이션 |
| 2 | `get_form` | GET | `/api/forms/:formId` | 단일 조회 |
| 3 | `create_form` | POST | `/api/forms` | 201 Created |
| 4 | `update_form` | PUT | `/api/forms/:formId` | 낙관적 잠금 (version 필수) |
| 5 | `delete_form` | DELETE | `/api/forms/:formId` | 204 No Content |
| 6 | `publish_form` | POST | `/api/forms/:formId/publish` | status → published |
| 7 | `get_form_versions` | GET | `/api/forms/:formId/versions` | 버전 히스토리 |
| 8 | `get_form_version_snapshot` | GET | `/api/forms/:formId/versions/:version` | 스냅샷 조회 |

## 3. 서버 API 응답 형식 참고

서버 라우트 (`packages/server/src/routes/forms.ts`) 분석 결과:

- **단일 리소스**: `{ data: FormDocument }`
- **목록**: `{ data: FormDocument[], meta: { total, page, limit, totalPages } }`
- **삭제**: HTTP 204 (본문 없음)

API 클라이언트는 원시 JSON을 반환하므로, Tool 핸들러에서 `.data` 추출 후 필요한 필드만 가공하여 반환한다.

## 4. 각 Tool 상세 설계

### 4.1 list_forms

```typescript
server.tool(
  'list_forms',
  '프로젝트의 폼 목록을 조회합니다. 검색, 상태 필터, 페이지네이션을 지원합니다.',
  {
    projectId: z.string().optional().describe('프로젝트 ID (미지정 시 전체 프로젝트)'),
    page: z.number().int().positive().optional().default(1).describe('페이지 번호'),
    limit: z.number().int().positive().max(100).optional().default(20).describe('페이지당 항목 수 (최대 100)'),
    search: z.string().optional().describe('폼 이름 검색어'),
    status: z.enum(['draft', 'published']).optional().describe('폼 상태 필터'),
  },
  handler
);
```

**API 호출**: `GET /api/forms?projectId={}&page={}&limit={}&search={}&status={}`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"forms\": [...], \"meta\": { \"total\": 42, \"page\": 1, \"limit\": 20, \"totalPages\": 3 } }"
  }]
}
```

**핸들러 로직**:
1. 쿼리 파라미터 조합 (`URLSearchParams`)
2. `apiClient.get<ListFormsResponse>('/api/forms?' + params)`
3. `res.data`에서 폼별 요약 정보 추출: `{ id, name, version, status, updatedAt }`
4. `res.meta`와 함께 JSON.stringify 반환

### 4.2 get_form

```typescript
server.tool(
  'get_form',
  '폼의 전체 정의(속성, 컨트롤, 이벤트 핸들러, 데이터 바인딩)를 조회합니다.',
  {
    formId: z.string().describe('폼 ID'),
  },
  handler
);
```

**API 호출**: `GET /api/forms/:formId`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"id\": \"...\", \"name\": \"...\", \"version\": 3, \"properties\": {...}, \"controls\": [...], \"eventHandlers\": [...], \"dataBindings\": [...] }"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)`
3. `res.data`에서 FormDefinition 전체를 JSON.stringify 반환
4. controls 수, eventHandlers 수, version 정보 포함

### 4.3 create_form

```typescript
server.tool(
  'create_form',
  '프로젝트에 새 폼을 생성합니다. properties로 폼의 초기 설정(제목, 크기, 배경색, 테마 등)을 지정할 수 있습니다.',
  {
    name: z.string().min(1).max(200).describe('폼 이름 (1~200자)'),
    projectId: z.string().describe('프로젝트 ID'),
    properties: z.object({
      title: z.string().optional().describe('폼 제목 (미지정 시 name과 동일)'),
      width: z.number().positive().optional().describe('폼 너비 (기본값: 800)'),
      height: z.number().positive().optional().describe('폼 높이 (기본값: 600)'),
      backgroundColor: z.string().optional().describe('배경색 (예: #FFFFFF)'),
      theme: z.string().optional().describe('테마 ID'),
      startPosition: z.enum(['CenterScreen', 'Manual', 'CenterParent']).optional().describe('시작 위치'),
      formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).optional().describe('테두리 스타일'),
      maximizeBox: z.boolean().optional().describe('최대화 버튼 표시'),
      minimizeBox: z.boolean().optional().describe('최소화 버튼 표시'),
    }).optional().describe('폼 속성'),
  },
  handler
);
```

**API 호출**: `POST /api/forms`

**요청 본문**:
```json
{
  "name": "UserRegistration",
  "projectId": "507f1f77bcf86cd799439011",
  "properties": {
    "title": "사용자 등록",
    "width": 600,
    "height": 400
  }
}
```

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"id\": \"...\", \"name\": \"UserRegistration\", \"version\": 1, \"status\": \"draft\" }"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. properties가 없으면 빈 객체, title 미지정 시 name 사용
3. `apiClient.post<CreateFormResponse>('/api/forms', body)`
4. `res.data`에서 `{ id, name, version, status }` 추출 반환

### 4.4 update_form

```typescript
server.tool(
  'update_form',
  '폼 정의를 수정합니다. 낙관적 잠금을 위해 version이 필수이며, 현재 version과 불일치 시 409 충돌 에러가 발생합니다. get_form으로 최신 version을 먼저 확인하세요.',
  {
    formId: z.string().describe('폼 ID'),
    version: z.number().int().positive().describe('현재 폼 버전 (낙관적 잠금 — get_form으로 조회한 version 값)'),
    name: z.string().min(1).max(200).optional().describe('폼 이름'),
    properties: z.object({
      title: z.string().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      backgroundColor: z.string().optional(),
      theme: z.string().optional(),
      startPosition: z.enum(['CenterScreen', 'Manual', 'CenterParent']).optional(),
      formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).optional(),
      maximizeBox: z.boolean().optional(),
      minimizeBox: z.boolean().optional(),
      font: z.object({
        family: z.string().optional(),
        size: z.number().positive().optional(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
      }).optional().describe('폰트 설정'),
    }).optional().describe('수정할 폼 속성 (부분 업데이트)'),
    controls: z.array(z.record(z.unknown())).optional().describe('전체 컨트롤 배열 (교체)'),
    eventHandlers: z.array(z.object({
      controlId: z.string(),
      eventName: z.string(),
      handlerType: z.enum(['server', 'client']),
      handlerCode: z.string(),
    })).optional().describe('전체 이벤트 핸들러 배열 (교체)'),
    dataBindings: z.array(z.object({
      controlId: z.string(),
      controlProperty: z.string(),
      dataSourceId: z.string(),
      dataField: z.string(),
      bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']),
    })).optional().describe('전체 데이터 바인딩 배열 (교체)'),
  },
  handler
);
```

**API 호출**: `PUT /api/forms/:formId`

**요청 본문 (예시)**:
```json
{
  "version": 3,
  "properties": { "title": "수정된 제목" },
  "controls": [...]
}
```

**반환값 (성공)**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"id\": \"...\", \"name\": \"...\", \"version\": 4, \"status\": \"draft\", \"controlCount\": 5 }"
  }]
}
```

**반환값 (409 충돌)**:
```json
{
  "content": [{
    "type": "text",
    "text": "버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. get_form으로 최신 버전을 조회 후 다시 시도하세요. (요청 version: 3)"
  }],
  "isError": true
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `{ formId, ...body }` 분리 — formId는 URL 경로, 나머지는 본문
3. `apiClient.put<UpdateFormResponse>('/api/forms/' + formId, body)`
4. 409 에러 캐치 → `isError: true`와 함께 충돌 메시지 반환
5. 성공 시 `res.data`에서 `{ id, name, version, status, controlCount }` 반환

### 4.5 delete_form

```typescript
server.tool(
  'delete_form',
  '폼을 삭제합니다 (soft delete).',
  {
    formId: z.string().describe('삭제할 폼 ID'),
  },
  handler
);
```

**API 호출**: `DELETE /api/forms/:formId`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "폼이 삭제되었습니다: {formId}"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.delete('/api/forms/' + formId)`
3. 204 응답 → 성공 메시지 반환

### 4.6 publish_form

```typescript
server.tool(
  'publish_form',
  '폼을 퍼블리시합니다. 퍼블리시된 폼은 런타임에서 사용할 수 있습니다. 이미 published 상태면 409 에러가 발생합니다.',
  {
    formId: z.string().describe('퍼블리시할 폼 ID'),
  },
  handler
);
```

**API 호출**: `POST /api/forms/:formId/publish`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"id\": \"...\", \"name\": \"...\", \"version\": 3, \"status\": \"published\" }"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.post<PublishFormResponse>('/api/forms/' + formId + '/publish')`
3. 409 에러 캐치 → 이미 published 상태 메시지 반환
4. 성공 시 `{ id, name, version, status }` 반환

### 4.7 get_form_versions

```typescript
server.tool(
  'get_form_versions',
  '폼의 버전 히스토리를 조회합니다. 각 버전의 번호, 저장 시간, 변경 노트를 확인할 수 있습니다.',
  {
    formId: z.string().describe('폼 ID'),
  },
  handler
);
```

**API 호출**: `GET /api/forms/:formId/versions`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"currentVersion\": 5, \"versions\": [{ \"version\": 1, \"savedAt\": \"...\", \"note\": \"...\" }, ...] }"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetVersionsResponse>('/api/forms/' + formId + '/versions')`
3. `res.data`에서 버전 목록 반환 (snapshot 제외, 메타 정보만)

### 4.8 get_form_version_snapshot

```typescript
server.tool(
  'get_form_version_snapshot',
  '특정 버전의 폼 스냅샷(전체 정의)을 조회합니다. 이전 버전의 상태를 확인하거나 복원할 때 사용합니다.',
  {
    formId: z.string().describe('폼 ID'),
    version: z.number().int().positive().describe('조회할 버전 번호'),
  },
  handler
);
```

**API 호출**: `GET /api/forms/:formId/versions/:version`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"version\": 3, \"snapshot\": { \"name\": \"...\", \"properties\": {...}, \"controls\": [...], \"eventHandlers\": [...], \"dataBindings\": [...] } }"
  }]
}
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetSnapshotResponse>('/api/forms/' + formId + '/versions/' + version)`
3. `res.data` 전체를 JSON.stringify 반환

## 5. 낙관적 잠금 처리 전략

### 5.1 서버 측 동작 (FormService.updateForm)

1. 클라이언트가 `version` 필드를 포함하여 PUT 요청
2. 서버가 DB의 현재 version과 비교
3. 불일치 시 `AppError(409, 'Form has been modified by another user...')` 반환
4. DB `findOneAndUpdate` 조건에 `version` 추가로 race condition 방지
5. 성공 시 `$inc: { version: 1 }`로 version 자동 증가

### 5.2 MCP Tool 측 처리

`update_form`에서 version을 **필수 파라미터**로 설정:

```typescript
version: z.number().int().positive().describe(
  '현재 폼 버전 (낙관적 잠금 — get_form으로 조회한 version 값)'
)
```

**409 에러 처리**:
```typescript
try {
  const res = await apiClient.put<UpdateFormResponse>(
    `/api/forms/${formId}`,
    body,
  );
  return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    return {
      content: [{
        type: 'text',
        text: `버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. get_form으로 최신 버전을 조회 후 다시 시도하세요. (요청 version: ${version})`,
      }],
      isError: true,
    };
  }
  throw err;
}
```

### 5.3 자동 재시도 미적용

MCP-SERVER.md 5.5절에 `withOptimisticRetry` 헬퍼가 정의되어 있으나, **폼 수정(update_form)에서는 자동 재시도하지 않는다**:

- 재시도 시 최신 폼 정의를 다시 조회해야 하며, AI가 보낸 수정 내용이 최신 상태와 충돌할 수 있음
- 대신 409 에러를 명확히 AI에게 반환하여, AI가 `get_form`으로 최신 버전 조회 → 재수정하도록 유도

자동 재시도가 적합한 경우 (publish_form 등 read-modify-write 패턴이 아닌 경우) 별도로 적용 가능.

## 6. 공통 유틸리티

### 6.1 toolError 헬퍼

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
```

### 6.2 toolResult 헬퍼

```typescript
function toolResult(data: unknown): CallToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}
```

### 6.3 에러 핸들링 래퍼

각 Tool 핸들러에 공통 try-catch 패턴 적용:

```typescript
try {
  // Tool 로직
} catch (err) {
  if (err instanceof ApiError) {
    return toolError(`API 오류 [${err.status}]: ${err.message}`);
  }
  throw err; // 예상치 못한 에러는 MCP SDK에 전파
}
```

## 7. 타입 정의

API 응답 타입은 별도 interface를 정의하여 사용:

```typescript
interface FormSummary {
  id: string;
  name: string;
  version: number;
  status: string;
  projectId: string;
  updatedAt: string;
}

interface ListFormsResponse {
  data: FormSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface GetFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
    properties: Record<string, unknown>;
    controls: Record<string, unknown>[];
    eventHandlers: Record<string, unknown>[];
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

interface VersionEntry {
  version: number;
  savedAt: string;
  note?: string;
}

interface GetVersionsResponse {
  data: VersionEntry[];
}

interface GetSnapshotResponse {
  data: {
    version: number;
    snapshot: {
      name: string;
      properties: Record<string, unknown>;
      controls: Record<string, unknown>[];
      eventHandlers: Record<string, unknown>[];
      dataBindings: Record<string, unknown>[];
    };
    savedAt: string;
  };
}
```

## 8. registerFormTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError } from '../utils/apiClient.js';
import { validateObjectId } from '../utils/validators.js';

export function registerFormTools(server: McpServer): void {
  // 1. list_forms
  server.tool('list_forms', ...);

  // 2. get_form
  server.tool('get_form', ...);

  // 3. create_form
  server.tool('create_form', ...);

  // 4. update_form (낙관적 잠금)
  server.tool('update_form', ...);

  // 5. delete_form
  server.tool('delete_form', ...);

  // 6. publish_form
  server.tool('publish_form', ...);

  // 7. get_form_versions
  server.tool('get_form_versions', ...);

  // 8. get_form_version_snapshot
  server.tool('get_form_version_snapshot', ...);
}
```

## 9. server.ts 수정

```typescript
import { registerFormTools } from './tools/forms.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  // registerProjectTools(server);
  registerFormTools(server);

  // Phase 2~3 ...
}
```

## 10. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/tools/forms.ts` | **신규** — 8개 Tool + 타입 정의 |
| 2 | `packages/mcp/src/tools/index.ts` | **수정** — registerFormTools export |
| 3 | `packages/mcp/src/server.ts` | **수정** — registerFormTools 호출 활성화 |

## 11. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 8개 Tool이 모두 MCP 서버에 등록됨 (server.tool 호출 8회)
- [ ] list_forms: 쿼리 파라미터 정상 전달, 페이지네이션 메타 반환
- [ ] get_form: FormDefinition 전체 필드 반환
- [ ] create_form: 폼 생성 후 id, name, version, status 반환
- [ ] update_form: version 필수, 409 충돌 시 isError 반환
- [ ] delete_form: 204 응답 처리, 성공 메시지 반환
- [ ] publish_form: 이미 published 시 409 에러 처리
- [ ] get_form_versions: 버전 목록 반환
- [ ] get_form_version_snapshot: 해당 버전 스냅샷 전체 반환
- [ ] 잘못된 formId(비-ObjectId) 시 검증 에러 반환
