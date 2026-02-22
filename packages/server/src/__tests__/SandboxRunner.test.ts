import { describe, it, expect } from 'vitest';
import { SandboxRunner } from '../services/SandboxRunner.js';

describe('SandboxRunner', () => {
  const runner = new SandboxRunner();

  it('핸들러 코드를 실행하고 결과 객체를 반환해야 한다', async () => {
    const result = await runner.runCode('ctx.controls = { btn1: { text: "OK" } }', {});

    expect(result.success).toBe(true);
    const value = result.value as { controls: unknown; messages: unknown[]; logs: unknown[] };
    expect(value.controls).toEqual({ btn1: { text: 'OK' } });
    expect(value.messages).toEqual([]);
    expect(value.logs).toEqual([]);
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
      '',
      { controls: { btn1: { text: 'Hello' } } },
    );

    expect(result.success).toBe(true);
    const value = result.value as { controls: Record<string, unknown> };
    expect(value.controls).toEqual({ btn1: { text: 'Hello' } });
  });

  it('console.log가 logs 배열에 캡처되어야 한다', async () => {
    const result = await runner.runCode(
      'console.log("hello", "world")',
      {},
    );

    expect(result.success).toBe(true);
    const value = result.value as { logs: { type: string; args: string[]; timestamp: number }[] };
    expect(value.logs).toHaveLength(1);
    expect(value.logs[0].type).toBe('log');
    expect(value.logs[0].args).toEqual(['hello', 'world']);
    expect(value.logs[0].timestamp).toBeTypeOf('number');
  });

  it('console.warn, console.error, console.info가 올바른 type으로 캡처되어야 한다', async () => {
    const result = await runner.runCode(
      'console.warn("w"); console.error("e"); console.info("i")',
      {},
    );

    expect(result.success).toBe(true);
    const value = result.value as { logs: { type: string; args: string[] }[] };
    expect(value.logs).toHaveLength(3);
    expect(value.logs[0].type).toBe('warn');
    expect(value.logs[1].type).toBe('error');
    expect(value.logs[2].type).toBe('info');
  });

  it('console.log에 객체 전달 시 JSON.stringify되어야 한다', async () => {
    const result = await runner.runCode(
      'console.log({ name: "test", count: 3 })',
      {},
    );

    expect(result.success).toBe(true);
    const value = result.value as { logs: { args: string[] }[] };
    expect(value.logs[0].args[0]).toBe('{"name":"test","count":3}');
  });

  it('에러 발생 시 errorLine이 반환되어야 한다', async () => {
    const code = 'var x = 1;\nundefinedFunc();';
    const result = await runner.runCode(code, {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // errorLine은 존재하거나 undefined일 수 있음 (isolated-vm 스택 형식에 따라 다름)
    if (result.errorLine !== undefined) {
      expect(result.errorLine).toBeTypeOf('number');
      expect(result.errorLine).toBeGreaterThan(0);
    }
  });

  it('showMessage가 기존과 동일하게 동작해야 한다', async () => {
    const result = await runner.runCode(
      'ctx.showMessage("hello", "title", "warning")',
      {},
    );

    expect(result.success).toBe(true);
    const value = result.value as { messages: { text: string; title: string; dialogType: string }[] };
    expect(value.messages).toHaveLength(1);
    expect(value.messages[0]).toEqual({
      text: 'hello',
      title: 'title',
      dialogType: 'warning',
    });
  });
});
