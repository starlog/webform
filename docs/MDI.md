# Application Shell / MDI 시스템 구현 계획

## 1. 개요

### 1.1 문제점

현재 MenuStrip, ToolStrip, StatusStrip은 개별 폼(`FormDefinition`)에 속한 컨트롤이다.
폼 간 전환 시 이 컨트롤들이 사라지므로, 모든 폼에 동일한 Strip을 복제해야 하는 구조적 문제가 있다.

### 1.2 해결 방향

**Application Shell** 개념을 도입하여 앱 수준의 UI(메뉴, 툴바, 상태바)와 폼 수준의 UI(비즈니스 화면)를 분리한다.

```
┌─ Application Shell ─────────────────────────┐
│  MenuStrip         (Shell 소속, 항상 표시)     │
│  ToolStrip         (Shell 소속, 항상 표시)     │
├─────────────────────────────────────────────┤
│                                             │
│   ┌─ Form (교체 가능) ──────────────────┐    │
│   │  Button, TextBox, DataGrid ...     │    │
│   │  (비즈니스 컨트롤만)                  │    │
│   └────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│  StatusStrip       (Shell 소속, 항상 표시)     │
└─────────────────────────────────────────────┘
```

### 1.3 핵심 원칙

1. **Shell은 Project 당 하나** — 프로젝트 전체의 앱 프레임을 정의
2. **폼은 컨텐츠만** — Strip 컨트롤 없이 비즈니스 UI만 포함
3. **하위 호환성** — Shell이 없는 기존 프로젝트/폼도 정상 동작
4. **Shell도 Designer에서 편집** — 기존 폼 편집과 동일한 UX

---

## 2. 데이터 모델

### 2.1 ApplicationShell 타입 (신규)

**파일:** `packages/common/src/types/shell.ts`

```typescript
export interface ApplicationShellDefinition {
  id: string;                          // MongoDB ObjectId
  projectId: string;                   // 소속 프로젝트
  name: string;                        // 예: "Main Shell"
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];       // MenuStrip, ToolStrip, StatusStrip 등
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;                // 앱 시작 시 처음 표시할 폼 ID
}

export interface ShellProperties {
  title: string;                       // 앱 타이틀바 텍스트
  width: number;                       // 앱 전체 너비
  height: number;                      // 앱 전체 높이
  backgroundColor: string;
  font: FontDefinition;
  showTitleBar: boolean;
  formBorderStyle: FormBorderStyle;
  maximizeBox: boolean;
  minimizeBox: boolean;
}
```

### 2.2 Project 확장

```typescript
// 기존 ProjectDocument에 추가
interface ProjectDocument {
  // ... 기존 필드 ...
  shellId?: string;                    // ApplicationShell 참조 (없으면 Shell 미사용)
}
```

### 2.3 Shell에서 허용되는 컨트롤

Shell에는 **dock 전용 컨트롤만** 배치 가능:

| 컨트롤 | Dock 기본값 | 비고 |
|--------|------------|------|
| MenuStrip | Top | 최상단 메뉴바 |
| ToolStrip | Top | MenuStrip 아래 도구모음 |
| StatusStrip | Bottom | 최하단 상태바 |
| Panel | Top/Bottom/Left/Right | 커스텀 dock 영역 (사이드바 등) |

> **참고:** 추후 TreeView(네비게이션 트리), SplitContainer(좌측 메뉴 + 우측 컨텐츠) 등도 Shell 컨트롤로 확장 가능

### 2.4 MongoDB 스키마

```typescript
// packages/server/src/models/Shell.ts (신규)
const ShellSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  version: { type: Number, default: 1 },
  properties: { type: Schema.Types.Mixed, required: true },
  controls: [{ type: Schema.Types.Mixed }],
  eventHandlers: [{ type: Schema.Types.Mixed }],
  startFormId: { type: Schema.Types.ObjectId, ref: 'Form' },
  published: { type: Boolean, default: false },
  versions: [{ type: Schema.Types.Mixed }],        // 버전 히스토리
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });
```

---

## 3. Server API

### 3.1 Shell CRUD 엔드포인트 (신규)

**파일:** `packages/server/src/routes/shells.ts`

```
GET    /api/projects/:projectId/shell       Shell 조회 (프로젝트당 하나)
POST   /api/projects/:projectId/shell       Shell 생성
PUT    /api/projects/:projectId/shell       Shell 수정
DELETE /api/projects/:projectId/shell       Shell 삭제
POST   /api/projects/:projectId/shell/publish   Shell 퍼블리시
```

