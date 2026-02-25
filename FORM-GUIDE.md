# FORM-GUIDE.md — WebForm 폼 JSON 생성 가이드 (AI용)

## 1. JSON 구조

```jsonc
{
  "project": { "name": "프로젝트명", "description": "설명" },
  "forms": [
    {
      "name": "폼 이름",
      "properties": { /* FormProperties */ },
      "controls": [ /* ControlDefinition[] */ ],
      "eventHandlers": [ /* EventHandlerDefinition[] */ ],
      "dataBindings": []
    }
  ]
}
```

- `id`, `version`은 서버가 자동 생성. 요청에 포함하지 않는다.
- 임포트: `POST /api/projects/import` 또는 `./form-gen.sh my-form.json`

---

## 2. FormProperties

```jsonc
{
  "title": "폼 제목",
  "width": 800, "height": 600,
  "backgroundColor": "#F0F0F0",
  "font": { "family": "Segoe UI", "size": 9, "bold": false, "italic": false, "underline": false, "strikethrough": false },
  "startPosition": "CenterScreen",    // "CenterScreen" | "Manual" | "CenterParent"
  "windowState": "Maximized",         // "Normal" | "Maximized" (Maximized면 부모 영역 100% 채움, 타이틀바 숨김)
  "formBorderStyle": "Sizable",       // "None" | "FixedSingle" | "Fixed3D" | "Sizable"
  "maximizeBox": true,
  "minimizeBox": true
}
```

> **font**: 6개 필드(`family`, `size`, `bold`, `italic`, `underline`, `strikethrough`) 모두 명시해야 한다.

---

## 3. ControlDefinition (공통 구조)

```jsonc
{
  "id": "txtName",                          // 고유 식별자 (보통 name과 동일)
  "type": "TextBox",                        // 컨트롤 타입 (아래 목록 참조)
  "name": "txtName",                        // 이벤트에서 ctx.controls.<name>으로 접근
  "position": { "x": 100, "y": 50 },
  "size": { "width": 200, "height": 26 },
  "properties": { /* 타입별 고유 속성 */ },
  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
  "dock": "None",                           // "None"|"Top"|"Bottom"|"Left"|"Right"|"Fill"
  "tabIndex": 0,
  "visible": true,
  "enabled": true,
  "children": []                            // 컨테이너만: Panel, GroupBox, TabControl, SplitContainer, Card, Tooltip, Collapse
}
```

> **필수 필드**: `id`, `type`, `name`, `position`, `size`, `properties`, `anchor`(4방향 모두), `dock`, `tabIndex`, `visible`, `enabled`
> **dock 우선**: dock이 `"None"`이 아니면 anchor는 무시된다.

---

## 4. 컨트롤 타입별 properties

### Basic (20종)

