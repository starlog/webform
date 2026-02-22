import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { formsRouter } from './forms.js';
import { runtimeRouter } from './runtime.js';
import { datasourcesRouter } from './datasources.js';
import { projectsRouter } from './projects.js';

export const apiRouter = Router();

// 모든 /api/* 라우트에 JWT 인증 적용
apiRouter.use(authenticate);

apiRouter.use('/forms', formsRouter);
apiRouter.use('/runtime', runtimeRouter);
apiRouter.use('/datasources', datasourcesRouter);
apiRouter.use('/projects', projectsRouter);
