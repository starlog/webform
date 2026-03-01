# 유틸리티 Tools 구현 계획

## 개요

`packages/mcp/src/tools/utils.ts` — MCP-SERVER.md 섹션 2.10에 정의된 3개 유틸리티 Tools와 낙관적 잠금 재시도 유틸리티를 구현한다.

유틸리티 Tools는 기존 서버 API 호출 또는 클라이언트 측 로직으로 폼 검증, 서버 상태 확인, 컨트롤 검색 기능을 제공한다. 추가로 여러 Tool에 분산된 낙관적 잠금 재시도 로직을 공통 유틸리티(`withOptimisticRetry`)로 추출하여 일관성을 확보한다.

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts        (수정 — registerUtilityTools export 추가)
└── utils.ts        (신규 — 3개 Tool 정의)

packages/mcp/src/utils/
├── retry.ts        (신규 — withOptimisticRetry 유틸리티)
└── index.ts        (수정 — retry export 추가)

packages/mcp/src/tools/
├── controls.ts     (수정 — withFormUpdate → withOptimisticRetry 사용)
└── events.ts       (수정 — withEventHandlerMutation → withOptimisticRetry 사용)

packages/mcp/src/
└── server.ts       (수정 — registerUtilityTools 호출 활성화)
```

## 2. Tool-API 매핑

| # | Tool 이름 | HTTP 메서드 | 서버 엔드포인트 | 비고 |
|---|-----------|-------------|----------------|------|
| 1 | `validate_form` | — | 없음 (클라이언트 측 검증) | FormDefinition JSON을 직접 검증 |
| 2 | `get_server_health` | GET | `/health` | 인증 불필요, 200/503 반환 |
| 3 | `search_controls` | GET | `/api/forms/:formId` | 폼 조회 후 클라이언트 측 필터링 |

## 3. 참조 타입

### 3.1 FormDefinition (`@webform/common`)

```typescript
interface FormDefinition {
  id: string;
  name: string;
  version: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
}
```

### 3.2 ControlDefinition (`@webform/common`)

```typescript
interface ControlDefinition {
  id: string;
  type: ControlType;
  name: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: ControlDefinition[];
  anchor: AnchorStyle;
  dock: DockStyle;
  tabIndex: number;
  visible: boolean;
  enabled: boolean;
}
```

### 3.3 ControlType (`@webform/common`)

```typescript
const CONTROL_TYPES = [
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl', 'SplitContainer',
  'DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView',
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView', 'MongoDBConnector',
  'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
  'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
] as const;
```

### 3.4 EventHandlerDefinition (`@webform/common`)

```typescript
interface EventHandlerDefinition {
  controlId: string;
  eventName: string;
  handlerType: 'server' | 'client';
  handlerCode: string;
}
```

### 3.5 기존 서버 Health 엔드포인트 (`packages/server/src/app.ts`)

```typescript
// GET /health — 인증 불필요
// 200: { status: 'ok', timestamp, services: { mongo: 'connected', redis: 'connected' } }
// 503: { status: 'degraded', timestamp, services: { mongo: '...', redis: '...' } }
```

## 4. 각 Tool 상세 설계

### 4.1 validate_form

```typescript
server.tool(
  'validate_form',
  `폼 정의 JSON의 유효성을 검증합니다.

검증 항목:
- 컨트롤 ID/이름 중복
- 필수 속성 존재 확인 (id, type, name, position, size)
- 컨트롤 타입 유효성 (CONTROL_TYPES 확인)
- 이벤트 핸들러 코드 구문 검증 (JavaScript 파싱)
- 이벤트 핸들러 controlId 참조 유효성
- 데이터 바인딩 controlId 참조 유효성`,
  {
    formDefinition: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      version: z.number().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
      controls: z.array(z.record(z.string(), z.unknown())).optional().default([]),
      eventHandlers: z.array(z.object({
        controlId: z.string(),
        eventName: z.string(),
        handlerType: z.enum(['server', 'client']).optional(),
        handlerCode: z.string(),
      })).optional().default([]),
      dataBindings: z.array(z.object({
        controlId: z.string(),
        controlProperty: z.string(),
        dataSourceId: z.string(),
        dataField: z.string(),
        bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']).optional(),
      })).optional().default([]),
    }).describe('검증할 폼 정의 JSON'),
  },
  handler
);
```

**핸들러 로직**:

```typescript
async ({ formDefinition }) => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const controls = formDefinition.controls || [];

  // 1. 컨트롤 재귀 수집 (children 포함)
  const allControls = flattenControls(controls);

  // 2. 컨트롤 ID 중복 검증
  const idCounts = countDuplicates(allControls, 'id');
  for (const [id, count] of idCounts) {
    if (count > 1) errors.push({ type: 'duplicate_id', message: `컨트롤 ID '${id}'가 ${count}번 중복됩니다`, controlId: id });
  }

  // 3. 컨트롤 이름 중복 검증
  const nameCounts = countDuplicates(allControls, 'name');
  for (const [name, count] of nameCounts) {
    if (count > 1) errors.push({ type: 'duplicate_name', message: `컨트롤 이름 '${name}'이 ${count}번 중복됩니다`, controlName: name });
  }

  // 4. 필수 속성 검증 (id, type, name, position, size)
  for (const ctrl of allControls) {
    const missing = ['id', 'type', 'name'].filter(k => !ctrl[k]);
    if (missing.length > 0) {
      errors.push({ type: 'missing_property', message: `컨트롤 '${ctrl.name || ctrl.id || '(unknown)}'에 필수 속성이 누락: ${missing.join(', ')}` });
    }
    if (!ctrl.position) warnings.push({ type: 'missing_position', message: `컨트롤 '${ctrl.name}'에 position이 없습니다` });
    if (!ctrl.size) warnings.push({ type: 'missing_size', message: `컨트롤 '${ctrl.name}'에 size가 없습니다` });
  }

  // 5. 컨트롤 타입 유효성 검증
  const validTypes = new Set(CONTROL_TYPES);
  for (const ctrl of allControls) {
    if (ctrl.type && !validTypes.has(ctrl.type)) {
      errors.push({ type: 'invalid_type', message: `컨트롤 '${ctrl.name}'의 타입 '${ctrl.type}'이 유효하지 않습니다. 유효한 타입: ${CONTROL_TYPES.join(', ')}` });
    }
  }

  // 6. 이벤트 핸들러 구문 검증
  const controlIds = new Set(allControls.map(c => c.id).filter(Boolean));
  for (const handler of formDefinition.eventHandlers || []) {
    // controlId 참조 유효성 (폼 이벤트인 경우 controlId가 'form'일 수 있음)
    if (handler.controlId !== 'form' && !controlIds.has(handler.controlId)) {
      errors.push({ type: 'invalid_handler_ref', message: `이벤트 핸들러의 controlId '${handler.controlId}'가 존재하지 않는 컨트롤을 참조합니다` });
    }
    // JavaScript 구문 검증 (new Function으로 파싱 시도)
    try {
      new Function(handler.handlerCode);
    } catch (e) {
      errors.push({ type: 'handler_syntax_error', message: `이벤트 핸들러 (${handler.controlId}.${handler.eventName}) 구문 오류: ${e.message}` });
    }
  }

  // 7. 데이터 바인딩 참조 검증
  for (const binding of formDefinition.dataBindings || []) {
    if (!controlIds.has(binding.controlId)) {
      errors.push({ type: 'invalid_binding_ref', message: `데이터 바인딩의 controlId '${binding.controlId}'가 존재하지 않는 컨트롤을 참조합니다` });
    }
  }

  // 결과 반환
  const valid = errors.length === 0;
  return toolResult({
    valid,
    errors,
    warnings,
    summary: {
      totalControls: allControls.length,
      totalEventHandlers: (formDefinition.eventHandlers || []).length,
      totalDataBindings: (formDefinition.dataBindings || []).length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  });
}
```

**헬퍼 함수**:

```typescript
interface ValidationError {
  type: string;
  message: string;
  controlId?: string;
  controlName?: string;
}

