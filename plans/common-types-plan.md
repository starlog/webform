# EXTRA-ELEMENTS: 공통 타입 등록 구현 계획서

> Task ID: `common-types-plan`
> Phase: phase1-setup (EXTRA-ELEMENTS 프로젝트)
> 참조: EXTRA-ELEMENTS.md (신규 UI 컨트롤 확장 PRD)
> 작성일: 2026-02-25

---

## 1. 현재 코드 구조 요약

### 1.1 `packages/common/src/types/form.ts`

**CONTROL_TYPES 배열** (라인 32–41):
```ts
// Phase 1 - 기본 컨트롤 (11종), 컨테이너 (4종)
// Phase 2 - 데이터 컨트롤 (5종)
// Phase 3 - 고급 컨트롤 (5종)
export const CONTROL_TYPES = [
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl', 'SplitContainer',
  'DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView',
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView',
  'MongoDBConnector',
] as const;
```

- **패턴**: `as const` 리터럴 배열 → `ControlType` 유니온 타입 자동 추론
- **현재 항목 수**: 30개
- **타입 추출** (라인 43): `export type ControlType = (typeof CONTROL_TYPES)[number];`
- **ControlDefinition** (라인 56): `type: ControlType` 필드로 참조

### 1.2 `packages/common/src/types/events.ts`

**CONTROL_EVENTS 객체** (라인 23–48):
```ts
export const CONTROL_EVENTS: Record<string, readonly string[]> = {
  TextBox: ['TextChanged', 'KeyPress'],
  ComboBox: ['SelectedIndexChanged', 'DropDown', 'DropDownClosed'],
  CheckBox: ['CheckedChanged'],
  RadioButton: ['CheckedChanged'],
  DataGridView: ['CellClick', 'CellValueChanged', 'RowEnter', 'SelectionChanged'],
  NumericUpDown: ['ValueChanged'],
  DateTimePicker: ['ValueChanged'],
  ListBox: ['SelectedIndexChanged'],
  TabControl: ['SelectedIndexChanged'],
  TreeView: ['AfterSelect', 'AfterExpand', 'AfterCollapse'],
  ListView: ['SelectedIndexChanged', 'ItemActivate'],
  SpreadsheetView: ['CellChanged', 'RowAdded', 'RowDeleted', 'SelectionChanged', 'DataLoaded'],
  JsonEditor: ['ValueChanged'],
  MongoDBView: ['DataLoaded', 'SelectionChanged', 'CellValueChanged', 'DocumentInserted', 'DocumentUpdated', 'DocumentDeleted', 'Error'],
  GraphView: ['DataLoaded'],
  MenuStrip: ['ItemClicked'],
  ToolStrip: ['ItemClicked'],
  StatusStrip: ['ItemClicked'],
  RichTextBox: ['TextChanged', 'SelectionChanged'],
  WebBrowser: ['Navigated', 'DocumentCompleted'],
  Chart: ['SeriesClicked', 'DataLoaded'],
  SplitContainer: ['SplitterMoved'],
  BindingNavigator: ['PositionChanged', 'ItemClicked'],
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
};
```

- **패턴**: `Record<string, readonly string[]>` 타입의 일반 객체
- **현재 항목 수**: 25개 컨트롤에 대한 이벤트 정의
- **참고**: 이벤트가 없는 컨트롤(Button, Label, Panel 등)은 CONTROL_EVENTS에 미포함, COMMON_EVENTS만 사용

### 1.3 `packages/common/src/index.ts`

- `CONTROL_TYPES`, `ControlType` 등을 re-export (라인 11)
- `CONTROL_EVENTS`, `COMMON_EVENTS`, `FORM_EVENTS` re-export (라인 23)
- **변경 불필요**: 기존 export가 배열/객체를 그대로 내보내므로 원본에 항목 추가 시 자동 반영

### 1.4 `packages/common/src/utils/validation.ts`

