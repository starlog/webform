# PRD: WebForm - 웹 기반 Microsoft WinForm 클론

## 1. 개요

### 1.1 프로젝트 명
**WebForm** - Server-Driven UI 기반 비주얼 폼 디자이너

### 1.2 목적
Microsoft Visual Studio의 WinForm 디자이너와 동일한 경험을 웹 브라우저에서 제공한다. 사용자는 드래그 앤 드롭으로 UI를 설계하고, 이벤트 핸들러를 작성하며, 데이터 바인딩을 설정할 수 있다. 모든 폼 정의는 서버에 저장되고 서버가 UI를 구동하는 **Server-Driven UI(SDUI)** 아키텍처를 따른다.

### 1.3 핵심 가치
- **로우코드/노코드**: 비개발자도 업무용 폼 애플리케이션을 만들 수 있다
- **서버 중심**: 클라이언트 배포 없이 서버에서 UI 정의를 변경하면 즉시 반영된다
- **WinForm 호환 경험**: WinForm 개발자가 익숙한 워크플로우를 그대로 제공한다

### 1.4 기술 스택
| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18+, TypeScript 5+, Zustand (상태관리) |
| 디자이너 UI | react-dnd (드래그앤드롭), Monaco Editor (코드 편집) |
| 스타일링 | CSS Modules + 커스텀 WinForm 테마 |
| 백엔드 | Node.js, Express (또는 Fastify), TypeScript |
| 데이터베이스 | MongoDB (폼 정의/메타데이터), Redis (세션/캐시) |
| 통신 | REST API + WebSocket (실시간 미리보기) |
| 빌드 | Vite, pnpm workspace (모노레포) |

---

## 2. 사용자 페르소나

### P1: 폼 디자이너 (주요 사용자)
- 기존 WinForm 개발 경험이 있는 개발자
- Visual Studio 스타일의 드래그 앤 드롭 디자이너에 익숙함
- 업무용 데이터 입력/조회 폼을 빠르게 만들고 싶어함

### P2: 최종 사용자
- 디자이너가 만든 폼을 실행하여 데이터를 입력/조회하는 사용자
- 별도의 설치 없이 브라우저에서 폼을 사용

### P3: 시스템 관리자
- 폼 배포, 사용자 권한, 데이터소스 연결을 관리

---

## 3. 시스템 아키텍처

### 3.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    클라이언트 (Browser)                    │
│                                                         │
│  ┌─────────────────┐     ┌────────────────────────┐     │
│  │  Designer Mode   │     │    Runtime Mode         │     │
│  │  (폼 디자이너)    │     │    (폼 실행기)          │     │
│  │                  │     │                        │     │
│  │  - Toolbox       │     │  - SDUI Renderer       │     │
│  │  - Canvas        │     │  - Event Executor      │     │
│  │  - Properties    │     │  - Data Binder         │     │
│  │  - Event Editor  │     │                        │     │
│  └────────┬─────────┘     └───────────┬────────────┘     │
│           │                           │                  │
└───────────┼───────────────────────────┼──────────────────┘
            │ REST/WS                   │ REST/WS
┌───────────┼───────────────────────────┼──────────────────┐
│           ▼         서버 (Node.js)     ▼                  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              API Gateway / Router                 │   │
│  └──────────┬──────────┬──────────┬─────────────────┘   │
│             │          │          │                      │
│  ┌──────────▼───┐ ┌────▼─────┐ ┌─▼──────────────┐      │
│  │ Form Service  │ │ Event    │ │ DataSource     │      │
│  │              │ │ Engine   │ │ Service         │      │
│  │ - CRUD       │ │          │ │                 │      │
│  │ - Versioning │ │ - Server │ │ - DB Connector  │      │
│  │ - Publishing │ │   Side   │ │ - REST Proxy    │      │
│  │              │ │   Script │ │ - Query Builder │      │
│  └──────┬───────┘ │ Engine   │ │                 │      │
│         │         └────┬─────┘ └────┬────────────┘      │
│         │              │            │                    │
│  ┌──────▼──────────────▼────────────▼────────────┐      │
│  │              MongoDB / Redis                   │      │
│  └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Server-Driven UI 흐름

