import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../config/index.js';

vi.mock('../db/redis.js', () => ({
  getRedis: () => ({
    ping: async () => 'PONG',
  }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');

const app = createApp();
const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_SECRET);
const auth = `Bearer ${token}`;

const baseBody = {
  name: 'Integration Form',
  projectId: 'project-1',
};

describe('Forms API Integration', () => {
  describe('POST /api/forms', () => {
    it('201과 생성된 폼을 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Integration Form');
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.status).toBe('draft');
    });

    it('name이 없으면 400을 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send({ projectId: 'project-1' });

      expect(res.status).toBe(400);
    });

    it('projectId가 없으면 400을 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send({ name: 'No Project' });

      expect(res.status).toBe(400);
    });

    it('인증 없이 요청하면 401을 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/forms')
        .send(baseBody);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/forms', () => {
    it('200과 data 배열을 반환해야 한다', async () => {
      await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const res = await request(app)
        .get('/api/forms')
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('페이지네이션 메타 정보가 포함되어야 한다', async () => {
      const res = await request(app)
        .get('/api/forms?page=1&limit=5')
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.totalPages).toBeDefined();
    });
  });

  describe('GET /api/forms/:id', () => {
    it('200과 폼 데이터를 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      const res = await request(app)
        .get(`/api/forms/${id}`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(id);
      expect(res.body.data.name).toBe('Integration Form');
    });

    it('존재하지 않는 ID로 요청하면 404를 반환해야 한다', async () => {
      const res = await request(app)
        .get('/api/forms/000000000000000000000000')
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/forms/:id', () => {
    it('200과 version이 증가한 폼을 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      const res = await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'Updated Integration Form' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Integration Form');
      expect(res.body.data.version).toBe(2);
    });
  });

  describe('DELETE /api/forms/:id', () => {
    it('삭제 후 GET 요청 시 404를 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      const deleteRes = await request(app)
        .delete(`/api/forms/${id}`)
        .set('Authorization', auth);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/forms/${id}`)
        .set('Authorization', auth);

      expect(getRes.status).toBe(404);
    });
  });

  describe('GET /api/forms/:id/versions', () => {
    it('버전 배열을 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      // 수정하여 버전 히스토리 생성
      await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'V2' });

      const res = await request(app)
        .get(`/api/forms/${id}/versions`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].version).toBe(1);
    });
  });

  describe('POST /api/forms/:id/publish', () => {
    it('status="published"로 전환되어야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      const res = await request(app)
        .post(`/api/forms/${id}/publish`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('published');
      expect(res.body.data.publishedVersion).toBe(1);
    });

    it('이미 published 상태면 409를 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      await request(app)
        .post(`/api/forms/${id}/publish`)
        .set('Authorization', auth);

      const res = await request(app)
        .post(`/api/forms/${id}/publish`)
        .set('Authorization', auth);

      expect(res.status).toBe(409);
    });
  });
});
