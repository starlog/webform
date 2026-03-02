import { Router } from 'express';
import type { EventRequest, ShellEventRequest } from '@webform/common';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';
import { MongoDBAdapter } from '../services/adapters/MongoDBAdapter.js';
import '../services/adapters/index.js'; // 팩토리 등록 보장
import { adapterRegistry } from '../services/adapters/AdapterRegistry.js';
import { RestApiAdapter } from '../services/adapters/RestApiAdapter.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { toFormDef } from '../utils/formUtils.js';
import { ShellService } from '../services/ShellService.js';
import type { ShellDocument } from '../models/Shell.js';
import { ThemeService } from '../services/ThemeService.js';
import { env } from '../config/index.js';

function toObjectId(value: unknown): ObjectId | unknown {
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) {
    return new ObjectId(value);
  }
  return value;
}

function convertIds(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id') {
      result[key] = toObjectId(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const runtimeRouter = Router();
const eventEngine = new EventEngine();
const shellService = new ShellService();
const themeService = new ThemeService();

/** ShellDocument → 런타임용 Shell 정의 변환 (서버 핸들러만 노출) */
function toShellDefinition(shell: ShellDocument) {
  return {
    id: shell._id.toString(),
    projectId: shell.projectId,
    name: shell.name,
    version: shell.version,
    properties: shell.properties,
    controls: stripItemScripts(shell.controls),
    eventHandlers: shell.eventHandlers
      .filter((h) => h.handlerType === 'server')
      .map((h) => ({
        controlId: h.controlId,
        eventName: h.eventName,
        handlerType: h.handlerType,
      })),
    startFormId: shell.startFormId,
  };
}

/** items 배열 내 script → hasScript 변환 (재귀) */
function replaceScriptsWithFlags(items: unknown[]): unknown[] {
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const obj = { ...(item as Record<string, unknown>) };
    if (obj.script) {
      delete obj.script;
      obj.hasScript = true;
    }
    // MenuStrip children
    if (Array.isArray(obj.children)) {
      obj.children = replaceScriptsWithFlags(obj.children);
    }
    // ToolStrip dropdown items
    if (Array.isArray(obj.items)) {
      obj.items = replaceScriptsWithFlags(obj.items);
    }
    return obj;
  });
}

/** controls 재귀 순회하여 properties.items 내 script를 hasScript로 변환 */
function stripItemScripts(controls: unknown[]): unknown[] {
  // Mongoose 문서를 plain object로 변환 후 처리
  const plain = JSON.parse(JSON.stringify(controls)) as unknown[];
  return plain.map((ctrl) => {
    if (!ctrl || typeof ctrl !== 'object') return ctrl;
    const c = ctrl as Record<string, unknown>;
    if (c.properties && typeof c.properties === 'object') {
      const props = c.properties as Record<string, unknown>;
      if (Array.isArray(props.items)) {
        props.items = replaceScriptsWithFlags(props.items);
      }
    }
    if (Array.isArray(c.children)) {
      c.children = stripItemScripts(c.children);
    }
    return c;
  });
}

/** FormDocument → 런타임용 폼 정의 변환 (서버 핸들러만 노출) */
function toRuntimeFormDef(form: {
  _id: { toString(): string };
  name: string;
  version: number;
  properties: unknown;
  controls: unknown[];
  eventHandlers: Array<{ controlId: string; eventName: string; handlerType: string }>;
}) {
  return {
    id: form._id.toString(),
    name: form.name,
    version: form.version,
    properties: form.properties,
    controls: stripItemScripts(form.controls),
    eventHandlers: form.eventHandlers
      .filter((h) => h.handlerType === 'server')
      .map((h) => ({
        controlId: h.controlId,
        eventName: h.eventName,
        handlerType: h.handlerType,
      })),
  };
}

/**
 * GET /api/runtime/forms/:id
 * published 상태의 폼 정의만 반환한다.
 */
runtimeRouter.get('/forms/:id', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Form not published');
    }

    res.json(toRuntimeFormDef(form));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/forms/:id/events
 * 이벤트를 실행하고 UIPatch 배열을 반환한다.
 */
