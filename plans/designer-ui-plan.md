# ProjectExplorer Publish All UI 구현 계획

## 1. 기존 코드 분석

### 1.1 컨텍스트 메뉴 구조

**`ProjectExplorer.tsx:330-364`** — `getContextMenuItems()` 함수가 `contextMenu.targetType`에 따라 메뉴 항목 배열을 반환한다.

프로젝트 노드 (`case 'project'`) 현재 메뉴 항목 순서:
```
1. '새 폼'          → handleNewForm(projectId)
2. '기본 폰트 설정'  → handleOpenDefaultFontDialog(projectId, projName)
3. '폰트 일괄 적용'  → handleOpenFontDialog(projectId, projName)
4. '내보내기'        → handleExportProject(projectId)
5. '삭제'           → handleDeleteProject(projectId, projName)
```

메뉴 항목 타입: `{ label: string; action: () => void }` (인터페이스 미정의, 인라인 객체)

### 1.2 formStatus 상태 관리

**위치**: `App.tsx:30` — `App` 컴포넌트의 로컬 state
```typescript
const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
```

**업데이트 시점**:
- 폼 로드 시: `App.tsx:136` — `setFormStatus(data.status)`
- 퍼블리시 후: `App.tsx:90` — `setFormStatus(data.status)`

**표시**: `App.tsx:182-188` — 메뉴바에 'Published' / 'Draft' 텍스트

**핵심**: `formStatus`는 `App.tsx`에 있고, `ProjectExplorer`에서 직접 접근 불가. 콜백 prop이 필요.

### 1.3 explorerRefreshKey 메커니즘

**위치**: `App.tsx:31` — `App` 컴포넌트의 로컬 state
```typescript
const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);
```

**증가 시점**: `App.tsx:91` — `setExplorerRefreshKey((k) => k + 1)` (퍼블리시 후)

**전달**: `App.tsx:257` — `<ProjectExplorer refreshKey={explorerRefreshKey} />`

**사용**: `ProjectExplorer.tsx:72-74` — `refreshKey` 변경 시 `loadProjects()` 재실행
```typescript
useEffect(() => { loadProjects(); }, [loadProjects, refreshKey]);
```

**핵심**: ProjectExplorer 내부에서 `loadProjects()`를 직접 호출하면 트리 새로고침이 가능하므로, 외부 `explorerRefreshKey`를 증가시키지 않아도 됨.

### 1.4 현재 폼의 projectId 확인 방법

**`App.tsx:27`**:
```typescript
const currentProjectId = useDesignerStore((s) => s.currentProjectId);
```

**`ProjectExplorer.tsx`에서도 동일하게 접근 가능** (designerStore import 이미 존재):
```typescript
const state = useDesignerStore.getState();
state.currentProjectId  // 현재 열린 폼/셸의 프로젝트 ID
state.currentFormId     // 현재 열린 폼 ID (editMode === 'form'일 때)
```

기존 사용 패턴 (`ProjectExplorer.tsx:214-218` — handleApplyProjectFont 참고):
```typescript
const state = useDesignerStore.getState();
if (state.currentFormId && state.currentProjectId === fontDialog.projectId) {
  // 현재 열린 폼이 해당 프로젝트에 속하면 리로드
}
```

### 1.5 알림/메시지 표시 방법

| 방법 | 사용처 | 비고 |
|------|--------|------|
| `alert()` | `ProjectExplorer.tsx:212,222,259` | 폰트 적용 결과, 에러 |
| `prompt()` | `ProjectExplorer.tsx:112,205-206` | 사용자 입력 |
| `confirm()` | `ProjectExplorer.tsx:151,161` | 삭제 확인 |
| `showStatus()` | `App.tsx:37-40` | 메뉴바 임시 메시지 (3초) |

**ProjectExplorer 내에서는 `alert()`를 사용하는 것이 기존 패턴과 일치**.

### 1.6 apiService.publishAll 메서드

**`apiService.ts:300-302`**:
```typescript
async publishAll(projectId: string): Promise<{ data: PublishAllResult }>
```

**PublishAllResult 타입** (`apiService.ts:118-121`):
```typescript
interface PublishAllResult {
  forms: { publishedCount: number; skippedCount: number; totalCount: number };
  shell: { published: boolean; skipped: boolean };
}
```

**API 엔드포인트**: `POST /projects/:projectId/publish-all`

---

## 2. 구현 계획

### 2.1 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` | handlePublishAll 함수 추가, 컨텍스트 메뉴에 'Publish All' 항목 추가 |
| `packages/designer/src/App.tsx` | onPublishAll 콜백 prop 전달, formStatus 업데이트 |

### 2.2 ProjectExplorer.tsx 변경

