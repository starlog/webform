# UI Element Test Guide

이 문서는 WebForm의 모든 UI 컨트롤(44개)에 대해 디자이너(Designer)와 런타임(Runtime)의 시각적 일치 여부를 테스트하는 가이드입니다.

## 사전 준비

```bash
# 전체 실행 (Designer:3000, Runtime:3001, Server:4000)
pnpm dev
```

## 테스트 프로젝트

- **프로젝트명**: UI Element Test
- **프로젝트 ID**: 69a6358b36275f0ae9e80188
- **폼 수**: 44개 (컨트롤 타입당 1개)

## 테스트 방법

### 1. MCP 기반 자동 테스트 (Claude Code 사용 시)

아래 프롬프트를 Claude Code에 입력하여 자동 테스트를 수행합니다:

```
webform MCP를 사용하여 "UI Element Test" 프로젝트의 모든 44개 폼을 Playwright로 비교 테스트해주세요.

각 폼에 대해:
1. 디자이너(http://localhost:3000)에서 폼을 열어 스크린샷
2. 런타임(http://localhost:3001/?formId={formId})에서 스크린샷
3. 위치, 크기, 스타일이 다른 경우 원인 분석 및 수정
4. 수정 시 커밋 (한국어 메시지)

디자이너는 URL 라우팅이 없으므로 프로젝트 트리에서 직접 폼을 클릭해야 합니다.
런타임은 ?formId={id} 쿼리 파라미터로 접근합니다.
```

### 2. 수동 테스트

각 폼을 디자이너와 런타임에서 열어 시각적으로 비교합니다.

## 폼 ID 목록

### 기본 컨트롤 (11개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| Button | Test-Button | 69a635a036275f0ae9e8018b | http://localhost:3001/?formId=69a635a036275f0ae9e8018b |
| Label | Test-Label | 69a635a036275f0ae9e8018f | http://localhost:3001/?formId=69a635a036275f0ae9e8018f |
| TextBox | Test-TextBox | 69a635a036275f0ae9e80193 | http://localhost:3001/?formId=69a635a036275f0ae9e80193 |
| CheckBox | Test-CheckBox | 69a635a036275f0ae9e80197 | http://localhost:3001/?formId=69a635a036275f0ae9e80197 |
| RadioButton | Test-RadioButton | 69a635a036275f0ae9e8019b | http://localhost:3001/?formId=69a635a036275f0ae9e8019b |
| ComboBox | Test-ComboBox | 69a635a036275f0ae9e8019f | http://localhost:3001/?formId=69a635a036275f0ae9e8019f |
| ListBox | Test-ListBox | 69a635a036275f0ae9e801a3 | http://localhost:3001/?formId=69a635a036275f0ae9e801a3 |
| NumericUpDown | Test-NumericUpDown | 69a635a036275f0ae9e801a7 | http://localhost:3001/?formId=69a635a036275f0ae9e801a7 |
| DateTimePicker | Test-DateTimePicker | 69a635a036275f0ae9e801ab | http://localhost:3001/?formId=69a635a036275f0ae9e801ab |
| ProgressBar | Test-ProgressBar | 69a635a036275f0ae9e801af | http://localhost:3001/?formId=69a635a036275f0ae9e801af |
| PictureBox | Test-PictureBox | 69a635a036275f0ae9e801b3 | http://localhost:3001/?formId=69a635a036275f0ae9e801b3 |

### 컨테이너 (4개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| Panel | Test-Panel | 69a635a536275f0ae9e801d7 | http://localhost:3001/?formId=69a635a536275f0ae9e801d7 |
| GroupBox | Test-GroupBox | 69a635a636275f0ae9e801db | http://localhost:3001/?formId=69a635a636275f0ae9e801db |
| TabControl | Test-TabControl | 69a635a636275f0ae9e801df | http://localhost:3001/?formId=69a635a636275f0ae9e801df |
| SplitContainer | Test-SplitContainer | 69a635a736275f0ae9e801e3 | http://localhost:3001/?formId=69a635a736275f0ae9e801e3 |

