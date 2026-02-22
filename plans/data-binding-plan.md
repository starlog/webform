# 데이터 바인딩 엔진 구현 계획

## 1. 개요

`@webform/runtime` 패키지에 데이터 바인딩 엔진을 구현하고, `@webform/designer` 패키지에 DataSourcePanel을 추가한다. 런타임에서 `FormDefinition.dataBindings` 배열을 해석하여 데이터소스의 데이터를 컨트롤 속성에 자동으로 연결한다.

PRD.md 섹션 4.1.6(데이터 바인딩 및 데이터 소스)을 기반으로 설계한다.

### 1.1 의존성

- `@webform/common` (workspace): DataBindingDefinition, DataSourceDefinition, FormDefinition 등 공통 타입
- 기존 `@webform/runtime` 패키지: runtimeStore, apiClient, ControlRenderer, useDataBinding(stub)
- 기존 `@webform/server` 패키지: DataSourceService, datasources 라우터 (이미 완전 구현됨)

### 1.2 현재 구현 상태

| 항목 | 상태 | 위치 |
|------|------|------|
| DataBindingDefinition 타입 | ✅ 완료 | `common/src/types/datasource.ts` |
| DataSourceDefinition 타입 | ✅ 완료 | `common/src/types/datasource.ts` |
| FormDefinition.dataBindings 필드 | ✅ 완료 | `common/src/types/form.ts` |
| DataSourceService (서버) | ✅ 완료 | `server/src/services/DataSourceService.ts` |
| datasources 라우터 (서버) | ✅ 완료 | `server/src/routes/datasources.ts` |
| MongoDB/REST/Static 어댑터 | ✅ 완료 | `server/src/services/adapters/` |
| runtimeStore (Zustand) | ✅ 완료 | `runtime/src/stores/runtimeStore.ts` |
| useDataBinding 훅 | ⏳ stub | `runtime/src/hooks/useDataBinding.ts` (빈 객체 반환) |
| ControlRenderer 바인딩 연동 | ✅ 호출만 | `runtime/src/renderer/ControlRenderer.tsx` |
| apiClient | ✅ 부분 | `runtime/src/communication/apiClient.ts` (fetchForm, postEvent만) |
| DataGridView 컨트롤 | ❌ 미구현 | — |
| DataSourcePanel (디자이너) | ❌ 미구현 | — |
| bindingStore | ❌ 미구현 | — |
| BindingEngine | ❌ 미구현 | — |

---

## 2. 파일 구조

```
packages/runtime/src/
├── bindings/
│   ├── bindingStore.ts              # 데이터 바인딩 전용 Zustand 스토어
│   └── BindingEngine.ts             # 바인딩 초기화/데이터 로드/값 계산 엔진
├── hooks/
│   └── useDataBinding.ts            # 전체 구현 (stub → 실제 동작)
├── controls/
│   ├── DataGridView.tsx             # 데이터 그리드 컨트롤 (신규)
│   └── registry.ts                  # DataGridView 등록 (수정)
└── communication/
    └── apiClient.ts                 # queryDataSource 메서드 추가 (수정)

packages/designer/src/
└── components/
    └── DataSourcePanel/
        ├── DataSourcePanel.tsx       # 데이터소스 패널 컴포넌트 (신규)
        └── index.ts                  # barrel export (신규)
```

---

## 3. 바인딩 모드 설계

### 3.1 oneWay (데이터소스 → 컨트롤)

```
데이터소스 데이터 → bindingStore.dataSourceData
                       ↓
              useDataBinding 훅에서 구독
                       ↓
               컨트롤 속성에 값 주입
```

- 데이터소스 데이터가 변경되면 컨트롤 값이 자동 업데이트
- 컨트롤에서 사용자가 값을 변경해도 데이터소스에 반영되지 않음
- 용도: 읽기 전용 표시 (Label, 읽기 전용 TextBox, DataGridView 기본)

### 3.2 twoWay (데이터소스 ↔ 컨트롤)

```
데이터소스 데이터 → bindingStore.dataSourceData → 컨트롤 표시
                                                       ↓
                   사용자 편집 → onChange 콜백 발생
                                    ↓
                   bindingStore.updateCellValue 호출
                                    ↓
                   (선택적) 서버에 변경사항 전송
```

- 컨트롤 값 변경 시 bindingStore의 dataSourceData도 업데이트
- 서버 동기화는 명시적 저장(이벤트 핸들러) 시 수행
- 용도: 편집 가능 폼 (TextBox, ComboBox, DataGridView 셀 편집)

