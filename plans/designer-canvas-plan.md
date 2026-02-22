# 디자인 캔버스 구현 계획

## 1. 개요

`@webform/designer` 패키지의 핵심 모듈인 디자인 캔버스를 구현한다. WinForm 디자이너와 동일한 드래그 앤 드롭 경험을 웹 브라우저에서 제공한다. PRD 섹션 4.1.3(디자인 캔버스)의 모든 요구사항을 충족하며, `react-dnd`로 드래그 앤 드롭을, `Zustand + Immer`로 상태 관리를 구현한다.

### 1.1 구현 범위

| 기능 | 설명 |
|------|------|
| 드래그 앤 드롭 | 도구상자 → 캔버스 배치, 캔버스 내 이동 (react-dnd) |
| 리사이즈 핸들 | 8방향 (n, ne, e, se, s, sw, w, nw) |
| 그리드 스냅 | 기본 8px, 설정 가능 |
| 다중 선택 | Ctrl+클릭, 마우스 드래그 선택 박스 |
| 정렬 가이드라인 | Snaplines — 다른 컨트롤과 정렬 시 시각적 가이드 |
| Z-Order | 앞으로/뒤로 보내기 (배열 순서 조작) |
| Undo/Redo | Ctrl+Z/Y, JSON 스냅샷, 최소 50단계 |
| 복사/붙여넣기 | Ctrl+C/V, 새 UUID 발급 + 16px 오프셋 |
| 삭제 | Delete/Backspace 키로 선택 컨트롤 삭제 |

### 1.2 범위 밖 (후속 태스크)

- 도구상자 패널 UI (`toolbox-controls-plan`에서 구현)
- 속성 패널 UI (`properties-panel-plan`에서 구현)
- Anchor & Dock 레이아웃 시뮬레이션 (런타임에서 구현)
- Tab Order 시각적 편집 모드

---

## 2. 파일 구조

```
packages/designer/src/
├── stores/
│   ├── designerStore.ts        # 캔버스 핵심 상태 (controls, formProperties)
│   ├── selectionStore.ts       # 선택/클립보드 상태
│   └── historyStore.ts         # Undo/Redo 히스토리
├── utils/
│   └── snapGrid.ts             # 그리드 스냅 및 스냅라인 계산
├── components/Canvas/
│   ├── DesignerCanvas.tsx      # 캔버스 DropTarget, 키보드 이벤트, 그리드 배경
│   ├── CanvasControl.tsx       # 컨트롤 DragSource, 선택 처리, 리사이즈 핸들 표시
│   ├── ResizeHandle.tsx        # 8방향 리사이즈 핸들
│   ├── Snapline.tsx            # 수평/수직 정렬 가이드라인
│   └── index.ts                # 배럴 export
├── App.tsx                     # DndProvider 래핑, 3패널 레이아웃
└── main.tsx                    # React 18 createRoot 엔트리
```

---

## 3. Zustand 스토어 상세 설계

### 3.1 `stores/designerStore.ts` — 캔버스 핵심 상태

디자이너의 폼 정의 데이터를 관리한다. `@webform/common`의 `ControlDefinition`, `FormProperties` 타입을 직접 사용한다.

#### 인터페이스

```typescript
import type { ControlDefinition, ControlType, FormProperties } from '@webform/common';

interface DesignerState {
  // 상태
  controls: ControlDefinition[];
  formProperties: FormProperties;
  isDirty: boolean;
  currentFormId: string | null;
  gridSize: number;                         // 기본 8

  // 액션
  addControl: (control: ControlDefinition) => void;
  updateControl: (id: string, changes: Partial<ControlDefinition>) => void;
  removeControl: (id: string) => void;
  removeControls: (ids: string[]) => void;
  moveControl: (id: string, position: { x: number; y: number }) => void;
  resizeControl: (id: string, size: { width: number; height: number }, position?: { x: number; y: number }) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setFormProperties: (props: Partial<FormProperties>) => void;
  setGridSize: (size: number) => void;
  loadForm: (formId: string, controls: ControlDefinition[], properties: FormProperties) => void;
  markClean: () => void;
}
```