interface ValidationWarning {
  type: string;
  message: string;
}

// 재귀적으로 모든 컨트롤을 평탄화
function flattenControls(controls: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const ctrl of controls) {
    result.push(ctrl);
    if (Array.isArray(ctrl.children)) {
      result.push(...flattenControls(ctrl.children as Array<Record<string, unknown>>));
    }
  }
  return result;
}

// 특정 키의 값 중복 횟수 계산
function countDuplicates(items: Array<Record<string, unknown>>, key: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const val = item[key];
    if (typeof val === 'string' && val) {
      counts.set(val, (counts.get(val) || 0) + 1);
    }
  }
  return new Map([...counts].filter(([, count]) => count > 1));
}
```

**반환값**:
```json
{
  "valid": false,
  "errors": [
    { "type": "duplicate_name", "message": "컨트롤 이름 'button1'이 2번 중복됩니다", "controlName": "button1" },
    { "type": "handler_syntax_error", "message": "이벤트 핸들러 (ctrl1.Click) 구문 오류: Unexpected token ..." }
  ],
  "warnings": [
    { "type": "missing_position", "message": "컨트롤 'label1'에 position이 없습니다" }
  ],
  "summary": {
    "totalControls": 5,
    "totalEventHandlers": 2,
    "totalDataBindings": 1,
    "errorCount": 2,
    "warningCount": 1
  }
}
```

### 4.2 get_server_health

```typescript
server.tool(
  'get_server_health',
  `WebForm 서버의 상태를 확인합니다.

MongoDB 연결 상태, Redis 연결 상태, 서버 응답 시간을 반환합니다.
서버가 비정상이면 status: 'degraded'를 반환합니다.`,
  {},
  handler
);
```

**핸들러 로직**:

```typescript
async () => {
  const startTime = Date.now();

  try {
    // GET /health (인증 불필요 — apiClient 대신 직접 fetch)
    const baseUrl = process.env.WEBFORM_API_URL || 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/health`);
    const elapsed = Date.now() - startTime;
    const body = await res.json();

    return toolResult({
      ...body,
      responseTime: `${elapsed}ms`,
      serverUrl: baseUrl,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    return toolError(
      `서버에 연결할 수 없습니다 (${elapsed}ms 경과). ` +
      `서버가 실행 중인지 확인하세요: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

**참고**: `/health` 엔드포인트는 인증이 불필요하므로 apiClient 대신 직접 fetch를 사용한다. apiClient는 Bearer 토큰을 자동 포함하는데, `/health`는 인증 미들웨어 이전에 마운트되어 있으므로 apiClient를 사용해도 동작하나, 서버가 완전히 다운된 경우도 감지해야 하므로 직접 fetch가 더 적합하다.

**반환값 (정상)**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-01T10:00:00.000Z",
  "services": {
    "mongo": "connected",
    "redis": "connected"
  },
  "responseTime": "15ms",
  "serverUrl": "http://localhost:4000"
}
```

**반환값 (비정상)**:
```json
{
  "status": "degraded",
  "timestamp": "2026-03-01T10:00:00.000Z",
  "services": {
    "mongo": "connected",
    "redis": "disconnected"
  },
  "responseTime": "52ms",
  "serverUrl": "http://localhost:4000"
}
```

### 4.3 search_controls

```typescript
server.tool(
  'search_controls',
  `폼 내 컨트롤을 조건에 따라 검색합니다.

이름, 타입, 속성 값으로 컨트롤을 필터링합니다. 중첩된 컨테이너 내 컨트롤도 재귀적으로 검색합니다.
여러 조건을 동시에 지정하면 AND 조건으로 동작합니다.`,
  {
    formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
    query: z.string().optional().describe('컨트롤 이름 검색 (부분 일치, 대소문자 무시)'),
    type: z.string().optional().describe('컨트롤 타입 필터 (예: Button, TextBox, Panel)'),
    property: z.string().optional().describe('속성 검색 (key=value 형식, 예: "text=Submit" 또는 "visible=false")'),
  },
  handler
);
```

**핸들러 로직**:

```typescript
async ({ formId, query, type, property }) => {
  validateObjectId(formId, 'formId');

  // 1. 폼 조회
  const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
  const form = res.data;

  // 2. 모든 컨트롤 재귀 수집 (깊이 정보 포함)
  const allControls = flattenControlsWithDepth(form.controls, null, 0);

  // 3. 필터 적용
  let filtered = allControls;

  // 이름 검색 (부분 일치, 대소문자 무시)
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(c => c.name?.toLowerCase().includes(q));
  }

  // 타입 필터
  if (type) {
    filtered = filtered.filter(c => c.type === type);
  }

  // 속성 검색 (key=value)
  if (property) {
    const eqIdx = property.indexOf('=');
    if (eqIdx === -1) {
      // key만 지정: 해당 속성이 존재하는 컨트롤
      filtered = filtered.filter(c => property in (c.properties || {}));
    } else {
      const key = property.substring(0, eqIdx);
      const value = property.substring(eqIdx + 1);
      filtered = filtered.filter(c => {
        const props = c.properties || {};
        // 최상위 속성도 검색 (visible, enabled 등)
        const propVal = props[key] ?? c[key];
        return String(propVal) === value;
      });
    }
  }

  // 4. 결과 포맷팅
  const results = filtered.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    position: c.position,
    size: c.size,
    parentId: c.parentId,
    depth: c.depth,
  }));

  return toolResult({
    formId,
    formName: form.name,
    totalControls: allControls.length,
    matchCount: results.length,
    controls: results,
  });
}
```

**헬퍼 함수**:

```typescript
interface FlatControl extends Record<string, unknown> {
  parentId: string | null;
  depth: number;
}