### 3.3 oneTime (초기 로드 1회)

```
폼 로드 시 데이터소스 쿼리 → 값 1회 설정 → 이후 무시
```

- 초기 데이터 로드 후 데이터소스 변경에 반응하지 않음
- `useDataBinding` 내부에서 `useRef` 플래그로 초기 로드 여부 추적
- 용도: 코드 테이블, 정적 목록 (ComboBox items 등)

---

## 4. 상세 설계

### 4.1 bindingStore (Zustand + Immer)

**파일**: `packages/runtime/src/bindings/bindingStore.ts`

```typescript
interface BindingState {
  /** 데이터소스ID → 데이터 배열 */
  dataSourceData: Record<string, unknown[]>;

  /** 컨트롤ID → 선택된 행 인덱스 (DataGridView 등) */
  selectedRows: Record<string, number>;

  /** 데이터소스 로딩 상태 */
  loadingStates: Record<string, boolean>;

  /** 에러 상태 */
  errors: Record<string, string | null>;

  // 액션
  loadDataSource: (dsId: string, data: unknown[]) => void;
  setSelectedRow: (controlId: string, rowIndex: number) => void;
  updateCellValue: (dsId: string, rowIndex: number, field: string, value: unknown) => void;
  setLoading: (dsId: string, loading: boolean) => void;
  setError: (dsId: string, error: string | null) => void;
  reset: () => void;
}
```

**설계 의도**:
- `runtimeStore`와 분리: 데이터 바인딩 상태는 폼 UI 상태(controlStates)와 관심사가 다름
- `selectedRows`: DataGridView 행 선택 시 다른 컨트롤이 선택된 행의 필드를 참조 가능 (예: `gridUsers.selectedRow` → `name` 필드)
- `loadingStates`/`errors`: 데이터 로딩 UI 피드백용

### 4.2 BindingEngine

**파일**: `packages/runtime/src/bindings/BindingEngine.ts`

```typescript
class BindingEngine {
  /**
   * 폼 정의의 모든 DataBindingDefinition을 순회하며 초기 데이터 로드
   * - 고유한 dataSourceId 추출
   * - 각 데이터소스에 대해 서버 쿼리 실행
   * - 결과를 bindingStore.loadDataSource로 저장
   */
  static async initializeBindings(
    formDef: FormDefinition,
    formId: string,
  ): Promise<void>;

  /**
   * 특정 데이터소스의 데이터를 서버에서 로드
   * - POST /api/runtime/forms/:formId/data (또는 POST /api/datasources/:dsId/query)
   * - bindingStore에 결과 저장
   */
  static async loadDataSourceData(
    dsId: string,
    formId: string,
    query?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * 특정 컨트롤/속성에 대한 바인딩 값 계산
   * - 일반 바인딩: dataSourceData[dsId] 전체 또는 특정 필드
   * - selectedRow 바인딩: dataSourceData[sourceControlId][selectedRows[sourceControlId]][field]
   */
  static getControlValue(
    controlId: string,
    property: string,
    bindings: DataBindingDefinition[],
  ): unknown;

  /**
   * twoWay 바인딩 변경 처리
   * - bindingStore 로컬 업데이트
   */
  static handleTwoWayUpdate(
    controlId: string,
    property: string,
    value: unknown,
    bindings: DataBindingDefinition[],
  ): void;
}
```

**selectedRow 바인딩 처리 로직**:

PRD 예시에서 `dataSourceId: "gridUsers.selectedRow"`와 같이 특정 그리드의 선택된 행을 참조하는 패턴이 있다:

```typescript
// dataSourceId 파싱
function parseDataSourceRef(dataSourceId: string) {
  const parts = dataSourceId.split('.');
  if (parts.length === 2 && parts[1] === 'selectedRow') {
    return { type: 'selectedRow', controlId: parts[0] };
  }
  return { type: 'dataSource', dataSourceId };
}
```

- `"gridUsers.selectedRow"` → bindingStore.selectedRows["gridUsers"]에서 행 인덱스를 얻고, 해당 행의 `dataField` 값을 반환
- 일반 `"userDB"` → bindingStore.dataSourceData["userDB"] 전체 데이터 반환

### 4.3 useDataBinding 훅 (전체 재구현)

**파일**: `packages/runtime/src/hooks/useDataBinding.ts`

