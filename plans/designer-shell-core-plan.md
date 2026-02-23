# Designer Shell 핵심 기능 (Store / ProjectExplorer) 계획

## 1. 현재 designerStore 상태/메서드 전체 목록

### 상태 (State)
| 이름 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `controls` | `ControlDefinition[]` | `[]` | 현재 폼의 컨트롤 목록 |
| `formProperties` | `FormProperties` | `DEFAULT_FORM_PROPERTIES` | 현재 폼 속성 |
| `isDirty` | `boolean` | `false` | 변경 여부 |
| `currentFormId` | `string \| null` | `null` | 현재 열린 폼 ID |
| `currentProjectId` | `string \| null` | `null` | 현재 프로젝트 ID |
| `projectDefaultFont` | `FontDefinition \| null` | `null` | 프로젝트 기본 폰트 |
| `gridSize` | `number` | `8` | 그리드 크기 |
| `formEventHandlers` | `Record<string, string>` | `{}` | eventName → handlerName |
| `formEventCode` | `Record<string, string>` | `{}` | handlerName → code |

### 메서드 (Actions)
| 메서드 | 설명 |
|--------|------|
| `addControl(control)` | 컨트롤 추가 |
| `updateControl(id, changes)` | 컨트롤 속성 업데이트 |
| `removeControl(id)` | 컨트롤 삭제 |
| `removeControls(ids)` | 다중 컨트롤 삭제 |
| `moveControl(id, position)` | 컨트롤 위치 이동 |
| `resizeControl(id, size, position?)` | 컨트롤 크기 변경 |
| `bringToFront(id)` | z-order 최상위 |
| `sendToBack(id)` | z-order 최하위 |
| `setFormProperties(props)` | 폼 속성 변경 |
| `setGridSize(size)` | 그리드 크기 설정 |
| `loadForm(formId, controls, properties, eventHandlers?)` | 폼 로드 |
| `loadFormEvents(eventHandlers, eventCode)` | 폼 이벤트 로드 |
| `setFormEventHandler(eventName, handlerName)` | 이벤트 핸들러 설정 |
| `setFormEventCode(handlerName, code)` | 이벤트 코드 설정 |
| `deleteFormEventHandler(eventName)` | 이벤트 핸들러 삭제 |
| `markClean()` | isDirty = false |
| `setCurrentProject(projectId)` | 프로젝트 설정 |
| `setProjectDefaultFont(font)` | 기본 폰트 설정 |

### 헬퍼 함수 (모듈 내보내기)
- `createDefaultControl(type, position)` — 컨트롤 기본값 생성
- `getDefaultSize(type)` — 컨트롤 기본 크기 반환

---

## 2. 현재 ProjectExplorer 구조 분석

### 컴포넌트 Props
```typescript
interface ProjectExplorerProps {
  onFormSelect: (formId: string) => void;
  refreshKey?: number;
}
```

### 내부 상태
- `projects: ProjectWithForms[]` — 프로젝트 + 폼 목록
- `expandedNodes: Set<string>` — 트리 펼침 상태
- `selectedNode: string | null` — 선택된 노드 ID
- `contextMenu: ContextMenu | null` — 우클릭 메뉴
- `renamingFormId / renamingValue` — 이름 변경 상태
- `fontDialog / defaultFontDialog` — 폰트 관련 다이얼로그

### 트리 구조 (현재)
```
📁 프로젝트명
  📂 Forms (3)
    ● Form1        ← 더블클릭: onFormSelect(formId)
    ● Form2
    ● Form3
```

### 컨텍스트 메뉴
- **프로젝트**: 새 폼, 기본 폰트 설정, 폰트 일괄 적용, 내보내기, 삭제
- **폼 폴더**: 새 폼
- **폼**: 열기, 이름 변경, 삭제

### 핵심 동작
- 폼 노드 더블클릭 → `onFormSelect(formId)` 콜백 (App.tsx의 `handleFormSelect`)
- `currentFormId`와 일치하는 폼에 활성 배경색(`#b3d9ff`) 표시
- F2 키로 폼 이름 변경

---

## 3. 현재 App.tsx 구조 분석

### 레이아웃
```
┌─────────────────────────────────────────┐
│ 메뉴바 (32px) — 폼 제목, Save, Publish  │
├──────────┬──────────────┬───────────────┤
│ 좌측패널  │  캔버스 영역  │  속성 패널    │
│ (220px)  │  (flex: 1)   │  (308px)      │
│          │              │               │
│ Explorer │ DesignerCanvas│ PropertyPanel │
│ Elements │              │               │
│ Toolbox  │              │               │
└──────────┴──────────────┴───────────────┘
│        EventEditor 모달 (조건부)         │
```

### 주요 로직
- `handleFormSelect(formId)` — API에서 폼 로드 → `store.loadForm()` 호출
- `handleSave()` — 폼 저장 (Ctrl+S)
- `handlePublish()` — 폼 퍼블리시
- 현재 **편집 모드 구분 없음** — 항상 폼 편집 모드

