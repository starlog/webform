# 속성 패널 구현 계획

## 1. 개요

`@webform/designer` 패키지에 속성 패널(Properties Panel)을 구현한다. Visual Studio WinForm 디자이너의 Properties Window를 재현하여, 선택된 컨트롤의 속성을 카테고리별로 표시/편집하고, 이벤트 핸들러를 관리한다. PRD 섹션 4.1.4의 모든 요구사항을 충족한다.

### 1.1 구현 범위

| 기능 | 설명 |
|------|------|
| 속성 표시/편집 | 선택 컨트롤 속성 표시, 편집 시 designerStore.updateControl 호출 |
| 폼 속성 편집 | 컨트롤 미선택 시 FormProperties 편집 |
| 카테고리 분류 | Appearance, Behavior, Layout, Design 4개 카테고리 |
| 정렬 전환 | 카테고리순 / 알파벳순 토글 |
| 속성/이벤트 탭 | 속성 탭 ↔ 이벤트 탭 전환 |
| 속성 에디터 8종 | Text, Number, Color, Font, Dropdown, Boolean, Anchor, Collection |
| 이벤트 편집기 | Monaco Editor 기반 이벤트 핸들러 코드 편집 |

### 1.2 범위 밖 (후속 태스크)

- 데이터 바인딩 편집 UI (Data 카테고리 — `datasource-service`에서 구현)
- Phase 2/3 컨트롤 속성 메타데이터 (DataGridView, TreeView 등 — 해당 컨트롤 구현 시 추가)
- Tab Order 시각적 편집 모드
- 속성 패널 리사이즈 (splitter)

---

## 2. 파일 구조

```
packages/designer/src/
├── components/
│   ├── PropertyPanel/
│   │   ├── controlProperties.ts          # PropertyMeta, CONTROL_PROPERTY_META, CONTROL_EVENTS_META
│   │   ├── PropertyPanel.tsx             # 메인 패널 (selectionStore 구독, 탭 전환)
│   │   ├── PropertyCategory.tsx          # 카테고리 헤더 + 에디터 선택 렌더링
│   │   ├── EventsTab.tsx                 # 이벤트 목록 + 핸들러 이름 입력
│   │   ├── editors/
│   │   │   ├── TextEditor.tsx            # 문자열 인라인 편집
│   │   │   ├── NumberEditor.tsx          # 숫자 입력 (min/max)
│   │   │   ├── ColorPicker.tsx           # HTML color input
│   │   │   ├── FontPicker.tsx            # family/size/bold/italic
│   │   │   ├── DropdownEditor.tsx        # 열거형 select
│   │   │   ├── BooleanToggle.tsx         # checkbox
│   │   │   ├── AnchorEditor.tsx          # 4방향 시각적 앵커 UI
│   │   │   └── CollectionEditor.tsx      # 배열 아이템 모달
│   │   └── index.ts                      # 배럴 export
│   └── EventEditor/
│       └── EventEditor.tsx               # Monaco Editor 통합 코드 편집기
├── App.tsx                               # (수정) 속성 패널 placeholder → <PropertyPanel /> 교체
└── ...
```

---

## 3. controlProperties.ts — 속성 메타데이터 설계

### 3.1 PropertyMeta 인터페이스

```typescript
import type { ControlType } from '@webform/common';

export type EditorType =
  | 'text'
  | 'number'
  | 'color'
  | 'font'
  | 'dropdown'
  | 'boolean'
  | 'anchor'
  | 'collection';

export type PropertyCategory = 'Appearance' | 'Behavior' | 'Layout' | 'Design';

export interface PropertyMeta {
  name: string;                                   // 속성 키 (e.g., 'text', 'backColor')
  label: string;                                  // 표시 이름 (e.g., 'Text', 'BackColor')
  category: PropertyCategory;                     // 카테고리
  editorType: EditorType;                         // 사용할 에디터
  defaultValue: unknown;                          // 기본값
  options?: string[];                             // dropdown용 선택지
  min?: number;                                   // number 에디터 최솟값
  max?: number;                                   // number 에디터 최댓값
}
```

**설계 근거**:
- `name`은 `ControlDefinition.properties[name]` 또는 `ControlDefinition[name]` 접근에 사용한다.
- `label`은 WinForm 속성 이름 규칙(PascalCase)을 따른다.
- `editorType`으로 `PropertyCategory` 컴포넌트가 적절한 에디터를 동적으로 선택한다.
- `options`, `min`, `max`는 에디터 타입에 따라 선택적으로 사용한다.

### 3.2 공통 속성 (모든 컨트롤에 적용)

```typescript
const COMMON_PROPERTIES: PropertyMeta[] = [
  // --- Design ---
  { name: 'name',       label: 'Name',       category: 'Design',     editorType: 'text',    defaultValue: '' },

  // --- Appearance ---
  { name: 'backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color',   defaultValue: '#F0F0F0' },
  { name: 'foreColor',  label: 'ForeColor',  category: 'Appearance', editorType: 'color',   defaultValue: '#000000' },
  { name: 'font',       label: 'Font',       category: 'Appearance', editorType: 'font',    defaultValue: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false } },

  // --- Behavior ---
  { name: 'enabled',    label: 'Enabled',    category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'visible',    label: 'Visible',    category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'tabIndex',   label: 'TabIndex',   category: 'Behavior',   editorType: 'number',  defaultValue: 0, min: 0, max: 9999 },

  // --- Layout ---
  { name: 'x',          label: 'X',          category: 'Layout',     editorType: 'number',  defaultValue: 0, min: 0 },
  { name: 'y',          label: 'Y',          category: 'Layout',     editorType: 'number',  defaultValue: 0, min: 0 },
  { name: 'width',      label: 'Width',      category: 'Layout',     editorType: 'number',  defaultValue: 100, min: 20 },
  { name: 'height',     label: 'Height',     category: 'Layout',     editorType: 'number',  defaultValue: 23, min: 20 },
  { name: 'anchor',     label: 'Anchor',     category: 'Layout',     editorType: 'anchor',  defaultValue: { top: true, bottom: false, left: true, right: false } },
  { name: 'dock',       label: 'Dock',       category: 'Layout',     editorType: 'dropdown', defaultValue: 'None', options: ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'] },
];
```

