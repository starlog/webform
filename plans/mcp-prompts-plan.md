# MCP Prompt 템플릿 구현 계획

## 1. 개요

MCP-SERVER.md 섹션 4.1~4.5에 정의된 5개 Prompt 템플릿을 구현한다. Prompt는 자주 사용하는 멀티스텝 워크플로우를 사전 정의한 메시지 템플릿으로, AI 어시스턴트가 여러 Tool을 조합하여 복잡한 작업을 수행하도록 안내한다.

| Prompt 이름 | 설명 | 입력 파라미터 |
|-------------|------|---------------|
| `create-form-wizard` | 대화형 폼 생성 마법사 | `projectId`, `description` |
| `add-crud-handlers` | CRUD 이벤트 핸들러 자동 생성 | `formId`, `dataSourceId`, `entityName` |
| `setup-navigation` | Shell + 폼 네비게이션 구성 | `projectId`, `formIds` |
| `clone-and-modify-form` | 기존 폼 복제 후 수정 | `sourceFormId`, `newName`, `modifications` |
| `design-theme` | 자연어로 테마 생성 | `description`, `baseTheme?` |

## 2. MCP Prompt 개념

### 2.1 MCP Prompt란

MCP Prompt는 `server.prompt()` API로 등록하며, 클라이언트(AI 어시스턴트)가 `prompts/list`로 목록을 조회하고 `prompts/get`으로 메시지를 가져온다. 반환된 메시지는 AI의 대화 컨텍스트에 주입되어, AI가 적절한 Tool 호출 순서를 따르도록 안내한다.

### 2.2 Prompt vs Tool

- **Tool**: 단일 원자적 작업 (예: `create_form`, `add_control`)
- **Prompt**: 여러 Tool을 조합한 워크플로우 레시피 (예: 폼 생성 → 컨트롤 배치 → 이벤트 설정)

Prompt 자체는 API 호출을 하지 않으며, AI가 메시지를 읽고 순서대로 Tool을 호출하도록 유도한다.

### 2.3 `server.prompt()` API 시그니처

```typescript
server.prompt(
  name: string,           // Prompt 이름
  schema: ZodRawShape,    // 입력 파라미터 Zod 스키마
  handler: (args) => {    // 메시지 생성 핸들러
    messages: Array<{
      role: 'user' | 'assistant',
      content: { type: 'text', text: string }
    }>
  }
);
```

## 3. 구현 파일 목록

### 3.1 생성 파일

| 파일 | 설명 |
|------|------|
| `packages/mcp/src/prompts/createForm.ts` | create-form-wizard Prompt |
| `packages/mcp/src/prompts/crudHandlers.ts` | add-crud-handlers Prompt |
| `packages/mcp/src/prompts/setupNavigation.ts` | setup-navigation Prompt |
| `packages/mcp/src/prompts/cloneForm.ts` | clone-and-modify-form Prompt |
| `packages/mcp/src/prompts/designTheme.ts` | design-theme Prompt |
| `packages/mcp/src/prompts/index.ts` | registerPrompts 통합 함수 (기존 placeholder 덮어쓰기) |

### 3.2 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `packages/mcp/src/server.ts` | `registerPrompts` import 경로 변경 및 실제 호출 활성화 |

## 4. 상세 구현 명세

### 4.1 `packages/mcp/src/prompts/createForm.ts`

대화형 폼 생성 마법사. 자연어 설명을 분석하여 폼 → 컨트롤 → 이벤트 → 데이터 바인딩을 순차적으로 구성한다.

#### Zod 스키마

```typescript
{
  projectId: z.string().describe('대상 프로젝트 ID'),
  description: z.string().describe('만들 폼에 대한 자연어 설명'),
}
```

#### 메시지 템플릿

```typescript
export function registerCreateFormPrompt(server: McpServer): void {
  server.prompt(
    'create-form-wizard',
    {
      projectId: z.string().describe('대상 프로젝트 ID'),
      description: z.string().describe('만들 폼에 대한 자연어 설명'),
    },
    ({ projectId, description }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `WebForm 프로젝트(${projectId})에 다음 폼을 만들어주세요:

${description}

단계:
1. 설명을 분석하여 필요한 컨트롤 목록 도출
2. create_form으로 폼 생성
3. batch_add_controls로 컨트롤 일괄 배치 (적절한 position/size 자동 계산)
4. 필요 시 이벤트 핸들러 추가 (add_event_handler)
5. 데이터 바인딩 설정 (add_data_binding)
6. 결과 폼 요약 출력`,
          },
        },
      ],
    }),
  );
}
```

#### 참조하는 Tool/Resource

| 단계 | Tool/Resource | 용도 |
|------|---------------|------|
| 사전 조사 | `webform://schema/control-types` | 사용 가능한 컨트롤 타입 파악 |
| 사전 조사 | `webform://guide/handler-examples` | 이벤트 핸들러 코드 패턴 참고 |
| 1단계 | (AI 추론) | 설명 분석 → 컨트롤 목록 도출 |
| 2단계 | `create_form` | 폼 생성 (name, projectId, properties) |
| 3단계 | `batch_add_controls` | 최대 50개 컨트롤 일괄 배치 |
| 4단계 | `add_event_handler` | 버튼 Click 등 이벤트 핸들러 등록 |
| 5단계 | `add_data_binding` | 컨트롤-데이터소스 바인딩 설정 |

### 4.2 `packages/mcp/src/prompts/crudHandlers.ts`

CRUD 이벤트 핸들러 자동 생성. 기존 폼의 DataGridView, 입력 컨트롤, 버튼을 분석하여 조회/추가/수정/삭제 핸들러를 생성한다.

#### Zod 스키마

```typescript
{
  formId: z.string().describe('대상 폼 ID'),
  dataSourceId: z.string().describe('데이터소스 ID'),
  entityName: z.string().describe('엔티티 이름 (예: "사용자", "주문")'),
}
```

#### 메시지 템플릿

```typescript
export function registerCrudHandlersPrompt(server: McpServer): void {
  server.prompt(
    'add-crud-handlers',
    {
      formId: z.string().describe('대상 폼 ID'),
      dataSourceId: z.string().describe('데이터소스 ID'),
      entityName: z.string().describe('엔티티 이름 (예: "사용자", "주문")'),
    },
    ({ formId, dataSourceId, entityName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `폼(${formId})에 "${entityName}" CRUD 핸들러를 구성해주세요.

데이터소스: ${dataSourceId}

단계:
1. 폼 정의 조회 → DataGridView, 입력 컨트롤, 버튼 식별
2. "조회" 버튼 Click: 데이터소스에서 목록 로드 → DataGridView 바인딩
3. "추가" 버튼 Click: 입력 값 → 데이터소스 insert
4. "수정" 버튼 Click: 선택된 행 → 데이터소스 update
5. "삭제" 버튼 Click: 선택된 행 → 데이터소스 delete
6. DataGridView CellClick: 선택 행 → 입력 컨트롤에 채우기
7. 각 핸들러에 에러 처리 및 showMessage 포함`,
          },
        },
      ],
    }),
  );
}
```

#### 참조하는 Tool/Resource

| 단계 | Tool/Resource | 용도 |
|------|---------------|------|
| 사전 조사 | `get_form` 또는 `webform://forms/{formId}` | 폼 정의 조회 |
| 사전 조사 | `get_datasource` | 데이터소스 스키마 확인 |
| 사전 조사 | `webform://guide/event-context` | ctx API 참고 |
| 1단계 | `list_event_handlers` | 기존 핸들러 확인 (중복 방지) |
| 2~6단계 | `add_event_handler` (×6) | 각 CRUD 핸들러 등록 |

#### 생성될 핸들러 코드 패턴