### 3.2 Runtime Shell 엔드포인트 (신규)

```
GET    /api/runtime/shells/:projectId       퍼블리시된 Shell 조회
POST   /api/runtime/shells/:projectId/events   Shell 이벤트 실행
```

### 3.3 기존 Runtime 엔드포인트 확장

```
GET    /api/runtime/forms/:id
  → 응답에 shellId 포함 여부 추가 (클라이언트가 Shell 필요 여부 판단)
```

### 3.4 Runtime 앱 로딩 플로우 (신규)

```
GET /api/runtime/app/:projectId
```

단일 API로 Shell + 시작 폼을 함께 반환:

```typescript
interface AppLoadResponse {
  shell: ApplicationShellDefinition | null;   // Shell 정의 (없으면 null)
  startForm: FormDefinition;                  // 시작 폼
}
```

---

## 4. Shell 이벤트 시스템

### 4.1 Shell 이벤트 타입

```typescript
// packages/common/src/types/events.ts 확장

export const SHELL_EVENTS = [
  'Load',              // Shell 최초 로드
  'FormChanged',       // 활성 폼 변경됨
  'BeforeFormChange',  // 폼 변경 전 (취소 가능)
] as const;

// Shell 내 컨트롤 이벤트는 기존과 동일:
// MenuStrip → 'ItemClicked'
// ToolStrip → 'ItemClicked'
// StatusStrip → 'ItemClicked'
```

### 4.2 Shell SandboxRunner Context 확장

Shell 이벤트 핸들러에서 사용하는 `ctx` 객체:

```javascript
// Shell 이벤트 핸들러 코드 예시
async function onMenuItemClicked(ctx) {
  const item = ctx.eventArgs.itemText;

  switch (item) {
    case 'New':
      ctx.navigate('form_new_document');    // 폼 전환
      break;
    case 'Open':
      ctx.navigate('form_file_browser', { mode: 'open' });
      break;
    case 'Exit':
      ctx.closeApp();                       // 앱 종료
      break;
  }

  // Shell 컨트롤 상태 변경 (StatusStrip 업데이트 등)
  ctx.controls.statusStrip1.items[0].text = `Current: ${item}`;
}
```

Shell ctx에 추가되는 API:

```typescript
interface ShellContext extends BaseContext {
  // 기존
  controls: Record<string, ControlProxy>;
  showMessage(text, title?, type?): void;
  http: HttpClient;

  // Shell 전용 추가
  navigate(formId: string, params?: Record<string, unknown>): void;
  currentFormId: string;                    // 현재 활성 폼 ID
  closeApp(): void;                         // 앱 종료

  // 폼과 Shell 간 공유 데이터
  appState: Record<string, unknown>;        // 앱 레벨 공유 상태
}
```

### 4.3 Shell 이벤트 요청 프로토콜

```typescript
// Shell 이벤트 요청 (기존 EventRequest 확장)
interface ShellEventRequest {
  projectId: string;                        // Shell은 projectId로 식별
  controlId: string;                        // Shell 내 컨트롤 ID
  eventName: string;
  eventArgs: EventArgs;
  shellState: Record<string, Record<string, unknown>>;  // Shell 컨트롤 상태
  currentFormId: string;                    // 현재 표시 중인 폼 ID
}
```

### 4.4 UIPatch 확장

```typescript
// 기존 UIPatch 타입에 Shell 관련 추가
type UIPatchType =
  | 'updateProperty'    // 기존
  | 'addControl'        // 기존
  | 'removeControl'     // 기존
  | 'showDialog'        // 기존
  | 'navigate'          // 기존 (폼 전환)
  | 'updateShell'       // 신규: Shell 컨트롤 상태 업데이트
  | 'closeApp';         // 신규: 앱 종료
```

---

## 5. Runtime 변경사항

### 5.1 앱 로딩 플로우 변경

**현재:**
```
URL: ?formId=xxx
→ fetchForm(formId)
→ SDUIRenderer(formDef)
```

**변경 후:**
```
URL: ?projectId=xxx 또는 ?projectId=xxx&formId=yyy
→ fetchApp(projectId)
→ AppShell 렌더링 (Shell 존재 시)
  └─ Shell 컨트롤 렌더링 (MenuStrip, ToolStrip, StatusStrip)
  └─ FormArea에 startForm 또는 지정 폼 렌더링
→ 폼 전환 시 FormArea만 교체

// Shell이 없으면 기존 방식대로 동작 (하위 호환)
URL: ?formId=xxx
→ fetchForm(formId) → 기존 방식
```

