import { Router } from 'express';
import type { EventRequest } from '@webform/common';
import { Form } from '../models/Form.js';
import { EventEngine } from '../services/EventEngine.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';

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
