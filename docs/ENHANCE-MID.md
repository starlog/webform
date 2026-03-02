# ENHANCE-MID: 중기 개선 (구조적 중복 제거 + 타입 개선)

---

## Part A: 구조적 중복 제거

### #11. PropertyPanel — groupByCategory 5중 중복 + 모드별 분리

**파일:** `packages/designer/src/components/PropertyPanel/PropertyPanel.tsx` (812줄)

**문제:**
카테고리별 그룹화 로직이 5회 반복 (L242~260, L263~281, L297~308, L391~402, L455~480).
또한 단일 컴포넌트가 6가지 렌더링 모드를 모두 처리.

**수정 방안:**

1. 공통 헬퍼 추출:
```typescript
// utils/groupByCategory.ts
type PropertyCategoryName = 'Design' | 'Appearance' | 'Behavior' | 'Data' | 'APIs' | 'Sample' | 'Layout';

function groupByCategory(
  metas: PropertyMeta[],
  order: PropertyCategoryName[] = ['Design', 'Appearance', 'Behavior', 'Data', 'APIs', 'Sample', 'Layout'],
): { category: string; properties: PropertyMeta[] }[] {
  const groups = new Map<string, PropertyMeta[]>();
  for (const meta of metas) {
    const cat = meta.category ?? 'Design';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(meta);
  }
  return order.filter((c) => groups.has(c)).map((c) => ({ category: c, properties: groups.get(c)! }));
}
```

2. 모드별 서브컴포넌트 분리:
```
PropertyPanel.tsx (메인 — 모드 라우팅만)
├── ShellEmptyPanel.tsx
├── ShellControlPanel.tsx
├── FormPropertiesPanel.tsx
├── MultiSelectPanel.tsx
└── SingleControlPanel.tsx
```

---

### #12. AddDataSourceModal / EditDataSourceModal — DB 폼 필드 중복

**파일:**
- `packages/designer/src/components/DataSourcePanel/AddDataSourceModal.tsx`
- `packages/designer/src/components/DataSourcePanel/EditDataSourceModal.tsx`

**문제:**
MongoDB 연결 폼 (ConnectionString, Database 입력)과 SQL DB 연결 폼 (Host, Port, User, Password, Database, SSL)이 두 모달에 완전히 동일한 JSX로 중복.

**수정 방안:**
```typescript
// DatabaseFormFields.tsx — 공통 컴포넌트
interface DatabaseFormFieldsProps {
  dialect: string;
  config: DatabaseConfig;
  onChange: (field: string, value: unknown) => void;
}

export function DatabaseFormFields({ dialect, config, onChange }: DatabaseFormFieldsProps) {
  if (dialect === 'mongodb') {
    return (
      <>
        <label>Connection String</label>
        <input value={config.connectionString} onChange={(e) => onChange('connectionString', e.target.value)} />
        <label>Database</label>
        <input value={config.database} onChange={(e) => onChange('database', e.target.value)} />
      </>
    );
  }
  // SQL 공통 폼 (mysql, postgres, mssql 등)
  return (
    <>
      <label>Host</label>
      <input value={config.host} onChange={(e) => onChange('host', e.target.value)} />
      {/* Port, User, Password, Database, SSL ... */}
    </>
  );
}
```

---

### #13. EventEngine — executeEvent / executeShellEvent 80% 중복

**파일:** `packages/server/src/services/EventEngine.ts:55-231`

**문제:**
두 메서드의 구조가 거의 동일:
- 핸들러 코드 탐색 (itemScriptPath → findItemScript → eventHandlers.find)
- ID↔Name 맵 구성
- Connector 추출
- SandboxRunner 호출
- 패치 추출

**수정 방안:**
```typescript
// 공통 핸들러 코드 탐색
private resolveHandlerCode(
  controls: ControlDefinition[],
  eventHandlers: EventHandler[],
  payload: EventPayload,
): string | null { /* ... */ }

// 공통 실행 흐름
private async executeEventBase(
  controls: ControlDefinition[],
  eventHandlers: EventHandler[],
  payload: EventPayload,
  options: { isShell: boolean; shellDef?: ShellDefinition },
): Promise<ExecutionResult> { /* ... */ }

// 각 메서드는 얇은 래퍼로
async executeEvent(formId: string, payload: EventPayload) {
  const formDef = await this.loadFormDef(formId);
  return this.executeEventBase(formDef.controls, formDef.eventHandlers, payload, { isShell: false });
}

async executeShellEvent(shellId: string, payload: EventPayload) {
  const shellDef = await this.loadShellDef(shellId);
  return this.executeEventBase(shellDef.controls, shellDef.eventHandlers, payload, { isShell: true, shellDef });
}
```

---

