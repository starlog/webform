import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { Form } from '../models/Form.js';

vi.mock('../db/redis.js', () => ({
  getRedis: () => ({
    ping: async () => 'PONG',
  }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');
const app = createApp();

const token = jwt.sign({ sub: 'user1', role: 'admin' }, env.JWT_SECRET);

const publishedFormData = {
  name: 'PublishedForm',
  version: 1,
  projectId: 'proj1',
  status: 'published' as const,
  properties: {
    title: 'Test',
    width: 800,
    height: 600,
    backgroundColor: '#FFFFFF',
    font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
    startPosition: 'CenterScreen',
    formBorderStyle: 'Sizable',
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [
    {
      id: 'lblStatus',
      type: 'Label',
      name: 'lblStatus',
      properties: { text: '초기값' },
      position: { x: 0, y: 0 },
      size: { width: 100, height: 30 },
    },
  ],
  eventHandlers: [
    {
      controlId: 'btnSubmit',
      eventName: 'Click',
      handlerType: 'server',
      handlerCode: "ctx.controls.lblStatus.text = '클릭됨'",
    },
  ],
  createdBy: 'user1',
  updatedBy: 'user1',
};

describe('Runtime Integration', () => {
  let publishedFormId: string;

  beforeEach(async () => {
    const form = await Form.create(publishedFormData);
    publishedFormId = form._id.toString();
  });

  describe('GET /api/runtime/forms/:id', () => {
    it('published 폼을 반환해야 한다', async () => {
      const res = await request(app)
        .get(`/api/runtime/forms/${publishedFormId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('PublishedForm');
      expect(res.body.controls).toBeDefined();
    });

    it('draft 폼은 404를 반환해야 한다', async () => {
      const draftForm = await Form.create({
        ...publishedFormData,
        name: 'DraftForm',
        status: 'draft',
      });

      const res = await request(app)
        .get(`/api/runtime/forms/${draftForm._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/runtime/forms/:id/events', () => {
    it('UIPatch 배열을 응답해야 한다', async () => {
      const res = await request(app)
        .post(`/api/runtime/forms/${publishedFormId}/events`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          formId: publishedFormId,
          controlId: 'btnSubmit',
          eventName: 'Click',
          eventArgs: { type: 'Click', timestamp: Date.now() },
          formState: {
            lblStatus: { text: '초기값' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.patches).toBeInstanceOf(Array);
      expect(res.body.patches).toHaveLength(1);
      expect(res.body.patches[0]).toEqual({
        type: 'updateProperty',
        target: 'lblStatus',
        payload: { text: '클릭됨' },
      });
    });
  });
});