### 3.3 컨트롤별 속성 정의 — CONTROL_PROPERTY_META

각 `ControlType`별로 공통 속성 + 고유 속성을 합쳐서 정의한다.

```typescript
export const CONTROL_PROPERTY_META: Record<ControlType, PropertyMeta[]> = {
  Button: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',         category: 'Appearance', editorType: 'text',     defaultValue: 'Button' },
    { name: 'textAlign',    label: 'TextAlign',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'MiddleCenter', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
    { name: 'flatStyle',    label: 'FlatStyle',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'Standard', options: ['Flat', 'Popup', 'Standard', 'System'] },
  ],

  Label: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',         category: 'Appearance', editorType: 'text',     defaultValue: 'Label' },
    { name: 'textAlign',    label: 'TextAlign',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'TopLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
    { name: 'autoSize',     label: 'AutoSize',     category: 'Behavior',   editorType: 'boolean',  defaultValue: true },
    { name: 'borderStyle',  label: 'BorderStyle',  category: 'Appearance', editorType: 'dropdown', defaultValue: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ],

  TextBox: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',         category: 'Appearance', editorType: 'text',     defaultValue: '' },
    { name: 'placeholder',  label: 'PlaceholderText', category: 'Appearance', editorType: 'text',  defaultValue: '' },
    { name: 'maxLength',    label: 'MaxLength',    category: 'Behavior',   editorType: 'number',   defaultValue: 32767, min: 0, max: 32767 },
    { name: 'readOnly',     label: 'ReadOnly',     category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
    { name: 'multiline',    label: 'Multiline',    category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
    { name: 'passwordChar', label: 'PasswordChar', category: 'Behavior',   editorType: 'text',     defaultValue: '' },
    { name: 'textAlign',    label: 'TextAlign',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'Left', options: ['Left', 'Center', 'Right'] },
    { name: 'borderStyle',  label: 'BorderStyle',  category: 'Appearance', editorType: 'dropdown', defaultValue: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ],

  CheckBox: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',         category: 'Appearance', editorType: 'text',     defaultValue: 'CheckBox' },
    { name: 'checked',      label: 'Checked',      category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
    { name: 'checkAlign',   label: 'CheckAlign',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'MiddleLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
    { name: 'threeState',   label: 'ThreeState',   category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  ],

  RadioButton: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',         category: 'Appearance', editorType: 'text',     defaultValue: 'RadioButton' },
    { name: 'checked',      label: 'Checked',      category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
    { name: 'checkAlign',   label: 'CheckAlign',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'MiddleLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
  ],

  ComboBox: [
    ...COMMON_PROPERTIES,
    { name: 'text',         label: 'Text',           category: 'Appearance', editorType: 'text',       defaultValue: '' },
    { name: 'items',        label: 'Items',           category: 'Behavior',   editorType: 'collection', defaultValue: [] },
    { name: 'dropDownStyle', label: 'DropDownStyle',  category: 'Appearance', editorType: 'dropdown',   defaultValue: 'DropDown', options: ['Simple', 'DropDown', 'DropDownList'] },
    { name: 'selectedIndex', label: 'SelectedIndex',  category: 'Behavior',   editorType: 'number',     defaultValue: -1, min: -1 },
  ],

  ListBox: [
    ...COMMON_PROPERTIES,
    { name: 'items',           label: 'Items',           category: 'Behavior',   editorType: 'collection', defaultValue: [] },
    { name: 'selectionMode',   label: 'SelectionMode',   category: 'Behavior',   editorType: 'dropdown',   defaultValue: 'One', options: ['None', 'One', 'MultiSimple', 'MultiExtended'] },
    { name: 'selectedIndex',   label: 'SelectedIndex',   category: 'Behavior',   editorType: 'number',     defaultValue: -1, min: -1 },
    { name: 'borderStyle',     label: 'BorderStyle',     category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ],

  NumericUpDown: [
    ...COMMON_PROPERTIES,
    { name: 'value',       label: 'Value',       category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
    { name: 'minimum',     label: 'Minimum',     category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
    { name: 'maximum',     label: 'Maximum',     category: 'Behavior',   editorType: 'number',   defaultValue: 100 },
    { name: 'increment',   label: 'Increment',   category: 'Behavior',   editorType: 'number',   defaultValue: 1, min: 1 },
    { name: 'decimalPlaces', label: 'DecimalPlaces', category: 'Behavior', editorType: 'number', defaultValue: 0, min: 0, max: 99 },
    { name: 'textAlign',   label: 'TextAlign',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Left', options: ['Left', 'Center', 'Right'] },
    { name: 'borderStyle', label: 'BorderStyle', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ],

  DateTimePicker: [
    ...COMMON_PROPERTIES,
    { name: 'value',       label: 'Value',       category: 'Behavior',   editorType: 'text',     defaultValue: '' },
    { name: 'format',      label: 'Format',      category: 'Appearance', editorType: 'dropdown', defaultValue: 'Long', options: ['Long', 'Short', 'Time', 'Custom'] },
    { name: 'customFormat', label: 'CustomFormat', category: 'Appearance', editorType: 'text',   defaultValue: '' },
    { name: 'showUpDown',  label: 'ShowUpDown',  category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
    { name: 'showCheckBox', label: 'ShowCheckBox', category: 'Behavior', editorType: 'boolean',  defaultValue: false },
  ],

  ProgressBar: [
    ...COMMON_PROPERTIES,
    { name: 'value',       label: 'Value',       category: 'Behavior',   editorType: 'number', defaultValue: 0, min: 0, max: 100 },
    { name: 'minimum',     label: 'Minimum',     category: 'Behavior',   editorType: 'number', defaultValue: 0 },
    { name: 'maximum',     label: 'Maximum',     category: 'Behavior',   editorType: 'number', defaultValue: 100 },
    { name: 'step',        label: 'Step',        category: 'Behavior',   editorType: 'number', defaultValue: 10, min: 1 },
    { name: 'style',       label: 'Style',       category: 'Appearance', editorType: 'dropdown', defaultValue: 'Blocks', options: ['Blocks', 'Continuous', 'Marquee'] },
  ],

  PictureBox: [
    ...COMMON_PROPERTIES,
    { name: 'imageUrl',    label: 'ImageUrl',    category: 'Appearance', editorType: 'text',     defaultValue: '' },
    { name: 'sizeMode',    label: 'SizeMode',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'Normal', options: ['Normal', 'StretchImage', 'AutoSize', 'CenterImage', 'Zoom'] },
    { name: 'borderStyle', label: 'BorderStyle', category: 'Appearance', editorType: 'dropdown', defaultValue: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ],

  Panel: [
    ...COMMON_PROPERTIES,
    { name: 'borderStyle', label: 'BorderStyle', category: 'Appearance', editorType: 'dropdown', defaultValue: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
    { name: 'autoScroll',  label: 'AutoScroll',  category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  ],

  GroupBox: [
    ...COMMON_PROPERTIES,
    { name: 'text',        label: 'Text',        category: 'Appearance', editorType: 'text',     defaultValue: 'GroupBox' },
    { name: 'flatStyle',   label: 'FlatStyle',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Standard', options: ['Flat', 'Popup', 'Standard', 'System'] },
  ],

  TabControl: [
    ...COMMON_PROPERTIES,
    { name: 'tabPages',      label: 'TabPages',      category: 'Behavior',   editorType: 'collection', defaultValue: ['TabPage1', 'TabPage2'] },
    { name: 'selectedIndex', label: 'SelectedIndex', category: 'Behavior',   editorType: 'number',     defaultValue: 0, min: 0 },
    { name: 'alignment',     label: 'Alignment',     category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Top', options: ['Top', 'Bottom', 'Left', 'Right'] },
  ],

  SplitContainer: [
    ...COMMON_PROPERTIES,
    { name: 'orientation',      label: 'Orientation',      category: 'Layout',     editorType: 'dropdown', defaultValue: 'Vertical', options: ['Horizontal', 'Vertical'] },
    { name: 'splitterDistance',  label: 'SplitterDistance',  category: 'Layout',     editorType: 'number',   defaultValue: 50, min: 0 },
    { name: 'fixedPanel',       label: 'FixedPanel',       category: 'Layout',     editorType: 'dropdown', defaultValue: 'None', options: ['None', 'Panel1', 'Panel2'] },
    { name: 'isSplitterFixed',  label: 'IsSplitterFixed',  category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  ],

  // --- Phase 2/3 컨트롤 (최소 메타, 해당 컨트롤 구현 시 확장) ---
  DataGridView:     [...COMMON_PROPERTIES],
  BindingNavigator:  [...COMMON_PROPERTIES],
  Chart:            [...COMMON_PROPERTIES],
  TreeView:         [...COMMON_PROPERTIES],
  ListView:         [...COMMON_PROPERTIES],
  MenuStrip:        [...COMMON_PROPERTIES],
  ToolStrip:        [...COMMON_PROPERTIES],
  StatusStrip:      [...COMMON_PROPERTIES],
  RichTextBox:      [...COMMON_PROPERTIES],
  WebBrowser:       [...COMMON_PROPERTIES],
};
```

