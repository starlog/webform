# Designer↔Runtime 컨트롤 공통화(View 추출) 계획

작성일: 2026-06-10

## 1. 현황 분석

처음 추정(44종 ~4,000줄 전면 중복)과 달리, **공통화는 이미 절반 이상 진행되어 있다.**

- `packages/common/src/views/`에 **SharedView 패턴이 구축 완료**:
  - `SharedThemeContext` + `useSharedTheme` — designer/runtime 각자의 ThemeContext가 Provider로 브리지함
  - `useViewControlColors` — backColor/foreColor/테마 색상 해석
  - `styles/controlStyles.ts` — 공통 베이스 스타일
- **26종의 View가 이미 추출**되어 designer 28개 / runtime 27개 컨트롤이 사용 중 (Button, Label, CheckBox, ComboBox, Panel, TabControl 등)
- **17쌍이 미공통화** 상태로 남아 있음

### 미공통화 17쌍 분류 (designer줄수 / runtime줄수)

**A. 공통화 대상 — 마크업/스타일 중복 존재 (14쌍)**

| 컨트롤 | designer | runtime | 비고 |
|---|---|---|---|
| StatusStrip | 109 | 145 | 아이템 렌더링(label/progressBar/dropDownButton) 거의 동일 |
| BindingNavigator | 80 | 160 | 버튼 바 마크업 중복 |
| SplitContainer | 70 | 128 | 패널/스플리터 마크업 중복 |
| WebBrowser | 72 | 136 | 주소바+iframe 틀 중복 |
| ToolStrip | 89 | 270 | 버튼/구분자 렌더링 중복 |
| TreeView | 83 | 273 | 노드 들여쓰기/아이콘 마크업 중복 |
| MenuStrip | 59 | 396 | 메뉴바 렌더링 (런타임은 드롭다운 동작 포함) |
| RichTextBox | 99 | 208 | 툴바(B/I/U) + 콘텐츠 영역 중복 |
| ListView | 193 | 440 | 컬럼 헤더/행 렌더링 중복 |
| DataGridView | 127 | 480 | 그리드 헤더/셀 틀 중복 |
| Chart | 272 | 358 | 차트 렌더링 로직 중복 (가장 중복률 높은 대형) |
| JsonEditor | 101 | 459 | 디자이너는 프리뷰, 트리 렌더링 일부 공유 가능 |
| SpreadsheetView | 175 | 663 | 셀 그리드 틀 공유 가능 |
| MongoDBView | 183 | 899 | 그리드/툴바 틀만 공유 가능 (대부분 런타임 전용 로직) |

**B. 공통화 제외 — 중복 없음 (3쌍)**

| 컨트롤 | designer | runtime | 사유 |
|---|---|---|---|
| MongoDBConnector | 38 | 4 | 런타임은 invisible stub. 공유할 UI 없음 |
| DataSourceConnector | 60 | 3 | 〃 |
| SwaggerConnector | 50 | 4 | 〃 |

> 실제 제거 가능한 중복은 약 1,500~2,500줄 수준으로 추정 (마크업+스타일+아이템 타입 정의).

## 2. 마이그레이션 패턴 (ButtonView 선례 준수)

컨트롤 1종당 작업 단위:

1. **View 생성** — `common/src/views/controls/<X>View.tsx`
   - 표현(마크업, 스타일, 테마 색상)만 담당. 상태/스토어/이벤트 의존 금지
   - props: 데이터 + `interactive`/`disabled` 플래그 + 콜백(`onXxx`) + `style`/`className`/`data-control-id`
   - 테마는 `useSharedTheme()` + `useViewControlColors()` 사용
   - 아이템 타입(예: `StatusStripItem`)을 View 파일에서 export — 양쪽 패키지의 중복 타입 정의 제거
2. **`views/index.ts`에 export 추가** (`<X>View`, `<X>ViewProps`, 아이템 타입)
3. **runtime 컨트롤 축소** — 상태(`useRuntimeStore`)/이벤트 처리만 남기고 렌더링은 View에 위임
4. **designer 컨트롤 축소** — `DesignerControlProps` → View props 매핑 + 디자인타임 디폴트(예: "준비" 라벨)만 유지, `interactive=false`
5. **검증** — `pnpm --filter @webform/common build` → 양쪽 typecheck/test → 디자이너·런타임 화면 비교

### 주의 사항

- 디자이너/런타임의 **시각적 차이는 의도된 것일 수 있음** (디자인타임 디폴트 아이템, 비활성 상태 표현). View의 `interactive` 플래그와 디폴트 props로 흡수하고, 차이가 의도인지 애매하면 런타임 쪽 표현을 기준으로 삼는다.
- `common`은 React peer dependency만 가짐 — View에 zustand/react-dnd 등 패키지별 의존성을 끌어들이지 않는다.
- 기존 테스트(`Toolbox.test.tsx`, `registry.test.ts`, runtime 컨트롤 테스트)가 깨지면 동작 변경이 생겼다는 신호이므로 테스트를 고치기 전에 원인 확인.

## 3. 단계별 실행 (Wave)

브랜치: `refactor/shared-views` 1개에서 Wave별로 진행, **컨트롤 1종 = 커밋 1개**.
Wave 완료 시점마다 main에 머지(또는 PR) — 작게 자주 합쳐 충돌을 피한다.

### Wave 1 — 단순 마크업형 (위험 낮음, 패턴 정착)
StatusStrip → BindingNavigator → SplitContainer → WebBrowser → ToolStrip

- 예상 규모: View 5개 신규, 양쪽 컨트롤 10파일 축소
- 이 Wave에서 View props 컨벤션을 확정하고 이후 Wave에 동일 적용

### Wave 2 — 상호작용 중간형
TreeView → MenuStrip → RichTextBox → ListView

- 런타임 쪽 동작(드롭다운 열림, 노드 확장, 선택 상태)은 컨트롤에 남기고 View는 "현재 상태를 받아 그리는" 역할로 한정
- RichTextBox는 contentEditable/DOMPurify 로직을 runtime에 유지, 툴바+레이아웃만 View로

### Wave 3 — 대형 데이터 컨트롤 (선택적·부분 공유)
DataGridView → Chart → JsonEditor → SpreadsheetView → (MongoDBView)

- 전체 View화가 아니라 **공유 가능한 하위 조각**(그리드 헤더, 셀, 차트 SVG 빌더, 트리 노드)을 추출하는 방식도 허용
- MongoDBView(899줄)는 런타임 전용 로직이 대부분 — 비용 대비 효과를 Wave 3 시작 시 재평가하고, 효과가 작으면 제외

### 제외
MongoDBConnector / DataSourceConnector / SwaggerConnector — 중복 없음.

## 4. 검증 체크리스트 (Wave별)

- [ ] `pnpm --filter @webform/common build` 후 `pnpm typecheck` 전체 통과
- [ ] `pnpm test` 전체 통과
- [ ] 디자이너에서 해당 컨트롤 드롭 → 캔버스 렌더링 확인
- [ ] 속성 변경(backColor/foreColor/font/items) 시 캔버스 반영 확인
- [ ] 런타임에서 동일 폼 로드 → 디자이너와 시각적 일치 확인
- [ ] 런타임 이벤트(클릭/선택 등) 정상 동작 확인

## 5. 예상 효과

- 중복 마크업/스타일/타입 약 1,500~2,500줄 제거
- 컨트롤 시각 버그 수정이 한 곳(View)으로 수렴 — 디자이너/런타임 불일치 원천 차단
- 신규 컨트롤 추가 시 View 먼저 작성하는 컨벤션 확립 (이미 26종이 따르는 패턴의 완성)