runtimeRouter.post('/forms/:id/events', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Form not published');
    }

    const payload = req.body as EventRequest;

    if (!payload.controlId || !payload.eventName || !payload.formState) {
      throw new AppError(400, 'Missing required fields: controlId, eventName, formState');
    }

    const formDef = toFormDef(form);

    const debugMode = !!(req.body as { debugMode?: boolean }).debugMode;
    const result = await eventEngine.executeEvent(
      req.params.id,
      payload,
      formDef,
      { debugMode },
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/mongodb/test-connection
 * MongoDB 연결 테스트
 */
runtimeRouter.post('/mongodb/test-connection', async (req, res, next) => {
  try {
    const { connectionString, database } = req.body as {
      connectionString?: string;
      database?: string;
    };

    if (!connectionString || !database) {
      throw new AppError(400, 'connectionString and database are required');
    }

    const adapter = new MongoDBAdapter(connectionString, database);
    const result = await adapter.testConnection();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/mongodb/query
 * MongoDBView 컨트롤용 문서 조회
 */
runtimeRouter.post('/mongodb/query', async (req, res, next) => {
  try {
    const { connectionString, database, collection, filter = {}, skip = 0, limit = 100 } = req.body as {
      connectionString?: string;
      database?: string;
      collection?: string;
      filter?: Record<string, unknown>;
      skip?: number;
      limit?: number;
    };

    if (!connectionString || !database || !collection) {
      throw new AppError(400, 'connectionString, database, collection are required');
    }

    const adapter = new MongoDBAdapter(connectionString, database);
    const convertedFilter = convertIds(filter);
    const [data, totalCount] = await Promise.all([
      adapter.executeQuery({ collection, filter: convertedFilter, skip, limit }),
      adapter.countDocuments(collection, convertedFilter),
    ]);
    res.json({ success: true, data, totalCount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/mongodb/insert
 * MongoDBView 컨트롤용 문서 삽입
 */
runtimeRouter.post('/mongodb/insert', async (req, res, next) => {
  try {
    const { connectionString, database, collection, document } = req.body as {
      connectionString?: string;
      database?: string;
      collection?: string;
      document?: Record<string, unknown>;
    };

    if (!connectionString || !database || !collection || !document) {
      throw new AppError(400, 'connectionString, database, collection, document are required');
    }

    const adapter = new MongoDBAdapter(connectionString, database);
    const result = await adapter.insertOne(collection, document);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/mongodb/update
 * MongoDBView 컨트롤용 문서 수정
 */
runtimeRouter.post('/mongodb/update', async (req, res, next) => {
  try {
    const { connectionString, database, collection, filter, update } = req.body as {
      connectionString?: string;
      database?: string;
      collection?: string;
      filter?: Record<string, unknown>;
      update?: Record<string, unknown>;
    };

    if (!connectionString || !database || !collection || !filter || !update) {
      throw new AppError(400, 'connectionString, database, collection, filter, update are required');
    }

    const adapter = new MongoDBAdapter(connectionString, database);
    const result = await adapter.updateOne(collection, convertIds(filter), update);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/mongodb/delete
 * MongoDBView 컨트롤용 문서 삭제
 */
runtimeRouter.post('/mongodb/delete', async (req, res, next) => {
  try {
    const { connectionString, database, collection, filter } = req.body as {
      connectionString?: string;
      database?: string;
      collection?: string;
      filter?: Record<string, unknown>;
    };

    if (!connectionString || !database || !collection || !filter) {
      throw new AppError(400, 'connectionString, database, collection, filter are required');
    }

    const adapter = new MongoDBAdapter(connectionString, database);
    const result = await adapter.deleteOne(collection, convertIds(filter));
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── DataSourceConnector Test API ─────────────────────────────────────────────

/**
 * POST /api/runtime/datasource/test-connection
 * DataSourceConnector 연결 테스트
 */
runtimeRouter.post('/datasource/test-connection', async (req, res, next) => {
  try {
    const { dsType, dialect, host, port, user, password, database, ssl,
            baseUrl, headers, authType, authCredentials,
            connectionString } = req.body as Record<string, unknown>;

    if (dsType === 'database') {
      if (dialect === 'mongodb') {
        if (!connectionString || !database) {
          throw new AppError(400, 'connectionString and database are required');
        }
        const adapter = new MongoDBAdapter(connectionString as string, database as string);
        const result = await adapter.testConnection();
        res.json(result);
        return;
      }
      const config = { host, port, user, password, database, ssl } as Record<string, unknown>;
      const adapter = adapterRegistry.create(dialect as string, config);
      try {
        const result = await adapter.testConnection();
        res.json(result);
      } finally {
        await adapter.disconnect();
      }
    } else if (dsType === 'restApi') {
      const config: Record<string, unknown> = { baseUrl, headers };
      if (authType && authCredentials) {
        config.auth = { type: authType, ...(authCredentials as object) };
      }
      const adapter = new RestApiAdapter(config as { baseUrl: string; headers?: Record<string, string> });
      const result = await adapter.testConnection();
      res.json(result);
    } else if (dsType === 'static') {
      res.json({ success: true, message: 'Static data source — always connected' });
    } else {
      throw new AppError(400, `Unsupported dsType: ${dsType}`);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/datasource/list-tables
 * DataSourceConnector 테이블/컬렉션 목록 조회
 */
runtimeRouter.post('/datasource/list-tables', async (req, res, next) => {
  try {
    const { dsType, dialect, host, port, user, password, database, ssl,
            connectionString } = req.body as Record<string, unknown>;

    if (dsType !== 'database') {
      throw new AppError(400, 'list-tables is only supported for database dsType');
    }

    if (dialect === 'mongodb') {
      if (!connectionString || !database) {
        throw new AppError(400, 'connectionString and database are required');
      }
      const adapter = new MongoDBAdapter(connectionString as string, database as string);
      const tables = await adapter.listTables();
      res.json({ success: true, tables });
      return;
    }

    const config = { host, port, user, password, database, ssl } as Record<string, unknown>;
    const adapter = adapterRegistry.create(dialect as string, config);
    try {
      const tables = await adapter.listTables();
      res.json({ success: true, tables });
    } finally {
      await adapter.disconnect();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/datasource/query
 * DataSourceConnector 쿼리 실행
 */
runtimeRouter.post('/datasource/query', async (req, res, next) => {
  try {
    const { dsType, dialect, host, port, user, password, database, ssl,
            baseUrl, headers, authType, authCredentials,
            connectionString, query, params, data } = req.body as Record<string, unknown>;

    if (!dsType) {
      throw new AppError(400, 'dsType is required');
    }

    if (dsType === 'database') {
      if (dialect === 'mongodb') {
        if (!connectionString || !database) {
          throw new AppError(400, 'connectionString and database are required');
        }
        const adapter = new MongoDBAdapter(connectionString as string, database as string);
        const parsed = JSON.parse(query as string) as Record<string, unknown>;
        const result = await adapter.executeQuery(parsed);
        res.json({ success: true, data: result, rowCount: result.length });
        return;
      }
      if (!query || typeof query !== 'string') {
        throw new AppError(400, 'query is required for database dsType');
      }
      const config = { host, port, user, password, database, ssl } as Record<string, unknown>;
      const adapter = adapterRegistry.create(dialect as string, config);
      try {
        const result = await adapter.executeRawQuery(query as string, params as unknown[] | undefined);
        res.json({ success: true, data: result, rowCount: result.length });
      } finally {
        await adapter.disconnect();
      }
    } else if (dsType === 'restApi') {
      if (!query || typeof query !== 'string') {
        throw new AppError(400, 'query (JSON string) is required for restApi dsType');
      }
      const config: Record<string, unknown> = { baseUrl, headers };
      if (authType && authCredentials) {
        config.auth = { type: authType, ...(authCredentials as object) };
      }
      const adapter = new RestApiAdapter(config as { baseUrl: string; headers?: Record<string, string> });
      const parsed = JSON.parse(query as string) as Record<string, unknown>;
      const result = await adapter.executeQuery(parsed);
      res.json({ success: true, data: result, rowCount: result.length });
    } else if (dsType === 'static') {
      const parsed = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      res.json({ success: true, data: arr, rowCount: arr.length });
    } else {
      throw new AppError(400, `Unsupported dsType: ${dsType}`);
    }
  } catch (err) {
    next(err);
  }
});

// ─── Shell Runtime API ───────────────────────────────────────────────────────

/**
 * GET /api/runtime/shells/:projectId
 * 퍼블리시된 Shell 정의를 반환한다.
 */
runtimeRouter.get('/shells/:projectId', async (req, res, next) => {
  try {
    const shell = await shellService.getPublishedShell(req.params.projectId);

    if (!shell) {
      throw new NotFoundError('Published shell not found');
    }

    res.json(toShellDefinition(shell));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/shells/:projectId/events
 * Shell 이벤트를 실행하고 UIPatch 배열을 반환한다.
 * (스텁: server-shell-events 태스크에서 완성)
 */
runtimeRouter.post('/shells/:projectId/events', async (req, res, next) => {
  try {
    const shell = await shellService.getPublishedShell(req.params.projectId);

    if (!shell) {
      throw new NotFoundError('Published shell not found');
    }

    const payload = req.body as ShellEventRequest;

    if (!payload.controlId || !payload.eventName || !payload.shellState) {
      throw new AppError(400, 'Missing required fields: controlId, eventName, shellState');
    }

    const shellDef = {
      id: shell._id.toString(),
      projectId: shell.projectId,
      name: shell.name,
      version: shell.version,
      properties: shell.properties,
      controls: shell.controls,
      eventHandlers: shell.eventHandlers,
      startFormId: shell.startFormId,
    };

    const appState = (req.body as { appState?: Record<string, unknown> }).appState ?? {};

    const result = await eventEngine.executeShellEvent(
      req.params.projectId,
      payload,
      shellDef,
      appState,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/runtime/app/:projectId
 * AppLoadResponse: Shell(있으면) + 시작 폼을 일괄 반환한다.
 *
 * Query params:
 *   - formId?: string — 시작 폼 ID 직접 지정 (shell.startFormId 오버라이드)
 */
runtimeRouter.get('/app/:projectId', async (req, res, next) => {
  try {
    const shell = await shellService.getPublishedShell(req.params.projectId);

    // ── 인증 게이트 ──
    const auth = shell?.properties.auth;
    if (auth?.enabled) {
      const formIdParam = req.query.formId ? `&formId=${req.query.formId}` : '';
      const loginUrl = `${env.RUNTIME_BASE_URL}/auth/google/login?projectId=${req.params.projectId}${formIdParam}`;

      const header = req.headers.authorization;
      const cookieToken = req.cookies?.runtime_auth_token;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
      if (!token) {
        res.status(401).json({ authRequired: true, loginUrl });
        return;
      }

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as {
          role: string;
          projectId: string;
          email: string;
          name: string;
          picture: string;
        };
        if (payload.role !== 'runtime-user' || payload.projectId !== req.params.projectId) {
          res.status(401).json({ authRequired: true, loginUrl });
          return;
        }
        // 인증 성공 — authUser 정보를 응답에 포함
        (req as unknown as Record<string, unknown>)._authUser = {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        };
      } catch {
        res.status(401).json({ authRequired: true, loginUrl });
        return;
      }
    }

    const formId = (req.query.formId as string) || shell?.startFormId;

    if (!formId) {
      throw new AppError(400, 'No start form specified: set shell.startFormId or pass ?formId=');
    }

    const form = await Form.findById(formId);

    if (!form) {
      throw new NotFoundError('Start form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Start form not published');
    }

    const authUser = (req as unknown as Record<string, unknown>)._authUser as
      | { email: string; name: string; picture: string }
      | undefined;

    res.json({
      shell: shell ? toShellDefinition(shell) : null,
      startForm: toRuntimeFormDef(form),
      ...(authUser ? { authUser } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Theme Runtime API ────────────────────────────────────────────────────────

/**
 * GET /api/runtime/themes/preset/:presetId
 * presetId로 프리셋 테마를 조회한다 (인증 불필요).
 */
runtimeRouter.get('/themes/preset/:presetId', async (req, res, next) => {
  try {
    const theme = await themeService.getByPresetId(req.params.presetId);
    res.json({ data: theme });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/runtime/themes/:id
 * 테마를 _id로 조회한다 (인증 불필요).
 */
runtimeRouter.get('/themes/:id', async (req, res, next) => {
  try {
    const theme = await themeService.getById(req.params.id);
    res.json({ data: theme });
  } catch (err) {
    next(err);
  }
});
