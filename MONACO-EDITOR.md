# Monaco Editor 사용 가이드

이 문서는 WebForm Designer에 내장된 코드 편집기(Monaco Editor)의 사용법과 지원 기능을 설명합니다.

---

## 코드 편집기 열기

이벤트 핸들러 코드를 작성하려면 코드 편집기를 열어야 합니다.

### 방법 1: 더블클릭

1. 디자인 캔버스에서 컨트롤을 선택합니다.
2. 우측 속성 패널에서 **Events** 탭을 클릭합니다.
3. 원하는 이벤트 행을 **더블클릭**합니다.
4. 핸들러 이름이 자동으로 `컨트롤명_이벤트명` 형식으로 생성되며 편집기가 열립니다.

### 방법 2: Enter 키

1. 속성 패널의 Events 탭에서 핸들러 이름 입력란에 원하는 이름을 입력합니다.
2. **Enter** 키를 누르면 편집기가 열립니다.

---

## 편집기 레이아웃

편집기는 전체 화면 모달(80% x 70% 뷰포트)로 열리며, 세 영역으로 구성됩니다.

```
┌──────────────────────────────────────────────────────┐
│  btnSubmit_Click — Click (btnSubmit)   [Save&Close] [Close] │  ← 헤더
├──────────────────────────────────────────────────────┤
│                                                      │
│  1 │ // btnSubmit_Click(ctx, sender)                 │
│  2 │ // Control: btnSubmit (Button)                  │
│  3 │ // Event: Click                                 │
│  4 │                                                 │
│  5 │ const name = ctx.controls.txtName.text;         │  ← 코드 영역
│  6 │ if (!name) {                                    │
│  7 │   ctx.showMessage("이름을 입력해주세요.");        │
│  8 │   return;                                       │
│  9 │ }                                               │
│ 10 │                                                 │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Ctrl+S: Save | Escape: Close                        │  ← 상태 바
└──────────────────────────────────────────────────────┘
```

| 영역 | 설명 |
|------|------|
| **헤더** | 핸들러 이름, 이벤트명, 컨트롤명 표시. Save & Close / Close 버튼 |
| **코드 영역** | Monaco Editor (VS Code 기반). TypeScript 구문 강조, IntelliSense 지원 |
| **상태 바** | 단축키 안내 |

---

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+S` (Mac: `Cmd+S`) | 코드 저장 (편집기 열린 상태 유지) |
| `Escape` | 편집기 닫기 (저장하지 않음) |

### 버튼

| 버튼 | 동작 |
|------|------|
| **Save & Close** | 코드를 저장하고 편집기를 닫음 |
| **Close** | 저장하지 않고 편집기를 닫음 |

> **주의:** Close 또는 Escape로 닫으면 변경 내용이 저장되지 않습니다. 작성 중인 코드를 유지하려면 반드시 **Ctrl+S** 또는 **Save & Close**를 사용하세요.

---

## IntelliSense (자동완성)

편집기는 TypeScript 언어 서비스를 내장하고 있어 코드 작성 시 자동완성, 타입 힌트, 오류 검사를 제공합니다.

### 자동완성 사용법

코드를 입력하다 `.` (점)을 누르면 사용 가능한 속성과 메서드 목록이 표시됩니다.

```
ctx.               →  formId, controls, dataSources, http,
                       showMessage(), showDialog(), navigate(), close()

ctx.http.           →  get(), post(), put(), patch(), delete()

ctx.controls.       →  [폼에 배치된 컨트롤 이름들]

sender.             →  [이벤트를 발생시킨 컨트롤의 속성들]
```

`Ctrl+Space`를 눌러 수동으로 자동완성 목록을 호출할 수도 있습니다.

### 지원되는 타입 정의

편집기에는 다음 인터페이스가 미리 등록되어 있어 타입 기반 자동완성이 동작합니다.

#### ctx (FormContext)

| 멤버 | 타입 | 설명 |
|------|------|------|
| `formId` | `string` | 현재 폼 ID |
| `controls` | `Record<string, ControlProxy>` | 모든 컨트롤 접근 |
| `dataSources` | `Record<string, DataSourceProxy>` | 데이터소스 접근 |
| `http` | `HttpClient` | HTTP 요청 클라이언트 |
| `showMessage(text, title?, type?)` | `void` | 메시지 다이얼로그 |
| `showDialog(formName, params?)` | `Promise<DialogResult>` | 모달 다이얼로그 |
| `navigate(formName, params?)` | `void` | 폼 이동 |
| `close(dialogResult?)` | `void` | 폼/다이얼로그 닫기 |

#### HttpClient / HttpResponse

```typescript
// HttpClient 메서드
ctx.http.get(url: string): HttpResponse
ctx.http.post(url: string, body?: unknown): HttpResponse
ctx.http.put(url: string, body?: unknown): HttpResponse
ctx.http.patch(url: string, body?: unknown): HttpResponse
ctx.http.delete(url: string): HttpResponse

