# Step 2 PropertyMeta 구현 계획

> 6개 신규 컨트롤(Card, Badge, Avatar, Tooltip, Collapse, Statistic)의 PropertyMeta 정의를 `controlProperties.ts`에 추가

---

## 1. 현재 구조 요약

### 파일: `packages/designer/src/components/PropertyPanel/controlProperties.ts`

Step 1 완료 후 현재 상태:
- **EditorType**: 16종 정의 (`text`, `number`, `color`, `font`, `dropdown`, `boolean`, `anchor`, `collection`, `tabEditor`, `mongoColumns`, `mongoConnectionString`, `graphSample`, `menuEditor`, `toolStripEditor`, `statusStripEditor`)
- **PropertyCategory**: 6종 (`Appearance`, `Behavior`, `Layout`, `Design`, `Data`, `Sample`)
- **등록된 컨트롤**: 35개 (기존 29개 + Step 1 6개: Slider, Switch, Upload, Alert, Tag, Divider)
- **withCommon() 패턴**: `[...COMMON_BEHAVIOR, ...extra, ...COMMON_LAYOUT]`

### 핵심 타입 (변경 없음)
```ts
export interface PropertyMeta {
  name: string;       // 점 표기법 (예: 'properties.title')
  label: string;      // UI 표시명
  category: PropertyCategory;
  editorType: EditorType;
  defaultValue?: unknown;
  options?: (string | { label: string; value: string })[];
  min?: number;
  max?: number;
}
```

---

## 2. 수정 위치

### 파일: `controlProperties.ts`

| 위치 | 작업 |
|------|------|
| 라인 ~389 (`dividerProps` 정의 뒤, `defaultProps` 앞) | 6개 신규 컨트롤의 `xxxProps` 변수 정의 추가 |
| 라인 ~429 (`CONTROL_PROPERTY_META` 객체 내) | 6개 엔트리 추가 (`Divider: dividerProps` 뒤) |

EditorType 추가 필요: **없음** — 사용할 에디터 타입은 모두 기존 정의에 포함 (`text`, `number`, `color`, `dropdown`, `boolean`, `collection`)

---

## 3. 컨트롤별 PropertyMeta 코드 스니펫

### 3.1 Card

```ts
const cardProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',        label: 'Title',        category: 'Appearance', editorType: 'text',     defaultValue: 'Card Title' },
  { name: 'properties.subtitle',     label: 'Subtitle',     category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.showHeader',   label: 'ShowHeader',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.showBorder',   label: 'ShowBorder',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.hoverable',    label: 'Hoverable',    category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.size',         label: 'Size',         category: 'Appearance', editorType: 'dropdown', defaultValue: 'Default', options: ['Default', 'Small'] },
  { name: 'properties.backColor',    label: 'BackColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',    label: 'ForeColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderRadius', label: 'BorderRadius', category: 'Appearance', editorType: 'number',   defaultValue: 8, min: 0, max: 24 },
);
```

**참고**: Panel/GroupBox와 유사한 컨테이너 패턴. `children` 지원. `showHeader`로 헤더 영역 표시/숨김. `hoverable`은 Runtime에서 마우스 오버 시 그림자 강화 효과.

---

### 3.2 Badge

```ts
const badgeProps: PropertyMeta[] = withCommon(
  { name: 'properties.count',         label: 'Count',         category: 'Data',       editorType: 'number',   defaultValue: 0, min: 0 },
  { name: 'properties.overflowCount', label: 'OverflowCount', category: 'Behavior',   editorType: 'number',   defaultValue: 99, min: 1 },
  { name: 'properties.showZero',      label: 'ShowZero',      category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.dot',           label: 'Dot',           category: 'Appearance', editorType: 'boolean',  defaultValue: false },
  { name: 'properties.status',        label: 'Status',        category: 'Appearance', editorType: 'dropdown', defaultValue: 'Default', options: ['Default', 'Success', 'Processing', 'Error', 'Warning'] },
  { name: 'properties.text',          label: 'Text',          category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.badgeColor',    label: 'BadgeColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.offset',        label: 'Offset',        category: 'Layout',     editorType: 'text',     defaultValue: '' },
);
```

