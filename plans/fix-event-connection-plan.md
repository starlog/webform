# 이벤트 핸들러 복원 로직 버그 수정 계획

## 문제 요약

`designerStore.loadForm()`이 호출될 때마다 `formEventHandlers`와 `formEventCode`를 빈 객체로 리셋한다. 이벤트 핸들러를 서버 데이터에서 복원하는 로직은 `App.tsx`의 `handleFormSelect`에만 존재하며, 아래 4개 호출 위치에서는 복원이 누락된다:

| # | 파일 | 라인 | 상황 | 영향 |
|---|------|------|------|------|
| 1 | `ProjectExplorer.tsx` | 139-141 | 폼 이름 변경 후 reload | 컨트롤+폼 이벤트 소실 |
| 2 | `ProjectExplorer.tsx` | 214-215 | 프로젝트 폰트 일괄 적용 후 reload | 컨트롤+폼 이벤트 소실 |
| 3 | `DesignerCanvas.tsx` | 165-168 | Undo | 폼 레벨 이벤트 소실 |
| 4 | `DesignerCanvas.tsx` | 177-180 | Redo | 폼 레벨 이벤트 소실 |

### 소실 메커니즘

1. 위 경로에서 `loadForm()` 호출 → `formEventHandlers = {}, formEventCode = {}` 리셋
2. 컨트롤의 `properties._eventHandlers`/`_eventCode`는 시나리오에 따라 다름:
   - **시나리오 1,2** (서버 reload): `flattenControls(data.controls)` 실행 시 서버 JSON에는 `_eventHandlers`가 없으므로 빈 상태
   - **시나리오 3,4** (Undo/Redo): 스냅샷이 flat controls의 JSON.stringify이므로 `_eventHandlers`가 이미 포함되어 보존됨
3. `isDirty = false`로 설정되지만, 폼 레벨 이벤트가 빠진 상태에서 다른 변경이 발생하면 `isDirty = true`
4. auto-save 또는 수동 save 시 `extractEventHandlers()`가 빈 `_eventHandlers`와 빈 `formEventHandlers`에서 추출 → 빈 배열이 서버에 저장
5. **이벤트 핸들러 영구 소실**

---

## 접근법 비교

### 접근법 A: `restoreEventHandlers` 유틸 함수 추출

App.tsx의 handleFormSelect 라인 97-151의 복원 로직을 별도 유틸 함수로 추출하여, `loadForm()`을 호출하는 모든 곳에서 함께 호출한다.

```typescript
// utils/eventHandlerUtils.ts
export function restoreEventHandlers(formId: string, eventHandlers: EventHandlerDefinition[]): void {
  // App.tsx 라인 97-151 로직을 그대로 이동
}
```

**호출 패턴:**
```typescript
// 서버에서 reload 하는 경우 (App.tsx, ProjectExplorer.tsx)
const { data } = await apiService.loadForm(formId);
state.loadForm(formId, data.controls, data.properties);
restoreEventHandlers(formId, data.eventHandlers); // 추가
state.markClean(); // 추가
```

**장점:**
- 기존 `loadForm()` 시그니처 변경 없음
- 코드 이동만으로 구현 가능, 구조 변경 최소화

**단점:**
- `loadForm()` 호출 시 `restoreEventHandlers()`도 반드시 호출해야 한다는 **암묵적 규약** 생성
- 새로운 `loadForm()` 호출 위치가 추가될 때마다 같은 실수 반복 가능
- Undo/Redo 경로에서는 `eventHandlers` 배열이 없으므로 별도 처리 필요 (form 레벨 이벤트 보존 로직 분기)
- `restoreEventHandlers`가 `useDesignerStore.getState()`를 직접 호출하여 store의 내부 상태를 외부에서 조작 (캡슐화 위반)

**수정 파일 목록:**
1. `packages/designer/src/utils/eventHandlerUtils.ts` (신규 생성)
2. `packages/designer/src/App.tsx` (복원 로직 추출, 유틸 함수 호출로 대체)
3. `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` (2곳에 유틸 함수 호출 추가)
4. `packages/designer/src/components/Canvas/DesignerCanvas.tsx` (Undo/Redo에서 폼 레벨 이벤트 보존 처리)

---

### 접근법 B: `loadForm()`에 eventHandlers 통합 (권장)

`loadForm()`의 시그니처에 `eventHandlers` optional 파라미터를 추가하고, 내부에서 컨트롤 및 폼 레벨 이벤트를 복원한다.

