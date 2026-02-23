# Designer Shell 캔버스/툴박스/속성 패널 구현 계획

## 1. 현재 구조 분석

### DesignerCanvas.tsx 핵심 패턴
- `useDrop()`으로 `DragItemTypes.TOOLBOX_CONTROL` 수락, `monitor.getClientOffset()`으로 좌표 계산
- `canvasRef`에 `dropRef` + DOM ref 동시 바인딩: `ref={(node) => { dropRef(node); canvasRef.current = node; }}`
- `controls` 배열을 `filter` → `map`으로 `CanvasControl` 렌더링
- 키보드(Ctrl+Z/Y/C/V, Delete), 드래그 선택 박스, 폼 리사이즈 핸들 포함
- `formProperties.width/height`로 캔버스 크기 결정

### Toolbox.tsx 핵심 패턴
- `TOOLBOX_CATEGORIES` + `getControlsByCategory(categoryId)` → 카테고리별 렌더링
- 각 카테고리 접기/펼치기 (`collapsedCategories` Set)
- `ToolboxItem`이 `useDrag`로 `{ type: DragItemTypes.TOOLBOX_CONTROL, item: { type: controlType } }` 제공
- 현재 `editMode` 참조 없음 → 추가 필요

### PropertyPanel.tsx 핵심 패턴
- `selectedIds.size === 0` → 폼 속성 표시 (`FORM_PROPERTY_METAS` + `formGroupedProperties`)
- `selectedIds.size === 1` → 컨트롤 속성 표시 (`getPropertyMeta(type)`)
- `getValue`/`handleValueChange`로 중첩 속성 읽기/쓰기 (`position.x`, `properties.text` 등)
- 폼 속성은 `getFormValue`/`handleFormValueChange`로 별도 처리 (formProperties 직접 접근)

### designerStore.ts Shell 상태 (이미 구현됨)
- `editMode: 'form' | 'shell'`
- `shellControls: ControlDefinition[]`
- `shellProperties: ShellProperties`
- `currentShellId: string | null`
- 메서드: `setEditMode`, `loadShell`, `addShellControl`, `updateShellControl`, `removeShellControl`, `setShellProperties`, `getShellDefinition`

### ShellProperties 타입 (common/types/shell.ts)
```typescript
interface ShellProperties {
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
```

---

## 2. ShellCanvas.tsx 신규 생성

**파일**: `packages/designer/src/components/Canvas/ShellCanvas.tsx`

### 레이아웃 구조
```
+--------------------------------------------------+
| [Top Zone - dock:Top 컨트롤들]                     |
|  MenuStrip (dock:Top)                             |
|  ToolStrip (dock:Top)                             |
+--------------------------------------------------+
|                                                    |
|  [Middle Zone - Form Preview Area]                |
|  회색 배경, "폼이 여기에 표시됩니다"                   |
|  비활성 상태 (드롭 불가)                              |
|                                                    |
+--------------------------------------------------+
| [Bottom Zone - dock:Bottom 컨트롤들]               |
|  StatusStrip (dock:Bottom)                        |
+--------------------------------------------------+
```

### 핵심 구현 사항

