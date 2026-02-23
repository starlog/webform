# 서버 Shell 백엔드 (모델/서비스/라우트) 구현 계획

> Task ID: `server-shell-backend-plan`
> Phase: phase2-server-backend
> 의존: common-types-commit (완료)

---

## 1. 현재 Mongoose 모델 패턴

### 1.1 Form 모델 (models/Form.ts)

```typescript
// Document 인터페이스 정의
export interface FormDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  version: number;
  projectId: string;
  status: 'draft' | 'published';
  publishedVersion?: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
  versions: FormVersionSnapshot[];
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Schema 정의
const formSchema = new Schema({ ... }, { timestamps: true });

// 인덱스 별도 선언
formSchema.index({ projectId: 1, deletedAt: 1 });
formSchema.index({ status: 1 });

// 모델 export
export const Form = mongoose.model<FormDocument>('Form', formSchema);
```

**패턴 요약:**
- Document 인터페이스를 별도 export (서비스에서 반환 타입으로 사용)
- Schema는 `{ timestamps: true }` 옵션으로 createdAt/updatedAt 자동 관리
- Soft delete: `deletedAt` 필드 (null이면 존재, Date이면 삭제됨)
- `projectId`는 String 타입 (ObjectId가 아닌 String으로 저장)
- `.index()` 메서드로 인덱스 별도 선언

### 1.2 Project 모델 (models/Project.ts)

```typescript
export interface ProjectDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  defaultFont?: ProjectDefaultFont;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema({ ... }, { timestamps: true });
projectSchema.index({ deletedAt: 1 });
export const Project = mongoose.model<ProjectDocument>('Project', projectSchema);
```

**패턴 요약:**
- Form과 동일한 Document 인터페이스 + Schema + Model export 패턴
- Soft delete 동일 패턴

---

## 2. 현재 서비스 패턴

### 2.1 FormService (services/FormService.ts)

```typescript
export class FormService {
  async createForm(input: CreateFormInput, userId: string): Promise<FormDocument> { ... }
  async getForm(id: string): Promise<FormDocument> { ... }
  async updateForm(id: string, input: UpdateFormInput, userId: string): Promise<FormDocument> { ... }
  async deleteForm(id: string): Promise<void> { ... }
  async publishForm(id: string, userId: string): Promise<FormDocument> { ... }
}
```

**패턴 요약:**
- 클래스 기반 서비스 (인스턴스 생성하여 사용)
- 에러 처리: `NotFoundError` (404), `AppError` (커스텀 상태코드)
- 반환 타입: `Document.toObject() as FormDocument`
- 조회 시 `{ deletedAt: null }` 필터로 soft delete 적용
- 삭제: `deletedAt` 필드를 현재 시간으로 설정

### 2.2 ProjectService (services/ProjectService.ts)

```typescript
export class ProjectService {
  async createProject(input, userId): Promise<ProjectDocument> { ... }
  async getProject(id): Promise<ProjectDocument> { ... }
  async updateProject(id, input, userId): Promise<ProjectDocument> { ... }
  async deleteProject(id): Promise<void> { ... }
}
```

**패턴 요약:**
- FormService와 동일한 클래스 기반 패턴
- `deleteProject` 시 관련 Form도 함께 soft delete
- `findOneAndUpdate` 사용 시 `{ new: true }` 옵션으로 갱신된 문서 반환

---

## 3. 현재 라우트 패턴

### 3.1 forms.ts / projects.ts 라우트 패턴

```typescript
export const formsRouter = Router();
const formService = new FormService();

formsRouter.get('/', async (req, res, next) => {
  try {
    // Zod 스키마로 입력 검증
    const query = listFormsQuerySchema.parse(req.query);
    // 서비스 호출
    const { data, total } = await formService.listForms(query);
    // 응답: { data, meta } 또는 { data }
    res.json({ data, meta: { total, page, limit, totalPages } });
  } catch (err) {
    next(err);  // errorHandler 미들웨어로 전달
  }
});
```

**패턴 요약:**
- `Router()` 생성 후 export
- 서비스 인스턴스를 모듈 레벨에서 생성
- try/catch + `next(err)` 패턴으로 에러 전파
- Zod 스키마로 req.body/req.query 검증
- 응답 형식:
  - 단일: `{ data: object }`
  - 목록: `{ data: array, meta: { total, page, limit, totalPages } }`
  - 생성: `res.status(201).json({ data })`
  - 삭제: `res.status(204).end()`
- `req.user!.sub`로 사용자 ID 접근 (JWT 인증 후)

### 3.2 라우트 등록 (routes/index.ts)

