# WebForm 스크립팅 가이드

이 문서는 WebForm Designer에서 이벤트 핸들러 코드를 작성하는 방법을 설명합니다.

---

## 개요

WebForm의 이벤트 핸들러는 JavaScript로 작성합니다. 코드는 서버의 **isolated-vm 샌드박스**에서 실행되므로 `fetch`, `setTimeout`, `require` 등 브라우저/Node.js API는 사용할 수 없습니다. 대신 WebForm이 제공하는 `ctx` 객체를 통해 컨트롤 조작, HTTP 요청, 메시지 표시 등을 수행합니다.

핸들러에는 두 개의 전역 변수가 주입됩니다:

| 변수 | 설명 |
|------|------|
| `ctx` | 폼 컨텍스트. 모든 컨트롤, HTTP 클라이언트, 다이얼로그 등에 접근 |
| `sender` | 이벤트를 발생시킨 컨트롤 자신 |

---

## ctx 객체

### ctx.controls

폼에 배치된 모든 컨트롤에 이름으로 접근합니다. 속성을 읽거나 변경하면 런타임 UI에 즉시 반영됩니다.

```javascript
// 읽기
const name = ctx.controls.txtName.text;
const isChecked = ctx.controls.chkAgree.checked;

// 쓰기
ctx.controls.lblResult.text = "처리 완료";
ctx.controls.lblResult.foreColor = "#2e7d32";
ctx.controls.btnSubmit.enabled = false;
ctx.controls.progressBar1.value = 75;
```

### ctx.formId

현재 실행 중인 폼의 고유 ID입니다 (읽기 전용).

```javascript
const id = ctx.formId;
```

### ctx.showMessage(text, title?, type?)

메시지 다이얼로그를 표시합니다.

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `text` | string | (필수) | 메시지 내용 |
| `title` | string | `""` | 다이얼로그 제목 |
| `type` | string | `"info"` | `"info"`, `"warning"`, `"error"`, `"success"` |

```javascript
ctx.showMessage("저장되었습니다.", "완료", "success");
ctx.showMessage("필수 항목을 입력해주세요.", "경고", "warning");
ctx.showMessage("서버 오류가 발생했습니다.", "오류", "error");
ctx.showMessage("안내 메시지입니다.");  // title, type 생략 가능
```

한 핸들러에서 여러 번 호출하면 모든 메시지가 순차적으로 표시됩니다.

### ctx.http

샌드박스 내에서 외부 REST API를 동기적으로 호출합니다. 모든 메서드는 `HttpResponse`를 반환합니다.

**HttpResponse 구조:**

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `status` | number | HTTP 상태 코드 (200, 404, 500 등) |
| `ok` | boolean | 상태 코드 200~299이면 `true` |
| `data` | any | 응답 본문. JSON이면 자동 파싱, 아니면 문자열 |

#### GET

```javascript
const res = ctx.http.get("https://api.example.com/users");
if (res.ok) {
  ctx.controls.lblCount.text = `총 ${res.data.length}건`;
}
```

#### POST

```javascript
const res = ctx.http.post("https://api.example.com/users", {
  name: "홍길동",
  email: "hong@test.com"
});
if (res.ok) {
  ctx.showMessage(`ID ${res.data.id} 생성됨`, "성공", "success");
} else {
  ctx.showMessage(`오류: ${res.status}`, "실패", "error");
}
```

#### PUT / PATCH / DELETE

```javascript
ctx.http.put("https://api.example.com/users/1", { name: "김철수" });
ctx.http.patch("https://api.example.com/users/1", { status: "inactive" });
ctx.http.delete("https://api.example.com/users/1");
```

> **참고:** 요청 타임아웃은 10초입니다. body를 전송하면 `Content-Type: application/json` 헤더가 자동으로 추가됩니다.

### ctx.showDialog(formName, params?)

다른 폼을 모달 다이얼로그로 엽니다.