- `validateControlDefinition()` (라인 17)에서 `CONTROL_TYPES` import하여 컨트롤 타입 검증
- 라인 30: `if (!(CONTROL_TYPES as readonly string[]).includes(c.type))`
- **변경 불필요**: CONTROL_TYPES 배열에 항목 추가하면 validation이 자동으로 신규 타입 허용

### 1.5 기존 테스트 파일

- `src/__tests__/events.test.ts`: COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS 기본 검증
- `src/__tests__/validation.test.ts`: validateFormDefinition, sanitizeQueryInput 검증
- **기존 테스트 영향**: 없음 (기존 항목 그대로 유지, 신규 항목 추가만)

---

## 2. 수정 계획 상세

### 2.1 파일: `packages/common/src/types/form.ts`

#### 수정 위치: 라인 40 (`'MongoDBConnector',`) 뒤

#### 현재 코드 (라인 37–41):
```ts
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView',
  'MongoDBConnector',
] as const;
```

#### 수정 후 코드:
```ts
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView',
  'MongoDBConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
  'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
  // Extra Elements — Step 2 (모던 UI 강화)
  'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
] as const;
```

#### Edit 도구 사용 스니펫:
```
old_string:
  'MongoDBConnector',
] as const;

new_string:
  'MongoDBConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
  'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
  // Extra Elements — Step 2 (모던 UI 강화)
  'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
] as const;
```

#### 변경 요약:
- `'MongoDBConnector',` 뒤에 주석 2줄 + 타입 2줄 추가
- 기존 Phase 주석 스타일과 일관성 유지 (라인 29–31 참고)
- **결과**: CONTROL_TYPES 배열 30개 → 42개
- **ControlType 유니온 타입**: `as const`에 의해 12개 리터럴 타입 자동 추가

### 2.2 파일: `packages/common/src/types/events.ts`

#### 수정 위치: 라인 47 (`MongoDBConnector: [...]`) 뒤, 닫는 `};` 앞

#### 현재 코드 (라인 46–48):
```ts
  BindingNavigator: ['PositionChanged', 'ItemClicked'],
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
};
```

#### 수정 후 코드:
```ts
  BindingNavigator: ['PositionChanged', 'ItemClicked'],
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  // Extra Elements
  Slider: ['ValueChanged'],
  Switch: ['CheckedChanged'],
  Upload: ['FileSelected', 'UploadCompleted', 'UploadFailed'],
  Alert: ['Closed'],
  Tag: ['TagAdded', 'TagRemoved', 'TagClicked'],
  Tooltip: ['VisibleChanged'],
  Collapse: ['ActiveKeyChanged'],
};
```

#### Edit 도구 사용 스니펫:
```
old_string:
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
};

new_string:
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  // Extra Elements
  Slider: ['ValueChanged'],
  Switch: ['CheckedChanged'],
  Upload: ['FileSelected', 'UploadCompleted', 'UploadFailed'],
  Alert: ['Closed'],
  Tag: ['TagAdded', 'TagRemoved', 'TagClicked'],
  Tooltip: ['VisibleChanged'],
  Collapse: ['ActiveKeyChanged'],
};
```

#### 변경 요약:
- `MongoDBConnector` 항목 뒤에 주석 1줄 + 이벤트 항목 7줄 추가
- **이벤트 미등록 컨트롤**: Card, Badge, Avatar, Statistic, Divider
  - 공통 이벤트(COMMON_EVENTS: Click, DoubleClick, MouseEnter 등)만 사용
  - CONTROL_EVENTS에 별도 항목 불필요
- **결과**: CONTROL_EVENTS 항목 25개 → 32개

---

## 3. TypeScript 타입 안전성 확보

### 3.1 ControlType 유니온 자동 확장

```ts
// form.ts 라인 43 — 변경 불필요
export type ControlType = (typeof CONTROL_TYPES)[number];
```

