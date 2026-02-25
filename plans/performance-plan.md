# 대용량 데이터 성능 개선 계획

## 1. 현황 분석

### 1.1 DataGridView — 가상화 없는 전체 DOM 렌더링

**파일**: `packages/runtime/src/controls/DataGridView.tsx`

**현재 동작**:
- `sortedRows.map()` (L334)으로 **모든 행을 한 번에 DOM으로 렌더링**
- 행 높이 **고정 22px** (L98: `height: '22px'`)
- `<table>` + `<tbody>` 구조로 네이티브 테이블 사용
- 정렬(sortConfig)은 `useMemo`로 최적화되어 있음

**문제점**:
- 1,000행 → 1,000개 `<tr>` + (컬럼 수 × 1,000)개 `<td>` DOM 노드 동시 생성
- 10,000행 이상 시 초기 렌더링 수 초 지연, 스크롤 프레임 드롭 예상
- 정렬 변경 시 전체 행 재렌더링

### 1.2 스냅라인 계산 — O(n) 반복 호출

**파일**: `packages/designer/src/utils/snapGrid.ts`, `packages/designer/src/components/Canvas/CanvasControl.tsx`

**현재 동작**:
- `getSnaplines()` (snapGrid.ts L20–85): 이동 중인 컨트롤 1개를 나머지 **모든 컨트롤과 비교** (10개 edge 쌍 비교 × n개 컨트롤)
- `CanvasControl.tsx` L161–170: **매 mousemove 이벤트마다** 호출
  - `currentControls.filter()` → `getSnaplines()` 순서로 매번 전체 컨트롤 배열 순회
- `collectDescendantIds()` (L12–23): 드래그 시작 시 모든 컨트롤을 재귀 순회하여 자손 수집 — O(n×d) (d=트리 깊이)
- `getHiddenControlIds()` (DesignerCanvas.tsx L25–93): TabControl/Collapse/Card별 `controls.filter()` 반복 호출 — 컨트롤 유형 수 × n

**문제점**:
- 컨트롤 500개 기준, 드래그 중 mousemove 60fps × 500회 비교 = **초당 ~30,000회 edge 비교**
- `controls.filter()` 호출이 mousemove마다 반복 (새 배열 할당 포함)
- `getHiddenControlIds`는 `useMemo`로 캐싱되지만 `controls` 배열 변경 시 전체 재계산

### 1.3 historyStore — JSON.stringify 전체 상태 직렬화

**파일**: `packages/designer/src/stores/historyStore.ts`

**현재 동작**:
- `createSnapshot()` (L81–84): `JSON.stringify({ controls, formProperties })` 호출
- 스냅샷 시점: 컨트롤 드롭, 삭제, 붙여넣기, **드래그 시작**, 폼 리사이즈 시작
- `past[]` / `future[]`에 **JSON 문자열로 저장**, 최대 50개
- `restoreSnapshot()` (L87–93): `JSON.parse()` + `setState()` 전체 교체

**문제점**:
- 컨트롤 500개 폼 기준, 각 컨트롤 properties 포함 JSON ≈ 200–500 bytes → 스냅샷 1개 ≈ 100KB–250KB
- 50개 히스토리 × 250KB = **최대 ~12.5MB 메모리 상주**
- 드래그 시작마다 `JSON.stringify` 호출 (수백 KB 직렬화) → UI 스레드 블로킹
- `past`/`future` 배열에 중복 데이터 대량 저장 (대부분의 컨트롤은 변경되지 않음)

---

## 2. 개선 방안

### 2.1 DataGridView — react-window 가상화 적용

**방식**: `react-window`의 `FixedSizeList`를 사용하여 뷰포트에 보이는 행만 렌더링

**구현 계획**:

```
수정 파일: packages/runtime/src/controls/DataGridView.tsx
신규 의존성: react-window (@types/react-window)
```

