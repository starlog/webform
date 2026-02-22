import { describe, it, expect } from 'vitest';
import { SandboxRunner } from '../services/SandboxRunner.js';

describe('SandboxRunner', () => {
  const runner = new SandboxRunner();

  it('단순 연산을 실행해야 한다', async () => {
    const result = await runner.runCode('return 1 + 1', {});

    expect(result.success).toBe(true);
    expect(result.value).toBe(2);
  });

  it('타임아웃 시 에러를 반환해야 한다', async () => {
    const result = await runner.runCode(
      'while(true) {}',
      {},
      { timeout: 100 },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('위험한 글로벌 접근을 차단해야 한다', async () => {
    const result = await runner.runCode('process.exit()', {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('컨텍스트를 전달해야 한다', async () => {
    const result = await runner.runCode(
      'return ctx.value',
      { value: 42 },
    );

    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
  });
});