### 데이터 컨트롤 (5개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| DataGridView | Test-DataGridView | 69a635a836275f0ae9e801eb | http://localhost:3001/?formId=69a635a836275f0ae9e801eb |
| BindingNavigator | Test-BindingNavigator | 69a635a936275f0ae9e801ef | http://localhost:3001/?formId=69a635a936275f0ae9e801ef |
| Chart | Test-Chart | 69a635aa36275f0ae9e801f3 | http://localhost:3001/?formId=69a635aa36275f0ae9e801f3 |
| TreeView | Test-TreeView | 69a635ab36275f0ae9e801f7 | http://localhost:3001/?formId=69a635ab36275f0ae9e801f7 |
| ListView | Test-ListView | 69a635ab36275f0ae9e801fb | http://localhost:3001/?formId=69a635ab36275f0ae9e801fb |

### 고급 컨트롤 (12개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| MenuStrip | Test-MenuStrip | 69a635af36275f0ae9e801ff | http://localhost:3001/?formId=69a635af36275f0ae9e801ff |
| ToolStrip | Test-ToolStrip | 69a635b036275f0ae9e80203 | http://localhost:3001/?formId=69a635b036275f0ae9e80203 |
| StatusStrip | Test-StatusStrip | 69a635b136275f0ae9e80207 | http://localhost:3001/?formId=69a635b136275f0ae9e80207 |
| RichTextBox | Test-RichTextBox | 69a635b236275f0ae9e8020b | http://localhost:3001/?formId=69a635b236275f0ae9e8020b |
| WebBrowser | Test-WebBrowser | 69a635b336275f0ae9e8020f | http://localhost:3001/?formId=69a635b336275f0ae9e8020f |
| SpreadsheetView | Test-SpreadsheetView | 69a635b336275f0ae9e80213 | http://localhost:3001/?formId=69a635b336275f0ae9e80213 |
| JsonEditor | Test-JsonEditor | 69a635b436275f0ae9e80217 | http://localhost:3001/?formId=69a635b436275f0ae9e80217 |
| MongoDBView | Test-MongoDBView | 69a635b536275f0ae9e8021b | http://localhost:3001/?formId=69a635b536275f0ae9e8021b |
| GraphView | Test-GraphView | 69a635b636275f0ae9e8021f | http://localhost:3001/?formId=69a635b636275f0ae9e8021f |
| MongoDBConnector | Test-MongoDBConnector | 69a635b736275f0ae9e80223 | http://localhost:3001/?formId=69a635b736275f0ae9e80223 |
| SwaggerConnector | Test-SwaggerConnector | 69a635b836275f0ae9e80227 | http://localhost:3001/?formId=69a635b836275f0ae9e80227 |
| DataSourceConnector | Test-DataSourceConnector | 69a635b936275f0ae9e8022b | http://localhost:3001/?formId=69a635b936275f0ae9e8022b |

### Extra - 폼 필수 (6개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| Slider | Test-Slider | 69a635bd36275f0ae9e8022f | http://localhost:3001/?formId=69a635bd36275f0ae9e8022f |
| Switch | Test-Switch | 69a635be36275f0ae9e80233 | http://localhost:3001/?formId=69a635be36275f0ae9e80233 |
| Upload | Test-Upload | 69a635bf36275f0ae9e80237 | http://localhost:3001/?formId=69a635bf36275f0ae9e80237 |
| Alert | Test-Alert | 69a635c036275f0ae9e8023b | http://localhost:3001/?formId=69a635c036275f0ae9e8023b |
| Tag | Test-Tag | 69a635c036275f0ae9e8023f | http://localhost:3001/?formId=69a635c036275f0ae9e8023f |
| Divider | Test-Divider | 69a635c136275f0ae9e80243 | http://localhost:3001/?formId=69a635c136275f0ae9e80243 |

### Extra - 모던 UI (6개)

