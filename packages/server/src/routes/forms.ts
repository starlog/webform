import { Router } from 'express';
import { FormService } from '../services/FormService.js';
import { ProjectService } from '../services/ProjectService.js';
import { createFormSchema, updateFormSchema, listFormsQuerySchema } from '../validators/formValidator.js';

export const formsRouter = Router();
const formService = new FormService();
const projectService = new ProjectService();

// GET /api/forms — 폼 목록 조회
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

// POST /api/forms — 새 폼 생성
formsRouter.post('/', async (req, res, next) => {
  try {
    const input = createFormSchema.parse(req.body);

    // 프로젝트 기본 폰트가 설정되어 있으면 폼 속성에 적용
    if (input.projectId) {
      try {
        const project = await projectService.getProject(input.projectId);
        if (project.defaultFont) {
          input.properties = {
            ...input.properties,
            font: project.defaultFont,
          };
        }
      } catch {
        // 프로젝트 조회 실패 시 무시 (기본 폰트 없이 생성)
      }
    }

    const form = await formService.createForm(input, req.user!.sub);
    res.status(201).json({ data: form });
  } catch (err) {
    next(err);
  }
});

// GET /api/forms/:id — 폼 정의 조회
formsRouter.get('/:id', async (req, res, next) => {
  try {
    const form = await formService.getForm(req.params.id);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});

// PUT /api/forms/:id — 폼 정의 수정
formsRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateFormSchema.parse(req.body);
    const form = await formService.updateForm(req.params.id, input, req.user!.sub);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forms/:id — 폼 삭제
formsRouter.delete('/:id', async (req, res, next) => {
  try {
    await formService.deleteForm(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/forms/:id/versions — 버전 히스토리
formsRouter.get('/:id/versions', async (req, res, next) => {
  try {
    const versions = await formService.getVersions(req.params.id);
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/forms/:id/publish — 폼 퍼블리시
formsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const form = await formService.publishForm(req.params.id, req.user!.sub);
    res.json({ data: form });
  } catch (err) {
    next(err);
  }
});
