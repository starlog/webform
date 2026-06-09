import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { formsRouter } from './forms.js';
import { runtimeRouter } from './runtime.js';
import { projectsRouter } from './projects.js';
import { debugRouter } from './debug.js';
import { shellsRouter } from './shells.js';
import { themesRouter } from './themes.js';
import { swaggerRouter } from './swagger.js';

export const apiRouter = Router();

// 런타임 라우트는 공개 (published 폼만 반환)
apiRouter.use('/runtime', runtimeRouter);

// 디버그 라우트 (development 환경에서만 동작, 라우터 내부에서 production 차단)
apiRouter.use('/debug', debugRouter);

// 나머지 라우트는 JWT 인증 + 디자이너 권한 필요
// (런타임 사용자 토큰으로 디자이너 API 접근 차단)
apiRouter.use(authenticate);
apiRouter.use(requireRole('admin', 'internal'));
apiRouter.use('/swagger', swaggerRouter);
apiRouter.use('/forms', formsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/projects/:projectId/shell', shellsRouter);
apiRouter.use('/themes', themesRouter);