| 타입 | 주요 properties |
|------|----------------|
| **Button** | `text`, `backColor`, `foreColor`, `font`, `textAlign`("MiddleCenter" 등) |
| **Label** | `text`, `backColor`, `foreColor`, `font`, `textAlign`("MiddleLeft" 등), `autoSize` |
| **TextBox** | `text`, `multiline`, `readOnly`, `maxLength`, `passwordChar`, `textAlign`("Left"\|"Center"\|"Right"), `backColor`, `foreColor`, `font` |
| **CheckBox** | `text`, `checked`, `backColor`, `foreColor`, `font` |
| **RadioButton** | `text`, `checked`, `groupName`(같은 그룹 내 하나만 선택), `backColor`, `foreColor`, `font` |
| **ComboBox** | `items`(문자열 배열), `selectedIndex`(-1=미선택), `dropDownStyle`("DropDown"\|"DropDownList"\|"Simple"), `backColor`, `foreColor`, `font` |
| **ListBox** | `items`(문자열 배열), `selectedIndex`, `selectionMode`("None"\|"One"\|"MultiSimple"\|"MultiExtended"), `backColor`, `foreColor`, `font` |
| **NumericUpDown** | `value`, `minimum`, `maximum`, `backColor`, `foreColor`, `font` |
| **DateTimePicker** | `value`("2026-01-01"), `format`("Short"\|"Long"\|"Time"\|"Custom"), `backColor`, `foreColor`, `font` |
| **ProgressBar** | `value`, `minimum`, `maximum`, `style`("Blocks"\|"Continuous"\|"Marquee") |
| **PictureBox** | `imageUrl`, `sizeMode`("Normal"\|"StretchImage"\|"AutoSize"\|"CenterImage"\|"Zoom"), `backColor`, `borderStyle` |
| **RichTextBox** | `text`, `readOnly`, `scrollBars`("None"\|"Horizontal"\|"Vertical"\|"Both"), `backColor`, `foreColor`, `font` |
| **Slider** | `value`, `minimum`(0), `maximum`(100), `step`(1), `orientation`("Horizontal"\|"Vertical"), `showValue`, `trackColor`, `fillColor` |
| **Switch** | `checked`, `text`, `onText`("ON"), `offText`("OFF"), `onColor`, `offColor` |
| **Alert** | `message`, `description`, `alertType`("Success"\|"Info"\|"Warning"\|"Error"), `showIcon`, `closable`, `banner`, `foreColor` |
| **Tag** | `tags`(문자열 배열), `tagColor`("Default"\|"Blue"\|"Green"\|"Red"\|"Orange"\|"Purple"\|"Cyan"\|"Gold"), `closable`, `addable`, `foreColor` |
| **Divider** | `text`, `orientation`("Horizontal"\|"Vertical"), `textAlign`("Left"\|"Center"\|"Right"), `lineStyle`("Solid"\|"Dashed"\|"Dotted"), `lineColor`, `foreColor` |
| **Badge** | `count`, `overflowCount`(99), `showZero`, `dot`, `status`("Default"\|"Success"\|"Processing"\|"Error"\|"Warning"), `text`, `badgeColor`, `offset` |
| **Avatar** | `imageUrl`, `text`("U"), `shape`("Circle"\|"Square"), `backColor`, `foreColor` |
| **Statistic** | `title`, `value`("0"), `prefix`, `suffix`, `precision`(0), `showGroupSeparator`, `valueColor`, `foreColor` |

### Container (10종)

| 타입 | 주요 properties | children 규칙 |
|------|----------------|---------------|
| **Panel** | `backColor`, `borderStyle`("None"\|"FixedSingle"\|"Fixed3D"), `autoScroll` | 자유 배치 |
| **GroupBox** | `text`(그룹 제목), `backColor`, `foreColor`, `font` | 자유 배치 (내부 좌표) |
| **TabControl** | `tabs`([{title, id}]), `selectedIndex` | Panel들 (각 Panel에 `properties.tabId` 필수) |
| **SplitContainer** | `orientation`("Horizontal"\|"Vertical"), `splitterDistance`, `splitterWidth`, `fixedPanel`, `isSplitterFixed` | 정확히 Panel 2개 |
| **MenuStrip** | `items`([{text, children, shortcut, enabled, checked, separator, formId}]), `backColor` | dock: "Top" |
| **ToolStrip** | `items`([{type, text, icon, tooltip, enabled, checked, items}]), `backColor` | dock: "Top" |
| **StatusStrip** | `items`([{type, text, spring, width, value}]), `backColor` | dock: "Bottom" |
| **Card** | `title`, `subtitle`, `showHeader`, `showBorder`, `hoverable`, `size`("Default"\|"Small"), `backColor`, `foreColor`, `borderRadius` | 자유 배치 |
| **Tooltip** | `title`, `placement`("Top"\|"Bottom"\|"Left"\|"Right"\|"TopLeft"\|"TopRight"\|"BottomLeft"\|"BottomRight"), `trigger`("Hover"\|"Click"\|"Focus"), `backColor`, `foreColor` | 래퍼 (자식 1개) |
| **Collapse** | `panels`([{title, key}]), `activeKeys`, `accordion`, `bordered`, `expandIconPosition`("Start"\|"End"), `backColor`, `foreColor` | 패널별 자식 배치 |

### Data (11종)

