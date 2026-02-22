import { Router } from 'express';

export const formsRouter = Router();

// GET    /api/forms            — 폼 목록 조회
formsRouter.get('/', (_req, res) => {
  res.json([]);
});

// POST   /api/forms            — 새 폼 생성
// GET    /api/forms/:id        — 폼 정의 조회
// PUT    /api/forms/:id        — 폼 정의 수정
// DELETE /api/forms/:id        — 폼 삭제
// GET    /api/forms/:id/versions   — 버전 히스토리
// POST   /api/forms/:id/publish    — 폼 퍼블리시
