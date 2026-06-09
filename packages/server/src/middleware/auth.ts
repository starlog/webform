import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/index.js';
import { AppError } from './errorHandler.js';

export interface JwtPayload {
  sub: string;
  role: string;
}

function isLoopback(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
}

/**
 * 지정한 역할만 통과시키는 가드. authenticate 이후에 사용해야 한다.
 * 런타임 사용자 토큰(role: 'runtime-user')이 디자이너 API를 호출하는 것을 차단한다.
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'Insufficient permissions');
    }
    next();
  };
}

export const authenticate: RequestHandler = (req, _res, next) => {
  // 샌드박스 내부 API 호출 허용 (SandboxRunner에서만 설정)
  if (req.headers['x-sandbox-internal'] === 'true' && req.ip && isLoopback(req.ip)) {
    req.user = { sub: 'sandbox', role: 'internal' };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
};
