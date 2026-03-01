# MCP 스키마/가이드 Resources 구현 계획

## 개요

`packages/mcp/src/resources/` — Phase 2 정적 리소스 8개를 구현한다. `packages/common`의 타입 정의에서 스키마 데이터를 추출하여 정적 JSON을 제공하고, 가이드 문서를 마크다운으로 제공한다.

MCP-SERVER.md 섹션 3.1에 정의된 정적 리소스:
- 스키마 Resources 5개 (`application/json`) — 파라미터 없는 고정 URI
- 가이드 Resources 3개 (`text/markdown`) — 파라미터 없는 고정 URI

## 1. 구현 대상 리소스

### 1.1 스키마 Resources (5개)

| # | URI | 이름 | 설명 | MIME |
|---|-----|------|------|------|
| 1 | `webform://schema/control-types` | `control-types-schema` | 전체 컨트롤 타입 목록 + 카테고리 그룹핑 + 기본 속성 | `application/json` |
| 2 | `webform://schema/events` | `events-schema` | 공통/컨트롤별/폼 이벤트 목록 | `application/json` |
| 3 | `webform://schema/form-properties` | `form-properties-schema` | FormProperties JSON Schema | `application/json` |
| 4 | `webform://schema/shell-properties` | `shell-properties-schema` | ShellProperties JSON Schema | `application/json` |
| 5 | `webform://schema/theme-tokens` | `theme-tokens-schema` | ThemeTokens 계층 구조 | `application/json` |

### 1.2 가이드 Resources (3개)

| # | URI | 이름 | 설명 | MIME |
|---|-----|------|------|------|
| 6 | `webform://guide/event-context` | `event-context-guide` | ctx 객체 API 문서 | `text/markdown` |
| 7 | `webform://guide/data-binding` | `data-binding-guide` | 데이터 바인딩 설정 가이드 | `text/markdown` |
| 8 | `webform://guide/control-hierarchy` | `control-hierarchy-guide` | 컨테이너 컨트롤 계층 구조 가이드 | `text/markdown` |

## 2. Resource 구현 패턴

### 2.1 정적 리소스 등록 방식

기존 동적 리소스(`ResourceTemplate`)와 달리, 정적 리소스는 고정 URI 문자열을 사용한다.

```typescript
// 정적 리소스 — 고정 URI, 파라미터 없음
server.resource(
  'resource-name',          // name (고유 식별자)
  'webform://schema/xxx',   // 고정 URI 문자열
  async (uri) => ({         // read 콜백 (variables 없음)
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',  // 또는 'text/markdown'
      text: JSON.stringify(data, null, 2),  // 또는 마크다운 문자열
    }],
  })
);
```

> **참고**: MCP SDK의 `server.resource()`는 두 번째 인자로 고정 URI 문자열을 받으면 정적 리소스로 등록된다. `ResourceTemplate`은 필요하지 않다.

### 2.2 데이터 소스

정적 리소스는 API 호출 없이 `@webform/common`에서 import한 상수/타입 정보를 직접 사용한다:

