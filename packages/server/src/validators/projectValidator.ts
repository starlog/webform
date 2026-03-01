import { z } from 'zod';

const fontSchema = z.object({
  family: z.string().min(1),
  size: z.number().positive(),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
  strikethrough: z.boolean(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  defaultFont: fontSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  defaultFont: fontSchema.optional().nullable(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const importProjectSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    description: z.string().default(''),
    defaultFont: fontSchema.optional(),
  }),
  forms: z.array(z.object({
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    controls: z.array(z.unknown()).default([]),
    eventHandlers: z.array(z.unknown()).default([]),
    dataBindings: z.array(z.unknown()).default([]),
  })),
  shell: z.object({
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    controls: z.array(z.unknown()).default([]),
    eventHandlers: z.array(z.unknown()).default([]),
    startFormId: z.string().optional(),
  }).optional(),
});

export type ImportProjectInput = z.infer<typeof importProjectSchema>;
