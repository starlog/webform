# MCP 테마 Tools 구현 계획

## 1. 개요

MCP-SERVER.md 섹션 2.8에 정의된 테마 관련 6개 Tool과 1개 Resource를 구현한다.

| Tool 이름 | 설명 | 서버 API |
|-----------|------|----------|
| `list_themes` | 테마 목록 조회 | `GET /api/themes?page&limit` |
| `get_theme` | 테마 상세 조회 | `GET /api/themes/:id` |
| `create_theme` | 커스텀 테마 생성 | `POST /api/themes` |
| `update_theme` | 커스텀 테마 수정 | `PUT /api/themes/:id` |
| `delete_theme` | 커스텀 테마 삭제 | `DELETE /api/themes/:id` |
| `apply_theme_to_form` | 폼에 테마 적용 | `GET /api/forms/:id` → `PUT /api/forms/:id` |

| Resource | URI 패턴 | 설명 |
|----------|----------|------|
| `theme-detail` | `webform://themes/{themeId}` | 테마 토큰 상세 |

## 2. 기존 서버 API 분석

### 2.1 테마 API 엔드포인트 (이미 구현됨)

서버 패키지에 테마 CRUD가 모두 구현되어 있다:

- **라우트**: `packages/server/src/routes/themes.ts`
- **서비스**: `packages/server/src/services/ThemeService.ts`
- **모델**: `packages/server/src/models/Theme.ts`
- **검증**: `packages/server/src/validators/themeValidator.ts`

#### API 응답 형식

```typescript
// GET /api/themes — 목록
{
  data: ThemeDocument[],
  meta: { total, page, limit, totalPages }
}

// GET /api/themes/:id — 상세
{ data: ThemeDocument }

// POST /api/themes — 생성 (201)
{ data: ThemeDocument }

// PUT /api/themes/:id — 수정
{ data: ThemeDocument }

// DELETE /api/themes/:id — 삭제 (204 No Content)
```

#### ThemeDocument 구조

```typescript
interface ThemeDocument {
  _id: string;
  name: string;
  basePreset?: string;
  tokens: ThemeTokens;
  isPreset: boolean;
  presetId?: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 ThemeTokens 구조 (`packages/common/src/types/theme.ts`)

```typescript
interface ThemeTokens {
  id: ThemeId;           // string
  name: string;
  window: WindowTokens;  // titleBar, border, borderRadius, shadow
  form: FormTokens;      // backgroundColor, foreground, fontFamily, fontSize
  controls: ControlTokens; // button, textInput, select, checkRadio, panel, groupBox,
                           // tabControl, dataGrid, progressBar, menuStrip, toolStrip,
                           // statusStrip, scrollbar
  accent: AccentTokens;  // primary, primaryHover, primaryForeground
  popup: PopupTokens;    // background, border, shadow, borderRadius, hoverBackground
}
```

### 2.3 폼의 테마 속성

폼 모델(`packages/server/src/models/Form.ts`)의 `properties` 내에 `theme` 필드가 존재:

```typescript
properties: {
  theme: { type: String },  // 테마 ID
  themeColorMode: { type: String, enum: ['theme', 'control'] },
}
```

### 2.4 서버 API 제약사항

- 프리셋 테마(`isPreset: true`)는 수정/삭제 불가 (403 에러)
- 삭제는 소프트 삭제 (`deletedAt` 설정)
- 목록 조회 기본값: `page=1`, `limit=100`, 최대 `limit=200`
- JWT 인증 필요 (MCP apiClient가 처리)

## 3. 구현 파일 목록

### 3.1 생성 파일

| 파일 | 설명 |
|------|------|
| `packages/mcp/src/tools/themes.ts` | 테마 6개 Tool 등록 |
| `packages/mcp/src/resources/themeResource.ts` | 테마 동적 Resource 등록 |

### 3.2 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `packages/mcp/src/tools/index.ts` | `registerThemeTools` export 추가 |
| `packages/mcp/src/resources/index.ts` | `registerThemeResources` export 추가 |
| `packages/mcp/src/server.ts` | 주석 해제: `registerThemeTools(server)`, `registerThemeResources(server)` 추가 |

## 4. 상세 구현 명세

### 4.1 `packages/mcp/src/tools/themes.ts`

기존 `projects.ts`, `forms.ts` 패턴을 따른다.

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---
interface ThemeDocument { ... }
interface ListThemesResponse { data: ThemeDocument[]; meta: { ... } }
interface GetThemeResponse { data: ThemeDocument }
interface MutateThemeResponse { data: ThemeDocument }

// --- 헬퍼 ---
function toolResult(data: unknown) { ... }
function toolError(message: string) { ... }

export function registerThemeTools(server: McpServer): void { ... }
```

