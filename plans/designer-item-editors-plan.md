# Designer 아이템 컬렉션 에디터 계획

## 1. 현재 아이템 데이터 구조 (Runtime 컨트롤 분석)

### MenuStrip (packages/runtime/src/controls/MenuStrip.tsx)
```ts
interface MenuItem {
  text: string;
  shortcut?: string;
  children?: MenuItem[];
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
}
```
- 계층 구조 (children으로 서브메뉴 지원)
- separator가 true이면 구분선으로 렌더링
- Runtime에는 `id` 필드가 없음 → Designer 에디터에서 내부적으로 id 부여 필요

### ToolStrip (packages/runtime/src/controls/ToolStrip.tsx)
```ts
interface ToolStripItem {
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text?: string;
  tooltip?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;
  items?: ToolStripItem[];  // dropdown 타입일 때 하위 아이템
}
```
- 플랫 리스트 (단, dropdown 타입은 items 하위 아이템 보유)
- type에 따라 렌더링 방식 다름

### StatusStrip (packages/runtime/src/controls/StatusStrip.tsx)
```ts
interface StatusStripItem {
  type: 'label' | 'progressBar' | 'dropDownButton';
  text?: string;
  spring?: boolean;    // true이면 flex-grow: 1로 남은 공간 채움
  width?: number;
  value?: number;      // progressBar 전용
}
```
- 플랫 리스트
- spring 속성이 핵심 (WinForm의 StatusStrip Spring과 동일)

## 2. 현재 CollectionEditor.tsx 구조 분석

**파일:** `packages/designer/src/components/PropertyPanel/editors/CollectionEditor.tsx`

### 구조
- `CollectionEditor` — 버튼 형태. 클릭 시 `CollectionModal` 열림
- `CollectionModal` — fixed 포지션 모달 (backdrop + 중앙 정렬)

### 두 가지 모드
1. **문자열 모드**: 아이템이 primitive일 때 → 인라인 텍스트 입력
2. **객체 모드**: 아이템이 object일 때 → 좌측 리스트 + 우측 속성 편집기

### 공통 기능
- Add, Remove, Move Up, Move Down 버튼
- 선택 인덱스 관리 (selectedIndex)
- OK/Cancel 버튼 (onSave/onClose)

### 한계
- 객체 속성을 모두 text input으로만 편집 (boolean, dropdown 미지원)
- 트리 구조 미지원 (플랫 리스트만)
- 타입별 특화 UI 없음

### 스타일 패턴
```ts
const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  backgroundColor: '#f0f0f0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
```
- 모달: `position: fixed`, `inset: 0`, `zIndex: 10000`, backdrop `rgba(0,0,0,0.3)`
- 내부 컨테이너: 흰색 배경, `border: 1px solid #999`, `boxShadow`
- WinForm 스타일 일관성 유지

## 3. 에디터 연결 방법

### 접근 방식: 새로운 editorType 추가

`controlProperties.ts`의 `EditorType`에 3개 타입 추가:
```ts
export type EditorType =
  | 'text' | 'number' | 'color' | 'font' | 'dropdown'
  | 'boolean' | 'anchor' | 'collection' | 'tabEditor'
  | 'mongoColumns' | 'mongoConnectionString' | 'graphSample'
  | 'menuEditor'       // 신규
  | 'toolStripEditor'  // 신규
  | 'statusStripEditor'; // 신규
```

### controlProperties.ts 수정
```ts
// MenuStrip
const menuStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items', label: 'Items', category: 'Data', editorType: 'menuEditor' }, // 변경
  ...
);

// ToolStrip
const toolStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items', label: 'Items', category: 'Data', editorType: 'toolStripEditor' }, // 변경
  ...
);

// StatusStrip
const statusStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items', label: 'Items', category: 'Data', editorType: 'statusStripEditor' }, // 변경
  ...
);
```

### PropertyCategory.tsx 수정
`PropertyEditor` 함수의 switch에 3개 case 추가:
```ts
case 'menuEditor':
  return <MenuItemEditor value={value as any[] ?? []} onChange={onChange} />;
case 'toolStripEditor':
  return <ToolStripItemEditor value={value as any[] ?? []} onChange={onChange} />;
case 'statusStripEditor':
  return <StatusStripItemEditor value={value as any[] ?? []} onChange={onChange} />;
```

## 4. MenuItemEditor.tsx 코드 초안

**파일:** `packages/designer/src/components/Editors/MenuItemEditor.tsx`

### 인터페이스
```ts
interface MenuItemData {
  id: string;
  text: string;
  shortcut?: string;
  enabled: boolean;
  checked: boolean;
  separator: boolean;
  children?: MenuItemData[];
}

interface MenuItemEditorProps {
  value: unknown[];
  onChange: (items: MenuItemData[]) => void;
}
```

