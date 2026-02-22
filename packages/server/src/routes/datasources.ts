import { Router } from 'express';

export const datasourcesRouter = Router();

// GET    /api/datasources              — 데이터소스 목록
// POST   /api/datasources              — 데이터소스 생성
// PUT    /api/datasources/:id          — 데이터소스 수정
// DELETE /api/datasources/:id          — 데이터소스 삭제
// POST   /api/datasources/:id/test     — 연결 테스트
// POST   /api/datasources/:id/query    — 쿼리 실행
