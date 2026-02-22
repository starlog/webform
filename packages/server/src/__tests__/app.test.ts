import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db/redis.js', () => ({
  getRedis: () => ({
    ping: async () => 'PONG',
  }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');

describe('App', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('200과 { status: "ok" }을 반환해야 한다', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.services.mongo).toBe('connected');
      expect(res.body.services.redis).toBe('connected');
    });
  });

  describe('CORS', () => {
    it('CORS 헤더가 포함되어야 한다', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('404', () => {
    it('존재하지 않는 라우트에 대해 404를 반환해야 한다', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('에러 핸들러', () => {
    it('던진 에러가 JSON으로 응답되어야 한다', async () => {
      const res = await request(app).get('/api/forms');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBe('Missing or invalid Authorization header');
    });
  });
});