### 3.4 CONTROL_EVENTS_META

`@webform/common`의 `COMMON_EVENTS`와 `CONTROL_EVENTS`를 활용하여 컨트롤별 이벤트 목록을 구성한다.

```typescript
import { COMMON_EVENTS, CONTROL_EVENTS } from '@webform/common';

export function getEventsForControl(type: ControlType): string[] {
  const common = [...COMMON_EVENTS];
  const specific = CONTROL_EVENTS[type] ?? [];
  return [...specific, ...common];
}

export function getEventsForForm(): string[] {
  return [...FORM_EVENTS];
}
```

**설계 근거**:
- `COMMON_EVENTS`, `CONTROL_EVENTS`는 `@webform/common/types/events.ts`에 이미 정의되어 있으므로, 중복 정의하지 않고 import하여 사용한다.
- 컨트롤별 고유 이벤트를 먼저 표시하고, 공통 이벤트를 뒤에 배치한다. WinForm의 이벤트 탭도 동일한 순서를 사용한다.

### 3.5 폼 속성 메타데이터 — FORM_PROPERTY_META

컨트롤이 선택되지 않았을 때 표시할 폼 속성:

```typescript
export const FORM_PROPERTY_META: PropertyMeta[] = [
  // --- Design ---
  { name: 'title',           label: 'Text',             category: 'Design',     editorType: 'text',     defaultValue: 'Form1' },

  // --- Appearance ---
  { name: 'backgroundColor', label: 'BackColor',        category: 'Appearance', editorType: 'color',    defaultValue: '#F0F0F0' },
  { name: 'font',            label: 'Font',             category: 'Appearance', editorType: 'font',     defaultValue: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false } },
  { name: 'formBorderStyle', label: 'FormBorderStyle',  category: 'Appearance', editorType: 'dropdown', defaultValue: 'Sizable', options: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'] },

  // --- Behavior ---
  { name: 'maximizeBox',     label: 'MaximizeBox',      category: 'Behavior',   editorType: 'boolean',  defaultValue: true },
  { name: 'minimizeBox',     label: 'MinimizeBox',      category: 'Behavior',   editorType: 'boolean',  defaultValue: true },
  { name: 'startPosition',   label: 'StartPosition',    category: 'Behavior',   editorType: 'dropdown', defaultValue: 'CenterScreen', options: ['CenterScreen', 'Manual', 'CenterParent'] },

  // --- Layout ---
  { name: 'width',           label: 'Width',            category: 'Layout',     editorType: 'number',   defaultValue: 800, min: 100 },
  { name: 'height',          label: 'Height',           category: 'Layout',     editorType: 'number',   defaultValue: 600, min: 100 },
];
```

---

## 4. 속성 에디터 컴포넌트 설계

### 4.1 공통 에디터 Props 인터페이스

```typescript
export interface EditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  meta: PropertyMeta;
}
```

