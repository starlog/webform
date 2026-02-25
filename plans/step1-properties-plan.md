# Step 1 PropertyMeta 구현 계획

> 6개 신규 컨트롤(Slider, Switch, Upload, Alert, Tag, Divider)의 PropertyMeta 정의를 `controlProperties.ts`에 추가

---

## 1. 현재 구조 요약

### 파일: `packages/designer/src/components/PropertyPanel/controlProperties.ts`

**핵심 타입**:
```ts
export type EditorType = 'text' | 'number' | 'color' | 'font' | 'dropdown' | 'boolean'
  | 'anchor' | 'collection' | 'tabEditor' | 'mongoColumns' | 'mongoConnectionString'
  | 'graphSample' | 'menuEditor' | 'toolStripEditor' | 'statusStripEditor';

export type PropertyCategory = 'Appearance' | 'Behavior' | 'Layout' | 'Design' | 'Data' | 'Sample';

export interface PropertyMeta {
  name: string;       // 점 표기법 (예: 'properties.text')
  label: string;      // UI 표시명
  category: PropertyCategory;
  editorType: EditorType;
  defaultValue?: unknown;
  options?: (string | { label: string; value: string })[];
  min?: number;
  max?: number;
}
```

**withCommon() 패턴**:
```ts
function withCommon(...extra: PropertyMeta[]): PropertyMeta[] {
  return [...COMMON_BEHAVIOR, ...extra, ...COMMON_LAYOUT];
}
```
- `COMMON_BEHAVIOR`: name, enabled, visible, tabIndex (Design + Behavior)
- `COMMON_LAYOUT`: position.x/y, size.width/height, anchor, dock (Layout)
- 고유 속성을 가운데에 배치하여 카테고리 정렬 유지

**등록 패턴**:
```ts
const xxxProps: PropertyMeta[] = withCommon(
  { name: 'properties.xxx', label: 'Xxx', category: '...', editorType: '...' },
  // ...
);

export const CONTROL_PROPERTY_META: Partial<Record<ControlType, PropertyMeta[]>> = {
  // ... 기존 29개
  Xxx: xxxProps,
};
```

---

## 2. 수정 위치

### 파일: `controlProperties.ts`

| 위치 | 작업 |
|------|------|
| 라인 ~330 (`defaultProps` 정의 뒤) | 6개 신규 컨트롤의 `xxxProps` 변수 정의 추가 |
| 라인 ~333-364 (`CONTROL_PROPERTY_META` 객체 내) | 6개 엔트리 추가 (마지막 `MongoDBConnector` 뒤) |

EditorType 추가 필요: **없음** — 사용할 에디터 타입은 모두 기존 정의에 포함 (`text`, `number`, `color`, `dropdown`, `boolean`, `collection`)

---

## 3. 컨트롤별 PropertyMeta 코드 스니펫

### 3.1 Slider

```ts
const sliderProps: PropertyMeta[] = withCommon(
  { name: 'properties.value',       label: 'Value',       category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
  { name: 'properties.minimum',     label: 'Minimum',     category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
  { name: 'properties.maximum',     label: 'Maximum',     category: 'Behavior',   editorType: 'number',   defaultValue: 100 },
  { name: 'properties.step',        label: 'Step',        category: 'Behavior',   editorType: 'number',   defaultValue: 1, min: 1 },
  { name: 'properties.orientation', label: 'Orientation', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Horizontal', options: ['Horizontal', 'Vertical'] },
  { name: 'properties.showValue',   label: 'ShowValue',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.trackColor',  label: 'TrackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.fillColor',   label: 'FillColor',   category: 'Appearance', editorType: 'color' },
);
```

**참고**: NumericUpDown과 유사한 value/minimum/maximum 패턴. ProgressBar처럼 시각적 표현이 주 목적.

---

### 3.2 Switch

```ts
const switchProps: PropertyMeta[] = withCommon(
  { name: 'properties.checked',  label: 'Checked',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.text',     label: 'Text',     category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.onText',   label: 'OnText',   category: 'Appearance', editorType: 'text',    defaultValue: 'ON' },
  { name: 'properties.offText',  label: 'OffText',  category: 'Appearance', editorType: 'text',    defaultValue: 'OFF' },
  { name: 'properties.onColor',  label: 'OnColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.offColor', label: 'OffColor', category: 'Appearance', editorType: 'color' },
);
```

**참고**: CheckBox와 유사한 `checked` + `text` 패턴. 고유 속성으로 onText/offText/onColor/offColor 추가.

---

### 3.3 Upload

```ts
const uploadProps: PropertyMeta[] = withCommon(
  { name: 'properties.uploadMode',  label: 'UploadMode',     category: 'Appearance', editorType: 'dropdown', defaultValue: 'DropZone', options: ['Button', 'DropZone'] },
  { name: 'properties.text',        label: 'Text',           category: 'Appearance', editorType: 'text',     defaultValue: 'Click or drag file to upload' },
  { name: 'properties.accept',      label: 'Accept',         category: 'Behavior',   editorType: 'text',     defaultValue: '' },
  { name: 'properties.multiple',    label: 'Multiple',       category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.maxFileSize', label: 'MaxFileSize(MB)', category: 'Behavior',  editorType: 'number',   defaultValue: 10, min: 1, max: 100 },
  { name: 'properties.maxCount',    label: 'MaxCount',       category: 'Behavior',   editorType: 'number',   defaultValue: 1, min: 1, max: 20 },
  { name: 'properties.backColor',   label: 'BackColor',      category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',   label: 'ForeColor',      category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderStyle', label: 'BorderStyle',    category: 'Appearance', editorType: 'dropdown', defaultValue: 'Dashed', options: ['None', 'Solid', 'Dashed'] },
);
```