---

## 4. designerStore 확장 코드 초안 (추가될 부분만)

### 4.1 import 추가
```typescript
// 기존
import type { ControlDefinition, ControlType, FontDefinition, FormProperties } from '@webform/common';
// 변경
import type {
  ControlDefinition, ControlType, FontDefinition, FormProperties,
  ShellProperties, ApplicationShellDefinition,
} from '@webform/common';
```

### 4.2 기본 Shell 속성 상수
```typescript
const DEFAULT_SHELL_PROPERTIES: ShellProperties = {
  title: 'Application',
  width: 1200,
  height: 800,
  backgroundColor: '#F0F0F0',
  font: {
    family: 'Segoe UI',
    size: 9,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  },
  showTitleBar: true,
  formBorderStyle: 'Sizable',
  maximizeBox: true,
  minimizeBox: true,
};
```

### 4.3 인터페이스 확장 (DesignerState에 추가)
```typescript
// 상태 추가
editMode: 'form' | 'shell';
shellControls: ControlDefinition[];
shellProperties: ShellProperties;
currentShellId: string | null;

// 메서드 추가
setEditMode: (mode: 'form' | 'shell') => void;
loadShell: (shellDef: ApplicationShellDefinition) => void;
addShellControl: (control: ControlDefinition) => void;
updateShellControl: (id: string, changes: Partial<ControlDefinition>) => void;
removeShellControl: (id: string) => void;
setShellProperties: (props: Partial<ShellProperties>) => void;
getShellDefinition: () => ApplicationShellDefinition;
```

### 4.4 상태 초기값 (create 내부에 추가)
```typescript
editMode: 'form' as const,
shellControls: [] as ControlDefinition[],
shellProperties: DEFAULT_SHELL_PROPERTIES,
currentShellId: null as string | null,
```

### 4.5 메서드 구현 (immer set 패턴)
```typescript
setEditMode: (mode) => set((state) => {
  state.editMode = mode;
}),

loadShell: (shellDef) => set((state) => {
  state.currentShellId = shellDef.id;
  state.shellControls = shellDef.controls as ControlDefinition[];
  state.shellProperties = shellDef.properties;
  state.editMode = 'shell';
  state.isDirty = false;
}),

addShellControl: (control) => set((state) => {
  state.shellControls.push(control);
  state.isDirty = true;
}),

updateShellControl: (id, changes) => set((state) => {
  const index = state.shellControls.findIndex((c) => c.id === id);
  if (index !== -1) {
    Object.assign(state.shellControls[index], changes);
    state.isDirty = true;
  }
}),

removeShellControl: (id) => set((state) => {
  state.shellControls = state.shellControls.filter((c) => c.id !== id);
  state.isDirty = true;
}),

setShellProperties: (props) => set((state) => {
  Object.assign(state.shellProperties, props);
  state.isDirty = true;
}),

// getShellDefinition은 get() 패턴 — set이 아닌 순수 함수
// Zustand에서는 store.getState()로 호출
getShellDefinition: () => {
  const { currentShellId, shellControls, shellProperties, currentProjectId } =
    useDesignerStore.getState();
  return {
    id: currentShellId ?? '',
    projectId: currentProjectId ?? '',
    name: shellProperties.title,
    version: 1,
    properties: shellProperties,
    controls: shellControls,
    eventHandlers: [],
  } satisfies ApplicationShellDefinition;
},
```

> **참고**: `getShellDefinition`은 상태를 변경하지 않으므로 `set()` 대신 `getState()`를 사용한다. immer set 블록 안이 아니라 외부 함수로 정의하거나, 인터페이스에서 반환 타입을 명시한다.

---

## 5. ProjectExplorer Shell 노드 추가 코드 초안

### 5.1 Store에서 editMode 구독 추가
```typescript
const editMode = useDesignerStore((s) => s.editMode);
const currentShellId = useDesignerStore((s) => s.currentShellId);
```

### 5.2 트리 구조 변경
```
📁 프로젝트명
  🖥️ Application Shell    ← 새로 추가 (더블클릭: Shell 편집 모드)
  📂 Forms (3)
    ● Form1
    ● Form2
    ● Form3
```

### 5.3 Shell 노드 렌더링 코드
프로젝트 노드(`isProjectExpanded && (...)`) 내부, Forms 폴더 위에 추가:

```tsx
{/* Shell 노드 */}
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    padding: '2px 8px 2px 24px',
    cursor: 'pointer',
    backgroundColor:
      editMode === 'shell' && currentShellId
        ? '#b3d9ff'        // Shell 편집 중 → 활성 표시
        : selectedNode === `shell-${project._id}`
          ? '#cce5ff'      // 선택됨
          : 'transparent',
    userSelect: 'none',
  }}
  onClick={() => setSelectedNode(`shell-${project._id}`)}
  onDoubleClick={() => handleShellSelect(project._id)}
>
  <span style={{ marginRight: 4 }}>🖥️</span>
  <span>Application Shell</span>
</div>
```

