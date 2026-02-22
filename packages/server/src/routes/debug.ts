import { Router } from 'express';
import { env } from '../config/index.js';
import { SandboxRunner } from '../services/SandboxRunner.js';
import { buildControlsContext } from '../services/ControlProxy.js';

export const debugRouter = Router();

// production 환경에서는 모든 요청에 404 반환
debugRouter.use((_req, res, next) => {
  if (env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
});

const sandboxRunner = new SandboxRunner();

// POST /api/debug/execute — 코드 테스트 실행
debugRouter.post('/execute', async (req, res, next) => {
  try {
    const { code, formState, controlId } = req.body as {
      code: string;
      formState: Record<string, Record<string, unknown>>;
      controlId?: string;
    };

    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'code is required' });
      return;
    }

    const controls = buildControlsContext(formState ?? {});
    const sender = controlId && formState?.[controlId] ? formState[controlId] : {};

    const ctx = {
      controls,
      sender,
      eventArgs: {},
    };

    const result = await sandboxRunner.runCode(code, ctx, {
      timeout: env.SANDBOX_TIMEOUT_MS,
      memoryLimit: env.SANDBOX_MEMORY_LIMIT_MB,
    });

    if (!result.success) {
      res.json({
        success: false,
        logs: [],
        error: result.error,
        errorLine: result.errorLine,
      });
      return;
    }

    const rv = result.value as Record<string, unknown> | undefined;
    const logs = Array.isArray(rv?.logs) ? rv.logs : [];
    const controlChanges = rv?.controls as Record<string, Record<string, unknown>> | undefined;

    res.json({
      success: true,
      logs,
      controlChanges,
    });
  } catch (err) {
    next(err);
  }
});
