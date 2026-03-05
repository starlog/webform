import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { ShellService } from '../services/ShellService.js';
import { AppError } from '../middleware/errorHandler.js';

export const passwordAuthRouter = Router();
const shellService = new ShellService();

/**
 * POST /auth/password/login
 * Body: { projectId, username, password }
 * Shell의 auth.users 목록과 대조하여 JWT 발급.
 */
passwordAuthRouter.post('/password/login', async (req, res, next) => {
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

    // bcrypt 해시이면 비교, 아니면 평문 비교
    let passwordMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = user.password === password;
    }

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