**참고**: 속성이 9개로 가장 많음. `accept`는 MIME 타입 문자열 (예: `image/*,.pdf`).

---

### 3.4 Alert

```ts
const alertProps: PropertyMeta[] = withCommon(
  { name: 'properties.message',     label: 'Message',     category: 'Appearance', editorType: 'text',     defaultValue: 'Alert message' },
  { name: 'properties.description', label: 'Description', category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.alertType',   label: 'AlertType',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Info', options: ['Success', 'Info', 'Warning', 'Error'] },
  { name: 'properties.showIcon',    label: 'ShowIcon',    category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.closable',    label: 'Closable',    category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.banner',      label: 'Banner',      category: 'Appearance', editorType: 'boolean',  defaultValue: false },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
);
```

**참고**: `alertType` dropdown이 배경색/테두리색/아이콘을 결정하는 핵심 속성. Designer/Runtime 모두에서 alertType별 스타일 맵을 참조해야 함.

---

### 3.5 Tag

```ts
const tagProps: PropertyMeta[] = withCommon(
  { name: 'properties.tags',     label: 'Tags',     category: 'Data',       editorType: 'collection', defaultValue: ['Tag1', 'Tag2'] },
  { name: 'properties.tagColor', label: 'TagColor', category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Default', options: ['Default', 'Blue', 'Green', 'Red', 'Orange', 'Purple', 'Cyan', 'Gold'] },
  { name: 'properties.closable', label: 'Closable', category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.addable',  label: 'Addable',  category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);
```

**참고**: `tags`는 문자열 배열. 기존 `collection` 에디터(ComboBox의 items와 동일 패턴) 재사용. `tagColor` dropdown으로 전체 태그 색상 일괄 지정.

---

### 3.6 Divider

```ts
const dividerProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',        label: 'Text',        category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.orientation', label: 'Orientation', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Horizontal', options: ['Horizontal', 'Vertical'] },
  { name: 'properties.textAlign',   label: 'TextAlign',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Center', options: ['Left', 'Center', 'Right'] },
  { name: 'properties.lineStyle',   label: 'LineStyle',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Solid', options: ['Solid', 'Dashed', 'Dotted'] },
  { name: 'properties.lineColor',   label: 'LineColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
);
```

**참고**: 순수 표시 컨트롤. 고유 이벤트 없음. `text`가 비어 있으면 단순 선, 있으면 텍스트 양옆으로 선 분리.

---

## 4. CONTROL_PROPERTY_META 등록

`CONTROL_PROPERTY_META` 객체 내 `MongoDBConnector: mongoDBConnectorProps` 뒤에 다음 추가:

```ts
export const CONTROL_PROPERTY_META: Partial<Record<ControlType, PropertyMeta[]>> = {
  // ... 기존 29개 ...
  MongoDBConnector: mongoDBConnectorProps,
  // ── Step 1 신규 컨트롤 ──
  Slider:  sliderProps,
  Switch:  switchProps,
  Upload:  uploadProps,
  Alert:   alertProps,
  Tag:     tagProps,
  Divider: dividerProps,
};
```

---

## 5. 속성 분류 요약

| 컨트롤 | Appearance | Behavior | Data | 고유 속성 수 | 총 속성 수 (공통 포함) |
|--------|------------|----------|------|-------------|----------------------|
| Slider | orientation, showValue, trackColor, fillColor | value, minimum, maximum, step | — | 8 | 18 |
| Switch | text, onText, offText, onColor, offColor | checked | — | 6 | 16 |
| Upload | uploadMode, text, backColor, foreColor, borderStyle | accept, multiple, maxFileSize, maxCount | — | 9 | 19 |
| Alert | message, description, alertType, showIcon, banner, foreColor | closable | — | 7 | 17 |
| Tag | tagColor, foreColor | closable, addable | tags | 5 | 15 |
| Divider | text, orientation, textAlign, lineStyle, lineColor, foreColor | — | — | 6 | 16 |

---

## 6. 기존 패턴과의 일관성 확인

| 항목 | 기존 패턴 | 신규 컨트롤 적용 |
|------|----------|-----------------|
| `name` 접두사 | `properties.xxx` | 동일 |
| `label` 네이밍 | PascalCase | 동일 |
| color 속성 | `defaultValue` 없음 (테마에서 결정) | 동일 (trackColor, fillColor, onColor 등) |
| dropdown `options` | 문자열 배열 | 동일 |
| boolean `defaultValue` | 명시적 지정 | 동일 |
| number `min/max` | 필요 시만 지정 | 동일 (step min:1, maxFileSize min:1/max:100 등) |
| collection | ComboBox items, DataGridView columns | Tag의 tags에 동일 패턴 적용 |

---

## 7. 구현 순서

1. `controlProperties.ts`에 6개 `xxxProps` 변수 선언 (라인 ~320 이후, `defaultProps` 바로 위)
2. `CONTROL_PROPERTY_META` 객체에 6개 엔트리 추가
3. `pnpm typecheck` 실행하여 타입 오류 없는지 확인
4. Designer 실행하여 각 컨트롤 선택 시 PropertyPanel에 속성 목록이 올바르게 표시되는지 확인

---

## 8. 의존성

- **선행 작업**: `common-types-impl` (form.ts에 6개 ControlType이 이미 등록되어 있어야 함)
- **병렬 가능**: `step1-designer` (Designer 컨트롤 컴포넌트 생성), `step1-runtime` (Runtime 컨트롤 생성)과 독립적으로 수행 가능 — 서로 다른 파일을 수정
- **후속 작업**: 통합 테스트에서 Toolbox → Canvas 배치 → PropertyPanel 속성 편집 흐름 검증