```typescript
import { useMemo } from 'react';
import { useDrop } from 'react-dnd';
import type { ControlType, ControlDefinition } from '@webform/common';
import { useDesignerStore, createDefaultControl } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { CanvasControl, DragItemTypes } from './CanvasControl';

// Shell에서 허용하는 컨트롤 타입
const SHELL_CONTROL_TYPES: ControlType[] = ['MenuStrip', 'ToolStrip', 'StatusStrip', 'Panel'];

export function ShellCanvas() {
  const shellControls = useDesignerStore((s) => s.shellControls);
  const shellProperties = useDesignerStore((s) => s.shellProperties);
  const addShellControl = useDesignerStore((s) => s.addShellControl);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  // Top/Bottom 영역 컨트롤 분리
  const topControls = useMemo(
    () => shellControls.filter((c) => c.dock === 'Top'),
    [shellControls],
  );
  const bottomControls = useMemo(
    () => shellControls.filter((c) => c.dock === 'Bottom'),
    [shellControls],
  );

  // Top 영역 드롭 타겟
  const [{ isOverTop }, topDropRef] = useDrop(() => ({
    accept: [DragItemTypes.TOOLBOX_CONTROL],
    drop: (item: { type: ControlType }) => {
      if (!SHELL_CONTROL_TYPES.includes(item.type)) return;
      const control = createDefaultControl(item.type, { x: 0, y: 0 });
      // dock 자동 설정: MenuStrip/ToolStrip → Top
      control.dock = (item.type === 'StatusStrip') ? 'Bottom' : 'Top';
      control.size.width = shellProperties.width;
      addShellControl(control);
    },
    canDrop: (item: { type: ControlType }) => {
      // StatusStrip은 Bottom에만 드롭 가능
      return item.type !== 'StatusStrip' && SHELL_CONTROL_TYPES.includes(item.type);
    },
    collect: (monitor) => ({ isOverTop: monitor.isOver() && monitor.canDrop() }),
  }), [addShellControl, shellProperties.width]);

  // Bottom 영역 드롭 타겟
  const [{ isOverBottom }, bottomDropRef] = useDrop(() => ({
    accept: [DragItemTypes.TOOLBOX_CONTROL],
    drop: (item: { type: ControlType }) => {
      if (!SHELL_CONTROL_TYPES.includes(item.type)) return;
      const control = createDefaultControl(item.type, { x: 0, y: 0 });
      control.dock = 'Bottom';
      control.size.width = shellProperties.width;
      addShellControl(control);
    },
    canDrop: (item: { type: ControlType }) => {
      // StatusStrip만 Bottom 드롭 가능 (Panel도 허용)
      return (item.type === 'StatusStrip' || item.type === 'Panel') && SHELL_CONTROL_TYPES.includes(item.type);
    },
    collect: (monitor) => ({ isOverBottom: monitor.isOver() && monitor.canDrop() }),
  }), [addShellControl, shellProperties.width]);

  return (
    <div
      style={{
        width: shellProperties.width,
        height: shellProperties.height,
        backgroundColor: shellProperties.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #999',
        fontFamily: shellProperties.font?.family || 'Segoe UI, sans-serif',
        fontSize: shellProperties.font ? `${shellProperties.font.size}pt` : '9pt',
        position: 'relative',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
    >
      {/* Top Zone */}
      <div
        ref={topDropRef}
        style={{
          minHeight: topControls.length === 0 ? 40 : undefined,
          borderBottom: '1px dashed #bbb',
          backgroundColor: isOverTop ? 'rgba(0,120,215,0.1)' : undefined,
        }}
      >
        {topControls.length === 0 && (
          <div style={{ padding: 8, color: '#aaa', fontSize: 11, textAlign: 'center' }}>
            MenuStrip/ToolStrip을 여기에 드롭
          </div>
        )}
        {topControls.map((control) => (
          <ShellControlItem key={control.id} control={control} />
        ))}
      </div>

      {/* Middle Zone - Form Preview */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 14,
          userSelect: 'none',
        }}
      >
        폼이 여기에 표시됩니다
      </div>

      {/* Bottom Zone */}
      <div
        ref={bottomDropRef}
        style={{
          minHeight: bottomControls.length === 0 ? 30 : undefined,
          borderTop: '1px dashed #bbb',
          backgroundColor: isOverBottom ? 'rgba(0,120,215,0.1)' : undefined,
        }}
      >
        {bottomControls.length === 0 && (
          <div style={{ padding: 6, color: '#aaa', fontSize: 11, textAlign: 'center' }}>
            StatusStrip을 여기에 드롭
          </div>
        )}
        {bottomControls.map((control) => (
          <ShellControlItem key={control.id} control={control} />
        ))}
      </div>
    </div>
  );
}
```

### ShellControlItem 서브 컴포넌트
- Shell 컨트롤은 docked 레이아웃이므로 `position:absolute` 대신 `position:relative`로 렌더링
- 클릭 시 `selectionStore.select(control.id)` 호출
- 선택 시 테두리 표시
- 기존 `CanvasControl` 대신 간소화된 전용 컴포넌트 사용 (dock 레이아웃에 적합)
- `getDesignerComponent(control.type)`으로 프리뷰 렌더링은 기존과 동일

```typescript
function ShellControlItem({ control }: { control: ControlDefinition }) {
  const select = useSelectionStore((s) => s.select);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.has(control.id);
  const Component = getDesignerComponent(control.type);

  return (
    <div
      style={{
        width: '100%',
        height: control.size.height,
        border: isSelected ? '2px solid #0078D7' : '1px solid transparent',
        boxSizing: 'border-box',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={(e) => { e.stopPropagation(); select(control.id); }}
    >
      {Component ? (
        <Component id={control.id} properties={control.properties} size={{ width: control.size.width, height: control.size.height }} />
      ) : (
        <div style={{ padding: 4, fontSize: 11 }}>{control.name} ({control.type})</div>
      )}
    </div>
  );
}
```

### Delete 키 처리
- 선택된 Shell 컨트롤 삭제: `removeShellControl(id)` 호출
- 컨테이너 `div`에 `tabIndex={0}` + `onKeyDown` 핸들러 추가

---

## 3. Toolbox.tsx 필터링 수정

**파일**: `packages/designer/src/components/Toolbox/Toolbox.tsx`