### 컴포넌트 구조
```
MenuItemEditor (버튼 — "(Menu Items) [N]" 클릭 → 모달 열기)
└── MenuItemModal (fixed 모달)
    ├── 헤더: "Menu Items Editor"
    ├── 본문 (flex row)
    │   ├── 좌측: 트리뷰 (250px)
    │   │   └── TreeNode (재귀) — depth별 paddingLeft 20px
    │   └── 우측: 속성 패널 (flex: 1)
    │       ├── text: <input type="text">
    │       ├── shortcut: <input type="text">
    │       ├── enabled: <input type="checkbox">
    │       ├── checked: <input type="checkbox">
    │       └── separator: <input type="checkbox">
    ├── 액션 버튼: [Add] [Add Child] [Delete] [↑ Up] [↓ Down]
    └── 하단: [OK] [Cancel]
```

### 핵심 로직

#### 트리 탐색/수정 유틸
```ts
// 선택된 아이템의 경로 (인덱스 배열)로 아이템 찾기
function findItemByPath(items: MenuItemData[], path: number[]): MenuItemData | null

// 경로 기반으로 아이템 업데이트 (불변 업데이트)
function updateItemAtPath(items: MenuItemData[], path: number[], updater: (item: MenuItemData) => MenuItemData): MenuItemData[]

// 경로 기반으로 아이템 삭제
function removeItemAtPath(items: MenuItemData[], path: number[]): MenuItemData[]

// 경로 기반으로 아이템 추가 (형제 또는 자식)
function addItemAtPath(items: MenuItemData[], path: number[], asChild: boolean): { items: MenuItemData[], newPath: number[] }

// 아이템 이동 (같은 레벨 내 Up/Down)
function moveItemAtPath(items: MenuItemData[], path: number[], direction: 'up' | 'down'): { items: MenuItemData[], newPath: number[] }
```

#### 선택 상태
- `selectedPath: number[]` — 선택된 아이템의 트리 경로
  - 예: `[0]` = 첫 번째 루트, `[0, 2]` = 첫 번째 루트의 세 번째 자식

#### 정규화
- Runtime `MenuItem` → `MenuItemData` 변환 (id 부여)
- 저장 시 `MenuItemData` → Runtime `MenuItem` 변환 (id 제거)
```ts
function normalizeMenuItems(raw: unknown[]): MenuItemData[]
function denormalizeMenuItems(items: MenuItemData[]): MenuItem[]
```

#### 트리 노드 렌더링
```tsx
function TreeNode({ item, depth, path, selectedPath, onSelect }: TreeNodeProps) {
  const isSelected = arraysEqual(path, selectedPath);
  return (
    <>
      <div
        onClick={() => onSelect(path)}
        style={{
          paddingLeft: 8 + depth * 20,
          padding: '3px 6px',
          backgroundColor: isSelected ? '#0078d4' : undefined,
          color: isSelected ? '#fff' : '#000',
          cursor: 'pointer',
        }}
      >
        {item.separator ? '── (Separator) ──' : item.text || '(empty)'}
      </div>
      {item.children?.map((child, i) => (
        <TreeNode key={child.id} item={child} depth={depth + 1}
          path={[...path, i]} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </>
  );
}
```

### 모달 크기
- 폭: 550px (트리 250px + 속성 패널 300px)
- 높이: 자동 (최대 400px 콘텐츠 영역)

## 5. ToolStripItemEditor.tsx 코드 초안

**파일:** `packages/designer/src/components/Editors/ToolStripItemEditor.tsx`

### 인터페이스
```ts
interface ToolStripItemData {
  id: string;
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text: string;
  tooltip?: string;
  enabled: boolean;
  checked: boolean;
}

interface ToolStripItemEditorProps {
  value: unknown[];
  onChange: (items: ToolStripItemData[]) => void;
}
```

### 컴포넌트 구조
```
ToolStripItemEditor (버튼 — "(ToolStrip Items) [N]" 클릭)
└── ToolStripItemModal (fixed 모달)
    ├── 헤더: "ToolStrip Items Editor"
    ├── 본문 (flex row)
    │   ├── 좌측: 플랫 리스트 (180px)
    │   │   └── 아이템별 행 (선택 강조)
    │   └── 우측: 속성 패널 (flex: 1)
    │       ├── type: <select> (button/separator/label/dropdown)
    │       ├── text: <input type="text">
    │       ├── tooltip: <input type="text">
    │       ├── enabled: <input type="checkbox">
    │       └── checked: <input type="checkbox">
    ├── 액션 버튼: [Add] [Delete] [↑ Up] [↓ Down]
    └── 하단: [OK] [Cancel]
```