### 5.2 Runtime 컴포넌트 구조

```
<AppContainer>                          ← 신규: 최상위 앱 컨테이너
  <ShellRenderer shell={shellDef}>      ← 신규: Shell 렌더링
    <ShellDockTop>
      <MenuStrip />                     ← Shell 컨트롤
      <ToolStrip />                     ← Shell 컨트롤
    </ShellDockTop>

    <FormArea>                          ← 신규: 폼 교체 영역
      <FormContainer>                   ← 기존: 폼 렌더링
        <SDUIRenderer formDef={...} />
      </FormContainer>
    </FormArea>

    <ShellDockBottom>
      <StatusStrip />                   ← Shell 컨트롤
    </ShellDockBottom>
  </ShellRenderer>
</AppContainer>
```

### 5.3 Runtime Store 확장

```typescript
// runtimeStore 확장
interface RuntimeState {
  // 기존
  currentFormDef: FormDefinition | null;
  controlStates: Record<string, Record<string, unknown>>;
  dialogQueue: DialogMessage[];
  navigateRequest: NavigateRequest | null;

  // Shell 관련 추가
  shellDef: ApplicationShellDefinition | null;
  shellControlStates: Record<string, Record<string, unknown>>;  // Shell 컨트롤 상태
  appState: Record<string, unknown>;                            // 앱 레벨 공유 상태
  formHistory: string[];                                        // 폼 전환 히스토리

  // Shell 메서드
  setShellDef(def: ApplicationShellDefinition): void;
  updateShellControlState(controlId, property, value): void;
  applyShellPatches(patches: UIPatch[]): void;
}
```

### 5.4 WebSocket 변경

현재 per-form WebSocket을 Shell 모드에서는 **per-project**로 확장:

```typescript
// 현재
ws://host/ws/runtime/{formId}

// Shell 모드 추가
ws://host/ws/runtime/app/{projectId}
  → Shell 패치 수신 (Shell 컨트롤 상태 변경)
  → 폼 전환 시에도 WebSocket 연결 유지
  → 메시지에 scope 필드 추가: 'shell' | 'form'
```

```typescript
interface RuntimeWsMessage {
  type: 'event' | 'eventResult' | 'uiPatch' | 'dataRefresh' | 'error';
  scope?: 'shell' | 'form';             // 신규: 패치 대상 구분
  payload: unknown;
}
```

### 5.5 폼 전환 시 상태 관리

```
폼 A → 폼 B 전환 시:
1. Shell 상태 유지 (shellControlStates 보존)
2. 폼 A의 BeforeLeaving 이벤트 실행
3. 폼 A의 controlStates 클리어
4. 폼 B 로드 (fetchForm)
5. 폼 B의 controlStates 초기화
6. 폼 B의 Load/OnLoading 이벤트 실행
7. Shell의 FormChanged 이벤트 실행
```

---

## 6. Designer 변경사항

### 6.1 Shell 편집 모드

Designer에 **Shell 편집 모드**를 추가한다. 기존 폼 편집 모드와 전환 가능.

#### ProjectExplorer 트리 구조 변경

```
📁 프로젝트명
  ├── 🖥️ Application Shell          ← 신규: Shell 노드 (더블클릭으로 편집)
  ├── 📄 Form1
  ├── 📄 Form2
  └── 📄 Form3
```

#### Shell 편집 시 캔버스 구조

```
┌──────────────────────────────────────┐
│ [Shell 편집 모드]                      │
├──────────────────────────────────────┤
│  MenuStrip    ← 드롭/편집 가능         │
│  ToolStrip    ← 드롭/편집 가능         │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐    │
│  │   Form Preview Area          │    │
│  │   (비활성, 회색 배경)           │    │
│  │   "폼이 여기에 표시됩니다"      │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│  StatusStrip  ← 드롭/편집 가능        │
└──────────────────────────────────────┘
```

#### Shell 편집 시 Toolbox 필터

Shell 모드에서는 Toolbox에 Shell 호환 컨트롤만 표시:
- MenuStrip, ToolStrip, StatusStrip
- Panel (dock용 사이드바 등)

### 6.2 Designer Store 확장

