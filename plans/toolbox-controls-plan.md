# 도구상자 및 기본 컨트롤 구현 계획

## 1. 개요

`@webform/designer` 패키지에 도구상자(Toolbox) UI와 Phase 1 기본 컨트롤 14종의 WinForm 스타일 디자이너 렌더링을 구현한다. PRD 섹션 4.1.2의 모든 요구사항을 충족하며, 기존 `DesignerCanvas`의 `DragItemTypes.TOOLBOX_CONTROL` 드롭 처리와 `designerStore.createDefaultControl()`을 연동한다.

### 1.1 구현 범위

| 영역 | 설명 |
|------|------|
| Toolbox UI | 카테고리별 컨트롤 목록, 접기/펼치기, 아이콘 + 이름 표시 |
| ToolboxItem | `useDrag(type='TOOLBOX_CONTROL')` 드래그 지원 |
| 디자이너 컨트롤 14종 | WinForm 스타일 시각적 미리보기 컴포넌트 |
| 컨트롤 레지스트리 | `designerControlRegistry`, `controlMetadata` 통합 관리 |
| CanvasControl 연동 | `ControlPreview`를 레지스트리 기반 렌더링으로 교체 |

### 1.2 범위 밖 (후속 태스크)

- 속성 패널 UI (`properties-panel-plan`)
- 런타임 컨트롤 추가 구현 (`RadioButton`, `ListBox` 등 — 런타임은 별도)
- Anchor & Dock 레이아웃 시뮬레이션
- 컨테이너 내 자식 컨트롤 드롭 (중첩 드롭)

---

## 2. 파일 구조

```
packages/designer/src/
├── components/
│   ├── Canvas/
│   │   ├── DesignerCanvas.tsx         # (기존) drop 대상 — 변경 없음
│   │   ├── CanvasControl.tsx          # (수정) ControlPreview → registry 연동
│   │   └── ...                        # (기존) 나머지 — 변경 없음
│   └── Toolbox/
│       ├── Toolbox.tsx                # 카테고리별 컨트롤 목록 패널
│       ├── ToolboxItem.tsx            # 개별 컨트롤 드래그 아이템
│       └── index.ts                   # 배럴 export
├── controls/
│   ├── registry.ts                    # designerControlRegistry + controlMetadata
│   ├── ButtonControl.tsx              # 14종 디자이너 컨트롤 컴포넌트
│   ├── LabelControl.tsx
│   ├── TextBoxControl.tsx
│   ├── CheckBoxControl.tsx
│   ├── RadioButtonControl.tsx
│   ├── ComboBoxControl.tsx
│   ├── ListBoxControl.tsx
│   ├── NumericUpDownControl.tsx
│   ├── DateTimePickerControl.tsx
│   ├── ProgressBarControl.tsx
│   ├── PictureBoxControl.tsx
│   ├── PanelControl.tsx
│   ├── GroupBoxControl.tsx
│   ├── TabControlControl.tsx
│   └── index.ts                       # 배럴 export
├── stores/
│   └── designerStore.ts               # (기존) createDefaultControl — 변경 없음
└── App.tsx                            # (수정) Toolbox placeholder → <Toolbox /> 교체
```

---

## 3. 컨트롤 레지스트리 설계

### 3.1 `controls/registry.ts`

디자이너 전용 컨트롤 레지스트리. 런타임 레지스트리(`packages/runtime/src/controls/registry.ts`)와 분리한다. 디자이너 컨트롤은 상호작용 없이 WinForm 스타일 외관만 렌더링하는 경량 컴포넌트다.