### #14. SandboxRunner.wrapHandlerCode — 394줄 거대 함수 분해

**파일:** `packages/server/src/services/SandboxRunner.ts:400-793`

**문제:**
단일 함수에 7가지 책임이 혼재.

**수정 방안 — private 메서드로 분해:**
```typescript
class SandboxRunner {
  // 현재 394줄의 wrapHandlerCode를 다음으로 분해:
  private buildTraceSetup(): string { /* L409-445 */ }
  private buildShellSetup(shellDef: ShellDefinition): string { /* L455-490 */ }
  private buildConsoleShim(): string { /* L539-543 */ }
  private buildFlushChangesHelper(): string { /* deep diff + flush 로직 */ }
  private buildJsonPathImpl(): string { /* L635-768 (~130줄) */ }
  private buildMongoBindings(connectors: MongoConnectorInfo[]): string { /* L595-610 */ }
  private buildSwaggerBindings(connectors: SwaggerConnectorInfo[]): string { /* L610-625 */ }

  wrapHandlerCode(code: string, options: WrapOptions): string {
    const parts = [
      options.debugMode ? this.buildTraceSetup() : '',
      options.isShell ? this.buildShellSetup(options.shellDef!) : '',
      this.buildConsoleShim(),
      this.buildFlushChangesHelper(),
      this.buildJsonPathImpl(),
      this.buildMongoBindings(options.mongoConnectors),
      this.buildSwaggerBindings(options.swaggerConnectors),
      code,
    ];
    return this.wrapInAsyncFunction(parts.join('\n'));
  }
}
```

추가: `CodeInstrumenter.generateTraceWrapper()`가 이미 존재하므로 `buildTraceSetup()`은 이를 재사용해야 함.

---

### #15. TrafficLightButtons 컴포넌트 중복 제거

**파일:**
- `packages/runtime/src/renderer/FormContainer.tsx:29-59`
- `packages/runtime/src/renderer/ShellRenderer.tsx:146-176`

**문제:**
동일한 `TrafficLightButtons` 컴포넌트 + `titleTextStyle` 상수가 두 파일에 복사됨.

**수정 방안:**
```typescript
// packages/runtime/src/components/TrafficLightButtons.tsx
export const titleTextStyle: CSSProperties = { /* ... */ };

interface TrafficLightButtonsProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  showMinimize?: boolean;
  showMaximize?: boolean;
}

export function TrafficLightButtons({ ... }: TrafficLightButtonsProps) { /* ... */ }
```

두 파일에서 임포트하여 사용.

---

### #16. 런타임 컨트롤 — computeFontStyle 인라인 재구현

**파일:** 7개 컨트롤 (`DataGridView`, `MongoDBView`, `SpreadsheetView`, `JsonEditor`, `GraphView`, `RichTextBox`, `Chart`)

**문제:**
`layoutUtils.ts`에 `computeFontStyle()` 함수가 이미 존재하는데, 일부 컨트롤이 동일한 로직을 `useMemo` 안에 인라인으로 재구현.

**수정 방안:**
각 컨트롤에서 인라인 폰트 스타일 계산을 제거하고 공통 함수 사용:
```typescript
import { computeFontStyle } from '../utils/layoutUtils';

// 각 컨트롤 내부
const fontStyle = useMemo(() => computeFontStyle(font), [font]);
```

---

### #17. formDef 변환 코드 3곳 중복

**파일:**
- `packages/server/src/routes/runtime.ts:172-181`
- `packages/server/src/websocket/runtimeEvents.ts:36-44`
- `packages/server/src/websocket/appEvents.ts:166-174`

**문제:**
MongoDB Form 모델 → `formDef` 객체 변환 코드가 3곳에 동일하게 존재.

**수정 방안:**
```typescript
// services/FormService.ts 또는 utils/formUtils.ts
export function toFormDef(form: FormDocument): FormDefinition {
  return {
    id: form._id.toString(),
    name: form.name,
    version: form.version,
    properties: form.properties,
    controls: form.controls,
    eventHandlers: form.eventHandlers,
    dataBindings: form.dataBindings,
  };
}
```

3곳에서 임포트하여 사용.

---

### #18. CodeInstrumenter / SandboxRunner trace 래퍼 중복

**파일:**
- `packages/server/src/services/CodeInstrumenter.ts:44-72` (`generateTraceWrapper`)
- `packages/server/src/services/SandboxRunner.ts:409-445` (`traceSetup` 인라인 변수)

**문제:**
`__trace`, `__captureVars` 함수의 JS 코드가 두 파일에 별도 정의.
`CodeInstrumenter.generateTraceWrapper()`가 이미 존재하는데 `SandboxRunner`에서 사용하지 않음.

