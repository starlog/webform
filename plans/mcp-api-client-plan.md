# MCP API 클라이언트 구현 계획

## 개요

`packages/mcp/src/utils/apiClient.ts` — MCP 서버가 기존 Express 서버(localhost:4000)의 REST API를 호출하기 위한 HTTP 클라이언트.
`packages/mcp/src/utils/validators.ts` — Tool 입력값 공통 검증 유틸리티.

MCP-SERVER.md 섹션 5.1 설계를 기반으로 구현한다.

## 1. WebFormApiClient 클래스 설계

### 1.1 클래스 구조

```typescript
export class WebFormApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.WEBFORM_API_URL || 'http://localhost:4000';
  }

  async init(): Promise<void> { ... }

  async get<T>(path: string): Promise<T> { ... }
  async post<T>(path: string, body?: unknown): Promise<T> { ... }
  async put<T>(path: string, body?: unknown): Promise<T> { ... }
  async patch<T>(path: string, body?: unknown): Promise<T> { ... }
  async delete(path: string): Promise<void> { ... }
}
```

### 1.2 싱글톤 export

```typescript
export const apiClient = new WebFormApiClient();
```

Tool/Resource 핸들러들이 `apiClient`를 import하여 사용. `index.ts`에서 서버 시작 전 `apiClient.init()` 호출.

### 1.3 baseUrl 설정

- 환경변수 `WEBFORM_API_URL`이 있으면 사용
- 없으면 기본값 `http://localhost:4000`
- Claude Desktop/Code 설정의 `env` 블록에서 오버라이드 가능

## 2. 인증 — init() 메서드

### 2.1 개발 토큰 자동 발급

서버의 `/auth/dev-token` 엔드포인트 (development 환경에서만 활성화):