```typescript
import type { ComponentType } from 'react';
import type { ControlType } from '@webform/common';

// --- 디자이너 컨트롤 Props 공통 인터페이스 ---
export interface DesignerControlProps {
  properties: Record<string, unknown>;
  size: { width: number; height: number };
  children?: React.ReactNode;     // 컨테이너용
}

// --- 디자이너 컨트롤 레지스트리 ---
// ControlType → 디자이너 미리보기 React 컴포넌트 매핑
export const designerControlRegistry: Partial<
  Record<ControlType, ComponentType<DesignerControlProps>>
> = {
  Button: ButtonControl,
  Label: LabelControl,
  TextBox: TextBoxControl,
  CheckBox: CheckBoxControl,
  RadioButton: RadioButtonControl,
  ComboBox: ComboBoxControl,
  ListBox: ListBoxControl,
  NumericUpDown: NumericUpDownControl,
  DateTimePicker: DateTimePickerControl,
  ProgressBar: ProgressBarControl,
  PictureBox: PictureBoxControl,
  Panel: PanelControl,
  GroupBox: GroupBoxControl,
  TabControl: TabControlControl,
};

// --- 컨트롤 메타데이터 ---
// 도구상자 표시용 아이콘 + 카테고리 + 표시명
export interface ControlMeta {
  type: ControlType;
  displayName: string;
  icon: string;          // 텍스트 아이콘 (이모지 또는 문자)
  category: 'basic' | 'container';
}

export const controlMetadata: ControlMeta[] = [
  // 기본 컨트롤
  { type: 'Button',          displayName: 'Button',          icon: '▭',  category: 'basic' },
  { type: 'Label',           displayName: 'Label',           icon: 'A',  category: 'basic' },
  { type: 'TextBox',         displayName: 'TextBox',         icon: '▤',  category: 'basic' },
  { type: 'CheckBox',        displayName: 'CheckBox',        icon: '☑',  category: 'basic' },
  { type: 'RadioButton',     displayName: 'RadioButton',     icon: '◉',  category: 'basic' },
  { type: 'ComboBox',        displayName: 'ComboBox',        icon: '▾',  category: 'basic' },
  { type: 'ListBox',         displayName: 'ListBox',         icon: '☰',  category: 'basic' },
  { type: 'NumericUpDown',   displayName: 'NumericUpDown',   icon: '#',  category: 'basic' },
  { type: 'DateTimePicker',  displayName: 'DateTimePicker',  icon: '📅', category: 'basic' },
  { type: 'ProgressBar',     displayName: 'ProgressBar',     icon: '▓',  category: 'basic' },
  { type: 'PictureBox',      displayName: 'PictureBox',      icon: '🖼', category: 'basic' },

  // 컨테이너
  { type: 'Panel',           displayName: 'Panel',           icon: '□',  category: 'container' },
  { type: 'GroupBox',        displayName: 'GroupBox',        icon: '▣',  category: 'container' },
  { type: 'TabControl',      displayName: 'TabControl',      icon: '⊞',  category: 'container' },
];

// --- 카테고리 정의 ---
export const TOOLBOX_CATEGORIES = [
  { id: 'basic',     name: '기본 컨트롤',  collapsed: false },
  { id: 'container', name: '컨테이너',      collapsed: false },
] as const;

// --- 헬퍼 함수 ---
export function getDesignerComponent(type: ControlType): ComponentType<DesignerControlProps> | undefined {
  return designerControlRegistry[type];
}

export function getControlsByCategory(categoryId: string): ControlMeta[] {
  return controlMetadata.filter((m) => m.category === categoryId);
}
```

**설계 근거**:
- 디자이너와 런타임 레지스트리 분리: 디자이너 컨트롤은 읽기 전용 미리보기, 런타임은 상호작용 포함. 목적이 다르므로 분리한다.
- `DesignerControlProps` 통일: 모든 디자이너 컨트롤이 동일한 props 인터페이스를 사용하여, 레지스트리를 통한 동적 렌더링이 가능하다.
- `controlMetadata` 배열: 도구상자 렌더링 순서를 보장하기 위해 배열로 정의한다. 순서가 중요한 UI에서 Map보다 배열이 적합하다.
- 아이콘은 텍스트 문자를 사용한다. SVG 아이콘 라이브러리 의존성 없이 구현하고, 추후 필요 시 SVG로 교체할 수 있다.

### 3.2 기존 `designerStore.ts`와의 관계

`designerStore.ts`에 이미 구현된 함수들은 변경하지 않는다:

| 기존 함수 | 역할 | 변경 |
|-----------|------|------|
| `createDefaultControl(type, position)` | 새 컨트롤 생성 (UUID, 기본 속성/크기) | 없음 |
| `getDefaultSize(type)` | 타입별 기본 크기 반환 | 없음 |
| `getDefaultProperties(type)` | 타입별 기본 속성 반환 | 없음 |

