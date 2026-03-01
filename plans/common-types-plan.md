# [Phase1] SwaggerConnector 공통 타입 정의 계획

> Task ID: `common-types-plan`
> Phase: phase1-foundation (SwaggerConnector 프로젝트)
> 작성일: 2026-03-01

---

## 1. 현재 구조 분석

### 1.1 CONTROL_TYPES (`packages/common/src/types/form.ts:32-45`)

```typescript
export const CONTROL_TYPES = [
  // Phase 1 - 기본 컨트롤 (11종), 컨테이너 (4종)
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl', 'SplitContainer',
  // Phase 2 - 데이터 컨트롤 (5종)
  'DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView',
  // Phase 3 - 고급 컨트롤
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView',
  'MongoDBConnector',              // ← 비-UI 커넥터 컨트롤
  // Extra Elements — Step 1 (폼 필수 요소)
  'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
  // Extra Elements — Step 2 (모던 UI 강화)
  'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
] as const;
```

- **패턴**: `as const` 리터럴 배열 → `ControlType` 유니온 타입 자동 추론 (line 47)
- **현재 항목 수**: 42개
- **비-UI 커넥터 패턴**: `MongoDBConnector`가 유일한 비-UI 커넥터, Extra Elements 주석 앞에 위치

### 1.2 CONTROL_EVENTS (`packages/common/src/types/events.ts:23-56`)

```typescript
export const CONTROL_EVENTS: Record<string, readonly string[]> = {
  TextBox: ['TextChanged', 'KeyPress'],
  ...
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],  // ← 참조 패턴
  // Extra Elements
  Slider: ['ValueChanged'],
  ...
};
```

- **패턴**: `Record<string, readonly string[]>` 타입의 일반 객체
- **MongoDBConnector 이벤트**: `Connected`, `Error`, `QueryCompleted` — SwaggerConnector와 유사한 패턴
- **현재 항목 수**: 32개 컨트롤에 대한 이벤트 정의

---

## 2. 변경 계획

### 2.1 `packages/common/src/types/form.ts` — CONTROL_TYPES에 추가

**추가 위치**: `'MongoDBConnector',` 바로 뒤, `// Extra Elements — Step 1` 주석 앞 (line 40~41 사이)

**변경 전**:
```typescript
  'MongoDBConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
```

**변경 후**:
```typescript
  'MongoDBConnector',
  'SwaggerConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
```

**근거**: `SwaggerConnector`는 `MongoDBConnector`와 동일한 비-UI 커넥터 유형이므로 같은 그룹에 배치한다. Extra Elements와는 성격이 다르므로 해당 주석 앞에 위치시킨다.

**결과**: CONTROL_TYPES 배열 42개 → 43개

### 2.2 `packages/common/src/types/events.ts` — CONTROL_EVENTS에 추가

**추가 위치**: `MongoDBConnector` 항목 바로 뒤, `// Extra Elements` 주석 앞 (line 47~48 사이)

**변경 전**:
```typescript
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  // Extra Elements
```

**변경 후**:
```typescript
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  SwaggerConnector: ['Connected', 'Error', 'RequestCompleted'],
  // Extra Elements
```

**이벤트 설명**:

| 이벤트 | 설명 | MongoDBConnector 대응 |
|--------|------|----------------------|
| `Connected` | Swagger 스펙 YAML 파싱 성공, API 연결 준비 완료 | `Connected` (동일) |
| `Error` | 스펙 파싱 실패, HTTP 요청 오류 등 에러 발생 | `Error` (동일) |
| `RequestCompleted` | REST API 요청 완료 (성공/실패 모두 포함) | `QueryCompleted` (유사) |

---

## 3. 다른 패키지 영향 분석

### 3.1 즉시 영향 (자동 반영 — 수정 불필요)

| 패키지 | 파일 | 영향 설명 |
|--------|------|-----------|
| **common** | `src/index.ts` (line 11, 23) | `CONTROL_TYPES`, `CONTROL_EVENTS` re-export 중 → 자동 반영 |
| **common** | `src/utils/validation.ts` (line 30) | `CONTROL_TYPES.includes()` 검증 → 자동 반영 |
| **server** | `src/validators/formValidator.ts` | `CONTROL_TYPES` import 검증 → 자동 반영 |
| **designer** | `src/components/Canvas/DesignerCanvas.tsx` | `ControlType` 타입 사용 → 유니온 자동 확장 |
| **designer** | `src/components/Canvas/ShellCanvas.tsx` | `CONTROL_TYPES` 사용 → 자동 반영 |
| **mcp** | `src/tools/controls.ts` | `CONTROL_TYPES` 사용 → 자동 반영 |
| **mcp** | `src/tools/events.ts` | `CONTROL_EVENTS` 사용 → 자동 반영 |
| **mcp** | `src/resources/schemaResource.ts` | `CONTROL_TYPES`, `CONTROL_EVENTS` 사용 → 자동 반영 |