```typescript
// 조회 핸들러 예시
`const data = await ctx.dataSources['${dataSourceId}'].query({});
ctx.controls['dgv${entityName}'].dataSource = data;
ctx.showMessage('${entityName} 목록을 조회했습니다.', '조회', 'info');`

// 추가 핸들러 예시
`const newItem = { /* 입력 컨트롤에서 수집 */ };
await ctx.dataSources['${dataSourceId}'].insert(newItem);
ctx.showMessage('${entityName}이(가) 추가되었습니다.', '추가', 'info');`

// 삭제 핸들러 예시
`const selected = ctx.controls['dgv${entityName}'].selectedRow;
if (!selected) { ctx.showMessage('삭제할 항목을 선택하세요.', '삭제', 'warning'); return; }
await ctx.dataSources['${dataSourceId}'].delete({ _id: selected._id });
ctx.showMessage('${entityName}이(가) 삭제되었습니다.', '삭제', 'info');`
```

### 4.3 `packages/mcp/src/prompts/setupNavigation.ts`

Shell + 폼 네비게이션 구성. 프로젝트에 Application Shell을 생성하고 MenuStrip을 통해 각 폼으로의 네비게이션을 설정한다.

#### Zod 스키마

```typescript
{
  projectId: z.string().describe('프로젝트 ID'),
  formIds: z.string().describe('폼 ID 목록 (쉼표 구분)'),
}
```

#### 메시지 템플릿

```typescript
export function registerSetupNavigationPrompt(server: McpServer): void {
  server.prompt(
    'setup-navigation',
    {
      projectId: z.string().describe('프로젝트 ID'),
      formIds: z.string().describe('폼 ID 목록 (쉼표 구분)'),
    },
    ({ projectId, formIds }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `프로젝트(${projectId})에 네비게이션을 구성해주세요.

폼: ${formIds}

단계:
1. 프로젝트 상세 및 각 폼 정보 조회
2. Shell이 없으면 create_shell로 생성 (MenuStrip + StatusStrip 포함)
3. MenuStrip에 각 폼으로의 메뉴 아이템 추가
4. 메뉴 클릭 이벤트 → ctx.navigate(formId)
5. 첫 번째 폼을 startFormId로 설정
6. Shell 퍼블리시`,
          },
        },
      ],
    }),
  );
}
```

#### 참조하는 Tool/Resource

| 단계 | Tool/Resource | 용도 |
|------|---------------|------|
| 1단계 | `get_project` | 프로젝트 정보 및 기존 Shell 확인 |
| 1단계 | `get_form` (×N) | 각 폼 이름/타이틀 확인 |
| 2단계 | `get_shell` | 기존 Shell 존재 여부 확인 |
| 2단계 | `create_shell` | Shell 생성 (없는 경우) |
| 2단계 | `update_shell` | Shell 수정 (있는 경우) |
| 3~4단계 | Shell의 `menuStrip.items` 설정 | 메뉴 아이템 + 이벤트 |
| 5단계 | Shell의 `startFormId` 설정 | 시작 폼 지정 |
| 6단계 | `publish_shell` | Shell 퍼블리시 |

#### Shell 구성 예시

```typescript
// create_shell 호출 시 전달할 구조
{
  projectId,
  startFormId: formIds.split(',')[0].trim(),
  menuStrip: {
    items: formIds.split(',').map(id => ({
      label: /* 폼 이름 */,
      action: { type: 'navigate', formId: id.trim() }
    }))
  },
  statusStrip: {
    items: [
      { type: 'label', text: '준비' }
    ]
  }
}
```

### 4.4 `packages/mcp/src/prompts/cloneForm.ts`

기존 폼을 복제하고 수정. 원본 폼의 컨트롤, 이벤트 핸들러, 데이터 바인딩을 모두 복사한 후 자연어 변경 사항을 적용한다.

#### Zod 스키마

```typescript
{
  sourceFormId: z.string().describe('원본 폼 ID'),
  newName: z.string().describe('새 폼 이름'),
  modifications: z.string().describe('변경 사항 설명'),
}
```

