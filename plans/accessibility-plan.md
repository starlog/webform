# 접근성 개선 계획 (Accessibility Improvement Plan)

## 현황 분석

### 전체 요약
- **ARIA 속성**: 전체 컴포넌트에서 0개 사용
- **role 속성**: 전체 컴포넌트에서 0개 사용
- **키보드 네비게이션**: 부분 지원 (Delete, Ctrl+C/V만)
- **스크린 리더 지원**: 없음
- **WCAG 2.1 준수 수준**: Level A 미달

### 컴포넌트별 현황

| 컴포넌트 | ARIA | role | tabIndex | 키보드 | 문제 요약 |
|---------|------|------|----------|--------|----------|
| Toolbox | ✗ | ✗ | ✗ | ✗ | 카테고리 토글 마우스 전용, 드래그 전용 |
| ToolboxItem | ✗ | ✗ | ✗ | ✗ | 드래그만 가능, 키보드 추가 불가 |
| DesignerCanvas | ✗ | ✗ | ○ (0) | △ (Del, Ctrl+C/V) | role 없음, 포커스 표시 없음 |
| CanvasControl | ✗ | ✗ | ✗ | ✗ | 마우스 드래그 전용, 선택 마우스 전용 |
| ResizeHandle | ✗ | ✗ | ✗ | ✗ | 마우스 드래그 전용, 키보드 리사이즈 불가 |
| PropertyPanel | ✗ | ✗ | ✗ | ✗ | 탭 role 없음, 정렬 버튼 aria-label 없음 |
| PropertyCategory | ✗ | ✗ | ✗ | ✗ | 카테고리 헤더 마우스 전용 |
| ElementList | ✗ | ✗ | ○ (-1) | △ (Del) | 트리뷰 role 없음, 화살표 키 없음 |
| ProjectExplorer | ✗ | ✗ | ○ (-1) | △ (F2) | 트리뷰 role 없음, 컨텍스트 메뉴 마우스 전용 |
| ZOrderContextMenu | ✗ | ✗ | ✗ | ✗ | 메뉴 role 없음, 키보드 네비게이션 없음 |
| EventEditor | ✗ | ✗ | ✗ | ✗ | 다이얼로그 role 없음, 포커스 트랩 없음 |
| DataSourcePanel | ✗ | ✗ | ✗ | ✗ | 패널 role 없음 |
| 다이얼로그 (폰트 설정 등) | ✗ | ✗ | ✗ | ✗ | 포커스 트랩 없음, Escape 닫기 없음 |

---

## 우선순위별 개선 계획

### Phase 1: 기본 접근성 (WCAG 2.1 Level A 필수) — 높은 우선순위

ARIA 속성 추가, 기본 키보드 지원, 스크린 리더 기본 인식을 목표로 한다.

#### 1.1 다이얼로그/모달 접근성
**대상 파일**: `ProjectExplorer.tsx`, `EventEditor.tsx`

| 수정 항목 | 설명 |
|----------|------|
| `role="dialog"` 추가 | 모든 모달 래퍼 div에 적용 |
| `aria-modal="true"` 추가 | 모달 오버레이에 적용 |
| `aria-labelledby` 추가 | 다이얼로그 제목 요소 id 연결 |
| 포커스 트랩 구현 | Tab/Shift+Tab이 모달 내부에서만 순환 |
| Escape 키 닫기 | onKeyDown에서 Escape 감지 → onClose() 호출 |
| 열릴 때 포커스 이동 | useEffect에서 첫 번째 포커스 가능 요소로 이동 |
| 닫힐 때 포커스 복원 | 이전 포커스 요소 기억 → 모달 닫힐 때 복원 |

**구체적 수정 — ProjectExplorer.tsx**:
```tsx
// 기본 폰트 설정 다이얼로그 (672줄 근처)
<div role="dialog" aria-modal="true" aria-labelledby="default-font-dialog-title"
     onKeyDown={(e) => { if (e.key === 'Escape') setDefaultFontDialog(null); }}>
  <h2 id="default-font-dialog-title">기본 폰트 설정</h2>
  ...
</div>

// 폰트 일괄 적용 다이얼로그 (759줄 근처)
<div role="dialog" aria-modal="true" aria-labelledby="font-batch-dialog-title"
     onKeyDown={(e) => { if (e.key === 'Escape') setFontDialog(null); }}>
  <h2 id="font-batch-dialog-title">폰트 일괄 적용</h2>
  ...
</div>
```

