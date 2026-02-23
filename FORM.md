# FORM.md — WebForm 폼 JSON 레퍼런스

AI(Claude 등)가 WebForm 폼 정의 JSON을 정확하게 생성하기 위한 종합 레퍼런스 문서이다.

---

## 1. 개요

WebForm은 WinForm 디자이너를 웹으로 구현한 SDUI(Server-Driven UI) 로우코드 플랫폼이다. 폼은 JSON으로 정의되며, Import API를 통해 서버에 등록한다. 이 문서는 폼 JSON의 정확한 구조, 모든 컨트롤 타입의 속성, 이벤트 시스템, ctx API를 정의한다.

---

## 2. Import API JSON 구조

### 엔드포인트

```
POST /api/projects/import
Content-Type: application/json
Authorization: Bearer <token>
```

### 요청 본문

```jsonc
{
  "project": {
    "name": "프로젝트명",          // 필수, 최소 1글자
    "description": "설명"          // 선택, 기본값 ""
  },
  "forms": [
    {
      "name": "폼 이름",           // 필수, 최소 1글자
      "properties": { ... },      // FormProperties (기본값 {})
      "controls": [ ... ],        // ControlDefinition[] (기본값 [])
      "eventHandlers": [ ... ],   // EventHandlerDefinition[] (기본값 [])
      "dataBindings": [ ... ]     // DataBindingDefinition[] (기본값 [])
    }
  ]
}
```

> **주의**: `id`와 `version`은 서버가 자동 생성한다. 요청에 포함하지 않는다. 폼의 version은 항상 `1`로 초기화되고, status는 `'draft'`로 설정된다.

---

## 3. FormProperties

폼 전체에 적용되는 속성이다.

```jsonc
{
  "title": "폼 제목",
  "width": 800,                    // 숫자 (px)
  "height": 600,                   // 숫자 (px)
  "backgroundColor": "#F5F5F5",    // CSS 색상
  "font": { /* FontDefinition */ },
  "startPosition": "CenterScreen", // "CenterScreen" | "Manual" | "CenterParent"
  "formBorderStyle": "Sizable",    // "None" | "FixedSingle" | "Fixed3D" | "Sizable"
  "maximizeBox": true,             // boolean
  "minimizeBox": true              // boolean
}
```

---

## 4. FontDefinition

폼과 개별 컨트롤에 적용 가능한 폰트 정의이다.

```jsonc
{
  "family": "Pretendard",   // 폰트 이름 (문자열)
  "size": 10,               // 폰트 크기 (숫자)
  "bold": false,             // boolean
  "italic": false,           // boolean
  "underline": false,        // boolean
  "strikethrough": false     // boolean
}
```

---

## 5. ControlDefinition

모든 컨트롤의 공통 구조이다.

```jsonc
{
  "id": "txtName",                           // 고유 식별자 (유니크 문자열)
  "type": "TextBox",                         // ControlType (30종 중 하나)
  "name": "txtName",                         // 컨트롤 이름 (이벤트 핸들러에서 ctx.controls.{name}으로 접근)
  "position": { "x": 100, "y": 50 },        // 위치 (px)
  "size": { "width": 200, "height": 26 },   // 크기 (px)
  "properties": { ... },                    // 컨트롤 타입별 고유 속성
  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
  "dock": "None",                            // DockStyle
  "tabIndex": 0,                             // 탭 순서 (0 이상)
  "visible": true,                           // boolean
  "enabled": true,                           // boolean
  "children": [ ... ]                        // 컨테이너만: 자식 ControlDefinition[]
}
```

> **id와 name**: 보통 같은 값을 사용한다. `id`는 시스템 식별자, `name`은 이벤트 핸들러에서 `ctx.controls.<name>`으로 접근할 때 사용된다.

---

## 6. Anchor / Dock

### AnchorStyle

부모 컨테이너 크기 변경 시 컨트롤이 어느 방향에 고정될지 결정한다.

```jsonc
{
  "top": true,      // 상단 고정
  "bottom": false,   // 하단 고정
  "left": true,     // 좌측 고정
  "right": false     // 우측 고정
}
```

- 기본값: `top: true, left: true` (좌상단 고정)
- `top: true, bottom: true` → 세로 방향 늘어남
- `left: true, right: true` → 가로 방향 늘어남
- 네 방향 모두 `true` → 양방향 늘어남

### DockStyle

컨테이너의 특정 변에 컨트롤을 도킹한다. 6가지 값:

| 값 | 설명 |
|-----|------|
| `"None"` | 도킹 없음 (기본값) |
| `"Top"` | 상단에 도킹 |
| `"Bottom"` | 하단에 도킹 |
| `"Left"` | 좌측에 도킹 |
| `"Right"` | 우측에 도킹 |
| `"Fill"` | 남은 공간 전체 채움 |

> **우선순위**: `dock`이 `"None"`이 아니면 `anchor`는 무시된다.

---

## 7. 컨트롤 타입 전체 목록 (30종)

### 7.1 Basic 컨트롤 (12종)

모든 컨트롤은 공통으로 `name`, `enabled`, `visible`, `tabIndex` (Behavior/Design) 및 `position.x`, `position.y`, `size.width`, `size.height`, `anchor`, `dock` (Layout) 속성을 가진다. 아래는 각 컨트롤의 **고유 `properties`** 만 정리한다.

#### Button

```jsonc
{
  "text": "확인",              // 버튼 텍스트
  "backColor": "#1565C0",      // 배경색
  "foreColor": "#FFFFFF",      // 글자색
  "font": { /* FontDefinition */ },
  "textAlign": "MiddleCenter"  // "TopLeft"|"TopCenter"|"TopRight"|"MiddleLeft"|"MiddleCenter"|"MiddleRight"|"BottomLeft"|"BottomCenter"|"BottomRight"
}
```

#### Label

```jsonc
{
  "text": "라벨 텍스트",
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ },
  "textAlign": "MiddleLeft",   // "TopLeft"|"TopCenter"|"TopRight"|"MiddleLeft"|"MiddleCenter"|"MiddleRight"|"BottomLeft"|"BottomCenter"|"BottomRight"
  "autoSize": false            // boolean (기본값 false)
}
```