```
1. 디자이너 → 폼 정의(JSON) 저장 → 서버 DB
2. 런타임 요청 → 서버가 폼 정의 JSON 응답
3. 클라이언트 SDUI 렌더러가 JSON → React 컴포넌트 변환
4. 사용자 이벤트 → 서버로 전송 → 서버 이벤트 엔진 실행
5. 서버가 UI 업데이트 지시(패치) → 클라이언트 반영
```

### 3.3 폼 정의 스키마 (Form Definition Schema)

```typescript
interface FormDefinition {
  id: string;
  name: string;
  version: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
}

interface FormProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  startPosition: 'CenterScreen' | 'Manual' | 'CenterParent';
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
}

interface ControlDefinition {
  id: string;
  type: ControlType;
  name: string;            // e.g., "btnSubmit", "txtName"
  properties: Record<string, any>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: ControlDefinition[];  // 컨테이너 컨트롤용
  anchor: AnchorStyle;
  dock: DockStyle;
  tabIndex: number;
  visible: boolean;
  enabled: boolean;
}

interface EventHandlerDefinition {
  controlId: string;
  eventName: string;       // e.g., "onClick", "onTextChanged"
  handlerType: 'server' | 'client';
  handlerCode: string;     // TypeScript/JavaScript 코드
}

interface DataBindingDefinition {
  controlId: string;
  controlProperty: string; // e.g., "text", "items", "dataSource"
  dataSourceId: string;
  dataField: string;
  bindingMode: 'oneWay' | 'twoWay' | 'oneTime';
}
```

---

## 4. 기능 요구사항

### 4.1 폼 디자이너 (Designer Mode)

#### 4.1.1 레이아웃 - Visual Studio 스타일 IDE

```
┌──────────────────────────────────────────────────────────────┐
│  File  Edit  View  Build  Tools  Help                        │
├──────┬───────────────────────────────────────┬───────────────┤
│      │                                       │  Properties   │
│ Tool │         Design Canvas                 │───────────────│
│ box  │                                       │  Name:        │
│      │    ┌─────────────────────────┐        │  [txtName   ] │
│──────│    │  Form1                  │        │               │
│      │    │  ┌──────┐ ┌─────────┐  │        │  Text:        │
│Button│    │  │Label1│ │TextBox1 │  │        │  [Hello     ] │
│Label │    │  └──────┘ └─────────┘  │        │               │
│TextBx│    │                         │        │  Size:        │
│ComboB│    │  ┌──────────────────┐  │        │  W[100] H[23]│
│CheckB│    │  │   Button1        │  │        │               │
│Radio │    │  └──────────────────┘  │        │  Location:    │
│ListBx│    │                         │        │  X[12] Y[45] │
│Grid  │    └─────────────────────────┘        │               │
│Panel │                                       │  Font:        │
│TabCtl│                                       │  [Segoe UI 9]│
│Group │                                       │               │
│      │                                       │  Events ▼     │
│      │                                       │  Click:       │
│      │                                       │  [btnClick  ] │
│      │                                       │  MouseEnter:  │
│      │                                       │  [          ] │
├──────┴───────────────────────────────────────┴───────────────┤
│  Output: Build succeeded.                                    │
└──────────────────────────────────────────────────────────────┘
```

#### 4.1.2 도구상자 (Toolbox)

**기본 컨트롤 (Phase 1)**