**구체적 수정 — EventEditor.tsx**:
```tsx
// 이벤트 에디터 전체 래퍼
<div role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
  <h2 id="event-editor-title">{handlerName} 이벤트 에디터</h2>
  ...
</div>
```

#### 1.2 컨텍스트 메뉴 접근성
**대상 파일**: `ZOrderContextMenu.tsx`, `ProjectExplorer.tsx`

| 수정 항목 | 설명 |
|----------|------|
| `role="menu"` 추가 | 메뉴 컨테이너에 적용 |
| `role="menuitem"` 추가 | 각 메뉴 항목에 적용 |
| `tabIndex={0}` 추가 | 활성 메뉴 항목에 포커스 가능하게 |
| `aria-disabled` 추가 | 비활성 항목에 disabled 대신 사용 |
| 화살표 키 네비게이션 | ↑↓ 키로 항목 간 이동 |
| Enter/Space 실행 | 현재 포커스된 항목 실행 |
| Escape 닫기 | 메뉴 닫고 트리거 요소로 포커스 복원 |
| 열릴 때 첫 항목 포커스 | useEffect로 첫 menuitem에 포커스 |

**구체적 수정 — ZOrderContextMenu.tsx**:
```tsx
<div ref={ref} role="menu" aria-label="정렬 순서"
     onKeyDown={handleMenuKeyDown}>
  <MenuItem role="menuitem" tabIndex={0} label="맨 앞으로" ... />
  <MenuItem role="menuitem" tabIndex={-1} label="앞으로" ... />
  ...
</div>
```

#### 1.3 아이콘 버튼 aria-label 추가
**대상 파일**: `ProjectExplorer.tsx`, `PropertyPanel.tsx`

| 위치 | 현재 | 수정 |
|------|------|------|
| ProjectExplorer "+" 버튼 | `title="새 프로젝트"` | + `aria-label="새 프로젝트"` |
| ProjectExplorer "↓" 버튼 | `title="가져오기"` | + `aria-label="가져오기"` |
| ProjectExplorer "⟳" 버튼 | `title="새로고침"` | + `aria-label="새로고침"` |
| ProjectExplorer "×" 닫기 버튼 | 텍스트만 | + `aria-label="닫기"` |
| PropertyPanel 정렬 토글 | `title="Sort..."` | + `aria-label="정렬 방식 변경"` |
| PropertyPanel Copy 버튼 | `title="Copy FormId"` | + `aria-label="FormId 복사"` |

#### 1.4 인터랙티브 컨테이너 role 추가
**대상 파일**: 다수

| 컴포넌트 | 요소 | 추가할 role |
|---------|------|-----------|
| Toolbox | 전체 컨테이너 | `role="toolbar"` + `aria-label="도구 상자"` |
| Toolbox 카테고리 헤더 | 펼침/접힘 div | `role="button"` + `aria-expanded` + `tabIndex={0}` |
| PropertyPanel 탭 바 | 탭 컨테이너 | `role="tablist"` |
| PropertyPanel TabButton | 각 탭 | `role="tab"` + `aria-selected` + `aria-controls` |
| PropertyPanel 탭 내용 | 탭 패널 | `role="tabpanel"` + `aria-labelledby` |
| PropertyCategory 헤더 | 펼침/접힘 div | `role="button"` + `aria-expanded` + `tabIndex={0}` |
| ElementList 트리뷰 | 트리 컨테이너 | `role="tree"` + `aria-label="요소 목록"` |
| ElementTreeNode | 각 노드 | `role="treeitem"` + `aria-expanded` + `aria-selected` |
| ProjectExplorer 트리뷰 | 트리 컨테이너 | `role="tree"` + `aria-label="프로젝트 탐색기"` |
| DesignerCanvas | 캔버스 div | `role="application"` + `aria-label="폼 디자이너 캔버스"` |
| CanvasControl | 컨트롤 wrapper | `role="option"` + `aria-selected` + `aria-label` |

---

### Phase 2: 키보드 네비게이션 — 중간 우선순위

마우스 없이 주요 기능을 사용할 수 있게 한다.

#### 2.1 Toolbox 키보드 지원
**대상 파일**: `Toolbox.tsx`, `ToolboxItem.tsx`