```typescript
async init(): Promise<void> {
  const res = await fetch(`${this.baseUrl}/auth/dev-token`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`토큰 발급 실패: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { token: string };
  this.token = data.token;
}
```

### 2.2 서버 실제 동작

`packages/server/src/app.ts:57` 확인:

```typescript
app.post('/auth/dev-token', (_req, res) => {
  const token = jwt.sign(
    { sub: 'dev-designer', role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY },
  );
  res.json({ token });
});
```

- **메서드**: POST
- **응답**: `{ token: string }`
- **조건**: `NODE_ENV === 'development'`에서만 활성화

### 2.3 인증 헤더 자동 포함

모든 HTTP 요청에 `Authorization: Bearer <token>` 헤더 자동 추가:

```typescript
private getHeaders(hasBody: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`;
  }
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}
```

## 3. HTTP 메서드 구현

### 3.1 공통 요청 처리

```typescript
private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${this.baseUrl}${path}`;
  const hasBody = body !== undefined;

  const res = await fetch(url, {
    method,
    headers: this.getHeaders(hasBody),
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    await this.handleError(res, method, path);
  }

  // 204 No Content (DELETE 등)
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
```

### 3.2 개별 메서드

| 메서드 | 내부 호출 | 비고 |
|--------|----------|------|
| `get<T>(path)` | `request<T>('GET', path)` | |
| `post<T>(path, body?)` | `request<T>('POST', path, body)` | body 선택적 (publish 등) |
| `put<T>(path, body?)` | `request<T>('PUT', path, body)` | |
| `patch<T>(path, body?)` | `request<T>('PATCH', path, body)` | |
| `delete(path)` | `request<void>('DELETE', path)` | 204 반환 |

### 3.3 참고: 서버 API 응답 형식

서버 라우트 분석 결과, 응답 형식은 두 가지 패턴:

**패턴 A — 단일 리소스 / 목록 (인증 필요 API)**:
```json
{ "data": { ... } }                    // 단일 조회/생성/수정
{ "data": [...], "meta": { ... } }     // 목록 조회 (페이지네이션)
```

**패턴 B — 런타임 API (인증 불필요)**:
```json
{ "id": "...", "name": "...", ... }    // 직접 반환 (data 래핑 없음)
```

API 클라이언트는 원시 응답을 그대로 반환하고, 개별 Tool에서 `.data` 추출 등 후처리를 담당한다.

## 4. 에러 처리

### 4.1 서버 에러 응답 형식

`packages/server/src/middleware/errorHandler.ts` 분석:

```json
{
  "error": {
    "message": "에러 메시지",
    "requestId": "uuid",
    "details": [...]           // ZodError인 경우만
  }
}
```

### 4.2 HTTP 에러 → MCP 에러 변환

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public path: string,
    public detail?: string,
  ) {
    super(`API 오류 [${status}] ${method} ${path}: ${detail || statusText}`);
    this.name = 'ApiError';
  }
}
```

### 4.3 상태 코드별 에러 메시지

| HTTP 상태 | 의미 | MCP 에러 메시지 |
|-----------|------|----------------|
| 400 | 잘못된 요청 | 서버 응답의 `error.message` 사용 |
| 401 | 인증 실패 | `"인증 토큰이 만료되었거나 유효하지 않습니다"` |
| 404 | 리소스 없음 | `"리소스를 찾을 수 없습니다: {path}"` |
| 409 | 버전 충돌 | `"버전 충돌이 발생했습니다. 최신 버전을 조회 후 다시 시도하세요"` |
| 500 | 서버 오류 | `"서버 내부 오류가 발생했습니다"` |

### 4.4 에러 핸들링 메서드

```typescript
private async handleError(res: Response, method: string, path: string): Promise<never> {
  let detail: string | undefined;
  try {
    const body = await res.json() as { error?: { message?: string } };
    detail = body?.error?.message;
  } catch {
    // JSON 파싱 실패 시 무시
  }
  throw new ApiError(res.status, res.statusText, path, detail);
}
```

## 5. 서버 API 엔드포인트 맵 (실제 확인 결과)

라우트 파일 분석을 통해 확인한 실제 API 엔드포인트:

### 5.1 프로젝트 (`/api/projects`) — 인증 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects` | 목록 조회 (page, limit, search) |
| POST | `/api/projects` | 생성 |
| POST | `/api/projects/import` | 가져오기 |
| GET | `/api/projects/:id` | 상세 조회 |
| PUT | `/api/projects/:id` | 수정 |
| DELETE | `/api/projects/:id` | 삭제 |
| PUT | `/api/projects/:id/font` | 전체 폼 폰트 일괄 적용 |
| GET | `/api/projects/:id/export` | 내보내기 |
| POST | `/api/projects/:id/publish-all` | 전체 퍼블리시 |

### 5.2 폼 (`/api/forms`) — 인증 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/forms` | 목록 조회 (projectId, page, limit, search, status) |
| POST | `/api/forms` | 생성 |
| GET | `/api/forms/:id` | 정의 조회 |
| PUT | `/api/forms/:id` | 수정 (낙관적 잠금 — version 필수) |
| DELETE | `/api/forms/:id` | 삭제 |
| GET | `/api/forms/:id/versions` | 버전 히스토리 |
| GET | `/api/forms/:id/versions/:version` | 특정 버전 스냅샷 |
| POST | `/api/forms/:id/publish` | 퍼블리시 |

### 5.3 데이터소스 (`/api/datasources`) — 인증 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/datasources` | 목록 (page, limit, projectId) |
| POST | `/api/datasources` | 생성 |
| GET | `/api/datasources/:id` | 상세 (config 복호화) |
| PUT | `/api/datasources/:id` | 수정 |
| DELETE | `/api/datasources/:id` | 삭제 (soft delete) |
| POST | `/api/datasources/:id/test` | 연결 테스트 |
| POST | `/api/datasources/:id/query` | 쿼리 실행 |

### 5.4 Shell (`/api/projects/:projectId/shell`) — 인증 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:projectId/shell` | 조회 |
| POST | `/api/projects/:projectId/shell` | 생성 |
| PUT | `/api/projects/:projectId/shell` | 수정 |
| DELETE | `/api/projects/:projectId/shell` | 삭제 |
| POST | `/api/projects/:projectId/shell/publish` | 퍼블리시 |

### 5.5 테마 (`/api/themes`) — 인증 필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/themes` | 목록 (page, limit) |
| POST | `/api/themes` | 생성 |
| POST | `/api/themes/seed` | 프리셋 시딩 |
| GET | `/api/themes/:id` | 상세 |
| PUT | `/api/themes/:id` | 수정 |
| DELETE | `/api/themes/:id` | 삭제 (soft) |

### 5.6 런타임 (`/api/runtime`) — 인증 불필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/runtime/forms/:id` | 퍼블리시된 폼 로드 |
| POST | `/api/runtime/forms/:id/events` | 이벤트 실행 |
| POST | `/api/runtime/forms/:id/data` | 데이터소스 쿼리 |
| GET | `/api/runtime/shells/:projectId` | 퍼블리시된 Shell |
| POST | `/api/runtime/shells/:projectId/events` | Shell 이벤트 실행 |
| GET | `/api/runtime/app/:projectId` | Shell + 시작 폼 로드 |
| GET | `/api/runtime/themes/:id` | 테마 조회 |
| GET | `/api/runtime/themes/preset/:presetId` | 프리셋 테마 조회 |

### 5.7 디버그 (`/api/debug`) — 인증 불필요, development 전용

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/debug/execute` | 코드 테스트 실행 |

### 5.8 헬스체크 — 인증 불필요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 (MongoDB, Redis) |

## 6. 입력값 검증 유틸리티 (`validators.ts`)

### 6.1 함수 목록

```typescript
/**
 * MongoDB ObjectId 형식 검증 (24자 hex)
 */
export function validateObjectId(id: string, fieldName: string = 'id'): void {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(`유효하지 않은 ${fieldName}: "${id}" (24자 hex 문자열이어야 합니다)`);
  }
}

/**
 * 필수값 검증 — null/undefined/빈문자열 체크
 */
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName}은(는) 필수 입력입니다`);
  }
}
```

