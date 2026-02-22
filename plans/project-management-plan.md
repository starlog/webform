# 프로젝트 관리 구현 계획

## 1. 개요

PRD 섹션 4.3(프로젝트 관리)과 6.1(핵심 API 엔드포인트)을 기반으로 프로젝트 관리 기능을 구현한다.
WinForm의 Solution/Project 개념을 차용하여 폼, 데이터소스 등을 프로젝트 단위로 관리하고,
디자이너에 ProjectExplorer 컴포넌트와 API 클라이언트(apiService.ts)를 추가한다.

**의존성**: `form-crud-api-commit` (완료됨)

**생성/수정 파일**:

| 파일 | 역할 |
|------|------|
| `packages/server/src/models/Project.ts` | Mongoose 스키마 (신규) |
| `packages/server/src/services/ProjectService.ts` | 비즈니스 로직 (신규) |
| `packages/server/src/validators/projectValidator.ts` | Zod 검증 스키마 (신규) |
| `packages/server/src/routes/projects.ts` | Express 라우터 핸들러 (기존 스텁 교체) |
| `packages/designer/src/services/apiService.ts` | API 클라이언트 (신규) |
| `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` | 트리뷰 UI (신규) |
| `packages/designer/src/components/ProjectExplorer/index.ts` | 배럴 export (신규) |
| `packages/designer/src/stores/designerStore.ts` | `currentProjectId` 추가 (수정) |
| `packages/designer/src/App.tsx` | ProjectExplorer 통합, 메뉴바 (수정) |

---

## 2. 프로젝트 구조 (PRD 4.3.1)

```
Solution (솔루션 — 향후 확장 예약)
  └── Project (프로젝트)
        ├── Forms/
        │     ├── MainForm.wfd
        │     ├── LoginForm.wfd
        │     └── UserListForm.wfd
        ├── DataSources/
        │     ├── MainDB.wfds
        │     └── ExternalAPI.wfds
        ├── SharedCode/          ← 향후 확장
        │     └── Validators.ts
        └── Assets/              ← 향후 확장
              └── logo.png
```

현 단계에서는 **Project → Forms/DataSources** 관계까지만 구현한다.
SharedCode, Assets는 구조만 예약하고 구현은 후속 태스크로 미룬다.

---

## 3. MongoDB 스키마

### 3.1 ProjectDocument 인터페이스

파일: `packages/server/src/models/Project.ts`

```typescript
import mongoose, { Schema } from 'mongoose';

export interface ProjectDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Mongoose 스키마

```typescript
const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ deletedAt: 1 });
projectSchema.index({ name: 'text' });
projectSchema.index({ createdAt: -1 });

export const Project = mongoose.model<ProjectDocument>('Project', projectSchema);
```

### 3.3 설계 결정: formIds 배열 vs 역참조

Form 모델에 이미 `projectId` 필드가 있으므로 Project에 `formIds` 배열을 별도로 유지하지 않는다.
프로젝트 상세 조회 시 `Form.find({ projectId, deletedAt: null })`로 폼 목록을 가져온다.

**이유**:
- 데이터 정합성 유지 (단일 진실의 원천)
- 폼 생성/삭제 시 Project 문서를 동시에 업데이트할 필요 없음
- Form 모델에 이미 `projectId + deletedAt` 복합 인덱스가 있어 조회 성능 충분

---

## 4. Zod 검증 스키마

파일: `packages/server/src/validators/projectValidator.ts`

```typescript
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const importProjectSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    description: z.string().default(''),
  }),
  forms: z.array(z.object({
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    controls: z.array(z.unknown()).default([]),
    eventHandlers: z.array(z.unknown()).default([]),
    dataBindings: z.array(z.unknown()).default([]),
  })),
});

