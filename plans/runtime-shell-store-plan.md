# Runtime Store Shell 상태 확장 계획

## 1. 현재 runtimeStore 상태 전체 목록

### 상태 (State)
| 필드 | 타입 | 초기값 | 용도 |
|------|------|--------|------|
| `currentFormDef` | `FormDefinition \| null` | `null` | 현재 로드된 폼 정의 |
| `controlStates` | `Record<string, Record<string, unknown>>` | `{}` | 폼 컨트롤별 런타임 상태 |
| `dialogQueue` | `DialogMessage[]` | `[]` | showDialog 패치로 추가된 메시지 큐 |
| `navigateRequest` | `NavigateRequest \| null` | `null` | navigate 패치 발생 시 전환 요청 |
| `pendingPatchGroups` | `UIPatch[][]` | `[]` | 다이얼로그 대기 중인 패치 그룹 |

### 메서드 (Actions)
| 메서드 | 시그니처 | 용도 |
|--------|----------|------|
| `setFormDef` | `(def: FormDefinition) => void` | 폼 정의 설정 + controlStates 초기화 |
| `updateControlState` | `(controlId, property, value) => void` | 개별 컨트롤 속성 업데이트 |
| `getControlState` | `(controlId) => Record<string, unknown>` | 컨트롤 상태 조회 |
| `applyPatch` | `(patch: UIPatch) => void` | 단일 패치 적용 |
| `applyPatches` | `(patches: UIPatch[]) => void` | 다중 패치 적용 (showDialog 경계로 그룹 분할) |
| `dismissDialog` | `() => void` | 다이얼로그 닫기 + 대기 패치 처리 |
| `requestNavigate` | `(formId, params?) => void` | 네비게이션 요청 설정 |
| `clearNavigateRequest` | `() => void` | 네비게이션 요청 초기화 |

### 헬퍼 함수 (모듈 스코프)
- `initControlStates(controls, states)` — 재귀적으로 컨트롤 → 상태 초기화
- `removeControlFromList(controls, targetId)` — 재귀적으로 컨트롤 제거
- `addControlToParent(controls, parentId, newControl)` — 부모 컨트롤에 자식 추가
- `applyPatchToState(state, patch)` — 단일 패치를 immer draft에 적용 (updateProperty, addControl, removeControl, showDialog, navigate)

---

## 2. 현재 apiClient 메서드 목록

| 메서드 | 엔드포인트 | 반환 타입 |
|--------|-----------|-----------|
| `fetchForm(formId)` | `GET /api/runtime/forms/:formId` | `FormDefinition` |
| `postEvent(formId, payload)` | `POST /api/runtime/forms/:formId/events` | `EventResponse` |
| `queryDataSource(formId, dsId, query?)` | `POST /api/runtime/forms/:formId/data` | `unknown[]` |
| `mongoQuery(...)` | `POST /api/runtime/mongodb/query` | `{data, totalCount}` |
| `mongoInsert(...)` | `POST /api/runtime/mongodb/insert` | `{insertedId}` |
| `mongoUpdate(...)` | `POST /api/runtime/mongodb/update` | `{modifiedCount}` |
| `mongoDelete(...)` | `POST /api/runtime/mongodb/delete` | `{deletedCount}` |

패턴: `ApiClient` 클래스, `this.baseUrl` (기본 `/api`), `fetch` → JSON 파싱, 에러 시 `throw new Error`.

---

## 3. 현재 wsClient 구조

```typescript
class WsClient {
  connect(formId: string): void    // /ws/runtime/${formId}
  onMessage(callback): () => void  // 리스너 등록, 해제 함수 반환
  disconnect(): void               // 연결 해제 + 리스너 클리어
}
```
- 단일 폼 단위 WebSocket 연결
- 자동 재연결 (5초 타이머)
- `patchApplier.ts`가 `setupPatchListener`로 uiPatch/eventResult 메시지 → `applyPatches` 호출

---

