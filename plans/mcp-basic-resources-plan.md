# MCP 기본 Resources 구현 계획

## 개요

`packages/mcp/src/resources/` — MCP Resource는 `webform://` URI를 통해 접근하는 읽기 전용 데이터. AI 어시스턴트가 프로젝트/폼의 현재 상태를 조회할 때 사용한다.

MCP-SERVER.md 섹션 3.2~3.3 설계를 기반으로, Phase 1에서 프로젝트/폼 관련 동적 리소스 6개를 구현한다.

## 1. 구현 대상 리소스

### 1.1 동적 리소스 목록 (ResourceTemplate 사용)

| # | URI 패턴 | 이름 | 설명 | MIME |
|---|----------|------|------|------|
| 1 | `webform://projects/{projectId}` | `project-detail` | 프로젝트 상세 + 폼 목록 | `application/json` |
| 2 | `webform://forms/{formId}` | `form-definition` | 폼 정의 전체 (FormDefinition) | `application/json` |
| 3 | `webform://forms/{formId}/controls` | `form-controls` | 폼의 컨트롤 목록 (flat) | `application/json` |
| 4 | `webform://forms/{formId}/events` | `form-events` | 폼의 이벤트 핸들러 목록 | `application/json` |
| 5 | `webform://forms/{formId}/bindings` | `form-bindings` | 폼의 데이터 바인딩 목록 | `application/json` |
| 6 | `webform://forms/{formId}/versions` | `form-versions` | 폼의 버전 히스토리 | `application/json` |

## 2. Resource 구현 패턴

### 2.1 MCP SDK `server.resource()` 호출 시그니처

```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

// 동적 리소스 (ResourceTemplate)
server.resource(
  'resource-name',                                         // name (고유 식별자)
  new ResourceTemplate('webform://forms/{formId}', {       // URI 템플릿 + 콜백
    list: undefined,                                       // list 콜백 (undefined = 열거 불가)
  }),
  async (uri, variables) => {                              // read 콜백
    // variables = { formId: '...' }
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);
```

### 2.2 공통 패턴

모든 리소스 핸들러는 동일한 패턴을 따른다:

```typescript
async (uri, { paramName }) => {
  // 1. API 클라이언트로 데이터 조회
  const response = await apiClient.get<ApiResponse>(`/api/endpoint/${paramName}`);

  // 2. 필요 시 데이터 가공 (response.data 추출 등)
  const data = response.data;

  // 3. Resource 응답 반환
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    }],
  };
}
```

### 2.3 에러 처리

API 호출 실패 시 `ApiError`가 throw되며, MCP SDK가 자동으로 에러 응답을 클라이언트에 전달한다. 별도의 try-catch는 필요하지 않다.

## 3. 리소스별 상세 설계

### 3.1 `webform://projects/{projectId}` — 프로젝트 상세

- **파일**: `resources/projectResource.ts`
- **API 호출**: `GET /api/projects/:id`
- **서버 응답 형식**:
  ```json
  {
    "data": {
      "project": { "_id", "name", "description", "defaultFont", "shellId", ... },
      "forms": [{ "_id", "name", "version", "status", ... }]
    }
  }
  ```
- **Resource 반환**: `response.data` — 프로젝트 상세 + 폼 목록을 그대로 반환

```typescript
server.resource(
  'project-detail',
  new ResourceTemplate('webform://projects/{projectId}', { list: undefined }),
  async (uri, { projectId }) => {
    const response = await apiClient.get<{ data: unknown }>(`/api/projects/${projectId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  }
);
```

### 3.2 `webform://forms/{formId}` — 폼 정의 전체

- **파일**: `resources/formResource.ts`
- **API 호출**: `GET /api/forms/:id`
- **서버 응답 형식**:
  ```json
  {
    "data": {
      "_id", "name", "version", "projectId", "status",
      "properties": { "title", "width", "height", "backgroundColor", ... },
      "controls": [...],
      "eventHandlers": [...],
      "dataBindings": [...]
    }
  }
  ```
- **Resource 반환**: `response.data` — FormDefinition 전체

```typescript
server.resource(
  'form-definition',
  new ResourceTemplate('webform://forms/{formId}', { list: undefined }),
  async (uri, { formId }) => {
    const response = await apiClient.get<{ data: unknown }>(`/api/forms/${formId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  }
);
```

### 3.3 `webform://forms/{formId}/controls` — 컨트롤 목록

- **파일**: `resources/formResource.ts` (폼 리소스와 같은 파일)
- **API 호출**: `GET /api/forms/:id` (폼 전체 조회 후 controls 추출)
- **Resource 반환**: `response.data.controls` — 컨트롤 배열만 추출

```typescript
server.resource(
  'form-controls',
  new ResourceTemplate('webform://forms/{formId}/controls', { list: undefined }),
  async (uri, { formId }) => {
    const response = await apiClient.get<{ data: { controls: unknown[] } }>(`/api/forms/${formId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data.controls, null, 2),
      }],
    };
  }
);
```

### 3.4 `webform://forms/{formId}/events` — 이벤트 핸들러 목록

- **파일**: `resources/formResource.ts`
- **API 호출**: `GET /api/forms/:id` (폼 전체 조회 후 eventHandlers 추출)
- **서버 응답의 eventHandlers 구조**:
  ```json
  [
    {
      "controlId": "string",
      "eventName": "Click",
      "handlerType": "server",
      "handlerCode": "ctx.controls.txtName.text = '...';"
    }
  ]
  ```