function flattenControlsWithDepth(
  controls: Array<Record<string, unknown>>,
  parentId: string | null,
  depth: number,
): FlatControl[] {
  const result: FlatControl[] = [];
  for (const ctrl of controls) {
    result.push({ ...ctrl, parentId, depth });
    if (Array.isArray(ctrl.children)) {
      result.push(
        ...flattenControlsWithDepth(
          ctrl.children as Array<Record<string, unknown>>,
          ctrl.id as string,
          depth + 1,
        ),
      );
    }
  }
  return result;
}
```

**반환값**:
```json
{
  "formId": "abc123",
  "formName": "UserForm",
  "totalControls": 12,
  "matchCount": 3,
  "controls": [
    { "id": "ctrl_1", "name": "submitButton", "type": "Button", "position": { "x": 100, "y": 200 }, "size": { "width": 120, "height": 40 }, "parentId": null, "depth": 0 },
    { "id": "ctrl_5", "name": "cancelButton", "type": "Button", "position": { "x": 230, "y": 200 }, "size": { "width": 120, "height": 40 }, "parentId": "panel_1", "depth": 1 }
  ]
}
```

## 5. 낙관적 잠금 재시도 유틸리티 (withOptimisticRetry)

### 5.1 설계

기존 `controls.ts`의 `withFormUpdate`와 `events.ts`의 `withEventHandlerMutation`은 동일한 get→mutate→put→409 재시도 패턴을 사용한다. 이를 공통 유틸리티로 추출한다.

**파일**: `packages/mcp/src/utils/retry.ts`

```typescript
import { apiClient, ApiError } from './apiClient.js';

