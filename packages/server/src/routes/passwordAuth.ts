import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { ShellService } from '../services/ShellService.js';
import { AppError } from '../middleware/errorHandler.js';

export const passwordAuthRouter = Router();
const shellService = new ShellService();

// 브루트포스 방지: IP당 5분에 20회까지 로그인 시도 허용
const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

/**
 * POST /auth/password/login
 * Body: { projectId, username, password }
 * Shell의 auth.users 목록과 대조하여 JWT 발급.
 */
passwordAuthRouter.post('/password/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { projectId, username, password } = req.body;

    if (!projectId || !username || !password) {
      throw new AppError(400, 'projectId, username, password are required');
    }

    const shell = await shellService.getPublishedShell(projectId);
    if (!shell) {
      throw new AppError(404, 'Published shell not found');
    }

    const auth = shell.properties.auth;
    if (!auth?.enabled || auth.provider !== 'password') {
      throw new AppError(400, 'Password authentication is not enabled for this project');
    }

    const users = auth.users ?? [];
    const user = users.find((u) => u.username === username);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // bcrypt 해시만 허용 (평문 저장된 기존 비밀번호는 Shell 재저장으로 해싱됨)
    const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
    const passwordMatch = isBcryptHash && (await bcrypt.compare(password, user.password));

    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const runtimeToken = jwt.sign(
      {
        sub: username,
        role: 'runtime-user',
        projectId,
        provider: 'password',
        email: username,
        name: username,
        picture: '',
      },
      env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    res.cookie('runtime_auth_token', runtimeToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ token: runtimeToken });
  } catch (err) {
    next(err);
  }
});
