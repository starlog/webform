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

describe('POST /api/projects/:id/publish-all Integration', () => {
  /** 헬퍼: 프로젝트 생성 후 ID 반환 */
  async function createProject(name = 'Publish Test Project') {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', auth)
      .send({ name });
    return res.body.data._id as string;
  }

  /** 헬퍼: 프로젝트에 draft 폼 생성 */
  async function createForm(projectId: string, name = 'Test Form') {
    const res = await request(app)
      .post('/api/forms')
      .set('Authorization', auth)
      .send({ name, projectId });
    return res.body.data;
  }

  it('정상 퍼블리시: draft 폼이 있는 프로젝트 → 200, publishedCount > 0', async () => {
    const projectId = await createProject();
    await createForm(projectId, 'Form A');
    await createForm(projectId, 'Form B');

    const res = await request(app)
      .post(`/api/projects/${projectId}/publish-all`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.forms.publishedCount).toBeGreaterThan(0);
    expect(res.body.data.forms.publishedCount).toBe(2);
    expect(res.body.data.forms.totalCount).toBe(2);
  });

  it('빈 프로젝트: 폼 없는 프로젝트 → 200, totalCount: 0', async () => {
    const projectId = await createProject('Empty Project');

    const res = await request(app)
      .post(`/api/projects/${projectId}/publish-all`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.forms.totalCount).toBe(0);
    expect(res.body.data.forms.publishedCount).toBe(0);
    expect(res.body.data.forms.skippedCount).toBe(0);
  });

  it('존재하지 않는 프로젝트 → 404', async () => {
    const fakeId = '000000000000000000000000';

    const res = await request(app)
      .post(`/api/projects/${fakeId}/publish-all`)
      .set('Authorization', auth);

    expect(res.status).toBe(404);
  });

  it('인증 없는 요청 → 401', async () => {
    const projectId = await createProject('Auth Test Project');

    const res = await request(app)
      .post(`/api/projects/${projectId}/publish-all`);

    expect(res.status).toBe(401);
  });

  it('응답 형식 검증: data.forms와 data.shell 필드 존재 및 올바른 타입', async () => {
    const projectId = await createProject('Schema Test');
    await createForm(projectId, 'Schema Form');

    const res = await request(app)
      .post(`/api/projects/${projectId}/publish-all`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);

    const { data } = res.body;

    // data.forms 구조 검증
    expect(data.forms).toBeDefined();
    expect(typeof data.forms.publishedCount).toBe('number');
    expect(typeof data.forms.skippedCount).toBe('number');
    expect(typeof data.forms.totalCount).toBe('number');
    expect(data.forms.publishedCount).toBeGreaterThanOrEqual(0);
    expect(data.forms.skippedCount).toBeGreaterThanOrEqual(0);
    expect(data.forms.totalCount).toBeGreaterThanOrEqual(0);

    // data.shell 구조 검증
    expect(data.shell).toBeDefined();
    expect(typeof data.shell.published).toBe('boolean');
    expect(typeof data.shell.skipped).toBe('boolean');
  });
});
