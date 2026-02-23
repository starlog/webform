import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Form } from '../models/Form.js';
import { ShellService } from '../services/ShellService.js';

vi.mock('../db/redis.js', () => ({
  getRedis: () => ({
    ping: async () => 'PONG',
  }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');
const app = createApp();

const shellService = new ShellService();
const userId = 'user-1';

const shellInput = {
  name: 'Runtime Shell',
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
    formBorderStyle: 'Sizable' as const,
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [
    {
      id: 'menuStrip1',
      type: 'MenuStrip',
      name: 'menuStrip1',
      properties: { visible: true },
      position: { x: 0, y: 0 },
      size: { width: 1024, height: 24 },
    },
  ],
  eventHandlers: [
    {
      controlId: 'menuStrip1',
      eventName: 'ItemClicked',
      handlerType: 'server',
      handlerCode: "ctx.controls.menuStrip1.visible = false;",
    },
    {
      controlId: '__shell__',
      eventName: 'Load',
      handlerType: 'client',
      handlerCode: "console.log('loaded');",
    },
  ],
  startFormId: undefined as string | undefined,
};

const publishedFormData = {
  name: 'StartForm',
  version: 1,
  projectId: 'proj-rt',
  status: 'published' as const,
  properties: {
    title: 'Test Form',
    width: 800,
    height: 600,
    backgroundColor: '#FFFFFF',
    font: {
      family: 'Segoe UI',
      size: 9,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
    },
    startPosition: 'CenterScreen',
    formBorderStyle: 'Sizable',
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [
    {
      id: 'lblTitle',
      type: 'Label',
      name: 'lblTitle',
      properties: { text: 'Hello' },
      position: { x: 10, y: 10 },
      size: { width: 200, height: 30 },
    },
  ],
  eventHandlers: [
    {
      controlId: 'btnSave',
      eventName: 'Click',
      handlerType: 'server',
      handlerCode: "ctx.controls.lblTitle.text = 'Saved';",
    },
    {
      controlId: 'btnSave',
      eventName: 'Click',
      handlerType: 'client',
      handlerCode: "console.log('client handler');",
    },
  ],
  dataBindings: [],
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

// ─── GET /api/runtime/shells/:projectId ──────────────────────────

describe('Runtime Shell API', () => {
  describe('GET /api/runtime/shells/:projectId', () => {
    it('퍼블리시된 Shell 정의를 반환해야 한다', async () => {
      const projectId = 'rt-shell-get-1';
      await shellService.createShell(projectId, shellInput, userId);
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/shells/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(projectId);
      expect(res.body.name).toBe('Runtime Shell');
      expect(res.body.version).toBe(1);
      expect(res.body.properties).toBeDefined();
      expect(res.body.controls).toHaveLength(1);
      expect(res.body.id).toBeDefined();
    });

    it('서버 핸들러만 노출하고 handlerCode는 포함하지 않아야 한다', async () => {
      const projectId = 'rt-shell-get-filter';
      await shellService.createShell(projectId, shellInput, userId);
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/shells/${projectId}`);

      expect(res.status).toBe(200);
      // client 핸들러는 필터링됨
      expect(res.body.eventHandlers).toHaveLength(1);
      expect(res.body.eventHandlers[0].handlerType).toBe('server');
      expect(res.body.eventHandlers[0].controlId).toBe('menuStrip1');
      // handlerCode는 노출하지 않음
      expect(res.body.eventHandlers[0].handlerCode).toBeUndefined();
    });

    it('퍼블리시되지 않은 Shell은 404를 반환해야 한다', async () => {
      const projectId = 'rt-shell-get-unpub';
      await shellService.createShell(projectId, shellInput, userId);

      const res = await request(app).get(`/api/runtime/shells/${projectId}`);

      expect(res.status).toBe(404);
    });

    it('존재하지 않는 프로젝트는 404를 반환해야 한다', async () => {
      const res = await request(app).get('/api/runtime/shells/nonexistent-project');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/runtime/shells/:projectId/events ──────────────────

  describe('POST /api/runtime/shells/:projectId/events', () => {
    it('Shell 이벤트 실행 후 updateShell 패치를 반환해야 한다', async () => {
      const projectId = 'rt-shell-evt-1';
      await shellService.createShell(projectId, shellInput, userId);
      await shellService.publishShell(projectId, userId);

      const res = await request(app)
        .post(`/api/runtime/shells/${projectId}/events`)
        .send({
          projectId,
          controlId: 'menuStrip1',
          eventName: 'ItemClicked',
          eventArgs: { type: 'click', timestamp: Date.now() },
          shellState: { menuStrip1: { visible: true } },
          currentFormId: 'form-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.patches).toEqual([
        {
          type: 'updateShell',
          target: 'menuStrip1',
          payload: { visible: false },
        },
      ]);
    });

    it('필수 필드가 누락되면 400을 반환해야 한다', async () => {
      const projectId = 'rt-shell-evt-missing';
      await shellService.createShell(projectId, shellInput, userId);
      await shellService.publishShell(projectId, userId);

      const res = await request(app)
        .post(`/api/runtime/shells/${projectId}/events`)
        .send({ controlId: 'menuStrip1' });

      expect(res.status).toBe(400);
    });

    it('퍼블리시되지 않은 Shell에 이벤트 요청 시 404를 반환해야 한다', async () => {
      const projectId = 'rt-shell-evt-unpub';
      await shellService.createShell(projectId, shellInput, userId);

      const res = await request(app)
        .post(`/api/runtime/shells/${projectId}/events`)
        .send({
          projectId,
          controlId: 'menuStrip1',
          eventName: 'ItemClicked',
          eventArgs: { type: 'click', timestamp: Date.now() },
          shellState: { menuStrip1: { visible: true } },
          currentFormId: 'form-1',
        });

      expect(res.status).toBe(404);
    });

    it('존재하지 않는 프로젝트는 404를 반환해야 한다', async () => {
      const res = await request(app)
        .post('/api/runtime/shells/nonexistent/events')
        .send({
          projectId: 'nonexistent',
          controlId: 'x',
          eventName: 'Click',
          eventArgs: { type: 'click', timestamp: Date.now() },
          shellState: {},
          currentFormId: 'form-1',
        });

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/runtime/app/:projectId ──────────────────────────────

  describe('GET /api/runtime/app/:projectId', () => {
    let publishedFormId: string;

    beforeEach(async () => {
      const form = await Form.create(publishedFormData);
      publishedFormId = form._id.toString();
    });

    it('Shell + 시작 폼을 일괄 반환해야 한다 (shell.startFormId 사용)', async () => {
      const projectId = 'rt-app-1';
      await shellService.createShell(
        projectId,
        { ...shellInput, startFormId: publishedFormId },
        userId,
      );
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/app/${projectId}`);

      expect(res.status).toBe(200);
      // Shell 정의
      expect(res.body.shell).not.toBeNull();
      expect(res.body.shell.projectId).toBe(projectId);
      expect(res.body.shell.name).toBe('Runtime Shell');
      // 시작 폼 정의
      expect(res.body.startForm).toBeDefined();
      expect(res.body.startForm.id).toBe(publishedFormId);
      expect(res.body.startForm.name).toBe('StartForm');
      expect(res.body.startForm.controls).toHaveLength(1);
    });

    it('formId 쿼리 파라미터로 시작 폼을 오버라이드할 수 있어야 한다', async () => {
      const projectId = 'rt-app-override';
      await shellService.createShell(
        projectId,
        { ...shellInput, startFormId: 'some-other-form' },
        userId,
      );
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(
        `/api/runtime/app/${projectId}?formId=${publishedFormId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.startForm.id).toBe(publishedFormId);
    });

    it('시작 폼의 서버 핸들러만 노출해야 한다', async () => {
      const projectId = 'rt-app-handler-filter';
      await shellService.createShell(
        projectId,
        { ...shellInput, startFormId: publishedFormId },
        userId,
      );
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/app/${projectId}`);

      expect(res.status).toBe(200);
      // publishedFormData에 server + client 핸들러가 있지만 server만 노출
      expect(res.body.startForm.eventHandlers).toHaveLength(1);
      expect(res.body.startForm.eventHandlers[0].handlerType).toBe('server');
      expect(res.body.startForm.eventHandlers[0].handlerCode).toBeUndefined();
    });

    it('Shell 없이 formId 파라미터만으로 폼을 로드할 수 있어야 한다', async () => {
      const projectId = 'rt-app-no-shell';

      const res = await request(app).get(
        `/api/runtime/app/${projectId}?formId=${publishedFormId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.shell).toBeNull();
      expect(res.body.startForm.id).toBe(publishedFormId);
    });

    it('시작 폼이 지정되지 않으면 400을 반환해야 한다', async () => {
      const projectId = 'rt-app-no-form';
      // Shell에 startFormId가 없고 쿼리 파라미터도 없는 경우
      await shellService.createShell(projectId, shellInput, userId);
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/app/${projectId}`);

      expect(res.status).toBe(400);
    });

    it('존재하지 않는 폼 ID가 지정되면 404를 반환해야 한다', async () => {
      const projectId = 'rt-app-bad-form';
      await shellService.createShell(
        projectId,
        { ...shellInput, startFormId: '000000000000000000000000' },
        userId,
      );
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/app/${projectId}`);

      expect(res.status).toBe(404);
    });

    it('draft 상태의 폼은 404를 반환해야 한다', async () => {
      const draftForm = await Form.create({
        ...publishedFormData,
        name: 'DraftForm',
        status: 'draft',
      });
      const projectId = 'rt-app-draft-form';
      await shellService.createShell(
        projectId,
        { ...shellInput, startFormId: draftForm._id.toString() },
        userId,
      );
      await shellService.publishShell(projectId, userId);

      const res = await request(app).get(`/api/runtime/app/${projectId}`);

      expect(res.status).toBe(404);
    });
  });
});
