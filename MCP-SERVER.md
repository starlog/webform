# MCP Server for WebForm SDUI Platform

WebForm의 모든 핵심 기능을 AI 어시스턴트(Claude 등)에게 노출하는 Model Context Protocol 서버 구현 계획.

---

## 1. 아키텍처 개요

### 1.1 배치 방식

```
packages/
├── common/          (기존)
├── server/          (기존 Express 서버)
├── designer/        (기존)
├── runtime/         (기존)
└── mcp/             (신규 — MCP 서버 패키지)
    ├── src/
    │   ├── index.ts              # MCP 서버 엔트리포인트
    │   ├── server.ts             # MCP 서버 설정 및 초기화
    │   ├── tools/                # Tool 핸들러 (기능 실행)
    │   │   ├── forms.ts
    │   │   ├── projects.ts
    │   │   ├── controls.ts
    │   │   ├── events.ts
    │   │   ├── datasources.ts
    │   │   ├── shells.ts
    │   │   ├── themes.ts
    │   │   ├── runtime.ts
    │   │   └── debug.ts
    │   ├── resources/            # Resource 핸들러 (데이터 읽기)
    │   │   ├── formResource.ts
    │   │   ├── projectResource.ts
    │   │   ├── controlSchemaResource.ts
    │   │   └── themeResource.ts
    │   ├── prompts/              # Prompt 템플릿 (워크플로우)
    │   │   ├── createForm.ts
    │   │   ├── addEventHandler.ts
    │   │   └── setupDataBinding.ts
    │   └── utils/
    │       ├── apiClient.ts      # 기존 Express 서버 REST API 호출
    │       └── validators.ts     # 입력값 검증
    ├── package.json
    └── tsconfig.json
```

### 1.2 통신 구조

```
Claude (AI) ←—stdio—→ MCP Server ←—HTTP—→ Express Server (localhost:4000)
                                   ←—WS——→ WebSocket Server
```

- MCP 서버는 **stdio transport** 사용 (Claude Code/Desktop 호환)
- 기존 Express 서버의 REST API를 내부적으로 호출하여 기능 수행
- DB 직접 접근 없이 API 레이어를 통해 동작 → 기존 검증/인증/비즈니스 로직 재사용

### 1.3 기술 스택

```json
{
  "@modelcontextprotocol/sdk": "^1.x",
  "zod": "^3.24",
  "node-fetch": "^3.x"
}
```

- `@modelcontextprotocol/sdk`의 `McpServer` 클래스 사용 (High-level API)
- Zod 스키마로 Tool 입력값 검증 (SDK 내장 지원)
- 기존 서버 API 호출용 HTTP 클라이언트

### 1.4 서버 초기화

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'webform',
  version: '1.0.0',
  description: 'WebForm SDUI 플랫폼 — 폼/프로젝트 관리, 컨트롤 배치, 이벤트 핸들링, 데이터 바인딩',
});

// Tool, Resource, Prompt 등록
registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 2. Tools (기능 실행)

AI가 호출할 수 있는 액션. 각 Tool은 Zod 스키마로 입력을 정의하고, JSON 결과를 반환한다.

### 2.1 프로젝트 관리

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `list_projects` | 프로젝트 목록 조회 | `page?`, `limit?`, `search?` |
| `get_project` | 프로젝트 상세 조회 (폼 목록 포함) | `projectId` |
| `create_project` | 프로젝트 생성 | `name`, `description?` |
| `update_project` | 프로젝트 수정 | `projectId`, `name?`, `description?` |
| `delete_project` | 프로젝트 삭제 | `projectId` |
| `export_project` | 프로젝트 JSON 내보내기 | `projectId` |
| `import_project` | 프로젝트 JSON 가져오기 | `data` (ExportProjectData) |
| `publish_all` | 프로젝트 전체 폼 퍼블리시 | `projectId` |

