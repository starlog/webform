# 폼 CRUD API 구현 계획

## 1. 개요

PRD 섹션 6.1(핵심 API 엔드포인트)과 4.3.3(버전 관리 및 배포)을 기반으로 폼 CRUD API를 구현한다.

**의존성**: `common-types-commit`, `server-foundation-commit` (완료됨)

**생성/수정 파일**:
| 파일 | 역할 |
|------|------|
| `packages/server/src/models/Form.ts` | Mongoose 스키마 확장 (versions, deletedAt) |
| `packages/server/src/services/FormService.ts` | 비즈니스 로직 |
| `packages/server/src/validators/formValidator.ts` | Zod 검증 스키마 |
| `packages/server/src/routes/forms.ts` | Express 라우터 핸들러 |

---

## 2. MongoDB 스키마 수정

### 2.1 FormDocument 인터페이스 확장

기존 `packages/server/src/models/Form.ts`의 `FormDocument`에 다음을 추가한다:

```typescript
export interface FormVersionSnapshot {
  version: number;
  snapshot: {
    name: string;
    properties: FormProperties;
    controls: ControlDefinition[];
    eventHandlers: EventHandlerDefinition[];
    dataBindings: DataBindingDefinition[];
  };
  savedAt: Date;
}

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
  versions: FormVersionSnapshot[];      // 추가: 버전 히스토리
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;              // 추가: soft delete
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Mongoose 스키마 수정

```typescript
const formVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// formSchema에 추가
versions: { type: [formVersionSchema], default: [] },
deletedAt: { type: Date, default: null },
```

### 2.3 인덱스 추가

```typescript
formSchema.index({ projectId: 1, deletedAt: 1 });
formSchema.index({ status: 1 });
formSchema.index({ name: 'text' });                 // 텍스트 검색용
formSchema.index({ createdAt: -1 });
```

---

## 3. Zod 검증 스키마

파일: `packages/server/src/validators/formValidator.ts`

### 3.1 createFormSchema

```typescript
import { z } from 'zod';
import { CONTROL_TYPES } from '@webform/common';

const fontSchema = z.object({
  family: z.string().default('Segoe UI'),
  size: z.number().positive().default(9),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strikethrough: z.boolean().default(false),
});

const formPropertiesSchema = z.object({
  title: z.string().default(''),
  width: z.number().positive().default(800),
  height: z.number().positive().default(600),
  backgroundColor: z.string().default('#FFFFFF'),
  font: fontSchema.default({}),
  startPosition: z.enum(['CenterScreen', 'Manual', 'CenterParent']).default('CenterScreen'),
  formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).default('Sizable'),
  maximizeBox: z.boolean().default(true),
  minimizeBox: z.boolean().default(true),
});

const anchorStyleSchema = z.object({
  top: z.boolean().default(true),
  bottom: z.boolean().default(false),
  left: z.boolean().default(true),
  right: z.boolean().default(false),
});

const controlDefinitionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.enum(CONTROL_TYPES as unknown as [string, ...string[]]),
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ width: z.number().positive(), height: z.number().positive() }),
    children: z.array(controlDefinitionSchema).optional(),
    anchor: anchorStyleSchema.default({}),
    dock: z.enum(['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill']).default('None'),
    tabIndex: z.number().int().nonneg().default(0),
    visible: z.boolean().default(true),
    enabled: z.boolean().default(true),
  }),
);

const eventHandlerSchema = z.object({
  controlId: z.string().min(1),
  eventName: z.string().min(1),
  handlerType: z.enum(['server', 'client']),
  handlerCode: z.string(),
});

const dataBindingSchema = z.object({
  controlId: z.string().min(1),
  controlProperty: z.string().min(1),
  dataSourceId: z.string().min(1),
  dataField: z.union([z.string(), z.record(z.unknown())]),
  bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']),
});

export const createFormSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().min(1),
  properties: formPropertiesSchema.default({}),
  controls: z.array(controlDefinitionSchema).default([]),
  eventHandlers: z.array(eventHandlerSchema).default([]),
  dataBindings: z.array(dataBindingSchema).default([]),
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
```

### 3.2 updateFormSchema

```typescript
export const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  properties: formPropertiesSchema.partial().optional(),
  controls: z.array(controlDefinitionSchema).optional(),
  eventHandlers: z.array(eventHandlerSchema).optional(),
  dataBindings: z.array(dataBindingSchema).optional(),
});