### 핵심 로직
- CollectionEditor 패턴과 유사한 플랫 리스트
- `selectedIndex` 상태로 선택 관리
- type이 'separator'일 때 text/tooltip/checked 비활성화 (구분선은 속성 불필요)
- 정규화: Runtime `ToolStripItem` → `ToolStripItemData` (id 부여), 역변환 시 id 제거
- Add 시 기본값: `{ id: crypto.randomUUID(), type: 'button', text: 'Button', enabled: true, checked: false }`

### 리스트 아이템 라벨
```ts
function getToolStripLabel(item: ToolStripItemData): string {
  if (item.type === 'separator') return '── (Separator) ──';
  return `[${item.type}] ${item.text || '(empty)'}`;
}
```

### 모달 크기
- 폭: 450px (리스트 180px + 속성 270px)

## 6. StatusStripItemEditor.tsx 코드 초안

**파일:** `packages/designer/src/components/Editors/StatusStripItemEditor.tsx`

### 인터페이스
```ts
interface StatusStripItemData {
  id: string;
  type: 'label' | 'progressBar' | 'dropDownButton';
  text: string;
  spring: boolean;
  width?: number;
  value?: number;  // progressBar 전용
}

interface StatusStripItemEditorProps {
  value: unknown[];
  onChange: (items: StatusStripItemData[]) => void;
}
```

### 컴포넌트 구조
```
StatusStripItemEditor (버튼 — "(StatusStrip Items) [N]" 클릭)
└── StatusStripItemModal (fixed 모달)
    ├── 헤더: "StatusStrip Items Editor"
    ├── 본문 (flex row)
    │   ├── 좌측: 플랫 리스트 (180px)
    │   └── 우측: 속성 패널 (flex: 1)
    │       ├── type: <select> (label/progressBar/dropDownButton)
    │       ├── text: <input type="text">
    │       ├── spring: <input type="checkbox">
    │       ├── width: <input type="number"> (spring=false일 때만)
    │       └── value: <input type="number" min=0 max=100> (progressBar일 때만)
    ├── 액션 버튼: [Add] [Delete] [↑ Up] [↓ Down]
    └── 하단: [OK] [Cancel]
```

### 핵심 로직
- ToolStripItemEditor와 구조 유사
- spring이 true이면 width 입력 비활성화 (의미 없으므로)
- type이 'progressBar'일 때만 value 속성 표시
- Add 시 기본값: `{ id: crypto.randomUUID(), type: 'label', text: 'Status', spring: false }`

### 리스트 아이템 라벨
```ts
function getStatusStripLabel(item: StatusStripItemData): string {
  const suffix = item.spring ? ' (spring)' : '';
  return `[${item.type}] ${item.text || '(empty)'}${suffix}`;
}
```

### 모달 크기
- 폭: 450px

## 7. 공통 패턴 및 구현 세부사항

### Modal/Dialog 패턴 (기존 프로젝트 일관성)
CollectionEditor, TabPagesEditor에서 사용하는 패턴 그대로 적용:
```tsx
// Backdrop
<div style={{
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10000,
}} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  {/* Modal content */}
  <div style={{
    width: 550,  // 에디터별 다름
    backgroundColor: '#fff',
    border: '1px solid #999',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    fontFamily: 'Segoe UI, sans-serif',
    fontSize: 12,
  }}>
    ...
  </div>
</div>
```

### 버튼 스타일 (공통)
기존 `btnStyle` 재사용:
```ts
const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  backgroundColor: '#f0f0f0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
```

### ID 생성
- `crypto.randomUUID()` 사용 (TabPagesEditor 패턴과 동일)

### 데이터 정규화/역정규화 패턴
- 모달 열림 시: Runtime 데이터 → 에디터 내부 데이터 변환 (id 부여)
- OK 클릭 시: 에디터 내부 데이터 → Runtime 데이터 변환 (id 제거)
- Cancel 클릭 시: 변경 없이 모달 닫기

## 8. 수정 대상 파일 목록

### 신규 생성
1. `packages/designer/src/components/Editors/MenuItemEditor.tsx`
2. `packages/designer/src/components/Editors/ToolStripItemEditor.tsx`
3. `packages/designer/src/components/Editors/StatusStripItemEditor.tsx`

### 수정
4. `packages/designer/src/components/PropertyPanel/controlProperties.ts`
   - `EditorType`에 `'menuEditor' | 'toolStripEditor' | 'statusStripEditor'` 추가
   - `menuStripProps`, `toolStripProps`, `statusStripProps`의 items editorType 변경

5. `packages/designer/src/components/PropertyPanel/PropertyCategory.tsx`
   - import 추가 (3개 에디터)
   - `PropertyEditor` switch에 3개 case 추가
