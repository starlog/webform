import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { formsRouter } from './forms.js';
import { runtimeRouter } from './runtime.js';
import { datasourcesRouter } from './datasources.js';
import { projectsRouter } from './projects.js';

export const apiRouter = Router();

// 런타임 라우트는 공개 (published 폼만 반환)
apiRouter.use('/runtime', runtimeRouter);

// 나머지 라우트는 JWT 인증 필요
apiRouter.use(authenticate);
apiRouter.use('/forms', formsRouter);
apiRouter.use('/datasources', datasourcesRouter);
apiRouter.use('/projects', projectsRouter);
