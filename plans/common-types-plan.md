# Application Shell 공통 타입 정의 계획

> Task ID: `common-types-plan`
> Phase: phase1-foundation
> 참조: MDI.md (Application Shell / MDI 시스템 구현 계획)

---

## 1. 현재 타입 구조 분석

### 1.1 UIPatch 타입 (protocol.ts:4-8)

```typescript
export interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate';
  target: string;
  payload: Record<string, unknown>;
}
```

기존 union 멤버 5개:
- `updateProperty` — 컨트롤 속성 변경
- `addControl` — 컨트롤 추가
- `removeControl` — 컨트롤 제거
- `showDialog` — 다이얼로그 표시
- `navigate` — 폼 전환

### 1.2 EventRequest 타입 (protocol.ts:10-16)

```typescript
export interface EventRequest {
  formId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  formState: Record<string, Record<string, unknown>>;
}
```

필드 5개: `formId`, `controlId`, `eventName`, `eventArgs`, `formState`

### 1.3 RuntimeWsMessage 타입 (protocol.ts:50-55)

```typescript
export type RuntimeWsMessage =
  | { type: 'event'; payload: EventRequest }
  | { type: 'eventResult'; payload: EventResponse }
  | { type: 'uiPatch'; payload: UIPatch[] }
  | { type: 'dataRefresh'; payload: { controlId: string; data: unknown[] } }
  | { type: 'error'; payload: { code: string; message: string } };
```

태그드 유니언 5개 variant. Shell 모드에서 `scope` 필드로 패치 대상(shell/form)을 구분해야 한다.

### 1.4 관련 타입 (form.ts, events.ts)

- `ControlDefinition` (form.ts:50-63) — Shell의 `controls` 필드에 재사용
- `FontDefinition` (form.ts:4-11) — Shell의 `properties.font`에 재사용
- `FormProperties` (form.ts:13-23) — Shell의 `ShellProperties`와 구조 유사 (title, width, height, formBorderStyle 등)
- `EventHandlerDefinition` (events.ts:1-6) — Shell의 `eventHandlers`에 재사용
- `EventArgs` (events.ts:8-12) — Shell 이벤트에도 동일하게 사용

### 1.5 현재 index.ts export 구조 (index.ts:1-51)

```
VERSION, FontDefinition, FormProperties, ControlDefinition, FormDefinition,
AnchorStyle, ControlType, DockStyle, CONTROL_TYPES,
EventHandlerDefinition, EventArgs, ControlProxy, CollectionProxy,
DataSourceProxy, FormContext, DialogResult, COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS,
DataSourceDefinition, DatabaseConfig, RestApiConfig, AuthConfig, StaticConfig, DataBindingDefinition,
DebugLog, TraceEntry, UIPatch, EventRequest, EventResponse, DesignerWsMessage, RuntimeWsMessage, WsMessage,
validateFormDefinition, validateControlDefinition, sanitizeQueryInput,
serializeFormDefinition, deserializeFormDefinition,
flattenControls, nestControls
```

---

## 2. 신규 파일: packages/common/src/types/shell.ts

### 2.1 전체 코드 초안

```typescript
import type { ControlDefinition, FontDefinition } from './form';
import type { EventHandlerDefinition, EventArgs } from './events';

/**
 * Application Shell 속성.
 * FormProperties와 유사하지만 startPosition이 없고 showTitleBar가 추가됨.
 */
export interface ShellProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  showTitleBar: boolean;
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
}

/**
 * Application Shell 정의.
 * 프로젝트 당 하나의 Shell이 존재하며, MenuStrip/ToolStrip/StatusStrip 등
 * 앱 수준 UI 컨트롤을 포함한다.
 */
export interface ApplicationShellDefinition {
  id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
}

/**
 * Shell 전용 이벤트 목록.
 * - Load: Shell 최초 로드
 * - FormChanged: 활성 폼 변경 후
 * - BeforeFormChange: 폼 변경 전 (취소 가능)
 */
export const SHELL_EVENTS = ['Load', 'FormChanged', 'BeforeFormChange'] as const;
export type ShellEventType = (typeof SHELL_EVENTS)[number];

/**
 * Shell 이벤트 요청.
 * EventRequest와 유사하지만 formId 대신 projectId를 사용하고
 * shellState, currentFormId 필드가 있다.
 */
export interface ShellEventRequest {
  projectId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  shellState: Record<string, Record<string, unknown>>;
  currentFormId: string;
}
```

### 2.2 설계 근거

1. **`ShellProperties.formBorderStyle`**: 문자열 리터럴 유니언 타입 사용 (`FormProperties`와 동일 패턴). MDI.md에서는 `FormBorderStyle` enum을 언급했으나, 기존 코드베이스가 리터럴 유니언을 일관되게 사용하므로 동일 패턴 적용.

2. **`ShellProperties`에 `startPosition` 없음**: Shell은 앱 전체 프레임이므로 startPosition 개념이 불필요. FormProperties와의 차이점.

3. **`ShellEventRequest` 별도 정의**: 기존 `EventRequest`의 `formId`/`formState`와 의미가 다르므로 (`projectId`/`shellState`) 별도 인터페이스로 정의. 기존 EventRequest를 확장하지 않아 하위 호환성 유지.

4. **`ShellEventType` 타입 별칭 추가**: `SHELL_EVENTS` 배열에서 파생된 유니언 타입. eventName 검증 등에 활용 가능.

---

## 3. protocol.ts 변경 사항

### 3.1 UIPatch type 확장

```diff
 export interface UIPatch {
-  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate';
+  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate'
+    | 'updateShell' | 'updateAppState' | 'closeApp';
   target: string;
   payload: Record<string, unknown>;
 }
```