```typescript
interface DesignerState {
  // 기존
  controls: ControlDefinition[];
  formProperties: FormProperties;
  currentFormId: string | null;

  // Shell 관련 추가
  editMode: 'form' | 'shell';                   // 현재 편집 모드
  shellControls: ControlDefinition[];            // Shell 컨트롤
  shellProperties: ShellProperties;              // Shell 속성
  currentShellId: string | null;

  // Shell 메서드
  setEditMode(mode: 'form' | 'shell'): void;
  loadShell(shellDef: ApplicationShellDefinition): void;
  addShellControl(control: ControlDefinition): void;
  updateShellControl(id, changes): void;
  setShellProperties(props: Partial<ShellProperties>): void;
}
```

### 6.3 PropertyPanel 확장

Shell 편집 모드에서:
- **컨트롤 미선택 시**: Shell 속성 표시 (title, width, height, startFormId 등)
- **컨트롤 선택 시**: 해당 Strip 컨트롤 속성 표시 (기존과 동일)
- **startFormId**: 프로젝트 내 폼 목록 드롭다운으로 선택

### 6.4 Shell 전용 속성

```typescript
const shellPropertyMeta: PropertyMeta[] = [
  // Layout
  { name: 'properties.width',    label: 'Width',    category: 'Layout',     editorType: 'number' },
  { name: 'properties.height',   label: 'Height',   category: 'Layout',     editorType: 'number' },

  // Appearance
  { name: 'properties.title',           label: 'Title',           category: 'Appearance', editorType: 'text' },
  { name: 'properties.backgroundColor', label: 'BackColor',       category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',            label: 'Font',            category: 'Appearance', editorType: 'font' },
  { name: 'properties.showTitleBar',    label: 'ShowTitleBar',    category: 'Appearance', editorType: 'boolean' },
  { name: 'properties.formBorderStyle', label: 'FormBorderStyle', category: 'Appearance', editorType: 'dropdown' },

  // Behavior
  { name: 'startFormId', label: 'StartForm', category: 'Behavior', editorType: 'formSelect' },
  { name: 'properties.maximizeBox', label: 'MaximizeBox', category: 'Behavior', editorType: 'boolean' },
  { name: 'properties.minimizeBox', label: 'MinimizeBox', category: 'Behavior', editorType: 'boolean' },
];
```

---

## 7. 아이템 컬렉션 에디터

### 7.1 필요성

현재 MenuStrip/ToolStrip/StatusStrip의 `items` 속성은 `editorType: 'collection'`으로 정의되어 있지만,
실제 컬렉션 에디터 UI가 없어 JSON을 직접 편집해야 한다.
Shell 시스템 도입과 함께 시각적 아이템 편집기를 구현한다.

### 7.2 MenuStrip 아이템 에디터

```
┌─ Menu Items Editor ─────────────────────────────┐
│                                                  │
│  ┌─ 트리뷰 ──────────┐  ┌─ 속성 ─────────────┐  │
│  │ 📁 File            │  │ Text: [File    ]   │  │
│  │   📄 New    Ctrl+N │  │ Shortcut: [     ]  │  │
│  │   📄 Open   Ctrl+O │  │ Enabled: [✓]       │  │
│  │   📄 Save   Ctrl+S │  │ Checked: [ ]       │  │
│  │   ── separator ──  │  │ Separator: [ ]     │  │
│  │   📄 Exit          │  │                    │  │
│  │ 📁 Edit            │  │                    │  │
│  │   📄 Cut           │  │                    │  │
│  │   📄 Copy          │  │                    │  │
│  │   📄 Paste         │  │                    │  │
│  │ 📁 View            │  │                    │  │
│  │ 📁 Help            │  │                    │  │
│  └────────────────────┘  └────────────────────┘  │
│                                                  │
│  [+ Add] [+ Add Child] [🗑 Delete] [↑] [↓]       │
│                                                  │
│                         [OK]  [Cancel]           │
└──────────────────────────────────────────────────┘
```

### 7.3 ToolStrip 아이템 에디터

