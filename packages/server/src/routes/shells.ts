import { Router } from 'express';
import type { Request } from 'express';
import { ShellService } from '../services/ShellService.js';
import { EncryptionService } from '../services/EncryptionService.js';
import { z } from 'zod';

const encryptionService = new EncryptionService();

type ShellParams = { projectId: string };

/** auth.googleClientSecret를 암호화하여 저장용 데이터 변환 */
function encryptAuthSecret<T extends { properties?: unknown }>(data: T): T {
  const props = data.properties as Record<string, unknown> | undefined;
  const auth = props?.auth as Record<string, unknown> | undefined;
  if (auth?.googleClientSecret && typeof auth.googleClientSecret === 'string' && auth.googleClientSecret !== '') {
    return {
      ...data,
      properties: {
        ...props,
        auth: {
          ...auth,
          googleClientSecret: encryptionService.encrypt(auth.googleClientSecret),
        },
      },
    };
  }
  return data;
}

/** Shell 응답에서 auth.googleClientSecret를 복호화 */
function decryptAuthSecret(shell: Record<string, unknown>): Record<string, unknown> {
  const props = shell.properties as Record<string, unknown> | undefined;
  const auth = props?.auth as Record<string, unknown> | undefined;
  if (auth?.googleClientSecret && typeof auth.googleClientSecret === 'string' && auth.googleClientSecret !== '') {
    try {
      return {
        ...shell,
        properties: {
          ...props,
          auth: {
            ...auth,
            googleClientSecret: encryptionService.decrypt(auth.googleClientSecret),
          },
        },
      };
    } catch {
      // 암호화되지 않은 기존 데이터 → 그대로 반환
      return shell;
    }
  }
  return shell;
}

export const shellsRouter = Router({ mergeParams: true });
const shellService = new ShellService();

const shellPropertiesSchema = z.object({
  title: z.string().default(''),
  width: z.number().positive().default(1024),
  height: z.number().positive().default(768),
  backgroundColor: z.string().default('#FFFFFF'),
  font: z
    .object({
      family: z.string().default('Segoe UI'),
      size: z.number().positive().default(9),
      bold: z.boolean().default(false),
      italic: z.boolean().default(false),
      underline: z.boolean().default(false),
      strikethrough: z.boolean().default(false),
    })
    .default({}),
  showTitleBar: z.boolean().default(true),
  formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).default('Sizable'),
  maximizeBox: z.boolean().default(true),
  minimizeBox: z.boolean().default(true),
  windowState: z.enum(['Normal', 'Maximized']).default('Normal'),
  theme: z.string().optional(),
  auth: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.literal('google').default('google'),
      googleClientId: z.string().default(''),
      googleClientSecret: z.string().default(''),
      runtimeBaseUrl: z.string().default('http://localhost:3001'),
      allowedDomains: z.array(z.string()).default([]),
    })
    .optional(),
});

const createShellSchema = z.object({
  name: z.string().min(1).max(200),
  properties: shellPropertiesSchema.default({}),
  controls: z.array(z.unknown()).default([]),
  eventHandlers: z.array(z.unknown()).default([]),
  startFormId: z.string().optional(),
});

const updateShellSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  properties: shellPropertiesSchema.partial().optional(),
  controls: z.array(z.unknown()).optional(),
  eventHandlers: z.array(z.unknown()).optional(),
  startFormId: z.string().optional().nullable(),
});

// GET /api/projects/:projectId/shell — Shell 조회 (없으면 data: null)
shellsRouter.get('/', async (req: Request<ShellParams>, res, next) => {
  try {
    const shell = await shellService.findShellByProjectId(req.params.projectId);
    if (shell) {
      const plain = JSON.parse(JSON.stringify(shell));
      res.json({ data: decryptAuthSecret(plain) });
    } else {
      res.json({ data: null });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/shell — Shell 생성
shellsRouter.post('/', async (req: Request<ShellParams>, res, next) => {
  try {
    const input = createShellSchema.parse(req.body);
    const encrypted = encryptAuthSecret(input);
    const shell = await shellService.createShell(req.params.projectId, encrypted, req.user!.sub);
    res.status(201).json({ data: shell });
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/shell — Shell 수정
shellsRouter.put('/', async (req: Request<ShellParams>, res, next) => {
  try {
    const input = updateShellSchema.parse(req.body);
    const encrypted = encryptAuthSecret(input);
    const shell = await shellService.updateShell(req.params.projectId, encrypted, req.user!.sub);
    res.json({ data: shell });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/shell — Shell 삭제
shellsRouter.delete('/', async (req: Request<ShellParams>, res, next) => {
  try {
    await shellService.deleteShell(req.params.projectId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/shell/publish — Shell 퍼블리시
shellsRouter.post('/publish', async (req: Request<ShellParams>, res, next) => {
  try {
    const shell = await shellService.publishShell(req.params.projectId, req.user!.sub);
    res.json({ data: shell });
  } catch (err) {
    next(err);
  }
});
