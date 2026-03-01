# 데이터 바인딩 Tools 구현 계획

## 개요

`packages/mcp/src/tools/databindings.ts` — MCP-SERVER.md 섹션 2.5에 정의된 3개 데이터 바인딩 Tools를 구현한다.

데이터 바인딩은 폼의 `dataBindings` 배열(타입: `DataBindingDefinition[]`)에 저장되며, `get_form` → 조작 → `update_form` 패턴(낙관적 잠금 + 자동 재시도)으로 CRUD를 수행한다.

## 1. 파일 구조

```
packages/mcp/src/tools/
├── index.ts           (수정 — registerDatabindingTools export 추가)
├── databindings.ts    (신규 — 3개 Tool 정의)
├── controls.ts        (기존)
├── events.ts          (기존)
├── forms.ts           (기존)
└── projects.ts        (기존)
```

## 2. DataBindingDefinition 타입 참조

`packages/common/src/types/datasource.ts`에 정의된 타입:

```typescript
interface DataBindingDefinition {
  controlId: string;         // 바인딩할 컨트롤 ID
  controlProperty: string;   // 컨트롤의 속성명 (예: "text", "value", "dataSource")
  dataSourceId: string;       // 데이터를 제공할 DataSource ID
  dataField: string;          // DataSource에서 가져올 필드명
  bindingMode: 'oneWay' | 'twoWay' | 'oneTime';  // 바인딩 방향
}
```

`FormDefinition.dataBindings: DataBindingDefinition[]` — 폼 정의에 배열로 포함됨.

## 3. Tool-API 엔드포인트 매핑

| # | Tool 이름 | 내부 동작 | 서버 엔드포인트 | 비고 |
|---|-----------|-----------|----------------|------|
| 1 | `add_data_binding` | get_form → push → update_form | `GET /api/forms/:id` + `PUT /api/forms/:id` | dataBindings 배열에 추가 |
| 2 | `remove_data_binding` | get_form → filter → update_form | `GET /api/forms/:id` + `PUT /api/forms/:id` | controlId+controlProperty로 삭제 |
| 3 | `list_data_bindings` | get_form → extract | `GET /api/forms/:id` | dataBindings 배열 반환 (읽기 전용) |

## 4. 각 Tool 상세 설계

### 4.1 add_data_binding

```typescript
server.tool(
  'add_data_binding',
  `폼의 컨트롤 속성에 데이터 바인딩을 추가합니다. 내부적으로 get_form → dataBindings 배열 추가 → update_form 패턴으로 동작합니다.

데이터 바인딩은 컨트롤의 특정 속성(예: text, value, dataSource)을 데이터소스의 필드와 연결합니다.
- oneWay: 데이터소스 → 컨트롤 (단방향, 기본값)
- twoWay: 양방향 바인딩 (컨트롤 값 변경 시 데이터소스에도 반영)
- oneTime: 초기 로드 시점에만 바인딩

예시: DataGridView의 dataSource 속성을 데이터소스의 users 필드에 바인딩`,
  {
    formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
    controlId: z.string().describe('바인딩할 컨트롤 ID'),
    controlProperty: z.string().describe('컨트롤의 속성명 (예: text, value, dataSource, checked)'),
    dataSourceId: z.string().describe('데이터를 제공할 DataSource ID'),
    dataField: z.string().describe('DataSource에서 가져올 필드명 (예: users, name, email)'),
    bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']).optional().default('oneWay')
      .describe('바인딩 방향 (기본: oneWay)'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `withDatabindingMutation(formId, (form) => { ... })` — 낙관적 잠금 패턴
3. 컨트롤 존재 검증: `form.controls`에서 `controlId` 검색 (재귀, children 포함)
4. 중복 검사: 동일 `(controlId, controlProperty)` 바인딩이 이미 존재하면 에러 반환
5. `dataBindings` 배열에 새 바인딩 추가:
   ```typescript
   form.dataBindings.push({
     controlId,
     controlProperty,
     dataSourceId,
     dataField,
     bindingMode: bindingMode ?? 'oneWay',
   });
   ```
6. 409 충돌 시 자동 재시도 (최대 2회)

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"controlId\": \"ctrl-001\", \"controlProperty\": \"dataSource\", \"dataSourceId\": \"ds-001\", \"dataField\": \"users\", \"bindingMode\": \"oneWay\", \"totalBindings\": 3, \"formVersion\": 5 }"
  }]
}
```

### 4.2 remove_data_binding