### 2.2 폼 관리

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `list_forms` | 폼 목록 조회 | `projectId?`, `page?`, `limit?`, `search?`, `status?` |
| `get_form` | 폼 정의 조회 | `formId` |
| `create_form` | 빈 폼 생성 | `name`, `projectId`, `properties?` |
| `update_form` | 폼 전체 수정 (낙관적 잠금) | `formId`, `version`, `properties?`, `controls?`, `eventHandlers?`, `dataBindings?` |
| `delete_form` | 폼 삭제 | `formId` |
| `publish_form` | 폼 퍼블리시 | `formId` |
| `get_form_versions` | 버전 히스토리 조회 | `formId` |
| `get_form_version_snapshot` | 특정 버전 스냅샷 조회 | `formId`, `version` |

### 2.3 컨트롤 조작

폼 수정 없이 개별 컨트롤을 편리하게 추가/수정/삭제하는 고수준 Tool.
내부적으로 `get_form` → 조작 → `update_form` 패턴으로 구현.

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `add_control` | 폼에 컨트롤 추가 | `formId`, `type`, `name`, `properties?`, `position?`, `size?`, `parentId?` |
| `update_control` | 컨트롤 속성 수정 | `formId`, `controlId`, `properties?`, `position?`, `size?` |
| `remove_control` | 컨트롤 삭제 | `formId`, `controlId` |
| `move_control` | 컨트롤 위치 이동 | `formId`, `controlId`, `position` |
| `resize_control` | 컨트롤 크기 변경 | `formId`, `controlId`, `size` |
| `batch_add_controls` | 여러 컨트롤 일괄 추가 | `formId`, `controls[]` |
| `list_control_types` | 사용 가능한 컨트롤 타입 목록 | — |
| `get_control_schema` | 특정 컨트롤 타입의 속성 스키마 | `controlType` |

#### `add_control` 입력 상세

```typescript
{
  formId: string,
  type: ControlType,     // 'Button' | 'Label' | 'TextBox' | ... (44종)
  name: string,          // 고유 이름 (예: 'btnSave', 'txtName')
  properties?: {
    text?: string,
    enabled?: boolean,
    visible?: boolean,
    font?: FontDefinition,
    // ... 컨트롤 타입별 속성
  },
  position?: { x: number, y: number },   // 기본: 자동 배치
  size?: { width: number, height: number }, // 기본: 컨트롤 타입별 기본 크기
  parentId?: string,     // 컨테이너 컨트롤 내부 배치 시
}
```

#### `batch_add_controls` 입력 상세

```typescript
{
  formId: string,
  controls: Array<{
    type: ControlType,
    name: string,
    properties?: Record<string, unknown>,
    position?: { x: number, y: number },
    size?: { width: number, height: number },
    parentId?: string,
  }>
}
```

### 2.4 이벤트 핸들러

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `add_event_handler` | 이벤트 핸들러 등록 | `formId`, `controlId`, `eventName`, `handlerCode`, `handlerType?` |
| `update_event_handler` | 이벤트 핸들러 수정 | `formId`, `controlId`, `eventName`, `handlerCode` |
| `remove_event_handler` | 이벤트 핸들러 삭제 | `formId`, `controlId`, `eventName` |
| `list_event_handlers` | 폼의 모든 이벤트 핸들러 조회 | `formId` |
| `list_available_events` | 컨트롤 타입별 사용 가능한 이벤트 목록 | `controlType` |
| `test_event_handler` | 이벤트 핸들러 코드 테스트 실행 | `formId`, `controlId`, `eventName`, `mockFormState?` |

#### 이벤트 핸들러 코드 작성 가이드 (Tool description에 포함)

```
핸들러 코드는 TypeScript로 작성.
사용 가능한 ctx 객체:
- ctx.controls['컨트롤이름'].text/checked/value/... (읽기/쓰기)
- ctx.sender: 이벤트 발생 컨트롤
- ctx.eventArgs: 이벤트 인자
- ctx.showMessage(text, title?, type?): 메시지 대화상자
- ctx.navigate(formId, params?): 폼 이동
- ctx.http.get/post/put/patch/delete(url, body?): HTTP 요청
- ctx.getRadioGroupValue(groupName): 라디오 그룹 값
```