| 타입 | 주요 properties |
|------|----------------|
| **DataGridView** | `columns`([{**field**, **headerText**, width}]), `dataSource`([]), `readOnly`, `backColor`, `foreColor`, `font` |
| **TreeView** | `nodes`([{text, children}] 재귀), `showLines`, `showPlusMinus`, `checkBoxes`, `backColor`, `foreColor`, `font` |
| **ListView** | `items`([{text, subItems}]), `columns`([{text, width}]), `view`("Details"등), `multiSelect`, `fullRowSelect`, `gridLines` |
| **Chart** | `chartType`("Line"\|"Bar"\|"Column"\|"Pie"등), `series`, `title`, `xAxisTitle`, `yAxisTitle`, `showLegend`, `showGrid` |
| **GraphView** | `graphType`("Line"\|"Bar"\|"Pie"등), `data`, `title`, `showLegend`, `showGrid`, `colors` |
| **SpreadsheetView** | `columns`, `data`, `dataSource`, `readOnly`, `showToolbar`, `showFormulaBar`, `showRowNumbers` |
| **JsonEditor** | `value`(JSON문자열), `readOnly`, `expandDepth` |
| **MongoDBView** | `title`, `connectionString`, `database`, `collection`, `columns`, `filter`, `pageSize`, `readOnly` |
| **WebBrowser** | `url`, `allowNavigation` |
| **BindingNavigator** | `bindingSource`, `showAddButton`, `showDeleteButton` |
| **Upload** | `uploadMode`("Button"\|"DropZone"), `text`, `accept`, `multiple`, `maxFileSize`(MB), `maxCount`, `backColor`, `foreColor`, `borderStyle`("None"\|"Solid"\|"Dashed") |

### 비시각적 (1종)

| 타입 | 주요 properties | 용도 |
|------|----------------|------|
| **MongoDBConnector** | `connectionString`, `database`, `defaultCollection`, `queryTimeout`, `maxResultCount` | ctx.controls.\<name\>.find/insertOne/updateOne/deleteOne/count |

---

## 4-1. 컨트롤별 데이터 구조 상세

AI가 올바른 샘플 데이터를 생성하려면 각 컨트롤의 정확한 데이터 형식을 알아야 한다.

### DataGridView — columns / dataSource

```jsonc
{
  "columns": [
    { "field": "name", "headerText": "이름", "width": 150, "sortable": true, "editable": false },
    { "field": "email", "headerText": "이메일", "width": 200 },
    { "field": "age", "headerText": "나이", "width": 80 }
  ],
  "dataSource": [
    { "name": "홍길동", "email": "hong@example.com", "age": 30 },
    { "name": "김철수", "email": "kim@example.com", "age": 25 }
  ],
  "readOnly": false
}
```

> - `field`(필수): 데이터 객체의 키. `key`도 폴백으로 허용.
> - `headerText`(필수): 열 헤더 텍스트. `name`도 폴백으로 허용.
> - `width`, `sortable`, `editable`는 선택적.
> - `dataSource`는 객체 배열. `_id`, `__v`, `createdAt`, `updatedAt` 필드는 자동 제외.

### GraphView — data

```jsonc
{
  "graphType": "Bar",
  "data": [
    { "x": "1월", "sales": 100, "revenue": 2000 },
    { "x": "2월", "sales": 120, "revenue": 2400 },
    { "x": "3월", "sales": 90, "revenue": 1800 }
  ],
  "title": "월별 매출",
  "xAxisTitle": "월",
  "yAxisTitle": "금액",
  "showLegend": true,
  "showGrid": true,
  "colors": "#1565C0,#E91E63"
}
```

> - **카테고리 키 자동 감지**: `x`, `name`, `subject` 순서로 탐색. 해당 키가 X축 라벨이 된다.
> - **시리즈 키**: 카테고리 키를 제외한 **숫자 타입** 필드가 자동으로 시리즈가 된다.
> - `data`는 객체 배열, JSON 문자열, CSV 문자열 모두 허용.
> - `colors`는 쉼표 구분 hex 색상 문자열.
> - Scatter 차트: `x`(숫자), `y`(숫자) 필드 필수.
> - graphType: `"Line"` | `"Bar"` | `"HorizontalBar"` | `"Area"` | `"StackedBar"` | `"StackedArea"` | `"Pie"` | `"Donut"` | `"Scatter"` | `"Radar"`

### Chart — series

GraphView와 동일한 데이터 형식을 사용한다.

```jsonc
{
  "chartType": "Column",
  "series": [
    { "name": "Q1", "sales": 100, "revenue": 5000 },
    { "name": "Q2", "sales": 120, "revenue": 6000 }
  ],
  "title": "분기별 실적",
  "showLegend": true,
  "showGrid": true
}
```

