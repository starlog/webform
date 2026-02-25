import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET:
        process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY:
        process.env.ENCRYPTION_KEY ??
        '0000000000000000000000000000000000000000000000000000000000000000',
      CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/webform-test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
  },
});