export type UpdateFormInput = z.infer<typeof updateFormSchema>;
```

### 3.3 쿼리 파라미터 스키마

```typescript
export const listFormsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  projectId: z.string().optional(),
});
```

---

## 4. FormService 메서드

파일: `packages/server/src/services/FormService.ts`

### 4.1 클래스 구조

```typescript
export class FormService {
  // 새 폼 생성 (status: 'draft', version: 1)
  async createForm(input: CreateFormInput, userId: string): Promise<FormDocument>

  // 단일 폼 조회 (deletedAt이 null인 것만)
  async getForm(id: string): Promise<FormDocument>

  // 폼 목록 조회 (페이지네이션, 검색, 필터)
  async listForms(query: ListFormsQuery): Promise<{ data: FormDocument[]; total: number }>

  // 폼 수정 (version 자동 증가 + 이전 스냅샷을 versions에 push)
  async updateForm(id: string, input: UpdateFormInput, userId: string): Promise<FormDocument>

  // Soft delete (deletedAt = new Date())
  async deleteForm(id: string): Promise<void>

  // 버전 히스토리 조회
  async getVersions(id: string): Promise<FormVersionSnapshot[]>

  // Draft → Published 전환 (publishedVersion 설정)
  async publishForm(id: string, userId: string): Promise<FormDocument>
}
```

### 4.2 메서드 상세

#### createForm
1. `createFormSchema`로 입력 검증
2. `version: 1`, `status: 'draft'` 설정
3. `createdBy`, `updatedBy`에 userId 설정
4. `versions: []` (초기 버전 히스토리 비어있음)
5. MongoDB에 저장 후 반환

#### getForm
1. `Form.findOne({ _id: id, deletedAt: null })` 조회
2. 없으면 `NotFoundError` throw

#### listForms
1. `listFormsQuerySchema`로 쿼리 검증
2. 기본 필터: `{ deletedAt: null }`
3. `status` 있으면 필터에 추가
4. `projectId` 있으면 필터에 추가
5. `search` 있으면 `{ name: { $regex: search, $options: 'i' } }` 필터 추가
6. `Form.find(filter).sort({ updatedAt: -1 }).skip((page-1)*limit).limit(limit)`
7. `Form.countDocuments(filter)`로 total 계산
8. `versions` 필드는 목록에서 제외 (select: `-versions`)

#### updateForm
1. `updateFormSchema`로 입력 검증
2. `getForm(id)`으로 기존 폼 조회
3. 현재 상태를 스냅샷으로 저장:
   ```typescript
   const snapshot: FormVersionSnapshot = {
     version: existingForm.version,
     snapshot: {
       name: existingForm.name,
       properties: existingForm.properties,
       controls: existingForm.controls,
       eventHandlers: existingForm.eventHandlers,
       dataBindings: existingForm.dataBindings,
     },
     savedAt: new Date(),
   };
   ```
4. `$push: { versions: snapshot }` + 변경 필드 업데이트 + `$inc: { version: 1 }`
5. `updatedBy`를 userId로 설정
6. published 상태였으면 `status: 'draft'`로 변경 (수정 시 자동으로 draft 복귀)

#### deleteForm
1. `getForm(id)`으로 존재 확인
2. `Form.updateOne({ _id: id }, { $set: { deletedAt: new Date() } })`

#### getVersions
1. `getForm(id)`으로 존재 확인
2. `form.versions`를 `savedAt` 내림차순으로 정렬하여 반환

#### publishForm
1. `getForm(id)`으로 존재 확인
2. `status === 'published'`이면 이미 published 에러
3. `Form.findByIdAndUpdate(id, { $set: { status: 'published', publishedVersion: form.version, updatedBy: userId } }, { new: true })`

---

## 5. API 엔드포인트 상세

파일: `packages/server/src/routes/forms.ts`

### 5.1 응답 형식

```typescript
// 단일 리소스
{ data: FormDocument }