```javascript
const result = ctx.showDialog("UserDetailForm", { userId: 123 });
if (result.dialogResult === "OK") {
  ctx.controls.txtName.text = result.data.name;
}
```

| 반환값 프로퍼티 | 타입 | 설명 |
|-----------------|------|------|
| `dialogResult` | `"OK"` \| `"Cancel"` | 다이얼로그 닫힌 방식 |
| `data` | object | 다이얼로그에서 반환한 데이터 |

### ctx.navigate(formName, params?)

현재 화면을 다른 폼으로 전환합니다.

```javascript
ctx.navigate("OrderListForm", { status: "pending" });
```

### ctx.close(dialogResult?)

현재 폼 또는 다이얼로그를 닫습니다.

```javascript
ctx.close("OK");      // 다이얼로그를 OK로 닫기
ctx.close("Cancel");  // 다이얼로그를 Cancel로 닫기
ctx.close();          // 일반 폼 닫기
```

---

## sender 객체

이벤트를 발생시킨 컨트롤 자체를 가리킵니다. `ctx.controls`에서 해당 컨트롤을 찾는 것과 동일하지만, 이벤트 소스에 바로 접근할 수 있어 편리합니다.

```javascript
// TextBox.TextChanged 핸들러에서
const value = sender.text;
ctx.controls.lblLength.text = `${value.length}자`;

// CheckBox.CheckedChanged 핸들러에서
const checked = sender.checked;
ctx.controls.btnSubmit.enabled = checked;

// Button.Click 핸들러에서
sender.enabled = false;  // 클릭한 버튼 비활성화
sender.text = "처리 중...";
```

---

## 컨트롤별 속성

### 공통 속성

모든 컨트롤에서 사용할 수 있는 속성입니다.

| 속성 | 타입 | 설명 |
|------|------|------|
| `visible` | boolean | 표시 여부 |
| `enabled` | boolean | 활성화 여부 |
| `backColor` | string | 배경색 (`"#RRGGBB"`) |
| `foreColor` | string | 전경색 (`"#RRGGBB"`) |

### Button

| 속성 | 타입 | 설명 |
|------|------|------|
| `text` | string | 버튼 텍스트 |
| `enabled` | boolean | 활성화 여부 |

### Label

| 속성 | 타입 | 설명 |
|------|------|------|
| `text` | string | 표시할 텍스트 |
| `foreColor` | string | 텍스트 색상 |
| `textAlign` | string | 정렬 (`"left"`, `"center"`, `"right"`) |

### TextBox

| 속성 | 타입 | 설명 |
|------|------|------|
| `text` | string | 입력된 텍스트 |
| `multiline` | boolean | 여러 줄 입력 |
| `readOnly` | boolean | 읽기 전용 |

### CheckBox

| 속성 | 타입 | 설명 |
|------|------|------|
| `text` | string | 레이블 텍스트 |
| `checked` | boolean | 체크 상태 |

### ComboBox

| 속성 | 타입 | 설명 |
|------|------|------|
| `items` | string[] | 선택 항목 목록 |
| `selectedIndex` | number | 선택된 항목 인덱스 (-1: 미선택) |

### ListBox

| 속성 | 타입 | 설명 |
|------|------|------|
| `items` | string[] | 항목 목록 |
| `selectedIndex` | number | 선택된 항목 인덱스 |

### NumericUpDown

| 속성 | 타입 | 설명 |
|------|------|------|
| `value` | number | 현재 값 |
| `minimum` | number | 최소값 |
| `maximum` | number | 최대값 |

### DateTimePicker

| 속성 | 타입 | 설명 |
|------|------|------|
| `value` | string | 날짜 값 (`YYYY-MM-DD`) |

### ProgressBar

| 속성 | 타입 | 설명 |
|------|------|------|
| `value` | number | 현재 값 |
| `minimum` | number | 최소값 (기본 0) |
| `maximum` | number | 최대값 (기본 100) |