| 컨트롤 | 설명 | WinForm 대응 |
|---------|------|-------------|
| `Button` | 클릭 버튼 | System.Windows.Forms.Button |
| `Label` | 텍스트 레이블 | Label |
| `TextBox` | 단일행/다중행 텍스트 입력 | TextBox |
| `CheckBox` | 체크박스 | CheckBox |
| `RadioButton` | 라디오 버튼 | RadioButton |
| `ComboBox` | 드롭다운 선택 | ComboBox |
| `ListBox` | 목록 선택 | ListBox |
| `NumericUpDown` | 숫자 입력 (스피너) | NumericUpDown |
| `DateTimePicker` | 날짜/시간 선택 | DateTimePicker |
| `ProgressBar` | 진행률 표시 | ProgressBar |
| `PictureBox` | 이미지 표시 | PictureBox |

**컨테이너 컨트롤 (Phase 1)**

| 컨트롤 | 설명 |
|---------|------|
| `Panel` | 컨트롤 그룹핑 패널 |
| `GroupBox` | 테두리 + 제목이 있는 그룹 |
| `TabControl` | 탭 페이지 컨테이너 |
| `SplitContainer` | 분할 패널 |

**데이터 컨트롤 (Phase 2)**

| 컨트롤 | 설명 |
|---------|------|
| `DataGridView` | 데이터 그리드 (정렬/필터/편집) |
| `BindingNavigator` | 레코드 탐색 바 |
| `Chart` | 차트/그래프 |
| `TreeView` | 트리 구조 표시 |
| `ListView` | 리스트/아이콘 뷰 |

**고급 컨트롤 (Phase 3)**

| 컨트롤 | 설명 |
|---------|------|
| `MenuStrip` | 메뉴 바 |
| `ToolStrip` | 툴바 |
| `StatusStrip` | 상태 바 |
| `RichTextBox` | 서식 있는 텍스트 편집기 |
| `WebBrowser` | 임베디드 웹 뷰 (iframe) |

#### 4.1.3 디자인 캔버스 (Design Canvas)

- **그리드 스냅**: 설정 가능한 그리드에 컨트롤 위치 스냅 (기본 8px)
- **드래그 앤 드롭**: 도구상자에서 캔버스로 컨트롤 드래그하여 배치
- **리사이즈 핸들**: 8방향 리사이즈 핸들 (WinForm과 동일)
- **다중 선택**: Ctrl+클릭, 또는 마우스 드래그로 다중 선택
- **정렬 가이드**: 스냅라인 (Snaplines) - 컨트롤 간 정렬 시 시각적 가이드라인 표시
- **Z-Order**: 컨트롤 순서 변경 (앞으로/뒤로 보내기)
- **복사/붙여넣기**: Ctrl+C, Ctrl+V로 컨트롤 복제
- **Undo/Redo**: Ctrl+Z, Ctrl+Y (최소 50단계)
- **Anchor & Dock**: 폼 리사이즈 시 컨트롤 동작 설정
  - Anchor: Top, Bottom, Left, Right 조합
  - Dock: None, Top, Bottom, Left, Right, Fill
- **Tab Order 설정**: 탭 키 이동 순서 시각적 편집

#### 4.1.4 속성 패널 (Properties Panel)

WinForm의 Properties Window를 재현:

- **카테고리별 분류**: Appearance, Behavior, Data, Layout, Design 등
- **알파벳순/카테고리순 전환**
- **속성 에디터 타입**:
  - 텍스트 입력 (Text, Name)
  - 숫자 입력 (Width, Height, X, Y)
  - 색상 선택기 (BackColor, ForeColor)
  - 폰트 선택기 (Font)
  - 드롭다운 (TextAlign, BorderStyle)
  - 불리언 토글 (Visible, Enabled, ReadOnly)
  - 컬렉션 에디터 (Items, Columns) - 모달 다이얼로그
  - Anchor 에디터 - 시각적 앵커 설정 UI
- **이벤트 탭**: 번개 아이콘 클릭 시 이벤트 목록 표시

#### 4.1.5 이벤트 시스템 (Event System)

##### 이벤트 목록

각 컨트롤 타입별로 지원하는 이벤트:

