import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { getRedis } from './db/redis.js';
import { env } from './config/index.js';

export function createApp() {
  const app = express();

  // --- 미들웨어 스택 (순서 중요) ---
  app.use(requestId);
  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan('short'));

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

  // --- 개발용 토큰 발급 (인증 불필요) ---
  if (env.NODE_ENV === 'development') {
    app.post('/auth/dev-token', (_req, res) => {
      const token = jwt.sign(
        { sub: 'dev-designer', role: 'admin' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'] },
      );
      res.json({ token });
    });
  }

  // --- API 라우트 ---
  app.use('/api', apiRouter);

  // --- 에러 핸들링 (반드시 마지막) ---
  app.use(errorHandler);

  return app;
}