### DataGridView

| 속성 | 타입 | 설명 |
|------|------|------|
| `dataSource` | object[] | 테이블 데이터 배열 |
| `columns` | ColumnDefinition[] | 컬럼 정의 |
| `selectedRow` | object | 현재 선택된 행의 데이터 |
| `readOnly` | boolean | 읽기 전용 |

**ColumnDefinition 구조:**

| 속성 | 타입 | 설명 |
|------|------|------|
| `field` | string | 데이터 필드명 |
| `headerText` | string | 헤더 텍스트 |
| `width` | number | 컬럼 너비 (px) |
| `sortable` | boolean | 정렬 가능 여부 |
| `editable` | boolean | 편집 가능 여부 |

```javascript
// DataGridView에 데이터 설정
ctx.controls.grid1.dataSource = [
  { name: "홍길동", age: 30, dept: "개발팀" },
  { name: "김영희", age: 25, dept: "기획팀" },
];

// 컬럼 정의
ctx.controls.grid1.columns = [
  { field: "name", headerText: "이름", width: 120 },
  { field: "age", headerText: "나이", width: 80, sortable: true },
  { field: "dept", headerText: "부서", width: 100 },
];

// 선택된 행 읽기
const row = ctx.controls.grid1.selectedRow;
if (row) {
  ctx.controls.txtName.text = row.name;
}
```

### TabControl

| 속성 | 타입 | 설명 |
|------|------|------|
| `selectedIndex` | number | 현재 탭 인덱스 |

### Panel / GroupBox

| 속성 | 타입 | 설명 |
|------|------|------|
| `text` | string | 제목 (GroupBox만 해당) |
| `borderStyle` | string | `"None"`, `"FixedSingle"`, `"Fixed3D"` (Panel만 해당) |

---

## 이벤트 목록

### 공통 이벤트

모든 컨트롤에서 사용할 수 있습니다.

| 이벤트 | 설명 |
|--------|------|
| `Click` | 클릭 |
| `DoubleClick` | 더블클릭 |
| `MouseEnter` | 마우스 진입 |
| `MouseLeave` | 마우스 이탈 |
| `MouseDown` | 마우스 버튼 누름 |
| `MouseUp` | 마우스 버튼 해제 |
| `MouseMove` | 마우스 이동 |
| `KeyDown` | 키 누름 |
| `KeyUp` | 키 해제 |
| `KeyPress` | 키 입력 |
| `Enter` | 포커스 진입 |
| `Leave` | 포커스 이탈 |
| `Validating` | 유효성 검사 (포커스 이동 전) |
| `Validated` | 유효성 검사 완료 |
| `VisibleChanged` | 표시 상태 변경 |
| `EnabledChanged` | 활성화 상태 변경 |

### 컨트롤 전용 이벤트

| 컨트롤 | 이벤트 | 설명 |
|--------|--------|------|
| TextBox | `TextChanged` | 텍스트 변경 |
| ComboBox | `SelectedIndexChanged` | 선택 항목 변경 |
| ComboBox | `DropDown` | 드롭다운 열림 |
| ComboBox | `DropDownClosed` | 드롭다운 닫힘 |
| CheckBox | `CheckedChanged` | 체크 상태 변경 |
| RadioButton | `CheckedChanged` | 선택 상태 변경 |
| NumericUpDown | `ValueChanged` | 값 변경 |
| DateTimePicker | `ValueChanged` | 날짜 변경 |
| ListBox | `SelectedIndexChanged` | 선택 항목 변경 |
| TabControl | `SelectedIndexChanged` | 탭 변경 |
| DataGridView | `CellClick` | 셀 클릭 |
| DataGridView | `CellValueChanged` | 셀 값 변경 |
| DataGridView | `RowEnter` | 행 진입 |
| DataGridView | `SelectionChanged` | 행 선택 변경 |
| TreeView | `AfterSelect` | 노드 선택 |
| TreeView | `AfterExpand` | 노드 확장 |
| TreeView | `AfterCollapse` | 노드 축소 |
| ListView | `SelectedIndexChanged` | 선택 변경 |
| ListView | `ItemActivate` | 항목 활성화 |