**공통 이벤트:**
- `Click`, `DoubleClick`
- `MouseEnter`, `MouseLeave`, `MouseDown`, `MouseUp`, `MouseMove`
- `KeyDown`, `KeyUp`, `KeyPress`
- `Enter` (포커스 진입), `Leave` (포커스 이탈)
- `Validating`, `Validated`
- `VisibleChanged`, `EnabledChanged`

**컨트롤별 이벤트:**
- TextBox: `TextChanged`, `KeyPress`
- ComboBox: `SelectedIndexChanged`, `DropDown`, `DropDownClosed`
- CheckBox: `CheckedChanged`
- DataGridView: `CellClick`, `CellValueChanged`, `RowEnter`, `SelectionChanged`
- Form: `Load`, `Shown`, `FormClosing`, `FormClosed`, `Resize`

##### 이벤트 핸들러 작성

Properties 패널의 이벤트 탭에서 이벤트 이름을 더블 클릭하면 코드 에디터(Monaco Editor)가 열린다:

```typescript
// 서버 사이드 이벤트 핸들러 예시
async function btnSave_Click(sender: Button, e: EventArgs, ctx: FormContext) {
  // ctx를 통해 다른 컨트롤에 접근
  const name = ctx.controls.txtName.text;
  const email = ctx.controls.txtEmail.text;

  // 유효성 검사
  if (!name) {
    ctx.controls.lblError.text = "이름을 입력해주세요.";
    ctx.controls.lblError.foreColor = "red";
    return;
  }

  // 데이터소스를 통한 DB 저장
  await ctx.dataSources.userDB.collection('users').insertOne({
    name,
    email,
    createdAt: new Date()
  });

  // UI 업데이트
  ctx.controls.lblStatus.text = "저장 완료!";
  ctx.controls.txtName.text = "";
  ctx.controls.txtEmail.text = "";

  // 그리드 갱신
  await ctx.controls.gridUsers.refreshData();
}
```

##### 이벤트 실행 모드

| 모드 | 실행 위치 | 용도 |
|------|----------|------|
| `server` | Node.js 서버 | DB 접근, 비즈니스 로직, 보안이 필요한 처리 |
| `client` | 브라우저 | UI 즉각 반응 (유효성 검사, 토글, 포커스 이동 등) |

- 기본값: `server` (SDUI 원칙에 따라)
- `client` 모드: 네트워크 지연 없이 즉각적인 UI 반응이 필요한 경우 사용
- 하이브리드: 클라이언트에서 기본 유효성 검사 후 서버에서 최종 처리

#### 4.1.6 데이터 바인딩 및 데이터 소스 (Data Binding & DataSource)

##### 데이터소스 설정

```typescript
interface DataSourceDefinition {
  id: string;
  name: string;                    // e.g., "userDB"
  type: 'database' | 'restApi' | 'static';
  config: DatabaseConfig | RestApiConfig | StaticConfig;
}

interface DatabaseConfig {
  dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite';
  connectionString: string;        // 암호화 저장 (e.g., "mongodb://host:27017/dbname")
  database: string;                // 데이터베이스 이름
}

interface RestApiConfig {
  baseUrl: string;
  headers: Record<string, string>;
  auth: AuthConfig;
}

interface StaticConfig {
  data: any[];                     // 정적 데이터 배열
}
```

##### 데이터 바인딩 모드

| 모드 | 설명 | 용도 |
|------|------|------|
| `oneWay` | 데이터소스 → 컨트롤 | 읽기 전용 표시 |
| `twoWay` | 데이터소스 ↔ 컨트롤 | 편집 가능 폼 |
| `oneTime` | 초기 로드 시 1회 | 코드 테이블 등 |

##### 데이터 바인딩 예시

