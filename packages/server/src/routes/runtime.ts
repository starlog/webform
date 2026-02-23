import { Router } from 'express';
import type { EventRequest } from '@webform/common';
import { ObjectId } from 'mongodb';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';
import { MongoDBAdapter } from '../services/adapters/MongoDBAdapter.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';

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

    res.json({
      id: form._id.toString(),
      name: form.name,
      version: form.version,
      properties: form.properties,
      controls: form.controls,
      eventHandlers: form.eventHandlers
        .filter((h) => h.handlerType === 'server')
        .map((h) => ({
          controlId: h.controlId,
          eventName: h.eventName,
          handlerType: h.handlerType,
        })),
      dataBindings: form.dataBindings,
    });
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

    const formDef = {
      id: form._id.toString(),
      name: form.name,
      version: form.version,
      properties: form.properties,
      controls: form.controls,
      eventHandlers: form.eventHandlers,
      dataBindings: form.dataBindings,
    };

    const result = await eventEngine.executeEvent(
      req.params.id,
      payload,
      formDef,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/runtime/forms/:id/data
 * 데이터소스 쿼리를 실행한다. (스텁)
 */
runtimeRouter.post('/forms/:id/data', async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.id);

    if (!form) {
      throw new NotFoundError('Form not found');
    }

    // TODO: DataSourceService.executeQuery 구현
    res.json({
      success: true,
      data: [],
      message: 'Data source query not yet implemented',
    });
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