이 함수들은 이미 Phase 1 전체 14종을 지원하고 있으므로, 레지스트리와 독립적으로 작동한다. 캔버스 드롭 시 `createDefaultControl`이 호출되고, 디자이너 렌더링 시 `designerControlRegistry`에서 컴포넌트를 조회한다.

---

## 4. 도구상자(Toolbox) 컴포넌트 설계

### 4.1 `components/Toolbox/Toolbox.tsx`

```tsx
import { useState } from 'react';
import { TOOLBOX_CATEGORIES, getControlsByCategory } from '../../controls/registry';
import { ToolboxItem } from './ToolboxItem';

export function Toolbox() {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="toolbox" style={toolboxStyle}>
      <div style={headerStyle}>도구 상자</div>
      {TOOLBOX_CATEGORIES.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const controls = getControlsByCategory(category.id);

        return (
          <div key={category.id}>
            {/* 카테고리 헤더 — 클릭으로 접기/펼치기 */}
            <div
              style={categoryHeaderStyle}
              onClick={() => toggleCategory(category.id)}
            >
              <span>{isCollapsed ? '▶' : '▼'}</span>
              <span>{category.name}</span>
            </div>

            {/* 컨트롤 목록 */}
            {!isCollapsed && (
              <div style={categoryBodyStyle}>
                {controls.map((meta) => (
                  <ToolboxItem key={meta.type} meta={meta} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

#### 스타일

```typescript
const toolboxStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  padding: '8px',
  fontWeight: 'bold',
  fontSize: '12px',
  borderBottom: '1px solid #ccc',
  backgroundColor: '#e8e8e8',
};

const categoryHeaderStyle: CSSProperties = {
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold',
  backgroundColor: '#ececec',
  borderBottom: '1px solid #ddd',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  userSelect: 'none',
};

const categoryBodyStyle: CSSProperties = {
  padding: '2px 0',
};
```

### 4.2 `components/Toolbox/ToolboxItem.tsx`

```tsx
import { useDrag } from 'react-dnd';
import { DragItemTypes } from '../Canvas/CanvasControl';
import type { ControlMeta } from '../../controls/registry';

interface ToolboxItemProps {
  meta: ControlMeta;
}

export function ToolboxItem({ meta }: ToolboxItemProps) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DragItemTypes.TOOLBOX_CONTROL,
    item: { type: meta.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [meta.type]);

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      style={{
        ...itemStyle,
        opacity: isDragging ? 0.5 : 1,
      }}
      title={meta.displayName}
    >
      <span style={iconStyle}>{meta.icon}</span>
      <span style={labelStyle}>{meta.displayName}</span>
    </div>
  );
}
```

#### 스타일

```typescript
const itemStyle: CSSProperties = {
  padding: '3px 8px',
  cursor: 'grab',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  borderRadius: '2px',
  // hover 효과는 :hover pseudo-class로 처리
};

