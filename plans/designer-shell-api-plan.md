# Designer Shell API 연동 (저장/로드/퍼블리시) 계획

## 1. 현재 상태 분석

### 1.1 apiService.ts 현재 메서드 목록

| 메서드 | HTTP | 경로 | 용도 |
|--------|------|------|------|
| `listForms()` | GET | `/forms` | 폼 목록 조회 |
| `loadForm(id)` | GET | `/forms/:id` | 폼 로드 |
| `saveForm(id, form)` | PUT | `/forms/:id` | 폼 저장 |
| `publishForm(id)` | POST | `/forms/:id/publish` | 폼 퍼블리시 |
| `createForm(input)` | POST | `/forms` | 폼 생성 |
| `deleteForm(id)` | DELETE | `/forms/:id` | 폼 삭제 |
| `listProjects()` | GET | `/projects` | 프로젝트 목록 |
| `getProject(id)` | GET | `/projects/:id` | 프로젝트 상세 |
| `createProject(input)` | POST | `/projects` | 프로젝트 생성 |
| `deleteProject(id)` | DELETE | `/projects/:id` | 프로젝트 삭제 |
| `updateProject(id, input)` | PUT | `/projects/:id` | 프로젝트 수정 |
| `exportProject(id)` | GET | `/projects/:id/export` | 내보내기 |
| `importProject(data)` | POST | `/projects/import` | 가져오기 |
| `applyProjectFont(id, font)` | PUT | `/projects/:id/font` | 폰트 일괄 |

### 1.2 패턴

- **HTTP 클라이언트**: 공통 `request<T>(path, options)` 함수 사용
- **인증**: `ensureAuth()` → `/auth/dev-token`에서 Bearer token 획득
- **API_BASE**: `import.meta.env.VITE_API_URL ?? '/api'`
- **에러 처리**: `res.ok` 체크 → `res.json().catch(...)` 후 `throw new Error()`
- **204 응답**: `undefined as T` 반환
- **반환 형식**: `{ data: T }` 또는 `{ data: T; meta: PaginationMeta }`

### 1.3 서버 Shell API (이미 구현됨)

`packages/server/src/routes/shells.ts`:
```
GET    /api/projects/:projectId/shell          → Shell 조회
POST   /api/projects/:projectId/shell          → Shell 생성
PUT    /api/projects/:projectId/shell          → Shell 수정
DELETE /api/projects/:projectId/shell          → Shell 삭제
POST   /api/projects/:projectId/shell/publish  → Shell 퍼블리시
```

### 1.4 designerStore Shell 상태 (이미 구현됨)

- `editMode: 'form' | 'shell'` — 현재 편집 모드
- `shellControls: ControlDefinition[]` — Shell 컨트롤 목록
- `shellProperties: ShellProperties` — Shell 속성
- `currentShellId: string | null` — 현재 Shell ID
- `loadShell(shellDef)` — Shell 데이터 로드
- `getShellDefinition()` — 현재 Shell 상태를 `ApplicationShellDefinition`으로 변환

### 1.5 미구현 지점 (이 태스크에서 구현)

1. **apiService.ts**: Shell CRUD 메서드 없음
2. **ProjectExplorer.tsx** `handleShellSelect()`: editMode만 전환, API 미호출
3. **App.tsx** `handleSave()`: Shell 모드에서 "not yet implemented" 표시
4. **App.tsx** 메뉴바: `currentFormId` 있을 때만 Save/Publish 버튼 표시 → Shell 모드에서도 표시 필요

---

## 2. Shell API 메서드 코드 초안

### 2.1 타입 정의 추가 (apiService.ts 상단)

```typescript
import type {
  ControlDefinition,
  FontDefinition,
  FormProperties,
  EventHandlerDefinition,
  DataBindingDefinition,
  ApplicationShellDefinition,
  ShellProperties,
} from '@webform/common';

interface ShellDocument {
  _id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
  published: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface UpdateShellPayload {
  name?: string;
  properties?: Partial<ShellProperties>;
  controls?: ControlDefinition[];
  eventHandlers?: EventHandlerDefinition[];
  startFormId?: string;
}
```

### 2.2 apiService 객체에 Shell 메서드 추가