### 5.4 handleShellSelect 함수
```typescript
const handleShellSelect = async (projectId: string) => {
  const store = useDesignerStore.getState();
  store.setEditMode('shell');
  // Shell 로드는 다음 태스크(designer-shell-api)에서 API 연동 시 구현
  // 현재는 editMode 전환만 수행
};
```

### 5.5 폼 더블클릭 시 editMode 전환 추가
기존 `onDoubleClick={() => onFormSelect(form._id)}` 부분에서 `onFormSelect` 콜백 내에서 `setEditMode('form')` 호출이 필요하다. 이는 App.tsx의 `handleFormSelect`에서 처리하는 것이 더 적절하다 (5.6 참고).

### 5.6 App.tsx handleFormSelect 수정
```typescript
const handleFormSelect = async (formId: string) => {
  const store = useDesignerStore.getState();
  store.setEditMode('form'); // ← 추가: 폼 선택 시 폼 모드로 전환
  // ... 기존 API 로드 로직 유지
};
```

---

## 6. App.tsx editMode 분기 로직 초안

### 6.1 editMode 구독 추가
```typescript
const editMode = useDesignerStore((s) => s.editMode);
const shellTitle = useDesignerStore((s) => s.shellProperties.title);
```

### 6.2 메뉴바 제목 분기
```typescript
<span style={{ fontWeight: 600 }}>
  {editMode === 'shell'
    ? `${shellTitle} (Shell)${isDirty ? ' *' : ''}`
    : currentFormId
      ? `${formTitle}${isDirty ? ' *' : ''}`
      : 'WebForm Designer'}
</span>
```

### 6.3 캔버스 영역 분기
```tsx
{/* 캔버스 영역 */}
<div className="canvas-area" style={{ flex: 1, overflow: 'auto', padding: 16, backgroundColor: '#E0E0E0' }}>
  {editMode === 'shell' ? (
    // ShellCanvas는 다음 태스크에서 구현. 현재는 placeholder
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#888',
      fontSize: 14,
    }}>
      Shell 편집 모드 (구현 예정)
    </div>
  ) : (
    <DesignerCanvas />
  )}
</div>
```

### 6.4 저장 로직 분기 (기본 구조만)
```typescript
const handleSave = useCallback(async () => {
  try {
    if (editMode === 'shell') {
      // Shell 저장 — designer-shell-api 태스크에서 구현
      showStatus('Shell save not yet implemented');
    } else {
      await save();
      showStatus('Saved');
    }
  } catch {
    showStatus('Save failed');
  }
}, [save, editMode]);
```

---

## 7. 기존 폼 편집 기능에 영향 없음을 보장하는 방법

### 7.1 상태 격리
- Shell 상태(`shellControls`, `shellProperties`, `currentShellId`)와 폼 상태(`controls`, `formProperties`, `currentFormId`)는 **완전히 분리된 필드**이다.
- `editMode`만 현재 어느 상태를 편집 중인지 나타낸다.
- 기존 폼 메서드(`addControl`, `updateControl`, `loadForm` 등)는 **변경하지 않는다**.

### 7.2 UI 분기 원칙
- `editMode === 'form'` 일 때의 렌더링 경로는 기존 코드와 **100% 동일**하다.
- `editMode === 'shell'` 분기에서만 새로운 컴포넌트/로직이 동작한다.
- 조건부 렌더링 (`editMode === 'shell' ? ... : 기존코드`)으로 분리한다.

### 7.3 기본값 보장
- `editMode`의 기본값은 `'form'`이다.
- 앱 최초 로드 시 기존과 동일하게 폼 편집 모드로 시작한다.
- Shell 관련 상태는 초기 렌더링에 영향을 주지 않는다.

### 7.4 테스트 전략
- designerStore Shell 테스트 작성 시 **폼 상태 보존 검증** 포함:
  - `loadShell()` 후에도 `controls`, `formProperties` 기존 값 유지
  - `setEditMode('form')` 후 `setEditMode('shell')` 왕복 시 양쪽 상태 보존
- 기존 designerStore 테스트가 있다면 **그대로 통과**되어야 한다.

### 7.5 점진적 구현
이 태스크에서는 최소한의 변경만 수행한다:
1. **designerStore**: 상태/메서드 추가만 (기존 코드 수정 없음)
2. **ProjectExplorer**: Shell 노드 추가만 (기존 폼 노드 코드 변경 없음)
3. **App.tsx**: editMode 분기 추가 + Shell placeholder (기존 폼 경로 변경 없음)

실제 Shell 캔버스, Toolbox 필터링, PropertyPanel Shell 속성은 **다음 태스크**(`designer-shell-canvas`)에서 구현한다.

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `packages/designer/src/stores/designerStore.ts` | Shell 상태/메서드 추가 (기존 코드 무변경) |
| `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` | Shell 노드 렌더링 + handleShellSelect 추가 |
| `packages/designer/src/App.tsx` | editMode 분기 (메뉴바 제목, 캔버스, 저장) |