#### 메시지 템플릿

```typescript
export function registerCloneFormPrompt(server: McpServer): void {
  server.prompt(
    'clone-and-modify-form',
    {
      sourceFormId: z.string().describe('원본 폼 ID'),
      newName: z.string().describe('새 폼 이름'),
      modifications: z.string().describe('변경 사항 설명'),
    },
    ({ sourceFormId, newName, modifications }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `폼(${sourceFormId})을 "${newName}"으로 복제하고 수정해주세요.

변경 사항: ${modifications}

단계:
1. get_form으로 원본 폼 정의 조회
2. create_form으로 새 폼 생성 (같은 projectId)
3. 원본 컨트롤을 batch_add_controls로 복사
4. 원본 이벤트 핸들러 복사
5. 변경 사항 적용 (컨트롤 추가/삭제/수정, 핸들러 변경)
6. 결과 요약`,
          },
        },
      ],
    }),
  );
}
```

#### 참조하는 Tool/Resource

| 단계 | Tool/Resource | 용도 |
|------|---------------|------|
| 1단계 | `get_form` | 원본 폼 전체 정의 (controls, eventHandlers, dataBindings) |
| 2단계 | `create_form` | 새 폼 생성 (같은 projectId, 원본 properties 복사) |
| 3단계 | `batch_add_controls` | 원본 컨트롤 일괄 복사 (position/size/properties 유지) |
| 4단계 | `add_event_handler` (×N) | 원본 이벤트 핸들러 복사 |
| 4단계 | `add_data_binding` (×N) | 원본 데이터 바인딩 복사 |
| 5단계 | (AI 추론 + 각종 Tool) | 변경 사항에 따라 적절한 Tool 호출 |

#### 복사 시 주의사항

- 컨트롤 복사 시 `id`는 새로 생성됨 (batch_add_controls가 자동 할당)
- 이벤트 핸들러의 `controlId`는 새 컨트롤 ID로 매핑해야 함
- 데이터 바인딩의 `controlId`도 동일하게 매핑 필요
- 메시지 템플릿에서 이 매핑 필요성을 명시적으로 안내

### 4.5 `packages/mcp/src/prompts/designTheme.ts`

자연어로 테마 생성. 설명에 맞는 색상 팔레트, 폰트, 간격 등의 디자인 토큰을 생성한다.

#### Zod 스키마

```typescript
{
  description: z.string().describe('원하는 테마 스타일 설명'),
  baseTheme: z.string().optional().describe('기반 preset 테마 ID'),
}
```

#### 메시지 템플릿

```typescript
export function registerDesignThemePrompt(server: McpServer): void {
  server.prompt(
    'design-theme',
    {
      description: z.string().describe('원하는 테마 스타일 설명'),
      baseTheme: z.string().optional().describe('기반 preset 테마 ID'),
    },
    ({ description, baseTheme }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `다음 설명에 맞는 WebForm 테마를 만들어주세요:

"${description}"

${baseTheme ? `기반 테마: ${baseTheme} (이 테마를 조회하여 토큰 구조 파악)` : ''}

단계:
1. webform://schema/theme-tokens 리소스로 토큰 구조 확인
2. ${baseTheme ? '기반 테마를 조회하여 시작점 확보' : 'Preset 테마 중 가장 가까운 것 선택'}
3. 설명에 맞게 토큰 값 조정 (color, font, spacing, border-radius)
4. create_theme으로 테마 생성
5. 생성된 테마 요약 (주요 색상 팔레트, 특징)`,
          },
        },
      ],
    }),
  );
}
```

#### 참조하는 Tool/Resource

| 단계 | Tool/Resource | 용도 |
|------|---------------|------|
| 1단계 | `webform://schema/theme-tokens` | ThemeTokens 구조 확인 |
| 2단계 | `list_themes` | 프리셋 테마 목록 조회 |
| 2단계 | `get_theme` | 기반 테마 토큰 상세 조회 |
| 3단계 | (AI 추론) | 설명 → 토큰 값 매핑 |
| 4단계 | `create_theme` | 테마 생성 (name, tokens, basePreset) |