### 2.5 데이터 바인딩

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `add_data_binding` | 데이터 바인딩 추가 | `formId`, `controlId`, `controlProperty`, `dataSourceId`, `dataField`, `bindingMode?` |
| `remove_data_binding` | 데이터 바인딩 삭제 | `formId`, `controlId`, `controlProperty` |
| `list_data_bindings` | 폼의 데이터 바인딩 목록 | `formId` |

### 2.6 데이터소스

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `list_datasources` | 데이터소스 목록 | `projectId?` |
| `get_datasource` | 데이터소스 상세 | `datasourceId` |
| `create_datasource` | 데이터소스 생성 | `name`, `type`, `projectId`, `config`, `description?` |
| `update_datasource` | 데이터소스 수정 | `datasourceId`, `name?`, `config?`, `description?` |
| `delete_datasource` | 데이터소스 삭제 | `datasourceId` |
| `test_datasource_connection` | 연결 테스트 | `datasourceId` |
| `query_datasource` | 쿼리 실행 | `datasourceId`, `query` |

### 2.7 ApplicationShell

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `get_shell` | 프로젝트 Shell 조회 | `projectId` |
| `create_shell` | Shell 생성 | `projectId`, `name`, `properties?`, `controls?`, `startFormId?` |
| `update_shell` | Shell 수정 | `projectId`, `properties?`, `controls?`, `eventHandlers?`, `startFormId?` |
| `delete_shell` | Shell 삭제 | `projectId` |
| `publish_shell` | Shell 퍼블리시 | `projectId` |

### 2.8 테마

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `list_themes` | 테마 목록 조회 | `page?`, `limit?` |
| `get_theme` | 테마 상세 조회 | `themeId` |
| `create_theme` | 커스텀 테마 생성 | `name`, `tokens` |
| `update_theme` | 커스텀 테마 수정 | `themeId`, `name?`, `tokens?` |
| `delete_theme` | 커스텀 테마 삭제 | `themeId` |
| `apply_theme_to_form` | 폼에 테마 적용 | `formId`, `themeId` |

### 2.9 런타임 / 디버그

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `execute_event` | 런타임 이벤트 실행 (테스트용) | `formId`, `controlId`, `eventName`, `formState?`, `eventArgs?` |
| `debug_execute` | 디버그 모드 코드 실행 (트레이스 포함) | `formId`, `controlId`, `eventName`, `formState?` |
| `get_runtime_form` | 퍼블리시된 폼 로드 | `formId` |
| `get_runtime_app` | Shell + 시작 폼 로드 | `projectId` |

### 2.10 유틸리티

| Tool 이름 | 설명 | 입력 파라미터 |
|-----------|------|--------------|
| `validate_form` | 폼 정의 유효성 검증 | `formDefinition` |
| `get_server_health` | 서버 상태 확인 (MongoDB, Redis) | — |
| `search_controls` | 폼 내 컨트롤 검색 (이름/타입/속성) | `formId`, `query?`, `type?`, `property?` |

---

## 3. Resources (데이터 읽기)

MCP Resource는 `resource://` URI를 통해 접근하는 읽기 전용 데이터.

### 3.1 정적 리소스

| URI | 설명 | MIME |
|-----|------|------|
| `webform://schema/control-types` | 전체 컨트롤 타입 목록 및 기본 속성 | `application/json` |
| `webform://schema/events` | 컨트롤 타입별 이벤트 목록 (COMMON_EVENTS + CONTROL_EVENTS) | `application/json` |
| `webform://schema/form-properties` | FormProperties 스키마 | `application/json` |
| `webform://schema/shell-properties` | ShellProperties 스키마 | `application/json` |
| `webform://schema/theme-tokens` | ThemeTokens 구조 | `application/json` |
| `webform://guide/event-context` | 이벤트 핸들러 ctx 객체 API 문서 | `text/markdown` |
| `webform://guide/data-binding` | 데이터 바인딩 설정 가이드 | `text/markdown` |
| `webform://guide/control-hierarchy` | 컨테이너 컨트롤 계층 구조 가이드 | `text/markdown` |