**참고**: `count`가 Data 카테고리인 점 주의. EXTRA-ELEMENTS.md에서 `offset`은 Layout 카테고리로 지정됨. `dot: true`이면 숫자 대신 작은 점 표시. count > overflowCount일 때 `{overflowCount}+` 형식 표시.

---

### 3.3 Avatar

```ts
const avatarProps: PropertyMeta[] = withCommon(
  { name: 'properties.imageUrl',  label: 'ImageUrl',  category: 'Data',       editorType: 'text',     defaultValue: '' },
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text',     defaultValue: 'U' },
  { name: 'properties.shape',     label: 'Shape',     category: 'Appearance', editorType: 'dropdown', defaultValue: 'Circle', options: ['Circle', 'Square'] },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);
```

**참고**: 속성이 5개로 가장 적음. `imageUrl`이 있으면 이미지 표시, 없으면 `text` 이니셜 표시. PictureBox의 imageUrl과 동일 패턴.

---

### 3.4 Tooltip

```ts
const tooltipProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',     label: 'Title',     category: 'Appearance', editorType: 'text',     defaultValue: 'Tooltip text' },
  { name: 'properties.placement', label: 'Placement', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Top', options: ['Top', 'Bottom', 'Left', 'Right', 'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'] },
  { name: 'properties.trigger',   label: 'Trigger',   category: 'Behavior',   editorType: 'dropdown', defaultValue: 'Hover', options: ['Hover', 'Click', 'Focus'] },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);
```

**참고**: 자식 컨트롤을 감싸는 래퍼 컨테이너. `placement`에 8가지 옵션. `trigger`로 표시 트리거 방식 결정. backColor 기본값은 런타임에서 `rgba(0,0,0,0.85)`.

---

### 3.5 Collapse

```ts
const collapseProps: PropertyMeta[] = withCommon(
  { name: 'properties.panels',             label: 'Panels',        category: 'Data',       editorType: 'collection', defaultValue: [{ title: 'Panel 1', key: '1' }, { title: 'Panel 2', key: '2' }] },
  { name: 'properties.activeKeys',         label: 'ActiveKeys',    category: 'Behavior',   editorType: 'text',       defaultValue: '1' },
  { name: 'properties.accordion',          label: 'Accordion',     category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.bordered',           label: 'Bordered',      category: 'Appearance', editorType: 'boolean',    defaultValue: true },
  { name: 'properties.expandIconPosition', label: 'ExpandIconPos', category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Start', options: ['Start', 'End'] },
  { name: 'properties.backColor',          label: 'BackColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',          label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
);
```

**참고**: `panels`는 `[{ title, key }]` 구조의 컬렉션. TabControl의 `tabEditor`와 유사하지만 기존 `collection` 에디터 사용. `activeKeys`는 쉼표 구분 문자열(예: `'1,2'`). `accordion: true`면 하나만 열림.

---

### 3.6 Statistic

```ts
const statisticProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',              label: 'Title',          category: 'Appearance', editorType: 'text',    defaultValue: 'Statistic' },
  { name: 'properties.value',              label: 'Value',          category: 'Data',       editorType: 'text',    defaultValue: '0' },
  { name: 'properties.prefix',             label: 'Prefix',        category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.suffix',             label: 'Suffix',        category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.precision',          label: 'Precision',     category: 'Data',       editorType: 'number',  defaultValue: 0, min: 0, max: 10 },
  { name: 'properties.showGroupSeparator', label: 'GroupSeparator', category: 'Appearance', editorType: 'boolean', defaultValue: true },
  { name: 'properties.valueColor',         label: 'ValueColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',          label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
);
```

**참고**: `value`는 텍스트 타입 (숫자 + 비숫자 문자열 모두 지원). `precision`은 Data 카테고리. `showGroupSeparator`로 천 단위 콤마 표시 여부 제어. `valueColor`와 `foreColor`는 별도 — valueColor는 값 텍스트, foreColor는 title 텍스트에 적용.

---

## 4. CONTROL_PROPERTY_META 등록

`CONTROL_PROPERTY_META` 객체 내 `Divider: dividerProps` 뒤에 다음 추가:

```ts
export const CONTROL_PROPERTY_META: Partial<Record<ControlType, PropertyMeta[]>> = {
  // ... 기존 35개 (Step 1 포함) ...
  Divider: dividerProps,
  // ── Step 2 신규 컨트롤 ──
  Card:      cardProps,
  Badge:     badgeProps,
  Avatar:    avatarProps,
  Tooltip:   tooltipProps,
  Collapse:  collapseProps,
  Statistic: statisticProps,
};
```

---

## 5. 속성 분류 요약

| 컨트롤 | Appearance | Behavior | Data | Layout | 고유 속성 수 | 총 속성 수 (공통 포함) |
|--------|------------|----------|------|--------|-------------|----------------------|
| Card | title, subtitle, showHeader, showBorder, size, backColor, foreColor, borderRadius | hoverable | — | — | 9 | 19 |
| Badge | dot, status, text, badgeColor | overflowCount, showZero | count | offset | 8 | 18 |
| Avatar | text, shape, backColor, foreColor | — | imageUrl | — | 5 | 15 |
| Tooltip | title, placement, backColor, foreColor | trigger | — | — | 5 | 15 |
| Collapse | bordered, expandIconPosition, backColor, foreColor | activeKeys, accordion | panels | — | 7 | 17 |
| Statistic | title, prefix, suffix, showGroupSeparator, valueColor, foreColor | — | value, precision | — | 8 | 18 |

**총 신규 고유 속성**: 42개 / **총 속성 (공통 포함)**: 102개

---

## 6. 기존 패턴과의 일관성 확인

| 항목 | 기존 패턴 | Step 2 적용 |
|------|----------|------------|
| `name` 접두사 | `properties.xxx` | 동일 |
| `label` 네이밍 | PascalCase | 동일 (ExpandIconPos만 축약) |
| color 속성 | `defaultValue` 없음 (테마에서 결정) | 동일 (backColor, foreColor, badgeColor, valueColor 등) |
| dropdown `options` | 문자열 배열 | 동일 |
| boolean `defaultValue` | 명시적 지정 | 동일 |
| number `min/max` | 필요 시만 지정 | 동일 (count min:0, overflowCount min:1, borderRadius min:0/max:24, precision min:0/max:10) |
| collection | ComboBox items, Tag tags | Collapse panels에 동일 패턴 적용 |
| 컨테이너 | Panel, GroupBox, TabControl | Card, Tooltip, Collapse — children 지원 컨테이너 |

---

## 7. 특이사항 — Step 1과의 차이점

| 항목 | Step 1 | Step 2 |
|------|--------|--------|
| 컨테이너 컨트롤 | 없음 | Card, Tooltip, Collapse (children 지원) |
| Layout 카테고리 속성 | 없음 (공통만) | Badge의 `offset` |
| collection 복합 구조 | Tag의 `string[]` | Collapse의 `{ title, key }[]` |
| 숫자 포맷 속성 | 없음 | Statistic의 `precision`, `showGroupSeparator` |

---

## 8. 구현 순서

1. `controlProperties.ts`에 6개 `xxxProps` 변수 선언 (`dividerProps` 뒤, `defaultProps` 앞)
2. `CONTROL_PROPERTY_META` 객체에 6개 엔트리 추가
3. `pnpm typecheck` 실행하여 타입 오류 없는지 확인
4. Designer 실행하여 각 컨트롤 선택 시 PropertyPanel에 속성 목록이 올바르게 표시되는지 확인

---

## 9. 의존성

- **선행 작업**: `step1-properties-commit` (Step 1 PropertyMeta가 반영된 상태)
- **선행 작업**: `common/src/types/form.ts`에 6개 ControlType 등록 (Card, Badge, Avatar, Tooltip, Collapse, Statistic — 이미 등록됨)
- **병렬 가능**: `step2-designer` (Designer 컨트롤 컴포넌트 생성), `step2-runtime` (Runtime 컨트롤 생성)과 독립적으로 수행 가능 — 서로 다른 파일을 수정
- **후속 작업**: `step2-properties-impl` → `step2-properties-test` → `step2-properties-commit`