| 컨트롤 | 폼 이름 | Form ID | 런타임 URL |
|--------|---------|---------|-----------|
| Card | Test-Card | 69a635c236275f0ae9e80247 | http://localhost:3001/?formId=69a635c236275f0ae9e80247 |
| Badge | Test-Badge | 69a635c336275f0ae9e8024b | http://localhost:3001/?formId=69a635c336275f0ae9e8024b |
| Avatar | Test-Avatar | 69a635c436275f0ae9e8024f | http://localhost:3001/?formId=69a635c436275f0ae9e8024f |
| Tooltip | Test-Tooltip | 69a635c436275f0ae9e80253 | http://localhost:3001/?formId=69a635c436275f0ae9e80253 |
| Collapse | Test-Collapse | 69a635c536275f0ae9e80257 | http://localhost:3001/?formId=69a635c536275f0ae9e80257 |
| Statistic | Test-Statistic | 69a635c636275f0ae9e8025b | http://localhost:3001/?formId=69a635c636275f0ae9e8025b |

## 검증 항목

각 컨트롤에 대해 다음을 확인합니다:

1. **위치(Position)**: 디자이너에서 설정한 x, y 좌표와 런타임에서의 위치가 일치하는가
2. **크기(Size)**: 디자이너에서 설정한 width, height와 런타임에서의 크기가 일치하는가
3. **스타일(Style)**: 배경색, 전경색, 테두리, 폰트 등이 일치하는가
4. **내부 구조(Structure)**: 탭 헤더, 스크롤바, 아이콘 등 내부 요소가 올바르게 표시되는가

## 의도된 차이 (테스트에서 제외)

다음 차이는 의도된 동작이므로 테스트 실패로 간주하지 않습니다:

| 컨트롤 | 차이 | 이유 |
|--------|------|------|
| Chart | 디자이너: 샘플 바 차트 표시, 런타임: "No data" | 런타임은 실제 데이터 바인딩 필요 |
| MongoDBConnector | 디자이너: DB 아이콘 칩, 런타임: 비시각적 (null) | Connector는 런타임에서 비시각적 컨트롤 |
| SwaggerConnector | 디자이너: API 아이콘 칩, 런타임: 비시각적 (null) | Connector는 런타임에서 비시각적 컨트롤 |
| DataSourceConnector | 디자이너: DS 아이콘 칩, 런타임: 비시각적 (null) | Connector는 런타임에서 비시각적 컨트롤 |

## 과거 발견 및 수정된 버그

### TabControl 런타임 탭 헤더 미표시 (2026-03-03 수정)

- **증상**: 런타임에서 TabControl의 탭 헤더(Tab 1, Tab 2, Tab 3)가 표시되지 않음
- **원인**: `TabControl.tsx`에서 `childArray.map()`으로 탭 헤더를 렌더링했으나, 자식 컨트롤이 없으면 탭 헤더도 렌더링되지 않았음
- **수정**: `tabCount`를 `Math.max(tabs?.length, tabPages?.length, childArray.length)`로 계산하여 `Array.from({ length: tabCount })`로 변경
- **파일**: `packages/runtime/src/controls/TabControl.tsx`

## 아키텍처 참고

### 디자이너 vs 런타임 렌더링 차이

- **디자이너**: 컨트롤별 `DesignerControlProps`에 `size.width`, `size.height`를 직접 전달하여 렌더링
- **런타임**: `ControlRenderer.tsx`가 `computeLayoutStyle()`을 통해 `{ position: 'absolute', left, top, width, height }` 스타일을 계산하여 `style` prop으로 전달
- 런타임의 모든 컨트롤은 루트 요소에 `...style`을 spread하여 크기/위치를 적용

### 공유 스타일

- `packages/common/src/styles/controlStyles.ts`: 기본 스타일 팩토리 함수 (buttonBaseStyle, textInputBaseStyle 등)
- `packages/common/src/theme/controlThemeMap.ts`: 테마 색상 리졸버
- 디자이너와 런타임이 동일한 공유 스타일 모듈을 사용하여 일관성 보장