#### Tool 1: `list_themes`

```typescript
server.tool(
  'list_themes',
  '테마 목록을 조회합니다. 프리셋 테마와 커스텀 테마를 모두 포함하며, 프리셋 우선 정렬됩니다.',
  {
    page: z.number().int().positive().optional()
      .describe('페이지 번호 (기본값: 1)'),
    limit: z.number().int().positive().max(200).optional()
      .describe('페이지당 항목 수 (기본값: 100, 최대: 200)'),
  },
  async ({ page, limit }) => {
    // URLSearchParams로 쿼리 구성
    // GET /api/themes?page=&limit=
    // 응답: { themes: [...], meta: {...} }
  },
);
```

**응답 매핑**:
- `id` ← `_id`
- `name`, `isPreset`, `presetId`, `basePreset`
- `createdAt`, `updatedAt`
- (tokens 제외 — 목록에서는 토큰 전체를 포함하지 않음)

#### Tool 2: `get_theme`

```typescript
server.tool(
  'get_theme',
  '테마의 상세 정보와 토큰 값을 조회합니다.',
  {
    themeId: z.string().describe('테마 ID (MongoDB ObjectId)'),
  },
  async ({ themeId }) => {
    // validateObjectId(themeId, 'themeId')
    // GET /api/themes/:themeId
    // 응답: 전체 테마 정보 + tokens
  },
);
```

**응답 매핑**: 전체 ThemeDocument (tokens 포함)

#### Tool 3: `create_theme`

```typescript
server.tool(
  'create_theme',
  '새 커스텀 테마를 생성합니다. tokens에 ThemeTokens 구조를 전달합니다.',
  {
    name: z.string().min(1).max(200).describe('테마 이름 (1~200자)'),
    tokens: z.record(z.unknown()).describe('테마 토큰 (ThemeTokens 구조)'),
    basePreset: z.string().optional().describe('기반 프리셋 테마 ID (참조용)'),
  },
  async ({ name, tokens, basePreset }) => {
    // POST /api/themes { name, tokens, basePreset }
    // 201 응답
  },
);
```

**참고**: `tokens`는 `z.record(z.unknown())`으로 받고, 서버 측에서 유효성 검증한다. MCP 도구 레벨에서 ThemeTokens의 깊은 구조를 Zod로 정의하면 스키마가 과도하게 복잡해지므로, 서버 검증에 위임한다.

#### Tool 4: `update_theme`

```typescript
server.tool(
  'update_theme',
  '커스텀 테마를 수정합니다. 프리셋 테마는 수정할 수 없습니다.',
  {
    themeId: z.string().describe('수정할 테마 ID'),
    name: z.string().min(1).max(200).optional().describe('변경할 테마 이름'),
    tokens: z.record(z.unknown()).optional().describe('변경할 테마 토큰'),
  },
  async ({ themeId, name, tokens }) => {
    // validateObjectId(themeId, 'themeId')
    // PUT /api/themes/:themeId { name?, tokens? }
    // 403 에러 처리: 프리셋 테마 수정 시도 시 안내 메시지
  },
);
```

**에러 처리**:
- 403: `'프리셋 테마는 수정할 수 없습니다.'`
- 404: `'테마를 찾을 수 없습니다: {themeId}'`

#### Tool 5: `delete_theme`

```typescript
server.tool(
  'delete_theme',
  '커스텀 테마를 삭제합니다 (소프트 삭제). 프리셋 테마는 삭제할 수 없습니다.',
  {
    themeId: z.string().describe('삭제할 테마 ID'),
  },
  async ({ themeId }) => {
    // validateObjectId(themeId, 'themeId')
    // DELETE /api/themes/:themeId
    // 204 성공
    // 403 에러 처리: 프리셋 테마 삭제 시도 시 안내 메시지
  },
);
```

**응답**: `{ deleted: true, themeId }`

#### Tool 6: `apply_theme_to_form`

