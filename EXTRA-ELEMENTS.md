# EXTRA-ELEMENTS PRD — 신규 UI 컨트롤 확장

> Ant Design 컴포넌트 참고, WebForm SDUI 플랫폼에 12개 신규 컨트롤 추가
> 작성일: 2026-02-25

---

## 목차

- [개요](#개요)
- [공통 규칙](#공통-규칙)
- [Step 1 — 폼 필수 요소 (6개)](#step-1--폼-필수-요소-6개)
  - [1.1 Slider](#11-slider)
  - [1.2 Switch](#12-switch)
  - [1.3 Upload](#13-upload)
  - [1.4 Alert](#14-alert)
  - [1.5 Tag](#15-tag)
  - [1.6 Divider](#16-divider)
- [Step 2 — 모던 UI 강화 (6개)](#step-2--모던-ui-강화-6개)
  - [2.1 Card](#21-card)
  - [2.2 Badge](#22-badge)
  - [2.3 Avatar](#23-avatar)
  - [2.4 Tooltip](#24-tooltip)
  - [2.5 Collapse](#25-collapse)
  - [2.6 Statistic](#26-statistic)
- [구현 체크리스트](#구현-체크리스트)

---

## 개요

| 항목 | 내용 |
|------|------|
| 현재 컨트롤 수 | 30개 |
| Step 1 추가 | +6개 (Slider, Switch, Upload, Alert, Tag, Divider) |
| Step 2 추가 | +6개 (Card, Badge, Avatar, Tooltip, Collapse, Statistic) |
| 완료 후 총 수 | 42개 |

참고: https://ant.design/components/overview

---

## 공통 규칙

### 파일 수정/생성 목록 (컨트롤 1개당)

| # | 파일 | 작업 |
|---|------|------|
| 1 | `packages/common/src/types/form.ts` | `CONTROL_TYPES` 배열에 타입 추가 |
| 2 | `packages/common/src/types/events.ts` | `CONTROL_EVENTS`에 고유 이벤트 추가 |
| 3 | `packages/designer/src/controls/{Name}Control.tsx` | Designer 미리보기 컴포넌트 생성 |
| 4 | `packages/designer/src/controls/registry.ts` | `designerControlRegistry` + `controlMetadata` 등록 |
| 5 | `packages/designer/src/components/PropertyPanel/controlProperties.ts` | `PropertyMeta[]` 정의 + `CONTROL_PROPERTY_META` 등록 |
| 6 | `packages/runtime/src/controls/{Name}.tsx` | Runtime 인터랙티브 컴포넌트 생성 |
| 7 | `packages/runtime/src/controls/registry.ts` | `runtimeControlRegistry` 등록 |

### 공통 속성 (withCommon)

모든 신규 컨트롤은 기존 `withCommon()` 함수로 아래 속성을 자동 포함:

- **Design**: `name`
- **Behavior**: `enabled`, `visible`, `tabIndex`
- **Layout**: `position.x`, `position.y`, `size.width`, `size.height`, `anchor`, `dock`

### 테마 연동

- Designer: `useTheme()` 훅으로 테마 토큰 참조
- Runtime: `useControlColors(controlType, { backColor, foreColor })` 훅 사용
- 컨트롤별 테마 토큰이 없는 경우 가장 유사한 기존 토큰 재사용 (아래 각 컨트롤별 명시)

### Toolbox 카테고리 배정

- Step 1: `basic` 카테고리 (Upload만 `data`)
- Step 2: Card/Collapse → `container`, 나머지 → `basic`

---

## Step 1 — 폼 필수 요소 (6개)

---

### 1.1 Slider

> 참고: https://ant.design/components/slider

**목적**: 범위 내 숫자 값을 드래그로 선택. NumericUpDown과 달리 시각적 범위 표현.

#### Toolbox 메타

```ts
{ type: 'Slider', displayName: 'Slider', icon: '⎯', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 200, height: 30 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options / min / max |
|------|-------|----------|------------|-------------|---------------------|
| `properties.value` | Value | Behavior | number | `0` | — |
| `properties.minimum` | Minimum | Behavior | number | `0` | — |
| `properties.maximum` | Maximum | Behavior | number | `100` | — |
| `properties.step` | Step | Behavior | number | `1` | min: 1 |
| `properties.orientation` | Orientation | Appearance | dropdown | `'Horizontal'` | `['Horizontal', 'Vertical']` |
| `properties.showValue` | ShowValue | Appearance | boolean | `true` | — |
| `properties.trackColor` | TrackColor | Appearance | color | — | — |
| `properties.fillColor` | FillColor | Appearance | color | — | — |

#### 이벤트

```ts
Slider: ['ValueChanged']
```

#### Designer 렌더링

- 수평 트랙(회색 바) + 채워진 영역(파란색) + 원형 썸(thumb) 표시
- `value` 위치에 따라 채워진 영역 비율 계산
- `showValue`가 true이면 썸 위에 현재 값 텍스트 표시
- Vertical 모드: 트랙을 90도 회전 (bottom→top 방향)
- 테마: `theme.controls.progressBar` 토큰 재사용

#### Runtime 동작

- `<input type="range">` 기반 구현
- 드래그/클릭으로 값 변경 → `updateControlState(id, 'value', newValue)` → `onValueChanged` 호출
- `orientation: 'Vertical'`일 때 CSS `writing-mode: vertical-lr` + `direction: rtl` 적용
- `enabled: false` → 회색 처리, 인터랙션 비활성

---

### 1.2 Switch

> 참고: https://ant.design/components/switch

**목적**: on/off 토글. CheckBox보다 모던하고 직관적인 이진 선택 UI.

#### Toolbox 메타

```ts
{ type: 'Switch', displayName: 'Switch', icon: '⊘', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 120, height: 30 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.checked` | Checked | Behavior | boolean | `false` | — |
| `properties.text` | Text | Appearance | text | `''` | — |
| `properties.onText` | OnText | Appearance | text | `'ON'` | — |
| `properties.offText` | OffText | Appearance | text | `'OFF'` | — |
| `properties.onColor` | OnColor | Appearance | color | — | — |
| `properties.offColor` | OffColor | Appearance | color | — | — |

#### 이벤트

```ts
Switch: ['CheckedChanged']
```

#### Designer 렌더링

- 라벨 텍스트(text) + 둥근 필(pill) 형태 트랙 (36x20px)
- `checked: true` → 트랙 배경 파란색, 썸 오른쪽 / `false` → 트랙 회색, 썸 왼쪽
- 트랙 위에 onText/offText 표시
- 테마: `theme.controls.checkRadio` 토큰 재사용

#### Runtime 동작

- 클릭 시 `checked` 토글 → `updateControlState(id, 'checked', !checked)` → `onCheckedChanged` 호출
- CSS transition으로 썸 이동 애니메이션 (0.2s ease)
- `enabled: false` → opacity 0.5, 클릭 비활성

---

### 1.3 Upload

> 참고: https://ant.design/components/upload

**목적**: 파일 업로드 영역. 버튼식 또는 드래그앤드롭 영역.

#### Toolbox 메타

```ts
{ type: 'Upload', displayName: 'Upload', icon: '⬆', category: 'data' }
```

#### 기본 크기

```ts
{ width: 300, height: 120 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.uploadMode` | UploadMode | Appearance | dropdown | `'DropZone'` | `['Button', 'DropZone']` |
| `properties.text` | Text | Appearance | text | `'Click or drag file to upload'` | — |
| `properties.accept` | Accept | Behavior | text | `''` | — |
| `properties.multiple` | Multiple | Behavior | boolean | `false` | — |
| `properties.maxFileSize` | MaxFileSize(MB) | Behavior | number | `10` | min: 1, max: 100 |
| `properties.maxCount` | MaxCount | Behavior | number | `1` | min: 1, max: 20 |
| `properties.backColor` | BackColor | Appearance | color | — | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |
| `properties.borderStyle` | BorderStyle | Appearance | dropdown | `'Dashed'` | `['None', 'Solid', 'Dashed']` |

#### 이벤트

```ts
Upload: ['FileSelected', 'UploadCompleted', 'UploadFailed']
```

#### Designer 렌더링

- **Button 모드**: 버튼 아이콘 + text 표시
- **DropZone 모드**: 점선 테두리 박스 + 업로드 아이콘(⬆) + text 중앙 표시
- 테마: `theme.controls.button` (Button 모드) / `theme.form` (DropZone 모드) 토큰 재사용

#### Runtime 동작

- 숨겨진 `<input type="file">` + 클릭/드래그 트리거
- `accept` → input의 accept 속성 매핑
- 파일 선택 시 → `onFileSelected` 이벤트 발생 (eventArgs에 `{ files: [{ name, size, type }] }`)
- 실제 업로드는 이벤트 핸들러 코드에서 `ctx.http.post()` 등으로 처리 (컨트롤은 파일 메타 전달만)
- 선택된 파일 목록을 컨트롤 상태에 저장하여 파일명 표시
- 드래그 오버 시 테두리 색상 변경 (시각적 피드백)

---

### 1.4 Alert

> 참고: https://ant.design/components/alert

**목적**: 인라인 알림 메시지 표시 (정보/성공/경고/에러).

#### Toolbox 메타

```ts
{ type: 'Alert', displayName: 'Alert', icon: '⚠', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 300, height: 50 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.message` | Message | Appearance | text | `'Alert message'` | — |
| `properties.description` | Description | Appearance | text | `''` | — |
| `properties.alertType` | AlertType | Appearance | dropdown | `'Info'` | `['Success', 'Info', 'Warning', 'Error']` |
| `properties.showIcon` | ShowIcon | Appearance | boolean | `true` | — |
| `properties.closable` | Closable | Behavior | boolean | `false` | — |
| `properties.banner` | Banner | Appearance | boolean | `false` | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |

#### 이벤트

```ts
Alert: ['Closed']
```

#### 타입별 스타일 맵

| alertType | 배경색 | 테두리색 | 아이콘 |
|-----------|--------|---------|--------|
| Success | `#f6ffed` | `#b7eb8f` | `✓` |
| Info | `#e6f4ff` | `#91caff` | `ℹ` |
| Warning | `#fffbe6` | `#ffe58f` | `⚠` |
| Error | `#fff2f0` | `#ffccc7` | `✕` |

#### Designer 렌더링

- alertType에 따른 배경색/테두리색/아이콘 적용
- `showIcon` → 좌측 아이콘 표시
- `message` 굵은 텍스트 + `description` 보통 텍스트 (아래 줄)
- `closable` → 우측 상단 ✕ 버튼 표시
- `banner` → 테두리 없음, 상단 배너 스타일

#### Runtime 동작

- 정적 표시 컨트롤 (기본적으로 읽기 전용)
- `closable: true` → ✕ 클릭 시 `visible: false` 설정 + `onClosed` 이벤트 발생
- 이벤트 핸들러에서 `message`, `alertType` 등을 동적으로 변경 가능

---

### 1.5 Tag

> 참고: https://ant.design/components/tag

**목적**: 태그/레이블 칩. 항목 분류, 상태 표시, 필터 칩으로 활용.

#### Toolbox 메타

```ts
{ type: 'Tag', displayName: 'Tag', icon: '⬡', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 200, height: 30 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.tags` | Tags | Data | collection | `['Tag1', 'Tag2']` | — |
| `properties.tagColor` | TagColor | Appearance | dropdown | `'Default'` | `['Default', 'Blue', 'Green', 'Red', 'Orange', 'Purple', 'Cyan', 'Gold']` |
| `properties.closable` | Closable | Behavior | boolean | `false` | — |
| `properties.addable` | Addable | Behavior | boolean | `false` | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |

#### 이벤트

```ts
Tag: ['TagAdded', 'TagRemoved', 'TagClicked']
```

#### 색상 맵

| tagColor | 배경색 | 테두리색 | 텍스트색 |
|----------|--------|---------|---------|
| Default | `#fafafa` | `#d9d9d9` | `rgba(0,0,0,0.88)` |
| Blue | `#e6f4ff` | `#91caff` | `#1677ff` |
| Green | `#f6ffed` | `#b7eb8f` | `#52c41a` |
| Red | `#fff2f0` | `#ffccc7` | `#ff4d4f` |
| Orange | `#fff7e6` | `#ffd591` | `#fa8c16` |
| Purple | `#f9f0ff` | `#d3adf7` | `#722ed1` |
| Cyan | `#e6fffb` | `#87e8de` | `#13c2c2` |
| Gold | `#fffbe6` | `#ffe58f` | `#faad14` |

#### Designer 렌더링

- `tags` 배열을 가로 flex-wrap으로 나열
- 각 태그: 둥근 사각형 칩 (border-radius: 4px, padding: 2px 8px)
- `closable` → 각 태그 오른쪽에 ✕ 아이콘
- `addable` → 마지막에 `+ New Tag` 점선 칩 표시
- tagColor에 따른 색상 적용

#### Runtime 동작

- `closable` → ✕ 클릭 시 해당 태그를 tags 배열에서 제거 + `onTagRemoved` (eventArgs: `{ tag }`)
- `addable` → `+ New Tag` 클릭 시 인라인 input 표시 → Enter/blur → tags 배열에 추가 + `onTagAdded` (eventArgs: `{ tag }`)
- 태그 클릭 → `onTagClicked` (eventArgs: `{ tag, index }`)

---

### 1.6 Divider

> 참고: https://ant.design/components/divider

**목적**: 콘텐츠 영역 구분선. 수평/수직, 텍스트 포함 가능.

#### Toolbox 메타

```ts
{ type: 'Divider', displayName: 'Divider', icon: '—', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 300, height: 24 }  // Horizontal
// Vertical은 { width: 24, height: 100 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.text` | Text | Appearance | text | `''` | — |
| `properties.orientation` | Orientation | Appearance | dropdown | `'Horizontal'` | `['Horizontal', 'Vertical']` |
| `properties.textAlign` | TextAlign | Appearance | dropdown | `'Center'` | `['Left', 'Center', 'Right']` |
| `properties.lineStyle` | LineStyle | Appearance | dropdown | `'Solid'` | `['Solid', 'Dashed', 'Dotted']` |
| `properties.lineColor` | LineColor | Appearance | color | — | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |

#### 이벤트

```ts
// 없음 (순수 표시 컨트롤) — 공통 이벤트만 적용
```

#### Designer 렌더링

- **Horizontal**: 가운데 수평선 + 텍스트가 있으면 텍스트 좌우로 선 분리
  - textAlign에 따라 텍스트 위치 조정 (Left: 5%, Center: 50%, Right: 95%)
- **Vertical**: 세로 중앙에 수직선
- lineStyle/lineColor 적용
- 테마: `theme.form.foreground` 에서 opacity 0.2 적용

#### Runtime 동작

- 순수 표시 컨트롤. 인터랙션 없음.
- 이벤트 핸들러에서 `text`, `lineColor` 등 동적 변경 가능

---

## Step 2 — 모던 UI 강화 (6개)

---

### 2.1 Card

> 참고: https://ant.design/components/card

**목적**: 구조화된 콘텐츠 컨테이너. Panel/GroupBox보다 모던한 레이아웃 제공.

#### Toolbox 메타

```ts
{ type: 'Card', displayName: 'Card', icon: '▢', category: 'container' }
```

#### 기본 크기

```ts
{ width: 300, height: 200 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.title` | Title | Appearance | text | `'Card Title'` | — |
| `properties.subtitle` | Subtitle | Appearance | text | `''` | — |
| `properties.showHeader` | ShowHeader | Appearance | boolean | `true` | — |
| `properties.showBorder` | ShowBorder | Appearance | boolean | `true` | — |
| `properties.hoverable` | Hoverable | Behavior | boolean | `false` | — |
| `properties.size` | Size | Appearance | dropdown | `'Default'` | `['Default', 'Small']` |
| `properties.backColor` | BackColor | Appearance | color | — | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |
| `properties.borderRadius` | BorderRadius | Appearance | number | `8` | min: 0, max: 24 |

#### 이벤트

```ts
// 공통 이벤트만 (Click, DoubleClick 등)
```

#### 컨테이너 동작

- `children` 지원 — 다른 컨트롤을 자식으로 포함 가능 (Panel/GroupBox와 동일 패턴)
- 드래그앤드롭으로 자식 컨트롤 추가 가능

#### Designer 렌더링

- 둥근 사각형 카드 (box-shadow: `0 1px 2px rgba(0,0,0,0.06)`)
- `showHeader` → 상단 헤더 영역 (title 굵은 텍스트 + subtitle 작은 텍스트 + 하단 구분선)
- 헤더 아래가 body 영역 (자식 컨트롤 배치)
- `showBorder` → border: 1px solid 테두리
- 테마: `theme.form.background` + `theme.form.foreground` 토큰 사용

#### Runtime 동작

- 정적 컨테이너. 자식 컨트롤 렌더링.
- `hoverable: true` → 마우스 오버 시 box-shadow 강화 (transition 0.3s)
- 헤더의 title/subtitle은 이벤트 핸들러에서 동적 변경 가능

---

### 2.2 Badge

> 참고: https://ant.design/components/badge

**목적**: 숫자/상태 뱃지. 알림 수, 온라인 상태 등을 시각적으로 표시.

#### Toolbox 메타

```ts
{ type: 'Badge', displayName: 'Badge', icon: '●', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 80, height: 30 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.count` | Count | Data | number | `0` | min: 0 |
| `properties.overflowCount` | OverflowCount | Behavior | number | `99` | min: 1 |
| `properties.showZero` | ShowZero | Behavior | boolean | `false` | — |
| `properties.dot` | Dot | Appearance | boolean | `false` | — |
| `properties.status` | Status | Appearance | dropdown | `'Default'` | `['Default', 'Success', 'Processing', 'Error', 'Warning']` |
| `properties.text` | Text | Appearance | text | `''` | — |
| `properties.badgeColor` | BadgeColor | Appearance | color | — | — |
| `properties.offset` | Offset | Layout | text | `''` | — |

#### 이벤트

```ts
// 공통 이벤트만
```

#### 상태별 색상 맵

| status | 색상 |
|--------|------|
| Default | `#ff4d4f` (빨강) |
| Success | `#52c41a` (녹색) |
| Processing | `#1677ff` (파랑, 깜빡임 애니메이션) |
| Error | `#ff4d4f` (빨강) |
| Warning | `#faad14` (노랑) |

#### Designer 렌더링

- `text`가 있으면 텍스트 표시 + 우측 상단에 뱃지
- `text`가 없으면 독립 뱃지 (숫자 또는 dot)
- `dot: true` → 작은 원(6x6), 숫자 없음
- `dot: false` → 숫자 표시 뱃지 (min-width: 20px, border-radius: 10px)
- count > overflowCount → `{overflowCount}+` 표시

#### Runtime 동작

- 순수 표시 컨트롤 (카운트/상태를 이벤트에서 동적 변경)
- `status: 'Processing'` → CSS @keyframes으로 dot 깜빡임 애니메이션

---

### 2.3 Avatar

> 참고: https://ant.design/components/avatar

**목적**: 사용자/엔티티 아바타 표시 (이미지, 아이콘, 이니셜).

#### Toolbox 메타

```ts
{ type: 'Avatar', displayName: 'Avatar', icon: '⊙', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 40, height: 40 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.imageUrl` | ImageUrl | Data | text | `''` | — |
| `properties.text` | Text | Appearance | text | `'U'` | — |
| `properties.shape` | Shape | Appearance | dropdown | `'Circle'` | `['Circle', 'Square']` |
| `properties.backColor` | BackColor | Appearance | color | — | (기본: `#1677ff`) |
| `properties.foreColor` | ForeColor | Appearance | color | — | (기본: `#ffffff`) |

#### 이벤트

```ts
// 공통 이벤트만 (Click 등)
```

#### Designer 렌더링

- `imageUrl`이 있으면: 이미지를 원형/사각형으로 object-fit: cover 표시
- `imageUrl`이 없으면: 배경색 + text(첫 1~2글자) 중앙 표시
- `shape: 'Circle'` → border-radius: 50% / `'Square'` → border-radius: 4px
- 크기는 size.width/height 중 작은 값 기준

#### Runtime 동작

- `imageUrl` 로딩 실패 → 자동으로 text 이니셜 폴백
- 클릭 이벤트 지원 (프로필 메뉴 등)

---

### 2.4 Tooltip

> 참고: https://ant.design/components/tooltip

**목적**: 다른 컨트롤에 마우스 오버 시 부가 정보 표시하는 래퍼 컨트롤.

#### Toolbox 메타

```ts
{ type: 'Tooltip', displayName: 'Tooltip', icon: '💬', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 100, height: 30 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.title` | Title | Appearance | text | `'Tooltip text'` | — |
| `properties.placement` | Placement | Appearance | dropdown | `'Top'` | `['Top', 'Bottom', 'Left', 'Right', 'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight']` |
| `properties.trigger` | Trigger | Behavior | dropdown | `'Hover'` | `['Hover', 'Click', 'Focus']` |
| `properties.backColor` | BackColor | Appearance | color | — | (기본: `rgba(0,0,0,0.85)`) |
| `properties.foreColor` | ForeColor | Appearance | color | — | (기본: `#ffffff`) |

#### 이벤트

```ts
Tooltip: ['VisibleChanged']
```

#### 컨테이너 동작

- `children` 지원 — 자식 컨트롤을 감싸는 래퍼 역할
- 자식 컨트롤에 대한 tooltip 표시

#### Designer 렌더링

- 자식 컨트롤을 그대로 표시 + 좌측 상단에 작은 말풍선 아이콘 오버레이 (디자이너에서만)
- 자식이 없으면: 점선 테두리 + "[Tooltip]" 텍스트

#### Runtime 동작

- `trigger: 'Hover'` → mouseenter/mouseleave로 팝업 표시/숨김
- `trigger: 'Click'` → 클릭 토글
- `trigger: 'Focus'` → focus/blur
- 팝업: 절대위치 오버레이 (dark rounded box + arrow)
- placement에 따른 위치 계산 (자식 컨트롤 기준 상대 좌표)
- 표시/숨김 시 `onVisibleChanged` 이벤트

---

### 2.5 Collapse

> 참고: https://ant.design/components/collapse

**목적**: 아코디언 UI. 섹션별로 콘텐츠를 접고 펼 수 있는 컨테이너.

#### Toolbox 메타

```ts
{ type: 'Collapse', displayName: 'Collapse', icon: '≡', category: 'container' }
```

#### 기본 크기

```ts
{ width: 300, height: 200 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.panels` | Panels | Data | collection | `[{ title: 'Panel 1', key: '1' }, { title: 'Panel 2', key: '2' }]` | — |
| `properties.activeKeys` | ActiveKeys | Behavior | text | `'1'` | — |
| `properties.accordion` | Accordion | Behavior | boolean | `false` | — |
| `properties.bordered` | Bordered | Appearance | boolean | `true` | — |
| `properties.expandIconPosition` | ExpandIconPos | Appearance | dropdown | `'Start'` | `['Start', 'End']` |
| `properties.backColor` | BackColor | Appearance | color | — | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |

> `panels` 컬렉션 에디터: 각 패널은 `{ title: string, key: string }` 구조 (TabControl의 tabEditor와 유사한 패널 편집 UI)

#### 이벤트

```ts
Collapse: ['ActiveKeyChanged']
```

#### 컨테이너 동작

- `children` 지원 — 각 패널의 body에 자식 컨트롤 배치
- panels 배열의 key와 자식 컨트롤의 패널 소속을 매칭 (TabControl 패턴과 동일)

#### Designer 렌더링

- 패널 헤더: 배경 약간 어둡게 + ▶/▼ 아이콘 + title 텍스트
- 활성 패널(activeKeys에 포함): 헤더 아래 body 영역 표시 (자식 컨트롤 배치)
- 비활성 패널: 헤더만 표시
- `bordered` → 외곽 테두리 + 패널 간 구분선
- 테마: `theme.form.background` (살짝 어두운 헤더) + `theme.form.foreground`

#### Runtime 동작

- 패널 헤더 클릭 → 해당 패널 토글
- `accordion: true` → 한 번에 하나만 열림 (나머지 자동 닫힘)
- `accordion: false` → 여러 패널 동시 열림 가능
- 열림/닫힘 애니메이션 (height transition, 0.3s ease)
- `onActiveKeyChanged` 이벤트 (eventArgs: `{ activeKeys }`)

---

### 2.6 Statistic

> 참고: https://ant.design/components/statistic

**목적**: 숫자 통계 강조 표시. 대시보드 KPI, 카운터 등.

#### Toolbox 메타

```ts
{ type: 'Statistic', displayName: 'Statistic', icon: '#', category: 'basic' }
```

#### 기본 크기

```ts
{ width: 150, height: 80 }
```

#### 고유 속성 (PropertyMeta)

| name | label | category | editorType | defaultValue | options |
|------|-------|----------|------------|-------------|---------|
| `properties.title` | Title | Appearance | text | `'Statistic'` | — |
| `properties.value` | Value | Data | text | `'0'` | — |
| `properties.prefix` | Prefix | Appearance | text | `''` | — |
| `properties.suffix` | Suffix | Appearance | text | `''` | — |
| `properties.precision` | Precision | Data | number | `0` | min: 0, max: 10 |
| `properties.showGroupSeparator` | GroupSeparator | Appearance | boolean | `true` | — |
| `properties.valueColor` | ValueColor | Appearance | color | — | — |
| `properties.foreColor` | ForeColor | Appearance | color | — | — |

#### 이벤트

```ts
// 공통 이벤트만 (Click 등)
```

#### Designer 렌더링

- 상단: title (작은 텍스트, 회색)
- 하단: prefix + value + suffix (큰 텍스트, 굵게, 24px)
- `showGroupSeparator` → 숫자에 천 단위 콤마 삽입
- `precision` → 소수점 자릿수 포맷
- `valueColor` → 값 텍스트 색상 (증가: 녹색, 감소: 빨강 등)
- 테마: `theme.form.foreground`

#### Runtime 동작

- 순수 표시 컨트롤
- 이벤트 핸들러에서 `value`, `title`, `prefix`, `suffix` 등 동적 변경 가능
- value가 숫자 문자열이면 자동 포맷 (groupSeparator, precision)
- value가 비숫자 문자열이면 그대로 표시

---

## 구현 체크리스트

### Step 1 수정 파일 목록

```
수정:
  packages/common/src/types/form.ts                          — CONTROL_TYPES에 6개 추가
  packages/common/src/types/events.ts                        — CONTROL_EVENTS에 4개 추가 (Divider 제외)
  packages/designer/src/controls/registry.ts                 — 6개 컨트롤 import + registry + metadata
  packages/designer/src/components/PropertyPanel/controlProperties.ts — 6개 PropertyMeta 정의
  packages/runtime/src/controls/registry.ts                  — 6개 컨트롤 import + registry

생성:
  packages/designer/src/controls/SliderControl.tsx
  packages/designer/src/controls/SwitchControl.tsx
  packages/designer/src/controls/UploadControl.tsx
  packages/designer/src/controls/AlertControl.tsx
  packages/designer/src/controls/TagControl.tsx
  packages/designer/src/controls/DividerControl.tsx
  packages/runtime/src/controls/Slider.tsx
  packages/runtime/src/controls/Switch.tsx
  packages/runtime/src/controls/Upload.tsx
  packages/runtime/src/controls/Alert.tsx
  packages/runtime/src/controls/Tag.tsx
  packages/runtime/src/controls/Divider.tsx
```

### Step 2 수정 파일 목록

```
수정:
  packages/common/src/types/form.ts                          — CONTROL_TYPES에 6개 추가
  packages/common/src/types/events.ts                        — CONTROL_EVENTS에 2개 추가
  packages/designer/src/controls/registry.ts                 — 6개 컨트롤 import + registry + metadata
  packages/designer/src/components/PropertyPanel/controlProperties.ts — 6개 PropertyMeta 정의
  packages/runtime/src/controls/registry.ts                  — 6개 컨트롤 import + registry

생성:
  packages/designer/src/controls/CardControl.tsx
  packages/designer/src/controls/BadgeControl.tsx
  packages/designer/src/controls/AvatarControl.tsx
  packages/designer/src/controls/TooltipControl.tsx
  packages/designer/src/controls/CollapseControl.tsx
  packages/designer/src/controls/StatisticControl.tsx
  packages/runtime/src/controls/Card.tsx
  packages/runtime/src/controls/Badge.tsx
  packages/runtime/src/controls/Avatar.tsx
  packages/runtime/src/controls/Tooltip.tsx
  packages/runtime/src/controls/Collapse.tsx
  packages/runtime/src/controls/Statistic.tsx
```

### 구현 순서 권장

1. **공통 타입 등록** (form.ts, events.ts) — 12개 타입 한 번에 추가
2. **Step 1 Designer 컨트롤** 6개 생성 + registry 등록
3. **Step 1 PropertyMeta** 6개 정의
4. **Step 1 Runtime 컨트롤** 6개 생성 + registry 등록
5. **Step 1 통합 테스트** (Toolbox 드래그 → Canvas 배치 → 속성 편집 → Runtime 렌더링)
6. Step 2 반복 (2.1 ~ 2.6)