모든 에디터는 이 인터페이스를 따른다. `PropertyCategory`가 `meta.editorType`에 따라 적절한 에디터를 선택 렌더링한다.

### 4.2 editors/TextEditor.tsx — 문자열 인라인 편집

```tsx
interface TextEditorProps extends EditorProps {
  value: string;
}

export function TextEditor({ value, onChange, meta }: TextEditorProps) {
  return (
    <input
      type="text"
      value={value as string ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}
```

- `<input type="text">`로 구현
- 변경 시마다 `onChange` 호출 (debounce 없음 — 즉각 반영)
- `meta.name`이 `'name'`인 경우, 빈 문자열 방지 및 중복 이름 검증은 `PropertyPanel` 레벨에서 처리

### 4.3 editors/NumberEditor.tsx — 숫자 입력

```tsx
export function NumberEditor({ value, onChange, meta }: EditorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (isNaN(num)) return;

    // min/max 제한
    const clamped = Math.max(
      meta.min ?? -Infinity,
      Math.min(meta.max ?? Infinity, num)
    );
    onChange(clamped);
  };

  return (
    <input
      type="number"
      value={value as number ?? 0}
      onChange={handleChange}
      min={meta.min}
      max={meta.max}
      style={inputStyle}
    />
  );
}
```

- `<input type="number">`로 구현
- `meta.min`, `meta.max` 적용
- `NaN` 입력 무시

### 4.4 editors/ColorPicker.tsx — HTML color input

```tsx
export function ColorPicker({ value, onChange }: EditorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="color"
        value={value as string ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 24, height: 24, padding: 0, border: 'none', cursor: 'pointer' }}
      />
      <input
        type="text"
        value={value as string ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
        maxLength={7}
      />
    </div>
  );
}
```

- 색상 스워치(`type="color"`)와 텍스트 입력을 병행 표시
- 텍스트로 직접 hex 코드 입력 가능

### 4.5 editors/FontPicker.tsx — 폰트 선택기

```tsx
interface FontValue {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

const FONT_FAMILIES = [
  'Segoe UI', 'Arial', 'Times New Roman', 'Courier New',
  'Verdana', 'Tahoma', 'Georgia', 'Trebuchet MS',
];

export function FontPicker({ value, onChange }: EditorProps) {
  const font = value as FontValue;

  const update = (patch: Partial<FontValue>) => {
    onChange({ ...font, ...patch });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Family 선택 */}
      <select
        value={font.family}
        onChange={(e) => update({ family: e.target.value })}
        style={selectStyle}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Size + Bold + Italic */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="number"
          value={font.size}
          onChange={(e) => update({ size: parseFloat(e.target.value) || 9 })}
          min={6}
          max={72}
          style={{ ...inputStyle, width: 48 }}
        />
        <button
          onClick={() => update({ bold: !font.bold })}
          style={{ ...toggleButtonStyle, fontWeight: 'bold', ...(font.bold && activeStyle) }}
          title="Bold"
        >B</button>
        <button
          onClick={() => update({ italic: !font.italic })}
          style={{ ...toggleButtonStyle, fontStyle: 'italic', ...(font.italic && activeStyle) }}
          title="Italic"
        >I</button>
      </div>
    </div>
  );
}
```

- Family: `<select>` 드롭다운 (사전 정의 목록)
- Size: `<input type="number">`
- Bold/Italic: 토글 버튼 (`B`, `I`)
- Underline/Strikethrough: 일단 기본 속성값만 유지, UI는 생략 (필요 시 확장)

### 4.6 editors/DropdownEditor.tsx — 열거형 선택

```tsx
export function DropdownEditor({ value, onChange, meta }: EditorProps) {
  return (
    <select
      value={value as string ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={selectStyle}
    >
      {(meta.options ?? []).map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}
```

- `meta.options` 배열 기반
- `<select>` HTML 네이티브 요소 사용

### 4.7 editors/BooleanToggle.tsx — 불리언 토글

```tsx
export function BooleanToggle({ value, onChange }: EditorProps) {
  return (
    <input
      type="checkbox"
      checked={value as boolean ?? false}
      onChange={(e) => onChange(e.target.checked)}
      style={{ cursor: 'pointer' }}
    />
  );
}
```

- `<input type="checkbox">`
- 클릭 시 `onChange(!value)` 호출

### 4.8 editors/AnchorEditor.tsx — 4방향 시각적 앵커 UI

WinForm의 Anchor 편집기를 재현한다. 중앙 사각형을 둘러싼 4방향 막대로 Top/Bottom/Left/Right 앵커를 시각적으로 표시하고 토글한다.

```tsx
import type { AnchorStyle } from '@webform/common';

export function AnchorEditor({ value, onChange }: EditorProps) {
  const anchor = value as AnchorStyle;

  const toggle = (direction: keyof AnchorStyle) => {
    onChange({ ...anchor, [direction]: !anchor[direction] });
  };

  return (
    <div style={containerStyle}>
      {/*
        시각적 레이아웃:
        ┌───────────────┐
        │     [Top]     │
        │ [L] [■■■] [R] │
        │   [Bottom]    │
        └───────────────┘
      */}
      <div style={anchorGridStyle}>
        {/* Top bar */}
        <div style={topBarPos}>
          <div
            onClick={() => toggle('top')}
            style={{
              ...barHorizontalStyle,
              backgroundColor: anchor.top ? '#0078D7' : '#CCC',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Left bar */}
        <div style={leftBarPos}>
          <div
            onClick={() => toggle('left')}
            style={{
              ...barVerticalStyle,
              backgroundColor: anchor.left ? '#0078D7' : '#CCC',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Center square (컨트롤 표현) */}
        <div style={centerSquareStyle} />

        {/* Right bar */}
        <div style={rightBarPos}>
          <div
            onClick={() => toggle('right')}
            style={{
              ...barVerticalStyle,
              backgroundColor: anchor.right ? '#0078D7' : '#CCC',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Bottom bar */}
        <div style={bottomBarPos}>
          <div
            onClick={() => toggle('bottom')}
            style={{
              ...barHorizontalStyle,
              backgroundColor: anchor.bottom ? '#0078D7' : '#CCC',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

**시각적 구조**:
- 60×60px 그리드 내 5개 영역: Top(막대), Left(막대), Center(사각형), Right(막대), Bottom(막대)
- 활성 앵커: 파란색(#0078D7), 비활성: 회색(#CCC)
- 클릭으로 각 방향 토글
- CSS Grid 레이아웃: `grid-template: "_ top _" / "left center right" / "_ bottom _"`

### 4.9 editors/CollectionEditor.tsx — 배열 아이템 모달

```tsx
interface CollectionEditorProps extends EditorProps {
  value: unknown[];
}