// 목록
{
  data: FormDocument[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}

// 에러 (기존 errorHandler 활용)
{
  error: {
    message: string,
    requestId: string,
    details?: any  // ZodError 시
  }
}
```

### 5.2 엔드포인트 매핑

| 메서드 | 경로 | 핸들러 | 설명 |
|--------|------|--------|------|
| GET | `/api/forms` | listForms | 폼 목록 (page, limit, search, status, projectId) |
| POST | `/api/forms` | createForm | 새 폼 생성 |
| GET | `/api/forms/:id` | getForm | 단일 폼 조회 |
| PUT | `/api/forms/:id` | updateForm | 폼 수정 (버전 자동 증가) |
| DELETE | `/api/forms/:id` | deleteForm | Soft delete |
| GET | `/api/forms/:id/versions` | getVersions | 버전 히스토리 |
| POST | `/api/forms/:id/publish` | publishForm | draft → published |

### 5.3 라우터 핸들러 패턴

```typescript
import { Router } from 'express';
import { FormService } from '../services/FormService.js';
import { createFormSchema, updateFormSchema, listFormsQuerySchema } from '../validators/formValidator.js';

export const formsRouter = Router();
const formService = new FormService();

// GET /api/forms
formsRouter.get('/', async (req, res, next) => {
  try {
    const query = listFormsQuerySchema.parse(req.query);
    const { data, total } = await formService.listForms(query);
    const totalPages = Math.ceil(total / query.limit);
    res.json({
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/forms
formsRouter.post('/', async (req, res, next) => {
  try {
    const input = createFormSchema.parse(req.body);
    const form = await formService.createForm(input, req.user!.sub);
    res.status(201).json({ data: form });
  } catch (err) {
    next(err);
  }
});

// GET /api/forms/:id
formsRouter.get('/:id', async (req, res, next) => {
  try {
    const form = await formService.getForm(req.params.id);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});

// PUT /api/forms/:id
formsRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateFormSchema.parse(req.body);
    const form = await formService.updateForm(req.params.id, input, req.user!.sub);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forms/:id
formsRouter.delete('/:id', async (req, res, next) => {
  try {
    await formService.deleteForm(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/forms/:id/versions
formsRouter.get('/:id/versions', async (req, res, next) => {
  try {
    const versions = await formService.getVersions(req.params.id);
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/forms/:id/publish
formsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const form = await formService.publishForm(req.params.id, req.user!.sub);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});
```

---

## 6. 구현 순서

### Step 1: Mongoose 모델 확장
- `FormDocument`에 `versions`, `deletedAt` 추가
- `FormVersionSnapshot` 인터페이스 추가
- Mongoose 스키마에 `formVersionSchema`, `deletedAt` 필드 추가
- 인덱스 추가

### Step 2: Zod 검증 스키마 생성
- `packages/server/src/validators/formValidator.ts` 신규 생성
- `createFormSchema`, `updateFormSchema`, `listFormsQuerySchema` 정의

### Step 3: FormService 구현
- `packages/server/src/services/FormService.ts` 신규 생성
- 7개 메서드 구현 (createForm, getForm, listForms, updateForm, deleteForm, getVersions, publishForm)

### Step 4: 라우터 핸들러 구현
- `packages/server/src/routes/forms.ts` 기존 스텁 교체
- 7개 엔드포인트 핸들러 연결

---

## 7. 설계 결정 사항

### 7.1 버전 관리 전략
- **임베디드 배열 방식**: `versions` 필드를 FormDocument 내에 배열로 저장
- 이유: 폼 정의가 크지 않고, 버전 수가 제한적이며, 조회 시 별도 쿼리 불필요
- 버전 스냅샷에는 `name`, `properties`, `controls`, `eventHandlers`, `dataBindings`만 포함 (메타데이터 제외)

### 7.2 Soft Delete
- `deletedAt: Date | null` 필드 사용
- 모든 조회 쿼리에 `{ deletedAt: null }` 필터 자동 적용
- 복구 API는 현 단계에서 미구현 (추후 관리자 기능으로 추가 가능)

### 7.3 수정 시 자동 draft 복귀
- published 상태의 폼을 수정하면 자동으로 `status: 'draft'`로 변경
- 런타임은 `publishedVersion`에 해당하는 버전을 계속 서빙 (후속 runtime API에서 처리)

### 7.4 검색
- `name` 필드에 대한 regex 검색 (대소문자 무시)
- MongoDB text index를 추가하되, 현재는 `$regex` 사용 (데이터 규모가 작으므로 충분)

### 7.5 목록 조회 최적화
- `versions` 필드는 대용량이므로 목록 조회 시 `-versions` select로 제외
- `updatedAt` 내림차순 정렬 (최근 수정순)