```typescript
export const apiRouter = Router();

// 공개 라우트
apiRouter.use('/runtime', runtimeRouter);
apiRouter.use('/debug', debugRouter);

// JWT 인증 필요 라우트
apiRouter.use(authenticate);
apiRouter.use('/forms', formsRouter);
apiRouter.use('/projects', projectsRouter);
```

**패턴 요약:**
- `authenticate` 미들웨어 이후에 등록된 라우트는 JWT 인증 필요
- Shell 라우트는 프로젝트 하위이므로 인증 필요 영역에 등록

---

## 4. Shell.ts Mongoose 모델 코드 초안

```typescript
import mongoose, { Schema } from 'mongoose';
import type {
  ControlDefinition,
  EventHandlerDefinition,
  ShellProperties,
} from '@webform/common';

export interface ShellDocument {
  _id: mongoose.Types.ObjectId;
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
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shellSchema = new Schema(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    properties: { type: Schema.Types.Mixed, required: true },
    controls: { type: [Schema.Types.Mixed], default: [] },
    eventHandlers: { type: [Schema.Types.Mixed], default: [] },
    startFormId: { type: String, default: undefined },
    published: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

shellSchema.index({ projectId: 1, deletedAt: 1 });
shellSchema.index({ published: 1 });

export const Shell = mongoose.model<ShellDocument>('Shell', shellSchema);
```

### 4.1 설계 근거

1. **projectId를 String으로 저장**: Form 모델과 동일 패턴. `ref: 'Project'`는 populate가 불필요하므로 생략.
2. **properties를 Mixed로**: ShellProperties 구조가 복잡하고 확장 가능성이 있으므로 Mixed 사용 (Form과 달리 개별 필드 스키마를 정의하지 않음). Task 명세에서 `{ type: Mixed, required: true }`로 지정.
3. **controls/eventHandlers를 Mixed 배열로**: 기존 Form의 eventHandlers, dataBindings와 동일 패턴.
4. **startFormId를 String으로**: Form._id가 ObjectId이지만, 기존 코드에서 projectId를 String으로 저장하는 패턴을 따름.
5. **Soft delete**: `deletedAt` 필드 추가 (기존 패턴 일관성).
6. **프로젝트당 1개 Shell**: 비즈니스 로직에서 enforced (모델 레벨 unique index는 사용하지 않음 — soft delete된 Shell이 있을 수 있으므로 서비스에서 처리).

---

## 5. ShellService.ts 서비스 코드 초안

```typescript
import { Shell } from '../models/Shell.js';
import type { ShellDocument } from '../models/Shell.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

export interface CreateShellInput {
  name: string;
  properties: Record<string, unknown>;
  controls?: unknown[];
  eventHandlers?: unknown[];
  startFormId?: string;
}

export interface UpdateShellInput {
  name?: string;
  properties?: Record<string, unknown>;
  controls?: unknown[];
  eventHandlers?: unknown[];
  startFormId?: string | null;
}

export class ShellService {
  /**
   * 프로젝트의 Shell 조회 (soft delete 제외)
   */
  async getShellByProjectId(projectId: string): Promise<ShellDocument> {
    const shell = await Shell.findOne({ projectId, deletedAt: null });
    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }
    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 생성 (프로젝트당 하나만 허용)
   */
  async createShell(
    projectId: string,
    data: CreateShellInput,
    userId: string,
  ): Promise<ShellDocument> {
    const existing = await Shell.findOne({ projectId, deletedAt: null });
    if (existing) {
      throw new AppError(409, `Shell already exists for project: ${projectId}`);
    }

    const shell = await Shell.create({
      ...data,
      projectId,
      version: 1,
      published: false,
      createdBy: userId,
      updatedBy: userId,
    });
    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 수정
   */
  async updateShell(
    projectId: string,
    data: UpdateShellInput,
    userId: string,
  ): Promise<ShellDocument> {
    await this.getShellByProjectId(projectId);

    const { startFormId, ...rest } = data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      $set: { ...rest, updatedBy: userId },
      $inc: { version: 1 },
    };

    // startFormId가 null이면 필드 제거, 값이 있으면 설정
    if (startFormId === null) {
      update.$unset = { startFormId: 1 };
    } else if (startFormId !== undefined) {
      update.$set.startFormId = startFormId;
    }

    // 퍼블리시 상태에서 수정 시 unpublish
    update.$set.published = false;

    const shell = await Shell.findOneAndUpdate(
      { projectId, deletedAt: null },
      update,
      { new: true },
    );

    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }

    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 삭제 (soft delete)
   */
  async deleteShell(projectId: string): Promise<void> {
    await this.getShellByProjectId(projectId);
    await Shell.updateOne(
      { projectId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
  }

  /**
   * Shell 퍼블리시 (published = true)
   */
  async publishShell(projectId: string, userId: string): Promise<ShellDocument> {
    const existing = await this.getShellByProjectId(projectId);

    if (existing.published) {
      throw new AppError(409, 'Shell is already published');
    }

    const shell = await Shell.findOneAndUpdate(
      { projectId, deletedAt: null },
      {
        $set: {
          published: true,
          updatedBy: userId,
        },
      },
      { new: true },
    );

    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }

    return shell.toObject() as ShellDocument;
  }

  /**
   * 퍼블리시된 Shell 조회 (Runtime용 — 없으면 null 반환)
   */
  async getPublishedShell(projectId: string): Promise<ShellDocument | null> {
    const shell = await Shell.findOne({ projectId, published: true, deletedAt: null });
    if (!shell) {
      return null;
    }
    return shell.toObject() as ShellDocument;
  }
}
```

