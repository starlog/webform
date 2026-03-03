import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { googleAuthRouter } from './routes/googleAuth.js';
import { getRedis } from './db/redis.js';
import { env } from './config/index.js';
import { swaggerDocument } from './swagger.js';

export function createApp() {
  const app = express();

  // --- 미들웨어 스택 (순서 중요) ---
  app.use(requestId);
  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan('short'));

  // --- Swagger UI (인증 불필요) ---
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // --- 헬스체크 (인증 불필요) ---
  app.get('/health', async (_req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;

    let redisOk = false;
    try {
      const pong = await getRedis().ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    const healthy = mongoOk && redisOk;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        mongo: mongoOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
      },
    });
  });

  // --- 서비스 토큰 발급 (개발 또는 ENABLE_SERVICE_TOKEN=true) ---
  if (env.NODE_ENV === 'development' || env.ENABLE_SERVICE_TOKEN) {
    app.post('/auth/dev-token', (_req, res) => {
      const token = jwt.sign(
        { sub: 'dev-designer', role: 'admin' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'] },
      );
      res.json({ token });
    });
  }

  // --- Google OAuth2 라우트 (인증 불필요) ---
  app.use('/auth', googleAuthRouter);

  // --- API 라우트 ---
  app.use('/api', apiRouter);

  // --- 프로덕션 정적 파일 서빙 (Runtime SPA) ---
  if (env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const runtimeDist = path.resolve(__dirname, '../../runtime/dist');

    app.use(express.static(runtimeDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(runtimeDist, 'index.html'));
    });
  }

  // --- 에러 핸들링 (반드시 마지막) ---
  app.use(errorHandler);

  return app;
}