```typescript
export function useDataBinding(
  controlId: string,
  bindings: DataBindingDefinition[],
): Record<string, unknown> {
  // 1. 이 컨트롤에 해당하는 바인딩만 필터링
  const myBindings = bindings.filter(b => b.controlId === controlId);
  if (myBindings.length === 0) return {};

  // 2. bindingStore 구독 (선택적 구독으로 불필요한 리렌더링 방지)
  const dataSourceData = useBindingStore(s => s.dataSourceData);
  const selectedRows = useBindingStore(s => s.selectedRows);

  // 3. oneTime 바인딩용 ref
  const oneTimeRef = useRef<Record<string, unknown>>({});
  const initializedRef = useRef(false);

  // 4. 각 바인딩에 대해 값 계산
  const result: Record<string, unknown> = {};

  for (const binding of myBindings) {
    const { controlProperty, dataSourceId, dataField, bindingMode } = binding;

    // oneTime: 이미 초기화되었으면 캐시된 값 사용
    if (bindingMode === 'oneTime' && initializedRef.current) {
      result[controlProperty] = oneTimeRef.current[controlProperty];
      continue;
    }

    // 값 계산
    const ref = parseDataSourceRef(dataSourceId);
    let value: unknown;

    if (ref.type === 'selectedRow') {
      // selectedRow 참조: 그리드 선택 행의 특정 필드
      const rowIdx = selectedRows[ref.controlId] ?? -1;
      // selectedRow 바인딩의 실제 데이터소스 ID는 해당 그리드의 바인딩에서 찾아야 함
      const gridBinding = bindings.find(
        b => b.controlId === ref.controlId && b.controlProperty === 'dataSource'
      );
      if (gridBinding && rowIdx >= 0) {
        const rows = dataSourceData[gridBinding.dataSourceId] ?? [];
        const row = rows[rowIdx] as Record<string, unknown> | undefined;
        value = row?.[dataField];
      }
    } else {
      // 일반 데이터소스 참조
      const data = dataSourceData[ref.dataSourceId];
      if (data) {
        // dataSource 속성: 전체 데이터 배열 (DataGridView용)
        if (controlProperty === 'dataSource') {
          value = data;
        } else {
          // 단일 값: 첫 번째 행의 특정 필드
          const firstRow = data[0] as Record<string, unknown> | undefined;
          value = firstRow?.[dataField];
        }
      }
    }

    result[controlProperty] = value;

    // twoWay: onChange 콜백 추가
    if (bindingMode === 'twoWay') {
      const onChangeKey = `on${controlProperty.charAt(0).toUpperCase() + controlProperty.slice(1)}Change`;
      result[onChangeKey] = (newValue: unknown) => {
        BindingEngine.handleTwoWayUpdate(controlId, controlProperty, newValue, bindings);
      };
    }

    // oneTime: 첫 로드 시 캐시
    if (bindingMode === 'oneTime' && value !== undefined) {
      oneTimeRef.current[controlProperty] = value;
    }
  }

  // oneTime 초기화 플래그
  if (!initializedRef.current && Object.keys(result).length > 0) {
    initializedRef.current = true;
  }

  return result;
}
```

### 4.4 DataGridView 컨트롤

**파일**: `packages/runtime/src/controls/DataGridView.tsx`

**기능 요구사항**:
1. `dataSource` prop (바인딩된 데이터 배열)으로 행/열 렌더링
2. 정렬 가능 컬럼 헤더 (클릭 시 asc → desc → none 토글)
3. 행 클릭 시 `setSelectedRow` 호출 → 다른 컨트롤에 선택 행 데이터 바인딩
4. 셀 편집 모드 (twoWay 바인딩 시)
5. 빈 데이터 처리 (메시지 표시)

```typescript
interface DataGridViewProps {
  id: string;
  name: string;

  // 바인딩된 데이터 배열
  dataSource?: unknown[];

  // 컬럼 정의 (properties에서 전달)
  columns?: ColumnDefinition[];

  // twoWay 바인딩 시 데이터 변경 콜백
  onDataSourceChange?: (data: unknown[]) => void;

  // 이벤트
  onCellClick?: (row: number, col: string) => void;
  onSelectionChanged?: (rowIndex: number) => void;

  style?: React.CSSProperties;
  enabled?: boolean;
  children?: React.ReactNode;
}

interface ColumnDefinition {
  field: string;        // 데이터 필드명
  headerText: string;   // 헤더 표시 텍스트
  width?: number;       // 컬럼 너비 (px)
  sortable?: boolean;   // 정렬 가능 여부 (기본 true)
  editable?: boolean;   // 편집 가능 여부 (twoWay 시)
}
```