```typescript
server.tool(
  'apply_theme_to_form',
  '폼에 테마를 적용합니다. 폼의 properties.theme 값을 변경합니다.',
  {
    formId: z.string().describe('테마를 적용할 폼 ID'),
    themeId: z.string().describe('적용할 테마 ID'),
  },
  async ({ formId, themeId }) => {
    // 1. validateObjectId(formId, 'formId'), validateObjectId(themeId, 'themeId')
    // 2. GET /api/themes/:themeId → 테마 존재 확인
    // 3. GET /api/forms/:formId → 현재 폼 조회 (version 확보)
    // 4. PUT /api/forms/:formId { version, properties: { theme: themeId } }
    // 5. 409 충돌 시 자동 재시도 (1회)
  },
);
```

**구현 흐름**:
1. 테마 존재 여부 확인 (`GET /api/themes/:themeId`)
2. 현재 폼 조회 (`GET /api/forms/:formId`) — version 값 확보
3. 폼 속성 업데이트 (`PUT /api/forms/:formId`) — `{ version, properties: { theme: themeId } }`
4. 버전 충돌(409) 시 1회 자동 재시도 (폼 재조회 → 재시도)

**응답**:
```typescript
{
  applied: true,
  formId,
  formName,
  themeId,
  themeName,
  version: newVersion, // 업데이트된 폼 버전
}
```

**에러 처리**:
- 테마 404: `'테마를 찾을 수 없습니다: {themeId}'`
- 폼 404: `'폼을 찾을 수 없습니다: {formId}'`
- 409 (재시도 실패): `'버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. 다시 시도하세요.'`

### 4.2 `packages/mcp/src/resources/themeResource.ts`

기존 `formResource.ts` 패턴을 따른다.

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/index.js';

export function registerThemeResources(server: McpServer): void {
  // webform://themes/{themeId} — 테마 토큰 상세
  server.resource(
    'theme-detail',
    new ResourceTemplate('webform://themes/{themeId}', { list: undefined }),
    async (uri, { themeId }) => {
      const response = await apiClient.get<{ data: unknown }>(`/api/themes/${themeId}`);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    },
  );
}
```

### 4.3 `packages/mcp/src/tools/index.ts` 수정

```typescript
export { registerThemeTools } from './themes.js';
```

### 4.4 `packages/mcp/src/resources/index.ts` 수정

```typescript
export { registerThemeResources } from './themeResource.js';
```

### 4.5 `packages/mcp/src/server.ts` 수정

```typescript
import { registerThemeTools } from './tools/index.js';
import { registerThemeResources } from './resources/index.js';

// Phase 3 주석 해제:
registerThemeTools(server);

// Resources에 추가:
registerThemeResources(server);
```

## 5. 에러 처리 전략

기존 MCP 도구 패턴과 동일:

```typescript
try {
  // API 호출
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 403) return toolError('프리셋 테마는 수정/삭제할 수 없습니다.');
    if (error.status === 404) return toolError('테마를 찾을 수 없습니다: ...');
    return toolError(error.message);
  }
  if (error instanceof Error && error.message.includes('유효하지 않은'))
    return toolError(error.message);
  throw error;
}
```

## 6. 테스트 계획

### 6.1 단위 테스트 (`packages/mcp/src/__tests__/themes.test.ts`)

기존 `phase2-integration.test.ts` 패턴을 참고하여:

1. **list_themes**: 빈 목록 / 프리셋+커스텀 혼합 목록 / 페이징
2. **get_theme**: 존재하는 테마 / 404 에러
3. **create_theme**: 정상 생성 / 필수 필드 누락
4. **update_theme**: 정상 수정 / 프리셋 수정 시 403
5. **delete_theme**: 정상 삭제 / 프리셋 삭제 시 403
6. **apply_theme_to_form**: 정상 적용 / 테마 미존재 / 폼 미존재 / 버전 충돌 재시도

### 6.2 검증 항목

- `validateObjectId` 호출 확인
- API 응답 매핑 정확성
- 에러 메시지 한국어 확인
- `apply_theme_to_form`의 낙관적 잠금 흐름

## 7. 구현 순서

1. `packages/mcp/src/tools/themes.ts` — 6개 Tool 구현
2. `packages/mcp/src/resources/themeResource.ts` — Resource 구현
3. `packages/mcp/src/tools/index.ts` — export 추가
4. `packages/mcp/src/resources/index.ts` — export 추가
5. `packages/mcp/src/server.ts` — 등록 호출 추가
6. 테스트 작성 및 실행
