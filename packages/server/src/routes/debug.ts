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
    const { code, formState, controlId, debugMode } = req.body as {
      code: string;
      formState: Record<string, Record<string, unknown>>;
      controlId?: string;
      debugMode?: boolean;
    };

    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'code is required' });
      return;
    }

    // debugMode 기본값: true
    const enableDebug = debugMode !== false;

    const controls = buildControlsContext(formState ?? {});
    const sender = controlId && formState?.[controlId] ? formState[controlId] : {};

    const ctx = {
      controls,
      sender,
      eventArgs: {},
    };

    const startTime = performance.now();

    const result = await sandboxRunner.runCode(code, ctx, {
      timeout: env.SANDBOX_TIMEOUT_MS,
      memoryLimit: env.SANDBOX_MEMORY_LIMIT_MB,
      debugMode: enableDebug,
    });

    const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

    if (!result.success) {
      res.json({
        success: false,
        logs: [],
        traces: enableDebug ? result.traces : undefined,
        error: result.error,
        errorLine: result.errorLine,
        executionTime,
      });
      return;
    }

    const rv = result.value as Record<string, unknown> | undefined;
    const logs = Array.isArray(rv?.logs) ? rv.logs : [];
    const traces = result.traces ?? (Array.isArray(rv?.traces) ? rv.traces : undefined);
    const controlChanges = rv?.controls as Record<string, Record<string, unknown>> | undefined;

    res.json({
      success: true,
      logs,
      traces,
      controlChanges,
      executionTime,
    });
  } catch (err) {
    next(err);
  }
});