export type ImportProjectInput = z.infer<typeof importProjectSchema>;
```

---

## 5. ProjectService 메서드

파일: `packages/server/src/services/ProjectService.ts`

### 5.1 클래스 구조

```typescript
import { Project } from '../models/Project.js';
import type { ProjectDocument } from '../models/Project.js';
import { Form } from '../models/Form.js';
import type { FormDocument } from '../models/Form.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  ImportProjectInput,
} from '../validators/projectValidator.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export class ProjectService {
  async createProject(input: CreateProjectInput, userId: string): Promise<ProjectDocument>
  async getProject(id: string): Promise<ProjectDocument>
  async getProjectDetail(id: string): Promise<{ project: ProjectDocument; forms: FormDocument[] }>
  async listProjects(query: ListProjectsQuery): Promise<{ data: ProjectDocument[]; total: number }>
  async updateProject(id: string, input: UpdateProjectInput, userId: string): Promise<ProjectDocument>
  async deleteProject(id: string): Promise<void>
  async exportProject(id: string): Promise<ExportProjectData>
  async importProject(input: ImportProjectInput, userId: string): Promise<ProjectDocument>
}
```

### 5.2 메서드 상세

#### createProject
1. `createProjectSchema`로 입력 검증
2. `createdBy`, `updatedBy`에 userId 설정
3. MongoDB에 저장 후 반환

#### getProject
1. `Project.findOne({ _id: id, deletedAt: null })`
2. 없으면 `NotFoundError` throw

#### getProjectDetail
1. `getProject(id)`으로 프로젝트 조회
2. `Form.find({ projectId: id, deletedAt: null }).select('-versions').sort({ updatedAt: -1 }).lean()`
3. `{ project, forms }` 반환

#### listProjects
1. 기본 필터: `{ deletedAt: null }`
2. `search` 있으면 `{ name: { $regex: search, $options: 'i' } }` 추가
3. 페이지네이션 적용, `updatedAt` 내림차순
4. `{ data, total }` 반환

#### updateProject
1. `getProject(id)`으로 존재 확인
2. `Project.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { ...input, updatedBy: userId } }, { new: true })`

#### deleteProject
1. `getProject(id)`으로 존재 확인
2. 트랜잭션 내에서:
   - `Project.updateOne({ _id: id }, { $set: { deletedAt: new Date() } })`
   - `Form.updateMany({ projectId: id, deletedAt: null }, { $set: { deletedAt: new Date() } })`
3. 프로젝트 삭제 시 하위 폼도 함께 soft delete

#### exportProject
1. `getProject(id)`으로 프로젝트 조회
2. `Form.find({ projectId: id, deletedAt: null }).select('-versions -deletedAt').lean()`
3. JSON 직렬화하여 반환:
   ```typescript
   interface ExportProjectData {
     exportVersion: '1.0';
     exportedAt: string;
     project: {
       name: string;
       description: string;
     };
     forms: Array<{
       name: string;
       properties: FormProperties;
       controls: ControlDefinition[];
       eventHandlers: EventHandlerDefinition[];
       dataBindings: DataBindingDefinition[];
     }>;
   }
   ```

#### importProject
1. `importProjectSchema`로 입력 검증
2. 새 프로젝트 생성
3. 각 폼에 대해 `Form.create({ ...formData, projectId: newProject._id, createdBy: userId, updatedBy: userId })` 호출
4. 생성된 프로젝트 반환

---

## 6. API 엔드포인트 상세

파일: `packages/server/src/routes/projects.ts` (기존 스텁 교체)

### 6.1 응답 형식

기존 forms 라우터의 응답 패턴을 그대로 따른다:

```typescript
// 단일 리소스
{ data: ProjectDocument }

// 목록
{
  data: ProjectDocument[],
  meta: { total, page, limit, totalPages }
}

// 상세 (폼 목록 포함)
{
  data: {
    project: ProjectDocument,
    forms: FormDocument[]
  }
}

// 내보내기
ExportProjectData (JSON 다운로드)
```

### 6.2 엔드포인트 매핑

| 메서드 | 경로 | 핸들러 | 상태코드 | 설명 |
|--------|------|--------|----------|------|
| GET | `/api/projects` | listProjects | 200 | 프로젝트 목록 (page, limit, search) |
| POST | `/api/projects` | createProject | 201 | 새 프로젝트 생성 |
| GET | `/api/projects/:id` | getProjectDetail | 200 | 프로젝트 상세 + 폼 목록 |
| DELETE | `/api/projects/:id` | deleteProject | 204 | 프로젝트 + 하위 폼 soft delete |
| GET | `/api/projects/:id/export` | exportProject | 200 | JSON 내보내기 |
| POST | `/api/projects/import` | importProject | 201 | JSON 가져오기 |

### 6.3 라우터 핸들러

```typescript
import { Router } from 'express';
import { ProjectService } from '../services/ProjectService.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  importProjectSchema,
} from '../validators/projectValidator.js';

export const projectsRouter = Router();
const projectService = new ProjectService();