**수정 방안:**
`SandboxRunner.wrapHandlerCode()` 내의 `traceSetup` 코드를 제거하고 `CodeInstrumenter.generateTraceWrapper()`를 호출:
```typescript
const traceSetup = options.debugMode
  ? this.codeInstrumenter.generateTraceWrapper()
  : '';
```

---

## Part B: 타입 안전성 개선

### #19. UIPatch → Discriminated Union

**파일:** `packages/common/src/types/protocol.ts:4-9`

**현재:**
```typescript
export interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate'
    | 'updateShell' | 'updateAppState' | 'closeApp' | 'authLogout';
  target: string;
  payload: Record<string, unknown>; // 모든 타입이 동일한 payload
}
```

**수정 방안:**
```typescript
export type UIPatch =
  | { type: 'updateProperty'; target: string; payload: Record<string, unknown> }
  | { type: 'addControl'; target: string; payload: { control: ControlDefinition; parentId?: string } }
  | { type: 'removeControl'; target: string; payload: Record<string, never> }
  | { type: 'showDialog'; target: string; payload: {
      text: string; title?: string;
      dialogType?: 'info' | 'warning' | 'error' | 'success';
      buttons?: string[];
    }}
  | { type: 'navigate'; target: string; payload: {
      formId?: string; params?: Record<string, unknown>; back?: boolean;
    }}
  | { type: 'updateShell'; target: string; payload: Record<string, unknown> }
  | { type: 'updateAppState'; target: string; payload: Record<string, unknown> }
  | { type: 'closeApp'; target: string; payload: Record<string, never> }
  | { type: 'authLogout'; target: string; payload: Record<string, never> };
```

**영향:** `runtimeStore.ts`의 `as` 캐스팅 5곳 이상 제거 가능

---

### #20. DataSourceDefinition → Discriminated Union

**파일:** `packages/common/src/types/datasource.ts:31-36`

**현재:**
```typescript
export interface DataSourceDefinition {
  type: 'database' | 'restApi' | 'static';
  config: DatabaseConfig | RestApiConfig | StaticConfig; // type과 연동 안됨
}
```

**수정 방안:**
```typescript
interface DataSourceBase {
  id: string;
  name: string;
  description?: string;
}

export type DataSourceDefinition =
  | DataSourceBase & { type: 'database'; config: DatabaseConfig }
  | DataSourceBase & { type: 'restApi'; config: RestApiConfig }
  | DataSourceBase & { type: 'static'; config: StaticConfig };
```

**영향:** `DataSourceService`의 타입 분기에서 자동 타입 좁히기 적용

---

### #21. ControlDefinition.properties 타입 개선

**파일:** `packages/common/src/types/form.ts:63`

**현재:**
```typescript
export interface ControlDefinition {
  properties: Record<string, unknown>; // 완전한 타입 소거
}
```

**수정 방안 (점진적 접근):**

Phase 1 — 공통 속성 인터페이스 추가:
```typescript
export interface CommonControlProperties {
  text?: string;
  visible?: boolean;
  enabled?: boolean;
  font?: FontConfig;
  foreColor?: string;
  backColor?: string;
  [key: string]: unknown; // 하위 호환을 위해 인덱스 시그니처 유지
}

export interface ControlDefinition {
  properties: CommonControlProperties;
}
```

Phase 2 — 컨트롤 타입별 속성 (장기):
```typescript
export interface ButtonProperties extends CommonControlProperties {
  dialogResult?: string;
}

export interface TextBoxProperties extends CommonControlProperties {
  multiLine?: boolean;
  passwordChar?: string;
  maxLength?: number;
}
// ... 컨트롤 타입별 확장
```

---

### #22. applyPatchToState 타입 시그니처 수정

**파일:** `packages/runtime/src/stores/runtimeStore.ts:100-107`

**현재:**
```typescript
function applyPatchToState(
  state: {
    controlStates: Record<string, Record<string, unknown>>;
    currentFormDef: FormDefinition | null;
    dialogQueue: DialogMessage[];
    navigateRequest: NavigateRequest | null;
  },
  // ...
```

`authLogout` 패치 처리 시 `(state as unknown as { authLogoutRequested: boolean })` 캐스팅 필요.

**수정 방안:**
```typescript
function applyPatchToState(
  state: {
    controlStates: Record<string, Record<string, unknown>>;
    currentFormDef: FormDefinition | null;
    dialogQueue: DialogMessage[];
    navigateRequest: NavigateRequest | null;
    authLogoutRequested: boolean;  // 추가
  },
  patch: UIPatch, // #19의 discriminated union 적용 시 자동으로 타입 안전
): void {
  switch (patch.type) {
    case 'authLogout':
      state.authLogoutRequested = true; // 캐스팅 불필요
      break;
    // ...
  }
}
```
