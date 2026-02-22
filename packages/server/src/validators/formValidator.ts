import { z } from 'zod';
import type { RequestHandler } from 'express';
import { CONTROL_TYPES } from '@webform/common';

const fontSchema = z.object({
  family: z.string().default('Segoe UI'),
  size: z.number().positive().default(9),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strikethrough: z.boolean().default(false),
});

const formPropertiesSchema = z.object({
  title: z.string().default(''),
  width: z.number().positive().default(800),
  height: z.number().positive().default(600),
  backgroundColor: z.string().default('#FFFFFF'),
  font: fontSchema.default({}),
  startPosition: z.enum(['CenterScreen', 'Manual', 'CenterParent']).default('CenterScreen'),
  formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).default('Sizable'),
  maximizeBox: z.boolean().default(true),
  minimizeBox: z.boolean().default(true),
});

const anchorStyleSchema = z.object({
  top: z.boolean().default(true),
  bottom: z.boolean().default(false),
  left: z.boolean().default(true),
  right: z.boolean().default(false),
});

const controlDefinitionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.enum(CONTROL_TYPES as unknown as [string, ...string[]]),
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ width: z.number().positive(), height: z.number().positive() }),
    children: z.array(controlDefinitionSchema).optional(),
    anchor: anchorStyleSchema.default({}),
    dock: z.enum(['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill']).default('None'),
    tabIndex: z.number().int().nonnegative().default(0),
    visible: z.boolean().default(true),
    enabled: z.boolean().default(true),
  }),
);

const eventHandlerSchema = z.object({
  controlId: z.string().min(1),
  eventName: z.string().min(1),
  handlerType: z.enum(['server', 'client']),
  handlerCode: z.string(),
});

const dataBindingSchema = z.object({
  controlId: z.string().min(1),
  controlProperty: z.string().min(1),
  dataSourceId: z.string().min(1),
  dataField: z.string(),
  bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']),
});

export const createFormSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().min(1),
  properties: formPropertiesSchema.default({}),
  controls: z.array(controlDefinitionSchema).default([]),
  eventHandlers: z.array(eventHandlerSchema).default([]),
  dataBindings: z.array(dataBindingSchema).default([]),
});

export type CreateFormInput = z.infer<typeof createFormSchema>;

export const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  properties: formPropertiesSchema.partial().optional(),
  controls: z.array(controlDefinitionSchema).optional(),
  eventHandlers: z.array(eventHandlerSchema).optional(),
  dataBindings: z.array(dataBindingSchema).optional(),
});

export type UpdateFormInput = z.infer<typeof updateFormSchema>;

export const listFormsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  projectId: z.string().optional(),
});

export type ListFormsQuery = z.infer<typeof listFormsQuerySchema>;

export function validateRequest(schema: z.ZodSchema, source: 'body' | 'query' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(source === 'body' ? req.body : req.query);
    if (source === 'body') {
      req.body = parsed;
    } else {
      (req as any).validatedQuery = parsed;
    }
    next();
  };
}