> - chartType: `"Line"` | `"Bar"` | `"Column"` | `"Area"` | `"Pie"` | `"Doughnut"` | `"Scatter"` | `"Radar"`
> - `series` 형식은 GraphView의 `data`와 동일 (카테고리 키 + 숫자 시리즈).

### SpreadsheetView — columns / data

```jsonc
{
  "columns": [
    { "field": "product", "headerText": "상품명", "width": 150 },
    { "field": "price", "headerText": "가격", "width": 100 },
    { "field": "qty", "headerText": "수량", "width": 80 }
  ],
  "data": [
    { "product": "노트북", "price": 1500000, "qty": 5 },
    { "product": "마우스", "price": 35000, "qty": 20 }
  ],
  "showToolbar": true,
  "showFormulaBar": true,
  "showRowNumbers": true,
  "allowAddRows": true,
  "allowDeleteRows": true,
  "allowSort": true,
  "allowFilter": false,
  "readOnly": false
}
```

> - `columns[].field`(필수), `columns[].headerText`(필수), `columns[].width`(선택).
> - `data`는 객체 배열. `dataSource`도 폴백으로 허용.
> - `data`는 JSON 문자열이나 CSV 문자열도 허용.

### TreeView — nodes (재귀)

```jsonc
{
  "nodes": [
    {
      "text": "본사",
      "expanded": true,
      "children": [
        { "text": "개발팀", "children": [
            { "text": "프론트엔드" },
            { "text": "백엔드" }
          ]
        },
        { "text": "디자인팀" }
      ]
    },
    { "text": "지사", "expanded": false, "children": [
        { "text": "영업팀" }
      ]
    }
  ],
  "showLines": false,
  "showPlusMinus": true,
  "checkBoxes": false
}
```

> - `text`(필수): 노드 라벨.
> - `children`(선택): 하위 노드 배열 (재귀).
> - `expanded`(선택): 펼침 상태. 기본값 true (자식이 있을 때).
> - `checked`(선택): `checkBoxes: true`일 때 체크 상태.
> - `imageIndex`(선택): 아이콘 인덱스.

### ListView — items / columns

```jsonc
{
  "view": "Details",
  "columns": [
    { "text": "파일명", "width": 200 },
    { "text": "크기", "width": 100 },
    { "text": "수정일", "width": 150 }
  ],
  "items": [
    { "text": "document.pdf", "subItems": ["1.2MB", "2026-01-15"] },
    { "text": "photo.jpg", "subItems": ["3.5MB", "2026-02-01"] }
  ],
  "multiSelect": false,
  "fullRowSelect": true,
  "gridLines": false
}
```

> - `columns[].text`(필수): 열 헤더. `columns[].width`(선택).
> - `items[].text`(필수): 첫 번째 열 텍스트.
> - `items[].subItems`(선택): 나머지 열의 문자열 배열 (Details 뷰에서 사용).
> - `items[].imageIndex`(선택): 아이콘 인덱스.
> - `view`: `"LargeIcon"` | `"SmallIcon"` | `"List"` | `"Details"` | `"Tile"`

### MenuStrip — items (재귀)

```jsonc
{
  "items": [
    {
      "text": "파일",
      "children": [
        { "text": "새로 만들기", "shortcut": "Ctrl+N" },
        { "text": "열기", "shortcut": "Ctrl+O", "formId": "openFormId" },
        { "text": "", "separator": true },
        { "text": "저장", "shortcut": "Ctrl+S", "enabled": true },
        { "text": "끝내기" }
      ]
    },
    {
      "text": "편집",
      "children": [
        { "text": "복사", "shortcut": "Ctrl+C" },
        { "text": "붙여넣기", "shortcut": "Ctrl+V", "enabled": false }
      ]
    }
  ],
  "backColor": "#F0F0F0"
}
```

> - `text`(필수): 메뉴 항목 텍스트. 구분선은 `""`.
> - `children`(선택): 하위 메뉴 배열 (재귀).
> - `shortcut`(선택): 단축키 표시 텍스트.
> - `separator`(선택): `true`이면 구분선.
> - `formId`(선택): 클릭 시 해당 폼으로 자동 네비게이션.
> - `enabled`(선택): 비활성화 여부.
> - `checked`(선택): 체크마크 표시.

### ToolStrip — items

