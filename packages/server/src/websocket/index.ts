import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { handleDesignerConnection } from './designerSync.js';
import { handleRuntimeConnection } from './runtimeEvents.js';
import { handleAppConnection } from './appEvents.js';
import { authenticateWsUpgrade } from './auth.js';
import type { JwtPayload } from '../middleware/auth.js';

export function initWebSocket(server: Server): void {
  const designerWss = new WebSocketServer({ noServer: true });
  designerWss.on('connection', handleDesignerConnection);

  const runtimeWss = new WebSocketServer({ noServer: true });
  runtimeWss.on('connection', handleRuntimeConnection);

  const appWss = new WebSocketServer({ noServer: true });
  appWss.on('connection', handleAppConnection);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // JWT 토큰 검증
    const user = authenticateWsUpgrade(req, socket);
    if (!user) return; // 인증 실패 → 소켓 이미 파괴됨

    // 핸들러에서 user 정보 접근 가능하도록 req에 첨부
    (req as IncomingMessage & { user: JwtPayload }).user = user;

    if (pathname.startsWith('/ws/designer/')) {
      designerWss.handleUpgrade(req, socket, head, (ws) => {
        designerWss.emit('connection', ws, req);
      });
    } else if (pathname.startsWith('/ws/runtime/app/')) {
      // /ws/runtime/app/ 경로가 /ws/runtime/ 보다 먼저 매칭되어야 함
      appWss.handleUpgrade(req, socket, head, (ws) => {
        appWss.emit('connection', ws, req);
      });
    } else if (pathname.startsWith('/ws/runtime/')) {
      runtimeWss.handleUpgrade(req, socket, head, (ws) => {
        runtimeWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  console.log('[ws] WebSocket server initialized');
}