추가되는 3개 patch type:
- `updateShell` — Shell 컨트롤 상태 업데이트 (target: shellControlId)
- `updateAppState` — 앱 레벨 공유 상태 변경 (target: '_system')
- `closeApp` — 앱 종료 (target: '_system')

### 3.2 EventRequest 필드 추가

```diff
 export interface EventRequest {
   formId: string;
   controlId: string;
   eventName: string;
   eventArgs: EventArgs;
   formState: Record<string, Record<string, unknown>>;
+  appState?: Record<string, unknown>;
+  scope?: 'shell' | 'form';
 }
```

추가 필드 (모두 옵셔널 — 하위 호환):
- `appState` — 앱 레벨 공유 상태. Shell과 폼 간 데이터 공유용
- `scope` — 이벤트 발생 영역 구분 (`shell`: Shell 이벤트, `form`: 폼 이벤트, 미지정: 기존 방식)

### 3.3 RuntimeWsMessage scope 필드 추가

RuntimeWsMessage는 태그드 유니언이므로, 각 variant에 개별적으로 scope를 추가하기보다 별도 wrapper 접근이 필요하다. 기존 유니언 구조를 유지하면서 `uiPatch` variant에만 scope를 추가한다:

```diff
 export type RuntimeWsMessage =
   | { type: 'event'; payload: EventRequest }
   | { type: 'eventResult'; payload: EventResponse }
-  | { type: 'uiPatch'; payload: UIPatch[] }
+  | { type: 'uiPatch'; payload: UIPatch[]; scope?: 'shell' | 'form' }
   | { type: 'dataRefresh'; payload: { controlId: string; data: unknown[] } }
   | { type: 'error'; payload: { code: string; message: string } };
```

scope가 필요한 것은 `uiPatch`와 `event` 메시지이므로, `event` variant의 payload인 `EventRequest`에 이미 `scope` 필드가 추가되었고, `uiPatch`에 직접 `scope` 옵셔널 필드를 추가한다.

---

## 4. index.ts 추가 export 목록

```typescript
// types/shell
export type {
  ApplicationShellDefinition,
  ShellProperties,
  ShellEventRequest,
  ShellEventType,
} from './types/shell';
export { SHELL_EVENTS } from './types/shell';
```

추가되는 export 5개:
- `ApplicationShellDefinition` (type)
- `ShellProperties` (type)
- `ShellEventRequest` (type)
- `ShellEventType` (type)
- `SHELL_EVENTS` (const)

---

## 5. 타입 충돌 및 주의사항

### 5.1 FormProperties vs ShellProperties

두 인터페이스의 공통 필드: `title`, `width`, `height`, `backgroundColor`, `font`, `formBorderStyle`, `maximizeBox`, `minimizeBox`

차이점:
- `FormProperties`에만 있는 필드: `startPosition`
- `ShellProperties`에만 있는 필드: `showTitleBar`

공통 베이스 인터페이스 추출을 고려할 수 있으나, 현 시점에서는 불필요한 추상화. 향후 필요 시 리팩토링 가능.

### 5.2 EventRequest vs ShellEventRequest

서로 다른 인터페이스이며 이름 충돌 없음. EventRequest는 폼 이벤트용, ShellEventRequest는 Shell 전용 이벤트 요청.

단, EventRequest에 `scope` 필드를 추가하므로, scope가 `'shell'`인 EventRequest와 별도의 ShellEventRequest가 공존한다. 이는 의도적 설계:
- **EventRequest + scope**: 기존 런타임 이벤트 플로우에서 Shell/Form 구분이 필요한 경우
- **ShellEventRequest**: Shell 전용 API (`POST /api/runtime/shells/:projectId/events`)에서 사용

### 5.3 SHELL_EVENTS vs FORM_EVENTS

`SHELL_EVENTS`에 `'Load'`가 포함되며 이는 `FORM_EVENTS`에도 존재한다. 하지만 배열 자체가 다른 상수이고, 사용 맥락이 다르므로 충돌 없음.

### 5.4 하위 호환성

모든 변경이 하위 호환:
- `shell.ts`: 완전히 새 파일이므로 기존 코드에 영향 없음
- `UIPatch.type`: 기존 union에 멤버 추가 → 기존 코드의 switch/if 문에 새 case가 없어도 default/else로 처리됨
- `EventRequest`: 새 필드 모두 옵셔널(`?`) → 기존 사용처에서 무시 가능
- `RuntimeWsMessage.uiPatch.scope`: 옵셔널 → 기존 코드 영향 없음

### 5.5 formBorderStyle 타입 일관성

`FormProperties`와 `ShellProperties` 모두 `formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable'` 동일 리터럴 유니언 사용. 향후 공통 타입 `FormBorderStyle`로 추출할 수 있으나 현 단계에서는 인라인 유지.

---

## 6. 변경 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/common/src/types/shell.ts` | **신규** | ApplicationShellDefinition, ShellProperties, SHELL_EVENTS, ShellEventType, ShellEventRequest |
| `packages/common/src/types/protocol.ts` | **수정** | UIPatch type 확장, EventRequest 필드 추가, RuntimeWsMessage scope 추가 |
| `packages/common/src/index.ts` | **수정** | shell.ts export 5개 추가 |

---

## 7. 구현 순서

1. `packages/common/src/types/shell.ts` 신규 파일 생성
2. `packages/common/src/types/protocol.ts` UIPatch, EventRequest, RuntimeWsMessage 수정
3. `packages/common/src/index.ts` export 추가
4. `pnpm typecheck` 으로 타입 검증