1. **`react-window` 의존성 추가**
   ```bash
   cd packages/runtime && pnpm add react-window && pnpm add -D @types/react-window
   ```

2. **렌더링 구조 변경**
   - `<table><tbody>` → `<div>` 기반 레이아웃으로 전환 (react-window는 table 미지원)
   - 헤더: 고정 `<div>` 행 (가상화 대상 아님)
   - 본문: `FixedSizeList`로 가상화 (행 높이 22px 고정이므로 `FixedSizeList` 적합)

3. **핵심 코드 변경**:
   ```tsx
   import { FixedSizeList as List } from 'react-window';

   const ROW_HEIGHT = 22;

   // 컨테이너 높이 계산 (style.height에서 헤더 높이 차감)
   const containerHeight = (style?.height as number) ?? 200;
   const listHeight = containerHeight - ROW_HEIGHT; // 헤더 높이 제외

   const Row = ({ index, style: rowStyle }: { index: number; style: CSSProperties }) => {
     const row = sortedRows[index];
     const isSelected = index === selectedRowIndex;
     return (
       <div style={{ ...rowStyle, display: 'flex', ...(isSelected ? styles.selectedRow : {}) }}
            onClick={() => handleRowClick(index)}>
         {resolvedColumns.map(col => (
           <div key={col.field} style={{ ...styles.cell, width: col.width, flex: col.width ? undefined : 1 }}>
             {String(row[col.field] ?? '')}
           </div>
         ))}
       </div>
     );
   };

   <List height={listHeight} itemCount={sortedRows.length} itemSize={ROW_HEIGHT} width="100%">
     {Row}
   </List>
   ```

4. **편집 기능 유지**: `editingCell` 상태는 그대로 유지, 가상화된 Row 컴포넌트 내에서 조건부 렌더링

5. **스크롤 동기화**: 헤더와 본문의 가로 스크롤 동기화를 위해 `onScroll` prop 활용

**기대 효과**:
- 10,000행: DOM 노드 수 ~50개(뷰포트)로 고정 → 초기 렌더링 **~95% 단축**
- 스크롤 성능: 재활용되는 DOM 노드로 60fps 유지
- 메모리: 뷰포트 외 행의 DOM 미생성

### 2.2 스냅라인 — 정렬 배열 + 이진 탐색 + 캐싱

**방식**: 컨트롤 edge 좌표를 정렬된 배열로 사전 계산하고, 이진 탐색으로 threshold 내 후보만 추출

**구현 계획**:

```
수정 파일:
  - packages/designer/src/utils/snapGrid.ts
  - packages/designer/src/components/Canvas/CanvasControl.tsx
  - packages/designer/src/components/Canvas/DesignerCanvas.tsx
```

1. **Edge 인덱스 사전 계산** (`snapGrid.ts`):
   ```ts
   export interface SnapEdgeIndex {
     // 정렬된 x좌표 배열: [{ position, controlId, edgeType }]
     xEdges: { position: number; controlId: string; edgeType: string }[];
     // 정렬된 y좌표 배열
     yEdges: { position: number; controlId: string; edgeType: string }[];
   }

   export function buildSnapEdgeIndex(
     controls: ControlDefinition[],
     excludeIds?: Set<string>,
   ): SnapEdgeIndex {
     const xEdges: SnapEdgeIndex['xEdges'] = [];
     const yEdges: SnapEdgeIndex['yEdges'] = [];

     for (const c of controls) {
       if (excludeIds?.has(c.id)) continue;
       const { x, y } = c.position;
       const { width, height } = c.size;
       xEdges.push(
         { position: x, controlId: c.id, edgeType: 'left' },
         { position: x + width, controlId: c.id, edgeType: 'right' },
         { position: x + width / 2, controlId: c.id, edgeType: 'centerX' },
       );
       yEdges.push(
         { position: y, controlId: c.id, edgeType: 'top' },
         { position: y + height, controlId: c.id, edgeType: 'bottom' },
         { position: y + height / 2, controlId: c.id, edgeType: 'centerY' },
       );
     }

     xEdges.sort((a, b) => a.position - b.position);
     yEdges.sort((a, b) => a.position - b.position);
     return { xEdges, yEdges };
   }
   ```