**내부 상태 관리**:
```typescript
// 정렬 상태
const [sortConfig, setSortConfig] = useState<{
  field: string;
  direction: 'asc' | 'desc';
} | null>(null);

// 선택된 행
const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

// 편집 중인 셀
const [editingCell, setEditingCell] = useState<{
  rowIndex: number;
  field: string;
} | null>(null);
```

**정렬 로직**:
- 컬럼 헤더 클릭 → `sortConfig` 업데이트
- `useMemo`로 정렬된 데이터 계산 (원본 데이터 변경하지 않음)
- 헤더에 정렬 방향 표시 (▲/▼)

**행 선택 로직**:
- 행 클릭 → `setSelectedRowIndex` + `bindingStore.setSelectedRow(id, rowIndex)` 호출
- 선택된 행 하이라이트 CSS 적용
- `onSelectionChanged` 이벤트 발생

**셀 편집 로직** (twoWay):
- 셀 더블클릭 → `editingCell` 상태 설정 → `<input>` 렌더링
- Enter/Tab/blur → 편집 완료 → `onDataSourceChange` 콜백 → `bindingStore.updateCellValue`
- Escape → 편집 취소

**자동 컬럼 생성**:
- `columns` prop이 없으면 데이터의 첫 번째 행에서 키를 추출하여 자동 생성
- `_id` 같은 내부 필드는 자동 제외

**WinForm 스타일**:
- 회색 헤더 배경 (`#e0e0e0`)
- 셀 테두리 (1px solid `#d0d0d0`)
- 선택 행 파란색 배경 (`#0078d7`, 흰색 텍스트)
- 행 높이 22px (WinForm DataGridView 기본값)

### 4.5 apiClient 확장

**파일**: `packages/runtime/src/communication/apiClient.ts` (수정)

기존 `fetchForm`, `postEvent`에 데이터 쿼리 메서드 추가:

```typescript
/** 런타임 데이터 바인딩 쿼리 */
async queryDataSource(
  formId: string,
  dataSourceId: string,
  query?: Record<string, unknown>,
): Promise<unknown[]> {
  const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataSourceId, query }),
  });
  if (!res.ok) throw new Error(`Data query failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}
```

### 4.6 컨트롤 레지스트리 업데이트

**파일**: `packages/runtime/src/controls/registry.ts` (수정)

```typescript
import { DataGridView } from './DataGridView';

export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  // ... 기존 컨트롤들
  DataGridView,
};
```

### 4.7 DataSourcePanel (디자이너)

**파일**: `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx`

**UI 구조**:
```
┌─ DataSourcePanel ──────────────────┐
│ 데이터 소스                    [+] │
├────────────────────────────────────┤
│ ▸ userDB (database/mongodb)        │
│ ▸ externalAPI (restApi)            │
│ ▸ departments (static)             │
├────────────────────────────────────┤
│ [연결 테스트]  [데이터 미리보기]    │
├────────────────────────────────────┤
│ ┌─ 미리보기 테이블 ──────────────┐ │
│ │ name  │ email │ createdAt      │ │
│ │ Alice │ a@... │ 2024-01-01     │ │
│ │ Bob   │ b@... │ 2024-01-02     │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**기능**:
1. **데이터소스 목록 조회**: `GET /api/datasources` → 목록 렌더링
2. **새 데이터소스 추가**: [+] 버튼 → 모달 다이얼로그
   - type 선택: database / restApi / static
   - type별 config 입력 폼
   - `POST /api/datasources`로 생성
3. **연결 테스트**: 선택된 데이터소스 → `POST /api/datasources/:id/test`
   - 성공: 초록색 "연결 성공" 메시지
   - 실패: 빨간색 에러 메시지
4. **데이터 미리보기**: `POST /api/datasources/:id/query` (limit: 10)
   - 결과를 테이블로 표시
   - 컬럼 자동 감지

**상태 관리**: 로컬 `useState`로 관리 (목록, 선택된 항목, 모달 상태, 테스트 결과, 미리보기 데이터)

**API 호출**: 디자이너 전용 apiService 또는 직접 fetch 사용

```typescript
const DESIGNER_API = '/api';

async function fetchDataSources(projectId?: string): Promise<DataSourceDefinition[]> {
  const url = projectId
    ? `${DESIGNER_API}/datasources?projectId=${projectId}`
    : `${DESIGNER_API}/datasources`;
  const res = await fetch(url);
  const json = await res.json();
  return json.data;
}

async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/test`, { method: 'POST' });
  const json = await res.json();
  return json.data;
}