## 4. 서버 Shell API 현황 (이미 구현됨)

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /api/runtime/app/:projectId` | Shell + 시작폼 일괄 로드 (`AppLoadResponse`) |
| `GET /api/runtime/shells/:projectId` | 퍼블리시된 Shell 정의 조회 |
| `POST /api/runtime/shells/:projectId/events` | Shell 이벤트 실행 (EventResponse) |
| `WS /ws/runtime/app/:projectId` | Per-project WebSocket (scope 기반 라우팅) |

### WebSocket 메시지 프로토콜 (서버 → 클라이언트)
```typescript
// scope 필드로 Shell/Form 패치 구분
{ type: 'uiPatch', payload: UIPatch[], scope?: 'shell' | 'form' }
```

### WebSocket 메시지 프로토콜 (클라이언트 → 서버)
```typescript
// 초기 appState 동기화
{ type: 'initAppState', payload: Record<string, unknown> }

// 이벤트 요청 (scope로 Shell/Form 구분)
{ type: 'event', payload: EventRequest }  // EventRequest.scope = 'shell' | 'form'
```

### 서버 EventRequest → ShellEventRequest 필드 매핑
- `EventRequest.formState` → `ShellEventRequest.shellState`
- `EventRequest.formId` → `ShellEventRequest.currentFormId`

---

## 5. 확장할 상태/메서드의 정확한 코드 초안

### 5.1 runtimeStore.ts 확장

#### 추가 import
```typescript
import type {
  FormDefinition, ControlDefinition, UIPatch,
  ApplicationShellDefinition,  // 추가
} from '@webform/common';
```

#### 추가 상태 필드 (RuntimeState 인터페이스)
```typescript
// --- Shell 관련 상태 ---
shellDef: ApplicationShellDefinition | null;
shellControlStates: Record<string, Record<string, unknown>>;
appState: Record<string, unknown>;
formHistory: Array<{ formId: string; params?: Record<string, unknown> }>;
navigateParams: Record<string, unknown>;
```

#### 추가 메서드 (RuntimeState 인터페이스)
```typescript
// --- Shell 관련 메서드 ---
setShellDef: (def: ApplicationShellDefinition | null) => void;
updateShellControlState: (controlId: string, property: string, value: unknown) => void;
getShellControlState: (controlId: string) => Record<string, unknown>;
applyShellPatches: (patches: UIPatch[]) => void;
setAppState: (key: string, value: unknown) => void;
pushFormHistory: (formId: string, params?: Record<string, unknown>) => void;
popFormHistory: () => { formId: string; params?: Record<string, unknown> } | null;
```

#### 초기 상태값
```typescript
// create 내부
shellDef: null,
shellControlStates: {},
appState: {},
formHistory: [],
navigateParams: {},
```

#### 메서드 구현 코드 초안

```typescript
setShellDef: (def) =>
  set((state) => {
    state.shellDef = def;
    state.shellControlStates = {};
    if (def) {
      initControlStates(def.controls, state.shellControlStates);
    }
  }),

updateShellControlState: (controlId, property, value) =>
  set((state) => {
    if (!state.shellControlStates[controlId]) {
      state.shellControlStates[controlId] = {};
    }
    state.shellControlStates[controlId][property] = value;
  }),

getShellControlState: (controlId) => {
  return get().shellControlStates[controlId] ?? {};
},

