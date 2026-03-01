# 프로젝트 관리 Tools 구현 계획

## 개요

`packages/mcp/src/tools/projects.ts` — MCP-SERVER.md 섹션 2.1에 정의된 프로젝트 관리 Tool 8개를 구현한다.
각 Tool은 `apiClient`를 통해 기존 Express REST API(`packages/server/src/routes/projects.ts`)에 매핑된다.

## 1. Tool → API 엔드포인트 매핑

| Tool | HTTP 메서드 | 엔드포인트 | 설명 |
|------|------------|-----------|------|
| `list_projects` | GET | `/api/projects?page&limit&search` | 프로젝트 목록 조회 (페이징) |
| `get_project` | GET | `/api/projects/:projectId` | 프로젝트 상세 조회 (폼 목록 포함) |
| `create_project` | POST | `/api/projects` | 프로젝트 생성 |
| `update_project` | PUT | `/api/projects/:projectId` | 프로젝트 수정 |
| `delete_project` | DELETE | `/api/projects/:projectId` | 프로젝트 삭제 (soft delete) |
| `export_project` | GET | `/api/projects/:projectId/export` | 프로젝트 JSON 내보내기 |
| `import_project` | POST | `/api/projects/import` | 프로젝트 JSON 가져오기 |
| `publish_all` | POST | `/api/projects/:projectId/publish-all` | 프로젝트 전체 폼 퍼블리시 |

## 2. Zod 스키마 설계

### 2.1 list_projects

```typescript
{
  page: z.number().int().positive().optional().describe('페이지 번호 (기본값: 1)'),
  limit: z.number().int().positive().max(100).optional().describe('페이지당 항목 수 (기본값: 20, 최대: 100)'),
  search: z.string().optional().describe('프로젝트명 검색어'),
}
```

### 2.2 get_project

```typescript
{
  projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
}
```

### 2.3 create_project

```typescript
{
  name: z.string().min(1).max(200).describe('프로젝트명'),
  description: z.string().max(1000).optional().describe('프로젝트 설명'),
}
```

### 2.4 update_project

```typescript
{
  projectId: z.string().describe('프로젝트 ID'),
  name: z.string().min(1).max(200).optional().describe('변경할 프로젝트명'),
  description: z.string().max(1000).optional().describe('변경할 프로젝트 설명'),
}
```

### 2.5 delete_project

```typescript
{
  projectId: z.string().describe('삭제할 프로젝트 ID'),
}
```

### 2.6 export_project

```typescript
{
  projectId: z.string().describe('내보낼 프로젝트 ID'),
}
```

### 2.7 import_project

```typescript
{
  data: z.object({
    project: z.object({
      name: z.string().min(1).describe('프로젝트명'),
      description: z.string().optional().describe('프로젝트 설명'),
      defaultFont: z.object({
        family: z.string(),
        size: z.number(),
        bold: z.boolean(),
        italic: z.boolean(),
        underline: z.boolean(),
        strikethrough: z.boolean(),
      }).optional().describe('기본 폰트 설정'),
    }).describe('프로젝트 정보'),
    forms: z.array(z.object({
      name: z.string().min(1).describe('폼 이름'),
      properties: z.record(z.unknown()).optional().describe('폼 속성'),
      controls: z.array(z.unknown()).optional().describe('컨트롤 배열'),
      eventHandlers: z.array(z.unknown()).optional().describe('이벤트 핸들러 배열'),
      dataBindings: z.array(z.unknown()).optional().describe('데이터 바인딩 배열'),
    })).describe('가져올 폼 목록'),
  }).describe('export_project로 내보낸 JSON 데이터'),
}
```

### 2.8 publish_all

```typescript
{
  projectId: z.string().describe('전체 퍼블리시할 프로젝트 ID'),
}
```

## 3. Tool description 설계

| Tool | description |
|------|------------|
| `list_projects` | `프로젝트 목록을 조회합니다. 페이징과 이름 검색을 지원합니다.` |
| `get_project` | `프로젝트 상세 정보와 소속 폼 목록을 조회합니다.` |
| `create_project` | `새 프로젝트를 생성합니다. 폼을 추가하려면 먼저 프로젝트를 생성해야 합니다.` |
| `update_project` | `프로젝트의 이름이나 설명을 수정합니다.` |
| `delete_project` | `프로젝트를 삭제합니다. 소속된 모든 폼도 함께 삭제됩니다.` |
| `export_project` | `프로젝트와 모든 폼을 JSON으로 내보냅니다. import_project로 다시 가져올 수 있습니다.` |
| `import_project` | `export_project로 내보낸 JSON 데이터를 가져와 새 프로젝트를 생성합니다.` |
| `publish_all` | `프로젝트의 모든 draft 폼을 한 번에 퍼블리시합니다.` |