### 3.2 동적 리소스 (Resource Templates)

| URI 패턴 | 설명 | MIME |
|----------|------|------|
| `webform://projects/{projectId}` | 프로젝트 상세 + 폼 목록 | `application/json` |
| `webform://forms/{formId}` | 폼 정의 전체 (FormDefinition) | `application/json` |
| `webform://forms/{formId}/controls` | 폼의 컨트롤 목록 (flat) | `application/json` |
| `webform://forms/{formId}/events` | 폼의 이벤트 핸들러 목록 | `application/json` |
| `webform://forms/{formId}/bindings` | 폼의 데이터 바인딩 목록 | `application/json` |
| `webform://forms/{formId}/versions` | 폼의 버전 히스토리 | `application/json` |
| `webform://datasources/{datasourceId}` | 데이터소스 상세 | `application/json` |
| `webform://shells/{projectId}` | 프로젝트 Shell 정의 | `application/json` |
| `webform://themes/{themeId}` | 테마 토큰 상세 | `application/json` |

### 3.3 Resource 구현 예시

```typescript
server.resource(
  'form-definition',
  new ResourceTemplate('webform://forms/{formId}', { list: undefined }),
  async (uri, { formId }) => {
    const form = await apiClient.get(`/api/forms/${formId}`);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(form, null, 2),
      }],
    };
  }
);
```

---

## 4. Prompts (워크플로우 템플릿)

자주 사용하는 멀티스텝 작업을 위한 프롬프트 템플릿.

### 4.1 `create-form-wizard`

> 대화형 폼 생성 마법사

```typescript
server.prompt(
  'create-form-wizard',
  {
    projectId: z.string().describe('대상 프로젝트 ID'),
    description: z.string().describe('만들 폼에 대한 자연어 설명'),
  },
  ({ projectId, description }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
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
    }],
  })
);
```

### 4.2 `add-crud-handlers`

> CRUD 이벤트 핸들러 자동 생성

```typescript
server.prompt(
  'add-crud-handlers',
  {
    formId: z.string().describe('대상 폼 ID'),
    dataSourceId: z.string().describe('데이터소스 ID'),
    entityName: z.string().describe('엔티티 이름 (예: "사용자", "주문")'),
  },
  ({ formId, dataSourceId, entityName }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
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
    }],
  })
);
```

### 4.3 `setup-navigation`

> Shell + 폼 네비게이션 구성

```typescript
server.prompt(
  'setup-navigation',
  {
    projectId: z.string().describe('프로젝트 ID'),
    formIds: z.string().describe('폼 ID 목록 (쉼표 구분)'),
  },
  ({ projectId, formIds }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
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
    }],
  })
);
```

### 4.4 `clone-and-modify-form`

> 기존 폼을 복제하고 수정

```typescript
server.prompt(
  'clone-and-modify-form',
  {
    sourceFormId: z.string().describe('원본 폼 ID'),
    newName: z.string().describe('새 폼 이름'),
    modifications: z.string().describe('변경 사항 설명'),
  },
  ({ sourceFormId, newName, modifications }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
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
    }],
  })
);
```

### 4.5 `design-theme`

> 자연어로 테마 생성

```typescript
server.prompt(
  'design-theme',
  {
    description: z.string().describe('원하는 테마 스타일 설명'),
    baseTheme: z.string().optional().describe('기반 preset 테마 ID'),
  },
  ({ description, baseTheme }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
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
    }],
  })
);
```

---

## 5. 구현 세부 사항

### 5.1 API 클라이언트 (`utils/apiClient.ts`)