#### 구현 방식

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useDesignerStore = create<DesignerState>()(
  immer((set) => ({
    controls: [],
    formProperties: DEFAULT_FORM_PROPERTIES,
    isDirty: false,
    currentFormId: null,
    gridSize: 8,

    addControl: (control) => set((state) => {
      state.controls.push(control);
      state.isDirty = true;
    }),

    updateControl: (id, changes) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        Object.assign(state.controls[index], changes);
        state.isDirty = true;
      }
    }),

    removeControl: (id) => set((state) => {
      state.controls = state.controls.filter((c) => c.id !== id);
      state.isDirty = true;
    }),

    removeControls: (ids) => set((state) => {
      const idSet = new Set(ids);
      state.controls = state.controls.filter((c) => !idSet.has(c.id));
      state.isDirty = true;
    }),

    moveControl: (id, position) => set((state) => {
      const control = state.controls.find((c) => c.id === id);
      if (control) {
        control.position = position;
        state.isDirty = true;
      }
    }),

    resizeControl: (id, size, position) => set((state) => {
      const control = state.controls.find((c) => c.id === id);
      if (control) {
        control.size = size;
        if (position) control.position = position;
        state.isDirty = true;
      }
    }),

    bringToFront: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        const [control] = state.controls.splice(index, 1);
        state.controls.push(control);
        state.isDirty = true;
      }
    }),

    sendToBack: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        const [control] = state.controls.splice(index, 1);
        state.controls.unshift(control);
        state.isDirty = true;
      }
    }),

    loadForm: (formId, controls, properties) => set((state) => {
      state.currentFormId = formId;
      state.controls = controls;
      state.formProperties = properties;
      state.isDirty = false;
    }),

    markClean: () => set((state) => { state.isDirty = false; }),
    // ...setFormProperties, setGridSize 유사 패턴
  }))
);
```

#### DEFAULT_FORM_PROPERTIES

```typescript
const DEFAULT_FORM_PROPERTIES: FormProperties = {
  title: 'Form1',
  width: 800,
  height: 600,
  backgroundColor: '#F0F0F0',
  font: {
    family: 'Segoe UI',
    size: 9,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  },
  startPosition: 'CenterScreen',
  formBorderStyle: 'Sizable',
  maximizeBox: true,
  minimizeBox: true,
};
```

**설계 근거**:
- Immer를 사용하여 불변성을 유지하면서도 직관적인 mutation 스타일 코드를 작성한다.
- `controls`는 플랫 배열(flat array)로 관리한다. 컨테이너의 `children`은 후속 `toolbox-controls` 태스크에서 처리한다.
- `bringToFront`/`sendToBack`은 배열 내 순서를 조작하여 Z-Order를 제어한다. 배열 뒤쪽이 더 앞에 렌더링된다.

---

### 3.2 `stores/selectionStore.ts` — 선택 및 클립보드

#### 인터페이스

```typescript
import type { ControlDefinition } from '@webform/common';

interface SelectionState {
  // 상태
  selectedIds: Set<string>;
  clipboard: ControlDefinition[];

  // 액션
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  copySelected: (controls: ControlDefinition[]) => void;
  pasteControls: () => ControlDefinition[];    // 새 UUID + 16px 오프셋
}
```

#### 핵심 로직 — 복사/붙여넣기

```typescript
copySelected: (controls) => set({ clipboard: controls }),

pasteControls: () => {
  const { clipboard } = get();
  return clipboard.map((control) => ({
    ...structuredClone(control),
    id: crypto.randomUUID(),
    name: generateUniqueName(control.name),  // 기존 이름 기반 증가 번호
    position: {
      x: control.position.x + 16,           // +16px 오프셋
      y: control.position.y + 16,
    },
  }));
}
```

**설계 근거**:
- `selectedIds`는 `Set<string>`으로 O(1) 조회를 보장한다. Zustand에서 Set은 참조 비교로 변경 감지가 되므로, `set({ selectedIds: new Set(...) })` 패턴으로 새 Set을 생성해야 한다.
- `pasteControls`는 새 `ControlDefinition[]`을 반환만 하고, 실제 `controls` 배열에 추가하는 것은 `designerStore.addControl`을 호출하는 쪽(DesignerCanvas)에서 처리한다. 스토어 간 결합을 최소화한다.
- `structuredClone`으로 deep copy하여 원본 clipboard 데이터를 보존한다.

---

### 3.3 `stores/historyStore.ts` — Undo/Redo

#### 인터페이스

```typescript
interface HistoryState {
  // 상태
  past: string[];                              // JSON 스냅샷 배열
  future: string[];

  // 파생 상태
  canUndo: boolean;
  canRedo: boolean;