```typescript
// DataGridView에 MongoDB 컬렉션 바인딩
{
  controlId: "gridUsers",
  controlProperty: "dataSource",
  dataSourceId: "userDB",
  dataField: {
    collection: "users",
    filter: {},
    sort: { _id: 1 },
    projection: { name: 1, email: 1, createdAt: 1 }
  },
  bindingMode: "oneWay"
}

// TextBox에 선택된 행의 필드 바인딩
{
  controlId: "txtName",
  controlProperty: "text",
  dataSourceId: "gridUsers.selectedRow",
  dataField: "name",
  bindingMode: "twoWay"
}

// ComboBox에 정적 데이터 바인딩
{
  controlId: "cmbDepartment",
  controlProperty: "items",
  dataSourceId: "staticDepartments",
  dataField: "name",
  bindingMode: "oneTime"
}
```

---

### 4.2 폼 실행기 (Runtime Mode)

#### 4.2.1 SDUI 렌더러

1. 서버에서 `FormDefinition` JSON 수신
2. JSON을 파싱하여 React 컴포넌트 트리로 변환
3. 각 `ControlDefinition`을 대응하는 React 컴포넌트로 매핑
4. 레이아웃(position, size, anchor, dock) 적용
5. 데이터 바인딩 초기화 및 데이터 로드
6. 이벤트 핸들러 연결

```typescript
// SDUI 렌더러 핵심 로직
function SDUIRenderer({ formDefinition }: { formDefinition: FormDefinition }) {
  return (
    <FormContainer properties={formDefinition.properties}>
      {formDefinition.controls.map(control => (
        <ControlRenderer
          key={control.id}
          definition={control}
          bindings={formDefinition.dataBindings}
          events={formDefinition.eventHandlers}
        />
      ))}
    </FormContainer>
  );
}

function ControlRenderer({ definition, bindings, events }: ControlRendererProps) {
  const Component = controlRegistry[definition.type]; // Button, TextBox 등
  const boundProps = useDataBinding(definition.id, bindings);
  const eventProps = useEventHandlers(definition.id, events);

  return (
    <Component
      {...definition.properties}
      {...boundProps}
      {...eventProps}
      style={computeLayoutStyle(definition)}
    >
      {definition.children?.map(child => (
        <ControlRenderer key={child.id} definition={child} ... />
      ))}
    </Component>
  );
}
```

#### 4.2.2 서버-클라이언트 이벤트 통신

```
사용자 클릭 → 클라이언트 이벤트 캡처
     │
     ▼
  [client 이벤트?] ──Yes──→ 클라이언트에서 직접 실행
     │ No
     ▼
  WebSocket/REST로 서버에 이벤트 전송
     │
     ▼
  서버 이벤트 엔진이 핸들러 코드 실행
     │
     ▼
  실행 결과를 UI 패치(Patch)로 변환
     │
     ▼
  클라이언트에 패치 전송 → UI 업데이트
```

##### UI 패치 프로토콜

```typescript
interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate';
  target: string;          // controlId 또는 formId
  payload: any;
}

// 예시: 서버 이벤트 실행 결과 패치
[
  { type: 'updateProperty', target: 'lblStatus', payload: { text: '저장 완료!', foreColor: 'green' } },
  { type: 'updateProperty', target: 'txtName', payload: { text: '' } },
  { type: 'updateProperty', target: 'gridUsers', payload: { refreshData: true } },
  { type: 'showDialog', target: null, payload: { type: 'info', message: '성공적으로 저장되었습니다.' } }
]
```

#### 4.2.3 WinForm 룩앤필

- Windows Classic / Windows 10 / Windows 11 스타일 테마 지원
- 컨트롤 렌더링은 WinForm과 최대한 유사하게 (회색 배경, 3D 테두리 등)
- 시스템 폰트, 색상 스킴 에뮬레이션
- 폼 제목 표시줄, 최소화/최대화/닫기 버튼 시각적 에뮬레이션

---

### 4.3 프로젝트 관리

#### 4.3.1 솔루션/프로젝트 구조

WinForm의 Solution/Project 개념 차용:

```
Solution (솔루션)
  └── Project (프로젝트)
        ├── Forms/
        │     ├── MainForm.wfd        (폼 정의 JSON)
        │     ├── LoginForm.wfd
        │     └── UserListForm.wfd
        ├── DataSources/
        │     ├── MainDB.wfds         (데이터소스 정의)
        │     └── ExternalAPI.wfds
        ├── SharedCode/
        │     └── Validators.ts       (공유 유틸리티)
        └── Assets/
              └── logo.png
```

#### 4.3.2 폼 간 네비게이션

```typescript
// 다른 폼 열기 (모달)
const result = await ctx.showDialog('LoginForm', { userId: 123 });
if (result.dialogResult === 'OK') {
  ctx.controls.lblUser.text = result.data.userName;
}

// 다른 폼으로 이동
ctx.navigate('UserListForm', { department: 'sales' });
```

#### 4.3.3 버전 관리 및 배포

| 기능 | 설명 |
|------|------|
| 버전 관리 | 폼 정의의 버전 히스토리 (자동 저장, 수동 버전) |
| 퍼블리싱 | Draft → Published 워크플로우 |
| 롤백 | 이전 버전으로 즉시 롤백 |
| 환경 분리 | Development / Staging / Production |

---

## 5. 비기능 요구사항

### 5.1 성능
- 폼 디자이너 로드: < 2초
- 폼 런타임 로드: < 1초
- 서버 이벤트 응답: < 200ms (p95)
- 동시 사용자: 최소 100명 동시 편집, 1000명 동시 실행
- 최대 컨트롤 수: 폼당 500개 컨트롤까지 원활한 동작

### 5.2 보안
- 서버 사이드 이벤트 핸들러 코드: 샌드박스 실행 (VM2 또는 isolated-vm)
- NoSQL 인젝션 방지: 쿼리 입력 검증 및 sanitize, $where 연산자 사용 금지
- 데이터소스 연결 정보: AES-256 암호화 저장
- RBAC (Role-Based Access Control): 폼별 읽기/쓰기/실행 권한
- CSRF, XSS 방지

### 5.3 확장성
- 커스텀 컨트롤 플러그인 시스템
- 커스텀 데이터소스 어댑터
- 외부 이벤트 훅 (Webhook)
- REST API를 통한 폼 정의 CRUD

---

## 6. API 설계

### 6.1 핵심 API 엔드포인트

```
# 폼 관리
GET    /api/forms                      # 폼 목록 조회
POST   /api/forms                      # 새 폼 생성
GET    /api/forms/:id                  # 폼 정의 조회
PUT    /api/forms/:id                  # 폼 정의 수정
DELETE /api/forms/:id                  # 폼 삭제
GET    /api/forms/:id/versions         # 버전 히스토리
POST   /api/forms/:id/publish          # 폼 퍼블리시

# 폼 런타임
GET    /api/runtime/forms/:id          # 런타임용 폼 정의 (published)
POST   /api/runtime/forms/:id/events   # 서버 이벤트 실행
POST   /api/runtime/forms/:id/data     # 데이터 바인딩 쿼리 실행

# 데이터소스
GET    /api/datasources                # 데이터소스 목록
POST   /api/datasources                # 데이터소스 생성
PUT    /api/datasources/:id            # 데이터소스 수정
POST   /api/datasources/:id/test       # 연결 테스트
POST   /api/datasources/:id/query      # 쿼리 실행 (디자이너 미리보기)

# 프로젝트
GET    /api/projects                   # 프로젝트 목록
POST   /api/projects                   # 프로젝트 생성
GET    /api/projects/:id/export        # 프로젝트 내보내기 (JSON)
POST   /api/projects/import            # 프로젝트 가져오기

# WebSocket
WS     /ws/designer/:formId            # 디자이너 실시간 동기화
WS     /ws/runtime/:formId             # 런타임 이벤트 통신
```

---

## 7. 프로젝트 구조 (모노레포)