```typescript
class WebFormApiClient {
  private baseUrl: string;  // 기본: http://localhost:4000
  private token: string;    // 개발용: /auth/dev-token에서 발급

  constructor() {
    this.baseUrl = process.env.WEBFORM_API_URL || 'http://localhost:4000';
  }

  async init(): Promise<void> {
    // 개발 토큰 자동 발급
    const res = await fetch(`${this.baseUrl}/auth/dev-token`);
    const { token } = await res.json();
    this.token = token;
  }

  async get<T>(path: string): Promise<T> { ... }
  async post<T>(path: string, body: unknown): Promise<T> { ... }
  async put<T>(path: string, body: unknown): Promise<T> { ... }
  async delete(path: string): Promise<void> { ... }
}
```

### 5.2 컨트롤 조작 헬퍼 (`tools/controls.ts`)

개별 컨트롤 조작 Tool은 내부적으로 `get_form` → 변환 → `update_form` 패턴 사용.

```typescript
async function addControlToForm(
  formId: string,
  control: Partial<ControlDefinition>
): Promise<{ controlId: string; formVersion: number }> {
  // 1. 현재 폼 조회
  const form = await apiClient.get(`/api/forms/${formId}`);

  // 2. 컨트롤 ID 생성 + 기본값 적용
  const newControl = {
    id: generateId(),
    type: control.type,
    name: control.name,
    properties: { ...getDefaultProperties(control.type), ...control.properties },
    position: control.position || autoPosition(form.controls),
    size: control.size || getDefaultSize(control.type),
  };

  // 3. 컨트롤 추가
  form.controls.push(newControl);

  // 4. 폼 업데이트 (낙관적 잠금)
  const updated = await apiClient.put(`/api/forms/${formId}`, {
    version: form.version,
    controls: form.controls,
  });

  return { controlId: newControl.id, formVersion: updated.version };
}
```

### 5.3 자동 배치 알고리즘 (`utils/autoPosition.ts`)

컨트롤 추가 시 position 미지정이면 자동 배치:

```typescript
function autoPosition(
  existingControls: ControlDefinition[],
  newSize: { width: number; height: number }
): { x: number; y: number } {
  // 1. 기존 컨트롤들의 bounding box 계산
  // 2. 겹치지 않는 첫 번째 위치 찾기
  // 3. 그리드 스냅 (16px) 적용
  // 4. 폼 영역 내 배치
}
```

### 5.4 컨트롤 타입별 기본값 (`utils/controlDefaults.ts`)

```typescript
const CONTROL_DEFAULTS: Record<ControlType, { size, properties }> = {
  Button: {
    size: { width: 100, height: 32 },
    properties: { text: 'Button', enabled: true, visible: true },
  },
  TextBox: {
    size: { width: 200, height: 28 },
    properties: { text: '', placeholder: '', readOnly: false, maxLength: 0 },
  },
  Label: {
    size: { width: 120, height: 24 },
    properties: { text: 'Label', textAlign: 'left' },
  },
  DataGridView: {
    size: { width: 500, height: 300 },
    properties: { columns: [], dataSource: [] },
  },
  // ... 44개 타입 전체
};
```

### 5.5 에러 처리

```typescript
// MCP SDK의 에러 응답 형식 사용
function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

// 낙관적 잠금 충돌 시 자동 재시도
async function withOptimisticRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 409 && i < maxRetries) continue; // version conflict → retry
      throw err;
    }
  }
}
```

### 5.6 Tool 등록 예시