interface RetryOptions<TData, TResult> {
  /** 데이터를 가져오는 함수 */
  fetch: () => Promise<TData>;
  /** 데이터를 변형하는 함수 (동기) */
  mutate: (data: TData) => TResult;
  /** 변형된 데이터를 저장하는 함수 */
  save: (data: TData) => Promise<unknown>;
  /** 최대 재시도 횟수 (기본값: 2) */
  maxRetries?: number;
}

/**
 * 낙관적 잠금 자동 재시도.
 * fetch → mutate → save 사이클을 실행하며, save에서 409 Conflict 발생 시
 * 최대 maxRetries 횟수만큼 fetch부터 다시 시도한다.
 */
export async function withOptimisticRetry<TData, TResult>(
  opts: RetryOptions<TData, TResult>,
): Promise<{ result: TResult; data: TData }> {
  const maxRetries = opts.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const data = await opts.fetch();
    const result = opts.mutate(data);

    try {
      await opts.save(data);
      return { result, data };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('최대 재시도 횟수 초과');
}
```

### 5.2 기존 코드 리팩터링

**controls.ts — withFormUpdate 교체**:

```typescript
// Before
async function withFormUpdate<T>(formId: string, fn: (form: FormData) => T, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
    const form = res.data;
    const result = fn(form);
    try {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        controls: form.controls,
        eventHandlers: form.eventHandlers,
        dataBindings: form.dataBindings,
      });
      return { result, formVersion: updated.data.version };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) continue;
      throw err;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}