```
webform/
├── packages/
│   ├── common/                        # 공유 타입/유틸리티
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── form.ts            # FormDefinition, ControlDefinition 등
│   │   │   │   ├── events.ts          # 이벤트 관련 타입
│   │   │   │   ├── datasource.ts      # 데이터소스 타입
│   │   │   │   └── protocol.ts        # SDUI 프로토콜 (UIPatch 등)
│   │   │   └── utils/
│   │   │       ├── validation.ts
│   │   │       └── serialization.ts
│   │   └── package.json
│   │
│   ├── designer/                      # 폼 디자이너 (React SPA)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Canvas/            # 디자인 캔버스
│   │   │   │   ├── Toolbox/           # 도구상자
│   │   │   │   ├── PropertyPanel/     # 속성 패널
│   │   │   │   ├── EventEditor/       # 이벤트 코드 편집기
│   │   │   │   ├── DataSourcePanel/   # 데이터소스 설정
│   │   │   │   └── ProjectExplorer/   # 프로젝트 탐색기
│   │   │   ├── stores/                # Zustand 상태 관리
│   │   │   │   ├── designerStore.ts   # 캔버스 상태
│   │   │   │   ├── selectionStore.ts  # 선택 상태
│   │   │   │   └── historyStore.ts    # Undo/Redo 히스토리
│   │   │   ├── hooks/
│   │   │   ├── controls/              # 디자이너용 컨트롤 렌더러
│   │   │   └── themes/
│   │   └── package.json
│   │
│   ├── runtime/                       # 폼 런타임 (React)
│   │   ├── src/
│   │   │   ├── renderer/
│   │   │   │   ├── SDUIRenderer.tsx   # SDUI 렌더러 메인
│   │   │   │   └── ControlRenderer.tsx
│   │   │   ├── controls/              # 런타임용 컨트롤 구현체
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── TextBox.tsx
│   │   │   │   ├── DataGridView.tsx
│   │   │   │   └── ...
│   │   │   ├── bindings/              # 데이터 바인딩 엔진
│   │   │   ├── events/                # 클라이언트 이벤트 처리
│   │   │   └── communication/         # 서버 통신 (WS/REST)
│   │   └── package.json
│   │
│   └── server/                        # 백엔드 (Node.js)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── forms.ts
│       │   │   ├── runtime.ts
│       │   │   ├── datasources.ts
│       │   │   └── projects.ts
│       │   ├── services/
│       │   │   ├── FormService.ts
│       │   │   ├── EventEngine.ts     # 서버 사이드 이벤트 실행
│       │   │   ├── DataSourceService.ts
│       │   │   └── SandboxRunner.ts   # 코드 샌드박스 실행
│       │   ├── models/
│       │   ├── middleware/
│       │   └── websocket/
│       │       ├── designerSync.ts
│       │       └── runtimeEvents.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
└── PRD.md
```

---

## 8. 구현 단계 (Phase Plan)

### Phase 1: 코어 디자이너 + 기본 런타임 (8주)

**목표**: 기본 컨트롤로 폼을 디자인하고 실행할 수 있는 MVP

| 주차 | 작업 |
|------|------|
| 1-2 | 모노레포 셋업, 공통 타입 정의, 기본 서버 API (폼 CRUD) |
| 3-4 | 디자인 캔버스 (드래그앤드롭, 리사이즈, 스냅 그리드, 선택) |
| 5 | 도구상자 + 기본 컨트롤 6종 (Button, Label, TextBox, CheckBox, ComboBox, Panel) |
| 6 | 속성 패널 (속성 에디터, 카테고리 분류) |
| 7 | SDUI 런타임 렌더러 + 클라이언트 이벤트 |
| 8 | 서버 이벤트 엔진 (샌드박스) + 통합 테스트 |

**산출물**: 기본 폼을 디자인하고, 버튼 클릭 시 텍스트 변경과 같은 간단한 동작이 가능한 프로토타입

### Phase 2: 데이터 바인딩 + 고급 컨트롤 (6주)