2. **이진 탐색 기반 getSnaplines** (`snapGrid.ts`):
   ```ts
   export function getSnaplinesFromIndex(
     movingControl: { position: { x: number; y: number }; size: { width: number; height: number } },
     index: SnapEdgeIndex,
     threshold: number = 4,
   ): Snapline[] {
     const snaplines: Snapline[] = [];
     const { x, y } = movingControl.position;
     const { width, height } = movingControl.size;

     const movingXEdges = [x, x + width, x + width / 2];
     const movingYEdges = [y, y + height, y + height / 2];

     // 이진 탐색으로 threshold 범위 내 edge만 검색
     for (const mx of movingXEdges) {
       for (const edge of binarySearchRange(index.xEdges, mx, threshold)) {
         snaplines.push({ type: 'vertical', position: edge.position });
       }
     }
     for (const my of movingYEdges) {
       for (const edge of binarySearchRange(index.yEdges, my, threshold)) {
         snaplines.push({ type: 'horizontal', position: edge.position });
       }
     }

     return deduplicateSnaplines(snaplines);
   }
   ```

3. **인덱스 캐싱** (`CanvasControl.tsx`):
   - 드래그 시작 시 `buildSnapEdgeIndex()`를 **1회만 호출**하여 인덱스 생성
   - 드래그 중 mousemove에서는 `getSnaplinesFromIndex()`만 호출
   - 기존: 매 mousemove마다 `controls.filter()` + `getSnaplines()` 전체 순회
   - 개선: 드래그 시작 시 인덱스 빌드(O(n log n)), mousemove당 O(log n) 탐색

4. **getHiddenControlIds 최적화** (`DesignerCanvas.tsx`):
   - `controls.filter()` 반복 호출 → `parentId` 기반 Map 사전 구축
   ```ts
   const childrenMap = useMemo(() => {
     const map = new Map<string, ControlDefinition[]>();
     for (const c of controls) {
       const parentId = c.properties._parentId as string;
       if (parentId) {
         const list = map.get(parentId) ?? [];
         list.push(c);
         map.set(parentId, list);
       }
     }
     return map;
   }, [controls]);
   ```

**기대 효과**:
- 컨트롤 500개 기준: mousemove당 비교 500→~20회 (이진 탐색) → **~96% 연산 감소**
- 드래그 시작 시 인덱스 빌드 1회 O(n log n) vs 기존 매 mousemove O(n) × 60fps
- `getHiddenControlIds`: Map 기반으로 `filter()` 호출 제거 → O(n) → O(자식 수)

### 2.3 historyStore — 구조적 공유 기반 스냅샷

**방식**: `JSON.stringify` 전체 직렬화 대신, 변경된 컨트롤만 추적하는 구조적 공유(structural sharing) 패턴

**구현 계획**:

```
수정 파일:
  - packages/designer/src/stores/historyStore.ts
```

1. **스냅샷 타입 변경**:
   ```ts
   interface Snapshot {
     controls: ControlDefinition[];       // 참조 공유 (변경되지 않은 컨트롤은 동일 객체 참조)
     formProperties: FormProperties;      // 참조 공유
   }

   interface HistoryState {
     past: Snapshot[];
     future: Snapshot[];
     // ...
   }
   ```

2. **createSnapshot 수정**:
   ```ts
   export function createSnapshot(): Snapshot {
     const { controls, formProperties } = useDesignerStore.getState();
     // JSON.stringify 대신 배열 참조를 얕은 복사로 저장
     // 개별 컨트롤 객체는 Zustand immer가 변경된 것만 새 참조를 생성하므로
     // 변경되지 않은 컨트롤은 동일 객체 참조를 유지
     return {
       controls: [...controls],
       formProperties: { ...formProperties },
     };
   }
   ```

