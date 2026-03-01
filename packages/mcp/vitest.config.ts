import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/phase*-integration.test.ts', 'src/__tests__/phase*-performance.test.ts'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/tools/**'],
    },
  },
});
