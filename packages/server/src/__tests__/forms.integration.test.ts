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

  describe('낙관적 잠금 (Optimistic Locking)', () => {
    it('초기 폼 생성 시 version이 1로 설정되어야 한다', async () => {
      const res = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      expect(res.status).toBe(201);
      expect(res.body.data.version).toBe(1);
    });

    it('올바른 version으로 업데이트하면 200을 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      const res = await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'Version Update', version: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Version Update');
    });

    it('업데이트 성공 후 version이 1 증가해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      // 첫 번째 업데이트: version 1 → 2
      const res1 = await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'V2', version: 1 });

      expect(res1.status).toBe(200);
      expect(res1.body.data.version).toBe(2);

      // 두 번째 업데이트: version 2 → 3
      const res2 = await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'V3', version: 2 });

      expect(res2.status).toBe(200);
      expect(res2.body.data.version).toBe(3);
    });

    it('구버전(stale version)으로 업데이트 시 409를 반환해야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      // 먼저 version 1로 정상 업데이트 → version 2가 됨
      await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'Updated by User A', version: 1 });

      // 구버전(version: 1)으로 다시 업데이트 시도 → 409 충돌
      const res = await request(app)
        .put(`/api/forms/${id}`)
        .set('Authorization', auth)
        .send({ name: 'Updated by User B', version: 1 });

      expect(res.status).toBe(409);
    });

    it('동시 업데이트 시 먼저 성공한 요청만 반영되어야 한다', async () => {
      const created = await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send(baseBody);

      const id = created.body.data._id;

      // 두 요청을 동시에 전송 (둘 다 version: 1)
      const [resA, resB] = await Promise.all([
        request(app)
          .put(`/api/forms/${id}`)
          .set('Authorization', auth)
          .send({ name: 'User A Update', version: 1 }),
        request(app)
          .put(`/api/forms/${id}`)
          .set('Authorization', auth)
          .send({ name: 'User B Update', version: 1 }),
      ]);

      // 하나는 성공(200), 하나는 충돌(409)
      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      // 최종 폼 상태 확인: version이 2이고, 성공한 쪽의 이름이 반영됨
      const final = await request(app)
        .get(`/api/forms/${id}`)
        .set('Authorization', auth);

      expect(final.body.data.version).toBe(2);
      const winner = resA.status === 200 ? resA : resB;
      expect(final.body.data.name).toBe(winner.body.data.name);
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