applyShellPatches: (patches) =>
  set((state) => {
    for (const patch of patches) {
      switch (patch.type) {
        case 'updateShell': {
          // Shell 컨트롤 속성 업데이트 (폼의 updateProperty와 동일 로직)
          const controlState = state.shellControlStates[patch.target];
          if (controlState) {
            Object.assign(controlState, patch.payload);
          }
          break;
        }
        case 'updateAppState': {
          // appState 키별 업데이트 (undefined면 삭제)
          for (const [key, value] of Object.entries(patch.payload)) {
            if (value === undefined) {
              delete state.appState[key];
            } else {
              state.appState[key] = value;
            }
          }
          break;
        }
        case 'navigate': {
          // 기존 navigateRequest 메커니즘 재사용
          const navPayload = patch.payload as {
            formId?: string;
            params?: Record<string, unknown>;
            back?: boolean;
          };
          if (navPayload.back) {
            // formHistory에서 팝하여 이전 폼으로 돌아가기
            const prev = state.formHistory.length > 0
              ? state.formHistory[state.formHistory.length - 1]
              : null;
            if (prev) {
              state.formHistory.pop();
              state.navigateRequest = {
                formId: prev.formId,
                params: prev.params ?? {},
              };
              state.navigateParams = prev.params ?? {};
            }
          } else {
            state.navigateRequest = {
              formId: navPayload.formId ?? '',
              params: navPayload.params ?? {},
            };
            state.navigateParams = navPayload.params ?? {};
          }
          break;
        }
        case 'closeApp': {
          // 앱 종료 — window.close() 또는 특수 플래그 설정
          // 브라우저에서 window.close()는 스크립트가 연 창에서만 동작
          // 부모 창이 있으면 닫고, 없으면 빈 페이지로 이동
          try {
            window.close();
          } catch {
            // fallback: 빈 페이지로 이동
            window.location.href = 'about:blank';
          }
          break;
        }
        case 'showDialog': {
          // showDialog는 Shell 컨텍스트에서도 동일하게 처리
          const payload = patch.payload as { text?: string; title?: string; dialogType?: string };
          state.dialogQueue.push({
            text: payload.text ?? '',
            title: payload.title ?? '',
            dialogType: (payload.dialogType as DialogMessage['dialogType']) ?? 'info',
          });
          break;
        }
        default:
          // 기존 폼 패치 타입(updateProperty 등)은 무시
          break;
      }
    }
  }),

setAppState: (key, value) =>
  set((state) => {
    state.appState[key] = value;
  }),

pushFormHistory: (formId, params) =>
  set((state) => {
    state.formHistory.push({ formId, params });
  }),

popFormHistory: () => {
  const history = get().formHistory;
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  set((state) => {
    state.formHistory.pop();
  });
  return last;
},
```

### 5.2 apiClient.ts 확장

#### 추가 import
```typescript
import type {
  FormDefinition, EventRequest, EventResponse,
  ApplicationShellDefinition,  // 추가
  ShellEventRequest,           // 추가
  AppLoadResponse,             // 추가
} from '@webform/common';
```

#### 추가 메서드
```typescript
async fetchApp(projectId: string, formId?: string): Promise<AppLoadResponse> {
  const params = formId ? `?formId=${encodeURIComponent(formId)}` : '';
  const res = await fetch(`${this.baseUrl}/runtime/app/${projectId}${params}`);
  if (!res.ok) throw new Error(`Failed to fetch app: ${res.status}`);
  return res.json();
}

async fetchShell(projectId: string): Promise<ApplicationShellDefinition | null> {
  const res = await fetch(`${this.baseUrl}/runtime/shells/${projectId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch shell: ${res.status}`);
  return res.json();
}

async postShellEvent(projectId: string, event: ShellEventRequest): Promise<EventResponse> {
  const res = await fetch(`${this.baseUrl}/runtime/shells/${projectId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Shell event request failed: ${res.status}`);
  return res.json();
}
```

---

## 6. applyShellPatches 로직 설계

### 패치 타입별 처리 흐름

```
서버 EventEngine.executeShellEvent()
  ├─ updateProperty → updateShell 변환 (서버 extractShellPatches에서)
  ├─ appState 변경 → updateAppState 패치 생성
  ├─ navigate() → navigate 패치
  ├─ closeApp() → closeApp 패치
  └─ showDialog() → showDialog 패치

                    ↓ (scope: 'shell')

클라이언트 applyShellPatches()
  ├─ updateShell   → shellControlStates[target] 업데이트
  ├─ updateAppState → appState 키별 업데이트 (undefined = 삭제)
  ├─ navigate      → navigateRequest 설정 (back:true면 formHistory 팝)
  ├─ closeApp      → window.close() 시도
  └─ showDialog    → dialogQueue에 추가
```

### navigate의 formHistory 연동

```
navigate(formId, params):
  1. 현재 폼을 formHistory에 push (App.tsx에서 loadForm 전에)
  2. navigateRequest 설정
  3. App.tsx의 기존 navigate 핸들러가 loadForm 호출

navigateBack():
  1. formHistory에서 pop
  2. pop된 항목의 formId로 navigateRequest 설정
  3. navigateParams에 pop된 params 설정