| 수정 항목 | 설명 |
|----------|------|
| 카테고리 헤더 `tabIndex={0}` | 키보드 포커스 가능 |
| Enter/Space로 카테고리 토글 | onKeyDown 추가 |
| ↑↓ 키로 항목 간 이동 | roving tabindex 패턴 |
| Enter/Space로 도구 선택 | 선택 후 캔버스 클릭으로 배치 (드래그 대안) |

#### 2.2 PropertyPanel 키보드 지원
**대상 파일**: `PropertyPanel.tsx`, `PropertyCategory.tsx`

| 수정 항목 | 설명 |
|----------|------|
| Tab 키로 탭 전환 | 좌우 화살표 키로 Properties ↔ Events 전환 |
| Enter/Space로 카테고리 토글 | PropertyCategory 헤더에 onKeyDown 추가 |
| Tab으로 속성 에디터 순회 | 각 PropertyRow의 에디터에 tabIndex 설정 |

#### 2.3 ElementList/ProjectExplorer 트리뷰 키보드
**대상 파일**: `ElementList.tsx`, `ElementTreeNode.tsx`, `ProjectExplorer.tsx`

| 수정 항목 | 설명 |
|----------|------|
| ↑↓ 키로 노드 간 이동 | 가시적 노드 목록에서 이전/다음 선택 |
| ←→ 키로 펼침/접힘 | 왼쪽: 접힘 또는 부모로 이동, 오른쪽: 펼침 또는 첫 자식 |
| Enter로 노드 활성화 | 폼 열기, 컨트롤 선택 등 |
| Home/End로 처음/끝 이동 | 트리 시작/끝으로 점프 |
| Shift+F10으로 컨텍스트 메뉴 | 마우스 우클릭 대안 |

#### 2.4 DesignerCanvas 키보드 지원 강화
**대상 파일**: `DesignerCanvas.tsx`, `CanvasControl.tsx`

| 수정 항목 | 설명 |
|----------|------|
| Tab/Shift+Tab으로 컨트롤 순회 | 캔버스 내 컨트롤 간 포커스 이동 |
| 화살표 키로 선택된 컨트롤 이동 | ← → ↑ ↓로 그리드 단위 이동 |
| Shift+화살표로 리사이즈 | Shift + 화살표 키로 크기 조절 |
| Enter로 컨트롤 속성 편집 | PropertyPanel로 포커스 이동 |
| Escape로 선택 해제 | 현재 선택 취소 |

---

### Phase 3: 스크린 리더 최적화 — 낮은 우선순위

시각 장애인 사용자를 위한 추가 정보 제공.

#### 3.1 라이브 리전 (Live Regions)
| 수정 항목 | 설명 |
|----------|------|
| 컨트롤 추가/삭제 알림 | `aria-live="polite"` 영역에 "Button1 추가됨" 등 |
| 저장 상태 알림 | "저장 완료", "변경사항 있음" 등 |
| 에러 메시지 알림 | `aria-live="assertive"` 에러 영역 |

#### 3.2 추가 ARIA 속성
| 수정 항목 | 설명 |
|----------|------|
| `aria-describedby` | 복잡한 에디터에 도움말 텍스트 연결 |
| `aria-busy` | 비동기 로딩 중 상태 표시 |
| `aria-current` | 현재 열린 폼 표시 |
| `aria-keyshortcuts` | 주요 단축키 정보 제공 |

#### 3.3 시각적 포커스 표시
| 수정 항목 | 설명 |
|----------|------|
| CSS `:focus-visible` 스타일 | 모든 포커스 가능 요소에 시각적 윤곽선 |
| 캔버스 컨트롤 포커스 표시 | 키보드로 선택 시 점선 테두리 추가 |
| `outline: none` 제거 또는 대체 | DesignerCanvas의 outline: none → focus-visible 스타일로 교체 |

---

## 공통 유틸리티 생성

### useFocusTrap 훅
```typescript
// packages/designer/src/hooks/useFocusTrap.ts
function useFocusTrap(ref: RefObject<HTMLElement>, isActive: boolean): void
```
- 모달/다이얼로그에 사용
- Tab/Shift+Tab을 내부 요소로 제한
- 첫 포커스 가능 요소로 자동 이동