```typescript
// designerStore.ts
loadForm: (
  formId: string,
  controls: ControlDefinition[],
  properties: FormProperties,
  eventHandlers?: Array<{ controlId: string; eventName: string; handlerCode: string }>
) => void;
```

**구현 로직:**
```typescript
loadForm: (formId, controls, properties, eventHandlers) => set((state) => {
  state.currentFormId = formId;
  state.controls = flattenControls(controls) as ControlDefinition[];
  state.formProperties = properties;

  if (eventHandlers) {
    // 서버에서 reload하는 경우: 이벤트 핸들러 복원
    state.formEventHandlers = {};
    state.formEventCode = {};

    for (const eh of eventHandlers) {
      if (eh.controlId === formId) {
        // 폼 레벨 이벤트
        const handlerName = `Form_${eh.eventName}`;
        state.formEventHandlers[eh.eventName] = handlerName;
        state.formEventCode[handlerName] = eh.handlerCode;
      } else {
        // 컨트롤 레벨 이벤트
        const ctrl = state.controls.find((c) => c.id === eh.controlId);
        if (!ctrl) continue;
        const handlerName = `${ctrl.name}_${eh.eventName}`;
        if (!ctrl.properties._eventHandlers) ctrl.properties._eventHandlers = {};
        if (!ctrl.properties._eventCode) ctrl.properties._eventCode = {};
        (ctrl.properties._eventHandlers as Record<string, string>)[eh.eventName] = handlerName;
        (ctrl.properties._eventCode as Record<string, string>)[handlerName] = eh.handlerCode;
      }
    }
  } else {
    // Undo/Redo 경로: formEventHandlers/formEventCode를 리셋하지 않고 보존
    // 컨트롤 레벨 이벤트는 스냅샷의 properties._eventHandlers에 이미 포함되어 있음
  }

  state.isDirty = false;
}),
```

**호출 패턴:**
```typescript
// 서버에서 reload (App.tsx, ProjectExplorer.tsx)
const { data } = await apiService.loadForm(formId);
state.loadForm(formId, data.controls, data.properties, data.eventHandlers);
// markClean() 불필요 — loadForm 내부에서 isDirty = false 설정됨

// Undo/Redo (DesignerCanvas.tsx) — 기존과 동일, eventHandlers 미전달
state.loadForm(formId, restoredControls, state.formProperties);
// formEventHandlers/formEventCode가 보존됨
```

**장점:**
- `loadForm()`이 **항상 완전한 상태**를 생성 — 규약 위반 불가
- 새로운 호출 위치 추가 시에도 `eventHandlers`를 전달하면 자동 복원
- Undo/Redo 경로에서 `eventHandlers` 미전달 시 폼 레벨 이벤트가 자동 보존
- 기존 `loadFormEvents()` 호출 및 외부에서의 `markClean()` 호출이 불필요
- store 내부에서 상태 관리가 완결 (캡슐화 유지)

**단점:**
- `loadForm()` 시그니처 변경으로 타입 정의도 수정 필요
- immer set 콜백 내 로직이 다소 길어짐

**수정 파일 목록:**
1. `packages/designer/src/stores/designerStore.ts` — `loadForm` 시그니처 및 구현 변경
2. `packages/designer/src/App.tsx` — `handleFormSelect`에서 복원 로직 제거, `loadForm` 호출에 `eventHandlers` 전달
3. `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` — 2곳에서 `loadForm` 호출 시 `eventHandlers` 전달
4. `packages/designer/src/components/Canvas/DesignerCanvas.tsx` — 변경 없음 (Undo/Redo는 기존 시그니처 호환)

---

## 결정: 접근법 B 채택

| 기준 | 접근법 A | 접근법 B |
|------|----------|----------|
| 규약 위반 방지 | ❌ 암묵적 규약 | ✅ 시그니처로 보장 |
| Undo/Redo 폼 이벤트 보존 | 별도 로직 필요 | ✅ 자동 보존 |
| 캡슐화 | ❌ 외부에서 store 조작 | ✅ store 내부 완결 |
| 수정 파일 수 | 4 (1 신규) | 3 (신규 없음) |
| 기존 호출 호환성 | ✅ 호환 | ✅ optional 파라미터 |
| 향후 유지보수 | ❌ 호출마다 복원 필수 | ✅ loadForm만 호출하면 됨 |

---

## 상세 수정 계획

### 1. `packages/designer/src/stores/designerStore.ts`

**변경 내용:**