const iconStyle: CSSProperties = {
  width: '16px',
  textAlign: 'center',
  fontSize: '12px',
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
```

**설계 근거**:
- `DragItemTypes.TOOLBOX_CONTROL`을 재사용한다. 이미 `CanvasControl.tsx`에서 정의되고 `DesignerCanvas.tsx`의 `useDrop`에서 accept하고 있다.
- `item: { type: meta.type }` — `DesignerCanvas`의 drop 핸들러가 `item.type`으로 `createDefaultControl`을 호출한다. 기존 코드와 완전히 호환된다.
- hover 효과를 위해 CSS 파일 또는 `onMouseEnter/Leave` 상태를 추가할 수 있다. 기본 구현에서는 인라인 스타일을 사용하되, hover는 별도 state로 처리한다.

### 4.3 드래그 앤 드롭 흐름 (전체 시퀀스)

```
1. ToolboxItem.useDrag({ type: 'TOOLBOX_CONTROL', item: { type: 'Button' } })
2. 사용자가 ToolboxItem을 캔버스로 드래그
3. DesignerCanvas.useDrop({ accept: 'TOOLBOX_CONTROL' })
4. drop 핸들러:
   a. monitor.getClientOffset()으로 마우스 좌표 획득
   b. canvasRect 기준 상대 좌표 계산
   c. snapPositionToGrid()로 그리드 스냅
   d. historyStore.pushSnapshot()으로 undo 스냅샷 저장
   e. createDefaultControl(item.type, position) 호출 → ControlDefinition 생성
   f. designerStore.addControl(control) → controls 배열에 추가
5. CanvasControl 렌더링:
   a. designerControlRegistry[control.type]에서 컴포넌트 조회
   b. 해당 디자이너 컨트롤 컴포넌트 렌더링 (WinForm 스타일)
```

---

## 5. Phase 1 디자이너 컨트롤 14종 상세 설계

모든 디자이너 컨트롤은 `DesignerControlProps`를 받아 WinForm 스타일의 정적 미리보기를 렌더링한다. 상호작용(클릭, 입력)은 없으며, 디자인 타임 외관만 제공한다.

### 5.1 `ButtonControl.tsx` — 버튼

**WinForm 스타일**: 회색 배경(`#E1E1E1`), 3D outset 테두리, 중앙 텍스트

```tsx
export function ButtonControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Button';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E1E1E1',
      border: '1px outset #D0D0D0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
```

### 5.2 `LabelControl.tsx` — 레이블

**WinForm 스타일**: 투명 배경, 좌측 정렬 텍스트, 포어그라운드 컬러

```tsx
export function LabelControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Label';
  const foreColor = (properties.foreColor as string) ?? '#000000';
  const textAlign = (properties.textAlign as string) ?? 'TopLeft';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      color: foreColor,
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      display: 'flex',
      alignItems: getAlignItems(textAlign),
      justifyContent: getJustifyContent(textAlign),
      overflow: 'hidden',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}

// WinForm ContentAlignment → CSS flex 매핑
function getAlignItems(align: string): string {
  if (align.startsWith('Top')) return 'flex-start';
  if (align.startsWith('Middle')) return 'center';
  if (align.startsWith('Bottom')) return 'flex-end';
  return 'flex-start';
}

function getJustifyContent(align: string): string {
  if (align.endsWith('Left')) return 'flex-start';
  if (align.endsWith('Center')) return 'center';
  if (align.endsWith('Right')) return 'flex-end';
  return 'flex-start';
}
```

### 5.3 `TextBoxControl.tsx` — 텍스트 박스

**WinForm 스타일**: 흰색 배경, sunken(inset) 테두리, multiline 시 다중행 표시

```tsx
export function TextBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? '';
  const multiline = (properties.multiline as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#FFFFFF',
      border: '1px inset #D0D0D0',
      padding: '1px 2px',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      overflow: 'hidden',
      whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
      color: '#000',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
```

### 5.4 `CheckBoxControl.tsx` — 체크박스

**WinForm 스타일**: 13x13 체크박스 + 좌측 텍스트 레이블

```tsx
export function CheckBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'CheckBox';
  const checked = (properties.checked as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 13,
        height: 13,
        border: '1px solid #848484',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
      }}>
        {checked ? '✓' : ''}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
```

### 5.5 `RadioButtonControl.tsx` — 라디오 버튼

**WinForm 스타일**: 원형 라디오 + 텍스트 레이블

```tsx
export function RadioButtonControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'RadioButton';
  const checked = (properties.checked as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        border: '1px solid #848484',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {checked && (
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#000000',
          }} />
        )}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
```

### 5.6 `ComboBoxControl.tsx` — 콤보 박스

**WinForm 스타일**: 흰색 입력 영역 + 우측 드롭다운 화살표 버튼

```tsx
export function ComboBoxControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;
  const displayText = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : '';

  const arrowWidth = 17; // WinForm 드롭다운 버튼 폭

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: '1px solid #A0A0A0',
    }}>
      {/* 텍스트 영역 */}
      <div style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: '1px 2px',
        fontSize: '12px',
        fontFamily: 'Segoe UI, sans-serif',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
      }}>
        {displayText}
      </div>
      {/* 드롭다운 화살표 버튼 */}
      <div style={{
        width: arrowWidth,
        backgroundColor: '#E1E1E1',
        borderLeft: '1px solid #A0A0A0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
      }}>
        ▼
      </div>
    </div>
  );
}
```

### 5.7 `ListBoxControl.tsx` — 리스트 박스

**WinForm 스타일**: 흰색 배경, sunken 테두리, 아이템 목록 + 스크롤바

```tsx
export function ListBoxControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#FFFFFF',
      border: '1px inset #D0D0D0',
      overflow: 'auto',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      boxSizing: 'border-box',
    }}>
      {items.length === 0 ? (
        <div style={{ padding: '2px 4px', color: '#999' }}>(항목 없음)</div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '1px 4px',
              backgroundColor: i === selectedIndex ? '#0078D7' : 'transparent',
              color: i === selectedIndex ? '#FFFFFF' : '#000000',
            }}
          >
            {item}
          </div>
        ))
      )}
    </div>
  );
}
```

### 5.8 `NumericUpDownControl.tsx` — 숫자 입력

**WinForm 스타일**: 입력 필드 + 우측 위/아래 화살표 버튼

```tsx
export function NumericUpDownControl({ properties, size }: DesignerControlProps) {
  const value = (properties.value as number) ?? 0;
  const arrowWidth = 17;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: '1px solid #A0A0A0',
    }}>
      {/* 값 표시 영역 */}
      <div style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: '1px 2px',
        fontSize: '12px',
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        alignItems: 'center',
      }}>
        {value}
      </div>
      {/* 위/아래 화살표 */}
      <div style={{
        width: arrowWidth,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #A0A0A0',
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#E1E1E1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
          borderBottom: '1px solid #A0A0A0',
        }}>
          ▲
        </div>
        <div style={{
          flex: 1,
          backgroundColor: '#E1E1E1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
        }}>
          ▼
        </div>
      </div>
    </div>
  );
}
```

### 5.9 `DateTimePickerControl.tsx` — 날짜 선택기

**WinForm 스타일**: 날짜 텍스트 + 우측 달력 드롭다운 버튼

```tsx
export function DateTimePickerControl({ properties, size }: DesignerControlProps) {
  const format = (properties.format as string) ?? 'Short';
  const displayText = format === 'Long'
    ? '2026년 2월 22일 일요일'
    : '2026-02-22';
  const arrowWidth = 21;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: '1px solid #A0A0A0',
    }}>
      {/* 날짜 표시 영역 */}
      <div style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: '1px 4px',
        fontSize: '12px',
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}>
        {displayText}
      </div>
      {/* 달력 버튼 */}
      <div style={{
        width: arrowWidth,
        backgroundColor: '#E1E1E1',
        borderLeft: '1px solid #A0A0A0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
      }}>
        ▼
      </div>
    </div>
  );
}
```

### 5.10 `ProgressBarControl.tsx` — 진행 바

**WinForm 스타일**: 회색 배경 위에 초록색 진행 막대

```tsx
export function ProgressBarControl({ properties, size }: DesignerControlProps) {
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const percent = maximum > minimum
    ? ((value - minimum) / (maximum - minimum)) * 100
    : 0;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E6E6E6',
      border: '1px solid #BCBCBC',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, percent))}%`,
        height: '100%',
        backgroundColor: '#06B025',
        transition: 'width 0.2s',
      }} />
    </div>
  );
}
```

### 5.11 `PictureBoxControl.tsx` — 이미지 박스

**WinForm 스타일**: 이미지가 없으면 회색 플레이스홀더 + 이미지 아이콘

```tsx
export function PictureBoxControl({ properties, size }: DesignerControlProps) {
  const image = properties.image as string | undefined;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E0E0E0',
      border: '1px solid #BCBCBC',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {image ? (
        <img
          src={image}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ color: '#999', fontSize: '20px', userSelect: 'none' }}>
          🖼
        </span>
      )}
    </div>
  );
}
```

### 5.12 `PanelControl.tsx` — 패널 (컨테이너)

**WinForm 스타일**: 배경색 있는 컨테이너, borderStyle에 따른 테두리

```tsx
export function PanelControl({ properties, size, children }: DesignerControlProps) {
  const borderStyle = (properties.borderStyle as string) ?? 'None';

  let border = 'none';
  if (borderStyle === 'FixedSingle') border = '1px solid #888888';
  else if (borderStyle === 'Fixed3D') border = '2px inset #D0D0D0';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      border,
      backgroundColor: '#F0F0F0',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}
