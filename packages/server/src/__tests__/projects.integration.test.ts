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

describe('Projects API Integration', () => {
  describe('POST /api/projects', () => {
    it('201과 생성된 프로젝트를 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', auth)
        .send({ name: '통합 테스트 프로젝트' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('통합 테스트 프로젝트');
      expect(res.body.data.description).toBe('');
      expect(res.body.data._id).toBeDefined();
    });

    it('name이 없으면 400을 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', auth)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    it('프로젝트 목록을 반환해야 한다', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', auth)
        .send({ name: 'List Test Project' });

      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/projects/:id/export', () => {
    it('JSON 응답에 폼 데이터가 포함되어야 한다', async () => {
      // 프로젝트 생성
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', auth)
        .send({ name: 'Export Integration' });

      const projectId = createRes.body.data._id;

      // 프로젝트에 폼 추가
      await request(app)
        .post('/api/forms')
        .set('Authorization', auth)
        .send({ name: 'Export Form', projectId });

      const res = await request(app)
        .get(`/api/projects/${projectId}/export`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.exportVersion).toBe('1.0');
      expect(res.body.exportedAt).toBeDefined();
      expect(res.body.project.name).toBe('Export Integration');
      expect(res.body.forms).toHaveLength(1);
      expect(res.body.forms[0].name).toBe('Export Form');
      expect(res.headers['content-disposition']).toContain('Export Integration');
    });
  });

  describe('POST /api/projects/import', () => {
    it('복원 후 새 ID로 프로젝트가 생성되어야 한다', async () => {
      const importData = {
        project: { name: 'Imported Project', description: '가져오기 테스트' },
        forms: [
          {
            name: 'Imported Form',
            properties: { title: 'IF' },
            controls: [],
            eventHandlers: [],
            dataBindings: [],
          },
        ],
      };

      const res = await request(app)
        .post('/api/projects/import')
        .set('Authorization', auth)
        .send(importData);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Imported Project');
      expect(res.body.data._id).toBeDefined();

      // 가져온 프로젝트 상세에서 폼 확인
      const detailRes = await request(app)
        .get(`/api/projects/${res.body.data._id}`)
        .set('Authorization', auth);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.forms).toHaveLength(1);
      expect(detailRes.body.data.forms[0].name).toBe('Imported Form');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('204를 반환하고 이후 조회 시 404를 반환해야 한다', async () => {
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', auth)
        .send({ name: 'Delete Target' });

      const projectId = createRes.body.data._id;

      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', auth);

      expect(deleteRes.status).toBe(204);

      // 삭제된 프로젝트 조회 시 404
      const getRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', auth);

      expect(getRes.status).toBe(404);
    });
  });
});
