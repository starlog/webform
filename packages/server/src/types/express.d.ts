import type { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: JwtPayload;
    }
  }
}