```

### 5.13 `GroupBoxControl.tsx` — 그룹 박스 (컨테이너)

**WinForm 스타일**: 상단 텍스트 레이블 + 라운드 테두리 (fieldset 스타일)

```tsx
export function GroupBoxControl({ properties, size, children }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'GroupBox';

  return (
    <fieldset style={{
      width: size.width,
      height: size.height,
      border: '1px solid #D0D0D0',
      borderRadius: '2px',
      margin: 0,
      padding: '8px 4px 4px',
      position: 'relative',
      boxSizing: 'border-box',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
    }}>
      <legend style={{
        padding: '0 4px',
        fontSize: '12px',
        color: '#000',
      }}>
        {text}
      </legend>
      {children}
    </fieldset>
  );
}
```

### 5.14 `TabControlControl.tsx` — 탭 컨트롤 (컨테이너)

**WinForm 스타일**: 상단 탭 헤더 + 아래 콘텐츠 영역

```tsx
export function TabControlControl({ properties, size, children }: DesignerControlProps) {
  const selectedIndex = (properties.selectedIndex as number) ?? 0;

  // 탭 페이지 이름 (자식이 없으면 기본 탭 2개 표시)
  const tabNames = (properties.tabPages as string[]) ?? ['TabPage1', 'TabPage2'];

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* 탭 헤더 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #A0A0A0',
        backgroundColor: '#F0F0F0',
        flexShrink: 0,
      }}>
        {tabNames.map((name, i) => (
          <div
            key={i}
            style={{
              padding: '4px 12px',
              border: '1px solid #A0A0A0',
              borderBottom: i === selectedIndex ? '1px solid #FFFFFF' : 'none',
              backgroundColor: i === selectedIndex ? '#FFFFFF' : '#E8E8E8',
              marginRight: '-1px',
              marginBottom: i === selectedIndex ? '-1px' : '0',
              fontSize: '11px',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            {name}
          </div>
        ))}
      </div>
      {/* 콘텐츠 영역 */}
      <div style={{
        flex: 1,
        border: '1px solid #A0A0A0',
        borderTop: 'none',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}>
        {children}
      </div>
    </div>
  );
}
```

---

## 6. CanvasControl 수정 — 레지스트리 연동

### 6.1 기존 `ControlPreview` 교체

현재 `CanvasControl.tsx`의 `ControlPreview`는 단순히 `text` 또는 `type`을 표시한다:

```tsx
// 현재 코드 (CanvasControl.tsx 21~41행)
function ControlPreview({ type, properties }: { type: ControlType; properties: Record<string, unknown> }) {
  const text = (properties.text as string) ?? type;
  return (
    <div style={{ ... }}>
      {text}
    </div>
  );
}
```

이를 `designerControlRegistry` 기반으로 교체한다:

```tsx
// 변경 코드
import { getDesignerComponent } from '../../controls/registry';

function ControlPreview({
  type,
  properties,
  size,
}: {
  type: ControlType;
  properties: Record<string, unknown>;
  size: { width: number; height: number };
}) {
  const Component = getDesignerComponent(type);

  if (Component) {
    return <Component properties={properties} size={size} />;
  }

  // 레지스트리에 없는 컨트롤 → 폴백 (타입명 표시)
  const text = (properties.text as string) ?? type;
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      color: '#333',
    }}>
      {text}
    </div>
  );
}
```

### 6.2 `CanvasControl` 호출부 수정

```tsx
// CanvasControl 렌더 부분에서 size prop 추가 전달
<ControlPreview
  type={control.type}
  properties={control.properties}
  size={control.size}     // 추가