| 리소스 | 데이터 소스 |
|--------|-----------|
| control-types | `CONTROL_TYPES` 상수 |
| events | `COMMON_EVENTS`, `CONTROL_EVENTS`, `FORM_EVENTS` 상수 |
| form-properties | `FormProperties` 인터페이스 → JSON Schema 수동 작성 |
| shell-properties | `ShellProperties` 인터페이스 → JSON Schema 수동 작성 |
| theme-tokens | `ThemeTokens` 인터페이스 → 구조 수동 작성 |
| guide/* | 마크다운 문서 직접 작성 |

## 3. 리소스별 상세 설계

### 3.1 `webform://schema/control-types` — 컨트롤 타입 스키마

- **파일**: `resources/schemaResource.ts`
- **데이터 소스**: `CONTROL_TYPES` (packages/common/src/types/form.ts)
- **응답 구조**:

```json
{
  "controlTypes": ["Button", "Label", "TextBox", ...],
  "count": 42,
  "categories": {
    "basic": ["Button", "Label", "TextBox", "CheckBox", "RadioButton", "ComboBox", "ListBox", "NumericUpDown", "DateTimePicker", "ProgressBar", "PictureBox"],
    "containers": ["Panel", "GroupBox", "TabControl", "SplitContainer"],
    "data": ["DataGridView", "BindingNavigator", "Chart", "TreeView", "ListView"],
    "advanced": ["MenuStrip", "ToolStrip", "StatusStrip", "RichTextBox", "WebBrowser"],
    "custom": ["SpreadsheetView", "JsonEditor", "MongoDBView", "GraphView", "MongoDBConnector"],
    "extra": ["Slider", "Switch", "Upload", "Alert", "Tag", "Divider", "Card", "Badge", "Avatar", "Tooltip", "Collapse", "Statistic"]
  },
  "defaultProperties": {
    "Button": { "text": "Button", "backColor": "#e0e0e0", "foreColor": "#000000", "textAlign": "MiddleCenter" },
    "Label": { "text": "Label", "foreColor": "#000000", "textAlign": "TopLeft" },
    "TextBox": { "text": "", "multiline": false, "readOnly": false, "maxLength": 0, "passwordChar": "" },
    ...
  },
  "commonProperties": {
    "layout": ["position.x", "position.y", "size.width", "size.height", "anchor", "dock"],
    "behavior": ["name", "enabled", "visible", "tabIndex"]
  }
}
```

- **defaultProperties 생성**: `packages/designer/src/components/PropertyPanel/controlProperties.ts`의 `PropertyMeta[].defaultValue`를 참조하여 하드코딩

### 3.2 `webform://schema/events` — 이벤트 스키마

- **파일**: `resources/schemaResource.ts`
- **데이터 소스**: `COMMON_EVENTS`, `CONTROL_EVENTS`, `FORM_EVENTS`
- **응답 구조**:

```json
{
  "commonEvents": ["Click", "DoubleClick", "MouseEnter", ...],
  "formEvents": ["Load", "Shown", "FormClosing", "FormClosed", "Resize", "OnLoading", "BeforeLeaving"],
  "controlSpecificEvents": {
    "TextBox": ["TextChanged", "KeyPress"],
    "ComboBox": ["SelectedIndexChanged", "DropDown", "DropDownClosed"],
    ...
  },
  "allEventsPerControl": {
    "Button": ["Click", "DoubleClick", "MouseEnter", ...],
    "TextBox": ["Click", "DoubleClick", ..., "TextChanged", "KeyPress"],
    ...
  }
}
```

- **allEventsPerControl 생성**: 각 컨트롤 타입에 대해 `[...COMMON_EVENTS, ...(CONTROL_EVENTS[type] || [])]` 계산하여 제공. AI가 특정 컨트롤의 사용 가능한 이벤트를 바로 조회할 수 있도록 함.

### 3.3 `webform://schema/form-properties` — FormProperties 스키마

- **파일**: `resources/schemaResource.ts`
- **데이터 소스**: `FormProperties` 인터페이스 (packages/common/src/types/form.ts:14)
- **응답 구조** (JSON Schema 형식):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "FormProperties",
  "description": "폼 레벨 속성 정의",
  "type": "object",
  "properties": {
    "title": { "type": "string", "description": "폼 제목 (타이틀바 표시)" },
    "width": { "type": "number", "description": "폼 너비 (px)", "minimum": 200 },
    "height": { "type": "number", "description": "폼 높이 (px)", "minimum": 150 },
    "backgroundColor": { "type": "string", "description": "배경색 (HEX)", "pattern": "^#[0-9a-fA-F]{6}$" },
    "font": {
      "type": "object",
      "description": "폼 기본 폰트",
      "properties": {
        "family": { "type": "string" },
        "size": { "type": "number" },
        "bold": { "type": "boolean" },
        "italic": { "type": "boolean" },
        "underline": { "type": "boolean" },
        "strikethrough": { "type": "boolean" }
      },
      "required": ["family", "size", "bold", "italic", "underline", "strikethrough"]
    },
    "startPosition": { "type": "string", "enum": ["CenterScreen", "Manual", "CenterParent"] },
    "formBorderStyle": { "type": "string", "enum": ["None", "FixedSingle", "Fixed3D", "Sizable"] },
    "maximizeBox": { "type": "boolean" },
    "minimizeBox": { "type": "boolean" },
    "windowState": { "type": "string", "enum": ["Normal", "Maximized"] },
    "theme": { "type": "string", "description": "ThemeId" },
    "themeColorMode": { "type": "string", "enum": ["theme", "control"], "description": "테마 색상 적용 모드" }
  },
  "required": ["title", "width", "height", "backgroundColor", "font", "startPosition", "formBorderStyle", "maximizeBox", "minimizeBox"]
}
```

### 3.4 `webform://schema/shell-properties` — ShellProperties 스키마

- **파일**: `resources/schemaResource.ts`
- **데이터 소스**: `ShellProperties` 인터페이스 (packages/common/src/types/shell.ts:9)
- **응답 구조** (JSON Schema 형식):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ShellProperties",
  "description": "Application Shell 속성. FormProperties와 유사하지만 startPosition 없고 showTitleBar 추가",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "width": { "type": "number" },
    "height": { "type": "number" },
    "backgroundColor": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
    "font": { "$ref": "#FontDefinition" },
    "showTitleBar": { "type": "boolean", "description": "타이틀바 표시 여부" },
    "formBorderStyle": { "type": "string", "enum": ["None", "FixedSingle", "Fixed3D", "Sizable"] },
    "maximizeBox": { "type": "boolean" },
    "minimizeBox": { "type": "boolean" },
    "windowState": { "type": "string", "enum": ["Normal", "Maximized"] },
    "theme": { "type": "string", "description": "ThemeId" }
  },
  "required": ["title", "width", "height", "backgroundColor", "font", "showTitleBar", "formBorderStyle", "maximizeBox", "minimizeBox"]
}
```

### 3.5 `webform://schema/theme-tokens` — ThemeTokens 스키마

- **파일**: `resources/schemaResource.ts`
- **데이터 소스**: `ThemeTokens` + 하위 인터페이스들 (packages/common/src/types/theme.ts)
- **응답 구조** (구조 설명 + 필드 목록):

```json
{
  "title": "ThemeTokens",
  "description": "테마 토큰 구조. 각 테마는 이 구조를 구현하여 UI 전체에 일관된 스타일을 적용한다.",
  "structure": {
    "id": { "type": "string", "description": "ThemeId" },
    "name": { "type": "string", "description": "테마 이름" },
    "window": {
      "description": "윈도우 프레임 토큰",
      "fields": {
        "titleBar": {
          "fields": { "background": "string", "foreground": "string", "height": "number", "font": "string", "borderRadius": "string", "controlButtonsPosition": "'left' | 'right'" }
        },
        "border": "string",
        "borderRadius": "string",
        "shadow": "string"
      }
    },
    "form": {
      "description": "폼 영역 토큰",
      "fields": { "backgroundColor": "string", "foreground": "string", "fontFamily": "string", "fontSize": "string" }
    },
    "controls": {
      "description": "컨트롤별 토큰 (13종)",
      "fields": {
        "button": { "fields": { "background": "string", "border": "string", "borderRadius": "string", "foreground": "string", "hoverBackground": "string", "padding": "string" } },
        "textInput": { "fields": { "background": "string", "border": "string", "borderRadius": "string", "foreground": "string", "focusBorder": "string", "padding": "string" } },
        "select": { "fields": { "background": "string", "border": "string", "borderRadius": "string", "foreground": "string", "selectedBackground": "string", "selectedForeground": "string" } },
        "checkRadio": { "fields": { "border": "string", "background": "string", "checkedBackground": "string", "borderRadius": "string" } },
        "panel": { "fields": { "background": "string", "border": "string", "borderRadius": "string" } },
        "groupBox": { "fields": { "border": "string", "borderRadius": "string", "foreground": "string" } },
        "tabControl": { "fields": "TabControlTokens (8 fields)" },
        "dataGrid": { "fields": "DataGridTokens (10 fields)" },
        "progressBar": { "fields": "ProgressBarTokens (4 fields)" },
        "menuStrip": { "fields": "MenuStripTokens (6 fields)" },
        "toolStrip": { "fields": "ToolStripTokens (5 fields)" },
        "statusStrip": { "fields": "StatusStripTokens (3 fields)" },
        "scrollbar": { "fields": "ScrollbarTokens (4 fields)" }
      }
    },
    "accent": {
      "description": "강조 색상 토큰",
      "fields": { "primary": "string", "primaryHover": "string", "primaryForeground": "string" }
    },
    "popup": {
      "description": "팝업/대화상자 토큰",
      "fields": { "background": "string", "border": "string", "shadow": "string", "borderRadius": "string", "hoverBackground": "string" }
    }
  }
}
```

### 3.6 `webform://guide/event-context` — 이벤트 컨텍스트 가이드

- **파일**: `resources/guideResource.ts`
- **데이터 소스**: `FormContext` 인터페이스 + `SandboxRunner.ts`의 ctx 구현
- **내용 범위**:
  1. `ctx.controls` — 컨트롤 프록시 (읽기/쓰기)
  2. `ctx.sender` — 현재 이벤트 발생 컨트롤
  3. `ctx.eventArgs` — 이벤트 인자
  4. `ctx.showMessage(text, title?, type?)` — 메시지 대화상자
  5. `ctx.showDialog(formId, params?)` — 모달 대화상자
  6. `ctx.navigate(formId, params?)` — 폼 네비게이션
  7. `ctx.close(dialogResult?)` — 폼/대화상자 닫기
  8. `ctx.http.{get|post|put|delete}` — HTTP 요청
  9. `ctx.dataSources[name].collection(name)` — MongoDB 접근
  10. `ctx.getRadioGroupValue(groupName)` — 라디오 그룹 값 조회
  11. Shell 전용: `ctx.navigateBack()`, `ctx.navigateReplace()`, `ctx.closeApp()`, `ctx.appState`, `ctx.currentFormId`, `ctx.params`
  12. 사용 예제 (기본 검증, HTTP 호출, 데이터소스 조회)

### 3.7 `webform://guide/data-binding` — 데이터 바인딩 가이드

- **파일**: `resources/guideResource.ts`
- **데이터 소스**: `DataBindingDefinition`, `DataSourceDefinition` 인터페이스
- **내용 범위**:
  1. DataBindingDefinition 구조 설명
  2. 바인딩 모드 3가지 (oneWay, twoWay, oneTime)
  3. 데이터소스 타입별 설정: database(MongoDB), restApi, static
  4. 실전 시나리오: DataGridView, ComboBox, TextBox 바인딩 예시
  5. 주의사항

### 3.8 `webform://guide/control-hierarchy` — 컨트롤 계층 구조 가이드

- **파일**: `resources/guideResource.ts`
- **데이터 소스**: `ControlDefinition.children`, 컨테이너 컨트롤 타입 정의
- **내용 범위**:
  1. 컨테이너 컨트롤 4종 소개 (Panel, GroupBox, TabControl, SplitContainer)
  2. 계층 구조 규칙 (children 배열)
  3. 부모-자식 좌표 체계 (상대좌표)
  4. 트리 구조 다이어그램
  5. MCP Tool 사용 예시 (add_control with parentId)
  6. 중첩 제약사항

## 4. 파일 구조

### 4.1 신규: `resources/schemaResource.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES, COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '@webform/common';

export function registerSchemaResources(server: McpServer): void {
  // 1. webform://schema/control-types
  server.resource('control-types-schema', 'webform://schema/control-types', async (uri) => { ... });

  // 2. webform://schema/events
  server.resource('events-schema', 'webform://schema/events', async (uri) => { ... });

  // 3. webform://schema/form-properties
  server.resource('form-properties-schema', 'webform://schema/form-properties', async (uri) => { ... });

  // 4. webform://schema/shell-properties
  server.resource('shell-properties-schema', 'webform://schema/shell-properties', async (uri) => { ... });

  // 5. webform://schema/theme-tokens
  server.resource('theme-tokens-schema', 'webform://schema/theme-tokens', async (uri) => { ... });
}
```

- `CONTROL_TYPES`, `COMMON_EVENTS`, `CONTROL_EVENTS`, `FORM_EVENTS`는 `@webform/common`에서 import하여 런타임에 동적으로 JSON 생성
- `FormProperties`, `ShellProperties`, `ThemeTokens`의 JSON Schema는 인터페이스 구조를 참조하여 하드코딩 (TypeScript 인터페이스를 런타임에 추출할 수 없으므로)
- 컨트롤별 기본 속성(`defaultProperties`)도 하드코딩

### 4.2 신규: `resources/guideResource.ts`

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGuideResources(server: McpServer): void {
  // 6. webform://guide/event-context
  server.resource('event-context-guide', 'webform://guide/event-context', async (uri) => { ... });

  // 7. webform://guide/data-binding
  server.resource('data-binding-guide', 'webform://guide/data-binding', async (uri) => { ... });

  // 8. webform://guide/control-hierarchy
  server.resource('control-hierarchy-guide', 'webform://guide/control-hierarchy', async (uri) => { ... });
}
```

- 각 가이드의 마크다운 문자열을 `const`로 파일 상단에 정의하여 가독성 확보
- MIME type: `text/markdown`

### 4.3 수정: `resources/index.ts`

```typescript
export { registerProjectResources } from './projectResource.js';
export { registerFormResources } from './formResource.js';
export { registerSchemaResources } from './schemaResource.js';    // 추가
export { registerGuideResources } from './guideResource.js';      // 추가
```

### 4.4 수정: `server.ts`

```typescript
import {
  registerProjectResources,
  registerFormResources,
  registerSchemaResources,      // 추가
  registerGuideResources,       // 추가
} from './resources/index.js';

export function registerResources(server: McpServer): void {
  // Phase 1: 프로젝트/폼 동적 Resources
  registerProjectResources(server);
  registerFormResources(server);

  // Phase 2: 스키마/가이드 Resources
  registerSchemaResources(server);    // 주석 해제 → 실제 호출
  registerGuideResources(server);     // 주석 해제 → 실제 호출
}
```

## 5. 구현 순서

| 순서 | 파일 | 작업 | 설명 |
|------|------|------|------|
| 1 | `resources/schemaResource.ts` | **신규** | 5개 스키마 Resource 등록 함수 |
| 2 | `resources/guideResource.ts` | **신규** | 3개 가이드 Resource 등록 함수 |
| 3 | `resources/index.ts` | **수정** | export 2개 추가 |
| 4 | `server.ts` | **수정** | registerResources에서 호출 추가 (주석 해제) |

## 6. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 8개 정적 Resource가 MCP 서버에 정상 등록
- [ ] 스키마 리소스 5개: URI 조회 시 유효한 JSON 반환
- [ ] 가이드 리소스 3개: URI 조회 시 유효한 마크다운 반환
- [ ] `CONTROL_TYPES` 배열 42개 항목 모두 포함
- [ ] `COMMON_EVENTS` 16개, `FORM_EVENTS` 7개 포함
- [ ] `CONTROL_EVENTS` 31개 컨트롤 타입별 이벤트 포함
- [ ] `allEventsPerControl` 계산값이 정확 (공통 + 컨트롤별)
- [ ] JSON Schema의 필수/선택 필드 구분이 TypeScript 인터페이스와 일치
- [ ] event-context 가이드에 FormContext + SandboxRunner ctx 전체 API 포함
- [ ] data-binding 가이드에 DataBindingDefinition/DataSourceDefinition 구조 반영
- [ ] control-hierarchy 가이드에 컨테이너 4종 + children 구조 설명 포함