// After
import { withOptimisticRetry } from '../utils/retry.js';

async function withFormUpdate<T>(formId: string, fn: (form: FormData) => T, maxRetries = 2) {
  const { result, data: form } = await withOptimisticRetry({
    fetch: async () => {
      const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
      return res.data;
    },
    mutate: fn,
    save: async (form) => {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        controls: form.controls,
        eventHandlers: form.eventHandlers,
        dataBindings: form.dataBindings,
      });
      form.version = updated.data.version;
    },
    maxRetries,
  });
  return { result, formVersion: form.version };
}
```

**events.ts — withEventHandlerMutation 교체**:

```typescript
// After
import { withOptimisticRetry } from '../utils/retry.js';

async function withEventHandlerMutation<T>(formId: string, mutate: (form: FormData) => T, maxRetries = 2) {
  const { result, data: form } = await withOptimisticRetry({
    fetch: async () => {
      const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
      return res.data;
    },
    mutate,
    save: async (form) => {
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        eventHandlers: form.eventHandlers,
      });
      form.version = updated.data.version;
    },
    maxRetries,
  });
  return { result, form, updatedVersion: form.version };
}
```

## 6. 에러 처리

### 6.1 validate_form

서버 API를 호출하지 않으므로 ApiError가 발생하지 않는다. 잘못된 JSON 구조는 Zod 스키마에서 걸러진다.

### 6.2 get_server_health

| 에러 상황 | 처리 |
|-----------|------|
| 서버 연결 불가 (ECONNREFUSED) | `toolError("서버에 연결할 수 없습니다...")` |
| 503 응답 (degraded) | 정상 결과로 반환 (에러 아님, status: 'degraded'로 구분) |
| 타임아웃 | `toolError("서버 응답 시간 초과...")` |

### 6.3 search_controls

| 에러 상황 | HTTP 상태 | 메시지 |
|-----------|-----------|--------|
| 잘못된 formId | 검증 에러 | "유효하지 않은 formId" |
| 폼 없음 | 404 | "폼을 찾을 수 없습니다: formId={formId}" |
| 조건 불일치 | — | matchCount: 0, controls: [] (에러 아님) |

## 7. CONTROL_TYPES 참조

validate_form에서 컨트롤 타입 유효성을 검증하기 위해 `@webform/common`의 `CONTROL_TYPES`를 import한다. MCP 패키지가 common 패키지에 의존하고 있으므로 직접 import 가능하다.

```typescript
import { CONTROL_TYPES } from '@webform/common';
```

만약 common 패키지 의존성이 없는 경우, CONTROL_TYPES 배열을 utils.ts에 로컬로 정의한다.

## 8. registerUtilityTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// CONTROL_TYPES 참조 (common 패키지 또는 로컬)
const VALID_CONTROL_TYPES = new Set(CONTROL_TYPES);

// --- 헬퍼 ---
function toolResult(data: unknown) { /* ... */ }
function toolError(message: string) { /* ... */ }
function flattenControls(controls) { /* ... */ }
function flattenControlsWithDepth(controls, parentId, depth) { /* ... */ }
function countDuplicates(items, key) { /* ... */ }

export function registerUtilityTools(server: McpServer): void {
  // 1. validate_form
  server.tool('validate_form', ...);

  // 2. get_server_health
  server.tool('get_server_health', ...);

  // 3. search_controls
  server.tool('search_controls', ...);
}
```