```jsonc
{
  "items": [
    { "type": "button", "text": "새로 만들기", "icon": "📄", "tooltip": "새 문서" },
    { "type": "button", "text": "열기", "icon": "📂" },
    { "type": "separator" },
    { "type": "label", "text": "보기:" },
    {
      "type": "dropdown", "text": "확대",
      "items": [
        { "type": "button", "text": "50%" },
        { "type": "button", "text": "100%" },
        { "type": "button", "text": "150%" }
      ]
    }
  ],
  "backColor": "#F0F0F0"
}
```

> - `type`(필수): `"button"` | `"separator"` | `"label"` | `"dropdown"`
> - `text`(선택): 항목 텍스트.
> - `icon`(선택): 이모지/아이콘.
> - `tooltip`(선택): 마우스 오버 시 툴팁.
> - `enabled`(선택): 활성화 여부.
> - `checked`(선택): 눌림/활성 상태.
> - `items`(선택): `dropdown` 타입의 하위 항목 배열.

### StatusStrip — items

```jsonc
{
  "items": [
    { "type": "label", "text": "준비", "spring": true },
    { "type": "progressBar", "value": 75, "width": 150 },
    { "type": "label", "text": "행: 42", "width": 80 }
  ],
  "backColor": "#F0F0F0"
}
```

> - `type`(필수): `"label"` | `"progressBar"` | `"dropDownButton"`
> - `text`(선택): 표시 텍스트.
> - `spring`(선택): `true`이면 남은 공간을 채움 (가변 폭).
> - `width`(선택): 고정 너비 (px).
> - `value`(선택): `progressBar`의 값 (0–100).

### Tag — tags

```jsonc
{
  "tags": ["태그1", "태그2", "태그3"],
  "tagColor": "Blue",
  "closable": true,
  "addable": true
}
```

> - `tags`(필수): 문자열 배열. 각 항목이 하나의 태그 칩으로 렌더링.
> - `closable: true` → 각 태그에 ✕ 버튼 표시, 클릭 시 `onTagRemoved` (eventArgs: `{ tag }`).
> - `addable: true` → `+ New Tag` 칩 표시, 클릭 시 인라인 input → `onTagAdded` (eventArgs: `{ tag }`).

### Upload — 파일 메타 전달

```jsonc
{
  "uploadMode": "DropZone",
  "text": "파일을 드래그하거나 클릭하세요",
  "accept": ".pdf,.docx",
  "multiple": true,
  "maxFileSize": 10,
  "maxCount": 5
}
```

> - `accept`: MIME 타입 또는 확장자 (예: `".pdf,.docx"`, `"image/*"`). 빈 문자열이면 모든 파일 허용.
> - 파일 선택 시 `onFileSelected` 이벤트 발생 (eventArgs: `{ files: [{ name, size, type }] }`).
> - 실제 업로드는 이벤트 핸들러 코드에서 `ctx.http.post()` 등으로 처리.

### Collapse — panels

```jsonc
{
  "panels": [
    { "title": "섹션 1", "key": "1" },
    { "title": "섹션 2", "key": "2" },
    { "title": "섹션 3", "key": "3" }
  ],
  "activeKeys": "1",
  "accordion": false,
  "bordered": true
}
```

> - `panels[].title`(필수): 패널 헤더 텍스트.
> - `panels[].key`(필수): 패널 고유 키. `activeKeys`와 매칭하여 열림/닫힘 결정.
> - `activeKeys`: 열려 있는 패널의 key (쉼표 구분 문자열 또는 단일 key).
> - `accordion: true` → 한 번에 하나의 패널만 열림.
> - 자식 컨트롤은 패널 key에 매칭하여 배치 (TabControl 패턴과 동일).

### MongoDBView — columns

```jsonc
{
  "connectionString": "mongodb://localhost:27017",
  "database": "mydb",
  "collection": "users",
  "columns": "name,email,phone",
  "filter": "{\"status\": \"active\"}",
  "pageSize": 25,
  "readOnly": false,
  "showToolbar": true
}
```

> - `columns`는 **쉼표 구분 문자열**: `"field1,field2,field3"`. 생략하면 첫 문서에서 자동 감지.
> - `filter`는 MongoDB 쿼리 JSON **문자열**.
> - `connectionString`은 서버의 MongoDBConnector를 통해 접속하므로 서버에서 접근 가능한 주소여야 한다.

