import { Router } from 'express';

export const runtimeRouter = Router();

// GET    /api/runtime/forms/:id        — 런타임용 폼 정의 (published만)
// POST   /api/runtime/forms/:id/events — 서버 이벤트 실행
// POST   /api/runtime/forms/:id/data   — 데이터 바인딩 쿼리
