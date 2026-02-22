import { Router } from 'express';

export const projectsRouter = Router();

// GET    /api/projects            — 프로젝트 목록
// POST   /api/projects            — 프로젝트 생성
// GET    /api/projects/:id        — 프로젝트 상세
// DELETE /api/projects/:id        — 프로젝트 삭제
// GET    /api/projects/:id/export — 프로젝트 내보내기
// POST   /api/projects/import     — 프로젝트 가져오기