| 주차 | 작업 |
|------|------|
| 9-10 | 데이터소스 설정 UI + DB 커넥터 (MongoDB) |
| 11-12 | 데이터 바인딩 엔진 (oneWay, twoWay) + DataGridView |
| 13 | 나머지 기본 컨트롤 완성 (RadioButton, ListBox, NumericUpDown, DateTimePicker 등) |
| 14 | Anchor/Dock 레이아웃 시스템 + Tab Order |

**산출물**: DB 연결 → 그리드 표시 → 편집 → 저장이 가능한 데이터 중심 폼

### Phase 3: 완성도 향상 (6주)

| 주차 | 작업 |
|------|------|
| 15-16 | 폼 간 네비게이션, 모달 다이얼로그, 파라미터 전달 |
| 17 | 버전 관리 + 퍼블리싱 워크플로우 |
| 18 | Undo/Redo 고도화, 복사/붙여넣기, 스냅라인 |
| 19 | WinForm 테마 (Windows Classic, Windows 10/11) |
| 20 | REST API 데이터소스 + 인증 |

**산출물**: 프로덕션 수준의 폼 빌더

### Phase 4: 엔터프라이즈 기능 (4주 이상)

- RBAC 권한 관리
- 프로젝트 내보내기/가져오기
- 커스텀 컨트롤 플러그인
- 다중 사용자 동시 편집
- 감사 로그 (Audit Log)
- Chart, TreeView, ListView 등 고급 컨트롤

---

## 9. 성공 지표 (KPI)

| 지표 | 목표 |
|------|------|
| 폼 생성 → 실행까지 시간 | 5분 이내 (간단한 CRUD 폼 기준) |
| 디자이너 FPS | 60fps (드래그 중) |
| 서버 이벤트 응답 시간 | p95 < 200ms |
| 폼 정의 로드 시간 | < 500ms |
| 컨트롤 100개 폼 렌더링 | < 1초 |

---

## 10. 리스크 및 완화 방안

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| 서버 이벤트 코드 보안 취약점 | 높음 | isolated-vm 샌드박스, 실행 시간 제한, 리소스 제한 |
| 복잡한 폼에서 성능 저하 | 중간 | 가상화 렌더링 (DataGridView), 컨트롤 수 제한 경고 |
| WinForm 호환성 한계 | 중간 | 지원 컨트롤/속성 매트릭스 문서화, 미지원 항목 명확히 고지 |
| SDUI 네트워크 지연 | 중간 | WebSocket 기본 사용, 낙관적 UI 업데이트, 클라이언트 이벤트 병행 |
| 데이터소스 연결 보안 | 높음 | 연결 정보 암호화, 네트워크 ACL, 쿼리 화이트리스트 옵션 |

---

## 11. 용어 사전

| 용어 | 정의 |
|------|------|
| **SDUI** | Server-Driven UI. 서버가 UI 구조를 정의하고 클라이언트가 렌더링하는 아키텍처 |
| **FormDefinition** | 폼의 전체 구조를 기술하는 JSON 스키마 |
| **ControlDefinition** | 개별 컨트롤(버튼, 텍스트박스 등)의 속성/위치/크기 정의 |
| **UIPatch** | 서버 이벤트 실행 결과를 클라이언트에 전달하는 UI 변경 명령 |
| **EventEngine** | 서버에서 이벤트 핸들러 코드를 샌드박스 내에서 실행하는 엔진 |
| **DataBinding** | 데이터소스의 값을 컨트롤 속성에 자동으로 연결하는 메커니즘 |
| **Snapline** | 컨트롤 정렬 시 나타나는 시각적 가이드라인 |
| **Anchor** | 부모 컨테이너 리사이즈 시 컨트롤이 어느 가장자리에 고정되는지 설정 |
| **Dock** | 컨트롤이 부모 컨테이너의 특정 방향에 자동으로 채워지는 레이아웃 모드 |