### 6.2 사용 위치

- Tool 핸들러에서 Zod 스키마 검증 보완 용도
- ObjectId 파라미터 검증 (formId, projectId, controlId 등)
- Zod로 처리하기 어려운 비즈니스 로직 검증

## 7. index.ts 엔트리포인트 수정

`apiClient.init()` 호출을 `src/index.ts`에 추가:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools, registerResources, registerPrompts } from './server.js';
import { apiClient } from './utils/apiClient.js';

// API 클라이언트 초기화 (개발 토큰 발급)
await apiClient.init();

const server = new McpServer({
  name: 'webform',
  version: '1.0.0',
  description: 'WebForm SDUI 플랫폼 — 폼/프로젝트 관리, 컨트롤 배치, 이벤트 핸들링, 데이터 바인딩',
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## 8. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/utils/apiClient.ts` | **신규** — WebFormApiClient + ApiError 클래스 |
| 2 | `packages/mcp/src/utils/validators.ts` | **신규** — validateObjectId, validateRequired |
| 3 | `packages/mcp/src/utils/index.ts` | **수정** — apiClient, validators export |
| 4 | `packages/mcp/src/index.ts` | **수정** — apiClient.init() 호출 추가 |

## 9. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] `apiClient.init()` 호출 시 서버가 실행 중이면 토큰 정상 발급
- [ ] `apiClient.get('/api/projects')` 호출 시 인증 헤더 포함되어 정상 응답
- [ ] 서버 미실행 시 `init()`에서 명확한 에러 메시지 출력
- [ ] 404 응답 시 `ApiError`에 경로 정보 포함
- [ ] 409 응답 시 버전 충돌 관련 에러 메시지