### useRovingTabIndex 훅
```typescript
// packages/designer/src/hooks/useRovingTabIndex.ts
function useRovingTabIndex(items: string[], orientation: 'vertical' | 'horizontal'): {
  activeIndex: number;
  getTabIndex: (index: number) => 0 | -1;
  onKeyDown: (e: KeyboardEvent) => void;
}
```
- Toolbox, 메뉴, 트리뷰에 사용
- 화살표 키 네비게이션 통합

### useAriaAnnounce 훅
```typescript
// packages/designer/src/hooks/useAriaAnnounce.ts
function useAriaAnnounce(): (message: string, priority?: 'polite' | 'assertive') => void
```
- 라이브 리전 메시지 전송

---

## 수정 파일 전체 목록

### Phase 1 (15개 파일)
1. `components/Canvas/DesignerCanvas.tsx` — role="application", aria-label
2. `components/Canvas/CanvasControl.tsx` — aria-selected, aria-label
3. `components/Canvas/ResizeHandle.tsx` — role, aria-label
4. `components/Toolbox/Toolbox.tsx` — role="toolbar", aria-label, 카테고리 button role
5. `components/Toolbox/ToolboxItem.tsx` — role, aria-label
6. `components/PropertyPanel/PropertyPanel.tsx` — tablist/tab/tabpanel role, aria-label
7. `components/PropertyPanel/PropertyCategory.tsx` — button role, aria-expanded
8. `components/PropertyPanel/EventsTab.tsx` — aria-label
9. `components/ElementList/ElementList.tsx` — role="tree", aria-label
10. `components/ElementList/ElementTreeNode.tsx` — role="treeitem", aria-expanded, aria-selected
11. `components/ProjectExplorer/ProjectExplorer.tsx` — role="tree", dialog role, aria-label, Escape 키
12. `components/ZOrderContextMenu.tsx` — role="menu"/"menuitem", 키보드 네비게이션
13. `components/EventEditor/EventEditor.tsx` — role="dialog", 포커스 트랩
14. `components/DataSourcePanel/DataSourcePanel.tsx` — aria-label
15. `components/ThemeEditor/ThemeEditor.tsx` — aria-label

### Phase 2 (7개 파일 + 3개 신규)
16. `hooks/useFocusTrap.ts` — (신규) 포커스 트랩 훅
17. `hooks/useRovingTabIndex.ts` — (신규) roving tabindex 훅
18. `hooks/useAriaAnnounce.ts` — (신규) 라이브 리전 훅
19. `components/Toolbox/Toolbox.tsx` — 키보드 네비게이션 추가
20. `components/Toolbox/ToolboxItem.tsx` — Enter/Space 선택
21. `components/ElementList/ElementList.tsx` — 화살표 키 네비게이션
22. `components/ElementList/ElementTreeNode.tsx` — 트리 키보드
23. `components/ProjectExplorer/ProjectExplorer.tsx` — 트리 키보드, Shift+F10
24. `components/Canvas/DesignerCanvas.tsx` — Tab 순회, 화살표 이동
25. `components/PropertyPanel/PropertyCategory.tsx` — Enter/Space 토글

### Phase 3 (5개 파일)
26. 라이브 리전 컨테이너 추가 (App.tsx 또는 DesignerLayout)
27. CSS focus-visible 스타일 전역 추가
28. `components/Canvas/DesignerCanvas.tsx` — 포커스 표시 스타일
29. `components/Canvas/CanvasControl.tsx` — 포커스 표시 스타일
30. 기타 컴포넌트 추가 ARIA 속성

---

## 작업 일정 권장

| Phase | 예상 규모 | 의존성 |
|-------|----------|--------|
| Phase 1 | 15개 파일 수정 | 없음 (즉시 시작 가능) |
| Phase 2 | 10개 파일 수정 + 3개 신규 | Phase 1 완료 후 |
| Phase 3 | 5개 파일 수정 | Phase 2 완료 후 |

## 테스트 계획

1. **수동 테스트**: 키보드만으로 모든 주요 기능 수행 가능 확인
2. **스크린 리더 테스트**: NVDA/VoiceOver로 주요 워크플로우 검증
3. **자동화 테스트**: axe-core 또는 jest-axe로 ARIA 규칙 위반 감지
4. **WCAG 체크리스트**: Lighthouse Accessibility 점수 90+ 목표