#### TextBox

```jsonc
{
  "text": "",                  // 텍스트 내용
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ },
  "multiline": false,          // 여러 줄 입력 (기본값 false)
  "readOnly": false,           // 읽기 전용 (기본값 false)
  "maxLength": 32767,          // 최대 길이 (0~32767, 기본값 32767)
  "passwordChar": "",          // 비밀번호 마스킹 문자
  "textAlign": "Left"          // "Left"|"Center"|"Right"
}
```

#### CheckBox

```jsonc
{
  "text": "체크박스 텍스트",
  "checked": false,            // 체크 상태 (기본값 false)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### RadioButton

```jsonc
{
  "text": "옵션 1",
  "checked": false,            // 선택 상태 (기본값 false)
  "groupName": "group1",       // 라디오 그룹 이름 (같은 그룹 내 하나만 선택)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### ComboBox

```jsonc
{
  "items": ["항목1", "항목2", "항목3"],  // 드롭다운 항목 배열
  "selectedIndex": -1,                   // 선택된 인덱스 (-1: 미선택)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ },
  "dropDownStyle": "DropDown"            // "DropDown"|"DropDownList"|"Simple"
}
```

#### ListBox

```jsonc
{
  "items": ["항목1", "항목2"],   // 목록 항목 배열
  "selectedIndex": -1,          // 선택된 인덱스 (-1: 미선택)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ },
  "selectionMode": "One"        // "None"|"One"|"MultiSimple"|"MultiExtended"
}
```

#### NumericUpDown

```jsonc
{
  "value": 0,                  // 현재 값
  "minimum": 0,                // 최솟값
  "maximum": 100,              // 최댓값
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### DateTimePicker

```jsonc
{
  "value": "2026-01-01",       // 날짜 값 (문자열)
  "format": "Short",           // "Short"|"Long"|"Time"|"Custom"
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### ProgressBar

```jsonc
{
  "value": 50,                 // 현재 값 (0~100)
  "minimum": 0,                // 최솟값
  "maximum": 100,              // 최댓값
  "style": "Continuous"        // "Blocks"|"Continuous"|"Marquee"
}
```

#### PictureBox

```jsonc
{
  "imageUrl": "https://...",   // 이미지 URL
  "sizeMode": "Zoom",         // "Normal"|"StretchImage"|"AutoSize"|"CenterImage"|"Zoom"
  "backColor": "#E0E0E0",
  "borderStyle": "None"       // "None"|"FixedSingle"|"Fixed3D"
}
```

#### RichTextBox

```jsonc
{
  "text": "",                  // 텍스트 내용
  "readOnly": false,           // 읽기 전용 (기본값 false)
  "scrollBars": "Both",       // "None"|"Horizontal"|"Vertical"|"Both"
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

---

### 7.2 Container 컨트롤 (7종)

컨테이너 컨트롤은 `children` 배열로 자식 컨트롤을 포함한다.

#### Panel

```jsonc
{
  "backColor": "#FFFFFF",
  "borderStyle": "None",      // "None"|"FixedSingle"|"Fixed3D"
  "autoScroll": false          // 스크롤바 자동 표시 (기본값 false)
}
```

#### GroupBox

```jsonc
{
  "text": "그룹 제목",          // 그룹 제목 텍스트
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### TabControl

```jsonc
{
  "tabs": [                             // 탭 정의 배열
    { "title": "탭1", "id": "tab1" },
    { "title": "탭2", "id": "tab2" }
  ],
  "selectedIndex": 0                    // 선택된 탭 인덱스
}
```

> TabControl의 `children`에는 Panel 컨트롤을 넣고, 각 Panel의 `properties.tabId`에 대응하는 탭 `id`를 지정한다. 자세한 패턴은 [10. 컨테이너 패턴](#10-컨테이너-패턴) 참조.

#### SplitContainer

```jsonc
{
  "orientation": "Vertical",        // "Horizontal"|"Vertical"
  "splitterDistance": 200,           // 분할 위치 (px)
  "splitterWidth": 4,               // 분할선 너비 (1~20, 기본값 4)
  "fixedPanel": "None",             // "None"|"Panel1"|"Panel2"
  "isSplitterFixed": false,         // 분할선 고정 여부 (기본값 false)
  "backColor": "#FFFFFF"
}
```

> SplitContainer의 `children`에 Panel 2개를 넣는다. 자세한 패턴은 [10. 컨테이너 패턴](#10-컨테이너-패턴) 참조.

#### MenuStrip

```jsonc
{
  "items": [                         // 메뉴 항목 배열
    {
      "text": "파일",
      "children": [
        { "text": "새로 만들기" },
        { "text": "열기" },
        { "text": "-" },             // 구분선
        { "text": "종료" }
      ]
    }
  ],
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### ToolStrip

```jsonc
{
  "items": [                         // 도구 모음 항목 배열
    { "text": "새로 만들기", "type": "button" },
    { "text": "-", "type": "separator" },
    { "text": "저장", "type": "button" }
  ],
  "backColor": "#FFFFFF",
  "font": { /* FontDefinition */ }
}
```

#### StatusStrip

```jsonc
{
  "items": [                         // 상태 표시줄 항목 배열
    { "text": "준비", "type": "label" },
    { "text": "100%", "type": "label" }
  ],
  "backColor": "#FFFFFF",
  "font": { /* FontDefinition */ }
}
```

---

### 7.3 Data 컨트롤 (10종)

#### DataGridView

```jsonc
{
  "columns": [                       // 열 정의 배열
    { "field": "name", "headerText": "이름", "width": 150 },
    { "field": "age", "headerText": "나이", "width": 80 }
  ],
  "dataSource": [],                  // 데이터 배열
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ },
  "readOnly": false                  // 읽기 전용 (기본값 false)
}
```

> `columns`의 표준 형식은 `{ "field": "필드키", "headerText": "표시 헤더" }`이다. [13. DataGridView columns 형식](#13-datagridview-columns-형식) 참조.

#### TreeView

```jsonc
{
  "nodes": [                         // 트리 노드 배열 (재귀)
    {
      "text": "부모 노드",
      "children": [
        { "text": "자식 노드 1" },
        { "text": "자식 노드 2" }
      ]
    }
  ],
  "showLines": false,                // 연결선 표시 (기본값 false)
  "showPlusMinus": true,             // 확장/축소 아이콘 (기본값 true)
  "checkBoxes": false,               // 체크박스 표시 (기본값 false)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### ListView

```jsonc
{
  "items": [                         // 목록 항목 배열
    {
      "text": "항목 텍스트",
      "subItems": ["서브1", "서브2"]  // Details 뷰에서 하위 열 값
    }
  ],
  "columns": [                       // Details 뷰 열 정의
    { "text": "이름", "width": 150 },
    { "text": "설명", "width": 200 }
  ],
  "view": "Details",                 // "LargeIcon"|"SmallIcon"|"List"|"Details"|"Tile"
  "selectedIndex": -1,               // 선택된 인덱스
  "multiSelect": false,              // 다중 선택 (기본값 false)
  "fullRowSelect": true,             // 전체 행 선택 (기본값 true)
  "gridLines": false,                // 그리드 선 표시 (기본값 false)
  "backColor": "#FFFFFF",
  "foreColor": "#000000",
  "font": { /* FontDefinition */ }
}
```

#### Chart

```jsonc
{
  "chartType": "Column",            // "Line"|"Bar"|"Column"|"Area"|"Pie"|"Doughnut"|"Scatter"|"Radar"
  "series": [],                      // 시리즈 데이터 배열
  "title": "차트 제목",
  "xAxisTitle": "X축",
  "yAxisTitle": "Y축",
  "showLegend": true,                // 범례 표시 (기본값 true)
  "showGrid": true,                  // 그리드 표시 (기본값 true)
  "font": { /* FontDefinition */ },
  "foreColor": "#000000",
  "backColor": "#FFFFFF"
}
```

#### GraphView

```jsonc
{
  "graphType": "Bar",                // "Line"|"Bar"|"HorizontalBar"|"Area"|"StackedBar"|"StackedArea"|"Pie"|"Donut"|"Scatter"|"Radar"
  "data": [],                        // 그래프 데이터 배열
  "title": "그래프 제목",
  "xAxisTitle": "X축",
  "yAxisTitle": "Y축",
  "showLegend": true,                // 범례 표시 (기본값 true)
  "showGrid": true,                  // 그리드 표시 (기본값 true)
  "colors": "",                      // 색상 (문자열)
  "font": { /* FontDefinition */ },
  "foreColor": "#000000",
  "backColor": "#FFFFFF"
}
```

#### SpreadsheetView

```jsonc
{
  "columns": [],                     // 열 정의 배열
  "data": [],                        // 데이터 배열
  "dataSource": [],                  // 데이터 소스 배열
  "readOnly": false,                 // 읽기 전용 (기본값 false)
  "showToolbar": true,               // 도구 모음 표시 (기본값 true)
  "showFormulaBar": true,            // 수식 입력줄 표시 (기본값 true)
  "showRowNumbers": true,            // 행 번호 표시 (기본값 true)
  "allowAddRows": true,              // 행 추가 허용 (기본값 true)
  "allowDeleteRows": true,           // 행 삭제 허용 (기본값 true)
  "allowSort": true,                 // 정렬 허용 (기본값 true)
  "allowFilter": false,              // 필터 허용 (기본값 false)
  "backColor": "#FFFFFF"
}
```

#### JsonEditor

```jsonc
{
  "value": "{}",                     // JSON 문자열
  "font": { /* FontDefinition */ },
  "foreColor": "#000000",
  "readOnly": false,                 // 읽기 전용 (기본값 false)
  "expandDepth": 1,                  // 기본 확장 깊이 (0~10, 기본값 1)
  "backColor": "#FFFFFF"
}
```

#### MongoDBView

```jsonc
{
  "title": "주문 데이터",
  "connectionString": "mongodb://localhost:27017",
  "database": "demo",
  "collection": "orders",
  "columns": [],                     // 열 정의
  "filter": "",                      // 필터 쿼리
  "pageSize": 50,                    // 페이지 크기 (1~1000, 기본값 50)
  "readOnly": false,                 // 읽기 전용 (기본값 false)
  "showToolbar": true,               // 도구 모음 표시 (기본값 true)
  "font": { /* FontDefinition */ },
  "foreColor": "#000000",
  "backColor": "#FFFFFF"
}
```

#### WebBrowser

```jsonc
{
  "url": "https://example.com",      // 표시할 URL
  "allowNavigation": true,           // 네비게이션 허용 (기본값 true)
  "backColor": "#FFFFFF"
}
```

#### BindingNavigator

```jsonc
{
  "bindingSource": "",               // 바인딩 소스 이름
  "showAddButton": true,             // 추가 버튼 표시 (기본값 true)
  "showDeleteButton": true,          // 삭제 버튼 표시 (기본값 true)
  "backColor": "#FFFFFF",
  "font": { /* FontDefinition */ }
}
```

---

### 7.4 비시각적 컴포넌트 (1종)

비시각적 컴포넌트는 런타임에서 UI를 렌더링하지 않는다. 디자이너에서는 캔버스 하단의 **컴포넌트 트레이**에 아이콘으로 표시된다. 이벤트 핸들러에서 `ctx.controls.<name>` 으로 메서드를 호출하여 사용한다.

#### MongoDBConnector

폼에 MongoDB 데이터베이스 연결을 추가하는 비시각적 컴포넌트이다.

**속성** (properties):

```jsonc
{
  "connectionString": "mongodb://localhost:27017",  // MongoDB 연결 문자열
  "database": "mydb",                               // 데이터베이스 이름
  "defaultCollection": "users",                     // 기본 컬렉션 이름
  "queryTimeout": 10000,                            // 쿼리 타임아웃 (ms, 기본값 10000)
  "maxResultCount": 1000                            // 최대 결과 수 (기본값 1000)
}
```

**기본 크기**: `width: 120, height: 40` (트레이 아이콘 크기)

**이벤트 핸들러에서 사용**:

```javascript
// myDb는 폼에 추가된 MongoDBConnector 컨트롤의 name
// find — 여러 문서 조회
var users = ctx.controls.myDb.find('users', { active: true });
ctx.controls.dataGrid1.dataSource = users;

// findOne — 단일 문서 조회
var user = ctx.controls.myDb.findOne('users', { email: 'test@test.com' });

// insertOne — 문서 삽입 (반환: { insertedId: "..." })
var result = ctx.controls.myDb.insertOne('users', { name: 'New', email: 'new@test.com' });

// updateOne — 문서 업데이트 (반환: { modifiedCount: N })
ctx.controls.myDb.updateOne('users', { _id: '64a...' }, { name: 'Updated' });

// deleteOne — 문서 삭제 (반환: { deletedCount: N })
ctx.controls.myDb.deleteOne('users', { _id: '64a...' });

// count — 문서 수 조회
var count = ctx.controls.myDb.count('users', { active: true });
```

> **참고**: 첫 번째 인자 `collection`을 생략하면 `defaultCollection` 속성의 컬렉션을 사용한다.

---

## 8. 이벤트 시스템

### EventHandlerDefinition

```jsonc
{
  "controlId": "btnSubmit",          // 대상 컨트롤의 id
  "eventName": "Click",             // 이벤트 이름
  "handlerType": "server",          // "server" (isolated-vm에서 실행)
  "handlerCode": "ctx.controls.lblStatus.text = '클릭됨';"  // JavaScript 코드
}
```

> **폼 이벤트의 `controlId`**: 항상 `"_form"`을 사용한다. `form-gen.sh` 및 Import API가 `"_form"`을 실제 폼 ID로 자동 변환한다.

### COMMON_EVENTS (16개) — 모든 컨트롤 공통

```
Click, DoubleClick,
MouseEnter, MouseLeave, MouseDown, MouseUp, MouseMove,
KeyDown, KeyUp, KeyPress,
Enter, Leave,
Validating, Validated,
VisibleChanged, EnabledChanged
```

### FORM_EVENTS (7개) — 폼 전용

```
Load, Shown, FormClosing, FormClosed, Resize,
OnLoading, BeforeLeaving
```

> **`Load` vs `OnLoading` 차이**:
> - `Load` — 클라이언트 사이드에서만 실행된다 (`handlerType: "client"`). 서버 왕복 없이 브라우저에서 즉시 실행.
> - **`OnLoading`** — **서버 사이드에서 실행된다** (`handlerType: "server"`). 폼 로딩 시 MongoDB 조회, HTTP 호출 등 서버 로직을 실행할 때 사용. **폼 로드 시 데이터를 조회하려면 반드시 `OnLoading`을 사용해야 한다.**
>
> ```jsonc
> // 폼 로드 시 서버에서 데이터 조회하는 올바른 예:
> {
>   "controlId": "_form",
>   "eventName": "OnLoading",     // ← Load가 아닌 OnLoading
>   "handlerType": "server",
>   "handlerCode": "var data = ctx.controls.myDb.find('products', {});\nctx.controls.dgvList.dataSource = data;"
> }
> ```

### CONTROL_EVENTS — 컨트롤 타입별 고유 이벤트

| 컨트롤 타입 | 고유 이벤트 |
|-------------|------------|
| TextBox | `TextChanged`, `KeyPress` |
| ComboBox | `SelectedIndexChanged`, `DropDown`, `DropDownClosed` |
| CheckBox | `CheckedChanged` |
| RadioButton | `CheckedChanged` |
| NumericUpDown | `ValueChanged` |
| DateTimePicker | `ValueChanged` |
| ListBox | `SelectedIndexChanged` |
| TabControl | `SelectedIndexChanged` |
| DataGridView | `CellClick`, `CellValueChanged`, `RowEnter`, `SelectionChanged` |
| TreeView | `AfterSelect`, `AfterExpand`, `AfterCollapse` |
| ListView | `SelectedIndexChanged`, `ItemActivate` |
| MenuStrip | `ItemClicked` |
| ToolStrip | `ItemClicked` |
| StatusStrip | `ItemClicked` |
| RichTextBox | `TextChanged`, `SelectionChanged` |
| WebBrowser | `Navigated`, `DocumentCompleted` |
| Chart | `SeriesClicked`, `DataLoaded` |
| SplitContainer | `SplitterMoved` |
| BindingNavigator | `PositionChanged`, `ItemClicked` |
| SpreadsheetView | `CellChanged`, `RowAdded`, `RowDeleted`, `SelectionChanged`, `DataLoaded` |
| JsonEditor | `ValueChanged` |
| MongoDBView | `DataLoaded`, `SelectionChanged`, `CellValueChanged`, `DocumentInserted`, `DocumentUpdated`, `DocumentDeleted`, `Error` |
| GraphView | `DataLoaded` |
| MongoDBConnector | `Connected`, `Error`, `QueryCompleted` |

> 각 컨트롤은 COMMON_EVENTS(16개) + 위 고유 이벤트를 모두 사용할 수 있다.

---

## 9. 이벤트 핸들러 ctx API

이벤트 핸들러 코드는 `isolated-vm` 샌드박스에서 실행된다. `ctx` 객체를 통해 폼을 제어한다.

### ctx.controls

모든 컨트롤의 속성에 **이름(name)** 으로 접근한다.

```javascript
// 읽기
var name = ctx.controls.txtName.text;
var checked = ctx.controls.chkAgree.checked;
var idx = ctx.controls.cmbCategory.selectedIndex;

// 쓰기
ctx.controls.lblStatus.text = "완료";
ctx.controls.lblStatus.foreColor = "#2E7D32";
ctx.controls.btnSubmit.enabled = false;
ctx.controls.pnlDetail.visible = true;
```

### ctx.showMessage(text, title, type)

메시지 다이얼로그를 표시한다.

```javascript
ctx.showMessage("저장되었습니다.", "알림", "info");
ctx.showMessage("입력을 확인하세요.", "경고", "warning");
ctx.showMessage("오류가 발생했습니다.", "오류", "error");
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `text` | string | 메시지 본문 |
| `title` | string | 다이얼로그 제목 |
| `type` | string | `"info"`, `"warning"`, `"error"` |

### ctx.http

HTTP 요청을 수행한다. 모든 메서드는 `{ status, ok, data }` 객체를 반환한다.

```javascript
// GET
var result = ctx.http.get("https://api.example.com/users");
if (result.ok) {
  ctx.controls.lblResult.text = JSON.stringify(result.data);
}

// POST
var result = ctx.http.post("https://api.example.com/users", {
  name: "홍길동",
  email: "hong@example.com"
});

// PUT
ctx.http.put("https://api.example.com/users/1", { name: "김철수" });

// PATCH
ctx.http.patch("https://api.example.com/users/1", { email: "new@example.com" });

// DELETE
ctx.http.delete("https://api.example.com/users/1");
```

### ctx.navigate(formId, params)

다른 폼으로 네비게이션한다.

```javascript
ctx.navigate("targetFormId", { userId: 123 });
```

### ctx.close(dialogResult)

현재 폼(다이얼로그)을 닫는다.

```javascript
ctx.close("OK");
ctx.close("Cancel");
```

### ctx.getRadioGroupValue(groupName)

라디오 그룹에서 선택된 값을 가져온다. 선택된 라디오 버튼의 `text` 값을 반환한다.

```javascript
var selected = ctx.getRadioGroupValue("group1");
if (selected) {
  ctx.controls.lblResult.text = "선택: " + selected;
}
```

### ctx.controls.\<mongoConnectorName\> — MongoDB CRUD

폼에 추가된 MongoDBConnector 컨트롤의 `name`으로 접근하여 MongoDB CRUD 작업을 수행한다.

```javascript
// myDb는 MongoDBConnector 컨트롤의 name
ctx.controls.myDb.find(collection, filter)         // → 문서 배열
ctx.controls.myDb.findOne(collection, filter)      // → 문서 또는 null
ctx.controls.myDb.insertOne(collection, doc)       // → { insertedId: "..." }
ctx.controls.myDb.updateOne(collection, filter, update)  // → { modifiedCount: N }
ctx.controls.myDb.deleteOne(collection, filter)    // → { deletedCount: N }
ctx.controls.myDb.count(collection, filter)        // → 숫자
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `collection` | string | 컬렉션 이름 (빈 문자열이면 `defaultCollection` 사용) |
| `filter` | object | MongoDB 쿼리 필터 (예: `{ active: true }`) |
| `doc` | object | 삽입할 문서 객체 |
| `update` | object | 업데이트할 필드 객체 (`$set`으로 래핑됨) |

### ctx.sender

이벤트를 발생시킨 컨트롤의 속성 객체이다.

```javascript
var buttonText = ctx.sender.text;
```

### ctx.eventArgs

이벤트 인자 객체이다. 이벤트 타입에 따라 다른 속성을 포함한다.

```javascript
var eventType = ctx.eventArgs.type;
```

### console

로그 출력용. 실행 결과에 로그가 포함되어 디버그 콘솔에 표시된다.

```javascript
console.log("디버그 메시지");
console.warn("경고 메시지");
console.error("오류 메시지");
console.info("정보 메시지");
```

---

## 10. 컨테이너 패턴

### Panel

단순 컨테이너. `children`에 자식 컨트롤을 배치한다.

```jsonc
{
  "id": "pnlMain",
  "type": "Panel",
  "name": "pnlMain",
  "position": { "x": 10, "y": 10 },
  "size": { "width": 400, "height": 300 },
  "properties": { "borderStyle": "FixedSingle", "backColor": "#FFFFFF" },
  "anchor": { "top": true, "bottom": true, "left": true, "right": true },
  "dock": "None",
  "tabIndex": 0, "visible": true, "enabled": true,
  "children": [
    { /* 자식 ControlDefinition */ }
  ]
}
```

### GroupBox

제목이 있는 그룹 컨테이너.

```jsonc
{
  "id": "grpInfo",
  "type": "GroupBox",
  "name": "grpInfo",
  "position": { "x": 20, "y": 60 },
  "size": { "width": 350, "height": 200 },
  "properties": { "text": "기본 정보" },
  "anchor": { "top": true, "bottom": false, "left": true, "right": true },
  "dock": "None",
  "tabIndex": 0, "visible": true, "enabled": true,
  "children": [
    { /* 자식의 position은 GroupBox 내부 기준 좌표 */ }
  ]
}
```

### TabControl

탭 컨트롤. `properties.tabs`에 탭 정의, `children`에 각 탭의 Panel을 배치한다.

```jsonc
{
  "id": "tabMain",
  "type": "TabControl",
  "name": "tabMain",
  "position": { "x": 20, "y": 50 },
  "size": { "width": 700, "height": 500 },
  "properties": {
    "tabs": [
      { "title": "일반", "id": "tabGeneral" },
      { "title": "고급", "id": "tabAdvanced" }
    ],
    "selectedIndex": 0
  },
  "anchor": { "top": true, "bottom": true, "left": true, "right": true },
  "dock": "None",
  "tabIndex": 0, "visible": true, "enabled": true,
  "children": [
    {
      "id": "pnlGeneral",
      "type": "Panel",
      "name": "pnlGeneral",
      "position": { "x": 10, "y": 40 },
      "size": { "width": 680, "height": 450 },
      "properties": {
        "tabId": "tabGeneral",           // ← tabs[].id와 매칭
        "backgroundColor": "#FFFFFF"
      },
      "anchor": { "top": true, "bottom": true, "left": true, "right": true },
      "dock": "None",
      "tabIndex": 0, "visible": true, "enabled": true,
      "children": [ /* 이 탭 안의 컨트롤들 */ ]
    },
    {
      "id": "pnlAdvanced",
      "type": "Panel",
      "name": "pnlAdvanced",
      "position": { "x": 10, "y": 40 },
      "size": { "width": 680, "height": 450 },
      "properties": {
        "tabId": "tabAdvanced",          // ← tabs[].id와 매칭
        "backgroundColor": "#FFFFFF"
      },
      "anchor": { "top": true, "bottom": true, "left": true, "right": true },
      "dock": "None",
      "tabIndex": 1, "visible": true, "enabled": true,
      "children": [ /* 이 탭 안의 컨트롤들 */ ]
    }
  ]
}
```

> **핵심**: 각 Panel의 `properties.tabId`가 `tabs` 배열의 `id`와 일치해야 한다.

### SplitContainer

분할 패널. `children`에 Panel 2개를 배치한다.

```jsonc
{
  "id": "splitMain",
  "type": "SplitContainer",
  "name": "splitMain",
  "position": { "x": 10, "y": 10 },
  "size": { "width": 600, "height": 400 },
  "properties": {
    "orientation": "Vertical",
    "splitterDistance": 200
  },
  "anchor": { "top": true, "bottom": true, "left": true, "right": true },
  "dock": "None",
  "tabIndex": 0, "visible": true, "enabled": true,
  "children": [
    {
      "id": "pnlLeft",
      "type": "Panel",
      "name": "pnlLeft",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 200, "height": 400 },
      "properties": {},
      "anchor": { "top": true, "bottom": true, "left": true, "right": true },
      "dock": "None",
      "tabIndex": 0, "visible": true, "enabled": true,
      "children": [ /* Panel1 컨트롤 */ ]
    },
    {
      "id": "pnlRight",
      "type": "Panel",
      "name": "pnlRight",
      "position": { "x": 204, "y": 0 },
      "size": { "width": 396, "height": 400 },
      "properties": {},
      "anchor": { "top": true, "bottom": true, "left": true, "right": true },
      "dock": "None",
      "tabIndex": 1, "visible": true, "enabled": true,
      "children": [ /* Panel2 컨트롤 */ ]
    }
  ]
}
```

---

## 11. DataBinding

데이터 소스와 컨트롤 속성을 바인딩한다.

### DataBindingDefinition

```jsonc
{
  "controlId": "txtName",           // 바인딩 대상 컨트롤 id
  "controlProperty": "text",        // 바인딩할 컨트롤 속성명
  "dataSourceId": "ds1",            // 데이터 소스 id
  "dataField": "name",              // 데이터 소스의 필드명
  "bindingMode": "twoWay"           // "oneWay"|"twoWay"|"oneTime"
}
```

| 바인딩 모드 | 설명 |
|------------|------|
| `oneWay` | 데이터 소스 → 컨트롤 (읽기만) |
| `twoWay` | 양방향 (컨트롤 변경 시 데이터 소스도 업데이트) |
| `oneTime` | 최초 1회만 데이터 소스 → 컨트롤 |

---

## 12. 실전 예제

### 예제 1: 간단한 입력 폼

```json
{
  "project": {
    "name": "예제 프로젝트",
    "description": "간단한 입력 폼 예제"
  },
  "forms": [
    {
      "name": "간단한 입력 폼",
      "properties": {
        "title": "회원 등록",
        "width": 500,
        "height": 350,
        "backgroundColor": "#FAFAFA",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblName", "type": "Label", "name": "lblName",
          "position": { "x": 20, "y": 20 }, "size": { "width": 80, "height": 23 },
          "properties": { "text": "이름" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "txtName", "type": "TextBox", "name": "txtName",
          "position": { "x": 110, "y": 17 }, "size": { "width": 250, "height": 26 },
          "properties": { "text": "" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "lblEmail", "type": "Label", "name": "lblEmail",
          "position": { "x": 20, "y": 60 }, "size": { "width": 80, "height": 23 },
          "properties": { "text": "이메일" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "txtEmail", "type": "TextBox", "name": "txtEmail",
          "position": { "x": 110, "y": 57 }, "size": { "width": 250, "height": 26 },
          "properties": { "text": "" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "btnRegister", "type": "Button", "name": "btnRegister",
          "position": { "x": 110, "y": 110 }, "size": { "width": 120, "height": 32 },
          "properties": { "text": "등록", "backColor": "#1565C0", "foreColor": "#FFFFFF" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        },
        {
          "id": "lblStatus", "type": "Label", "name": "lblStatus",
          "position": { "x": 110, "y": 155 }, "size": { "width": 300, "height": 23 },
          "properties": { "text": "", "foreColor": "#616161" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnRegister",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var name = ctx.controls.txtName.text;\nvar email = ctx.controls.txtEmail.text;\n\nif (!name) {\n  ctx.showMessage('이름을 입력하세요.', '입력 오류', 'warning');\n  return;\n}\nif (!email) {\n  ctx.showMessage('이메일을 입력하세요.', '입력 오류', 'warning');\n  return;\n}\n\nctx.controls.lblStatus.text = name + '님 등록 완료!';\nctx.controls.lblStatus.foreColor = '#2E7D32';\nctx.showMessage('회원 등록이 완료되었습니다.\\n\\n이름: ' + name + '\\n이메일: ' + email, '등록 완료', 'info');"
        }
      ],
      "dataBindings": []
    }
  ]
}
```

### 예제 2: 이벤트 핸들러가 포함된 폼

```json
{
  "project": {
    "name": "이벤트 예제",
    "description": "다양한 이벤트 핸들러를 활용하는 폼"
  },
  "forms": [
    {
      "name": "주문 입력",
      "properties": {
        "title": "주문 입력",
        "width": 600,
        "height": 450,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblCategory", "type": "Label", "name": "lblCategory",
          "position": { "x": 20, "y": 20 }, "size": { "width": 80, "height": 23 },
          "properties": { "text": "분류" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "cmbCategory", "type": "ComboBox", "name": "cmbCategory",
          "position": { "x": 110, "y": 17 }, "size": { "width": 220, "height": 26 },
          "properties": {
            "items": ["전자제품", "의류", "식품", "도서"],
            "selectedIndex": -1,
            "dropDownStyle": "DropDownList"
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "lblQty", "type": "Label", "name": "lblQty",
          "position": { "x": 20, "y": 60 }, "size": { "width": 80, "height": 23 },
          "properties": { "text": "수량" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "nudQty", "type": "NumericUpDown", "name": "nudQty",
          "position": { "x": 110, "y": 57 }, "size": { "width": 120, "height": 26 },
          "properties": { "value": 1, "minimum": 1, "maximum": 999 },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "chkUrgent", "type": "CheckBox", "name": "chkUrgent",
          "position": { "x": 110, "y": 100 }, "size": { "width": 150, "height": 23 },
          "properties": { "text": "긴급 배송", "checked": false },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        },
        {
          "id": "btnOrder", "type": "Button", "name": "btnOrder",
          "position": { "x": 110, "y": 150 }, "size": { "width": 120, "height": 32 },
          "properties": { "text": "주문하기", "backColor": "#2E7D32", "foreColor": "#FFFFFF" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
        },
        {
          "id": "lblStatus", "type": "Label", "name": "lblStatus",
          "position": { "x": 20, "y": 200 }, "size": { "width": 400, "height": 23 },
          "properties": { "text": "" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 6, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [
        {
          "controlId": "cmbCategory",
          "eventName": "SelectedIndexChanged",
          "handlerType": "server",
          "handlerCode": "var idx = ctx.controls.cmbCategory.selectedIndex;\nvar categories = ['전자제품', '의류', '식품', '도서'];\nif (idx >= 0) {\n  ctx.controls.lblStatus.text = '선택: ' + categories[idx];\n  ctx.controls.lblStatus.foreColor = '#1565C0';\n}"
        },
        {
          "controlId": "chkUrgent",
          "eventName": "CheckedChanged",
          "handlerType": "server",
          "handlerCode": "if (ctx.controls.chkUrgent.checked) {\n  ctx.controls.lblStatus.text = '긴급 배송이 선택되었습니다.';\n  ctx.controls.lblStatus.foreColor = '#E65100';\n} else {\n  ctx.controls.lblStatus.text = '';\n}"
        },
        {
          "controlId": "btnOrder",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var idx = ctx.controls.cmbCategory.selectedIndex;\nif (idx < 0) {\n  ctx.showMessage('분류를 선택하세요.', '입력 오류', 'warning');\n  return;\n}\nvar categories = ['전자제품', '의류', '식품', '도서'];\nvar qty = ctx.controls.nudQty.value;\nvar urgent = ctx.controls.chkUrgent.checked;\nctx.controls.lblStatus.text = '주문 완료!';\nctx.controls.lblStatus.foreColor = '#2E7D32';\nctx.showMessage('주문이 접수되었습니다.\\n\\n분류: ' + categories[idx] + '\\n수량: ' + qty + '\\n긴급: ' + (urgent ? '예' : '아니오'), '주문 완료', 'info');"
        }
      ],
      "dataBindings": []
    }
  ]
}
```

### 예제 3: 컨테이너가 포함된 폼 (TabControl + GroupBox)

```json
{
  "project": {
    "name": "레이아웃 예제",
    "description": "TabControl과 GroupBox를 활용한 폼"
  },
  "forms": [
    {
      "name": "설정 화면",
      "properties": {
        "title": "설정",
        "width": 700,
        "height": 500,
        "backgroundColor": "#FAFAFA",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "tabSettings", "type": "TabControl", "name": "tabSettings",
          "position": { "x": 10, "y": 10 },
          "size": { "width": 670, "height": 430 },
          "properties": {
            "tabs": [
              { "title": "일반", "id": "tabGeneral" },
              { "title": "표시", "id": "tabDisplay" }
            ],
            "selectedIndex": 0
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true,
          "children": [
            {
              "id": "pnlGeneral", "type": "Panel", "name": "pnlGeneral",
              "position": { "x": 10, "y": 40 }, "size": { "width": 650, "height": 380 },
              "properties": { "tabId": "tabGeneral", "backgroundColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true,
              "children": [
                {
                  "id": "grpUser", "type": "GroupBox", "name": "grpUser",
                  "position": { "x": 15, "y": 15 }, "size": { "width": 620, "height": 150 },
                  "properties": { "text": "사용자 정보" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": true },
                  "dock": "None", "tabIndex": 0, "visible": true, "enabled": true,
                  "children": [
                    {
                      "id": "lblUserName", "type": "Label", "name": "lblUserName",
                      "position": { "x": 20, "y": 30 }, "size": { "width": 80, "height": 23 },
                      "properties": { "text": "사용자명" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                      "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                    },
                    {
                      "id": "txtUserName", "type": "TextBox", "name": "txtUserName",
                      "position": { "x": 110, "y": 27 }, "size": { "width": 250, "height": 26 },
                      "properties": { "text": "" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": true },
                      "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                    },
                    {
                      "id": "chkAutoLogin", "type": "CheckBox", "name": "chkAutoLogin",
                      "position": { "x": 110, "y": 70 }, "size": { "width": 150, "height": 23 },
                      "properties": { "text": "자동 로그인", "checked": false },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                      "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
                    }
                  ]
                },
                {
                  "id": "btnSave", "type": "Button", "name": "btnSave",
                  "position": { "x": 15, "y": 180 }, "size": { "width": 100, "height": 32 },
                  "properties": { "text": "저장", "backColor": "#1565C0", "foreColor": "#FFFFFF" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                }
              ]
            },
            {
              "id": "pnlDisplay", "type": "Panel", "name": "pnlDisplay",
              "position": { "x": 10, "y": 40 }, "size": { "width": 650, "height": 380 },
              "properties": { "tabId": "tabDisplay", "backgroundColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true,
              "children": [
                {
                  "id": "lblTheme", "type": "Label", "name": "lblTheme",
                  "position": { "x": 20, "y": 20 }, "size": { "width": 80, "height": 23 },
                  "properties": { "text": "테마" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                },
                {
                  "id": "cmbTheme", "type": "ComboBox", "name": "cmbTheme",
                  "position": { "x": 110, "y": 17 }, "size": { "width": 200, "height": 26 },
                  "properties": {
                    "items": ["라이트", "다크", "시스템 기본"],
                    "selectedIndex": 0,
                    "dropDownStyle": "DropDownList"
                  },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                }
              ]
            }
          ]
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnSave",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var userName = ctx.controls.txtUserName.text;\nif (!userName) {\n  ctx.showMessage('사용자명을 입력하세요.', '입력 오류', 'warning');\n  return;\n}\nctx.showMessage('설정이 저장되었습니다.\\n\\n사용자명: ' + userName + '\\n자동 로그인: ' + (ctx.controls.chkAutoLogin.checked ? '예' : '아니오'), '저장 완료', 'info');"
        }
      ],
      "dataBindings": []
    }
  ]
}
```

---

## 13. DataGridView columns 형식

DataGridView의 `columns` 배열은 반드시 `field`와 `headerText`를 사용한다.

```jsonc
{
  "columns": [
    { "field": "name",   "headerText": "이름",   "width": 150 },
    { "field": "email",  "headerText": "이메일",  "width": 200 },
    { "field": "status", "headerText": "상태",   "width": 100 }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `field` | string | 데이터 소스의 필드 키 (dataSource 객체의 프로퍼티명과 일치) |
| `headerText` | string | 열 헤더에 표시할 텍스트 |
| `width` | number | 열 너비 (px, 선택) |

> **주의**: `header`, `key`, `name` 등 다른 필드명을 사용하면 안 된다. 반드시 `field`/`headerText`를 사용한다.

---

## 14. 폼 생성 체크리스트

AI가 폼 JSON을 생성할 때 확인해야 할 항목:

- [ ] **프로젝트 래퍼**: `{ "project": { "name": "..." }, "forms": [...] }` 구조를 사용했는가?
- [ ] **id/version 제외**: 폼에 `id`나 `version` 필드를 넣지 않았는가?
- [ ] **id와 name 일치**: 각 컨트롤의 `id`와 `name`이 유니크하고, 보통 같은 값인가?
- [ ] **필수 필드 완전성**: 모든 컨트롤에 `id`, `type`, `name`, `position`, `size`, `properties`, `anchor`, `dock`, `tabIndex`, `visible`, `enabled`가 있는가?
- [ ] **anchor 기본값**: anchor에 4방향(`top`, `bottom`, `left`, `right`) 모두 명시했는가?
- [ ] **dock 기본값**: dock을 `"None"`으로 명시했는가? (도킹하지 않는 경우)
- [ ] **properties 정확성**: 각 컨트롤 타입의 고유 속성을 `properties` 객체 안에 넣었는가?
- [ ] **이벤트 핸들러 controlId**: `eventHandlers[].controlId`가 해당 컨트롤의 `id`와 일치하는가? 폼 이벤트는 `"_form"`을 사용하는가?
- [ ] **폼 로드 이벤트**: 폼 로딩 시 서버 코드를 실행하려면 `eventName: "OnLoading"` + `handlerType: "server"` + `controlId: "_form"`을 사용했는가? (`Load`는 클라이언트 전용)
- [ ] **이벤트 핸들러 코드에서 name 사용**: `handlerCode` 안에서 `ctx.controls.<name>`으로 접근하는가? (id가 아닌 name)
- [ ] **유효한 이벤트 이름**: `eventName`이 COMMON_EVENTS 또는 해당 컨트롤의 CONTROL_EVENTS에 있는가?
- [ ] **handlerType**: `"server"`로 설정했는가?
- [ ] **TabControl 패턴**: TabControl 사용 시 `properties.tabs[].id`와 자식 Panel의 `properties.tabId`가 매칭되는가?
- [ ] **DataGridView columns**: `field`/`headerText` 형식을 사용했는가?
- [ ] **FormProperties 완전성**: `title`, `width`, `height`, `backgroundColor`, `font`, `startPosition`, `formBorderStyle`, `maximizeBox`, `minimizeBox`를 모두 명시했는가?
- [ ] **FontDefinition 완전성**: font 객체에 `family`, `size`, `bold`, `italic`, `underline`, `strikethrough` 6개 필드가 모두 있는가?
- [ ] **JSON 유효성**: 유효한 JSON인가? (trailing comma 없음, 문자열 내 줄바꿈은 `\n` 사용)

---

## 15. form-gen.sh — 폼 임포트 스크립트

FORM.md 형식에 맞는 JSON을 서버에 임포트하는 CLI 스크립트이다.

### 사전 조건

- 서버(`localhost:4000`)가 실행 중이어야 한다 (`pnpm dev` 또는 `./run.sh`)
- `packages/server/.env`에 `JWT_SECRET`이 설정되어 있어야 한다

### 사용법

```bash
# JSON 파일로 임포트
./form-gen.sh my-form.json

# stdin으로 JSON 입력 (AI 파이프라인용)
./form-gen.sh -

# 파이프로 JSON 전달
echo '{ ... }' | ./form-gen.sh -

# AI(Claude) 출력을 바로 임포트
claude -p "FORM.md를 참조하여 로그인 폼 JSON을 만들어줘" | ./form-gen.sh -

# 결과 JSON을 파일로 저장 (로그는 stderr로 출력)
./form-gen.sh my-form.json > result.json

# 도움말
./form-gen.sh --help
```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `WEBFORM_API_URL` | API 서버 URL | `http://localhost:4000` |

### 동작 흐름

1. JSON 파일 또는 stdin에서 데이터 읽기
2. JSON 유효성 검사 (필수 필드 `project.name`, `forms[].name` 확인)
3. `packages/server/.env`의 `JWT_SECRET`으로 인증 토큰 자동 생성
4. API 서버 상태 확인
5. `GET /api/projects?search=`로 **동일 이름의 기존 프로젝트 검색**
   - **기존 프로젝트가 있으면**: 해당 프로젝트에 `POST /api/forms`로 폼만 추가 (프로젝트 중복 생성 없음)
   - **기존 프로젝트가 없으면**: `POST /api/projects/import`로 새 프로젝트와 폼을 함께 생성
6. `eventHandlers`에서 `controlId: "_form"`을 실제 생성된 폼의 MongoDB `_id`로 **자동 변환** (AI는 항상 `"_form"`을 사용하면 된다)
7. 결과 요약 출력 (프로젝트 ID, 폼/컨트롤/이벤트 수)

### 출력

- **stderr**: 진행 로그 (색상 포함)
- **stdout**: 서버 응답 JSON (파이프라인 연동용)