```typescript
// tools/forms.ts
export function registerFormTools(server: McpServer, api: WebFormApiClient) {

  server.tool(
    'create_form',
    '프로젝트에 새 폼을 생성합니다',
    {
      name: z.string().describe('폼 이름'),
      projectId: z.string().describe('프로젝트 ID'),
      properties: z.object({
        title: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        backgroundColor: z.string().optional(),
        theme: z.string().optional(),
      }).optional().describe('폼 속성'),
    },
    async ({ name, projectId, properties }) => {
      const form = await api.post('/api/forms', {
        name,
        projectId,
        properties: {
          title: properties?.title || name,
          width: properties?.width || 800,
          height: properties?.height || 600,
          backgroundColor: properties?.backgroundColor || '#F0F0F0',
          ...properties,
        },
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: form._id,
            name: form.name,
            version: form.version,
            status: form.status,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'add_control',
    '폼에 컨트롤을 추가합니다. 사용 가능한 타입: Button, Label, TextBox, CheckBox, RadioButton, ComboBox, ListBox, Panel, GroupBox, TabControl, DataGridView, Chart 등 44종',
    {
      formId: z.string().describe('폼 ID'),
      type: z.string().describe('컨트롤 타입 (예: Button, TextBox, Label)'),
      name: z.string().describe('컨트롤 이름 (예: btnSave, txtName)'),
      properties: z.record(z.unknown()).optional().describe('컨트롤 속성'),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional().describe('좌표 (미지정 시 자동 배치)'),
      size: z.object({
        width: z.number(),
        height: z.number(),
      }).optional().describe('크기 (미지정 시 기본 크기)'),
      parentId: z.string().optional().describe('부모 컨테이너 컨트롤 ID'),
    },
    async ({ formId, type, name, properties, position, size, parentId }) => {
      const result = await addControlToForm(formId, {
        type, name, properties, position, size, parentId,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
```

---

## 6. Claude 통합 설정

### 6.1 claude_desktop_config.json

```json
{
  "mcpServers": {
    "webform": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "cwd": "/path/to/webform",
      "env": {
        "WEBFORM_API_URL": "http://localhost:4000"
      }
    }
  }
}
```

### 6.2 .claude/settings.json (Claude Code)

```json
{
  "mcpServers": {
    "webform": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "cwd": ".",
      "env": {
        "WEBFORM_API_URL": "http://localhost:4000"
      }
    }
  }
}
```

### 6.3 개발 모드 실행

```bash
# MCP Inspector로 디버깅
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js

# pnpm dev에 mcp 패키지 추가
pnpm --filter @webform/mcp dev
```

---

## 7. 구현 단계

### Phase 1: 기반 구축 (핵심)
1. `packages/mcp` 패키지 초기화 (`package.json`, `tsconfig.json`)
2. `McpServer` 인스턴스 + stdio transport 설정
3. API 클라이언트 구현 (토큰 자동 발급, CRUD 메서드)
4. 프로젝트 관리 Tools (list/get/create/update/delete)
5. 폼 관리 Tools (list/get/create/update/delete/publish)
6. 기본 Resources (프로젝트, 폼 조회)

### Phase 2: 컨트롤 & 이벤트
7. 컨트롤 조작 Tools (add/update/remove/move/resize/batch_add)
8. 컨트롤 타입 기본값 및 자동 배치 구현
9. 이벤트 핸들러 Tools (add/update/remove/list/test)
10. 스키마 Resources (control-types, events, form-properties)
11. 가이드 Resources (event-context, control-hierarchy)

### Phase 3: 데이터 & 테마
12. 데이터소스 Tools (CRUD, test, query)
13. 데이터 바인딩 Tools (add/remove/list)
14. 테마 Tools (CRUD, apply)
15. Shell Tools (CRUD, publish)
16. 데이터 바인딩 가이드 Resource

### Phase 4: 고급 기능 & 최적화
17. Prompt 템플릿 구현 (create-form-wizard, add-crud-handlers 등)
18. 런타임/디버그 Tools (execute_event, debug_execute)
19. 유틸리티 Tools (validate, health, search)
20. 낙관적 잠금 자동 재시도
21. MCP Inspector 테스트 및 Claude Desktop/Code 통합 검증

### Phase 5: 폴리싱
22. 에러 메시지 한국어화 및 컨텍스트 보강
23. Tool description 최적화 (AI가 올바르게 Tool 선택하도록)
24. 성능 최적화 (폼 조회 캐싱 등)
25. 테스트 코드 작성

---

## 8. 사용 시나리오 예시

### 시나리오 1: "사용자 등록 폼 만들어줘"

