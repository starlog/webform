import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { env } from '../config/index.js';
import { initWebSocket } from '../websocket/index.js';

let server: Server;
let port: number;

function connectWs(path: string, token?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const url = token
      ? `ws://localhost:${port}${path}?token=${encodeURIComponent(token)}`
      : `ws://localhost:${port}${path}`;

    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });
}

describe('WebSocket 인증', () => {
  beforeAll(async () => {
    server = createServer();
    initWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('유효한 JWT 토큰으로 WebSocket 연결이 성공해야 한다', async () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_SECRET);

    const ws = await connectWs('/ws/designer/test-form', token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });

  it('토큰 없이 WebSocket 연결 시 거부되어야 한다', async () => {
    await expect(connectWs('/ws/designer/test-form')).rejects.toThrow();
  });

  it('만료된 토큰으로 연결 시 거부되어야 한다', async () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_SECRET, {
      expiresIn: -1,
    });

    await expect(connectWs('/ws/designer/test-form', token)).rejects.toThrow();
  });

  it('서명이 잘못된 토큰으로 연결 시 거부되어야 한다', async () => {
    const token = jwt.sign(
      { sub: 'user-1', role: 'admin' },
      'wrong-secret-that-is-at-least-32-characters-long',
    );

    await expect(connectWs('/ws/designer/test-form', token)).rejects.toThrow();
  });
});