---

## 5. 이벤트 시스템

### EventHandlerDefinition

```jsonc
{
  "controlId": "btnSubmit",      // 대상 컨트롤 id. 폼 이벤트는 반드시 "_form" 사용
  "eventName": "Click",
  "handlerType": "server",       // 항상 "server" (isolated-vm 실행)
  "handlerCode": "ctx.controls.lblStatus.text = '클릭됨';"
}
```

### 이벤트 목록

**공통 (모든 컨트롤)**: Click, DoubleClick, MouseEnter, MouseLeave, MouseDown, MouseUp, MouseMove, KeyDown, KeyUp, KeyPress, Enter, Leave, Validating, Validated, VisibleChanged, EnabledChanged

**폼 전용** (controlId: `"_form"`): Load(클라이언트), **OnLoading**(서버—폼 로드 시 데이터 조회용), BeforeLeaving, Shown, FormClosing, FormClosed, Resize

**컨트롤 고유 이벤트**:

| 컨트롤 | 이벤트 |
|--------|--------|
| TextBox, RichTextBox | TextChanged |
| ComboBox, ListBox, TabControl | SelectedIndexChanged |
| CheckBox, RadioButton | CheckedChanged |
| NumericUpDown, DateTimePicker | ValueChanged |
| DataGridView | CellClick, CellValueChanged, RowEnter, SelectionChanged |
| TreeView | AfterSelect, AfterExpand, AfterCollapse |
| ListView | SelectedIndexChanged, ItemActivate |
| MenuStrip, ToolStrip, StatusStrip | ItemClicked |
| Slider | ValueChanged |
| Switch | CheckedChanged |
| Upload | FileSelected, UploadCompleted, UploadFailed |
| Alert | Closed |
| Tag | TagAdded, TagRemoved, TagClicked |
| Tooltip | VisibleChanged |
| Collapse | ActiveKeyChanged |

> **OnLoading vs Load**: 폼 로드 시 서버에서 데이터 조회하려면 반드시 `OnLoading` + `handlerType: "server"` + `controlId: "_form"` 사용.

---

## 6. ctx API (이벤트 핸들러 코드에서 사용)

```javascript
// 컨트롤 읽기/쓰기 — name으로 접근
ctx.controls.txtName.text;
ctx.controls.lblStatus.text = "완료";
ctx.controls.btnSubmit.enabled = false;
ctx.controls.pnlDetail.visible = true;
ctx.controls.cmbCategory.selectedIndex;
ctx.controls.dgvList.dataSource = [...];

// 메시지 다이얼로그
ctx.showMessage("저장 완료", "알림", "info");   // type: "info"|"warning"|"error"

// HTTP 요청 — 반환: { status, ok, data }
ctx.http.get(url);
ctx.http.post(url, body);
ctx.http.put(url, body);
ctx.http.patch(url, body);
ctx.http.delete(url);

// 네비게이션
ctx.navigate("targetFormId", { key: "value" });

// 라디오 그룹 값 조회
ctx.getRadioGroupValue("groupName");  // 선택된 라디오의 text 반환

// MongoDB (MongoDBConnector 컨트롤 필요)
ctx.controls.myDb.find(collection, filter);       // → 문서 배열
ctx.controls.myDb.findOne(collection, filter);    // → 문서 | null
ctx.controls.myDb.insertOne(collection, doc);     // → { insertedId }
ctx.controls.myDb.updateOne(collection, filter, update); // → { modifiedCount }
ctx.controls.myDb.deleteOne(collection, filter);  // → { deletedCount }
ctx.controls.myDb.count(collection, filter);      // → 숫자

// 기타
ctx.sender;       // 이벤트 발생 컨트롤
ctx.eventArgs;    // 이벤트 인자
console.log();    // 디버그 로그
```

### Shell 모드 전용 ctx API

```javascript
ctx.currentFormId;                    // 현재 활성 폼 ID
ctx.params;                           // 네비게이션 파라미터 객체
ctx.appState;                         // Shell 전역 상태 (읽기/쓰기, 모든 폼 공유)
ctx.navigateBack();                   // 이전 폼으로
ctx.navigateReplace(formId, params);  // 현재 폼 교체 (히스토리 없음)
ctx.closeApp();                       // Shell 종료
```