  // 액션
  pushSnapshot: (snapshot: string) => void;
  undo: () => string | null;                   // 복원할 스냅샷 반환
  redo: () => string | null;                   // 복원할 스냅샷 반환
  clear: () => void;
}
```

#### 핵심 로직

```typescript
pushSnapshot: (snapshot) => set((state) => {
  state.past.push(snapshot);
  if (state.past.length > 50) {
    state.past.shift();                        // 50개 초과 시 가장 오래된 것 제거
  }
  state.future = [];                           // 새 변경 시 future 초기화
  state.canUndo = true;
  state.canRedo = false;
}),

undo: () => {
  const { past, future } = get();
  if (past.length === 0) return null;

  const current = past[past.length - 1];
  const previous = past.length > 1 ? past[past.length - 2] : null;

  set((state) => {
    const popped = state.past.pop()!;
    state.future.push(popped);
    state.canUndo = state.past.length > 0;
    state.canRedo = true;
  });

  return previous;                             // 복원할 이전 스냅샷
},

redo: () => {
  const { future } = get();
  if (future.length === 0) return null;

  set((state) => {
    const snapshot = state.future.pop()!;
    state.past.push(snapshot);
    state.canUndo = true;
    state.canRedo = state.future.length > 0;
  });

  return get().past[get().past.length - 1];
},
```

**설계 근거**:
- JSON 스냅샷 방식을 채택한다. Command 패턴 대비 구현이 단순하고, `controls` 배열의 전체 상태를 JSON.stringify로 직렬화하면 된다.
- 50개 제한은 메모리 사용량을 제어하기 위함이다. 폼 하나당 컨트롤 50~100개 기준, 스냅샷 1개 ≈ 5~20KB → 50개 ≈ 250KB~1MB로 충분히 관리 가능하다.
- `undo`/`redo`는 복원할 스냅샷 문자열을 반환하고, 실제 `designerStore` 갱신은 호출 측에서 처리한다.

#### 히스토리 통합 — DesignerCanvas에서의 사용 패턴

```typescript
// DesignerCanvas.tsx 내부
const handleAddControl = (control: ControlDefinition) => {
  // 변경 전 스냅샷 저장
  const snapshot = JSON.stringify(designerStore.getState().controls);
  historyStore.getState().pushSnapshot(snapshot);

  // 실제 변경
  designerStore.getState().addControl(control);
};

const handleUndo = () => {
  const snapshot = historyStore.getState().undo();
  if (snapshot) {
    const controls = JSON.parse(snapshot);
    // designerStore의 controls를 스냅샷으로 교체
  }
};
```

---

## 4. 유틸리티 상세 설계

### 4.1 `utils/snapGrid.ts` — 그리드 스냅 및 스냅라인

#### snapToGrid

```typescript
/**
 * 값을 그리드에 스냅한다.
 * Math.round를 사용하여 가장 가까운 그리드 포인트로 스냅.
 */
export function snapToGrid(value: number, gridSize: number = 8): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPositionToGrid(
  position: { x: number; y: number },
  gridSize: number = 8
): { x: number; y: number } {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}
```

**테스트 케이스**:
- `snapToGrid(13, 8) === 16` (반올림)
- `snapToGrid(4, 8) === 0` (버림)
- `snapToGrid(12, 8) === 16` (반올림, 정확히 중간은 올림)
- `snapToGrid(0, 8) === 0`
- `snapPositionToGrid({ x: 13, y: 5 }, 8) === { x: 16, y: 8 }`

#### getSnaplines — 정렬 가이드라인 계산

```typescript
interface Snapline {
  type: 'horizontal' | 'vertical';
  position: number;                            // px 위치
}

/**
 * 이동 중인 컨트롤과 다른 컨트롤들 사이의 정렬 가이드라인을 계산한다.
 * 임계값(threshold) 이내에 정렬이 감지되면 Snapline을 반환한다.
 */