```typescript
server.tool(
  'remove_data_binding',
  '데이터 바인딩을 삭제합니다. controlId + controlProperty로 대상 바인딩을 식별합니다.',
  {
    formId: z.string().describe('폼 ID'),
    controlId: z.string().describe('컨트롤 ID'),
    controlProperty: z.string().describe('바인딩된 속성명'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `withDatabindingMutation(formId, (form) => { ... })` — 낙관적 잠금 패턴
3. `dataBindings` 배열에서 `(controlId, controlProperty)` 매칭 바인딩 검색
4. 없으면 에러: `"바인딩을 찾을 수 없습니다: controlId={controlId}, controlProperty={controlProperty}"`
5. `filter()`로 해당 바인딩 제거
6. 409 충돌 시 자동 재시도 (최대 2회)

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"controlId\": \"ctrl-001\", \"controlProperty\": \"dataSource\", \"removed\": true, \"remainingBindings\": 2, \"formVersion\": 6 }"
  }]
}
```

### 4.3 list_data_bindings

```typescript
server.tool(
  'list_data_bindings',
  '폼에 설정된 모든 데이터 바인딩 목록을 조회합니다. 각 바인딩의 controlId, controlProperty, dataSourceId, dataField, bindingMode를 포함합니다.',
  {
    formId: z.string().describe('폼 ID'),
  },
  handler
);
```

**핸들러 로직**:
1. `validateObjectId(formId, 'formId')`
2. `apiClient.get<GetFormResponse>('/api/forms/' + formId)` — 폼 조회
3. `dataBindings` 배열을 추출
4. 각 바인딩에 컨트롤 이름 정보 추가 (controls 배열에서 controlId → name 매핑, 재귀 탐색)
5. 읽기 전용이므로 `update_form` 호출 불필요

**반환값**:
```json
{
  "content": [{
    "type": "text",
    "text": "{ \"formId\": \"...\", \"bindings\": [{ \"controlId\": \"ctrl-001\", \"controlName\": \"dgvUsers\", \"controlProperty\": \"dataSource\", \"dataSourceId\": \"ds-001\", \"dataField\": \"users\", \"bindingMode\": \"oneWay\" }, ...], \"totalCount\": 2 }"
  }]
}
```

## 5. get_form → update_form 패턴 헬퍼

add/remove_data_binding에서 공통으로 사용하는 패턴을 헬퍼 함수로 추출:

```typescript
/**
 * 폼을 조회하여 dataBindings를 조작한 뒤 업데이트하는 공통 패턴.
 * 낙관적 잠금 + 자동 재시도 (최대 2회).
 * mutate 함수에서 dataBindings 배열을 직접 수정하거나 값을 반환한다.
 */
async function withDatabindingMutation<T>(
  formId: string,
  mutate: (form: FormData) => T,
  maxRetries = 2,
): Promise<{ result: T; form: FormData; updatedVersion: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 1. 폼 조회
    const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
    const form = res.data;

    // 2. mutate 콜백으로 dataBindings 조작
    const result = mutate(form);

    try {
      // 3. update_form (낙관적 잠금 — dataBindings만 전송)
      const updated = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, {
        version: form.version,
        dataBindings: form.dataBindings,
      });

      return { result, form, updatedVersion: updated.data.version };
    } catch (err) {
      // 4. 409 충돌 시 재시도
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}
```

## 6. 컨트롤 탐색 헬퍼

컨트롤 존재 검증과 이름 매핑을 위해 controls.ts와 동일한 재귀 탐색 헬퍼 사용:

```typescript
function findControlById(
  controls: Array<{ id: string; name: string; children?: unknown[] }>,
  id: string,
): { id: string; name: string } | undefined {
  for (const ctrl of controls) {
    if (ctrl.id === id) return ctrl;
    if (ctrl.children && Array.isArray(ctrl.children)) {
      const found = findControlById(ctrl.children as typeof controls, id);
      if (found) return found;
    }
  }
  return undefined;
}
```

## 7. 커스텀 에러 클래스

```typescript
class BindingExistsError extends Error {
  constructor(public controlId: string, public controlProperty: string) {
    super(`Binding already exists: ${controlId}.${controlProperty}`);
  }
}

class BindingNotFoundError extends Error {
  constructor(public controlId: string, public controlProperty: string) {
    super(`Binding not found: ${controlId}.${controlProperty}`);
  }
}

class ControlNotFoundError extends Error {
  constructor(public controlId: string) {
    super(`Control not found: ${controlId}`);
  }
}
```

## 8. 에러 처리