### 변경 사항
1. `useDesignerStore`에서 `editMode` 구독 추가
2. Shell 모드일 때 허용 컨트롤 필터링

```typescript
import { useDesignerStore } from '../../stores/designerStore';

const SHELL_ALLOWED_TYPES = new Set(['MenuStrip', 'ToolStrip', 'StatusStrip', 'Panel']);

export function Toolbox() {
  const editMode = useDesignerStore((s) => s.editMode);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // ... 기존 toggleCategory 로직 ...

  return (
    <div className="toolbox" style={toolboxStyle}>
      <div style={headerStyle}>
        {editMode === 'shell' ? 'Shell 도구 상자' : '도구 상자'}
      </div>
      {TOOLBOX_CATEGORIES.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const allControls = getControlsByCategory(category.id);

        // Shell 모드 필터링
        const controls = editMode === 'shell'
          ? allControls.filter((m) => SHELL_ALLOWED_TYPES.has(m.type))
          : allControls;

        // 필터링 후 컨트롤이 없는 카테고리는 숨김
        if (controls.length === 0) return null;

        return (
          <div key={category.id}>
            {/* ... 기존 카테고리 헤더/바디 ... */}
          </div>
        );
      })}
    </div>
  );
}
```

### 변경 포인트 요약
- 1행: `useDesignerStore` import 추가
- 상수: `SHELL_ALLOWED_TYPES` Set 정의
- `Toolbox()` 내부: `editMode` 구독
- 카테고리 내부: `getControlsByCategory()` 결과를 editMode에 따라 필터
- 빈 카테고리: `if (controls.length === 0) return null;`
- 헤더 텍스트: editMode에 따라 변경

---

## 4. controlProperties.ts SHELL_PROPERTIES 추가

**파일**: `packages/designer/src/components/PropertyPanel/controlProperties.ts`

### 추가 코드 (파일 하단, `getControlEvents` 아래)

```typescript
// Shell 속성 메타데이터
export const SHELL_PROPERTIES: PropertyMeta[] = [
  { name: 'width',           label: 'Width',           category: 'Layout',     editorType: 'number', min: 400 },
  { name: 'height',          label: 'Height',          category: 'Layout',     editorType: 'number', min: 300 },
  { name: 'title',           label: 'Title',           category: 'Appearance', editorType: 'text' },
  { name: 'backgroundColor', label: 'BackColor',       category: 'Appearance', editorType: 'color' },
  { name: 'font',            label: 'Font',            category: 'Appearance', editorType: 'font' },
  { name: 'showTitleBar',    label: 'ShowTitleBar',    category: 'Appearance', editorType: 'boolean' },
  { name: 'formBorderStyle', label: 'FormBorderStyle', category: 'Appearance', editorType: 'dropdown',
    options: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'] },
  { name: 'maximizeBox',     label: 'MaximizeBox',     category: 'Behavior',   editorType: 'boolean' },
  { name: 'minimizeBox',     label: 'MinimizeBox',     category: 'Behavior',   editorType: 'boolean' },
];
```

**참고**: SHELL_PROPERTIES의 `name` 필드는 `ShellProperties` 인터페이스의 직접 키를 사용 (`width`, `title` 등). `formBorderStyle` 옵션은 `ShellProperties` 타입에 정의된 4가지(`'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable'`)만 사용한다 (태스크 요구사항의 7가지 옵션은 ShellProperties 타입과 불일치하므로 타입에 맞춤). `startFormId`는 Shell 최상위 속성(`ApplicationShellDefinition.startFormId`)이지만, PropertyPanel에서 직접 구현하는 것은 API 연동(폼 목록 로딩) 필요 → 별도 태스크로 분리.

---

## 5. PropertyPanel.tsx Shell 분기 추가

**파일**: `packages/designer/src/components/PropertyPanel/PropertyPanel.tsx`

### 변경 사항

1. import에 `SHELL_PROPERTIES` 추가
2. `editMode`, `shellProperties`, `setShellProperties` 구독
3. `editMode === 'shell' && selectedIds.size === 0` → Shell 속성 표시
4. `editMode === 'shell' && selectedIds.size === 1` → Shell 컨트롤 속성 (shellControls에서 찾기)