## 4. 반환값 형식

모든 Tool은 MCP `CallToolResult` 형식을 반환한다. `content[0].text`에 JSON 문자열을 담는다.

### 4.1 list_projects 반환값

```json
{
  "projects": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "My Project",
      "description": "설명",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 4.2 get_project 반환값

```json
{
  "project": {
    "id": "507f1f77bcf86cd799439011",
    "name": "My Project",
    "description": "설명",
    "defaultFont": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "forms": [
    {
      "id": "607f1f77bcf86cd799439012",
      "name": "Form1",
      "status": "draft",
      "version": 2,
      "publishedVersion": 1
    }
  ]
}
```

### 4.3 create_project 반환값

```json
{
  "project": {
    "id": "507f1f77bcf86cd799439011",
    "name": "My Project",
    "description": "설명",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4.4 update_project 반환값

```json
{
  "project": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Updated Name",
    "description": "Updated description",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4.5 delete_project 반환값

```json
{
  "deleted": true,
  "projectId": "507f1f77bcf86cd799439011"
}
```

### 4.6 export_project 반환값

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "project": {
    "name": "My Project",
    "description": "설명",
    "defaultFont": null
  },
  "forms": [
    {
      "name": "Form1",
      "properties": { ... },
      "controls": [ ... ],
      "eventHandlers": [ ... ],
      "dataBindings": [ ... ]
    }
  ]
}
```

### 4.7 import_project 반환값

```json
{
  "project": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Imported Project",
    "description": "설명",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4.8 publish_all 반환값

```json
{
  "forms": {
    "publishedCount": 2,
    "skippedCount": 1,
    "totalCount": 3
  },
  "shell": {
    "published": true,
    "skipped": false
  }
}
```

## 5. 에러 처리

`apiClient`의 `ApiError`를 catch하여 MCP `isError: true` 응답으로 변환한다.

```typescript
try {
  // API 호출
} catch (error) {
  if (error instanceof ApiError) {
    return {
      content: [{ type: 'text', text: error.message }],
      isError: true,
    };
  }
  throw error;
}
```

`projectId` 파라미터가 있는 Tool은 API 호출 전에 `validateObjectId(projectId, 'projectId')`로 사전 검증한다.

## 6. 파일 구조

```
packages/mcp/src/
├── tools/
│   ├── index.ts          # export { registerProjectTools }
│   └── projects.ts       # 8개 Tool 핸들러 정의
├── server.ts             # registerProjectTools(server) 호출 활성화
└── utils/
    ├── apiClient.ts      # (기존) HTTP 클라이언트
    └── validators.ts     # (기존) validateObjectId
```

## 7. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `tools/projects.ts` 생성 — `registerProjectTools(server)` 함수 작성 | tools/projects.ts |
| 2 | 8개 Tool을 `server.tool()` 호출로 등록 | tools/projects.ts |
| 3 | `tools/index.ts`에서 `registerProjectTools` export | tools/index.ts |
| 4 | `server.ts`에서 import 및 호출 활성화 | server.ts |
| 5 | `pnpm --filter @webform/mcp typecheck` 검증 | — |

## 8. 구현 패턴 (예시: list_projects)

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

interface ListProjectsResponse {
  data: Array<{
    _id: string;
    name: string;
    description: string;
    defaultFont?: object | null;
    createdAt: string;
    updatedAt: string;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function registerProjectTools(server: McpServer): void {
  server.tool(
    'list_projects',
    '프로젝트 목록을 조회합니다. 페이징과 이름 검색을 지원합니다.',
    {
      page: z.number().int().positive().optional().describe('페이지 번호 (기본값: 1)'),
      limit: z.number().int().positive().max(100).optional().describe('페이지당 항목 수 (기본값: 20, 최대: 100)'),
      search: z.string().optional().describe('프로젝트명 검색어'),
    },
    async ({ page, limit, search }) => {
      try {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        if (search) params.set('search', search);
        const query = params.toString();
        const path = `/api/projects${query ? `?${query}` : ''}`;

        const res = await apiClient.get<ListProjectsResponse>(path);

        const result = {
          projects: res.data.map((p) => ({
            id: p._id,
            name: p.name,
            description: p.description,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
          meta: res.meta,
        };

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        if (error instanceof ApiError) {
          return { content: [{ type: 'text' as const, text: error.message }], isError: true };
        }
        throw error;
      }
    },
  );

  // ... 나머지 7개 Tool도 동일한 패턴으로 구현
}
```

## 9. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 8개 Tool이 모두 `server.tool()`로 등록됨
- [ ] `projectId` 파라미터가 있는 Tool에서 ObjectId 검증 수행
- [ ] API 에러 시 `isError: true` 응답 반환
- [ ] 반환값에서 `_id` → `id`로 필드명 정규화