```typescript
try {
  const { result, updatedVersion } = await withDatabindingMutation(formId, mutate);
  return toolResult({ ... });
} catch (err) {
  if (err instanceof BindingExistsError) {
    return toolError(
      `이미 존재하는 바인딩입니다: controlId=${err.controlId}, controlProperty=${err.controlProperty}. remove_data_binding 후 다시 추가하세요.`,
    );
  }
  if (err instanceof BindingNotFoundError) {
    return toolError(
      `바인딩을 찾을 수 없습니다: controlId=${err.controlId}, controlProperty=${err.controlProperty}`,
    );
  }
  if (err instanceof ControlNotFoundError) {
    return toolError(`컨트롤을 찾을 수 없습니다: controlId=${err.controlId}`);
  }
  if (err instanceof ApiError) {
    if (err.status === 404) return toolError(`폼을 찾을 수 없습니다: ${formId}`);
    if (err.status === 409) return toolError('버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. 다시 시도하세요.');
    return toolError(`API 오류 [${err.status}]: ${err.message}`);
  }
  if (err instanceof Error) return toolError(err.message);
  throw err;
}
```

## 9. 타입 정의

```typescript
interface DataBindingDef {
  controlId: string;
  controlProperty: string;
  dataSourceId: string;
  dataField: string;
  bindingMode: string;
}

interface FormData {
  _id: string;
  name: string;
  version: number;
  controls: Array<{ id: string; name: string; type: string; children?: unknown[]; [key: string]: unknown }>;
  eventHandlers: Array<{ controlId: string; eventName: string; handlerType: string; handlerCode: string }>;
  dataBindings: DataBindingDef[];
  properties: Record<string, unknown>;
}

interface GetFormResponse {
  data: FormData;
}

interface MutateFormResponse {
  data: {
    _id: string;
    name: string;
    version: number;
    status: string;
  };
}
```

## 10. registerDatabindingTools 함수 구조

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

export function registerDatabindingTools(server: McpServer): void {
  // 1. add_data_binding
  server.tool('add_data_binding', ...);

  // 2. remove_data_binding
  server.tool('remove_data_binding', ...);

  // 3. list_data_bindings
  server.tool('list_data_bindings', ...);
}
```

## 11. server.ts 수정

```typescript
import { registerDatabindingTools } from './tools/databindings.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  registerControlTools(server);
  registerEventTools(server);

  // Phase 3: 데이터 바인딩 Tools
  registerDatabindingTools(server);
}
```

## 12. tools/index.ts 수정

```typescript
export { registerDatabindingTools } from './databindings.js';
```

## 13. 생성/수정할 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `packages/mcp/src/tools/databindings.ts` | **신규** — 3개 Tool + 헬퍼 함수 + 타입 정의 |
| 2 | `packages/mcp/src/tools/index.ts` | **수정** — `registerDatabindingTools` export 추가 |
| 3 | `packages/mcp/src/server.ts` | **수정** — `registerDatabindingTools` 호출 추가 |

## 14. 기존 코드와의 연계

### 14.1 controls.ts의 remove_control과 연계

`controls.ts`의 `removeControlFromForm()` 함수에서 컨트롤 삭제 시 관련 dataBindings도 함께 제거하고 있음:

```typescript
// controls.ts:252
form.dataBindings = form.dataBindings.filter((b) => b.controlId !== controlId);
```

→ 데이터 바인딩 Tools는 이 동작과 별도로, 개별 바인딩의 CRUD를 담당한다.

### 14.2 FormValidator의 검증 스키마

`packages/server/src/validators/formValidator.ts`에서 dataBindings 배열의 유효성을 검증:

```typescript
const dataBindingSchema = z.object({
  controlId: z.string().min(1),
  controlProperty: z.string().min(1),
  dataSourceId: z.string().min(1),
  dataField: z.string(),
  bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']),
});
```

→ MCP Tool에서 전송하는 데이터는 이 스키마를 만족해야 서버에서 검증 통과.

### 14.3 Runtime API의 dataBindings 활용

`POST /api/runtime/forms/:id/data` 엔드포인트에서 `form.dataBindings`의 `dataSourceId`를 사용하여 데이터소스를 일괄 조회한다.

## 15. 검증 기준

- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] 3개 Tool이 모두 MCP 서버에 등록됨 (server.tool 호출 3회)
- [ ] add_data_binding: 컨트롤 존재 검증, 중복 바인딩 방지, bindingMode 기본값 oneWay
- [ ] add_data_binding: Tool description에 바인딩 모드 설명 포함
- [ ] remove_data_binding: controlId+controlProperty로 정확한 바인딩 매칭, 미존재 시 에러
- [ ] list_data_bindings: 모든 바인딩 + 컨트롤 이름 정보 반환
- [ ] 409 버전 충돌 시 자동 재시도 (최대 2회) 후 실패하면 isError 반환
- [ ] 잘못된 formId(비-ObjectId) 시 검증 에러 반환
- [ ] 존재하지 않는 controlId 지정 시 에러 반환
