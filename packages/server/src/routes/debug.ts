import { Router } from 'express';
import { env } from '../config/index.js';
import { SandboxRunner } from '../services/SandboxRunner.js';
import type { MongoConnectorInfo, SwaggerConnectorInfo } from '../services/SandboxRunner.js';
import { buildControlsContext } from '../services/ControlProxy.js';
import { parseSwaggerSpec } from '../services/SwaggerParser.js';

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
    const { code, formState, controlId, debugMode, controls: formControls } = req.body as {
      code: string;
      formState: Record<string, Record<string, unknown>>;
      controlId?: string;
      debugMode?: boolean;
      controls?: Array<{ type: string; name: string; properties: Record<string, unknown>; children?: unknown[] }>;
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

    // MongoDBConnector / SwaggerConnector 추출
    const mongoConnectors: MongoConnectorInfo[] = [];
    const swaggerConnectors: SwaggerConnectorInfo[] = [];
    if (formControls) {
      const walk = (ctrls: typeof formControls) => {
        for (const ctrl of ctrls) {
          if (ctrl.type === 'MongoDBConnector') {
            mongoConnectors.push({
              controlName: ctrl.name,
              connectionString: (ctrl.properties.connectionString as string) || '',
              database: (ctrl.properties.database as string) || '',
              defaultCollection: (ctrl.properties.defaultCollection as string) || '',
              queryTimeout: (ctrl.properties.queryTimeout as number) || 10000,
              maxResultCount: (ctrl.properties.maxResultCount as number) || 1000,
            });
          }
          if (ctrl.type === 'SwaggerConnector') {
            const specYaml = (ctrl.properties.specYaml as string) || '';
            if (specYaml) {
              try {
                const parsed = parseSwaggerSpec(specYaml);
                const baseUrl = (ctrl.properties.baseUrl as string) || parsed.baseUrl;
                let defaultHeaders: Record<string, string> = {};
                try {
                  defaultHeaders = JSON.parse((ctrl.properties.defaultHeaders as string) || '{}');
                } catch { /* ignore */ }
                swaggerConnectors.push({
                  controlName: ctrl.name,
                  operations: parsed.operations,
                  baseUrl,
                  defaultHeaders,
                  timeout: (ctrl.properties.timeout as number) || 10000,
                });
              } catch {
                // specYaml 파싱 실패 시 무시
              }
            }
          }
          if (Array.isArray(ctrl.children)) walk(ctrl.children as typeof formControls);
        }
      };
      walk(formControls);
    }

    const result = await sandboxRunner.runCode(code, ctx, {
      timeout: env.SANDBOX_TIMEOUT_MS,
      memoryLimit: env.SANDBOX_MEMORY_LIMIT_MB,
      debugMode: enableDebug,
      mongoConnectors,
      swaggerConnectors,
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

    // operations 배열에서 controlChanges와 messages 추출
    const operations = Array.isArray(rv?.operations) ? rv.operations as { type: string; target: string; payload: unknown }[] : [];
    const controlChanges: Record<string, Record<string, unknown>> = {};
    const messages: unknown[] = [];
    for (const op of operations) {
      if (op.type === 'updateProperty') {
        controlChanges[op.target] = {
          ...controlChanges[op.target],
          ...(op.payload as Record<string, unknown>),
        };
      } else if (op.type === 'showDialog') {
        messages.push(op.payload);
      }
    }

    res.json({
      success: true,
      logs,
      traces,
      controlChanges: Object.keys(controlChanges).length > 0 ? controlChanges : undefined,
      messages,
      executionTime,
    });
  } catch (err) {
    next(err);
  }
});
