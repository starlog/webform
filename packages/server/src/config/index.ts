import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // 서버
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  // MongoDB
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/webform'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),

  // 암호화 (데이터소스 connectionString AES-256 암호화)
  ENCRYPTION_KEY: z.string().length(64), // 32바이트 = 64 hex chars

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((v) => v.split(',')),

  // 샌드박스
  SANDBOX_TIMEOUT_MS: z.coerce.number().default(5000),
  SANDBOX_MEMORY_LIMIT_MB: z.coerce.number().default(128),

  // Google OAuth2
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RUNTIME_BASE_URL: z.string().optional().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