---

## 7. 컨테이너 패턴

### TabControl

```jsonc
// properties.tabs[].id ↔ 자식 Panel의 properties.tabId 매칭 필수
{
  "type": "TabControl",
  "properties": { "tabs": [{ "title": "탭1", "id": "tab1" }], "selectedIndex": 0 },
  "children": [
    { "type": "Panel", "properties": { "tabId": "tab1" }, "children": [...] }
  ]
}
```

### SplitContainer

```jsonc
// children에 정확히 Panel 2개
{
  "type": "SplitContainer",
  "properties": { "orientation": "Vertical", "splitterDistance": 200 },
  "children": [
    { "type": "Panel", "children": [...] },   // Panel1
    { "type": "Panel", "children": [...] }    // Panel2
  ]
}
```

### Card

```jsonc
// Panel/GroupBox와 동일한 자식 배치 패턴
{
  "type": "Card",
  "properties": { "title": "카드 제목", "subtitle": "부제목", "showHeader": true, "showBorder": true, "hoverable": false, "borderRadius": 8 },
  "children": [
    { "type": "Label", "position": { "x": 16, "y": 16 }, ... }
  ]
}
```

### Tooltip

```jsonc
// 자식 컨트롤을 감싸는 래퍼
{
  "type": "Tooltip",
  "properties": { "title": "도움말 텍스트", "placement": "Top", "trigger": "Hover" },
  "children": [
    { "type": "Button", "properties": { "text": "호버하세요" }, ... }
  ]
}
```

### Collapse

```jsonc
// panels[].key ↔ 자식 배치 (TabControl과 유사)
{
  "type": "Collapse",
  "properties": {
    "panels": [{ "title": "섹션 1", "key": "1" }, { "title": "섹션 2", "key": "2" }],
    "activeKeys": "1",
    "accordion": false
  },
  "children": [...]
}
```

### MenuStrip 아이템 (formId로 선언적 네비게이션)

```jsonc
{
  "text": "대시보드",
  "formId": "targetFormObjectId",  // 클릭 시 자동으로 해당 폼으로 네비게이션
  "shortcut": "Ctrl+D"
}
```

---

## 8. 체크리스트

- [ ] `{ "project": { "name": "..." }, "forms": [...] }` 래퍼 구조
- [ ] 폼에 `id`/`version` 미포함
- [ ] 모든 컨트롤에 필수 11개 필드 (`id`, `type`, `name`, `position`, `size`, `properties`, `anchor`(4방향), `dock`, `tabIndex`, `visible`, `enabled`)
- [ ] `id`와 `name` 동일, 프로젝트 내 유니크
- [ ] anchor 4방향 모두 명시 / dock 미사용 시 `"None"`
- [ ] 이벤트 핸들러 코드에서 `ctx.controls.<name>`으로 접근 (id 아님)
- [ ] 폼 이벤트의 controlId는 `"_form"` 사용
- [ ] 폼 로드 시 서버 로직은 `OnLoading` 이벤트 사용 (`Load`는 클라이언트 전용)
- [ ] `handlerType`은 `"server"`
- [ ] font 객체 6개 필드 모두 명시
- [ ] FormProperties 모두 명시 (`title`, `width`, `height`, `backgroundColor`, `font`, `startPosition`, `windowState`, `formBorderStyle`, `maximizeBox`, `minimizeBox`)
- [ ] DataGridView columns는 `field`(필수)/`headerText`(필수) 형식
- [ ] GraphView/Chart data는 카테고리 키(`x`/`name`/`subject`) + 숫자 시리즈 필드
- [ ] SpreadsheetView columns는 `field`(필수)/`headerText`(필수) 형식
- [ ] TreeView nodes는 `text`(필수) + `children`(선택, 재귀) 구조
- [ ] ListView: Details 뷰 시 `columns[].text` + `items[].subItems` 개수 일치
- [ ] ToolStrip items `type` 값: `"button"` | `"separator"` | `"label"` | `"dropdown"`
- [ ] StatusStrip items `type` 값: `"label"` | `"progressBar"` | `"dropDownButton"`
- [ ] MongoDBView `columns`는 쉼표 구분 문자열 (예: `"name,email,phone"`)
- [ ] TabControl: `tabs[].id` ↔ 자식 Panel `tabId` 매칭
- [ ] Collapse: `panels[].key` ↔ 자식 컨트롤 패널 소속 매칭
- [ ] Tag: `tags`는 문자열 배열
- [ ] Upload: `accept`는 MIME 타입 또는 확장자 문자열 (예: `".pdf,.docx"`, `"image/*"`)
- [ ] Card/Tooltip/Collapse: 컨테이너 — `children`에 자식 컨트롤 배치
- [ ] JSON 유효성 (trailing comma 없음, 줄바꿈은 `\n`)