export function getSnaplines(
  movingControl: { position: { x: number; y: number }; size: { width: number; height: number } },
  allControls: Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
  threshold: number = 4
): Snapline[] {
  const snaplines: Snapline[] = [];

  // 이동 중인 컨트롤의 엣지
  const movingEdges = {
    left: movingControl.position.x,
    right: movingControl.position.x + movingControl.size.width,
    top: movingControl.position.y,
    bottom: movingControl.position.y + movingControl.size.height,
    centerX: movingControl.position.x + movingControl.size.width / 2,
    centerY: movingControl.position.y + movingControl.size.height / 2,
  };

  for (const target of allControls) {
    const targetEdges = {
      left: target.position.x,
      right: target.position.x + target.size.width,
      top: target.position.y,
      bottom: target.position.y + target.size.height,
      centerX: target.position.x + target.size.width / 2,
      centerY: target.position.y + target.size.height / 2,
    };

    // 수직 스냅라인 (x축 정렬): left↔left, right↔right, center↔center, left↔right
    const verticalPairs = [
      [movingEdges.left, targetEdges.left],
      [movingEdges.right, targetEdges.right],
      [movingEdges.centerX, targetEdges.centerX],
      [movingEdges.left, targetEdges.right],
      [movingEdges.right, targetEdges.left],
    ];

    for (const [a, b] of verticalPairs) {
      if (Math.abs(a - b) <= threshold) {
        snaplines.push({ type: 'vertical', position: b });
      }
    }

    // 수평 스냅라인 (y축 정렬): top↔top, bottom↔bottom, center↔center, top↔bottom
    const horizontalPairs = [
      [movingEdges.top, targetEdges.top],
      [movingEdges.bottom, targetEdges.bottom],
      [movingEdges.centerY, targetEdges.centerY],
      [movingEdges.top, targetEdges.bottom],
      [movingEdges.bottom, targetEdges.top],
    ];

    for (const [a, b] of horizontalPairs) {
      if (Math.abs(a - b) <= threshold) {
        snaplines.push({ type: 'horizontal', position: b });
      }
    }
  }

  // 중복 제거
  const unique = new Map<string, Snapline>();
  for (const line of snaplines) {
    const key = `${line.type}-${line.position}`;
    unique.set(key, line);
  }

  return Array.from(unique.values());
}
```

**설계 근거**:
- WinForm 디자이너의 Snapline 동작을 모방한다: 컨트롤의 엣지(상하좌우) 및 중심선을 기준으로 정렬을 감지한다.
- threshold 기본값 4px은 사용자가 자연스럽게 정렬을 "느낄 수 있는" 적절한 범위다.
- 중복 제거로 동일 위치에 여러 스냅라인이 겹쳐 렌더링되는 것을 방지한다.

---

## 5. 컴포넌트 상세 설계

### 5.1 `components/Canvas/DesignerCanvas.tsx` — 메인 캔버스

캔버스는 `react-dnd`의 `useDrop` 훅을 사용하여 드롭 타겟으로 동작한다.

#### 역할

1. **Drop Target**: 도구상자에서 드래그한 컨트롤을 드롭하여 배치
2. **그리드 배경**: CSS `background-image`로 도트 그리드 렌더링
3. **키보드 이벤트**: Ctrl+Z/Y, Ctrl+C/V, Delete/Backspace
4. **빈 영역 클릭**: 선택 해제 (`clearSelection`)
5. **드래그 선택 박스**: 마우스 드래그로 영역 내 컨트롤 다중 선택
6. **스냅라인 렌더링**: 드래그 중 정렬 가이드라인 표시

#### 구조

```tsx
export function DesignerCanvas() {
  const { controls, formProperties, addControl, gridSize } = useDesignerStore();
  const { selectedIds, clearSelection, selectMultiple } = useSelectionStore();
  const historyRef = useHistoryIntegration(); // 커스텀 훅

  const [snaplines, setSnaplines] = useState<Snapline[]>([]);

  // --- react-dnd Drop Target ---
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: 'TOOLBOX_CONTROL',
    drop: (item: { type: ControlType }, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset) return;

      const canvasRect = canvasRef.current!.getBoundingClientRect();
      const position = snapPositionToGrid({
        x: offset.x - canvasRect.left,
        y: offset.y - canvasRect.top,
      }, gridSize);

      const control = createDefaultControl(item.type, position);
      handleAddControl(control);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  // --- 키보드 이벤트 ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z': handleUndo(); e.preventDefault(); break;
        case 'y': handleRedo(); e.preventDefault(); break;
        case 'c': handleCopy(); e.preventDefault(); break;
        case 'v': handlePaste(); e.preventDefault(); break;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDelete();
      e.preventDefault();
    }
  }, [selectedIds]);

  // --- 드래그 선택 박스 ---
  const [selectionBox, setSelectionBox] = useState<{
    startX: number; startY: number;
    endX: number; endY: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {  // 빈 영역에서만
      clearSelection();
      setSelectionBox({
        startX: e.nativeEvent.offsetX,
        startY: e.nativeEvent.offsetY,
        endX: e.nativeEvent.offsetX,
        endY: e.nativeEvent.offsetY,
      });
    }
  };

  // --- 렌더링 ---
  return (
    <div
      ref={(node) => { dropRef(node); canvasRef.current = node; }}
      className="designer-canvas"
      style={{
        width: formProperties.width,
        height: formProperties.height,
        backgroundColor: formProperties.backgroundColor,
        position: 'relative',
        backgroundImage: `radial-gradient(circle, #ccc 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
    >
      {controls.map((control) => (
        <CanvasControl
          key={control.id}
          control={control}
          isSelected={selectedIds.has(control.id)}
          onSnaplineChange={setSnaplines}
        />
      ))}

      {/* 스냅라인 */}
      {snaplines.map((line, i) => (
        <Snapline key={`${line.type}-${line.position}-${i}`} snapline={line} />
      ))}

      {/* 드래그 선택 박스 */}
      {selectionBox && (
        <div className="selection-box" style={getSelectionBoxStyle(selectionBox)} />
      )}
    </div>
  );
}
```

#### createDefaultControl 헬퍼

도구상자에서 드롭 시 기본 속성으로 컨트롤을 생성한다.

```typescript
function createDefaultControl(
  type: ControlType,
  position: { x: number; y: number }
): ControlDefinition {
  return {
    id: crypto.randomUUID(),
    type,
    name: generateControlName(type),          // "button1", "textBox2" 등
    properties: getDefaultProperties(type),
    position,
    size: getDefaultSize(type),               // 타입별 기본 크기
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
  };
}

// 컨트롤 타입별 기본 크기
function getDefaultSize(type: ControlType): { width: number; height: number } {
  const sizes: Partial<Record<ControlType, { width: number; height: number }>> = {
    Button:          { width: 75,  height: 23 },
    Label:           { width: 100, height: 23 },
    TextBox:         { width: 100, height: 23 },
    CheckBox:        { width: 104, height: 24 },
    RadioButton:     { width: 104, height: 24 },
    ComboBox:        { width: 121, height: 23 },
    ListBox:         { width: 120, height: 96 },
    Panel:           { width: 200, height: 100 },
    GroupBox:        { width: 200, height: 100 },
    DataGridView:    { width: 240, height: 150 },
    PictureBox:      { width: 100, height: 50 },
    ProgressBar:     { width: 100, height: 23 },
    NumericUpDown:   { width: 120, height: 23 },
    DateTimePicker:  { width: 200, height: 23 },
    TabControl:      { width: 200, height: 100 },
    SplitContainer:  { width: 150, height: 100 },
  };
  return sizes[type] ?? { width: 100, height: 23 };
}
```

**설계 근거**:
- 기본 크기는 WinForm의 실제 기본 크기를 참고한다.
- `tabIndex: 0`은 임시값이다. 추후 Tab Order 편집 기능에서 자동 재할당된다.

---

### 5.2 `components/Canvas/CanvasControl.tsx` — 개별 컨트롤

#### 역할

1. **DragSource**: `useDrag`로 캔버스 내 이동 드래그
2. **선택 처리**: 클릭 → `select`, Ctrl+클릭 → `toggleSelect`
3. **선택 표시**: 선택 시 파란 테두리 + 8방향 `ResizeHandle` 표시
4. **위치/크기**: `position: absolute`, left/top/width/height

#### 구조

```tsx
interface CanvasControlProps {
  control: ControlDefinition;
  isSelected: boolean;
  onSnaplineChange: (snaplines: Snapline[]) => void;
}

export function CanvasControl({ control, isSelected, onSnaplineChange }: CanvasControlProps) {
  const { moveControl, controls, gridSize } = useDesignerStore();
  const { select, toggleSelect } = useSelectionStore();

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'CANVAS_CONTROL',
    item: () => {
      return { id: control.id, originalPosition: control.position };
    },
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta) {
        const newPos = snapPositionToGrid({
          x: item.originalPosition.x + delta.x,
          y: item.originalPosition.y + delta.y,
        }, gridSize);
        moveControl(control.id, newPos);
      }
      onSnaplineChange([]);                    // 드래그 종료 시 스냅라인 제거
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [control.id, control.position, gridSize]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      toggleSelect(control.id);
    } else {
      select(control.id);
    }
  };

  return (
    <div
      ref={dragRef}
      className={`canvas-control ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: control.position.x,
        top: control.position.y,
        width: control.size.width,
        height: control.size.height,
        opacity: isDragging ? 0.5 : 1,
        border: isSelected ? '1px solid #0078D7' : '1px solid transparent',
        cursor: 'move',
      }}
      onClick={handleClick}
    >
      {/* 컨트롤 미리보기 (타입별 기본 렌더링) */}
      <ControlPreview type={control.type} properties={control.properties} />

      {/* 선택 시 8방향 리사이즈 핸들 */}
      {isSelected && (
        <>
          {RESIZE_DIRECTIONS.map((direction) => (
            <ResizeHandle
              key={direction}
              direction={direction}
              controlId={control.id}
            />
          ))}
        </>
      )}
    </div>
  );
}
```

#### ControlPreview

컨트롤 타입별 간단한 시각적 미리보기를 제공하는 경량 컴포넌트. 이 태스크에서는 `type`과 `name`을 텍스트로 표시하는 최소 구현만 한다. 실제 WinForm 스타일 렌더링은 `toolbox-controls` 태스크에서 구현한다.

```tsx
function ControlPreview({ type, properties }: { type: ControlType; properties: Record<string, unknown> }) {
  const text = (properties.text as string) ?? type;
  return (
    <div className="control-preview" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {text}
    </div>
  );
}
```

---

### 5.3 `components/Canvas/ResizeHandle.tsx` — 리사이즈 핸들

#### 역할

8방향(n, ne, e, se, s, sw, w, nw) 리사이즈 핸들을 제공한다. 마우스 이벤트(`mousedown → mousemove → mouseup`)로 리사이즈를 처리한다. react-dnd의 drag와 별개로 네이티브 마우스 이벤트를 사용한다 (리사이즈는 react-dnd의 드래그와 충돌할 수 있으므로).

#### 인터페이스

```typescript
type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