### 5.1 설계 근거

1. **프로젝트당 1개 제약**: `createShell`에서 기존 Shell 존재 여부를 확인하고 409 반환.
2. **updateShell에서 자동 unpublish**: Form과 유사하게, 수정 시 published를 false로 변경. 재퍼블리시 필요.
3. **getPublishedShell은 null 반환 가능**: Runtime에서 Shell이 없는 프로젝트도 있을 수 있으므로 null 허용 (NotFoundError 대신).
4. **publishShell에서 이중 퍼블리시 방지**: Form의 publishForm과 동일한 409 패턴.
5. **startFormId null 처리**: `null`이면 `$unset`으로 필드 제거 (ProjectService의 defaultFont null 처리 패턴 참조).

---

## 6. shells.ts 라우트 코드 초안

```typescript
import { Router } from 'express';
import { ShellService } from '../services/ShellService.js';
import { z } from 'zod';

export const shellsRouter = Router({ mergeParams: true });
const shellService = new ShellService();

const shellPropertiesSchema = z.object({
  title: z.string().default(''),
  width: z.number().positive().default(1024),
  height: z.number().positive().default(768),
  backgroundColor: z.string().default('#FFFFFF'),
  font: z
    .object({
      family: z.string().default('Segoe UI'),
      size: z.number().positive().default(9),
      bold: z.boolean().default(false),
      italic: z.boolean().default(false),
      underline: z.boolean().default(false),
      strikethrough: z.boolean().default(false),
    })
    .default({}),
  showTitleBar: z.boolean().default(true),
  formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).default('Sizable'),
  maximizeBox: z.boolean().default(true),
  minimizeBox: z.boolean().default(true),
});

const createShellSchema = z.object({
  name: z.string().min(1).max(200),
  properties: shellPropertiesSchema.default({}),
  controls: z.array(z.unknown()).default([]),
  eventHandlers: z.array(z.unknown()).default([]),
  startFormId: z.string().optional(),
});

const updateShellSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  properties: shellPropertiesSchema.partial().optional(),
  controls: z.array(z.unknown()).optional(),
  eventHandlers: z.array(z.unknown()).optional(),
  startFormId: z.string().optional().nullable(),
});

// GET /api/projects/:projectId/shell — Shell 조회
shellsRouter.get('/', async (req, res, next) => {
  try {
    const shell = await shellService.getShellByProjectId(req.params.projectId);
    res.json({ data: shell });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/shell — Shell 생성
shellsRouter.post('/', async (req, res, next) => {
  try {
    const input = createShellSchema.parse(req.body);
    const shell = await shellService.createShell(
      req.params.projectId,
      input,
      req.user!.sub,
    );
    res.status(201).json({ data: shell });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/shell — Shell 수정
shellsRouter.put('/', async (req, res, next) => {
  try {
    const input = updateShellSchema.parse(req.body);
    const shell = await shellService.updateShell(
      req.params.projectId,
      input,
      req.user!.sub,
    );
    res.json({ data: shell });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/shell — Shell 삭제
shellsRouter.delete('/', async (req, res, next) => {
  try {
    await shellService.deleteShell(req.params.projectId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/shell/publish — Shell 퍼블리시
shellsRouter.post('/publish', async (req, res, next) => {
  try {
    const shell = await shellService.publishShell(
      req.params.projectId,
      req.user!.sub,
    );
    res.json({ data: shell });
  } catch (err) {
    next(err);
  }
});
```

### 6.1 설계 근거

1. **`Router({ mergeParams: true })`**: 부모 라우터(`/api/projects/:projectId`)의 `projectId` 파라미터를 접근하기 위해 필요.
2. **Zod 검증 인라인 정의**: 별도 validator 파일을 만들어도 되지만, Shell 라우트만 사용하므로 라우트 파일에 인라인. (향후 분리 가능)
3. **Shell 기본 크기 1024x768**: Form(800x600)보다 크게 설정 — Shell은 앱 전체 프레임이므로.
4. **API 경로가 단수(shell)**: 프로젝트당 하나이므로 `/shell` (복수가 아님).