---

## 9. 유틸리티 스크립트

### 9-1. generate-themes.sh — 프리셋 테마 시딩

프리셋 테마(24개)를 API를 통해 MongoDB에 시딩한다. 서버 시작 시 자동 시딩되지 않으므로, 최초 환경 구성 시 반드시 실행해야 한다.

```bash
# 서버 실행 중 상태에서
./generate-themes.sh
```

- `.env`에서 `PORT`, `JWT_SECRET`을 읽어 JWT 토큰 생성 후 `POST /api/themes/seed` 호출
- 첫 실행: `24 upserted` / 재실행: `24 unchanged` 출력
- 사전 조건: API 서버 실행 중, `.env`에 `JWT_SECRET` 설정

### 9-2. form-gen.sh — 폼 JSON 임포트

JSON 파일을 작성한 후 `form-gen.sh`로 서버에 임포트한다.

### 사전 조건

- API 서버(`localhost:4000`)가 실행 중이어야 한다.
- **현재 디렉토리**의 `.env` 파일에 `JWT_SECRET`이 설정되어 있어야 한다.
- 외부 npm 패키지 불필요 (Node.js 내장 `crypto`로 JWT 생성).

### 기본 사용법

```bash
# JSON 파일로 임포트
./form-gen.sh my-form.json

# stdin으로 JSON 입력 (AI 파이프라인용)
echo '{ ... }' | ./form-gen.sh -

# 결과 JSON만 stdout으로 출력 (로그는 stderr)
./form-gen.sh my-form.json > result.json

# 도움말
./form-gen.sh --help
```

### 동작 방식

1. JSON 유효성 검사 (project.name, forms 배열 등)
2. `.env`에서 `JWT_SECRET`을 읽어 JWT 토큰 생성
3. 동일 이름의 프로젝트가 이미 존재하면 → 기존 프로젝트에 폼 추가
4. 존재하지 않으면 → 새 프로젝트 생성 (`POST /api/projects/import`)
5. 결과 출력: 프로젝트 ID, 폼/컨트롤/이벤트 수

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WEBFORM_API_URL` | `http://localhost:4000` | API 서버 URL |

### .env 필수 항목

```
JWT_SECRET=your-secret-key-here
```

> **주의**: 같은 프로젝트명으로 반복 실행하면 폼이 중복 추가된다. 기존 폼을 교체하려면 Designer에서 삭제 후 재실행하거나, API로 프로젝트를 삭제(`DELETE /api/projects/:id`) 후 재실행한다.

---

## 10. 최소 예제

```json
{
  "project": { "name": "예제", "description": "" },
  "forms": [
    {
      "name": "회원 등록",
      "properties": {
        "title": "회원 등록", "width": 500, "height": 300, "backgroundColor": "#F0F0F0",
        "font": { "family": "Segoe UI", "size": 9, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen", "windowState": "Maximized",
        "formBorderStyle": "Sizable", "maximizeBox": true, "minimizeBox": true
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
          "id": "btnSave", "type": "Button", "name": "btnSave",
          "position": { "x": 110, "y": 60 }, "size": { "width": 100, "height": 32 },
          "properties": { "text": "저장", "backColor": "#1565C0", "foreColor": "#FFFFFF" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "lblStatus", "type": "Label", "name": "lblStatus",
          "position": { "x": 110, "y": 105 }, "size": { "width": 300, "height": 23 },
          "properties": { "text": "" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnSave",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var name = ctx.controls.txtName.text;\nif (!name) {\n  ctx.showMessage('이름을 입력하세요.', '오류', 'warning');\n  return;\n}\nctx.controls.lblStatus.text = name + ' 저장 완료';\nctx.controls.lblStatus.foreColor = '#2E7D32';"
        }
      ],
      "dataBindings": []
    }
  ]
}
```