- **Resource 반환**: `response.data.eventHandlers`

```typescript
server.resource(
  'form-events',
  new ResourceTemplate('webform://forms/{formId}/events', { list: undefined }),
  async (uri, { formId }) => {
    const response = await apiClient.get<{ data: { eventHandlers: unknown[] } }>(`/api/forms/${formId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data.eventHandlers, null, 2),
      }],
    };
  }
);
```

### 3.5 `webform://forms/{formId}/bindings` — 데이터 바인딩 목록

- **파일**: `resources/formResource.ts`
- **API 호출**: `GET /api/forms/:id` (폼 전체 조회 후 dataBindings 추출)
- **서버 응답의 dataBindings 구조**:
  ```json
  [
    {
      "controlId": "string",
      "controlProperty": "dataSource",
      "dataSourceId": "string",
      "dataField": "users",
      "bindingMode": "oneWay"
    }
  ]
  ```
- **Resource 반환**: `response.data.dataBindings`

```typescript
server.resource(
  'form-bindings',
  new ResourceTemplate('webform://forms/{formId}/bindings', { list: undefined }),
  async (uri, { formId }) => {
    const response = await apiClient.get<{ data: { dataBindings: unknown[] } }>(`/api/forms/${formId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data.dataBindings, null, 2),
      }],
    };
  }
);
```

### 3.6 `webform://forms/{formId}/versions` — 버전 히스토리

- **파일**: `resources/formResource.ts`
- **API 호출**: `GET /api/forms/:id/versions` (별도 엔드포인트)
- **서버 응답 형식**:
  ```json
  {
    "data": [
      { "version": 3, "note": "자동 설명", "savedAt": "2025-01-01T..." },
      { "version": 2, "note": "...", "savedAt": "..." }
    ]
  }
  ```
- **Resource 반환**: `response.data` — 버전 배열 (최대 20개, 내림차순)

```typescript
server.resource(
  'form-versions',
  new ResourceTemplate('webform://forms/{formId}/versions', { list: undefined }),
  async (uri, { formId }) => {
    const response = await apiClient.get<{ data: unknown[] }>(`/api/forms/${formId}/versions`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data, null, 2),
      }],
    };
  }
);
```

## 4. 파일 구조

### 4.1 `resources/projectResource.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/apiClient.js';

export function registerProjectResources(server: McpServer): void {
  // webform://projects/{projectId}
  server.resource(
    'project-detail',
    new ResourceTemplate('webform://projects/{projectId}', { list: undefined }),
    async (uri, { projectId }) => { ... }
  );
}
```

### 4.2 `resources/formResource.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/apiClient.js';

export function registerFormResources(server: McpServer): void {
  // webform://forms/{formId}
  server.resource('form-definition', ...);

  // webform://forms/{formId}/controls
  server.resource('form-controls', ...);

  // webform://forms/{formId}/events
  server.resource('form-events', ...);

  // webform://forms/{formId}/bindings
  server.resource('form-bindings', ...);

  // webform://forms/{formId}/versions
  server.resource('form-versions', ...);
}
```

### 4.3 `resources/index.ts`

```typescript
export { registerProjectResources } from './projectResource.js';
export { registerFormResources } from './formResource.js';
```

### 4.4 `server.ts` 수정

```typescript
import { registerProjectResources, registerFormResources } from './resources/index.js';

export function registerResources(server: McpServer): void {
  // Phase 1: 프로젝트/폼 동적 Resources
  registerProjectResources(server);
  registerFormResources(server);

  // Phase 2: 스키마/가이드 Resources
  // registerSchemaResources(server);
  // registerGuideResources(server);
}
```

## 5. API 호출 매핑 요약

| Resource URI | API 엔드포인트 | 데이터 추출 |
|-------------|---------------|------------|
| `webform://projects/{projectId}` | `GET /api/projects/:id` | `response.data` (project + forms) |
| `webform://forms/{formId}` | `GET /api/forms/:id` | `response.data` (전체) |
| `webform://forms/{formId}/controls` | `GET /api/forms/:id` | `response.data.controls` |
| `webform://forms/{formId}/events` | `GET /api/forms/:id` | `response.data.eventHandlers` |
| `webform://forms/{formId}/bindings` | `GET /api/forms/:id` | `response.data.dataBindings` |
| `webform://forms/{formId}/versions` | `GET /api/forms/:id/versions` | `response.data` |

> controls, events, bindings는 모두 폼 정의에 포함되어 있으므로 동일 API(`GET /api/forms/:id`)를 호출하고 필요한 필드만 추출한다.

## 6. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/resources/projectResource.ts` | **신규** — registerProjectResources 함수 |
| 2 | `packages/mcp/src/resources/formResource.ts` | **신규** — registerFormResources 함수 |
| 3 | `packages/mcp/src/resources/index.ts` | **수정** — export 추가 |
| 4 | `packages/mcp/src/server.ts` | **수정** — registerResources에서 실제 호출 추가 |

## 7. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 6개 ResourceTemplate이 MCP 서버에 정상 등록
- [ ] 유효한 projectId/formId로 리소스 조회 시 JSON 응답 반환
- [ ] 존재하지 않는 ID로 조회 시 ApiError(404) 전파
- [ ] URI 패턴의 변수({projectId}, {formId})가 정상 추출
- [ ] MIME type이 `application/json`으로 설정
