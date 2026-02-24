import { Router } from 'express';
import { ProjectService } from '../services/ProjectService.js';
import {
  createProjectSchema,
  updateProjectSchema,
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

// POST /api/projects/import — 프로젝트 가져오기 (/:id 보다 먼저 선언)
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

// PUT /api/projects/:id/font — 프로젝트 전체 폼 폰트 일괄 적용
projectsRouter.put('/:id/font', async (req, res, next) => {
  try {
    const font = req.body.font as {
      family: string; size: number; bold: boolean;
      italic: boolean; underline: boolean; strikethrough: boolean;
    };
    if (!font || !font.family || typeof font.size !== 'number') {
      res.status(400).json({ error: { message: 'font object is required with family and size' } });
      return;
    }
    const modifiedCount = await projectService.applyFontToAllForms(
      req.params.id,
      font,
      req.user!.sub,
    );
    res.json({ success: true, modifiedCount });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id — 프로젝트 업데이트
projectsRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateProjectSchema.parse(req.body);
    const project = await projectService.updateProject(req.params.id, input, req.user!.sub);
    res.json({ data: project });
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

// POST /api/projects/:id/publish-all — 프로젝트 전체 퍼블리시
projectsRouter.post('/:id/publish-all', async (req, res, next) => {
  try {
    const result = await projectService.publishAll(req.params.id, req.user!.sub);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
