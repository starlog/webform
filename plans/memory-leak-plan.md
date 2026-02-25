# 메모리 누수 위험 분석 및 수정 계획

## 분석 요약

3개 영역에서 메모리 누수 위험을 발견했다:

| # | 영역 | 심각도 | 파일 |
|---|------|--------|------|
| 1 | Designer: mousedown → document 리스너 언마운트 미정리 | 낮음 | CanvasControl, ResizeHandle, DesignerCanvas, EventEditor |
| 2 | Runtime: 폼 전환 시 상태 미정리 | **높음** | runtimeStore.ts, AppContainer.tsx |
| 3 | Runtime: setupPatchListener 구독해제 미관리 | 낮음 | App.tsx, AppContainer.tsx, patchApplier.ts |

---

## 1. Designer: document.addEventListener 언마운트 시 미정리

### 현상

`CanvasControl.tsx`, `ResizeHandle.tsx`, `DesignerCanvas.tsx`, `EventEditor.tsx` 모두 동일 패턴 사용:

```
// mousedown 핸들러 내부
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

// mouseup 핸들러 내부에서 제거
const handleMouseUp = () => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};
```

**문제**: 드래그 중 컴포넌트가 언마운트되면(예: Delete 키로 컨트롤 삭제) `mouseup`이 발생하지 않아 `document` 리스너가 영구히 남는다.

### 영향받는 파일

| 파일 | 위치 | addEventListener | removeEventListener |
|------|------|-----------------|-------------------|
| `CanvasControl.tsx` | `handleMouseDown` (line 198-199) | mousemove, mouseup | line 177-178 |
| `ResizeHandle.tsx` | `handleMouseDown` (line 85-86) | mousemove, mouseup | line 81-82 |
| `DesignerCanvas.tsx` | 폼 리사이즈 핸들러 (line 340-341) | mousemove, mouseup | line 336-337 |
| `EventEditor.tsx` | 다이얼로그 드래그 (line 1098-1099) | mousemove, mouseup | line 1095-1096 |

### 심각도: 낮음

실제로 드래그 중 컴포넌트가 언마운트되는 시나리오는 드물다. 발생하더라도 고아 리스너는 참조하는 클로저가 GC 대상이 되면 실질적 영향이 제한적이다. 단, 코드 품질 관점에서 수정이 권장된다.

### 수정 방안

**접근법**: `useRef`로 활성 리스너 함수를 추적하고, `useEffect` cleanup에서 안전하게 제거한다.

#### CanvasControl.tsx 수정

```typescript
export function CanvasControl({ control, isSelected, onSnaplineChange, onContextMenu }: CanvasControlProps) {
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const isDragging = useRef(false);
  // 추가: 활성 리스너 참조 추적
  const activeDragListeners = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  // 추가: 언마운트 시 안전한 정리
  useEffect(() => {
    return () => {
      const { move, up } = activeDragListeners.current;
      if (move) document.removeEventListener('mousemove', move);
      if (up) document.removeEventListener('mouseup', up);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // ... 기존 코드 ...

    const handleMouseMove = (moveEvent: MouseEvent) => { /* 기존 */ };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // 추가: ref 정리
      activeDragListeners.current = { move: null, up: null };
      onSnaplineChange([]);
      // ... 기존 코드 ...
    };

    // 추가: ref에 기록
    activeDragListeners.current = { move: handleMouseMove, up: handleMouseUp };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  // ...
}
```

#### ResizeHandle.tsx, DesignerCanvas.tsx, EventEditor.tsx

동일한 `useRef` + `useEffect` cleanup 패턴을 적용한다.

---

## 2. Runtime: 폼 전환 시 상태 미정리 (높음)

### 현상 A: `runtimeStore.setFormDef()` — pendingPatchGroups 미초기화

`runtimeStore.ts:181-186`의 `setFormDef()`:

```typescript
setFormDef: (def) =>
  set((state) => {
    state.currentFormDef = def;
    state.controlStates = {};
    initControlStates(def.controls, state.controlStates);
    // ❌ pendingPatchGroups 초기화 안 됨
    // ❌ dialogQueue 초기화 안 됨
  }),
```

**문제**: 폼 A에서 `showDialog` 패치로 인해 `pendingPatchGroups`에 대기 중인 패치 그룹이 있을 때, 폼 B로 전환하면 폼 A의 패치가 폼 B의 `controlStates`에 적용된다. 존재하지 않는 컨트롤 ID에 대한 패치는 `console.warn`만 출력하지만, 우연히 같은 ID가 있으면 의도하지 않은 상태 변경이 발생한다.

### 현상 B: `AppContainer.loadFormInShell()` — bindingStore 미초기화

`AppContainer.tsx:59-84`의 `loadFormInShell()`:

```typescript
const loadFormInShell = useCallback(async (formId: string) => {
  fireBeforeLeaving();
  // ... 히스토리 push ...
  const def = await apiClient.fetchForm(formId);
  setFormDefinition(def);
  setFormDef(def);
  // ❌ useBindingStore.getState().reset() 호출 안 됨
}, [setFormDef, pushFormHistory, fireBeforeLeaving]);
```

**비교**: `App.tsx:83`의 `loadForm()`은 `useBindingStore.getState().reset()`을 호출한다.

**문제**: Shell 모드에서 폼 전환 시 이전 폼의 `dataSourceData`, `selectedRows`, `loadingStates`, `errors`가 그대로 남아 새 폼에서 오래된 데이터가 표시될 수 있다.

### 심각도: 높음

- `pendingPatchGroups` 미정리: 잘못된 패치가 새 폼에 적용됨 → 데이터 오류
- `bindingStore` 미정리: 오래된 데이터소스가 새 폼에 노출됨 → UX 혼란