```
┌─ ToolStrip Items Editor ────────────────────────┐
│                                                  │
│  ┌─ 리스트 ──────────┐  ┌─ 속성 ─────────────┐  │
│  │ 🔘 button: New    │  │ Type: [button ▼]   │  │
│  │ 🔘 button: Open   │  │ Text: [New     ]   │  │
│  │ 🔘 button: Save   │  │ Icon: [📄      ]   │  │
│  │ ── separator ──   │  │ Tooltip: [     ]   │  │
│  │ 🔘 button: Cut    │  │ Enabled: [✓]       │  │
│  │ 🔘 button: Copy   │  │ Checked: [ ]       │  │
│  │ 🔘 button: Paste  │  │                    │  │
│  └────────────────────┘  └────────────────────┘  │
│                                                  │
│  [+ Add] [🗑 Delete] [↑] [↓]                     │
│                                                  │
│                         [OK]  [Cancel]           │
└──────────────────────────────────────────────────┘
```

### 7.4 StatusStrip 아이템 에디터

```
┌─ StatusStrip Items Editor ──────────────────────┐
│                                                  │
│  ┌─ 리스트 ──────────┐  ┌─ 속성 ─────────────┐  │
│  │ 📝 label: Ready   │  │ Type: [label   ▼]  │  │
│  │ ██ progressBar    │  │ Text: [Ready   ]   │  │
│  │                   │  │ Spring: [✓]        │  │
│  │                   │  │ Width: [auto   ]   │  │
│  └────────────────────┘  └────────────────────┘  │
│                                                  │
│  [+ Add] [🗑 Delete] [↑] [↓]                     │
│                                                  │
│                         [OK]  [Cancel]           │
└──────────────────────────────────────────────────┘
```

---

## 8. 앱 레벨 공유 상태 (appState)

### 8.1 개념

Shell과 폼 간에 데이터를 공유하기 위한 앱 레벨 상태.
예: 로그인 사용자 정보, 전역 설정, 폼 간 전달 데이터.

### 8.2 사용 예시

```javascript
// Shell의 MenuStrip ItemClicked 핸들러
async function onMenuItemClicked(ctx) {
  if (ctx.eventArgs.itemText === 'Login') {
    ctx.navigate('form_login');
  }
}

// form_login의 Button Click 핸들러
async function onLoginButtonClick(ctx) {
  const user = ctx.controls.txtUsername.text;
  ctx.appState.currentUser = user;           // 앱 상태에 저장
  ctx.appState.isLoggedIn = true;
  ctx.navigate('form_dashboard');
}

// form_dashboard의 Load 핸들러
async function onLoad(ctx) {
  const user = ctx.appState.currentUser;     // 앱 상태에서 읽기
  ctx.controls.lblWelcome.text = `Welcome, ${user}!`;
}

// Shell의 FormChanged 핸들러
async function onFormChanged(ctx) {
  // StatusStrip에 현재 사용자 표시
  if (ctx.appState.isLoggedIn) {
    ctx.controls.statusStrip1.items[1].text = ctx.appState.currentUser;
  }
}
```

### 8.3 appState 구현

```typescript
// SandboxRunner에 appState 주입
// - Runtime에서 관리 (runtimeStore.appState)
// - Shell/Form 이벤트 실행 시 서버에 전달
// - 서버에서 변경된 appState를 UIPatch로 반환
// - 클라이언트에서 appState 업데이트

interface EventRequest {
  // 기존 필드...
  appState?: Record<string, unknown>;       // 앱 상태 전달
}

// UIPatch로 appState 변경 전파
{ type: 'updateAppState', target: '_system', payload: { key: 'currentUser', value: 'Felix' } }
```

---

## 9. 네비게이션 시스템 강화

### 9.1 현재 네비게이션

```typescript
// 현재: ctx.navigate(formId, params)
// → UIPatch { type: 'navigate', payload: { formId, params } }
// → Runtime: 현재 폼 언로드 → 새 폼 로드
```

### 9.2 Shell 모드 네비게이션

```typescript
// Shell 모드에서 navigate는 FormArea만 교체
// Shell은 유지됨

ctx.navigate(formId, params);              // 폼 교체 (히스토리 추가)
ctx.navigateBack();                        // 이전 폼으로 돌아가기
ctx.navigateReplace(formId, params);       // 현재 폼 교체 (히스토리 없음)
```

### 9.3 네비게이션 히스토리

```typescript
// runtimeStore에 히스토리 스택 관리
formHistory: [
  { formId: 'form_a', params: {} },
  { formId: 'form_b', params: { id: 123 } },    // ← 현재
]

// navigateBack() 시:
// - 스택에서 pop
// - 이전 폼으로 전환
// - Shell의 FormChanged 이벤트 발생
```

### 9.4 navigate 파라미터 전달

