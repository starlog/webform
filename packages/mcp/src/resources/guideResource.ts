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

### 컨트롤별 주의사항

#### ComboBox — selectedValue를 사용하지 마세요
ComboBox 런타임은 \`selectedIndex\`만 상태에 저장합니다. \`selectedValue\`는 항상 \`undefined\`입니다.
반드시 \`items[selectedIndex]\`로 선택된 값을 읽으세요.

\`\`\`javascript
// ✗ 잘못된 방법 (항상 undefined)
let city = ctx.controls.cmbCity.selectedValue;

// ✓ 올바른 방법
let items = ctx.controls.cmbCity.items;
let idx = ctx.controls.cmbCity.selectedIndex;
let city = (idx >= 0 && idx < items.length) ? items[idx] : '';

// 쓰기 (인덱스로 설정)
ctx.controls.cmbCity.selectedIndex = 2;
\`\`\`

#### DataGridView — columns 정의 시 field/headerText 사용
DataGridView의 \`columns\` 속성은 반드시 \`field\`와 \`headerText\`를 사용해야 합니다.
\`name\`/\`header\`를 사용하면 데이터가 셀에 매핑되지 않아 빈 그리드가 표시됩니다.

\`\`\`javascript
// ✗ 잘못된 방법 (데이터가 표시되지 않음)
columns: [{ name: 'email', header: '이메일', width: 200 }]

// ✓ 올바른 방법
columns: [{ field: 'email', headerText: '이메일', width: 200 }]
\`\`\`

#### DataGridView — 다른 쿼리 결과 표시 시 columns 동적 변경 필수
같은 DataGridView에 다른 스키마의 데이터를 표시할 때, \`columns\`를 \`dataSource\`보다 먼저 설정해야 합니다.
columns를 변경하지 않으면 이전 컬럼이 유지되어 새 데이터의 필드가 매핑되지 않습니다.

\`\`\`javascript
// 직원 목록 → 부서별 통계로 전환하는 예시
ctx.controls.grid1.columns = [
  { field: 'department', headerText: '부서', width: 150 },
  { field: 'emp_count', headerText: '인원수', width: 100 },
  { field: 'avg_salary', headerText: '평균 연봉', width: 150 }
];
ctx.controls.grid1.dataSource = deptStats;
\`\`\`

columns를 생략하면 데이터의 키에서 자동 생성됩니다 (headerText = 키 이름).

#### 샌드박스 코드 작성 규칙
- 변수 선언 시 \`const\`/\`let\` 대신 \`var\`를 사용하세요 (isolated-vm 호환성).
- 커넥터 메서드(\`rawQuery\`, \`find\` 등)는 **동기식**입니다. \`await\`를 사용하지 마세요.
- \`ctx.http\` 메서드(\`get\`, \`post\` 등)도 동기식으로 결과를 바로 반환합니다.
- Template literal(백틱)은 사용 가능하지만, 긴 SQL은 문자열 연결(\`+\`)이 더 안전합니다.

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
**주의: 모든 커넥터 메서드는 동기식입니다. await를 사용하지 마세요.**

\`\`\`javascript
// mongoConn이라는 이름의 MongoDBConnector가 있을 때
let users = ctx.controls.mongoConn.find("users", { age: { $gt: 18 } });
let user = ctx.controls.mongoConn.findOne("users", { _id: "..." });
let result = ctx.controls.mongoConn.insertOne("users", { name: "Alice" });
let updated = ctx.controls.mongoConn.updateOne("users", { _id: "..." }, { name: "Bob" });
let deleted = ctx.controls.mongoConn.deleteOne("users", { _id: "..." });
let count = ctx.controls.mongoConn.count("users", { status: "active" });
\`\`\`

## 10. DataSourceConnector 메서드 (SQL DB)

폼에 DataSourceConnector 컨트롤이 있으면 PostgreSQL, MySQL, MSSQL 등 SQL DB 쿼리가 가능합니다.
**주의: 모든 커넥터 메서드는 동기식입니다. await를 사용하지 마세요.**

### 사용 가능한 메서드
| 메서드 | 설명 | 반환값 |
|--------|------|--------|
| \`rawQuery(sql, params?)\` | SQL 직접 실행 | 결과 배열 |
| \`query(params)\` | 구조화된 쿼리 실행 | 결과 배열 |
| \`execute(sql, params?)\` | INSERT/UPDATE/DELETE | \`{affectedRows}\` |
| \`tables()\` | 테이블 목록 조회 | 문자열 배열 |
| \`testConnection()\` | 연결 테스트 | \`{success, message}\` |

### 사용 예제
\`\`\`javascript
// pgConn이라는 이름의 DataSourceConnector가 있을 때

// 전체 조회
let rows = ctx.controls.pgConn.rawQuery('SELECT * FROM employees ORDER BY id');
ctx.controls.grid1.dataSource = rows;

// 파라미터 바인딩 ($1, $2 — PostgreSQL)
let filtered = ctx.controls.pgConn.rawQuery(
  'SELECT * FROM employees WHERE department = $1 AND salary > $2',
  ['Engineering', 60000]
);

// INSERT/UPDATE/DELETE
let result = ctx.controls.pgConn.execute(
  'UPDATE employees SET active = $1 WHERE id = $2',
  [false, 5]
);
// result.affectedRows === 1

// 테이블 목록
let tableList = ctx.controls.pgConn.tables();
// ['employees', 'departments', 'projects']

// 연결 테스트
let connResult = ctx.controls.pgConn.testConnection();
// { success: true, message: 'Connection successful' }
\`\`\`

## 11. SwaggerConnector 메서드 (REST API)

폼에 SwaggerConnector 컨트롤이 있으면 Swagger/OpenAPI 정의 기반으로 REST API 호출이 가능합니다.
**주의: 모든 커넥터 메서드는 동기식입니다. await를 사용하지 마세요.**

\`\`\`javascript
// swaggerConn이라는 SwaggerConnector에 getUsers operationId가 있을 때
let users = ctx.controls.swaggerConn.getUsers({ queryParams: { page: 1 } });
let user = ctx.controls.swaggerConn.getUserById({ pathParams: { id: 123 } });
let created = ctx.controls.swaggerConn.createUser({ body: { name: "Alice" } });
\`\`\`

## 13. Shell 전용 API

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

## 14. console (디버깅)

\`console.log\`, \`console.info\`, \`console.warn\`, \`console.error\`를 사용할 수 있습니다.
로그는 DebugLog 배열로 수집되어 응답에 포함됩니다.

## 15. 사용 예제

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

  // ── 7. webform://guide/control-hierarchy ──
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