#### 2.2.1 Props 인터페이스 확장 (`ProjectExplorer.tsx:8-11`)

```typescript
interface ProjectExplorerProps {
  onFormSelect: (formId: string) => void;
  onPublishAll?: (projectId: string) => void;  // 추가
  refreshKey?: number;
}
```

#### 2.2.2 handlePublishAll 함수 추가

위치: `handleExportProject` 함수 뒤 (line 183 이후)

```typescript
const handlePublishAll = async (projectId: string) => {
  try {
    const { data: result } = await apiService.publishAll(projectId);
    const { forms, shell } = result;

    // 트리 새로고침 (폼 status 변경 반영)
    await loadProjects();

    // App.tsx에 알림 (formStatus 업데이트 등)
    onPublishAll?.(projectId);

    // 결과 메시지
    let msg = `${forms.publishedCount}개 폼 퍼블리시 완료`;
    if (forms.skippedCount > 0) {
      msg += ` (${forms.skippedCount}개 스킵)`;
    }
    if (shell.published) {
      msg += '\nShell 퍼블리시 완료';
    }
    alert(msg);
  } catch (error) {
    console.error('Failed to publish all:', error);
    alert('전체 퍼블리시에 실패했습니다.');
  }
};
```

#### 2.2.3 컨텍스트 메뉴에 항목 추가 (`ProjectExplorer.tsx:336-342`)

'새 폼' 다음 위치에 'Publish All' 추가:

```typescript
case 'project': {
  const proj = projects.find((p) => p.project._id === contextMenu.projectId);
  const projName = proj?.project.name ?? '';
  return [
    { label: '새 폼', action: () => handleNewForm(contextMenu.projectId) },
    { label: 'Publish All', action: () => handlePublishAll(contextMenu.projectId) },  // 추가
    { label: '기본 폰트 설정', action: () => handleOpenDefaultFontDialog(contextMenu.projectId, projName) },
    { label: '폰트 일괄 적용', action: () => handleOpenFontDialog(contextMenu.projectId, projName) },
    { label: '내보내기', action: () => handleExportProject(contextMenu.projectId) },
    { label: '삭제', action: () => handleDeleteProject(contextMenu.projectId, projName) },
  ];
}
```

### 2.3 App.tsx 변경

#### 2.3.1 onPublishAll 콜백 정의

위치: `handleFormSelect` 함수 근처

```typescript
const handlePublishAll = useCallback((projectId: string) => {
  // 현재 열린 폼이 해당 프로젝트에 속하면 formStatus를 'published'로 업데이트
  if (currentProjectId === projectId && currentFormId) {
    setFormStatus('published');
  }
  setExplorerRefreshKey((k) => k + 1);
}, [currentProjectId, currentFormId]);
```

#### 2.3.2 ProjectExplorer에 prop 전달 (`App.tsx:257`)

```typescript
<ProjectExplorer
  onFormSelect={handleFormSelect}
  onPublishAll={handlePublishAll}
  refreshKey={explorerRefreshKey}
/>
```

---

## 3. 구현 흐름 요약

```
사용자: 프로젝트 노드 우클릭 → 'Publish All' 클릭
  ↓
ProjectExplorer.handlePublishAll(projectId)
  ↓
apiService.publishAll(projectId)  →  POST /projects/:projectId/publish-all
  ↓ (성공)
loadProjects()  →  트리뷰 새로고침 (폼 status 아이콘 갱신)
  ↓
onPublishAll?.(projectId)  →  App.tsx에서 formStatus, explorerRefreshKey 업데이트
  ↓
alert(`${publishedCount}개 폼 퍼블리시 완료 (${skippedCount}개 스킵)`)
```

## 4. 에러 처리

- `apiService.publishAll()` 실패 시: `alert('전체 퍼블리시에 실패했습니다.')` + console.error
- 기존 패턴과 동일한 try-catch 구조 사용 (handleExportProject, handleApplyProjectFont 참고)

## 5. formStatus 업데이트 조건

`App.tsx`의 `handlePublishAll` 콜백에서:
```
조건: currentProjectId === publishAll의 projectId && currentFormId가 존재
결과: setFormStatus('published')
```

이유: publishAll은 해당 프로젝트의 모든 draft 폼을 퍼블리시하므로, 현재 열린 폼이 해당 프로젝트에 속하면 반드시 published 상태가 됨.

## 6. 주의사항

- `explorerRefreshKey` 증가는 `loadProjects()` 직접 호출과 중복될 수 있으나, App.tsx 측에서도 증가시켜 일관성 유지
- `onPublishAll` prop은 옵셔널(`?`)로 처리하여 기존 사용에 영향 없음
- 이미 모두 published인 프로젝트에서도 API 호출은 성공하며 `skippedCount`로 결과 확인 가능