`CONTROL_TYPES`가 `as const`로 선언되어 있으므로, 배열에 리터럴 문자열을 추가하면 `ControlType` 유니온 타입에 자동 포함됨.

**추가 후 타입 결과:**
```ts
type ControlType =
  | 'Button' | 'Label' | ... | 'MongoDBConnector'  // 기존 30개
  | 'Slider' | 'Switch' | 'Upload' | 'Alert' | 'Tag' | 'Divider'  // Step 1
  | 'Card' | 'Badge' | 'Avatar' | 'Tooltip' | 'Collapse' | 'Statistic';  // Step 2
```

### 3.2 CONTROL_EVENTS 타입

현재 `Record<string, readonly string[]>` 타입이므로 키 제약 없음. 아무 문자열 키든 추가 가능하며 별도 타입 수정 불필요.

### 3.3 Validation 자동 호환

`validation.ts`의 `validateControlDefinition()`은 `CONTROL_TYPES` 배열을 직접 참조:
```ts
if (!(CONTROL_TYPES as readonly string[]).includes(c.type))
```
배열에 항목 추가 시 검증 로직이 자동으로 신규 타입을 유효한 것으로 인식.

---

## 4. 영향받는 하위 패키지 및 영향 범위

### 4.1 `packages/designer`

| 영향 영역 | 파일 | 영향도 | 설명 |
|-----------|------|--------|------|
| 컨트롤 레지스트리 | `controls/registry.ts` | 🔴 필수 수정 | 신규 타입에 대한 Designer 컴포넌트 매핑 추가 |
| 속성 패널 | `components/PropertyPanel/controlProperties.ts` | 🔴 필수 수정 | 신규 타입별 PropertyMeta 정의 추가 |
| Toolbox | (registry.ts 내 metadata) | 🔴 필수 수정 | 신규 타입에 대한 toolbox 메타 등록 |
| 타입 체크 | 전역 | 🟡 자동 반영 | ControlType 유니온 확장으로 switch/if문 exhaustive 체크 가능 |

### 4.2 `packages/runtime`

| 영향 영역 | 파일 | 영향도 | 설명 |
|-----------|------|--------|------|
| 컨트롤 레지스트리 | `controls/registry.ts` | 🔴 필수 수정 | 신규 타입에 대한 Runtime 컴포넌트 매핑 추가 |
| SDUI 렌더러 | `components/SDUIRenderer.tsx` | 🟢 영향 없음 | registry에서 동적 조회하므로 변경 불필요 |
| 이벤트 처리 | (SDUIRenderer 내부) | 🟢 영향 없음 | CONTROL_EVENTS 동적 조회 패턴이므로 변경 불필요 |

### 4.3 `packages/server`

| 영향 영역 | 파일 | 영향도 | 설명 |
|-----------|------|--------|------|
| EventEngine | `services/EventEngine.ts` | 🟢 영향 없음 | 이벤트 처리가 컨트롤 타입에 무관한 범용 구조 |
| SandboxRunner | `services/SandboxRunner.ts` | 🟢 영향 없음 | 사용자 코드 실행이 타입에 무관 |
| Validation | API 입력 검증 | 🟡 자동 반영 | validateControlDefinition()이 신규 타입 자동 허용 |

### 4.4 `packages/common` 내부

| 영향 영역 | 파일 | 영향도 | 설명 |
|-----------|------|--------|------|
| index.ts | `src/index.ts` | 🟢 변경 불필요 | 기존 re-export 구조로 자동 반영 |
| serialization | `utils/serialization.ts` | 🟢 영향 없음 | FormDefinition JSON 직렬화/역직렬화, 타입 무관 |
| controlUtils | `utils/controlUtils.ts` | 🟢 영향 없음 | flatten/nest 등 구조 유틸, 타입 무관 |
| 테스트 | `__tests__/*.test.ts` | 🟢 영향 없음 | 기존 테스트 항목 유지 |

