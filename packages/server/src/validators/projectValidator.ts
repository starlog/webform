import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
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
  }),
  forms: z.array(z.object({
    name: z.string().min(1),
    properties: z.record(z.unknown()).default({}),
    controls: z.array(z.unknown()).default([]),
    eventHandlers: z.array(z.unknown()).default([]),
    dataBindings: z.array(z.unknown()).default([]),
  })),
});

export type ImportProjectInput = z.infer<typeof importProjectSchema>;