/>
```

### 6.3 `CanvasControl` 배경색 처리

현재 모든 컨트롤의 배경이 `#fff`로 고정되어 있다. 디자이너 컨트롤이 자체 배경을 가지므로, `CanvasControl`의 `backgroundColor`를 `transparent`로 변경한다:

```tsx
// 기존
backgroundColor: '#fff',

// 변경
backgroundColor: 'transparent',
```

---

## 7. App.tsx 수정 — Toolbox 연동

```tsx
import { Toolbox } from './components/Toolbox';

// 기존 placeholder를 <Toolbox />로 교체
<div
  className="toolbox-panel"
  style={{
    width: 200,
    borderRight: '1px solid #ccc',
    backgroundColor: '#f5f5f5',
    overflow: 'auto',
  }}
>
  <Toolbox />
</div>
```

기존의 `padding: 8` 스타일은 제거하고, Toolbox 컴포넌트 내부에서 패딩을 관리한다.

---

## 8. 컨트롤별 기본 크기 및 속성 확인

`designerStore.ts`에 이미 정의된 값들을 확인하고, 누락된 항목이 있는지 검증한다.

### 8.1 기본 크기 (`getDefaultSize`)

| 컨트롤 | 정의됨 | width | height |
|--------|--------|-------|--------|
| Button | ✓ | 75 | 23 |
| Label | ✓ | 100 | 23 |
| TextBox | ✓ | 100 | 23 |
| CheckBox | ✓ | 104 | 24 |
| RadioButton | ✓ | 104 | 24 |
| ComboBox | ✓ | 121 | 23 |
| ListBox | ✓ | 120 | 96 |
| NumericUpDown | ✓ | 120 | 23 |
| DateTimePicker | ✓ | 200 | 23 |
| ProgressBar | ✓ | 100 | 23 |
| PictureBox | ✓ | 100 | 50 |
| Panel | ✓ | 200 | 100 |
| GroupBox | ✓ | 200 | 100 |
| TabControl | ✓ | 200 | 100 |

