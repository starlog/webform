import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ── 가이드 마크다운 문서 ──

const EVENT_CONTEXT_GUIDE = `# ctx (이벤트 컨텍스트) API 가이드

WebForm 이벤트 핸들러는 \`ctx\` 객체를 통해 폼의 상태를 읽고 쓸 수 있습니다.
핸들러 코드는 서버의 isolated-vm 샌드박스에서 실행됩니다.

## 1. ctx.controls — 컨트롤 프록시

폼 내 모든 컨트롤을 **이름(name)**으로 접근합니다. 속성을 읽거나 쓰면 자동으로 UI 패치가 생성됩니다.

\`\`\`javascript
// 읽기
let value = ctx.controls.txtEmail.text;
let isChecked = ctx.controls.chkAgree.checked;

// 쓰기 (자동 UI 패치)
ctx.controls.lblStatus.text = "처리 완료";
ctx.controls.btnSubmit.enabled = false;
ctx.controls.progressBar1.value = 75;
ctx.controls.dgvUsers.dataSource = [...data];
\`\`\`

## 2. ctx.sender — 이벤트 발생 컨트롤

현재 이벤트를 발생시킨 컨트롤의 프록시 객체입니다.

\`\`\`javascript
// 클릭된 버튼의 텍스트 변경
ctx.sender.text = "클릭됨!";
ctx.sender.enabled = false;
\`\`\`

## 3. ctx.eventArgs — 이벤트 인자

이벤트 타입에 따른 추가 정보를 포함합니다.

\`\`\`javascript
// { type: "Click", timestamp: 1234567890, ... }
let eventType = ctx.eventArgs.type;
\`\`\`

## 4. ctx.showMessage(text, title?, type?)

메시지 대화상자를 표시합니다.

- \`text\`: 메시지 내용 (필수)
- \`title\`: 대화상자 제목 (기본: "")
- \`type\`: \`"info"\` | \`"success"\` | \`"warning"\` | \`"error"\` (기본: "info")

\`\`\`javascript
ctx.showMessage("저장되었습니다", "성공", "success");
ctx.showMessage("필수 항목을 입력하세요", "입력 오류", "error");
\`\`\`

## 5. ctx.navigate(formId, params?)

다른 폼으로 이동합니다.

\`\`\`javascript
ctx.navigate("frmUserDetail", { userId: 123 });
\`\`\`

## 6. ctx.close(dialogResult?)

현재 폼 또는 대화상자를 닫습니다.

- \`dialogResult\`: \`"OK"\` | \`"Cancel"\` (대화상자일 때 사용)

\`\`\`javascript
ctx.close("OK");
\`\`\`

## 7. ctx.http — HTTP 요청

외부 API를 호출합니다. 동기식으로 사용할 수 있습니다.

### 메서드
- \`ctx.http.get(url)\`
- \`ctx.http.post(url, body)\`
- \`ctx.http.put(url, body)\`
- \`ctx.http.patch(url, body)\`
- \`ctx.http.delete(url)\`

### 응답 구조
\`\`\`javascript
{
  status: 200,       // HTTP 상태 코드
  ok: true,          // 200-299 범위 여부
  data: { ... }      // JSON 파싱된 데이터
}
\`\`\`

### 사용 예제
\`\`\`javascript
let response = ctx.http.get("https://api.example.com/users");
if (response.ok) {
  ctx.controls.dgvUsers.dataSource = response.data;
}

let result = ctx.http.post("https://api.example.com/users", {
  name: ctx.controls.txtName.text,
  email: ctx.controls.txtEmail.text
});
\`\`\`

## 8. ctx.getRadioGroupValue(groupName)

같은 \`groupName\`을 가진 RadioButton 중 선택된 항목의 \`text\` 값을 반환합니다.
선택된 항목이 없으면 \`null\`을 반환합니다.

\`\`\`javascript
let paymentMethod = ctx.getRadioGroupValue("rgPayment");
// "CreditCard", "PayPal", "BankTransfer" 등
\`\`\`

## 9. MongoDBConnector 메서드

폼에 MongoDBConnector 컨트롤이 있으면 해당 컨트롤 이름으로 DB 작업이 가능합니다.

\`\`\`javascript
// mongoConn이라는 이름의 MongoDBConnector가 있을 때
let users = ctx.controls.mongoConn.find("users", { age: { $gt: 18 } });
let user = ctx.controls.mongoConn.findOne("users", { _id: "..." });
let result = ctx.controls.mongoConn.insertOne("users", { name: "Alice" });
let updated = ctx.controls.mongoConn.updateOne("users", { _id: "..." }, { name: "Bob" });
let deleted = ctx.controls.mongoConn.deleteOne("users", { _id: "..." });
let count = ctx.controls.mongoConn.count("users", { status: "active" });
\`\`\`

## 10. Shell 전용 API

Application Shell 모드에서만 사용 가능한 추가 API입니다.

### ctx.currentFormId
Shell에서 현재 활성 폼의 ID입니다.

### ctx.appState
애플리케이션 전체 상태 객체입니다. 읽기/쓰기 가능하며 폼 간 데이터 공유에 사용합니다.

\`\`\`javascript
ctx.appState.isLoggedIn = true;
ctx.appState.userName = "홍길동";
\`\`\`

### ctx.params
현재 폼으로 전달된 파라미터 객체입니다.

\`\`\`javascript
let userId = ctx.params.userId;
\`\`\`

### ctx.navigateBack()
이전 폼으로 돌아갑니다.

### ctx.navigateReplace(formId, params?)
현재 폼을 대체하여 이동합니다 (뒤로가기 스택에 남지 않음).

### ctx.closeApp()
전체 애플리케이션을 종료합니다.

## 11. console (디버깅)

\`console.log\`, \`console.info\`, \`console.warn\`, \`console.error\`를 사용할 수 있습니다.
로그는 DebugLog 배열로 수집되어 응답에 포함됩니다.

## 12. 사용 예제

### 기본 검증
\`\`\`javascript
// btnSubmit_Click
if (!ctx.controls.txtEmail.text) {
  ctx.showMessage("이메일을 입력하세요", "입력 오류", "error");
  return;
}
ctx.controls.lblStatus.text = "처리 중...";
ctx.controls.btnSubmit.enabled = false;
\`\`\`

### HTTP 호출
\`\`\`javascript
// btnLoad_Click
let response = ctx.http.get("https://api.example.com/products");
if (response.ok) {
  ctx.controls.dgvProducts.dataSource = response.data;
  ctx.showMessage(response.data.length + "건 로드", "완료", "success");
} else {
  ctx.showMessage("데이터 로드 실패: " + response.status, "오류", "error");
}
\`\`\`

### 데이터소스 + MongoDB
\`\`\`javascript
// btnSearch_Click
let keyword = ctx.controls.txtSearch.text;
let results = ctx.controls.mongoConn.find("products", {
  name: { $regex: keyword, $options: "i" }
});
ctx.controls.dgvResults.dataSource = results;
ctx.controls.lblCount.text = results.length + "건";
\`\`\`

## 보안 제한

샌드박스 환경에서 다음 전역 객체/함수는 **차단**됩니다:
\`process\`, \`require\`, \`Function\`, \`eval\`, \`setTimeout\`, \`setInterval\`,
\`setImmediate\`, \`queueMicrotask\`, \`__dirname\`, \`__filename\`,
\`module\`, \`exports\`, \`globalThis\`
`;

