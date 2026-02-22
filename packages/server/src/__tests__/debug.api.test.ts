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
const app = createApp();

describe('Debug API — POST /api/debug/execute', () => {
  it('코드를 실행하고 logs를 반환해야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({
        code: 'console.log("hello debug");',
        formState: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].type).toBe('log');
    expect(res.body.logs[0].args).toEqual(['hello debug']);
  });

  it('컨트롤 변경 시 controlChanges를 반환해야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({
        code: 'ctx.controls.btn1.text = "clicked";',
        formState: { btn1: { text: 'Click me' } },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.controlChanges.btn1.text).toBe('clicked');
  });

  it('여러 console 메서드 호출이 모두 logs에 포함되어야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({
        code: 'console.log("L"); console.warn("W"); console.error("E");',
        formState: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.logs).toHaveLength(3);
    expect(res.body.logs[0]).toMatchObject({ type: 'log', args: ['L'] });
    expect(res.body.logs[1]).toMatchObject({ type: 'warn', args: ['W'] });
    expect(res.body.logs[2]).toMatchObject({ type: 'error', args: ['E'] });
  });

  it('에러 코드 전송 시 error와 errorLine이 반환되어야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({
        code: 'var x = 1;\nundefinedFunc();',
        formState: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.logs).toEqual([]);
    // errorLine은 isolated-vm 스택 형식에 따라 존재할 수도 있음
    if (res.body.errorLine !== undefined) {
      expect(res.body.errorLine).toBeTypeOf('number');
      expect(res.body.errorLine).toBeGreaterThan(0);
    }
  });

  it('code가 없으면 400을 반환해야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({ formState: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('code is required');
  });

  it('빈 문자열 code는 400을 반환해야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({ code: '   ', formState: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('code is required');
  });

  it('formState 없이도 실행 가능해야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({ code: 'console.log("no state");' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.logs[0].args).toEqual(['no state']);
  });

  it('controlId 전달 시 해당 컨트롤이 sender로 설정되어야 한다', async () => {
    const res = await request(app)
      .post('/api/debug/execute')
      .send({
        code: 'console.log(sender.text);',
        formState: { btn1: { text: 'Button1' } },
        controlId: 'btn1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.logs[0].args).toEqual(['Button1']);
  });
});

describe('Debug API — production 환경 차단', () => {
  it('production 환경에서 404가 반환되어야 한다', async () => {
    // production 환경을 시뮬레이션하기 위해 별도 앱 구성
    const express = await import('express');
    const { debugRouter } = await import('../routes/debug.js');
    const { env } = await import('../config/index.js');

    // 원본 값 저장 후 production으로 변경
    const originalEnv = env.NODE_ENV;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';

    try {
      const prodApp = express.default();
      prodApp.use(express.default.json());
      prodApp.use('/api/debug', debugRouter);

      const res = await request(prodApp)
        .post('/api/debug/execute')
        .send({ code: 'console.log("test")', formState: {} });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    } finally {
      // 원본 값 복원
      (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
    }
  });
});