---

## 5. 구현 절차

### Step 1: form.ts 수정
1. `packages/common/src/types/form.ts` 열기
2. 라인 40 (`'MongoDBConnector',`) 뒤에 주석 2줄 + 타입 2줄 추가
3. 저장

### Step 2: events.ts 수정
1. `packages/common/src/types/events.ts` 열기
2. 라인 47 (`MongoDBConnector: [...]`) 뒤, `};` 앞에 주석 1줄 + 이벤트 7줄 추가
3. 저장

### Step 3: 검증
1. `pnpm typecheck` 실행 → TypeScript 컴파일 오류 없음 확인
2. `pnpm --filter @webform/common test` 실행 → 기존 테스트 전체 통과 확인
3. (선택) `pnpm test` 전체 실행 → 하위 패키지 영향 없음 확인

### Step 4: Exhaustive Check 경고 대응 (필요 시)
- Designer/Runtime에서 `ControlType`에 대한 switch/if문이 있을 경우, 신규 타입에 대한 기본 처리가 필요할 수 있음
- 이는 이후 태스크(Designer/Runtime 컨트롤 구현 단계)에서 해결

---

## 6. 변경 파일 요약

| # | 파일 | 변경 유형 | 변경 내용 |
|---|------|----------|----------|
| 1 | `packages/common/src/types/form.ts` | 수정 | CONTROL_TYPES에 12개 타입 추가 (라인 40 뒤) |
| 2 | `packages/common/src/types/events.ts` | 수정 | CONTROL_EVENTS에 7개 항목 추가 (라인 47 뒤) |

**변경하지 않는 파일:**
- `packages/common/src/index.ts` — re-export 구조가 이미 전체 내보내기이므로 변경 불필요
- `packages/common/src/utils/validation.ts` — CONTROL_TYPES 참조가 동적이므로 변경 불필요
- `packages/common/src/__tests__/*.test.ts` — 기존 테스트 항목 그대로 유지 (신규 테스트는 별도 단계)

---

## 7. 추가할 항목 전체 목록 (참조)

### 7.1 CONTROL_TYPES 추가 항목 (12개)

| # | 타입명 | Step | 카테고리 | 컨테이너 여부 |
|---|--------|------|----------|-------------|
| 1 | `Slider` | Step 1 | basic | N |
| 2 | `Switch` | Step 1 | basic | N |
| 3 | `Upload` | Step 1 | data | N |
| 4 | `Alert` | Step 1 | basic | N |
| 5 | `Tag` | Step 1 | basic | N |
| 6 | `Divider` | Step 1 | basic | N |
| 7 | `Card` | Step 2 | container | Y (children 지원) |
| 8 | `Badge` | Step 2 | basic | N |
| 9 | `Avatar` | Step 2 | basic | N |
| 10 | `Tooltip` | Step 2 | basic | Y (children 래퍼) |
| 11 | `Collapse` | Step 2 | container | Y (children 지원) |
| 12 | `Statistic` | Step 2 | basic | N |

### 7.2 CONTROL_EVENTS 추가 항목 (7개)

| # | 컨트롤 | 이벤트 배열 | 이벤트 수 |
|---|--------|-----------|----------|
| 1 | `Slider` | `['ValueChanged']` | 1 |
| 2 | `Switch` | `['CheckedChanged']` | 1 |
| 3 | `Upload` | `['FileSelected', 'UploadCompleted', 'UploadFailed']` | 3 |
| 4 | `Alert` | `['Closed']` | 1 |
| 5 | `Tag` | `['TagAdded', 'TagRemoved', 'TagClicked']` | 3 |
| 6 | `Tooltip` | `['VisibleChanged']` | 1 |
| 7 | `Collapse` | `['ActiveKeyChanged']` | 1 |

**CONTROL_EVENTS 미등록 (공통 이벤트만 사용):**
- Card, Badge, Avatar, Statistic, Divider