### 수정 방안

#### runtimeStore.ts — `setFormDef()`에 상태 초기화 추가

```typescript
setFormDef: (def) =>
  set((state) => {
    state.currentFormDef = def;
    state.controlStates = {};
    state.pendingPatchGroups = [];  // 추가
    state.dialogQueue = [];         // 추가
    initControlStates(def.controls, state.controlStates);
  }),
```

> **참고**: `dialogQueue` 초기화는 의도적으로 유지하고 싶을 수 있다(예: 폼 전환 알림). 그 경우 `pendingPatchGroups`만 초기화한다.

#### AppContainer.tsx — `loadFormInShell()`에 바인딩 초기화 추가

```typescript
import { useBindingStore } from '../bindings/bindingStore';

const loadFormInShell = useCallback(
  async (formId: string) => {
    fireBeforeLeaving();

    if (currentFormIdRef.current) {
      pushFormHistory(currentFormIdRef.current);
    }

    // 추가: 바인딩 상태 초기화
    useBindingStore.getState().reset();

    try {
      const def = await apiClient.fetchForm(formId);
      // ... 기존 코드 ...
    } catch (err) {
      console.error('Failed to load form in shell:', err);
    }
  },
  [setFormDef, pushFormHistory, fireBeforeLeaving],
);
```

---

## 3. Runtime: setupPatchListener 구독해제 미관리

### 현상

`patchApplier.ts:9`의 `setupPatchListener()`는 `wsClient.onMessage()`의 반환값(구독해제 함수)을 반환한다:

```typescript
export function setupPatchListener(...): () => void {
  return wsClientInstance.onMessage((message) => { ... });
}
```

호출 측에서 반환값을 캡처하지 않는다:

```typescript
// App.tsx:105
setupPatchListener({ applyPatches, applyShellPatches }, wsClient);  // 반환값 무시

// AppContainer.tsx:115
setupPatchListener({ applyPatches, applyShellPatches }, wsClient);  // 반환값 무시
```

### 현재 완화 요소

- `App.tsx`: `loadForm()` 시작 시 `wsClient.disconnect()`를 호출하여 `this.listeners = []`로 전체 초기화 → 리스너 누적 방지됨
- `AppContainer.tsx`: 초기 로드 시 1회만 호출 → 누적 없음
- `wsClient.disconnect()`가 항상 cleanup에서 호출됨

### 심각도: 낮음

현재 `disconnect()`가 리스너를 전체 초기화하므로 실질적 누수는 없다. 단, 향후 `disconnect()` 호출 없이 리스너를 교체하는 코드가 추가되면 누수가 발생할 수 있어, 방어적 코딩 관점에서 수정이 권장된다.

### 수정 방안

#### App.tsx — 구독해제 함수 추적

```typescript
const unsubPatchRef = useRef<(() => void) | null>(null);

const loadForm = useCallback(async (formId: string) => {
  fireBeforeLeaving();
  setLoading(true);
  setError(null);
  useBindingStore.getState().reset();

  // 기존 구독 해제
  unsubPatchRef.current?.();
  wsClient.disconnect();

  try {
    await ensureAuthToken();
    const def = await apiClient.fetchForm(formId);
    // ...
    wsClient.connect(formId);
    unsubPatchRef.current = setupPatchListener(
      { applyPatches, applyShellPatches },
      wsClient,
    );
  } catch (err) { /* ... */ }
}, [/* deps */]);

useEffect(() => {
  // ...
  return () => {
    unsubPatchRef.current?.();
    wsClient.disconnect();
  };
}, [initialFormId, loadForm]);
```

#### AppContainer.tsx — 동일 패턴 적용

```typescript
useEffect(() => {
  let cancelled = false;
  let unsubPatch: (() => void) | null = null;

  async function loadApp() {
    // ...
    wsClient.connectApp(projectId);
    unsubPatch = setupPatchListener({ applyPatches, applyShellPatches }, wsClient);
  }

  loadApp();

  return () => {
    cancelled = true;
    unsubPatch?.();
    wsClient.disconnect();
  };
}, [/* deps */]);
```

---

## 수정 우선순위

| 순서 | 항목 | 이유 |
|------|------|------|
| 1 | runtimeStore `setFormDef()` pendingPatchGroups 초기화 | 잘못된 패치 적용 방지 (데이터 정확성) |
| 2 | AppContainer `loadFormInShell()` bindingStore reset | Shell 모드 폼 전환 시 데이터 오염 방지 |
| 3 | setupPatchListener 반환값 관리 | 방어적 코딩 (현재 완화됨) |
| 4 | Designer document 리스너 cleanup | 코드 품질 향상 (실제 발생 가능성 낮음) |

## 테스트 계획

### runtimeStore 테스트
- `setFormDef()` 호출 시 `pendingPatchGroups`가 빈 배열로 초기화되는지 확인
- `setFormDef()` 호출 시 `dialogQueue`가 빈 배열로 초기화되는지 확인 (옵션)

### AppContainer 테스트
- Shell 모드에서 `loadFormInShell()` 호출 시 `bindingStore.reset()`이 호출되는지 확인
- 기존 `bindingStore` 데이터가 폼 전환 후 초기화되었는지 확인

### setupPatchListener 테스트
- `loadForm()` 재호출 시 이전 구독이 해제되고 새 구독만 활성 상태인지 확인
- 컴포넌트 언마운트 시 구독이 해제되는지 확인

### Designer 리스너 테스트
- `CanvasControl` 드래그 중 언마운트 시 document 리스너가 제거되는지 확인
- `ResizeHandle` 드래그 중 언마운트 시 document 리스너가 제거되는지 확인
