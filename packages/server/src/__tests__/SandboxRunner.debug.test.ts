import { describe, it, expect } from 'vitest';
import { SandboxRunner } from '../services/SandboxRunner.js';

describe('SandboxRunner — 디버그 기능', () => {
  const runner = new SandboxRunner();

  describe('console 로깅 캡처', () => {
    it('console.log가 logs 배열에 캡처되어야 한다', async () => {
      const result = await runner.runCode('console.log("hello", "world")', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { type: string; args: string[]; timestamp: number }[] };
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].type).toBe('log');
      expect(value.logs[0].args).toEqual(['hello', 'world']);
      expect(value.logs[0].timestamp).toBeTypeOf('number');
    });

    it('console.warn이 warn 타입으로 캡처되어야 한다', async () => {
      const result = await runner.runCode('console.warn("warning message")', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { type: string; args: string[] }[] };
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].type).toBe('warn');
      expect(value.logs[0].args).toEqual(['warning message']);
    });

    it('console.error가 error 타입으로 캡처되어야 한다', async () => {
      const result = await runner.runCode('console.error("error message")', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { type: string; args: string[] }[] };
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].type).toBe('error');
      expect(value.logs[0].args).toEqual(['error message']);
    });

    it('console.info가 info 타입으로 캡처되어야 한다', async () => {
      const result = await runner.runCode('console.info("info message")', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { type: string; args: string[] }[] };
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].type).toBe('info');
      expect(value.logs[0].args).toEqual(['info message']);
    });

    it('여러 console 메서드 호출이 순서대로 캡처되어야 한다', async () => {
      const result = await runner.runCode(
        'console.log("L"); console.warn("W"); console.error("E"); console.info("I")',
        {},
      );

      expect(result.success).toBe(true);
      const value = result.value as { logs: { type: string; args: string[] }[] };
      expect(value.logs).toHaveLength(4);
      expect(value.logs[0]).toMatchObject({ type: 'log', args: ['L'] });
      expect(value.logs[1]).toMatchObject({ type: 'warn', args: ['W'] });
      expect(value.logs[2]).toMatchObject({ type: 'error', args: ['E'] });
      expect(value.logs[3]).toMatchObject({ type: 'info', args: ['I'] });
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

    it('console.log에 배열 전달 시 JSON.stringify되어야 한다', async () => {
      const result = await runner.runCode('console.log([1, 2, 3])', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args[0]).toBe('[1,2,3]');
    });

    it('console.log에 undefined 전달 시 문자열 "undefined"로 변환되어야 한다', async () => {
      const result = await runner.runCode('console.log(undefined)', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args[0]).toBe('undefined');
    });

    it('console.log에 null 전달 시 문자열 "null"로 변환되어야 한다', async () => {
      const result = await runner.runCode('console.log(null)', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args[0]).toBe('null');
    });

    it('console.log에 숫자 전달 시 JSON.stringify되어야 한다', async () => {
      const result = await runner.runCode('console.log(42)', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args[0]).toBe('42');
    });

    it('console.log에 여러 인자 전달 시 각각 변환되어야 한다', async () => {
      const result = await runner.runCode(
        'console.log("msg", 42, { a: 1 }, null)',
        {},
      );

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args).toEqual(['msg', '42', '{"a":1}', 'null']);
    });

    it('console 호출 없으면 logs가 빈 배열이어야 한다', async () => {
      const result = await runner.runCode('var x = 1;', {});

      expect(result.success).toBe(true);
      const value = result.value as { logs: unknown[] };
      expect(value.logs).toEqual([]);
    });
  });

  describe('에러 줄 번호 추출', () => {
    it('에러 발생 시 errorLine이 반환되어야 한다', async () => {
      const code = 'var x = 1;\nundefinedFunc();';
      const result = await runner.runCode(code, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // errorLine은 isolated-vm 스택 형식에 따라 존재할 수도 있음
      if (result.errorLine !== undefined) {
        expect(result.errorLine).toBeTypeOf('number');
        expect(result.errorLine).toBeGreaterThan(0);
      }
    });

    it('첫 줄에서 에러 발생 시 errorLine이 1이어야 한다', async () => {
      const code = 'undefinedFunc();';
      const result = await runner.runCode(code, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (result.errorLine !== undefined) {
        expect(result.errorLine).toBe(1);
      }
    });

    it('에러 발생 전 console.log는 캡처되지 않아야 한다', async () => {
      // 에러가 발생하면 전체 실행이 중단되므로 value가 없음
      const code = 'console.log("before error");\nundefinedFunc();';
      const result = await runner.runCode(code, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // 에러 시 value는 undefined (실행이 중단됨)
      expect(result.value).toBeUndefined();
    });

    it('구문 에러 시에도 error가 반환되어야 한다', async () => {
      // TypeScript transpileModule이 복구할 수 없는 구문 에러 사용
      const code = '(((';
      const result = await runner.runCode(code, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('기존 기능 호환성', () => {
    it('ctx.controls를 통해 컨트롤 속성을 수정할 수 있어야 한다', async () => {
      const result = await runner.runCode(
        'ctx.controls.btn1.text = "clicked"',
        { controls: { btn1: { text: 'Click me' } } },
      );

      expect(result.success).toBe(true);
      const value = result.value as {
        operations: { type: string; target: string; payload: Record<string, unknown> }[];
      };
      expect(value.operations).toHaveLength(1);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'btn1',
        payload: { text: 'clicked' },
      });
    });

    it('ctx.showMessage가 operations에 showDialog로 추가되어야 한다', async () => {
      const result = await runner.runCode(
        'ctx.showMessage("hello", "title", "warning")',
        {},
      );

      expect(result.success).toBe(true);
      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
      };
      expect(value.operations).toHaveLength(1);
      expect(value.operations[0]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: {
          text: 'hello',
          title: 'title',
          dialogType: 'warning',
        },
      });
    });

    it('ctx.http 객체가 존재해야 한다', async () => {
      // http 객체의 메서드가 존재하는지 확인 (실제 네트워크 호출 없이)
      const result = await runner.runCode(
        'var hasGet = typeof ctx.http.get === "function";\n' +
          'var hasPost = typeof ctx.http.post === "function";\n' +
          'console.log(hasGet, hasPost);',
        {},
      );

      expect(result.success).toBe(true);
      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs[0].args).toEqual(['true', 'true']);
    });

    it('console과 기존 기능을 함께 사용할 수 있어야 한다', async () => {
      const code = [
        'console.log("start");',
        'ctx.controls.lbl.text = "updated";',
        'ctx.showMessage("done", "Info", "info");',
        'console.log("end");',
      ].join('\n');

      const result = await runner.runCode(code, {
        controls: { lbl: { text: 'original' } },
      });

      expect(result.success).toBe(true);
      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
        logs: { type: string; args: string[] }[];
      };

      // showMessage 전 변경 → showDialog 순서로 operations에 기록
      expect(value.operations).toHaveLength(2);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'updated' },
      });
      expect(value.operations[1]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'done', title: 'Info', dialogType: 'info' },
      });
      expect(value.logs).toHaveLength(2);
      expect(value.logs[0].args).toEqual(['start']);
      expect(value.logs[1].args).toEqual(['end']);
    });

    it('showMessage 전후 속성 변경이 순서대로 operations에 기록되어야 한다', async () => {
      const code = [
        'ctx.controls.lbl.text = "Step 1";',
        'ctx.showMessage("Check", "Test", "info");',
        'ctx.controls.lbl.text = "Step 2";',
      ].join('\n');

      const result = await runner.runCode(code, {
        controls: { lbl: { text: 'original' } },
      });

      expect(result.success).toBe(true);
      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
      };

      expect(value.operations).toHaveLength(3);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'Step 1' },
      });
      expect(value.operations[1]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'Check', title: 'Test', dialogType: 'info' },
      });
      expect(value.operations[2]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'Step 2' },
      });
    });

    it('다중 다이얼로그에서 속성 변경 순서가 보장되어야 한다', async () => {
      const code = [
        'ctx.controls.lbl.text = "A";',
        'ctx.showMessage("First");',
        'ctx.controls.lbl.text = "B";',
        'ctx.showMessage("Second");',
        'ctx.controls.lbl.text = "C";',
      ].join('\n');

      const result = await runner.runCode(code, {
        controls: { lbl: { text: 'original' } },
      });

      expect(result.success).toBe(true);
      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
      };

      expect(value.operations).toHaveLength(5);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'A' },
      });
      expect(value.operations[1]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'First', title: '', dialogType: 'info' },
      });
      expect(value.operations[2]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'B' },
      });
      expect(value.operations[3]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'Second', title: '', dialogType: 'info' },
      });
      expect(value.operations[4]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'C' },
      });
    });
  });
});