1. `DesignerState` 인터페이스의 `loadForm` 타입 시그니처 수정:
   ```typescript
   loadForm: (
     formId: string,
     controls: ControlDefinition[],
     properties: FormProperties,
     eventHandlers?: Array<{ controlId: string; eventName: string; handlerCode: string }>
   ) => void;
   ```

2. `loadForm` 구현 수정:
   - `eventHandlers` 파라미터가 전달된 경우:
     - `formEventHandlers`, `formEventCode` 초기화
     - `eventHandlers` 배열을 순회하며 `controlId === formId`이면 폼 레벨, 아니면 컨트롤 레벨 이벤트로 분류
     - 컨트롤 레벨: `state.controls`에서 해당 컨트롤을 찾아 `_eventHandlers`와 `_eventCode`에 주입
     - 폼 레벨: `state.formEventHandlers`와 `state.formEventCode`에 설정
   - `eventHandlers` 파라미터가 undefined인 경우 (Undo/Redo):
     - `formEventHandlers`, `formEventCode`를 리셋하지 않음 (기존 값 보존)
     - 컨트롤 레벨 이벤트는 스냅샷의 `properties._eventHandlers`에 포함되어 `flattenControls`가 보존

### 2. `packages/designer/src/App.tsx`

**변경 내용:**

1. `handleFormSelect` 함수에서:
   - `store.loadForm(formId, data.controls, data.properties, data.eventHandlers)` 호출로 변경
   - 라인 97-151의 이벤트 핸들러 복원 코드 전체 제거
   - `markClean()` 호출 제거 (loadForm 내부에서 처리)

### 3. `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx`

**변경 내용:**

1. `commitRename` 함수 (라인 139-141):
   ```typescript
   // Before:
   state.loadForm(formId, data.controls, data.properties);
   // After:
   state.loadForm(formId, data.controls, data.properties, data.eventHandlers);
   ```

2. `handleApplyProjectFont` 함수 (라인 214-215):
   ```typescript
   // Before:
   state.loadForm(state.currentFormId, data.controls, data.properties);
   // After:
   state.loadForm(state.currentFormId, data.controls, data.properties, data.eventHandlers);
   ```

### 4. `packages/designer/src/components/Canvas/DesignerCanvas.tsx`

**변경 없음** — Undo/Redo는 `eventHandlers` 파라미터 없이 `loadForm()`을 호출하며, 접근법 B에서 이 경우 `formEventHandlers`/`formEventCode`가 보존된다.

---

## Undo/Redo 이벤트 보존 분석

### 컨트롤 레벨 이벤트
- 스냅샷: `JSON.stringify(useDesignerStore.getState().controls)` — flat 배열
- flat 컨트롤의 `properties`에 `_eventHandlers`와 `_eventCode`가 포함되어 있음
- `loadForm()` 내부에서 `flattenControls(restoredControls)` 호출 시:
  - 이미 flat한 controls에 children이 없으므로 최상위만 순회
  - `{ ...ctrl.properties }`로 spread하여 `_eventHandlers`/`_eventCode` 보존
- **결과: 보존됨** ✅

### 폼 레벨 이벤트
- 현재: `loadForm()` 호출 시 `formEventHandlers = {}`로 리셋 → **소실**
- 수정 후: `eventHandlers` 미전달 시 리셋하지 않음 → **보존됨** ✅

### 히스토리 스냅샷의 한계
- 히스토리 스냅샷에 `formEventHandlers`/`formEventCode`가 포함되지 않음
- 만약 폼 레벨 이벤트를 추가/수정한 후 Undo하면, 폼 레벨 이벤트는 Undo 대상이 되지 않음
- 이는 현재 아키텍처의 제한으로, 본 버그 수정 범위 밖임 (향후 히스토리에 전체 상태 포함으로 개선 가능)

---

## 테스트 검증 항목

1. **서버 reload 후 이벤트 복원**: loadForm with eventHandlers → 컨트롤 및 폼 레벨 이벤트가 정상 복원되는지
2. **Undo/Redo 후 이벤트 보존**: loadForm without eventHandlers → formEventHandlers가 리셋되지 않는지
3. **중첩 컨트롤 이벤트 복원**: TabControl > Panel > Button 구조에서 Button의 이벤트가 복원되는지
4. **Save/Load 순환**: loadForm → extractEventHandlers → 다시 loadForm → 동일 이벤트 유지
5. **폼 이름 변경 후 이벤트 보존**: commitRename 후 이벤트 핸들러가 유지되는지
6. **폰트 일괄 적용 후 이벤트 보존**: handleApplyProjectFont 후 이벤트 핸들러가 유지되는지