// HttpResponse 구조
{
  status: number;   // HTTP 상태 코드
  ok: boolean;      // 200~299이면 true
  data: any;        // 응답 본문 (JSON 자동 파싱)
}
```

#### DialogResult

```typescript
{
  dialogResult: 'OK' | 'Cancel';
  data: Record<string, unknown>;
}
```

#### CollectionProxy (데이터소스)

```typescript
ctx.dataSources[name].collection(name): CollectionProxy

// CollectionProxy 메서드
find(filter?): Promise<unknown[]>
findOne(filter?): Promise<unknown | null>
insertOne(doc): Promise<{ insertedId: string }>
updateOne(filter, update): Promise<{ modifiedCount: number }>
deleteOne(filter): Promise<{ deletedCount: number }>
```

#### sender / ControlProxy

`sender`와 `ctx.controls[name]`은 `ControlProxy` 타입으로, 모든 속성에 동적으로 접근할 수 있습니다.

```typescript
sender.text          // string
sender.checked       // boolean
sender.enabled       // boolean
sender.selectedIndex // number
// ... 컨트롤 타입에 따른 모든 속성
```

### 마우스 호버 타입 힌트

코드 위에 마우스를 올리면 해당 변수나 함수의 타입 정보가 툴팁으로 표시됩니다.

```
ctx.showMessage ← 마우스 호버
┌─────────────────────────────────────────────────────┐
│ (method) FormContext.showMessage(                    │
│   text: string,                                     │
│   title?: string,                                   │
│   type?: 'info' | 'warning' | 'error' | 'success'  │
│ ): void                                             │
└─────────────────────────────────────────────────────┘
```

---

## 오류 표시

편집기는 실시간으로 TypeScript 문법 및 타입 오류를 표시합니다. 오류가 있는 줄에는 빨간 밑줄이 표시되고, 마우스를 올리면 오류 메시지를 확인할 수 있습니다.

### 억제된 오류

이벤트 핸들러의 특성상 다음 TypeScript 오류는 자동으로 억제됩니다:

| 코드 | 원래 오류 | 억제 이유 |
|------|----------|----------|
| TS1108 | 최상위 `return` 사용 불가 | 핸들러 코드에서 `return`으로 조기 종료 허용 |
| TS1375 | `await`를 async 함수 밖에서 사용 | 비동기 API 호출 지원 |
| TS1378 | 최상위 `await` 사용 불가 | 비동기 API 호출 지원 |

---

## 샘플 코드 템플릿

새 이벤트 핸들러를 처음 열면 컨트롤 타입과 이벤트 조합에 맞는 샘플 코드가 자동 생성됩니다. 기존에 작성한 코드가 있으면 해당 코드가 로드됩니다.

### 제공되는 샘플 코드

#### Button

**Click** — 입력값 검증 후 상태 업데이트
```javascript
const name = ctx.controls.txtName?.text;
if (!name) {
  ctx.controls.lblStatus.text = "이름을 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
  return;
}
ctx.controls.lblStatus.text = `${name}님, 환영합니다!`;
ctx.controls.lblStatus.foreColor = "#2e7d32";
```

**DoubleClick** — 더블클릭 감지
```javascript
ctx.controls.lblStatus.text = "더블클릭 감지됨";
```

#### TextBox

**TextChanged** — 입력 길이 실시간 표시
```javascript
const value = sender.text;
ctx.controls.lblStatus.text = `입력값: ${value} (${value.length}자)`;
```

**KeyPress** — 숫자만 허용
```javascript
// const key = sender.keyChar;
// if (!/[0-9]/.test(key)) {
//   sender.handled = true;
// }
```

**Enter** — 포커스 진입 시 배경색 변경
```javascript
sender.backColor = "#FFFDE7";
```

**Leave** — 포커스 이탈 시 필수 입력 검증
```javascript
sender.backColor = "#FFFFFF";
const value = sender.text;
if (!value) {
  ctx.controls.lblStatus.text = "필수 입력 항목입니다.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
```

**Validating** — 최소 글자 수 검증
```javascript
const text = sender.text;
if (text.length < 2) {
  ctx.controls.lblStatus.text = "2자 이상 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
```

#### CheckBox

**CheckedChanged** — 체크 상태에 따른 동작
```javascript
const checked = sender.checked;
ctx.controls.lblStatus.text = checked ? "동의함" : "동의 안 함";
// ctx.controls.btnSubmit.enabled = checked;
```

#### ComboBox

**SelectedIndexChanged** — 선택 항목 표시
```javascript
const index = sender.selectedIndex;
const items = sender.items;
if (index >= 0 && items[index]) {
  ctx.controls.lblStatus.text = `선택: ${items[index]}`;
}
```

#### NumericUpDown

**ValueChanged** — 값 변경 추적
```javascript
const value = sender.value;
ctx.controls.lblStatus.text = `값: ${value}`;
// ctx.controls.progressBar1.value = value;
```

#### DateTimePicker

**ValueChanged** — 선택 날짜 표시
```javascript
const date = sender.value;
ctx.controls.lblStatus.text = `선택한 날짜: ${date}`;
```

#### ListBox

**SelectedIndexChanged** — 선택 항목 표시
```javascript
const index = sender.selectedIndex;
const items = sender.items;
if (index >= 0) {
  ctx.controls.lblStatus.text = `선택: ${items[index]}`;
}
```

#### DataGridView

**CellClick** — 셀 클릭 시 데이터 추출
```javascript
// const row = sender.selectedRow;
// ctx.controls.txtName.text = row?.name ?? "";
```

**SelectionChanged** — 행 선택 변경
```javascript
// const row = sender.selectedRow;
// if (row) {
//   ctx.controls.lblStatus.text = `선택된 행: ${JSON.stringify(row)}`;
// }
```

#### TabControl

**SelectedIndexChanged** — 현재 탭 인덱스
```javascript
const tabIndex = sender.selectedIndex;
ctx.controls.lblStatus.text = `현재 탭: ${tabIndex}`;
```

#### 일반 이벤트 (모든 컨트롤)

위 목록에 해당하지 않는 컨트롤+이벤트 조합이면 이벤트명에 따른 일반 샘플이 제공됩니다:

- **Click** — `ctx.controls.lblStatus.text = "컨트롤명 클릭됨";`
- **DoubleClick** — `ctx.controls.lblStatus.text = "컨트롤명 더블클릭됨";`
- **MouseEnter** — `sender.backColor = "#E3F2FD";`
- **MouseLeave** — `sender.backColor = "#FFFFFF";`
- **Validating** — 유효성 검사 템플릿

---

## 편집기 설정 요약

| 항목 | 설정값 |
|------|--------|
| 언어 | TypeScript (ES2020) |
| 테마 | vs-dark (어두운 테마) |
| 글꼴 크기 | 14px |
| 탭 크기 | 2칸 |
| 줄 번호 | 표시 |
| 자동 줄바꿈 | 활성화 |
| 미니맵 | 비활성화 |
| 마지막 줄 이후 스크롤 | 비활성화 |
| 자동 레이아웃 | 활성화 (창 크기 변경 시 자동 조절) |
| Strict 모드 | 비활성화 (사용자 편의) |

---

## Monaco Editor 기본 단축키

Monaco Editor는 VS Code와 동일한 편집 단축키를 지원합니다. 자주 사용하는 것들:

| 단축키 | 동작 |
|--------|------|
| `Ctrl+Space` | 자동완성 수동 호출 |
| `Ctrl+Z` | 실행 취소 (Undo) |
| `Ctrl+Shift+Z` | 다시 실행 (Redo) |
| `Ctrl+D` | 현재 단어 선택 / 같은 단어 다중 선택 |
| `Ctrl+/` | 줄 주석 토글 |
| `Ctrl+Shift+K` | 현재 줄 삭제 |
| `Alt+Up/Down` | 현재 줄 위/아래로 이동 |
| `Shift+Alt+Up/Down` | 현재 줄 복제 |
| `Ctrl+F` | 찾기 |
| `Ctrl+H` | 찾기 및 바꾸기 |
| `Ctrl+G` | 줄 번호로 이동 |
| `Tab` | 들여쓰기 |
| `Shift+Tab` | 내어쓰기 |
| `Ctrl+]` / `Ctrl+[` | 줄 들여쓰기 / 내어쓰기 |
| `Ctrl+Shift+F` | 전체 포맷팅 |
