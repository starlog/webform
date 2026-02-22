import { z } from 'zod';

// Database config (현재 MongoDB만 지원)
const databaseConfigSchema = z.object({
  dialect: z.literal('mongodb'),
  connectionString: z.string().min(1),
  database: z.string().min(1),
});

// REST API auth config
const authConfigSchema = z.object({
  type: z.enum(['bearer', 'basic', 'apiKey']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  headerName: z.string().optional(),
});

// REST API config
const restApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  headers: z.record(z.string()).default({}),
  auth: authConfigSchema.optional(),
});

// Static config
const staticConfigSchema = z.object({
  data: z.array(z.unknown()),
});

// 생성: discriminated union으로 type별 config 검증
export const createDataSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('database'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: databaseConfigSchema,
  }),
  z.object({
    type: z.literal('restApi'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: restApiConfigSchema,
  }),
  z.object({
    type: z.literal('static'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: staticConfigSchema,
  }),
]);

export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;

// 수정
export const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  config: z.union([databaseConfigSchema, restApiConfigSchema, staticConfigSchema]).optional(),
});

export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;

// 목록 쿼리
export const listDataSourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['database', 'restApi', 'static']).optional(),
  projectId: z.string().optional(),
});

export type ListDataSourcesQuery = z.infer<typeof listDataSourcesQuerySchema>;

// 쿼리 실행 (타입별 쿼리 형식이 다르므로 passthrough)
export const executeQuerySchema = z.object({}).passthrough();