3. **restoreSnapshot 수정**:
   ```ts
   export function restoreSnapshot(snapshot: Snapshot): void {
     useDesignerStore.setState({
       controls: [...snapshot.controls],
       formProperties: { ...snapshot.formProperties },
       isDirty: true,
     });
   }
   ```

4. **메모리 최적화 — 컨트롤 레벨 중복 제거**:
   - 컨트롤 500개 폼에서 1개만 이동한 경우:
     - 기존: 500개 전체 JSON 직렬화 (250KB)
     - 개선: 499개는 이전 스냅샷과 동일 객체 참조 공유, 1개만 새 객체
   - Zustand + immer 조합에서 `moveControls` 등은 변경된 컨트롤만 새 객체를 생성하므로 구조적 공유가 자연스럽게 발생

5. **과도한 메모리 방지**: `MAX_HISTORY` 50개 유지, 추가로 `controls.length > 200`인 경우 30개로 축소 가능

**기대 효과**:
- `createSnapshot`: `JSON.stringify` 제거 → 배열 얕은 복사만 수행 → **~99% 시간 단축**
- 메모리: 50개 스냅샷 × 250KB → 구조적 공유로 **~80–90% 메모리 절약** (변경된 컨트롤 수에 비례)
- `restoreSnapshot`: `JSON.parse` 제거 → 즉시 복원

---

## 3. 구현 우선순위

| 순서 | 항목 | 난이도 | 임팩트 | 추정 |
|------|------|--------|--------|------|
| 1 | historyStore 구조적 공유 | 낮음 | 높음 | 변경 최소, 즉각적 효과 |
| 2 | 스냅라인 이진 탐색 + 캐싱 | 중간 | 높음 | 드래그 UX 직접 영향 |
| 3 | DataGridView 가상화 | 중간 | 높음 | 외부 의존성 추가, 렌더링 구조 변경 |

---

## 4. 테스트 계획

### 4.1 historyStore
- 기존 undo/redo 테스트가 동일하게 통과하는지 확인
- 스냅샷 생성/복원 후 상태 동일성 검증
- 메모리 프로파일링: 50개 스냅샷 시 힙 크기 비교

### 4.2 스냅라인
- 기존 `getSnaplines` 테스트를 `getSnaplinesFromIndex`로 전환
- 500개 컨트롤 환경에서 드래그 시 프레임 레이트 측정
- Edge case: 동일 좌표의 다수 컨트롤, threshold 경계값

### 4.3 DataGridView
- 10,000행 렌더링 시 DOM 노드 수 확인 (뷰포트 행 수 + overscan)
- 스크롤 성능: Chrome DevTools Performance 탭에서 60fps 유지 확인
- 정렬/편집/선택 기능 정상 동작 확인
- 빈 데이터, 1행, 대량 데이터 경계 조건 테스트

---

## 5. 수정 대상 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `packages/runtime/src/controls/DataGridView.tsx` | react-window FixedSizeList 적용, table→div 레이아웃 전환 |
| `packages/runtime/package.json` | react-window 의존성 추가 |
| `packages/designer/src/utils/snapGrid.ts` | SnapEdgeIndex, buildSnapEdgeIndex, getSnaplinesFromIndex 추가 |
| `packages/designer/src/components/Canvas/CanvasControl.tsx` | 드래그 시작 시 인덱스 빌드, mousemove에서 인덱스 기반 탐색 |
| `packages/designer/src/components/Canvas/DesignerCanvas.tsx` | childrenMap 기반 getHiddenControlIds 최적화 |
| `packages/designer/src/stores/historyStore.ts` | Snapshot 타입 변경, JSON.stringify/parse 제거, 구조적 공유 |
