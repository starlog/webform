# ApplicationShell Tools 구현 계획

## 개요

`packages/mcp/src/tools/shells.ts` — MCP-SERVER.md 섹션 2.7에 정의된 5개 ApplicationShell Tools를 구현한다.

Shell은 프로젝트당 하나만 존재하며, 앱 수준 UI 컨트롤(MenuStrip, ToolStrip, StatusStrip 등)과 시작 폼을 관리한다. 기존 서버 API(`/api/projects/:projectId/shell`)를 래핑하는 단순 CRUD + publish 패턴으로, 이벤트 핸들러 Tools와 달리 get→mutate→put 패턴이 불필요하다.

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts        (수정 — registerShellTools export 추가)
└── shells.ts       (신규 — 5개 Tool 정의)

packages/mcp/src/
└── server.ts       (수정 — registerShellTools 호출 활성화)
```

## 2. Tool-API 엔드포인트 매핑

| # | Tool 이름 | HTTP 메서드 | 서버 엔드포인트 | 비고 |
|---|-----------|-------------|----------------|------|
| 1 | `get_shell` | GET | `/api/projects/:projectId/shell` | 없으면 `data: null` 반환 |
| 2 | `create_shell` | POST | `/api/projects/:projectId/shell` | 프로젝트당 1개 제한, 중복 시 409 |
| 3 | `update_shell` | PUT | `/api/projects/:projectId/shell` | version++, published→false 전환 |
| 4 | `delete_shell` | DELETE | `/api/projects/:projectId/shell` | soft delete, 204 No Content |
| 5 | `publish_shell` | POST | `/api/projects/:projectId/shell/publish` | 이미 published면 409 |

## 3. Shell 구조 및 타입 참조

### 3.1 ApplicationShellDefinition (`@webform/common`)

```typescript
interface ApplicationShellDefinition {
  id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
}
```

### 3.2 ShellProperties (`@webform/common`)

```typescript
interface ShellProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  showTitleBar: boolean;
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
  windowState?: 'Normal' | 'Maximized';
  theme?: ThemeId;
}
```

### 3.3 Shell 이벤트 (`@webform/common`)

```typescript
const SHELL_EVENTS = ['Load', 'FormChanged', 'BeforeFormChange'] as const;
```

### 3.4 서버 Shell 모델 (ShellDocument)

서버 모델은 추가로 `published`, `createdBy`, `updatedBy`, `deletedAt`, `createdAt`, `updatedAt` 필드를 포함한다.

## 4. 각 Tool 상세 설계

### 4.1 get_shell

```typescript
server.tool(
  'get_shell',
  '프로젝트의 ApplicationShell 정의를 조회합니다. Shell이 없는 프로젝트는 data: null을 반환합니다.',
  {
    projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. `apiClient.get<GetShellResponse>('/api/projects/' + projectId + '/shell')`
3. 응답의 `data`가 null이면 `toolResult({ projectId, shell: null })` 반환
4. 있으면 Shell 데이터를 포함하여 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"projectId\": \"...\", \"shell\": { \"name\": \"MyApp\", \"version\": 1, \"published\": false, \"properties\": {...}, \"controls\": [...], \"eventHandlers\": [...], \"startFormId\": \"...\" } }"
  }]
}
```

### 4.2 create_shell

```typescript
server.tool(
  'create_shell',
  `프로젝트에 ApplicationShell을 생성합니다. 프로젝트당 하나의 Shell만 허용됩니다.

Shell은 앱 수준의 UI 프레임(MenuStrip, ToolStrip, StatusStrip 등)을 정의합니다.
properties로 Shell 창의 크기/제목/테마 등을 설정하고, startFormId로 시작 폼을 지정합니다.`,
  {
    projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
    name: z.string().describe('Shell 이름'),
    properties: z.object({
      title: z.string().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      backgroundColor: z.string().optional(),
      showTitleBar: z.boolean().optional(),
      formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).optional(),
      maximizeBox: z.boolean().optional(),
      minimizeBox: z.boolean().optional(),
      windowState: z.enum(['Normal', 'Maximized']).optional(),
      theme: z.string().optional(),
    }).optional().describe('Shell 속성 (미지정 시 기본값 적용)'),
    controls: z.array(z.record(z.string(), z.unknown())).optional()
      .describe('Shell 컨트롤 배열 (MenuStrip, ToolStrip, StatusStrip 등)'),
    startFormId: z.string().optional()
      .describe('시작 폼 ID (Shell 로드 시 최초 표시할 폼)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. `apiClient.post<MutateShellResponse>('/api/projects/' + projectId + '/shell', body)`
3. 409 에러 시: `"이 프로젝트에 이미 Shell이 존재합니다. update_shell을 사용하세요."`
4. 성공 시 생성된 Shell 데이터 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"projectId\": \"...\", \"shellId\": \"...\", \"name\": \"MyApp\", \"version\": 1, \"published\": false }"
  }]
}
```

### 4.3 update_shell

```typescript
server.tool(
  'update_shell',
  `프로젝트 Shell을 수정합니다. 수정 시 version이 증가하고 published가 false로 전환됩니다.
재배포하려면 publish_shell을 다시 호출하세요.`,
  {
    projectId: z.string().describe('프로젝트 ID'),
    properties: z.object({
      title: z.string().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      backgroundColor: z.string().optional(),
      showTitleBar: z.boolean().optional(),
      formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).optional(),
      maximizeBox: z.boolean().optional(),
      minimizeBox: z.boolean().optional(),
      windowState: z.enum(['Normal', 'Maximized']).optional(),
      theme: z.string().optional(),
    }).optional().describe('수정할 Shell 속성 (부분 업데이트)'),
    controls: z.array(z.record(z.string(), z.unknown())).optional()
      .describe('전체 컨트롤 배열 (전체 교체)'),
    eventHandlers: z.array(z.object({
      controlId: z.string(),
      eventName: z.string(),
      handlerType: z.enum(['server', 'client']).optional().default('server'),
      handlerCode: z.string(),
    })).optional().describe('전체 이벤트 핸들러 배열 (전체 교체)'),
    startFormId: z.string().nullable().optional()
      .describe('시작 폼 ID (null로 설정 시 해제)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. 요청 body 구성: 제공된 필드만 포함
3. `apiClient.put<MutateShellResponse>('/api/projects/' + projectId + '/shell', body)`
4. 404 에러 시: `"Shell을 찾을 수 없습니다. create_shell로 먼저 생성하세요."`
5. 성공 시 업데이트된 Shell 데이터 반환

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"projectId\": \"...\", \"shellId\": \"...\", \"name\": \"MyApp\", \"version\": 2, \"published\": false }"
  }]
}
```

### 4.4 delete_shell

```typescript
server.tool(
  'delete_shell',
  '프로젝트의 Shell을 삭제합니다 (soft delete). 삭제 후 create_shell로 새 Shell을 생성할 수 있습니다.',
  {
    projectId: z.string().describe('프로젝트 ID'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. `apiClient.delete('/api/projects/' + projectId + '/shell')`
3. 204 응답 → 성공 결과 반환
4. 404 에러 시: `"Shell을 찾을 수 없습니다: projectId={projectId}"`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"projectId\": \"...\", \"deleted\": true }"
  }]
}
```

### 4.5 publish_shell

```typescript
server.tool(
  'publish_shell',
  `Shell을 퍼블리시합니다. 퍼블리시된 Shell은 런타임에서 사용 가능합니다.
이미 published 상태이면 409 에러를 반환합니다. 수정 후 재퍼블리시하려면 update_shell로 수정 후 다시 호출하세요.`,
  {
    projectId: z.string().describe('프로젝트 ID'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(projectId, 'projectId')`
2. `apiClient.post<MutateShellResponse>('/api/projects/' + projectId + '/shell/publish', {})`
3. 409 에러 시: `"Shell이 이미 published 상태입니다. 수정 후 재퍼블리시하세요."`
4. 404 에러 시: `"Shell을 찾을 수 없습니다. create_shell로 먼저 생성하세요."`

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"projectId\": \"...\", \"shellId\": \"...\", \"name\": \"MyApp\", \"version\": 1, \"published\": true }"
  }]
}
```

## 5. 에러 처리

이벤트 핸들러 Tools와 달리 Shell은 직접 서버 API를 호출하는 단순 패턴이므로, `withEventHandlerMutation` 같은 헬퍼가 불필요하다. 각 Tool에서 개별적으로 에러를 처리한다.

### 5.1 공통 에러 핸들러

```typescript
function handleShellToolError(error: unknown, projectId: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(`Shell을 찾을 수 없습니다: projectId=${projectId}. create_shell로 먼저 생성하세요.`);
    }
    if (error.status === 409) {
      return toolError(`Shell 충돌: ${error.detail || error.message}`);
    }
    return toolError(error.message);
  }
  if (error instanceof Error && error.message.includes('유효하지 않은')) {
    return toolError(error.message);
  }
  throw error;
}
```

### 5.2 Tool별 에러 분기

| 에러 상황 | HTTP 상태 | 발생 Tool | 메시지 |
|-----------|-----------|-----------|--------|
| Shell 없음 | 404 | get(null반환), update, delete, publish | "Shell을 찾을 수 없습니다" |
| Shell 이미 존재 | 409 | create | "이미 Shell이 존재합니다. update_shell을 사용하세요." |
| 이미 published | 409 | publish | "Shell이 이미 published 상태입니다." |
| 잘못된 projectId | 검증 에러 | 모든 Tool | "유효하지 않은 projectId" |

## 6. API 응답 타입 정의

```typescript
interface ShellData {
  _id: string;
  projectId: string;
  name: string;
  version: number;
  properties: Record<string, unknown>;
  controls: Array<Record<string, unknown>>;
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: 'server' | 'client';
    handlerCode: string;
  }>;
  startFormId?: string;
  published: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface GetShellResponse {
  data: ShellData | null;
}

interface MutateShellResponse {
  data: ShellData;
}
```

## 7. registerShellTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

function handleShellToolError(error: unknown, projectId: string) {
  // ... (5.1 참조)
}

export function registerShellTools(server: McpServer): void {
  // 1. get_shell
  server.tool('get_shell', ...);

  // 2. create_shell
  server.tool('create_shell', ...);

  // 3. update_shell
  server.tool('update_shell', ...);

  // 4. delete_shell
  server.tool('delete_shell', ...);

  // 5. publish_shell
  server.tool('publish_shell', ...);
}
```

## 8. server.ts 수정

```typescript
import { registerShellTools } from './tools/shells.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  registerControlTools(server);
  registerEventTools(server);

  // Phase 3: Shell Tools
  registerShellTools(server);

  // Phase 3 (추가):
  // registerDatasourceTools(server);
  // registerThemeTools(server);
}
```

## 9. tools/index.ts 수정

```typescript
export { registerProjectTools } from './projects.js';
export { registerFormTools } from './forms.js';
export { registerControlTools } from './controls.js';
export { registerEventTools } from './events.js';
export { registerShellTools } from './shells.js';
```

## 10. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/tools/shells.ts` | **신규** — 5개 Tool + 타입 + 에러 처리 |
| 2 | `packages/mcp/src/tools/index.ts` | **수정** — `registerShellTools` export 추가 |
| 3 | `packages/mcp/src/server.ts` | **수정** — `registerShellTools` import + 호출 활성화 |

## 11. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 5개 Tool이 모두 MCP 서버에 등록됨 (server.tool 호출 5회)
- [ ] get_shell: Shell 없는 경우 `{ shell: null }` 정상 반환
- [ ] create_shell: 프로젝트당 중복 생성 시 409 에러 + 안내 메시지
- [ ] update_shell: properties 부분 업데이트, controls/eventHandlers 전체 교체
- [ ] update_shell: startFormId를 null로 전달 시 해제 가능
- [ ] delete_shell: 삭제 성공 시 `{ deleted: true }` 반환
- [ ] publish_shell: 이미 published면 409 에러 + 안내 메시지
- [ ] 모든 Tool에서 잘못된 projectId(비-ObjectId) 시 검증 에러 반환
- [ ] 모든 Tool에서 404/409 에러 시 사용자 친화적 메시지 반환
- [ ] Tool description에 Shell 개념 설명 포함 (create_shell)