// GET /api/projects — 프로젝트 목록
projectsRouter.get('/', async (req, res, next) => {
  try {
    const query = listProjectsQuerySchema.parse(req.query);
    const { data, total } = await projectService.listProjects(query);
    const totalPages = Math.ceil(total / query.limit);
    res.json({
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects — 프로젝트 생성
projectsRouter.post('/', async (req, res, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    const project = await projectService.createProject(input, req.user!.sub);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/import — 프로젝트 가져오기 (주의: /:id 보다 먼저 선언)
projectsRouter.post('/import', async (req, res, next) => {
  try {
    const input = importProjectSchema.parse(req.body);
    const project = await projectService.importProject(input, req.user!.sub);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id — 프로젝트 상세
projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const detail = await projectService.getProjectDetail(req.params.id);
    res.json({ data: detail });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — 프로젝트 삭제
projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    await projectService.deleteProject(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/export — 프로젝트 내보내기
projectsRouter.get('/:id/export', async (req, res, next) => {
  try {
    const exportData = await projectService.exportProject(req.params.id);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.project.name}.webform.json"`);
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});
```

> **참고**: `POST /api/projects/import`를 `GET /api/projects/:id`보다 먼저 선언하여 라우트 충돌을 방지한다.

---

## 7. apiService.ts (디자이너 API 클라이언트)

파일: `packages/designer/src/services/apiService.ts`

### 7.1 기본 구조

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `API Error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
```

### 7.2 폼 관련 함수

```typescript
export const apiService = {
  // 폼 목록 조회
  async listForms(projectId?: string): Promise<{ data: FormSummary[]; meta: PaginationMeta }> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return request(`/forms${params}`);
  },

  // 폼 로드
  async loadForm(id: string): Promise<{ data: FormDocument }> {
    return request(`/forms/${id}`);
  },

  // 폼 저장 (PUT)
  async saveForm(id: string, form: UpdateFormPayload): Promise<{ data: FormDocument }> {
    return request(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    });
  },

  // 폼 생성
  async createForm(input: CreateFormPayload): Promise<{ data: FormDocument }> {
    return request('/forms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 폼 삭제
  async deleteForm(id: string): Promise<void> {
    return request(`/forms/${id}`, { method: 'DELETE' });
  },
};
```

### 7.3 프로젝트 관련 함수

```typescript
export const apiService = {
  // ... 폼 함수들 ...

  // 프로젝트 목록 조회
  async listProjects(): Promise<{ data: ProjectDocument[]; meta: PaginationMeta }> {
    return request('/projects');
  },

  // 프로젝트 상세 조회
  async getProject(id: string): Promise<{ data: { project: ProjectDocument; forms: FormSummary[] } }> {
    return request(`/projects/${id}`);
  },

  // 프로젝트 생성
  async createProject(input: CreateProjectPayload): Promise<{ data: ProjectDocument }> {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 프로젝트 삭제
  async deleteProject(id: string): Promise<void> {
    return request(`/projects/${id}`, { method: 'DELETE' });
  },

  // 프로젝트 내보내기
  async exportProject(id: string): Promise<ExportProjectData> {
    return request(`/projects/${id}/export`);
  },

  // 프로젝트 가져오기
  async importProject(data: ImportProjectPayload): Promise<{ data: ProjectDocument }> {
    return request('/projects/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
```

### 7.4 타입 정의

```typescript
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FormSummary {
  _id: string;
  name: string;
  version: number;
  status: 'draft' | 'published';
  updatedAt: string;
}

interface CreateFormPayload {
  name: string;
  projectId: string;
}

interface UpdateFormPayload {
  name?: string;
  properties?: Partial<FormProperties>;
  controls?: ControlDefinition[];
  eventHandlers?: EventHandlerDefinition[];
  dataBindings?: DataBindingDefinition[];
}

interface CreateProjectPayload {
  name: string;
  description?: string;
}

interface ImportProjectPayload {
  project: { name: string; description?: string };
  forms: Array<{
    name: string;
    properties?: Record<string, unknown>;
    controls?: unknown[];
    eventHandlers?: unknown[];
    dataBindings?: unknown[];
  }>;
}
```

---

## 8. Auto-save 훅

파일: `packages/designer/src/services/apiService.ts` (하단에 추가)

### 8.1 useAutoSave 훅

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useDesignerStore } from '../stores/designerStore';

const AUTO_SAVE_INTERVAL = 30_000; // 30초

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const isDirty = useDesignerStore((s) => s.isDirty);
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const markClean = useDesignerStore((s) => s.markClean);

  const save = useCallback(async () => {
    if (!currentFormId || !isDirty) return;

    try {
      await apiService.saveForm(currentFormId, {
        controls,
        properties: formProperties,
      });
      markClean();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentFormId, isDirty, controls, formProperties, markClean]);

  // 30초 인터벌 auto-save
  useEffect(() => {
    if (!currentFormId || !isDirty) return;

    timerRef.current = setTimeout(save, AUTO_SAVE_INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [currentFormId, isDirty, save]);

  return { save };
}
```

### 8.2 Ctrl+S 키보드 단축키

`App.tsx`에서 전역 키보드 이벤트를 등록한다:

```typescript
// App.tsx 내
const { save } = useAutoSave();

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [save]);
```

### 8.3 isDirty 상태 표시

제목 표시줄에 `*` 표시로 변경사항이 있음을 알린다:

```typescript
// App.tsx 내 메뉴바 영역
const isDirty = useDesignerStore((s) => s.isDirty);
const formName = useDesignerStore((s) => s.formProperties.title);

// 타이틀에 반영
<span>{formName}{isDirty ? ' *' : ''}</span>
```

---

## 9. ProjectExplorer 컴포넌트

파일: `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx`

### 9.1 컴포넌트 구조

```
ProjectExplorer
├── 상단 툴바 (새 프로젝트, 가져오기)
└── 트리뷰
    └── ProjectNode (각 프로젝트)
        ├── 📁 Forms/
        │   ├── 📄 MainForm.wfd
        │   └── 📄 LoginForm.wfd
        └── 📁 DataSources/
            └── 📄 MainDB.wfds
```

### 9.2 Props 및 State

```typescript
interface ProjectExplorerProps {
  onFormSelect: (formId: string) => void;
}

// 내부 상태
interface ProjectExplorerState {
  projects: ProjectWithForms[];
  expandedNodes: Set<string>;  // 펼쳐진 노드 ID
  selectedNode: string | null;  // 선택된 노드 ID
  contextMenu: {               // 우클릭 메뉴
    visible: boolean;
    x: number;
    y: number;
    targetType: 'project' | 'folder' | 'form';
    targetId: string;
  } | null;
  loading: boolean;
}

interface ProjectWithForms {
  project: ProjectDocument;
  forms: FormSummary[];
}
```

### 9.3 기능 상세

#### 트리뷰 렌더링
- 각 프로젝트 노드에 `Forms` 폴더 자동 생성
- 폴더 클릭으로 접기/펼치기
- 폼 항목에 status 아이콘 (draft: 회색, published: 초록)

#### 폼 더블클릭
1. `apiService.loadForm(formId)` 호출
2. `designerStore.loadForm(formId, form.controls, form.properties)` 호출
3. 캔버스에 폼 로드

#### 우클릭 컨텍스트 메뉴

| 대상 | 메뉴 항목 |
|------|-----------|
| 프로젝트 노드 | 새 폼, 이름 변경, 내보내기, 삭제 |
| Forms 폴더 | 새 폼 |
| 폼 항목 | 열기, 이름 변경, 삭제 |

#### 새 폼 생성
1. 프롬프트로 폼 이름 입력
2. `apiService.createForm({ name, projectId })` 호출
3. 트리뷰 새로고침
4. 생성된 폼 자동 선택 및 캔버스 로드

#### 폼/프로젝트 삭제
1. 확인 대화상자 표시
2. `apiService.deleteForm(id)` 또는 `apiService.deleteProject(id)` 호출
3. 트리뷰 새로고침

### 9.4 배럴 export

파일: `packages/designer/src/components/ProjectExplorer/index.ts`

```typescript
export { ProjectExplorer } from './ProjectExplorer';
```

---

## 10. designerStore 수정

파일: `packages/designer/src/stores/designerStore.ts`

### 10.1 추가 상태

```typescript
interface DesignerState {
  // ... 기존 상태 ...
  currentProjectId: string | null;  // 추가

  // ... 기존 메서드 ...
  setCurrentProject: (projectId: string | null) => void;  // 추가
}
```

### 10.2 구현

```typescript
// create 내부에 추가
currentProjectId: null,

setCurrentProject: (projectId) => set((state) => {
  state.currentProjectId = projectId;
}),
```

---

## 11. App.tsx 수정

파일: `packages/designer/src/App.tsx`

### 11.1 레이아웃 변경

```
┌──────────────────────────────────────────────────┐
│ 메뉴바 (FormName*, Ctrl+S)                       │
├────────┬─────────────────────────────┬───────────┤
│Project │                             │ Property  │
│Explorer│         Canvas              │ Panel     │
│(220px) │                             │ (250px)   │
│        │                             │           │
├────────┤                             │           │
│Toolbox │                             │           │
│        │                             │           │
└────────┴─────────────────────────────┴───────────┘
```

### 11.2 변경 사항

1. 좌측 패널을 상/하 분리: ProjectExplorer(상단) + Toolbox(하단)
2. 상단에 간단한 메뉴바 추가 (폼 이름 + isDirty 표시)
3. `useAutoSave` 훅 연결
4. Ctrl+S 키보드 단축키 등록

```tsx
export function App() {
  const { save } = useAutoSave();
  const isDirty = useDesignerStore((s) => s.isDirty);
  const formTitle = useDesignerStore((s) => s.formProperties.title);
  const currentFormId = useDesignerStore((s) => s.currentFormId);

  // Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  const handleFormSelect = async (formId: string) => {
    const { data } = await apiService.loadForm(formId);
    useDesignerStore.getState().loadForm(
      formId,
      data.controls,
      data.properties,
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      {/* 메뉴바 */}
      <div className="menubar">
        <span>{currentFormId ? `${formTitle}${isDirty ? ' *' : ''}` : 'WebForm Designer'}</span>
      </div>

      <div className="designer-layout">
        {/* 좌측 패널: ProjectExplorer + Toolbox */}
        <div className="left-panel">
          <ProjectExplorer onFormSelect={handleFormSelect} />
          <Toolbox />
        </div>

        {/* 캔버스 */}
        <div className="canvas-area">
          <DesignerCanvas />
        </div>

        {/* 속성 패널 */}
        <div className="properties-panel">
          Properties
        </div>
      </div>
    </DndProvider>
  );
}
```

---

## 12. 구현 순서

### Step 1: 서버 — 모델 및 검증
1. `packages/server/src/models/Project.ts` 생성 (Mongoose 스키마)
2. `packages/server/src/validators/projectValidator.ts` 생성 (Zod 스키마)

### Step 2: 서버 — 서비스
3. `packages/server/src/services/ProjectService.ts` 생성 (8개 메서드)

### Step 3: 서버 — 라우터
4. `packages/server/src/routes/projects.ts` 스텁 교체 (6개 엔드포인트)

### Step 4: 디자이너 — API 클라이언트
5. `packages/designer/src/services/apiService.ts` 생성 (폼 + 프로젝트 API)
6. `useAutoSave` 훅 포함

### Step 5: 디자이너 — Store 수정
7. `packages/designer/src/stores/designerStore.ts` 수정 (`currentProjectId` 추가)

### Step 6: 디자이너 — ProjectExplorer 컴포넌트
8. `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` 생성
9. `packages/designer/src/components/ProjectExplorer/index.ts` 생성

### Step 7: 디자이너 — App.tsx 통합
10. `packages/designer/src/App.tsx` 수정 (레이아웃, 메뉴바, 키보드 단축키)

---

## 13. 설계 결정 사항

### 13.1 프로젝트-폼 관계: 역참조 방식
- Project에 `formIds` 배열을 두지 않고, Form의 `projectId`로 역참조
- 이유: 데이터 정합성, 동시성 이슈 방지

### 13.2 프로젝트 삭제 시 하위 폼 cascade soft delete
- 프로젝트 삭제 시 해당 프로젝트의 모든 폼도 함께 soft delete
- MongoDB 트랜잭션 사용으로 원자성 보장

### 13.3 Export/Import 포맷 버전
- `exportVersion: '1.0'` 필드로 포맷 버전 관리
- 향후 포맷 변경 시 마이그레이션 로직 추가 가능

### 13.4 Auto-save 전략
- 30초 디바운스 타이머 (변경 후 30초 뒤 자동 저장)
- Ctrl+S로 즉시 저장
- 저장 성공 시 `isDirty = false`
- 저장 실패 시 `isDirty` 유지 (다음 auto-save 시 재시도)

### 13.5 ProjectExplorer 좌측 패널 배치
- Toolbox와 같은 좌측 패널에 수직 분할 배치
- ProjectExplorer 상단, Toolbox 하단
- 리사이저블 스플리터는 현 단계에서 미구현 (고정 비율)

### 13.6 Solution 계층은 현 단계에서 생략
- PRD에 Solution/Project 계층이 정의되어 있으나, 현재는 단일 Project 레벨만 구현
- 향후 멀티 프로젝트 관리 필요 시 Solution 계층 추가