#### ThemeTokens 구조 참고

```typescript
interface ThemeTokens {
  id: ThemeId;
  name: string;
  window: WindowTokens;    // titleBar, border, borderRadius, shadow
  form: FormTokens;        // backgroundColor, foreground, fontFamily, fontSize
  controls: ControlTokens; // button, textInput, select, checkRadio, panel, etc.
  accent: AccentTokens;    // primary, primaryHover, primaryForeground
  popup: PopupTokens;      // background, border, shadow, borderRadius
}
```

## 5. 통합 등록 모듈

### 5.1 `packages/mcp/src/prompts/index.ts`

기존 placeholder(`// Prompt 템플릿 — Phase 4에서 구현 예정`)를 대체한다.

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCreateFormPrompt } from './createForm.js';
import { registerCrudHandlersPrompt } from './crudHandlers.js';
import { registerSetupNavigationPrompt } from './setupNavigation.js';
import { registerCloneFormPrompt } from './cloneForm.js';
import { registerDesignThemePrompt } from './designTheme.js';

export function registerPrompts(server: McpServer): void {
  registerCreateFormPrompt(server);
  registerCrudHandlersPrompt(server);
  registerSetupNavigationPrompt(server);
  registerCloneFormPrompt(server);
  registerDesignThemePrompt(server);
}
```

### 5.2 `packages/mcp/src/server.ts` 수정

현재 상태:
```typescript
export function registerPrompts(_server: McpServer): void {
  // Phase 4: Prompt 템플릿
  // registerFormWizardPrompt(server);
  // registerCrudHandlersPrompt(server);
}
```

변경 후:
```typescript
import { registerPrompts as registerAllPrompts } from './prompts/index.js';

// registerPrompts 함수 제거하고, registerAllPrompts를 직접 export
```

또는 기존 패턴 유지하여:
```typescript
import { registerPrompts } from './prompts/index.js';
// re-export (이미 index.ts에서 export하므로, server.ts의 registerPrompts 함수 본체를 교체)
```

**실제 변경**: `server.ts`의 `registerPrompts` 함수를 `prompts/index.ts`의 `registerPrompts`로 교체한다. `index.ts`(진입점)에서 이미 `import { registerPrompts } from './server.js'`로 사용하고 있으므로, `server.ts`에서 `prompts/index.js`를 import하여 위임하면 된다.

```typescript
// server.ts 변경
import { registerPrompts as registerPromptsImpl } from './prompts/index.js';

export function registerPrompts(server: McpServer): void {
  registerPromptsImpl(server);
}
```

## 6. 코드 스타일 및 패턴

### 6.1 파일 구조 (각 Prompt 파일)

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerXxxPrompt(server: McpServer): void {
  server.prompt(
    'prompt-name',
    { /* Zod 스키마 */ },
    (args) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `...` } }],
    }),
  );
}
```

### 6.2 일관성 규칙

- 모든 Prompt 파일은 단일 함수만 export: `registerXxxPrompt`
- Zod 스키마의 `.describe()`는 한국어로 작성
- 메시지 텍스트는 한국어로 작성 (AI가 한국어 응답하도록)
- 템플릿 리터럴로 파라미터 삽입
- `as const` 타입 단언으로 MCP SDK 타입 호환

### 6.3 의존성

- `zod` (이미 `packages/mcp/package.json`에 포함)
- `@modelcontextprotocol/sdk` (이미 포함)
- 외부 API 호출 없음 (Prompt는 메시지만 반환)

## 7. 테스트 계획

### 7.1 단위 테스트 파일

`packages/mcp/src/__tests__/prompts.test.ts`

### 7.2 테스트 항목

Prompt는 순수 함수(입력 → 메시지 반환)이므로 단위 테스트가 간단하다:

1. **등록 확인**: 각 Prompt가 서버에 정상 등록되는지 확인
2. **메시지 구조 검증**:
   - `messages` 배열에 최소 1개 메시지 존재
   - `role`이 `'user'`
   - `content.type`이 `'text'`
   - `content.text`에 입력 파라미터 값이 포함
3. **파라미터 삽입 검증**:
   - `create-form-wizard`: projectId, description이 메시지에 포함
   - `add-crud-handlers`: formId, dataSourceId, entityName이 포함
   - `setup-navigation`: projectId, formIds가 포함
   - `clone-and-modify-form`: sourceFormId, newName, modifications가 포함
   - `design-theme`: description이 포함, baseTheme 조건부 포함
4. **선택적 파라미터**: `design-theme`의 `baseTheme` 유무에 따른 메시지 분기

### 7.3 테스트 패턴

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from '../prompts/index.js';

describe('MCP Prompts', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    registerPrompts(server);
  });

  it('should register all 5 prompts', () => {
    // server의 등록된 prompt 목록 확인
  });

  it('create-form-wizard should include projectId and description', () => {
    // prompt handler 호출 → 메시지 검증
  });
});
```

## 8. 구현 순서

1. `packages/mcp/src/prompts/createForm.ts` — create-form-wizard
2. `packages/mcp/src/prompts/crudHandlers.ts` — add-crud-handlers
3. `packages/mcp/src/prompts/setupNavigation.ts` — setup-navigation
4. `packages/mcp/src/prompts/cloneForm.ts` — clone-and-modify-form
5. `packages/mcp/src/prompts/designTheme.ts` — design-theme
6. `packages/mcp/src/prompts/index.ts` — 통합 등록 함수
7. `packages/mcp/src/server.ts` — registerPrompts 연결
8. `packages/mcp/src/__tests__/prompts.test.ts` — 테스트 작성 및 실행

## 9. 참고: 연관 Tool/Resource 목록

Prompt 템플릿이 참조하는 기존 구현물:

### Tools (Phase 1~3에서 구현 완료)

| Tool | 파일 | Prompt에서 사용 |
|------|------|-----------------|
| `create_form` | `tools/forms.ts` | create-form-wizard, clone-and-modify-form |
| `get_form` | `tools/forms.ts` | add-crud-handlers, clone-and-modify-form |
| `publish_form` | `tools/forms.ts` | setup-navigation |
| `batch_add_controls` | `tools/controls.ts` | create-form-wizard, clone-and-modify-form |
| `add_event_handler` | `tools/events.ts` | create-form-wizard, add-crud-handlers, clone-and-modify-form |
| `list_event_handlers` | `tools/events.ts` | add-crud-handlers |
| `add_data_binding` | `tools/databindings.ts` | create-form-wizard |
| `get_datasource` | `tools/datasources.ts` | add-crud-handlers |
| `get_project` | `tools/projects.ts` | setup-navigation |
| `create_shell` | `tools/shells.ts` | setup-navigation |
| `get_shell` | `tools/shells.ts` | setup-navigation |
| `update_shell` | `tools/shells.ts` | setup-navigation |
| `publish_shell` | `tools/shells.ts` | setup-navigation |
| `list_themes` | `tools/themes.ts` | design-theme |
| `get_theme` | `tools/themes.ts` | design-theme |
| `create_theme` | `tools/themes.ts` | design-theme |

### Resources

| Resource | URI | Prompt에서 사용 |
|----------|-----|-----------------|
| `control-types-schema` | `webform://schema/control-types` | create-form-wizard |
| `event-context-guide` | `webform://guide/event-context` | add-crud-handlers |
| `handler-examples-guide` | `webform://guide/handler-examples` | create-form-wizard, add-crud-handlers |
| `theme-tokens-schema` | `webform://schema/theme-tokens` | design-theme |
| `form-definition` | `webform://forms/{formId}` | add-crud-handlers, clone-and-modify-form |
| `theme-detail` | `webform://themes/{themeId}` | design-theme |