모든 14종이 이미 정의되어 있다. 추가 변경 불필요.

### 8.2 기본 속성 (`getDefaultProperties`)

| 컨트롤 | 정의됨 | 기본 속성 |
|--------|--------|----------|
| Button | ✓ | `{ text: 'Button' }` |
| Label | ✓ | `{ text: 'Label' }` |
| TextBox | ✓ | `{ text: '' }` |
| CheckBox | ✓ | `{ text: 'CheckBox', checked: false }` |
| RadioButton | ✓ | `{ text: 'RadioButton', checked: false }` |
| ComboBox | ✓ | `{ items: [], selectedIndex: -1 }` |
| ListBox | ✓ | `{ items: [], selectedIndex: -1 }` |
| NumericUpDown | ✓ | `{ value: 0, minimum: 0, maximum: 100 }` |
| DateTimePicker | ✓ | `{ format: 'Short' }` |
| ProgressBar | ✓ | `{ value: 0, minimum: 0, maximum: 100 }` |
| PictureBox | ✓ | `{ sizeMode: 'Normal' }` |
| Panel | ✓ | `{ borderStyle: 'None' }` |
| GroupBox | ✓ | `{ text: 'GroupBox' }` |
| TabControl | ✗ (default: `{}`) | 추가 필요: `{ tabPages: ['TabPage1', 'TabPage2'], selectedIndex: 0 }` |

**필요한 수정**: `designerStore.ts`의 `getDefaultProperties`에 TabControl 케이스 추가

```typescript
case 'TabControl':
  return { tabPages: ['TabPage1', 'TabPage2'], selectedIndex: 0 };
```

---

## 9. 구현 순서