interface ResizeHandleProps {
  direction: ResizeDirection;
  controlId: string;
}
```

#### 구조

```tsx
const HANDLE_SIZE = 7;  // px, 핸들 사각형 크기
const MIN_SIZE = 20;    // px, 컨트롤 최소 크기

// 방향별 커서 매핑
const CURSOR_MAP: Record<ResizeDirection, string> = {
  n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize',
  s: 's-resize', sw: 'sw-resize', w: 'w-resize', nw: 'nw-resize',
};

// 방향별 핸들 위치 (CSS)
const POSITION_MAP: Record<ResizeDirection, React.CSSProperties> = {
  n:  { top: -HANDLE_SIZE/2, left: '50%', transform: 'translateX(-50%)' },
  ne: { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2 },
  e:  { top: '50%', right: -HANDLE_SIZE/2, transform: 'translateY(-50%)' },
  se: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2 },
  s:  { bottom: -HANDLE_SIZE/2, left: '50%', transform: 'translateX(-50%)' },
  sw: { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2 },
  w:  { top: '50%', left: -HANDLE_SIZE/2, transform: 'translateY(-50%)' },
  nw: { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2 },
};

export function ResizeHandle({ direction, controlId }: ResizeHandleProps) {
  const { resizeControl, gridSize } = useDesignerStore();

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const control = useDesignerStore.getState().controls.find((c) => c.id === controlId);
    if (!control) return;

    const startPos = { ...control.position };
    const startSize = { ...control.size };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = startPos.x;
      let newY = startPos.y;
      let newWidth = startSize.width;
      let newHeight = startSize.height;

      // 방향별 계산
      if (direction.includes('e')) newWidth = Math.max(MIN_SIZE, startSize.width + deltaX);
      if (direction.includes('w')) {
        newWidth = Math.max(MIN_SIZE, startSize.width - deltaX);
        newX = startPos.x + startSize.width - newWidth;
      }
      if (direction.includes('s')) newHeight = Math.max(MIN_SIZE, startSize.height + deltaY);
      if (direction.includes('n')) {
        newHeight = Math.max(MIN_SIZE, startSize.height - deltaY);
        newY = startPos.y + startSize.height - newHeight;
      }

      // 그리드 스냅
      const snappedSize = {
        width: snapToGrid(newWidth, gridSize),
        height: snapToGrid(newHeight, gridSize),
      };
      const snappedPos = snapPositionToGrid({ x: newX, y: newY }, gridSize);

      resizeControl(controlId, snappedSize, snappedPos);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="resize-handle"
      style={{
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        backgroundColor: '#fff',
        border: '1px solid #0078D7',
        cursor: CURSOR_MAP[direction],
        zIndex: 10,
        ...POSITION_MAP[direction],
      }}
      onMouseDown={handleMouseDown}
    />
  );
}
```

**설계 근거**:
- 네이티브 `mousedown/mousemove/mouseup` 이벤트를 사용한다. react-dnd의 `useDrag`와 리사이즈를 동시에 사용하면 드래그/리사이즈 의도 구분이 복잡해지므로, 핸들에서는 네이티브 이벤트를 직접 관리한다.
- `document`에 이벤트를 등록하여 마우스가 핸들 바깥으로 나가도 리사이즈가 계속된다.
- 최소 크기 20px로 컨트롤이 너무 작아져 선택 불가능해지는 것을 방지한다.
- 리사이즈 결과도 그리드에 스냅한다.

---

### 5.4 `components/Canvas/Snapline.tsx` — 정렬 가이드라인

#### 구조

```tsx
interface SnaplineProps {
  snapline: { type: 'horizontal' | 'vertical'; position: number };
}