### 폼 이벤트

| 이벤트 | 설명 |
|--------|------|
| `Load` | 폼 로드 |
| `Shown` | 폼 표시 완료 |
| `FormClosing` | 폼 닫기 전 |
| `FormClosed` | 폼 닫힘 |
| `Resize` | 폼 크기 변경 |

---

## 데이터 바인딩

컨트롤과 데이터소스를 연결하여 데이터를 자동으로 로드하고 동기화할 수 있습니다.

### 바인딩 모드

| 모드 | 설명 |
|------|------|
| `oneWay` | 데이터소스 → 컨트롤 (읽기 전용) |
| `twoWay` | 양방향 동기화 |
| `oneTime` | 최초 로드 시 1회만 적용 |

### 데이터소스 타입

#### Database

MongoDB, MySQL, MSSQL, SQLite를 지원합니다. Designer의 데이터소스 패널에서 연결 정보를 설정합니다.

#### REST API

외부 REST API를 데이터소스로 사용합니다. 인증 방식으로 Bearer, Basic, API Key를 지원합니다.

#### Static

코드에서 직접 정의한 고정 데이터 배열입니다.

### DataGridView 바인딩 예시

DataGridView에 데이터소스를 바인딩하면 데이터가 자동으로 로드되어 테이블에 표시됩니다. 컬럼을 지정하지 않으면 데이터 필드에서 자동 생성됩니다.

```javascript
// HTTP API에서 데이터를 가져와 그리드에 표시
const res = ctx.http.get("https://api.example.com/products");
if (res.ok) {
  ctx.controls.gridProducts.dataSource = res.data;
  ctx.controls.gridProducts.columns = [
    { field: "name", headerText: "상품명", width: 200 },
    { field: "price", headerText: "가격", width: 100 },
    { field: "stock", headerText: "재고", width: 80 },
  ];
  ctx.controls.lblCount.text = `총 ${res.data.length}건`;
}
```

---

## 실전 예제

### 로그인 폼

```javascript
// btnLogin.Click
const id = ctx.controls.txtId.text;
const pw = ctx.controls.txtPassword.text;

if (!id || !pw) {
  ctx.showMessage("아이디와 비밀번호를 입력해주세요.", "입력 오류", "warning");
  return;
}

const res = ctx.http.post("https://api.example.com/auth/login", {
  username: id,
  password: pw,
});

if (res.ok) {
  ctx.showMessage(`${res.data.name}님 환영합니다!`, "로그인 성공", "success");
  ctx.navigate("MainForm", { token: res.data.token });
} else {
  ctx.showMessage("아이디 또는 비밀번호가 올바르지 않습니다.", "로그인 실패", "error");
  ctx.controls.txtPassword.text = "";
}
```

### CRUD 테이블 관리

```javascript
// btnLoad.Click — 목록 조회
const res = ctx.http.get("https://api.example.com/employees");
if (res.ok) {
  ctx.controls.gridEmployees.dataSource = res.data;
  ctx.controls.lblStatus.text = `${res.data.length}건 조회됨`;
}
```

```javascript
// btnAdd.Click — 신규 추가
const name = ctx.controls.txtName.text;
const dept = ctx.controls.cmbDept.items[ctx.controls.cmbDept.selectedIndex];

if (!name) {
  ctx.showMessage("이름을 입력해주세요.", "입력 오류", "warning");
  return;
}

const res = ctx.http.post("https://api.example.com/employees", {
  name: name,
  department: dept,
});

if (res.ok) {
  ctx.showMessage("추가되었습니다.", "성공", "success");
  ctx.controls.txtName.text = "";
  // 목록 새로고침
  const list = ctx.http.get("https://api.example.com/employees");
  if (list.ok) {
    ctx.controls.gridEmployees.dataSource = list.data;
  }
}
```