const DATA_BINDING_GUIDE = `# 데이터 바인딩 가이드

WebForm의 데이터 바인딩은 컨트롤의 속성을 데이터소스의 필드에 연결하여 자동으로 데이터를 표시하고 동기화합니다.

## 1. DataBindingDefinition 구조

\`\`\`typescript
interface DataBindingDefinition {
  controlId: string;        // 바인딩할 컨트롤 ID
  controlProperty: string;  // 바인딩할 컨트롤 속성 (예: "text", "dataSource")
  dataSourceId: string;     // 데이터소스 ID
  dataField: string;        // 데이터소스 필드명 (예: "name", "items")
  bindingMode: 'oneWay' | 'twoWay' | 'oneTime';
}
\`\`\`

## 2. 바인딩 모드

| 모드 | 설명 | 사용 시나리오 |
|------|------|--------------|
| \`oneWay\` | 데이터소스 → 컨트롤 (읽기 전용) | 레이블 표시, 목록 조회 |
| \`twoWay\` | 데이터소스 ↔ 컨트롤 (양방향) | 편집 가능한 폼 필드 |
| \`oneTime\` | 최초 로드 시 1회만 바인딩 | 초기값 설정, 드롭다운 항목 |

## 3. 데이터소스 타입

### 3.1 Database (MongoDB)

\`\`\`typescript
interface DataSourceDefinition {
  id: string;
  name: string;
  type: 'database';
  config: {
    dialect: 'mongodb';          // 'mongodb' | 'mysql' | 'mssql' | 'sqlite'
    connectionString: string;    // 연결 문자열
    database: string;            // 데이터베이스명
  };
}
\`\`\`

### 3.2 REST API

\`\`\`typescript
{
  id: "ds-api-users",
  name: "Users API",
  type: "restApi",
  config: {
    baseUrl: "https://api.example.com",
    headers: { "Content-Type": "application/json" },
    auth: {
      type: "bearer",           // 'none' | 'basic' | 'bearer' | 'apiKey'
      credentials: { token: "..." }
    }
  }
}
\`\`\`

### 3.3 Static (정적 데이터)

\`\`\`typescript
{
  id: "ds-status-list",
  name: "상태 목록",
  type: "static",
  config: {
    data: [
      { value: "active", label: "활성" },
      { value: "inactive", label: "비활성" },
      { value: "pending", label: "대기" }
    ]
  }
}
\`\`\`

## 4. 실전 시나리오

### 4.1 DataGridView — 테이블 데이터 표시

\`\`\`json
{
  "controlId": "dgvUsers",
  "controlProperty": "dataSource",
  "dataSourceId": "ds-mongodb",
  "dataField": "users",
  "bindingMode": "oneWay"
}
\`\`\`

### 4.2 ComboBox — 드롭다운 항목 바인딩

\`\`\`json
{
  "controlId": "cmbDepartment",
  "controlProperty": "items",
  "dataSourceId": "ds-static-departments",
  "dataField": "items",
  "bindingMode": "oneTime"
}
\`\`\`

### 4.3 TextBox — 양방향 바인딩

\`\`\`json
{
  "controlId": "txtUserName",
  "controlProperty": "text",
  "dataSourceId": "ds-current-user",
  "dataField": "name",
  "bindingMode": "twoWay"
}
\`\`\`

## 5. 주의사항

- **oneTime** 바인딩은 폼 로드 시 1회만 데이터를 가져옵니다. 이후 데이터소스가 변경되어도 컨트롤에 반영되지 않습니다.
- **twoWay** 바인딩 시 컨트롤의 값이 변경되면 데이터소스에도 반영됩니다. 대량 데이터에는 성능 영향이 있을 수 있습니다.
- \`dataField\`는 데이터소스의 응답 구조에 따라 점(.) 표기법으로 중첩 필드에 접근할 수 있습니다 (예: \`"user.address.city"\`).
- 바인딩이 설정된 컨트롤의 속성은 이벤트 핸들러에서도 수정할 수 있습니다. 이벤트 핸들러의 변경이 우선 적용됩니다.
- FormDefinition의 \`dataBindings\` 배열에 바인딩 정의를 추가합니다.
`;

