import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import type { JwtPayload } from '../middleware/auth.js';

/**
 * WebSocket 업그레이드 요청에서 JWT 토큰을 검증한다.
 * 성공 시 JwtPayload 반환, 실패 시 소켓에 401 응답 후 null 반환.
 */
export function authenticateWsUpgrade(
  req: IncomingMessage,
  socket: Duplex,
): JwtPayload | null {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return payload;
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return null;
  }
}