## 9. server.ts 수정

```typescript
import { registerUtilityTools } from './tools/utils.js';

export function registerTools(server: McpServer): void {
  // Phase 1-3: 기존 Tools
  registerProjectTools(server);
  registerFormTools(server);
  registerControlTools(server);
  registerEventTools(server);
  registerDatasourceTools(server);
  registerDatabindingTools(server);
  registerThemeTools(server);
  registerShellTools(server);

  // Phase 4: 유틸리티 Tools
  registerUtilityTools(server);
}
```

## 10. tools/index.ts 수정

```typescript
export { registerProjectTools } from './projects.js';
export { registerFormTools } from './forms.js';
export { registerControlTools } from './controls.js';
export { registerEventTools } from './events.js';
export { registerDatasourceTools } from './datasources.js';
export { registerDatabindingTools } from './databindings.js';
export { registerThemeTools } from './themes.js';
export { registerShellTools } from './shells.js';
export { registerUtilityTools } from './utils.js';
```

## 11. utils/index.ts 수정

```typescript
export { apiClient, ApiError } from './apiClient.js';
export { validateObjectId, validateRequired } from './validators.js';
export { getAutoPosition } from './autoPosition.js';
export { getControlDefaults } from './controlDefaults.js';
export { withOptimisticRetry } from './retry.js';
```

## 12. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/utils/retry.ts` | **신규** — withOptimisticRetry 유틸리티 |
| 2 | `packages/mcp/src/utils/index.ts` | **수정** — retry export 추가 |
| 3 | `packages/mcp/src/tools/utils.ts` | **신규** — 3개 유틸리티 Tool 정의 |
| 4 | `packages/mcp/src/tools/index.ts` | **수정** — registerUtilityTools export 추가 |
| 5 | `packages/mcp/src/server.ts` | **수정** — registerUtilityTools import + 호출 |
| 6 | `packages/mcp/src/tools/controls.ts` | **수정** — withFormUpdate → withOptimisticRetry 사용 |
| 7 | `packages/mcp/src/tools/events.ts` | **수정** — withEventHandlerMutation → withOptimisticRetry 사용 |

## 13. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 3개 Tool이 모두 MCP 서버에 등록됨 (server.tool 호출 3회)
- [ ] validate_form: 중복 ID/이름 감지, 잘못된 타입 감지, 구문 오류 감지
- [ ] validate_form: 유효한 폼에 대해 `{ valid: true, errors: [], warnings: [] }` 반환
- [ ] validate_form: children 내 중첩 컨트롤도 재귀 검증
- [ ] get_server_health: 서버 정상 시 `{ status: 'ok', services: {...} }` 반환
- [ ] get_server_health: 서버 다운 시 연결 불가 에러 메시지 반환
- [ ] search_controls: 이름 부분 일치 검색 동작 (대소문자 무시)
- [ ] search_controls: 타입 필터 동작
- [ ] search_controls: 속성 검색 (key=value) 동작
- [ ] search_controls: 여러 조건 AND 조합 동작
- [ ] search_controls: 중첩 컨트롤 재귀 검색 + parentId/depth 반환
- [ ] withOptimisticRetry: 409 시 재시도, 다른 에러 즉시 throw
- [ ] controls.ts의 withFormUpdate가 withOptimisticRetry 사용으로 변경됨
- [ ] events.ts의 withEventHandlerMutation이 withOptimisticRetry 사용으로 변경됨
- [ ] 기존 테스트가 깨지지 않음
