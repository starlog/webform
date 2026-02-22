import { describe, it, expect } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { authenticate } from '../middleware/auth.js';
import { requestId } from '../middleware/requestId.js';
import {
  errorHandler,
  ValidationError,
  AppError,
} from '../middleware/errorHandler.js';
import { env } from '../config/index.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  return app;
}

describe('auth 미들웨어', () => {
  function authApp() {
    const app = createTestApp();
    app.use(authenticate);
    app.get('/protected', (req, res) => {
      res.json({ user: req.user });
    });
    app.use(errorHandler);
    return app;
  }

  it('유효한 JWT로 요청 시 통과해야 한다', async () => {
    const app = authApp();
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_SECRET);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('user-1');
    expect(res.body.user.role).toBe('admin');
  });

  it('토큰이 없으면 401을 반환해야 한다', async () => {
    const app = authApp();

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing or invalid Authorization header');
  });

  it('만료된 토큰이면 401을 반환해야 한다', async () => {
    const app = authApp();
    const token = jwt.sign(
      { sub: 'user-1', role: 'admin' },
      env.JWT_SECRET,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired token');
  });
});

describe('requestId 미들웨어', () => {
  function reqIdApp() {
    const app = createTestApp();
    app.get('/test', (req, res) => {
      res.json({ requestId: req.id });
    });
    return app;
  }

  it('X-Request-Id 헤더가 없으면 UUID를 생성해야 한다', async () => {
    const app = reqIdApp();

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('X-Request-Id 헤더가 있으면 해당 값을 사용해야 한다', async () => {
    const app = reqIdApp();

    const res = await request(app)
      .get('/test')
      .set('X-Request-Id', 'custom-request-id');

    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe('custom-request-id');
  });
});

describe('errorHandler 미들웨어', () => {
  function errorApp(error: Error) {
    const app = createTestApp();
    app.get('/test', () => {
      throw error;
    });
    app.use(errorHandler);
    return app;
  }

  it('ValidationError는 400을 반환해야 한다', async () => {
    const app = errorApp(new ValidationError('잘못된 입력'));

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('잘못된 입력');
  });

  it('AppError는 해당 statusCode를 반환해야 한다', async () => {
    const app = errorApp(new AppError(403, '접근 거부'));

    const res = await request(app).get('/test');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('접근 거부');
  });

  it('일반 Error는 500을 반환해야 한다', async () => {
    const app = errorApp(new Error('알 수 없는 에러'));

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });
});
