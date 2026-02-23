import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../config/index.js';
import { ShellService } from '../services/ShellService.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';
import type { CreateShellInput } from '../services/ShellService.js';

// ─── ShellService 단위 테스트 ────────────────────────────────────

const shellService = new ShellService();

const projectId = 'project-shell-1';
const userId = 'user-1';

const baseInput: CreateShellInput = {
  name: 'Test Shell',
  properties: {
    title: 'My App',
    width: 1024,
    height: 768,
    backgroundColor: '#FFFFFF',
    font: {
      family: 'Segoe UI',
      size: 9,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
    },
    showTitleBar: true,
    formBorderStyle: 'Sizable',
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [],
  eventHandlers: [],
};

describe('ShellService', () => {
  describe('createShell', () => {
    it('version=1, published=false로 생성되어야 한다', async () => {
      const shell = await shellService.createShell(projectId, baseInput, userId);

      expect(shell.name).toBe('Test Shell');
      expect(shell.projectId).toBe(projectId);
      expect(shell.version).toBe(1);
      expect(shell.published).toBe(false);
      expect(shell.createdBy).toBe(userId);
      expect(shell.updatedBy).toBe(userId);
      expect(shell.deletedAt).toBeNull();
      expect(shell._id).toBeDefined();
    });

    it('같은 프로젝트에 중복 생성 시 409 에러가 발생해야 한다', async () => {
      await shellService.createShell('project-dup', baseInput, userId);

      await expect(shellService.createShell('project-dup', baseInput, userId)).rejects.toThrow(
        AppError,
      );
      await expect(shellService.createShell('project-dup', baseInput, userId)).rejects.toThrow(
        'Shell already exists for project: project-dup',
      );
    });
  });

  describe('getShellByProjectId', () => {
    it('생성된 Shell을 조회할 수 있어야 한다', async () => {
      await shellService.createShell('project-get', baseInput, userId);

      const shell = await shellService.getShellByProjectId('project-get');

      expect(shell.name).toBe('Test Shell');
      expect(shell.projectId).toBe('project-get');
    });

    it('존재하지 않는 프로젝트 조회 시 NotFoundError가 발생해야 한다', async () => {
      await expect(shellService.getShellByProjectId('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateShell', () => {
    it('version이 증가하고 published가 false로 전환되어야 한다', async () => {
      await shellService.createShell('project-update', baseInput, userId);

      const updated = await shellService.updateShell(
        'project-update',
        { name: 'Updated Shell' },
        'user-2',
      );

      expect(updated.version).toBe(2);
      expect(updated.name).toBe('Updated Shell');
      expect(updated.updatedBy).toBe('user-2');
      expect(updated.published).toBe(false);
    });

    it('startFormId를 null로 설정 시 unset되어야 한다', async () => {
      await shellService.createShell('project-unset', { ...baseInput, startFormId: 'form-1' }, userId);

      const updated = await shellService.updateShell(
        'project-unset',
        { startFormId: null },
        userId,
      );

      expect(updated.startFormId).toBeUndefined();
    });

    it('startFormId를 새 값으로 설정할 수 있어야 한다', async () => {
      await shellService.createShell('project-setform', baseInput, userId);

      const updated = await shellService.updateShell(
        'project-setform',
        { startFormId: 'form-abc' },
        userId,
      );

      expect(updated.startFormId).toBe('form-abc');
    });

    it('존재하지 않는 프로젝트 수정 시 NotFoundError가 발생해야 한다', async () => {
      await expect(
        shellService.updateShell('nonexistent', { name: 'No' }, userId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteShell', () => {
    it('soft delete 후 getShellByProjectId 호출 시 NotFoundError가 발생해야 한다', async () => {
      await shellService.createShell('project-delete', baseInput, userId);

      await shellService.deleteShell('project-delete');

      await expect(shellService.getShellByProjectId('project-delete')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('존재하지 않는 프로젝트 삭제 시 NotFoundError가 발생해야 한다', async () => {
      await expect(shellService.deleteShell('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('publishShell', () => {
    it('published=true로 전환되어야 한다', async () => {
      await shellService.createShell('project-publish', baseInput, userId);

      const published = await shellService.publishShell('project-publish', userId);

      expect(published.published).toBe(true);
    });

    it('이미 published 상태면 409 에러가 발생해야 한다', async () => {
      await shellService.createShell('project-pub-dup', baseInput, userId);
      await shellService.publishShell('project-pub-dup', userId);

      await expect(shellService.publishShell('project-pub-dup', userId)).rejects.toThrow(AppError);
      await expect(shellService.publishShell('project-pub-dup', userId)).rejects.toThrow(
        'Shell is already published',
      );
    });

    it('수정 후 다시 퍼블리시할 수 있어야 한다', async () => {
      await shellService.createShell('project-repub', baseInput, userId);
      await shellService.publishShell('project-repub', userId);

      // 수정하면 published가 false로 전환됨
      await shellService.updateShell('project-repub', { name: 'V2' }, userId);

      const republished = await shellService.publishShell('project-repub', userId);
      expect(republished.published).toBe(true);
      expect(republished.name).toBe('V2');
    });
  });

  describe('getPublishedShell', () => {
    it('퍼블리시된 Shell을 반환해야 한다', async () => {
      await shellService.createShell('project-getpub', baseInput, userId);
      await shellService.publishShell('project-getpub', userId);

      const shell = await shellService.getPublishedShell('project-getpub');

      expect(shell).not.toBeNull();
      expect(shell!.published).toBe(true);
    });

    it('퍼블리시되지 않은 경우 null을 반환해야 한다', async () => {
      await shellService.createShell('project-nopub', baseInput, userId);

      const shell = await shellService.getPublishedShell('project-nopub');

      expect(shell).toBeNull();
    });

    it('존재하지 않는 프로젝트의 경우 null을 반환해야 한다', async () => {
      const shell = await shellService.getPublishedShell('nonexistent');
      expect(shell).toBeNull();
    });
  });
});

// ─── Shell API 통합 테스트 ──────────────────────────────────────

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

const apiProjectId = 'project-api-1';
const shellBase = (projectId: string) => `/api/projects/${projectId}/shell`;

describe('Shell API Integration', () => {
  describe('POST /api/projects/:projectId/shell', () => {
    it('201과 생성된 Shell을 반환해야 한다', async () => {
      const res = await request(app)
        .post(shellBase(apiProjectId))
        .set('Authorization', auth)
        .send({ name: 'Integration Shell' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Integration Shell');
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.published).toBe(false);
      expect(res.body.data.projectId).toBe(apiProjectId);
    });

    it('name이 없으면 400을 반환해야 한다', async () => {
      const res = await request(app)
        .post(shellBase('project-noname'))
        .set('Authorization', auth)
        .send({});

      expect(res.status).toBe(400);
    });

    it('같은 프로젝트에 중복 생성 시 409를 반환해야 한다', async () => {
      await request(app)
        .post(shellBase('project-dup-api'))
        .set('Authorization', auth)
        .send({ name: 'First' });

      const res = await request(app)
        .post(shellBase('project-dup-api'))
        .set('Authorization', auth)
        .send({ name: 'Second' });

      expect(res.status).toBe(409);
    });

    it('인증 없이 요청하면 401을 반환해야 한다', async () => {
      const res = await request(app)
        .post(shellBase('project-noauth'))
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects/:projectId/shell', () => {
    it('200과 Shell 데이터를 반환해야 한다', async () => {
      await request(app)
        .post(shellBase('project-get-api'))
        .set('Authorization', auth)
        .send({ name: 'Get Shell' });

      const res = await request(app)
        .get(shellBase('project-get-api'))
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Get Shell');
      expect(res.body.data.projectId).toBe('project-get-api');
    });

    it('존재하지 않는 프로젝트로 요청하면 404를 반환해야 한다', async () => {
      const res = await request(app)
        .get(shellBase('nonexistent-project'))
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:projectId/shell', () => {
    it('200과 version이 증가한 Shell을 반환해야 한다', async () => {
      await request(app)
        .post(shellBase('project-put-api'))
        .set('Authorization', auth)
        .send({ name: 'Original' });

      const res = await request(app)
        .put(shellBase('project-put-api'))
        .set('Authorization', auth)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
      expect(res.body.data.version).toBe(2);
    });

    it('존재하지 않는 프로젝트 수정 시 404를 반환해야 한다', async () => {
      const res = await request(app)
        .put(shellBase('nonexistent-project'))
        .set('Authorization', auth)
        .send({ name: 'No Shell' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId/shell', () => {
    it('삭제 후 GET 요청 시 404를 반환해야 한다', async () => {
      await request(app)
        .post(shellBase('project-del-api'))
        .set('Authorization', auth)
        .send({ name: 'Delete Me' });

      const deleteRes = await request(app)
        .delete(shellBase('project-del-api'))
        .set('Authorization', auth);

      expect(deleteRes.status).toBe(204);

      const getRes = await request(app)
        .get(shellBase('project-del-api'))
        .set('Authorization', auth);

      expect(getRes.status).toBe(404);
    });

    it('존재하지 않는 프로젝트 삭제 시 404를 반환해야 한다', async () => {
      const res = await request(app)
        .delete(shellBase('nonexistent-project'))
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:projectId/shell/publish', () => {
    it('published=true로 전환되어야 한다', async () => {
      await request(app)
        .post(shellBase('project-pub-api'))
        .set('Authorization', auth)
        .send({ name: 'Publish Me' });

      const res = await request(app)
        .post(`${shellBase('project-pub-api')}/publish`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(true);
    });

    it('이미 published 상태면 409를 반환해야 한다', async () => {
      await request(app)
        .post(shellBase('project-pub-dup-api'))
        .set('Authorization', auth)
        .send({ name: 'Pub Dup' });

      await request(app)
        .post(`${shellBase('project-pub-dup-api')}/publish`)
        .set('Authorization', auth);

      const res = await request(app)
        .post(`${shellBase('project-pub-dup-api')}/publish`)
        .set('Authorization', auth);

      expect(res.status).toBe(409);
    });
  });
});
