import { describe, it, expect, vi } from 'vitest';
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

describe('DataGridView dataSource 패치 생성', () => {
  it('이벤트 핸들러에서 dataSource를 설정하면 패치에 포함되어야 한다', async () => {
    const form = await Form.create({
      name: 'DataGridViewTest',
      version: 1,
      projectId: 'proj1',
      status: 'published',
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
          id: 'ctrl-label-1',
          type: 'Label',
          name: 'lblStatus',
          properties: { text: '' },
          position: { x: 0, y: 0 },
          size: { width: 100, height: 30 },
        },
        {
          id: 'ctrl-grid-1',
          type: 'DataGridView',
          name: 'dgvOrders',
          properties: { columns: [] },
          position: { x: 0, y: 50 },
          size: { width: 400, height: 200 },
        },
        {
          id: 'ctrl-btn-1',
          type: 'Button',
          name: 'btnSubmit',
          properties: { text: '주문 접수' },
          position: { x: 0, y: 260 },
          size: { width: 100, height: 30 },
        },
      ],
      eventHandlers: [
        {
          controlId: 'ctrl-btn-1',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: `
            var orders = ctx.controls.dgvOrders.dataSource || [];
            orders.push({ orderNo: orders.length + 1, customer: '홍길동', payment: '계좌이체' });
            ctx.controls.dgvOrders.dataSource = orders;
            ctx.controls.lblStatus.text = '주문 #' + orders.length + ' 접수 완료!';
          `,
        },
      ],
      createdBy: 'user1',
      updatedBy: 'user1',
    });

    const formId = form._id.toString();

    // 첫 번째 주문 접수 - formState는 ID 키 기반 (런타임과 동일)
    const res1 = await request(app)
      .post(`/api/runtime/forms/${formId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        formId,
        controlId: 'ctrl-btn-1',
        eventName: 'Click',
        eventArgs: { type: 'Click', timestamp: Date.now() },
        formState: {
          'ctrl-label-1': { text: '' },
          'ctrl-grid-1': { columns: [] },
          'ctrl-btn-1': { text: '주문 접수' },
        },
      });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    // 패치에 DataGridView의 dataSource 업데이트가 포함되어야 함
    const gridPatch = res1.body.patches.find(
      (p: { target: string }) => p.target === 'ctrl-grid-1',
    );
    expect(gridPatch).toBeDefined();
    expect(gridPatch.type).toBe('updateProperty');
    expect(gridPatch.payload.dataSource).toEqual([
      { orderNo: 1, customer: '홍길동', payment: '계좌이체' },
    ]);

    // 라벨 패치도 확인
    const labelPatch = res1.body.patches.find(
      (p: { target: string }) => p.target === 'ctrl-label-1',
    );
    expect(labelPatch).toBeDefined();
    expect(labelPatch.payload.text).toBe('주문 #1 접수 완료!');
  });

  it('두 번째 주문에서 기존 dataSource를 누적해야 한다', async () => {
    const form = await Form.create({
      name: 'DataGridViewAccumTest',
      version: 1,
      projectId: 'proj1',
      status: 'published',
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
          id: 'ctrl-grid-1',
          type: 'DataGridView',
          name: 'dgvOrders',
          properties: { columns: [] },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 200 },
        },
        {
          id: 'ctrl-btn-1',
          type: 'Button',
          name: 'btnSubmit',
          properties: { text: '주문 접수' },
          position: { x: 0, y: 210 },
          size: { width: 100, height: 30 },
        },
      ],
      eventHandlers: [
        {
          controlId: 'ctrl-btn-1',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: `
            var orders = ctx.controls.dgvOrders.dataSource || [];
            orders.push({ orderNo: orders.length + 1, customer: '홍길동' });
            ctx.controls.dgvOrders.dataSource = orders;
          `,
        },
      ],
      createdBy: 'user1',
      updatedBy: 'user1',
    });

    const formId = form._id.toString();

    // 두 번째 주문 - 이전 dataSource가 포함된 formState
    const res = await request(app)
      .post(`/api/runtime/forms/${formId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        formId,
        controlId: 'ctrl-btn-1',
        eventName: 'Click',
        eventArgs: { type: 'Click', timestamp: Date.now() },
        formState: {
          'ctrl-grid-1': {
            columns: [],
            dataSource: [{ orderNo: 1, customer: '김철수' }],
          },
          'ctrl-btn-1': { text: '주문 접수' },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const gridPatch = res.body.patches.find(
      (p: { target: string }) => p.target === 'ctrl-grid-1',
    );
    expect(gridPatch).toBeDefined();
    expect(gridPatch.payload.dataSource).toEqual([
      { orderNo: 1, customer: '김철수' },
      { orderNo: 2, customer: '홍길동' },
    ]);
  });
});
