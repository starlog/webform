import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/index.js';
import { AppError } from './errorHandler.js';

export interface JwtPayload {
  sub: string;
  role: string;
}

export const authenticate: RequestHandler = (req, _res, next) => {
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
