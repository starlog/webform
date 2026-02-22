import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';

// Redis mock
vi.mock('../db/redis.js', () => ({
  getRedis: () => ({
    ping: async () => 'PONG',
  }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');

const app = createApp();
const token = jwt.sign({ sub: 'test-user', role: 'admin' }, env.JWT_SECRET);
const auth = `Bearer ${token}`;

describe('POST /api/datasources', () => {
  it('Static 타입 데이터소스를 생성하고 201을 반환해야 한다', async () => {
    const res = await request(app)
      .post('/api/datasources')
      .set('Authorization', auth)
      .send({
        type: 'static',
        name: 'Integration Static DS',
        description: 'test static',
        projectId: 'proj-int',
        config: {
          data: [
            { id: 1, name: '홍길동' },
            { id: 2, name: '김철수' },
          ],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.name).toBe('Integration Static DS');
    expect(res.body.data.type).toBe('static');
  });
});

describe('POST /api/datasources/:id/query', () => {
  it('Static 데이터 쿼리 결과를 반환해야 한다', async () => {
    // 먼저 데이터소스 생성
    const createRes = await request(app)
      .post('/api/datasources')
      .set('Authorization', auth)
      .send({
        type: 'static',
        name: 'Query Test DS',
        projectId: 'proj-int',
        config: {
          data: [
            { id: 1, status: 'active' },
            { id: 2, status: 'inactive' },
            { id: 3, status: 'active' },
          ],
        },
      });

    const dsId = createRes.body.data._id;

    // 쿼리 실행
    const res = await request(app)
      .post(`/api/datasources/${dsId}/query`)
      .set('Authorization', auth)
      .send({ filter: { status: 'active' } });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r: Record<string, unknown>) => r.status === 'active')).toBe(true);
  });
});

describe('POST /api/datasources/:id/test', () => {
  it('Static 데이터소스 연결 테스트에서 success: true를 반환해야 한다', async () => {
    const createRes = await request(app)
      .post('/api/datasources')
      .set('Authorization', auth)
      .send({
        type: 'static',
        name: 'Connection Test DS',
        projectId: 'proj-int',
        config: { data: [{ a: 1 }] },
      });

    const dsId = createRes.body.data._id;

    const res = await request(app)
      .post(`/api/datasources/${dsId}/test`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });
});

describe('PUT /api/datasources/:id', () => {
  it('데이터소스 수정이 성공해야 한다', async () => {
    const createRes = await request(app)
      .post('/api/datasources')
      .set('Authorization', auth)
      .send({
        type: 'static',
        name: 'Update Test DS',
        projectId: 'proj-int',
        config: { data: [] },
      });

    const dsId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/datasources/${dsId}`)
      .set('Authorization', auth)
      .send({ name: 'Updated DS Name', description: '수정된 설명' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated DS Name');
    expect(res.body.data.description).toBe('수정된 설명');
  });
});

describe('DELETE /api/datasources/:id', () => {
  it('데이터소스 삭제가 성공해야 한다', async () => {
    const createRes = await request(app)
      .post('/api/datasources')
      .set('Authorization', auth)
      .send({
        type: 'static',
        name: 'Delete Test DS',
        projectId: 'proj-int',
        config: { data: [] },
      });

    const dsId = createRes.body.data._id;

    const res = await request(app)
      .delete(`/api/datasources/${dsId}`)
      .set('Authorization', auth);

    expect(res.status).toBe(204);

    // 삭제 후 조회 시 404
    const getRes = await request(app)
      .get(`/api/datasources/${dsId}`)
      .set('Authorization', auth);

    expect(getRes.status).toBe(404);
  });
});