const CONTROL_HIERARCHY_GUIDE = `# 컨트롤 계층 구조 가이드

WebForm에서 컨트롤은 트리 구조로 배치됩니다. 컨테이너 컨트롤은 \`children\` 배열에 자식 컨트롤을 포함합니다.

## 1. 컨테이너 컨트롤 (4종 + 2종)

### 기본 컨테이너

| 컨트롤 | 설명 | children 구조 |
|--------|------|---------------|
| **Panel** | 투명 컨테이너, borderStyle 속성 | 단일 children 배열 |
| **GroupBox** | 제목 있는 테두리 컨테이너, text 속성 | 단일 children 배열 |
| **TabControl** | 탭 페이지 컨테이너, tabs 속성 | 탭별 children 배열 (구현 시 단일 children 사용) |
| **SplitContainer** | 좌우/상하 분할 컨테이너 | 2개 패널 각각의 children |

### Extra 컨테이너

| 컨트롤 | 설명 | children 구조 |
|--------|------|---------------|
| **Card** | 카드형 컨테이너, title/subtitle 속성 | 단일 children 배열 |
| **Collapse** | 접기/펼치기 컨테이너, panels 속성 | 단일 children 배열 |

## 2. 계층 구조 규칙

### ControlDefinition 구조
\`\`\`typescript
interface ControlDefinition {
  id: string;
  type: ControlType;
  name: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: ControlDefinition[];     // 컨테이너만 사용
  anchor: AnchorStyle;
  dock: DockStyle;
  tabIndex: number;
  visible: boolean;
  enabled: boolean;
}
\`\`\`

### 규칙
1. **컨테이너만** \`children\` 배열을 가질 수 있습니다
2. 비컨테이너 컨트롤의 \`children\`은 \`undefined\`입니다
3. 최상위 컨트롤은 FormDefinition의 \`controls\` 배열에 직접 포함됩니다
4. 자식 컨트롤의 위치(\`position\`)는 **부모 컨테이너 기준 상대좌표**입니다

## 3. 좌표 체계

\`\`\`
Form (0,0) ─────────────────────────────
│                                        │
│  Panel (50, 30)                        │
│  ┌────────────────────────┐            │
│  │                        │            │
│  │  Button (10, 10)       │            │
│  │  → 절대좌표: (60, 40)  │            │
│  │                        │            │
│  │  TextBox (10, 40)      │            │
│  │  → 절대좌표: (60, 70)  │            │
│  │                        │            │
│  └────────────────────────┘            │
│                                        │
─────────────────────────────────────────
\`\`\`

- Panel의 position: \`{ x: 50, y: 30 }\` (폼 기준)
- Button의 position: \`{ x: 10, y: 10 }\` (Panel 기준)
- Button의 실제 폼 좌표: \`{ x: 60, y: 40 }\`

## 4. 트리 구조 예시

\`\`\`
FormDefinition.controls
├── MenuStrip (dock: Top)
├── Panel "pnlHeader"
│   ├── Label "lblTitle"
│   └── PictureBox "picLogo"
├── GroupBox "grpUserInfo"
│   ├── Label "lblName"
│   ├── TextBox "txtName"
│   ├── Label "lblEmail"
│   └── TextBox "txtEmail"
├── TabControl "tabMain"
│   ├── DataGridView "dgvUsers" (Tab 1)
│   └── Chart "chtStats" (Tab 2)
├── Panel "pnlButtons"
│   ├── Button "btnSave"
│   └── Button "btnCancel"
└── StatusStrip (dock: Bottom)
\`\`\`

## 5. MCP Tool 사용 예시

### 컨테이너에 자식 컨트롤 추가

\`add_control\` 도구에 \`parentId\` 파라미터를 지정하면 해당 컨테이너의 자식으로 추가됩니다.

\`\`\`json
{
  "tool": "add_control",
  "arguments": {
    "formId": "form-123",
    "type": "TextBox",
    "name": "txtSearch",
    "parentId": "panel-header-id",
    "position": { "x": 10, "y": 10 },
    "size": { "width": 200, "height": 23 },
    "properties": { "text": "" }
  }
}
\`\`\`

### parentId 생략 시

\`parentId\`를 생략하면 폼의 최상위 \`controls\` 배열에 추가됩니다.

## 6. 중첩 제약사항

- **MenuStrip, ToolStrip, StatusStrip**: dock 속성이 고정되어 있어 일반적으로 최상위에 배치합니다
- **SplitContainer**: 내부에 2개의 패널이 있으며, 각 패널에 컨트롤을 추가합니다
- **TabControl**: 각 탭 페이지별로 별도의 자식 컨트롤 영역이 있습니다
- **중첩 깊이**: 컨테이너 안에 컨테이너를 중첩할 수 있지만, 과도한 중첩은 성능과 UX에 영향을 줄 수 있습니다
- **순환 참조 금지**: 컨트롤이 자기 자신의 자식이 되거나, 부모-자식 순환이 발생하면 안 됩니다
`;

export function registerGuideResources(server: McpServer): void {
  // ── 6. webform://guide/event-context ──
  server.resource(
    'event-context-guide',
    'webform://guide/event-context',
    { description: 'ctx 객체 API 마크다운 문서', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown' as const,
          text: EVENT_CONTEXT_GUIDE,
        },
      ],
    }),
  );

  // ── 7. webform://guide/data-binding ──
  server.resource(
    'data-binding-guide',
    'webform://guide/data-binding',
    { description: '데이터 바인딩 설정 가이드', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown' as const,
          text: DATA_BINDING_GUIDE,
        },
      ],
    }),
  );

  // ── 8. webform://guide/control-hierarchy ──
  server.resource(
    'control-hierarchy-guide',
    'webform://guide/control-hierarchy',
    { description: '컨테이너 컨트롤 계층 구조 가이드', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown' as const,
          text: CONTROL_HIERARCHY_GUIDE,
        },
      ],
    }),
  );
}
