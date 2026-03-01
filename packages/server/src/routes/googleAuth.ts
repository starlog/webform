import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { ShellService } from '../services/ShellService.js';
import { AppError } from '../middleware/errorHandler.js';

export const googleAuthRouter = Router();
const shellService = new ShellService();

/** state 파라미터를 JSON으로 인코딩 (projectId + 원래 쿼리 파라미터 보존) */
function encodeState(params: Record<string, string>): string {
  return Buffer.from(JSON.stringify(params)).toString('base64url');
}

function decodeState(state: string): Record<string, string> {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    // 하위 호환: 이전 형식 (plain projectId)
    return { projectId: state };
  }
}

/** Runtime으로 에러 리다이렉트 */
function redirectWithError(res: import('express').Response, projectId: string, errorCode: string) {
  const url = new URL(env.RUNTIME_BASE_URL);
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('authError', errorCode);
  res.redirect(url.toString());
}

/**
 * GET /auth/google/login?projectId=xxx&formId=yyy&...
 * Shell의 auth 설정으로 Google 인증 URL 생성 → 리다이렉트
 */
googleAuthRouter.get('/google/login', async (req, res, next) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      throw new AppError(400, 'projectId query parameter is required');
    }

    const shell = await shellService.getPublishedShell(projectId);
    if (!shell) {
      redirectWithError(res, projectId, 'shell_not_found');
      return;
    }

    const auth = shell.properties.auth;
    if (!auth?.enabled || !auth.googleClientId) {
      redirectWithError(res, projectId, 'auth_not_configured');
      return;
    }

    if (!env.GOOGLE_CLIENT_SECRET) {
      redirectWithError(res, projectId, 'server_not_configured');
      return;
    }

    const callbackUrl = `${env.RUNTIME_BASE_URL}/auth/google/callback`;
    const oauth2Client = new OAuth2Client(
      auth.googleClientId,
      env.GOOGLE_CLIENT_SECRET,
      callbackUrl,
    );

    // 원래 쿼리 파라미터를 state에 보존 (formId 등)
    const stateParams: Record<string, string> = { projectId };
    if (req.query.formId) stateParams.formId = req.query.formId as string;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: encodeState(stateParams),
      prompt: 'select_account',
    });

    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/google/callback?code=xxx&state=base64(json)
 * Authorization code → 토큰 교환 → allowedDomains 검증 → Runtime JWT 발급
 */
googleAuthRouter.get('/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;

    if (!code || !stateRaw) {
      throw new AppError(400, 'Missing code or state parameter');
    }

    const stateParams = decodeState(stateRaw);
    const projectId = stateParams.projectId;

    if (!projectId) {
      throw new AppError(400, 'Missing projectId in state');
    }

    const shell = await shellService.getPublishedShell(projectId);
    if (!shell) {
      redirectWithError(res, projectId, 'shell_not_found');
      return;
    }

    const auth = shell.properties.auth;
    if (!auth?.enabled || !auth.googleClientId) {
      redirectWithError(res, projectId, 'auth_not_configured');
      return;
    }

    if (!env.GOOGLE_CLIENT_SECRET) {
      redirectWithError(res, projectId, 'server_not_configured');
      return;
    }

    const callbackUrl = `${env.RUNTIME_BASE_URL}/auth/google/callback`;
    const oauth2Client = new OAuth2Client(
      auth.googleClientId,
      env.GOOGLE_CLIENT_SECRET,
      callbackUrl,
    );

    // Authorization code → tokens 교환
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.id_token) {
      redirectWithError(res, projectId, 'token_exchange_failed');
      return;
    }

    // ID token 검증
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: auth.googleClientId,
    });

    const googlePayload = ticket.getPayload();
    if (!googlePayload) {
      redirectWithError(res, projectId, 'invalid_token');
      return;
    }

    const email = googlePayload.email;
    if (!email) {
      redirectWithError(res, projectId, 'no_email');
      return;
    }

    // allowedDomains 검증
    if (auth.allowedDomains.length > 0) {
      const domain = email.split('@')[1];
      if (!auth.allowedDomains.includes(domain)) {
        redirectWithError(res, projectId, 'domain_not_allowed');
        return;
      }
    }

    // Runtime용 JWT 발급
    const runtimeToken = jwt.sign(
      {
        sub: email,
        role: 'runtime-user',
        projectId,
        email,
        name: googlePayload.name || '',
        picture: googlePayload.picture || '',
      },
      env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    // Runtime으로 리다이렉트 (원래 쿼리 파라미터 복원 + fragment에 토큰)
    const redirectUrl = new URL(env.RUNTIME_BASE_URL);
    redirectUrl.searchParams.set('projectId', projectId);
    if (stateParams.formId) {
      redirectUrl.searchParams.set('formId', stateParams.formId);
    }
    res.redirect(`${redirectUrl.toString()}#auth_token=${runtimeToken}`);
  } catch (err) {
    next(err);
  }
});