```javascript
// 폼 A에서
ctx.navigate('form_detail', { productId: 123, mode: 'edit' });

// form_detail의 Load 핸들러에서
async function onLoad(ctx) {
  const productId = ctx.params.productId;    // 123
  const mode = ctx.params.mode;              // 'edit'
}
```

---

## 10. 구현 단계

### Phase 1: 기반 구조 (Shell 없이도 동작하는 안전한 변경)

1. **common 패키지: Shell 타입 정의**
   - `ApplicationShellDefinition`, `ShellProperties` 인터페이스
   - `SHELL_EVENTS` 상수
   - `UIPatch` 타입 확장 (`updateShell`, `updateAppState`, `closeApp`)
   - `EventRequest`에 `appState`, `scope` 필드 추가

2. **server 패키지: Shell MongoDB 모델**
   - `Shell` Mongoose 스키마/모델
   - `ShellService` CRUD

3. **server 패키지: Shell API 엔드포인트**
   - `/api/projects/:projectId/shell` CRUD
   - `/api/runtime/shells/:projectId` 조회
   - `/api/runtime/app/:projectId` 앱 로딩 (Shell + startForm)

### Phase 2: Runtime Shell 렌더링

4. **runtime 패키지: Store 확장**
   - `shellDef`, `shellControlStates`, `appState`, `formHistory` 추가
   - Shell 패치 적용 로직

5. **runtime 패키지: Shell 렌더링 컴포넌트**
   - `AppContainer` — Shell + FormArea 합성
   - `ShellRenderer` — Shell 컨트롤 렌더링
   - Shell 모드 시 FormContainer를 FormArea 안에 렌더링

6. **runtime 패키지: 앱 로딩 플로우**
   - `?projectId=xxx` URL 파라미터 지원
   - Shell + startForm 동시 로드
   - Shell 없으면 기존 `?formId=xxx` 방식 유지

7. **runtime 패키지: 폼 전환 개선**
   - Shell 유지하면서 FormArea만 교체
   - 네비게이션 히스토리 관리
   - navigateBack 지원

### Phase 3: Server Shell 이벤트

8. **server 패키지: Shell 이벤트 엔진**
   - Shell 이벤트 요청 처리 (`/api/runtime/shells/:projectId/events`)
   - Shell ctx에 `navigate`, `currentFormId`, `appState`, `closeApp` 주입
   - Shell 컨트롤 상태 diff → UIPatch 생성

9. **server 패키지: appState 전달**
   - EventRequest에서 appState 수신
   - SandboxRunner ctx에 appState 주입
   - appState 변경 → UIPatch 반환

10. **WebSocket 확장**
    - `/ws/runtime/app/:projectId` 엔드포인트
    - scope 기반 메시지 라우팅 (`shell` / `form`)

### Phase 4: Designer Shell 편집

11. **designer 패키지: Shell 편집 모드**
    - `editMode: 'form' | 'shell'` 상태
    - ProjectExplorer에 Shell 노드 추가
    - Shell 캔버스 렌더링 (dock 영역 + FormArea 플레이스홀더)

12. **designer 패키지: Shell Toolbox 필터**
    - Shell 모드에서 허용 컨트롤만 표시
    - 드롭 시 자동 dock 배치

13. **designer 패키지: Shell 속성 편집**
    - Shell 속성 PropertyPanel
    - startFormId 폼 선택 드롭다운
    - Shell 이벤트 핸들러 편집

14. **designer 패키지: Shell 저장/로드**
    - apiService에 Shell CRUD 추가
    - Shell publish 기능

### Phase 5: 아이템 컬렉션 에디터

15. **designer 패키지: MenuStrip 아이템 에디터**
    - 트리뷰 기반 계층 구조 편집
    - 아이템 추가/삭제/순서 변경
    - 아이템 속성 편집 (text, shortcut, enabled, checked, separator)

16. **designer 패키지: ToolStrip 아이템 에디터**
    - 리스트 기반 편집
    - 타입 선택 (button, separator, label, dropdown)
    - 아이콘 선택

17. **designer 패키지: StatusStrip 아이템 에디터**
    - 리스트 기반 편집
    - 타입 선택 (label, progressBar, dropDownButton)
    - spring/width 속성

### Phase 6: 고급 기능

18. **Designer Canvas dock 레이아웃**
    - 폼 편집 시에도 dock 컨트롤 고정 배치
    - dock 컨트롤 드래그 이동 제한
    - dock 영역 높이만 리사이즈 가능