### 3.2 후속 작업 필요 (Phase2 태스크에서 처리)

| 패키지 | 파일 | 필요 작업 | 담당 태스크 |
|--------|------|-----------|-------------|
| **designer** | `src/controls/registry.ts` | SwaggerConnectorControl 컴포넌트 등록 | `designer-ui-impl` |
| **designer** | `src/components/PropertyPanel/controlProperties.ts` | swaggerConnectorProps 속성 정의 추가 | `designer-ui-impl` |
| **runtime** | `src/controls/registry.ts` | SwaggerConnector 컴포넌트 등록 (return null) | `runtime-component-impl` |
| **mcp** | `src/utils/controlDefaults.ts` | SwaggerConnector 기본값 추가 | `mcp-defaults-impl` |
| **server** | `src/services/SandboxRunner.ts` | SwaggerConnectorInfo 인터페이스 및 핸들러 | `sandbox-integration-impl` |
| **server** | `src/services/EventEngine.ts` | extractSwaggerConnectors() 메서드 추가 | `sandbox-integration-impl` |

### 3.3 기존 테스트 영향

| 파일 | 영향 |
|------|------|
| `common/src/__tests__/newControlTypes.test.ts` | CONTROL_TYPES 관련 테스트 — 배열 길이 하드코딩 시 수정 필요, includes 체크 시 영향 없음 |
| `common/src/__tests__/events.test.ts` | CONTROL_EVENTS 관련 테스트 — 동일 |
| `designer/src/__tests__/controlProperties.test.ts` | 속성 정의 테스트 — Phase2에서 속성 추가 시 함께 처리 |
| `designer/src/__tests__/registry.test.ts` | 레지스트리 테스트 — Phase2에서 컴포넌트 등록 시 함께 처리 |

---

## 4. TypeScript 타입 체크 통과 예측

### 결론: ✅ 통과

**근거**:

1. **`CONTROL_TYPES`** (`as const` 배열)
   - 리터럴 문자열 `'SwaggerConnector'` 추가 → `ControlType` 유니온에 자동 포함
   - 기존 코드에서 `ControlType`을 사용하는 곳은 유니온 확장에 의해 깨지지 않음
   - exhaustive switch 체크: designer/runtime registry는 `Partial` 매핑 패턴이므로 누락 허용

2. **`CONTROL_EVENTS`** (`Record<string, readonly string[]>`)
   - 키가 `string` 타입이므로 새 키 추가에 제약 없음
   - 값이 `readonly string[]`이므로 배열 리터럴 할당 가능

3. **re-export 체인**
   - `common/index.ts` → 다른 패키지: 값 기반 export이므로 새 항목 자동 포함

4. **유일한 리스크 시나리오** (해당 없음 확인 완료)
   - `Record<ControlType, Component>` 같은 전수 매핑(exhaustive mapping) → 확인 결과 registry는 `Partial` 또는 동적 조회 패턴 사용

---

## 5. 구현 절차 요약

| 단계 | 작업 | 변경량 |
|------|------|--------|
| 1 | `form.ts` line 40 뒤에 `'SwaggerConnector',` 1줄 추가 | +1줄 |
| 2 | `events.ts` line 47 뒤에 `SwaggerConnector: ['Connected', 'Error', 'RequestCompleted'],` 1줄 추가 | +1줄 |
| 3 | `pnpm typecheck` 실행하여 타입 체크 통과 확인 | 검증 |
| 4 | `pnpm lint` 실행하여 린트 통과 확인 | 검증 |

**총 변경: 2줄 추가, 기존 코드 수정 없음**

---

## 6. Edit 도구 사용 스니펫

### form.ts 수정:
```
old_string:
  'MongoDBConnector',
  // Extra Elements — Step 1 (폼 필수 요소)

new_string:
  'MongoDBConnector',
  'SwaggerConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
```

### events.ts 수정:
```
old_string:
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  // Extra Elements

new_string:
  MongoDBConnector: ['Connected', 'Error', 'QueryCompleted'],
  SwaggerConnector: ['Connected', 'Error', 'RequestCompleted'],
  // Extra Elements
```