```typescript
export const apiService = {
  // ... 기존 메서드 ...

  // Shell 조회
  async getShell(projectId: string): Promise<{ data: ShellDocument } | null> {
    try {
      return await request(`/projects/${projectId}/shell`);
    } catch (error) {
      // 404 (Shell 미존재)는 null 반환
      if (error instanceof Error && error.message.includes('404')) return null;
      throw error;
    }
  },

  // Shell 생성
  async createShell(
    projectId: string,
    data: Partial<UpdateShellPayload>,
  ): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Shell 수정
  async updateShell(
    projectId: string,
    data: UpdateShellPayload,
  ): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Shell 삭제
  async deleteShell(projectId: string): Promise<void> {
    return request(`/projects/${projectId}/shell`, { method: 'DELETE' });
  },

  // Shell 퍼블리시
  async publishShell(projectId: string): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell/publish`, { method: 'POST' });
  },
};
```

### 2.3 에러 처리 개선 — 404 구분

현재 `request()` 함수는 모든 non-ok 응답을 throw한다. Shell 조회에서 404를 null로 변환해야 하므로 `getShell()` 메서드 내에서 try/catch로 처리한다.

> **대안**: `request()` 자체를 수정할 수도 있으나, 기존 패턴을 유지하고 Shell 메서드 내에서만 처리하는 것이 영향 범위가 작다.

---

## 3. Shell 저장/로드 연동

### 3.1 ProjectExplorer — Shell 로드 로직

**파일**: `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx`
**위치**: `handleShellSelect()` (302행)

```typescript
const handleShellSelect = async (projectId: string) => {
  const store = useDesignerStore.getState();
  try {
    let result = await apiService.getShell(projectId);

    // Shell이 없으면 기본값으로 생성
    if (!result) {
      result = await apiService.createShell(projectId, {
        name: 'Application Shell',
      });
    }

    const shell = result.data;
    store.loadShell({
      id: shell._id,
      projectId: shell.projectId,
      name: shell.name,
      version: shell.version,
      properties: shell.properties,
      controls: shell.controls,
      eventHandlers: shell.eventHandlers,
    });
    // loadShell 내부에서 editMode = 'shell' 설정됨
  } catch (error) {
    console.error('Failed to load shell:', error);
  }
};
```

**변경 포인트**:
- 기존 `_projectId` 파라미터를 `projectId`로 사용
- `getShell()` 호출 → 없으면 `createShell()` 자동 생성
- `store.loadShell()` 호출하여 Shell 데이터를 스토어에 로드

### 3.2 App.tsx — Shell 저장 기능

**파일**: `packages/designer/src/App.tsx`
**위치**: `handleSave()` (40행)

```typescript
const handleSave = useCallback(async () => {
  try {
    if (editMode === 'shell') {
      const state = useDesignerStore.getState();
      if (!state.currentProjectId) return;
      const shellDef = state.getShellDefinition();
      await apiService.updateShell(state.currentProjectId, {
        name: shellDef.name,
        properties: shellDef.properties,
        controls: shellDef.controls,
        eventHandlers: shellDef.eventHandlers,
      });
      state.markClean();
      showStatus('Saved');
      return;
    }
    await save();
    showStatus('Saved');
  } catch {
    showStatus('Save failed');
  }
}, [save, editMode]);
```

### 3.3 App.tsx — Shell 퍼블리시 기능

**파일**: `packages/designer/src/App.tsx`
**위치**: `handlePublish()` (54행)

```typescript
const handlePublish = useCallback(async () => {
  if (editMode === 'shell') {
    const state = useDesignerStore.getState();
    if (!state.currentProjectId) return;
    try {
      // 먼저 저장
      const shellDef = state.getShellDefinition();
      await apiService.updateShell(state.currentProjectId, {
        name: shellDef.name,
        properties: shellDef.properties,
        controls: shellDef.controls,
        eventHandlers: shellDef.eventHandlers,
      });
      state.markClean();
      await apiService.publishShell(state.currentProjectId);
      showStatus('Published');
    } catch {
      showStatus('Publish failed');
    }
    return;
  }

  if (!currentFormId) return;
  try {
    await save();
    const { data } = await apiService.publishForm(currentFormId);
    setFormStatus(data.status);
    setExplorerRefreshKey((k) => k + 1);
    showStatus('Published');
  } catch {
    showStatus('Publish failed');
  }
}, [currentFormId, save, editMode]);
```

### 3.4 App.tsx — 메뉴바 수정 (Shell 모드에서도 버튼 표시)

**현재 문제**: Save/Publish 버튼이 `{currentFormId && (...)}` 조건 안에 있어 Shell 모드에서 표시되지 않음.

**수정**: 조건을 `{(currentFormId || editMode === 'shell') && (...)}` 로 변경.

```typescript
{(currentFormId || editMode === 'shell') && (
  <>
    <span style={{ color: '#aaa' }}>|</span>
    <button type="button" onClick={handleSave} disabled={!isDirty} style={menuBtnStyle}>
      Save
    </button>
    <button type="button" onClick={handlePublish} style={menuBtnStyle}>
      Publish
    </button>
    {/* Form 모드에서만 표시되는 상태/런타임 링크 */}
    {editMode === 'form' && currentFormId && (
      <>
        <span style={{ color: '#aaa' }}>|</span>
        <span style={{
          fontSize: 11,
          color: formStatus === 'published' ? '#2e7d32' : '#888',
          fontWeight: 500,
        }}>
          {formStatus === 'published' ? 'Published' : 'Draft'}
        </span>
        {/* ... Runtime URL 링크 ... */}
      </>
    )}
    {saveStatus && (
      <>
        <span style={{ color: '#aaa' }}>|</span>
        <span style={{ fontSize: 11, color: '#2e7d32', fontWeight: 500 }}>{saveStatus}</span>
      </>
    )}
  </>
)}
```

---

## 4. Shell Auto-Save 확장

### 4.1 useAutoSave 훅 확장

**파일**: `packages/designer/src/services/apiService.ts`
**위치**: `useAutoSave()` (285행)

현재 `useAutoSave`는 `currentFormId`와 `isDirty`를 기반으로 폼만 저장한다. Shell 모드에서도 auto-save를 지원하려면:

```typescript
export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const isDirty = useDesignerStore((s) => s.isDirty);
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const markClean = useDesignerStore((s) => s.markClean);
  const editMode = useDesignerStore((s) => s.editMode);

  const save = useCallback(async () => {
    if (!isDirty) return;

    if (editMode === 'shell') {
      // Shell auto-save
      const state = useDesignerStore.getState();
      if (!state.currentProjectId) return;
      try {
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        markClean();
      } catch (error) {
        console.error('Shell auto-save failed:', error);
      }
      return;
    }

    // Form auto-save (기존 로직)
    if (!currentFormId) return;
    try {
      const nestedControls = nestControls(controls);
      await apiService.saveForm(currentFormId, {
        controls: nestedControls,
        properties: formProperties,
        eventHandlers: extractEventHandlers(controls),
      });
      markClean();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentFormId, isDirty, controls, formProperties, markClean, editMode]);

  const forceSave = useCallback(async () => {
    const state = useDesignerStore.getState();

    if (state.editMode === 'shell') {
      if (!state.currentProjectId) return;
      try {
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        state.markClean();
      } catch (error) {
        console.error('Shell save failed:', error);
      }
      return;
    }

    if (!state.currentFormId) return;
    try {
      const nestedControls = nestControls(state.controls);
      await apiService.saveForm(state.currentFormId, {
        controls: nestedControls,
        properties: state.formProperties,
        eventHandlers: extractEventHandlers(state.controls),
      });
      state.markClean();
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, []);

  useEffect(() => {
    const hasTarget = editMode === 'shell'
      ? useDesignerStore.getState().currentProjectId != null
      : currentFormId != null;
    if (!hasTarget || !isDirty) return;

    timerRef.current = setTimeout(save, AUTO_SAVE_INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [currentFormId, isDirty, save, editMode]);

  return { save, forceSave };
}
```

---

## 5. 수정 파일 요약 및 구현 순서

### 수정 파일 목록

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `packages/designer/src/services/apiService.ts` | Shell 타입 + API 메서드 5개 추가, useAutoSave Shell 지원 |
| 2 | `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` | `handleShellSelect()` API 연동 |
| 3 | `packages/designer/src/App.tsx` | handleSave/handlePublish Shell 분기, 메뉴바 조건 수정 |

### 구현 순서

1. **apiService.ts** — Shell 타입 정의 + API 메서드 추가
2. **apiService.ts** — useAutoSave 훅에 Shell 모드 분기 추가
3. **ProjectExplorer.tsx** — handleShellSelect()에 Shell 로드 로직 구현
4. **App.tsx** — handleSave(), handlePublish() Shell 모드 분기
5. **App.tsx** — 메뉴바 조건문 수정 (Shell 모드에서 Save/Publish 표시)

### designer-shell-canvas 태스크와의 관계

- 이 태스크는 **API 연동 레이어**에 집중 (네트워크 I/O, 저장/로드)
- `designer-shell-canvas` 태스크는 **캔버스 렌더링** 담당 (Shell 컨트롤 시각화)
- 두 태스크는 `designerStore`의 Shell 상태를 공유하므로 병렬 구현 가능
- Shell 캔버스가 없어도 API 연동은 독립적으로 동작 (속성만 편집하는 경우)

---

## 6. 타입 재export 추가

```typescript
// apiService.ts 하단
export type {
  // ... 기존 ...
  ShellDocument,
  UpdateShellPayload,
};
```