export function CollectionEditor({ value, onChange, meta }: CollectionEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);

  const handleOpen = () => {
    setItems((value as string[]) ?? []);
    setIsOpen(true);
  };

  const handleSave = () => {
    onChange(items);
    setIsOpen(false);
  };

  return (
    <>
      {/* 트리거 버튼 */}
      <button onClick={handleOpen} style={collectionButtonStyle}>
        ({(value as unknown[])?.length ?? 0}개 항목) ...
      </button>

      {/* 모달 */}
      {isOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <span>{meta.label} 편집</span>
              <button onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              {/* 아이템 목록 */}
              {items.map((item, index) => (
                <div key={index} style={itemRowStyle}>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = e.target.value;
                      setItems(next);
                    }}
                    style={inputStyle}
                  />
                  <button onClick={() => {
                    setItems(items.filter((_, i) => i !== index));
                  }}>삭제</button>
                </div>
              ))}

              {/* 추가 버튼 */}
              <button onClick={() => setItems([...items, ''])}>
                + 항목 추가
              </button>
            </div>

            {/* 순서 변경: 위/아래 버튼 */}
            <div style={modalFooterStyle}>
              <button onClick={handleSave}>확인</button>
              <button onClick={() => setIsOpen(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**기능**:
- 트리거: `(N개 항목) ...` 버튼 표시
- 모달: 아이템 목록 + 텍스트 입력 + 추가/삭제
- 확인 시 `onChange(items)` 호출
- 취소 시 변경사항 버림

---

## 5. PropertyCategory 컴포넌트 설계

### 5.1 역할

카테고리 헤더(접기/펼치기)와 해당 카테고리 속성들의 에디터를 렌더링한다.

### 5.2 구조

```tsx
interface PropertyCategoryProps {
  category: PropertyCategory;
  properties: PropertyMeta[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

export function PropertyCategory({ category, properties, values, onChange }: PropertyCategoryProps) {
  const [collapsed, setCollapsed] = useState(false);

  // editorType → 에디터 컴포넌트 매핑
  const editorMap: Record<EditorType, ComponentType<EditorProps>> = {
    text: TextEditor,
    number: NumberEditor,
    color: ColorPicker,
    font: FontPicker,
    dropdown: DropdownEditor,
    boolean: BooleanToggle,
    anchor: AnchorEditor,
    collection: CollectionEditor,
  };

  return (
    <div>
      {/* 카테고리 헤더 */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={categoryHeaderStyle}
      >
        <span>{collapsed ? '▶' : '▼'} {category}</span>
      </div>

      {/* 속성 행 목록 */}
      {!collapsed && properties.map((meta) => {
        const Editor = editorMap[meta.editorType];
        return (
          <div key={meta.name} style={propertyRowStyle}>
            <div style={labelColumnStyle} title={meta.label}>
              {meta.label}
            </div>
            <div style={editorColumnStyle}>
              <Editor
                value={values[meta.name] ?? meta.defaultValue}
                onChange={(v) => onChange(meta.name, v)}
                meta={meta}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**레이아웃**:
- 2열 구조: 왼쪽(속성 이름 ~40%), 오른쪽(에디터 ~60%)
- WinForm Properties Window의 전형적인 레이아웃을 따른다
- 카테고리 헤더 클릭으로 접기/펼치기

---

## 6. PropertyPanel 컴포넌트 설계

### 6.1 역할

속성 패널의 메인 컨테이너. `selectionStore`와 `designerStore`를 구독하여:
1. 선택된 컨트롤이 있으면 해당 컨트롤의 속성을 표시
2. 선택 없으면 FormProperties를 표시
3. 속성 탭 / 이벤트 탭 전환
4. 카테고리순 / 알파벳순 정렬 토글

### 6.2 구조

```tsx
type SortMode = 'category' | 'alphabetical';
type TabMode = 'properties' | 'events';

export function PropertyPanel() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const updateControl = useDesignerStore((s) => s.updateControl);
  const setFormProperties = useDesignerStore((s) => s.setFormProperties);

  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [tab, setTab] = useState<TabMode>('properties');

  // 선택된 컨트롤 찾기 (단일 선택만 지원, 다중 선택 시 첫 번째)
  const selectedControl = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const firstId = [...selectedIds][0];
    return controls.find((c) => c.id === firstId) ?? null;
  }, [selectedIds, controls]);

  // 표시할 속성 메타데이터
  const propertyMetas = useMemo(() => {
    if (!selectedControl) return FORM_PROPERTY_META;
    return CONTROL_PROPERTY_META[selectedControl.type] ?? [];
  }, [selectedControl]);

  // 현재 속성값 맵 구성
  const currentValues = useMemo(() => {
    if (!selectedControl) {
      // FormProperties → Record<string, unknown> 변환
      return formProperties as unknown as Record<string, unknown>;
    }

    // ControlDefinition의 최상위 속성 + properties 서브 맵 병합
    return {
      name: selectedControl.name,
      x: selectedControl.position.x,
      y: selectedControl.position.y,
      width: selectedControl.size.width,
      height: selectedControl.size.height,
      anchor: selectedControl.anchor,
      dock: selectedControl.dock,
      tabIndex: selectedControl.tabIndex,
      visible: selectedControl.visible,
      enabled: selectedControl.enabled,
      ...selectedControl.properties,
    };
  }, [selectedControl, formProperties]);

  // 속성 변경 핸들러
  const handlePropertyChange = useCallback((name: string, value: unknown) => {
    if (!selectedControl) {
      // 폼 속성 업데이트
      setFormProperties({ [name]: value });
      return;
    }

    // ControlDefinition 최상위 속성 vs properties 서브맵 구분
    const topLevelProps = ['name', 'visible', 'enabled', 'tabIndex', 'anchor', 'dock'];
    const positionProps = ['x', 'y'];
    const sizeProps = ['width', 'height'];

    if (positionProps.includes(name)) {
      const position = { ...selectedControl.position };
      if (name === 'x') position.x = value as number;
      if (name === 'y') position.y = value as number;
      updateControl(selectedControl.id, { position });
    } else if (sizeProps.includes(name)) {
      const size = { ...selectedControl.size };
      if (name === 'width') size.width = value as number;
      if (name === 'height') size.height = value as number;
      updateControl(selectedControl.id, { size });
    } else if (topLevelProps.includes(name)) {
      updateControl(selectedControl.id, { [name]: value });
    } else {
      // properties 서브맵
      updateControl(selectedControl.id, {
        properties: { ...selectedControl.properties, [name]: value },
      });
    }
  }, [selectedControl, updateControl, setFormProperties]);

  // 정렬 적용
  const sortedMetas = useMemo(() => {
    if (sortMode === 'alphabetical') {
      return [...propertyMetas].sort((a, b) => a.label.localeCompare(b.label));
    }
    return propertyMetas; // category 순서 유지 (정의 순서)
  }, [propertyMetas, sortMode]);

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const categoryOrder: PropertyCategory[] = ['Design', 'Appearance', 'Behavior', 'Layout'];
    const groups = new Map<PropertyCategory, PropertyMeta[]>();

    for (const cat of categoryOrder) {
      const items = sortedMetas.filter((m) => m.category === cat);
      if (items.length > 0) groups.set(cat, items);
    }
    return groups;
  }, [sortedMetas]);

  // --- 컨트롤/폼 정보 헤더 ---
  const headerText = selectedControl
    ? `${selectedControl.name} (${selectedControl.type})`
    : 'Form Properties';

  return (
    <div style={panelStyle}>
      {/* 컨트롤 정보 드롭다운 (향후 검색 가능) */}
      <div style={controlHeaderStyle}>
        {headerText}
      </div>

      {/* 툴바: 정렬 토글 + 탭 전환 */}
      <div style={toolbarStyle}>
        <button
          onClick={() => setSortMode(sortMode === 'category' ? 'alphabetical' : 'category')}
          title={sortMode === 'category' ? '알파벳순 정렬' : '카테고리순 정렬'}
          style={toolbarButtonStyle}
        >
          {sortMode === 'category' ? 'AZ' : '▤'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setTab('properties')}
          style={{ ...toolbarButtonStyle, ...(tab === 'properties' && activeTabStyle) }}
          title="속성"
        >
          ▤
        </button>
        <button
          onClick={() => setTab('events')}
          style={{ ...toolbarButtonStyle, ...(tab === 'events' && activeTabStyle) }}
          title="이벤트"
        >
          ⚡
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div style={contentStyle}>
        {tab === 'properties' ? (
          sortMode === 'category' ? (
            // 카테고리별 표시
            [...grouped.entries()].map(([category, metas]) => (
              <PropertyCategory
                key={category}
                category={category}
                properties={metas}
                values={currentValues}
                onChange={handlePropertyChange}
              />
            ))
          ) : (
            // 알파벳순 단일 목록
            <PropertyCategory
              category={'All' as PropertyCategory}
              properties={sortedMetas}
              values={currentValues}
              onChange={handlePropertyChange}
            />
          )
        ) : (
          <EventsTab
            controlType={selectedControl?.type ?? null}
            controlId={selectedControl?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}
```

### 6.3 속성값 해석 — ControlDefinition과 PropertyMeta 매핑

`ControlDefinition`은 속성이 여러 레벨에 분산되어 있다:

| PropertyMeta.name | ControlDefinition 접근 경로 |
|-------------------|----------------------------|
| `name` | `control.name` |
| `x`, `y` | `control.position.x`, `control.position.y` |
| `width`, `height` | `control.size.width`, `control.size.height` |
| `anchor` | `control.anchor` |
| `dock` | `control.dock` |
| `tabIndex` | `control.tabIndex` |
| `visible` | `control.visible` |
| `enabled` | `control.enabled` |
| `text`, `backColor`, ... | `control.properties['text']`, `control.properties['backColor']`, ... |

`handlePropertyChange`에서 이 매핑을 처리하여, 에디터가 단순히 `name`과 `value`만 전달하면 올바른 경로로 업데이트된다.

---

## 7. EventsTab 컴포넌트 설계

### 7.1 역할

선택된 컨트롤의 이벤트 목록을 표시하고, 각 이벤트에 대한 핸들러 이름을 입력/편집한다.

### 7.2 구조

```tsx
interface EventsTabProps {
  controlType: ControlType | null;
  controlId: string | null;
}

export function EventsTab({ controlType, controlId }: EventsTabProps) {
  const eventHandlers = useDesignerStore((s) => {
    // FormDefinition에서 현재 컨트롤의 이벤트 핸들러 조회
    // 주: eventHandlers는 designerStore에 추가 필요
    return s.eventHandlers?.filter((h) => h.controlId === controlId) ?? [];
  });

  const [editingEvent, setEditingEvent] = useState<{
    eventName: string;
    handlerType: 'server' | 'client';
  } | null>(null);

  // 이벤트 목록
  const events = useMemo(() => {
    if (!controlType) return getEventsForForm();
    return getEventsForControl(controlType);
  }, [controlType]);

  // 핸들러 이름 맵
  const handlerMap = useMemo(() => {
    const map = new Map<string, EventHandlerDefinition>();
    for (const handler of eventHandlers) {
      map.set(handler.eventName, handler);
    }
    return map;
  }, [eventHandlers]);

  const handleDoubleClick = (eventName: string) => {
    // EventEditor 모달 열기
    setEditingEvent({ eventName, handlerType: 'server' });
  };

  return (
    <div>
      {events.map((eventName) => {
        const handler = handlerMap.get(eventName);
        const handlerName = handler
          ? `${controlId}_${eventName}`
          : '';

        return (
          <div
            key={eventName}
            style={eventRowStyle}
            onDoubleClick={() => handleDoubleClick(eventName)}
          >
            <div style={eventNameStyle}>
              {eventName}
            </div>
            <div style={handlerNameStyle}>
              <input
                type="text"
                value={handlerName}
                placeholder="(없음)"
                readOnly
                style={handlerInputStyle}
              />
            </div>
          </div>
        );
      })}

      {/* EventEditor 모달 */}
      {editingEvent && controlId && (
        <EventEditor
          controlId={controlId}
          eventName={editingEvent.eventName}
          handlerType={editingEvent.handlerType}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
```

**동작**:
1. 이벤트 목록을 2열로 표시: 이벤트 이름 | 핸들러 이름
2. 더블클릭 시 `EventEditor` 모달이 열린다
3. 핸들러 이름은 자동 생성: `{controlName}_{eventName}` (e.g., `button1_Click`)
4. 폼 선택 시(`controlType === null`) 폼 이벤트(Load, Shown 등)를 표시

---

## 8. EventEditor 컴포넌트 설계

### 8.1 역할

Monaco Editor를 통해 이벤트 핸들러 코드를 편집한다.

### 8.2 구조

```tsx
import Editor from '@monaco-editor/react';

interface EventEditorProps {
  controlId: string;
  eventName: string;
  handlerType: 'server' | 'client';
  onClose: () => void;
}

export function EventEditor({ controlId, eventName, handlerType, onClose }: EventEditorProps) {
  const { eventHandlers, updateEventHandler, addEventHandler } = useDesignerStore();

  // 기존 핸들러 코드 조회
  const existing = eventHandlers?.find(
    (h) => h.controlId === controlId && h.eventName === eventName
  );

  const [code, setCode] = useState(
    existing?.handlerCode ?? generateDefaultHandler(controlId, eventName)
  );

  // Ctrl+S 저장
  const handleSave = () => {
    const handler: EventHandlerDefinition = {
      controlId,
      eventName,
      handlerType,
      handlerCode: code,
    };

    if (existing) {
      updateEventHandler(controlId, eventName, handler);
    } else {
      addEventHandler(handler);
    }
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    // FormContext 타입 힌트 추가
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      FORM_CONTEXT_TYPE_DEFINITION,
      'ts:formcontext.d.ts'
    );

    // Ctrl+S 키바인딩
    editor.addAction({
      id: 'save-handler',
      label: 'Save Handler',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={editorModalStyle}>
        {/* 헤더 */}
        <div style={editorHeaderStyle}>
          <span>{controlId}_{eventName}</span>
          <div>
            <select
              value={handlerType}
              onChange={(e) => { /* handlerType 변경 */ }}
            >
              <option value="server">Server</option>
              <option value="client">Client</option>
            </select>
            <button onClick={handleSave}>저장</button>
            <button onClick={onClose}>닫기</button>
          </div>
        </div>

        {/* Monaco Editor */}
        <Editor
          height="400px"
          language="typescript"
          theme="vs-dark"
          value={code}
          onChange={(v) => setCode(v ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
```

### 8.3 FormContext 타입 힌트

Monaco Editor에 `addExtraLib`로 타입 정의를 주입하여 IntelliSense를 제공한다:

```typescript
const FORM_CONTEXT_TYPE_DEFINITION = `
interface ControlProxy {
  [property: string]: any;
  text: string;
  visible: boolean;
  enabled: boolean;
  backColor: string;
  foreColor: string;
}

interface CollectionProxy {
  find(filter?: Record<string, any>): Promise<any[]>;
  findOne(filter?: Record<string, any>): Promise<any | null>;
  insertOne(doc: Record<string, any>): Promise<{ insertedId: string }>;
  updateOne(filter: Record<string, any>, update: Record<string, any>): Promise<{ modifiedCount: number }>;
  deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }>;
}

interface DataSourceProxy {
  collection(name: string): CollectionProxy;
}

interface FormContext {
  formId: string;
  controls: Record<string, ControlProxy>;
  dataSources: Record<string, DataSourceProxy>;
  showDialog(formName: string, params?: Record<string, any>): Promise<{ dialogResult: 'OK' | 'Cancel'; data: Record<string, any> }>;
  navigate(formName: string, params?: Record<string, any>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
}

interface EventArgs {
  type: string;
  timestamp: number;
  [key: string]: any;
}

declare const sender: any;
declare const e: EventArgs;
declare const ctx: FormContext;
`;
```

### 8.4 기본 핸들러 코드 생성

```typescript
function generateDefaultHandler(controlId: string, eventName: string): string {
  return `async function ${controlId}_${eventName}(sender: any, e: EventArgs, ctx: FormContext) {
  // TODO: 이벤트 핸들러 구현
}`;
}
```

---

## 9. designerStore 확장

이벤트 탭을 지원하기 위해 `designerStore`에 이벤트 핸들러 관련 상태와 액션을 추가한다.

```typescript
// designerStore.ts에 추가
interface DesignerState {
  // ... 기존 상태 ...
  eventHandlers: EventHandlerDefinition[];

  // ... 기존 액션 ...
  addEventHandler: (handler: EventHandlerDefinition) => void;
  updateEventHandler: (controlId: string, eventName: string, handler: EventHandlerDefinition) => void;
  removeEventHandler: (controlId: string, eventName: string) => void;
}

// 구현
addEventHandler: (handler) => set((state) => {
  state.eventHandlers.push(handler);
  state.isDirty = true;
}),

updateEventHandler: (controlId, eventName, handler) => set((state) => {
  const index = state.eventHandlers.findIndex(
    (h) => h.controlId === controlId && h.eventName === eventName
  );
  if (index !== -1) {
    state.eventHandlers[index] = handler;
  } else {
    state.eventHandlers.push(handler);
  }
  state.isDirty = true;
}),

removeEventHandler: (controlId, eventName) => set((state) => {
  state.eventHandlers = state.eventHandlers.filter(
    (h) => !(h.controlId === controlId && h.eventName === eventName)
  );
  state.isDirty = true;
}),
```

**설계 근거**:
- `eventHandlers`를 `designerStore`에 배치하여 `controls`와 함께 직렬화/역직렬화한다.
- `FormDefinition.eventHandlers`와 동일한 `EventHandlerDefinition[]` 구조를 사용한다.
- `loadForm` 시 `eventHandlers`도 함께 로드한다.

---

## 10. App.tsx 수정

기존 placeholder를 실제 `PropertyPanel` 컴포넌트로 교체한다:

```tsx
// App.tsx (수정 부분만)
import { PropertyPanel } from './components/PropertyPanel';

// 기존:
// <div className="properties-panel" style={{ width: 250, borderLeft: '1px solid #ccc' }}>
//   Properties
// </div>

// 변경:
<div className="properties-panel" style={{ width: 280, borderLeft: '1px solid #ccc', overflow: 'auto' }}>
  <PropertyPanel />
</div>
```

- 패널 너비를 250px → 280px로 확대 (에디터 공간 확보)
- `overflow: auto`로 속성 목록이 길 때 스크롤 가능

---

## 11. CSS 스타일 가이드

인라인 스타일로 구현한다. WinForm Properties Window의 룩앤필을 최대한 재현한다.

### 주요 스타일 상수

```typescript
// 패널 전체
const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontSize: 12,
  fontFamily: 'Segoe UI, sans-serif',
};

// 컨트롤 정보 헤더
const controlHeaderStyle: CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #ccc',
  fontWeight: 'bold',
  backgroundColor: '#F5F5F5',
};

// 툴바
const toolbarStyle: CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: '2px 4px',
  borderBottom: '1px solid #ccc',
  backgroundColor: '#F5F5F5',
};

// 카테고리 헤더
const categoryHeaderStyle: CSSProperties = {
  padding: '4px 8px',
  backgroundColor: '#E8E8E8',
  fontWeight: 'bold',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid #ccc',
};

// 속성 행
const propertyRowStyle: CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #eee',
  minHeight: 24,
  alignItems: 'center',
};

// 속성 이름 열
const labelColumnStyle: CSSProperties = {
  width: '40%',
  padding: '2px 8px',
  borderRight: '1px solid #eee',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// 에디터 열
const editorColumnStyle: CSSProperties = {
  width: '60%',
  padding: '2px 4px',
};

// 공통 input 스타일
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '1px 4px',
  border: '1px solid #ccc',
  fontSize: 12,
  fontFamily: 'Segoe UI, sans-serif',
  boxSizing: 'border-box',
};
```

---

## 12. 구현 순서

| 순서 | 파일 | 의존 관계 |
|------|------|----------|
| 1 | `PropertyPanel/controlProperties.ts` | `@webform/common` 타입 |
| 2 | `PropertyPanel/editors/TextEditor.tsx` | EditorProps |
| 3 | `PropertyPanel/editors/NumberEditor.tsx` | EditorProps |
| 4 | `PropertyPanel/editors/ColorPicker.tsx` | EditorProps |
| 5 | `PropertyPanel/editors/FontPicker.tsx` | EditorProps |
| 6 | `PropertyPanel/editors/DropdownEditor.tsx` | EditorProps |
| 7 | `PropertyPanel/editors/BooleanToggle.tsx` | EditorProps |
| 8 | `PropertyPanel/editors/AnchorEditor.tsx` | EditorProps, AnchorStyle |
| 9 | `PropertyPanel/editors/CollectionEditor.tsx` | EditorProps |
| 10 | `PropertyPanel/PropertyCategory.tsx` | 모든 에디터, PropertyMeta |
| 11 | `PropertyPanel/EventsTab.tsx` | controlProperties, designerStore |
| 12 | `PropertyPanel/PropertyPanel.tsx` | PropertyCategory, EventsTab, 양 스토어 |
| 13 | `PropertyPanel/index.ts` | 배럴 export |
| 14 | `stores/designerStore.ts` | 수정: eventHandlers 상태/액션 추가 |
| 15 | `EventEditor/EventEditor.tsx` | @monaco-editor/react, designerStore |
| 16 | `App.tsx` | 수정: PropertyPanel 통합 |

---

## 13. 의존성

이 태스크에서 사용하는 모든 의존성은 이미 `packages/designer/package.json`에 선언되어 있다.

| 패키지 | 용도 |
|--------|------|
| `react` | UI 프레임워크 |
| `zustand` / `immer` | 상태 관리 |
| `@monaco-editor/react` | 이벤트 코드 편집기 |
| `@webform/common` | 공통 타입 (ControlType, AnchorStyle, EventHandlerDefinition 등) |

추가 설치가 필요한 패키지: **없음**

---

## 14. 테스트 전략 (후속 `properties-panel-test` 태스크에서 구현)

| 테스트 파일 | 주요 테스트 케이스 |
|------------|-------------------|
| `controlProperties.test.ts` | 모든 ControlType에 CONTROL_PROPERTY_META 존재 확인, Button 속성에 `text`/`enabled`/`backColor` 포함, CONTROL_EVENTS에 `TextBox.TextChanged` 포함 |
| `PropertyPanel.test.tsx` | 선택 없을 때 폼 속성 표시, Button 선택 시 Button 속성 표시, 카테고리순/알파벳순 토글, 속성 탭/이벤트 탭 전환 |
| `NumberEditor.test.tsx` | 숫자 변경 시 onChange 콜백, min/max 제한 확인 |
| `AnchorEditor.test.tsx` | `{top:true, left:true}` → Top/Left 시각 활성화, Bottom 클릭 시 onChange 호출 |

---

## 15. 후속 태스크와의 연동

| 후속 태스크 | 이 태스크에서 제공하는 것 |
|------------|------------------------|
| `datasource-service` | `controlProperties.ts`에 Data 카테고리 속성 추가 포인트 |
| `sdui-renderer` | `controlProperties.ts`의 defaultValue를 런타임 초기값으로 참조 |
| `form-crud-api` | `designerStore.eventHandlers`를 FormDefinition 직렬화에 포함 |
| Phase 2/3 컨트롤 | `CONTROL_PROPERTY_META`에 DataGridView, TreeView 등 확장 |