```typescript
import { SHELL_PROPERTIES } from './controlProperties';

export function PropertyPanel({ onOpenEventEditor }: PropertyPanelProps) {
  // 기존 ...
  const editMode = useDesignerStore((s) => s.editMode);
  const shellProperties = useDesignerStore((s) => s.shellProperties);
  const setShellProperties = useDesignerStore((s) => s.setShellProperties);
  const shellControls = useDesignerStore((s) => s.shellControls);
  const updateShellControl = useDesignerStore((s) => s.updateShellControl);

  // Shell 컨트롤 선택 해결
  const selectedShellControl = useMemo(() => {
    if (editMode !== 'shell' || selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return shellControls.find((c) => c.id === id) ?? null;
  }, [editMode, selectedIds, shellControls]);

  // Shell 속성 getValue/handleValueChange
  const getShellValue = useCallback((name: string): unknown => {
    return (shellProperties as unknown as Record<string, unknown>)[name];
  }, [shellProperties]);

  const handleShellValueChange = useCallback((name: string, value: unknown) => {
    setShellProperties({ [name]: value } as Partial<ShellProperties>);
  }, [setShellProperties]);

  // Shell 속성 그룹화
  const shellGroupedProperties = useMemo(() => {
    const categoryOrder: PropertyCategoryName[] = ['Layout', 'Appearance', 'Behavior'];
    const groups = new Map<string, PropertyMeta[]>();
    for (const meta of SHELL_PROPERTIES) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, []);

  // === Shell 모드: 컨트롤 미선택 → Shell 속성 ===
  if (editMode === 'shell' && selectedIds.size === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', fontSize: 12, fontWeight: 600 }}>
          {shellProperties.title} (Shell)
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {shellGroupedProperties.map(({ category, properties }) => (
            <PropertyCategory
              key={category}
              category={category}
              properties={properties}
              getValue={getShellValue}
              onValueChange={handleShellValueChange}
            />
          ))}
        </div>
      </div>
    );
  }

  // === Shell 모드: Shell 컨트롤 선택 → 컨트롤 속성 ===
  if (editMode === 'shell' && selectedShellControl) {
    // 기존 컨트롤 속성 표시 로직과 동일하지만,
    // getValue는 selectedShellControl에서, handleValueChange는 updateShellControl 사용
    // ... (기존 단일 선택 로직을 재사용하되 shellControls/updateShellControl로 대체)
  }

  // === Form 모드: 기존 로직 그대로 ===
  if (selectedIds.size === 0) {
    // 폼 속성 표시 (기존 코드)
  }
  // ...
}
```

### 핵심: Shell 컨트롤 속성 편집 시 getValue/handleValueChange 변환
Shell 컨트롤 속성 편집은 기존 `selectedControl` 로직과 거의 동일하되:
- 데이터 소스: `shellControls`에서 find
- 업데이트: `updateShellControl(id, changes)` 호출
- 기존 `getValue`, `handleValueChange` 콜백을 Shell 컨트롤용으로 분기

---

## 6. App.tsx 수정

**파일**: `packages/designer/src/App.tsx`

### 변경 사항
- `ShellCanvas` import 추가
- 기존 `editMode === 'shell'` placeholder를 `<ShellCanvas />`로 교체

```typescript
import { ShellCanvas } from './components/Canvas/ShellCanvas';

// 캔버스 영역 내부:
{editMode === 'shell' ? (
  <ShellCanvas />
) : (
  <DesignerCanvas />
)}
```

---

## 7. 파일 변경 요약

| 파일 | 액션 | 설명 |
|------|------|------|
| `packages/designer/src/components/Canvas/ShellCanvas.tsx` | **신규** | Shell 편집 캔버스 (Top/Middle/Bottom 레이아웃, react-dnd 드롭) |
| `packages/designer/src/components/Toolbox/Toolbox.tsx` | **수정** | editMode에 따른 컨트롤 필터링 |
| `packages/designer/src/components/PropertyPanel/controlProperties.ts` | **수정** | `SHELL_PROPERTIES` 배열 export 추가 |
| `packages/designer/src/components/PropertyPanel/PropertyPanel.tsx` | **수정** | Shell 모드 분기 (Shell 속성 / Shell 컨트롤 속성) |
| `packages/designer/src/App.tsx` | **수정** | ShellCanvas import 및 렌더링 연결 |

## 8. 구현 시 주의사항

1. **기존 폼 편집 흐름 불변**: editMode === 'form' 시 모든 기존 코드 경로 유지
2. **react-dnd 호환**: `DragItemTypes.TOOLBOX_CONTROL` 동일 사용, ToolboxItem 변경 불필요
3. **Shell 컨트롤은 dock 기반**: position 값은 무시, width는 Shell 너비에 맞춤
4. **startFormId 드롭다운**: 서버에서 폼 목록을 로딩해야 하므로 이 태스크에서는 `SHELL_PROPERTIES`에서 제외, 별도 태스크(designer-shell-api)에서 구현
5. **formBorderStyle 옵션**: `ShellProperties` 타입에 정의된 4가지만 사용 (타입 안전성)
6. **Shell 이벤트 탭**: 이 태스크에서는 미포함, Shell 이벤트 처리는 별도 태스크