```
AI 동작 흐름:
1. list_projects → 프로젝트 선택 (또는 사용자에게 확인)
2. create_form({ name: '사용자 등록', projectId, properties: { width: 600, height: 500 } })
3. batch_add_controls({
     formId, controls: [
       { type: 'Label', name: 'lblTitle', properties: { text: '사용자 등록' }, position: { x: 200, y: 16 } },
       { type: 'Label', name: 'lblName', properties: { text: '이름' }, position: { x: 32, y: 64 } },
       { type: 'TextBox', name: 'txtName', position: { x: 120, y: 60 }, size: { width: 300, height: 28 } },
       { type: 'Label', name: 'lblEmail', properties: { text: '이메일' }, position: { x: 32, y: 104 } },
       { type: 'TextBox', name: 'txtEmail', position: { x: 120, y: 100 }, size: { width: 300, height: 28 } },
       { type: 'Label', name: 'lblPhone', properties: { text: '전화번호' }, position: { x: 32, y: 144 } },
       { type: 'TextBox', name: 'txtPhone', position: { x: 120, y: 140 }, size: { width: 300, height: 28 } },
       { type: 'Button', name: 'btnRegister', properties: { text: '등록' }, position: { x: 200, y: 200 } },
       { type: 'Button', name: 'btnCancel', properties: { text: '취소' }, position: { x: 320, y: 200 } },
     ]
   })
4. add_event_handler({
     formId, controlId: 'btnRegister', eventName: 'Click',
     handlerCode: `
       const name = ctx.controls.txtName.text;
       const email = ctx.controls.txtEmail.text;
       if (!name || !email) {
         ctx.showMessage('이름과 이메일을 입력해주세요.', '입력 오류', 'warning');
         return;
       }
       const res = await ctx.http.post('/api/users', { name, email, phone: ctx.controls.txtPhone.text });
       if (res.ok) {
         ctx.showMessage('등록되었습니다.', '성공', 'info');
         ctx.controls.txtName.text = '';
         ctx.controls.txtEmail.text = '';
         ctx.controls.txtPhone.text = '';
       } else {
         ctx.showMessage('등록에 실패했습니다.', '오류', 'error');
       }
     `
   })
5. publish_form({ formId })
```

### 시나리오 2: "기존 폼에 DataGridView 추가하고 데이터 바인딩해줘"

```
AI 동작 흐름:
1. get_form({ formId }) → 현재 폼 구조 파악
2. list_datasources({ projectId }) → 연결 가능한 데이터소스 확인
3. add_control({ formId, type: 'DataGridView', name: 'dgvUsers', position, size })
4. add_control({ formId, type: 'Button', name: 'btnLoad', properties: { text: '데이터 조회' } })
5. add_data_binding({ formId, controlId: dgvId, controlProperty: 'dataSource', dataSourceId, dataField: 'users' })
6. add_event_handler({ formId, controlId: btnId, eventName: 'Click', handlerCode: '...' })
```

### 시나리오 3: "이 프로젝트를 다크 테마로 바꿔줘"

```
AI 동작 흐름:
1. webform://schema/theme-tokens 리소스 조회 → 토큰 구조 확인
2. get_theme({ themeId: 'dark-preset' }) 또는 create_theme({
     name: '다크 테마',
     tokens: { window: { background: '#1E1E1E' }, form: { background: '#252526' }, ... }
   })
3. get_project({ projectId }) → 폼 목록 조회
4. 각 폼에 apply_theme_to_form({ formId, themeId })
```

---

## 9. 보안 고려사항

1. **API 접근 제어**: MCP 서버는 localhost에서만 Express API 호출 (개발 환경 기준)
2. **코드 실행**: `test_event_handler`, `debug_execute`는 기존 SandboxRunner의 isolated-vm 격리 환경 사용
3. **데이터소스 설정**: 암호화된 config는 MCP를 통해 평문으로 노출하지 않음 (API 레이어에서 처리)
4. **입력 검증**: 모든 Tool 입력은 Zod 스키마로 검증
5. **파괴적 작업**: delete 계열 Tool은 soft delete (기존 서버 동작)
