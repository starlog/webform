import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, _res, next) => {
  req.id = (req.headers['x-request-id'] as string) ?? randomUUID();
  next();
};
