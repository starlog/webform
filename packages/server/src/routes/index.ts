import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { formsRouter } from './forms.js';
import { runtimeRouter } from './runtime.js';
import { datasourcesRouter } from './datasources.js';
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

// Swagger 테스트 프록시 (디자이너에서 API 테스트용, 인증 전에 배치)
apiRouter.use('/swagger', swaggerRouter);

// 데이터소스 dialect 목록은 공개 (인증 불필요)
import { adapterRegistry } from '../services/adapters/index.js';
apiRouter.get('/datasources/dialects', (_req, res) => {
  res.json({ data: adapterRegistry.listDialects() });
});

// 나머지 라우트는 JWT 인증 필요
apiRouter.use(authenticate);
apiRouter.use('/forms', formsRouter);
apiRouter.use('/datasources', datasourcesRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/projects/:projectId/shell', shellsRouter);
apiRouter.use('/themes', themesRouter);