| 순서 | 파일 | 설명 | 의존 |
|------|------|------|------|
| 1 | `controls/registry.ts` | 레지스트리 + 메타데이터 (import만, 컴포넌트 후 작성) | `@webform/common` |
| 2 | `controls/ButtonControl.tsx` | 버튼 디자이너 컨트롤 | `DesignerControlProps` |
| 3 | `controls/LabelControl.tsx` | 레이블 | `DesignerControlProps` |
| 4 | `controls/TextBoxControl.tsx` | 텍스트 박스 | `DesignerControlProps` |
| 5 | `controls/CheckBoxControl.tsx` | 체크박스 | `DesignerControlProps` |
| 6 | `controls/RadioButtonControl.tsx` | 라디오 버튼 | `DesignerControlProps` |
| 7 | `controls/ComboBoxControl.tsx` | 콤보 박스 | `DesignerControlProps` |
| 8 | `controls/ListBoxControl.tsx` | 리스트 박스 | `DesignerControlProps` |
| 9 | `controls/NumericUpDownControl.tsx` | 숫자 입력 | `DesignerControlProps` |
| 10 | `controls/DateTimePickerControl.tsx` | 날짜 선택기 | `DesignerControlProps` |
| 11 | `controls/ProgressBarControl.tsx` | 진행 바 | `DesignerControlProps` |
| 12 | `controls/PictureBoxControl.tsx` | 이미지 박스 | `DesignerControlProps` |
| 13 | `controls/PanelControl.tsx` | 패널 | `DesignerControlProps` |
| 14 | `controls/GroupBoxControl.tsx` | 그룹 박스 | `DesignerControlProps` |
| 15 | `controls/TabControlControl.tsx` | 탭 컨트롤 | `DesignerControlProps` |
| 16 | `controls/index.ts` | 배럴 export | 모든 컨트롤 |
| 17 | `controls/registry.ts` (완성) | 모든 컴포넌트 import 연결 | 모든 컨트롤 |
| 18 | `components/Toolbox/ToolboxItem.tsx` | 드래그 아이템 | `registry`, `DragItemTypes` |
| 19 | `components/Toolbox/Toolbox.tsx` | 도구상자 패널 | `ToolboxItem`, `registry` |
| 20 | `components/Toolbox/index.ts` | 배럴 export | `Toolbox` |
| 21 | `components/Canvas/CanvasControl.tsx` (수정) | ControlPreview → registry 연동 | `registry` |
| 22 | `stores/designerStore.ts` (수정) | TabControl 기본 속성 추가 | 없음 |
| 23 | `App.tsx` (수정) | Toolbox placeholder → `<Toolbox />` | `Toolbox` |

---

## 10. 의존성

이 태스크에서 사용하는 모든 의존성은 이미 `packages/designer/package.json`에 선언되어 있다. 추가 설치가 필요한 패키지는 **없다**.

| 패키지 | 용도 |
|--------|------|
| `react` | UI 프레임워크 |
| `react-dnd` | ToolboxItem 드래그 |
| `zustand` | 상태 관리 (기존) |
| `@webform/common` | ControlType 타입 |

---

## 11. 테스트 전략 (후속 `toolbox-controls-test` 태스크)

### 11.1 registry.test.ts

| 테스트 케이스 | 설명 |
|--------------|------|
| 14종 모두 등록 확인 | `designerControlRegistry` 키가 14종과 일치 |
| 메타데이터 카테고리 분류 | `getControlsByCategory('basic')` → 11종, `'container'` → 3종 |
| 컴포넌트 타입 검증 | 각 레지스트리 값이 React 컴포넌트 함수 |

### 11.2 controls/*.test.tsx

| 테스트 케이스 | 설명 |
|--------------|------|
| 각 컨트롤 렌더링 | 기본 속성으로 렌더링, 에러 없음 확인 |
| 속성 반영 | text, checked, value 등 속성이 렌더링에 반영 |
| 컨테이너 children | Panel, GroupBox, TabControl에 children 렌더링 |

### 11.3 Toolbox.test.tsx

| 테스트 케이스 | 설명 |
|--------------|------|
| 카테고리 표시 | '기본 컨트롤', '컨테이너' 카테고리 표시 |
| 컨트롤 목록 | 각 카테고리에 올바른 컨트롤 표시 |
| 접기/펼치기 | 카테고리 클릭 시 토글 |

### 11.4 ToolboxItem.test.tsx

| 테스트 케이스 | 설명 |
|--------------|------|
| 아이콘 + 이름 표시 | meta 기반 렌더링 |
| 드래그 시작 | useDrag 활성화 확인 |

---

## 12. 후속 태스크와의 연동

| 후속 태스크 | 이 태스크에서 제공하는 것 |
|------------|------------------------|
| `properties-panel` | `controlMetadata` (속성 에디터 타입 결정), `designerControlRegistry` (미리보기) |
| 런타임 컨트롤 추가 | 디자이너와 독립적. `packages/runtime/src/controls/`에 별도 구현 |
| 컨테이너 중첩 드롭 | `PanelControl`, `GroupBoxControl`, `TabControlControl`의 `children` prop 활용 |
| `DragItemTypes` | `TOOLBOX_CONTROL` 상수를 `CanvasControl.tsx`에서 import하여 사용 (이미 구현됨) |