export function Snapline({ snapline }: SnaplineProps) {
  const style: React.CSSProperties = snapline.type === 'horizontal'
    ? {
        position: 'absolute',
        left: 0,
        right: 0,
        top: snapline.position,
        height: 1,
        backgroundColor: '#FF00FF',            // 마젠타 (WinForm 스냅라인 색상)
        pointerEvents: 'none',
        zIndex: 1000,
      }
    : {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: snapline.position,
        width: 1,
        backgroundColor: '#FF00FF',
        pointerEvents: 'none',
        zIndex: 1000,
      };

  return <div className="snapline" style={style} />;
}
```

**설계 근거**:
- `pointerEvents: 'none'`으로 스냅라인이 마우스 이벤트를 방해하지 않는다.
- 마젠타(#FF00FF)는 WinForm 디자이너의 스냅라인 색상을 따른다.
- `zIndex: 1000`으로 모든 컨트롤 위에 표시된다.

---

### 5.5 `App.tsx` — 최상위 레이아웃

```tsx
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';

export function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="designer-layout" style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'Segoe UI, sans-serif',
      }}>
        {/* 도구상자 — 후속 태스크에서 구현, 지금은 placeholder */}
        <div className="toolbox-panel" style={{ width: 200, borderRight: '1px solid #ccc' }}>
          Toolbox
        </div>

        {/* 캔버스 영역 — 스크롤 가능 */}
        <div className="canvas-area" style={{ flex: 1, overflow: 'auto', padding: 16, backgroundColor: '#E0E0E0' }}>
          <DesignerCanvas />
        </div>

        {/* 속성 패널 — 후속 태스크에서 구현, 지금은 placeholder */}
        <div className="properties-panel" style={{ width: 250, borderLeft: '1px solid #ccc' }}>
          Properties
        </div>
      </div>
    </DndProvider>
  );
}
```

**설계 근거**:
- `DndProvider`는 최상위에서 한 번만 감싸야 한다.
- 3패널 레이아웃: 도구상자(200px) | 캔버스(flex) | 속성패널(250px). 이는 Visual Studio WinForm 디자이너의 기본 레이아웃과 동일하다.
- 도구상자와 속성 패널은 placeholder만 두고, 후속 태스크(`toolbox-controls`, `properties-panel`)에서 구현한다.
- 캔버스 영역은 `overflow: auto`로 폼이 뷰포트보다 클 때 스크롤을 허용한다.

---

### 5.6 `main.tsx` — 엔트리포인트

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 6. react-dnd 아이템 타입 정의

```typescript
// Drag Item Types (문자열 상수)
export const DragItemTypes = {
  TOOLBOX_CONTROL: 'TOOLBOX_CONTROL',        // 도구상자 → 캔버스
  CANVAS_CONTROL: 'CANVAS_CONTROL',          // 캔버스 내 이동
} as const;