19. **Shell 프리뷰**
    - Designer에서 Shell + 폼 통합 프리뷰
    - 폼 편집 중 Shell 미리보기 토글

20. **Export/Import 확장**
    - 프로젝트 Export에 Shell 포함
    - Import 시 Shell 복원

---

## 11. 파일 변경 목록 요약

### 신규 파일

| 패키지 | 파일 | 설명 |
|--------|------|------|
| common | `src/types/shell.ts` | Shell 타입 정의 |
| server | `src/models/Shell.ts` | Shell Mongoose 모델 |
| server | `src/services/ShellService.ts` | Shell CRUD 서비스 |
| server | `src/routes/shells.ts` | Shell API 라우트 |
| runtime | `src/renderer/AppContainer.tsx` | 앱 컨테이너 (Shell + FormArea) |
| runtime | `src/renderer/ShellRenderer.tsx` | Shell 렌더링 |
| designer | `src/components/Editors/MenuItemEditor.tsx` | 메뉴 아이템 에디터 |
| designer | `src/components/Editors/ToolStripItemEditor.tsx` | 툴바 아이템 에디터 |
| designer | `src/components/Editors/StatusStripItemEditor.tsx` | 상태바 아이템 에디터 |

### 수정 파일

| 패키지 | 파일 | 변경 내용 |
|--------|------|----------|
| common | `src/types/form.ts` | UIPatch 타입 확장 |
| common | `src/types/events.ts` | SHELL_EVENTS 추가 |
| common | `src/types/protocol.ts` | EventRequest에 appState/scope 추가 |
| common | `src/index.ts` | shell.ts export 추가 |
| server | `src/routes/index.ts` | shells 라우트 등록 |
| server | `src/routes/runtime.ts` | `/app/:projectId` 엔드포인트 추가 |
| server | `src/services/EventEngine.ts` | Shell 이벤트 처리 분기 |
| server | `src/services/SandboxRunner.ts` | appState, navigate 등 ctx 확장 |
| server | `src/websocket/` | app 레벨 WebSocket 추가 |
| server | `src/routes/projects.ts` | shellId 필드 처리 |
| runtime | `src/App.tsx` | projectId 기반 앱 로딩, Shell 통합 |
| runtime | `src/stores/runtimeStore.ts` | Shell 상태, appState, formHistory |
| runtime | `src/communication/apiClient.ts` | Shell API 호출 추가 |
| runtime | `src/communication/wsClient.ts` | app WebSocket, scope 처리 |
| runtime | `src/renderer/SDUIRenderer.tsx` | Shell 모드 분기 |
| designer | `src/App.tsx` | Shell 편집 모드 전환 |
| designer | `src/stores/designerStore.ts` | Shell 상태/메서드 추가 |
| designer | `src/services/apiService.ts` | Shell API 호출 추가 |
| designer | `src/components/ProjectExplorer/` | Shell 노드 추가 |
| designer | `src/components/Canvas/DesignerCanvas.tsx` | Shell 편집 캔버스 |
| designer | `src/components/Toolbox/` | Shell 모드 필터 |
| designer | `src/components/PropertyPanel/` | Shell 속성 메타 추가 |

---

## 12. 하위 호환성

| 시나리오 | 동작 |
|----------|------|
| Shell이 없는 기존 프로젝트 | 변경 없이 기존 방식 동작 |
| `?formId=xxx` URL | Shell 없이 단일 폼 렌더링 (기존과 동일) |
| `?projectId=xxx` URL | Shell 있으면 Shell+startForm, 없으면 에러 |
| 기존 폼에 Strip 컨트롤이 있는 경우 | 정상 동작 (폼 내부에서 렌더링) |
| Shell + 폼 모두에 Strip이 있는 경우 | 둘 다 렌더링 (사용자가 폼에서 제거하면 됨) |

---

## 13. 향후 확장 가능성

- **MDI 탭 모드**: FormArea에 여러 폼을 탭으로 동시 열기
- **사이드 네비게이션**: Shell에 TreeView 배치하여 폼 목록 네비게이션
- **테마 시스템**: Shell 레벨에서 전체 앱 테마 관리
- **권한 관리**: Shell 메뉴/툴바 항목의 역할 기반 표시/숨김
- **다중 Shell**: 프로젝트 내 여러 Shell (관리자용, 사용자용 등)