```javascript
// btnDelete.Click — 선택 항목 삭제
const row = ctx.controls.gridEmployees.selectedRow;
if (!row) {
  ctx.showMessage("삭제할 항목을 선택해주세요.", "안내", "info");
  return;
}

const res = ctx.http.delete("https://api.example.com/employees/" + row.id);
if (res.ok) {
  ctx.showMessage("삭제되었습니다.", "성공", "success");
  // 목록 새로고침
  const list = ctx.http.get("https://api.example.com/employees");
  if (list.ok) {
    ctx.controls.gridEmployees.dataSource = list.data;
  }
}
```

### 입력 유효성 검사

```javascript
// txtEmail.Leave — 이메일 형식 검사
const email = sender.text;
const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

if (!valid && email.length > 0) {
  ctx.controls.lblEmailError.text = "올바른 이메일 형식이 아닙니다.";
  ctx.controls.lblEmailError.foreColor = "#d32f2f";
  sender.backColor = "#FFEBEE";
} else {
  ctx.controls.lblEmailError.text = "";
  sender.backColor = "#FFFFFF";
}
```

### 컨트롤 간 연동

```javascript
// chkAgree.CheckedChanged — 동의 체크박스로 버튼 활성화 제어
ctx.controls.btnSubmit.enabled = sender.checked;
ctx.controls.lblAgree.text = sender.checked ? "동의함" : "동의하지 않음";
ctx.controls.lblAgree.foreColor = sender.checked ? "#2e7d32" : "#999";
```

```javascript
// numQuantity.ValueChanged — 수량 변경 시 합계 계산
const qty = sender.value;
const price = 15000;
const total = qty * price;
ctx.controls.lblTotal.text = `합계: ${total.toLocaleString()}원`;
ctx.controls.progressBar1.value = Math.min(qty, 100);
```

```javascript
// cmbCategory.SelectedIndexChanged — 카테고리 선택 시 하위 목록 갱신
const index = sender.selectedIndex;
const categories = sender.items;

if (index >= 0) {
  const category = categories[index];
  const res = ctx.http.get("https://api.example.com/products?category=" + category);
  if (res.ok) {
    ctx.controls.gridProducts.dataSource = res.data;
    ctx.controls.lblStatus.text = `${category}: ${res.data.length}건`;
  }
}
```

### 다이얼로그 활용

```javascript
// btnEditUser.Click — 상세 편집 다이얼로그 열기
const row = ctx.controls.gridUsers.selectedRow;
if (!row) {
  ctx.showMessage("편집할 사용자를 선택해주세요.", "안내", "info");
  return;
}

const result = ctx.showDialog("UserEditForm", { userId: row.id, name: row.name });
if (result.dialogResult === "OK") {
  // 다이얼로그에서 수정 완료 → 목록 새로고침
  const list = ctx.http.get("https://api.example.com/users");
  if (list.ok) {
    ctx.controls.gridUsers.dataSource = list.data;
  }
  ctx.showMessage("수정되었습니다.", "완료", "success");
}
```

---

## 샌드박스 제약사항

이벤트 핸들러 코드는 isolated-vm 샌드박스에서 실행되므로 다음 제약이 있습니다:

| 항목 | 상태 |
|------|------|
| `fetch`, `XMLHttpRequest` | 사용 불가 → `ctx.http` 사용 |
| `setTimeout`, `setInterval` | 사용 불가 |
| `require`, `import` | 사용 불가 |
| `eval`, `Function` | 사용 불가 |
| `process`, `globalThis` | 사용 불가 |
| `console.log` | 사용 불가 |
| 실행 시간 제한 | 기본 5초 |
| 메모리 제한 | 기본 128MB |

에러가 발생하면 샌드박스 실행이 중단되고 에러 메시지가 클라이언트에 전달됩니다.