---

## 7. 기존 파일 변경 사항

### 7.1 routes/index.ts — shells 라우트 등록

```diff
 import { Router } from 'express';
 import { authenticate } from '../middleware/auth.js';
 import { formsRouter } from './forms.js';
 import { runtimeRouter } from './runtime.js';
 import { datasourcesRouter } from './datasources.js';
 import { projectsRouter } from './projects.js';
 import { debugRouter } from './debug.js';
+import { shellsRouter } from './shells.js';

 export const apiRouter = Router();

 // 런타임 라우트는 공개 (published 폼만 반환)
 apiRouter.use('/runtime', runtimeRouter);

 // 디버그 라우트 (development 환경에서만 동작, 라우터 내부에서 production 차단)
 apiRouter.use('/debug', debugRouter);

 // 나머지 라우트는 JWT 인증 필요
 apiRouter.use(authenticate);
 apiRouter.use('/forms', formsRouter);
 apiRouter.use('/datasources', datasourcesRouter);
 apiRouter.use('/projects', projectsRouter);
+apiRouter.use('/projects/:projectId/shell', shellsRouter);
```

**주의**: `shellsRouter`는 `Router({ mergeParams: true })`로 생성하여 `:projectId` 파라미터를 접근할 수 있다.

### 7.2 routes/projects.ts — shellId 필드 추가 고려

Task 명세에서 Project 스키마에 `shellId?: ObjectId` 필드를 추가하라고 했으나, Shell이 `projectId`를 기반으로 조회되므로 역방향 참조(`shellId`)가 실질적으로 필요한지 검토:

- Shell은 항상 `projectId`로 조회 → `shellService.getShellByProjectId(projectId)` 사용
- Project → Shell 역방향 참조는 편의를 위한 것

**결론**: 구현하되, 현 단계에서는 모델/인터페이스에만 추가하고 비즈니스 로직에서 자동 설정은 Shell 생성/삭제 시 처리한다.

### 7.3 models/Project.ts — shellId 필드 추가

```diff
 export interface ProjectDocument {
   _id: mongoose.Types.ObjectId;
   name: string;
   description: string;
   defaultFont?: ProjectDefaultFont;
+  shellId?: mongoose.Types.ObjectId;
   createdBy: string;
   updatedBy: string;
   deletedAt?: Date | null;
   createdAt: Date;
   updatedAt: Date;
 }

 const projectSchema = new Schema(
   {
     name: { type: String, required: true },
     description: { type: String, default: '' },
     defaultFont: {
       type: { ... },
       default: undefined,
       _id: false,
     },
+    shellId: { type: Schema.Types.ObjectId, ref: 'Shell', default: undefined },
     deletedAt: { type: Date, default: null },
     createdBy: { type: String, required: true },
     updatedBy: { type: String, required: true },
   },
   { timestamps: true },
 );
```

---

## 8. 변경 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `packages/server/src/models/Shell.ts` | **신규** | Shell Mongoose 모델/스키마 |
| `packages/server/src/services/ShellService.ts` | **신규** | Shell CRUD + publish 서비스 |
| `packages/server/src/routes/shells.ts` | **신규** | Shell REST API 라우트 (Zod 검증 포함) |
| `packages/server/src/routes/index.ts` | **수정** | shellsRouter import 및 등록 |
| `packages/server/src/models/Project.ts` | **수정** | shellId 필드 추가 |

---

## 9. 구현 순서

1. `packages/server/src/models/Shell.ts` — Mongoose 모델 생성
2. `packages/server/src/models/Project.ts` — shellId 필드 추가
3. `packages/server/src/services/ShellService.ts` — 서비스 로직 구현
4. `packages/server/src/routes/shells.ts` — API 라우트 구현
5. `packages/server/src/routes/index.ts` — 라우트 등록
6. TypeScript 타입 체크 (`pnpm --filter @webform/server typecheck`)

---

## 10. 주의사항

1. **@webform/common 의존성**: `ShellProperties`, `ControlDefinition`, `EventHandlerDefinition` 타입은 common 패키지에서 import. 이미 common-types-commit에서 구현 완료.
2. **프로젝트당 Shell 1개 제약**: DB unique index가 아닌 서비스 로직에서 처리 (soft delete 시나리오 때문).
3. **인증**: Shell 라우트는 `authenticate` 미들웨어 이후에 등록되므로 JWT 인증 필수.
4. **Shell 수정 시 자동 unpublish**: Form과 일관된 동작. 수정 후 재퍼블리시 필요.
5. **getPublishedShell의 null 반환**: Runtime API에서 Shell이 없는 프로젝트도 허용해야 하므로 NotFoundError 대신 null 반환.