```

### applyShellPatches vs applyPatches 분리 이유

- `applyPatches`: 폼 컨트롤 대상 — `controlStates` 업데이트, showDialog 경계 그룹 분할 로직
- `applyShellPatches`: Shell 컨트롤 대상 — `shellControlStates` 업데이트, appState 관리, navigate/closeApp 처리
- 서버에서 `scope: 'shell' | 'form'`으로 구분하여 전송하므로, 클라이언트에서도 분리 처리

---

## 7. wsClient scope 기반 라우팅 설계

### 현재 wsClient 한계
- 단일 폼 ID 기반 연결 (`/ws/runtime/${formId}`)
- scope 개념 없음
- App 모드에서는 per-project 연결이 필요

### 확장 방안: WsClient에 connectApp 메서드 추가

```typescript
class WsClient {
  private ws: WebSocket | null = null;
  private listeners: WsEventCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPath: string | null = null;  // 추가: 재연결용

  // 기존 메서드 유지
  connect(formId: string): void { ... }  // /ws/runtime/${formId}
  onMessage(callback): () => void { ... }
  disconnect(): void { ... }

  // 추가: per-project 연결
  connectApp(projectId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/ws/runtime/app/${projectId}`;
    this.currentPath = path;
    const url = `${protocol}//${window.location.host}${path}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as RuntimeWsMessage;
      this.listeners.forEach((cb) => cb(message));
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => {
        if (this.currentPath === path) this.connectApp(projectId);
      }, 5000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  // 추가: 서버에 메시지 전송 (initAppState 등)
  send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
```

### patchApplier.ts 확장: scope 기반 라우팅

```typescript
export function setupPatchListener(
  runtimeStore: Pick<RuntimeState, 'applyPatches' | 'applyShellPatches'>,
  wsClientInstance: WsClientType,
): () => void {
  return wsClientInstance.onMessage((message) => {
    switch (message.type) {
      case 'uiPatch': {
        const scope = (message as { scope?: string }).scope;
        if (scope === 'shell') {
          runtimeStore.applyShellPatches(message.payload);
        } else {
          runtimeStore.applyPatches(message.payload);
        }
        break;
      }
      case 'dataRefresh':
        console.log('dataRefresh received:', message.payload);
        break;
      case 'error':
        console.error('Server error:', message.payload);
        break;
      case 'eventResult': {
        const scope = (message as { scope?: string }).scope;
        if (message.payload.patches) {
          if (scope === 'shell') {
            runtimeStore.applyShellPatches(message.payload.patches);
          } else {
            runtimeStore.applyPatches(message.payload.patches);
          }
        }
        break;
      }
    }
  });
}
```

---

## 8. 수정 대상 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/runtime/src/stores/runtimeStore.ts` | 확장 | Shell 상태 5개 + 메서드 7개 추가 |
| `packages/runtime/src/communication/apiClient.ts` | 확장 | fetchApp, fetchShell, postShellEvent 추가 |
| `packages/runtime/src/communication/wsClient.ts` | 확장 | connectApp, send 메서드 추가 |
| `packages/runtime/src/communication/patchApplier.ts` | 수정 | scope 기반 applyShellPatches/applyPatches 분기 |

---

## 9. 주의사항

1. **하위 호환성**: 기존 `connect(formId)` 방식은 그대로 유지. Shell 없는 폼은 기존 방식으로 동작.
2. **Immer 패턴 일관성**: 모든 상태 변경은 `set((state) => { ... })` 패턴. `get()`은 읽기 전용.
3. **initControlStates 재사용**: Shell 컨트롤 초기화에도 기존 `initControlStates` 헬퍼 사용.
4. **navigate 처리 분리**: `applyShellPatches`의 navigate는 `navigateRequest`만 설정하고, formHistory push는 `App.tsx`의 `loadForm` 내에서 처리 (다음 태스크 runtime-shell-app에서 구현).
5. **AppLoadResponse 타입**: `@webform/common`의 `shell.ts`에 이미 정의되어 있으므로 import해서 사용.
6. **closeApp 동작**: 브라우저 보안 정책상 `window.close()`는 스크립트가 연 창에서만 동작. fallback으로 `about:blank` 이동.