async function previewData(id: string): Promise<unknown[]> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 10 }),
  });
  const json = await res.json();
  return json.data;
}
```

---

## 5. 데이터 흐름

### 5.1 폼 로드 시 바인딩 초기화

```
1. SDUIRenderer에서 FormDefinition 수신
2. BindingEngine.initializeBindings(formDef, formId) 호출
3. formDef.dataBindings에서 고유한 dataSourceId 목록 추출
   (selectedRow 참조는 실제 dataSourceId로 해석)
4. 각 dataSourceId에 대해:
   a. bindingStore.setLoading(dsId, true)
   b. apiClient.queryDataSource(formId, dsId) 호출
   c. bindingStore.loadDataSource(dsId, data) 저장
   d. bindingStore.setLoading(dsId, false)
5. ControlRenderer → useDataBinding 훅이 bindingStore 구독
6. 데이터 도착 → 자동 리렌더링 → 컨트롤에 값 표시
```

### 5.2 DataGridView 행 선택 → 다른 컨트롤 업데이트

```
1. DataGridView에서 행 클릭
2. bindingStore.setSelectedRow("gridUsers", 2) 호출
3. useDataBinding 훅이 selectedRows 변경 감지
4. "gridUsers.selectedRow" 참조 바인딩들의 값 재계산
5. txtName.text = rows[2].name (자동 리렌더링)
6. txtEmail.text = rows[2].email (자동 리렌더링)
```

### 5.3 twoWay 셀 편집

```
1. DataGridView 셀 더블클릭 → 편집 모드
2. 값 변경 → onDataSourceChange 콜백
3. bindingStore.updateCellValue(dsId, rowIdx, field, newValue)
4. bindingStore.dataSourceData 업데이트
5. 동일 데이터소스를 참조하는 다른 컨트롤 자동 업데이트
```

---

## 6. 바인딩 초기화 위치

`SDUIRenderer` 또는 `App.tsx`에서 폼 로드 직후 `BindingEngine.initializeBindings`를 호출한다:

```typescript
// SDUIRenderer.tsx 내부
useEffect(() => {
  if (formDefinition && formDefinition.dataBindings.length > 0) {
    BindingEngine.initializeBindings(formDefinition, formDefinition.id);
  }
}, [formDefinition]);
```

---

## 7. 서버 API 연동

### 7.1 사용하는 기존 API

| API | 용도 | 구현 상태 |
|-----|------|-----------|
| `GET /api/datasources` | 디자이너 데이터소스 목록 | ✅ 완료 |
| `POST /api/datasources` | 디자이너 데이터소스 생성 | ✅ 완료 |
| `POST /api/datasources/:id/test` | 연결 테스트 | ✅ 완료 |
| `POST /api/datasources/:id/query` | 데이터 미리보기/런타임 쿼리 | ✅ 완료 |
| `POST /api/runtime/forms/:id/data` | 런타임 데이터 로드 | ✅ 라우트 존재 (runtime.ts) |

### 7.2 런타임 데이터 로드 요청 형식

```typescript
// POST /api/runtime/forms/:formId/data
// Request Body:
{
  dataSourceId: string;
  query?: {
    collection?: string;   // MongoDB 컬렉션명
    filter?: object;       // 필터 조건
    sort?: object;         // 정렬
    projection?: object;   // 필드 선택
    limit?: number;        // 제한
  };
}

// Response:
{
  data: unknown[];
}
```

---

## 8. 생성/수정 파일 목록

### 신규 생성

| 파일 | 설명 |
|------|------|
| `packages/runtime/src/bindings/bindingStore.ts` | 데이터 바인딩 전용 Zustand 스토어 |
| `packages/runtime/src/bindings/BindingEngine.ts` | 바인딩 초기화/데이터 로드/값 계산 |
| `packages/runtime/src/controls/DataGridView.tsx` | 데이터 그리드 컨트롤 |
| `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx` | 데이터소스 관리 패널 |
| `packages/designer/src/components/DataSourcePanel/index.ts` | barrel export |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `packages/runtime/src/hooks/useDataBinding.ts` | stub → 전체 구현 |
| `packages/runtime/src/controls/registry.ts` | DataGridView 등록 |
| `packages/runtime/src/communication/apiClient.ts` | queryDataSource 메서드 추가 |

---

## 9. 구현 순서

1. **bindingStore** 생성 (다른 모듈의 기반)
2. **apiClient** 확장 (queryDataSource 메서드)
3. **BindingEngine** 구현 (bindingStore + apiClient 사용)
4. **useDataBinding** 전체 재구현 (BindingEngine + bindingStore 구독)
5. **DataGridView** 컨트롤 구현
6. **registry** 업데이트
7. **DataSourcePanel** 구현 (디자이너)