// 도구상자 드래그 아이템
interface ToolboxDragItem {
  type: ControlType;
}

// 캔버스 컨트롤 드래그 아이템
interface CanvasControlDragItem {
  id: string;
  originalPosition: { x: number; y: number };
}
```

**설계 근거**:
- `TOOLBOX_CONTROL`과 `CANVAS_CONTROL`을 분리하여, 캔버스가 도구상자에서 오는 새 컨트롤 드롭과 기존 컨트롤 이동을 구분할 수 있다.
- 캔버스는 `TOOLBOX_CONTROL` accept만 설정한다. 캔버스 내 이동은 `useDrag`의 `end` 콜백에서 직접 좌표를 계산하여 처리한다.

---

## 7. 키보드 단축키 요약

| 단축키 | 동작 | 구현 위치 |
|--------|------|----------|
| `Ctrl+Z` | Undo | DesignerCanvas.handleKeyDown |
| `Ctrl+Y` | Redo | DesignerCanvas.handleKeyDown |
| `Ctrl+C` | 선택 컨트롤 복사 | DesignerCanvas.handleKeyDown |
| `Ctrl+V` | 붙여넣기 (+16px 오프셋) | DesignerCanvas.handleKeyDown |
| `Delete` / `Backspace` | 선택 컨트롤 삭제 | DesignerCanvas.handleKeyDown |
| `Ctrl+Click` | 토글 선택 (다중 선택) | CanvasControl.handleClick |

---

## 8. CSS 스타일

CSS Modules를 사용하여 스코프 격리한다. 이 태스크에서는 인라인 스타일로 구현하고, 필요 시 별도 `.module.css` 파일로 분리할 수 있다.

### 주요 스타일 정의

```css
/* 그리드 배경 */
.designer-canvas {
  background-image: radial-gradient(circle, #ccc 1px, transparent 1px);
  background-size: 8px 8px;
  outline: none;           /* tabIndex 포커스 아웃라인 제거 */
}

/* 선택된 컨트롤 */
.canvas-control.selected {
  border: 1px solid #0078D7;
  box-shadow: 0 0 0 1px #0078D7;
}

/* 리사이즈 핸들 */
.resize-handle {
  box-sizing: border-box;
}

/* 드래그 선택 박스 */
.selection-box {
  position: absolute;
  border: 1px dashed #0078D7;
  background-color: rgba(0, 120, 215, 0.1);
  pointer-events: none;
}

/* 스냅라인 */
.snapline {
  pointer-events: none;
}
```

---

## 9. 구현 순서

| 순서 | 파일 | 의존 관계 |
|------|------|----------|
| 1 | `stores/designerStore.ts` | `@webform/common` 타입 |
| 2 | `stores/selectionStore.ts` | `@webform/common` 타입 |
| 3 | `stores/historyStore.ts` | 독립적 (문자열만 다룸) |
| 4 | `utils/snapGrid.ts` | 독립적 (순수 함수) |
| 5 | `components/Canvas/Snapline.tsx` | snapGrid 타입 |
| 6 | `components/Canvas/ResizeHandle.tsx` | designerStore |
| 7 | `components/Canvas/CanvasControl.tsx` | designerStore, selectionStore, ResizeHandle, snapGrid |
| 8 | `components/Canvas/DesignerCanvas.tsx` | 모든 스토어, CanvasControl, Snapline, snapGrid |
| 9 | `components/Canvas/index.ts` | 배럴 export |
| 10 | `App.tsx` | DesignerCanvas, react-dnd |
| 11 | `main.tsx` | App |

---

## 10. 의존성

이 태스크에서 사용하는 모든 의존성은 이미 `packages/designer/package.json`에 선언되어 있다.

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `react` | ^18.3.0 | UI 프레임워크 |
| `react-dom` | ^18.3.0 | DOM 렌더링 |
| `react-dnd` | ^16.0.1 | 드래그 앤 드롭 |
| `react-dnd-html5-backend` | ^16.0.1 | HTML5 DnD 백엔드 |
| `zustand` | ^5.0.0 | 상태 관리 |
| `immer` | ^10.1.0 | 불변 상태 업데이트 |
| `@webform/common` | workspace:* | 공통 타입 (ControlDefinition 등) |

추가 설치가 필요한 패키지: **없음**

---

## 11. 테스트 전략 (후속 `designer-canvas-test` 태스크에서 구현)

| 테스트 파일 | 주요 테스트 케이스 |
|------------|-------------------|
| `designerStore.test.ts` | addControl → 배열 추가, updateControl → position 변경, removeControl → 배열 제거, bringToFront/sendToBack → 배열 순서, isDirty 플래그 |
| `selectionStore.test.ts` | select/deselect/toggleSelect/clearSelection, copySelected + pasteControls → 새 ID + 16px 오프셋 |
| `historyStore.test.ts` | pushSnapshot/undo/redo 정상 동작, 50개 초과 시 oldest 제거, canUndo/canRedo 상태 |
| `snapGrid.test.ts` | `snapToGrid(13,8)===16`, `snapToGrid(4,8)===0`, `snapPositionToGrid({x:13,y:5})===({x:16,y:8})` |

---

## 12. 후속 태스크와의 연동

| 후속 태스크 | 이 태스크에서 제공하는 것 |
|------------|------------------------|
| `toolbox-controls` | `DragItemTypes.TOOLBOX_CONTROL`, `createDefaultControl`, `getDefaultSize` |
| `properties-panel` | `useDesignerStore` (controls, updateControl), `useSelectionStore` (selectedIds) |
| `form-crud-api` | `useDesignerStore` (loadForm, controls, formProperties, isDirty, markClean) |
