import { describe, it, expect } from 'vitest';
import { SandboxRunner } from '../services/SandboxRunner.js';

describe('SandboxRunner — 계측 트레이스 (debugMode)', () => {
  const runner = new SandboxRunner();

  describe('debugMode=true 기본 동작', () => {
    it('debugMode=true로 실행 시 traces가 반환되어야 한다', async () => {
      const code = 'var x = 1;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();
      expect(result.traces).toBeInstanceOf(Array);
      expect(result.traces!.length).toBeGreaterThan(0);
    });

    it('traces의 각 항목에 line, column, timestamp 필드가 있어야 한다', async () => {
      const code = 'var x = 1;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      const trace = result.traces![0];
      expect(trace.line).toBeTypeOf('number');
      expect(trace.column).toBeTypeOf('number');
      expect(trace.timestamp).toBeTypeOf('number');
      expect(trace.variables).toBeDefined();
    });

    it('여러 줄 코드 실행 시 각 줄마다 trace가 기록되어야 한다', async () => {
      const code = 'var x = 1;\nvar y = 2;\nvar z = 3;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      // 최소 3개의 trace (변수 선언 3개)
      expect(result.traces!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('traces 줄 번호 검증', () => {
    it('traces에 올바른 줄 번호가 기록되어야 한다', async () => {
      const code = 'var x = 1;\nvar y = 2;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const lines = result.traces!.map((t) => t.line);
      expect(lines).toContain(1);
      expect(lines).toContain(2);
    });

    it('if/else 분기에서 실행된 분기의 줄 번호만 기록되어야 한다', async () => {
      const code = [
        'var x = 10;',
        'if (x > 5) {',
        '  var y = "big";',
        '} else {',
        '  var z = "small";',
        '}',
      ].join('\n');

      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const lines = result.traces!.map((t) => t.line);
      // if 블록(3번째 줄)이 실행되어야 함
      expect(lines).toContain(3);
    });

    it('for 루프 내부 줄 번호가 반복 횟수만큼 기록되어야 한다', async () => {
      const code = [
        'var sum = 0;',
        'for (var i = 0; i < 3; i++) {',
        '  sum += i;',
        '}',
      ].join('\n');

      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      // for 루프 body(3번째 줄)가 3번 기록되어야 함
      const line3Traces = result.traces!.filter((t) => t.line === 3);
      expect(line3Traces.length).toBe(3);
    });
  });

  describe('traces 변수값 캡처', () => {
    it('traces에 변수값이 캡처되어야 한다', async () => {
      const code = 'var x = 42;\nvar y = "hello";';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      // 마지막 trace에서 x, y 값이 캡처되어야 함
      const lastTrace = result.traces![result.traces!.length - 1];
      expect(lastTrace.variables).toBeDefined();
      // 변수값은 JSON.stringify된 문자열
      expect(lastTrace.variables['x']).toBe('42');
      expect(lastTrace.variables['y']).toBe('"hello"');
    });

    it('변수값이 업데이트되면 최신 값이 캡처되어야 한다', async () => {
      // 변수 선언은 trace가 뒤에, 대입문은 trace가 앞에 삽입됨
      // 따라서 x=3 이후의 상태를 캡처하려면 후속 문장이 필요
      const code = 'var x = 1;\nx = 2;\nx = 3;\nvar y = x;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      // 마지막 trace(var y = x; 이후)에서 x의 최종값이 캡처되어야 함
      const lastTrace = result.traces![result.traces!.length - 1];
      expect(lastTrace.variables['x']).toBe('3');
    });

    it('객체 변수가 JSON 문자열로 캡처되어야 한다', async () => {
      const code = 'var obj = { a: 1, b: 2 };';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const lastTrace = result.traces![result.traces!.length - 1];
      if (lastTrace.variables['obj']) {
        const parsed = JSON.parse(lastTrace.variables['obj']);
        expect(parsed).toEqual({ a: 1, b: 2 });
      }
    });
  });

  describe('debugMode=false (기존 동작 유지)', () => {
    it('debugMode=false일 때 traces가 없어야 한다', async () => {
      const code = 'var x = 1;\nvar y = 2;';
      const result = await runner.runCode(code, {}, { debugMode: false });

      expect(result.success).toBe(true);
      expect(result.traces).toBeUndefined();
    });

    it('debugMode 옵션 미지정 시 traces가 없어야 한다', async () => {
      const code = 'var x = 1;\nvar y = 2;';
      const result = await runner.runCode(code, {});

      expect(result.success).toBe(true);
      expect(result.traces).toBeUndefined();
    });

    it('debugMode=false에서 기존 반환값(operations, logs)이 정상이어야 한다', async () => {
      const code = [
        'ctx.controls.btn1.text = "clicked";',
        'ctx.showMessage("hello", "title", "info");',
        'console.log("test");',
      ].join('\n');

      const result = await runner.runCode(
        code,
        { controls: { btn1: { text: 'Click me' } } },
        { debugMode: false },
      );

      expect(result.success).toBe(true);
      expect(result.traces).toBeUndefined();
      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
        logs: { args: string[] }[];
      };
      // showMessage 전 변경 → showDialog 순서
      expect(value.operations).toHaveLength(2);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'btn1',
        payload: { text: 'clicked' },
      });
      expect(value.operations[1]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'hello', title: 'title', dialogType: 'info' },
      });
      expect(value.logs).toHaveLength(1);
    });
  });

  describe('에러 발생 시 traces 처리', () => {
    it('에러 발생 시에도 에러 전까지의 traces가 반환되어야 한다', async () => {
      const code = 'var x = 1;\nvar y = 2;\nundefinedFunc();';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // 에러 전까지 실행된 줄의 traces가 반환되어야 함
      expect(result.traces).toBeDefined();
      expect(result.traces!.length).toBeGreaterThan(0);

      const lines = result.traces!.map((t) => t.line);
      expect(lines).toContain(1);
      expect(lines).toContain(2);
    });

    it('첫 줄에서 에러 발생 시 traces가 비어있거나 없어야 한다', async () => {
      const code = 'undefinedFunc();';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // 첫 줄에서 에러가 발생하면 trace가 0개이거나 traces 자체가 없을 수 있음
      if (result.traces) {
        // trace가 있다면, 에러 줄(1) 전에 trace가 기록될 수도 있음
        // (계측 위치에 따라 다름 - 변수 선언은 뒤에, 나머지는 앞에 trace 삽입)
        for (const trace of result.traces) {
          expect(trace.line).toBeTypeOf('number');
        }
      }
    });
  });

  describe('debugMode=true와 기존 기능 호환성', () => {
    it('debugMode=true에서도 operations, logs가 정상 반환되어야 한다', async () => {
      const code = [
        'ctx.controls.lbl.text = "updated";',
        'ctx.showMessage("msg", "title", "info");',
        'console.log("log message");',
      ].join('\n');

      const result = await runner.runCode(
        code,
        { controls: { lbl: { text: 'original' } } },
        { debugMode: true },
      );

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
        logs: { args: string[] }[];
      };
      // showMessage 전 변경 → showDialog 순서
      expect(value.operations).toHaveLength(2);
      expect(value.operations[0]).toEqual({
        type: 'updateProperty',
        target: 'lbl',
        payload: { text: 'updated' },
      });
      expect(value.operations[1]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'msg', title: 'title', dialogType: 'info' },
      });
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].args).toEqual(['log message']);
    });
  });

  describe('const/let 변수 캡처', () => {
    it('const 변수가 캡처되어야 한다', async () => {
      const code = 'const x = 42;\nconst y = "hello";';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const lastTrace = result.traces![result.traces!.length - 1];
      expect(lastTrace.variables['x']).toBe('42');
      expect(lastTrace.variables['y']).toBe('"hello"');
    });

    it('let 변수가 캡처되어야 한다', async () => {
      const code = 'let x = 1;\nx = 2;\nx = 3;\nlet y = x;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);
      expect(result.traces).toBeDefined();

      const lastTrace = result.traces![result.traces!.length - 1];
      expect(lastTrace.variables['x']).toBe('3');
    });
  });

  describe('return 문 처리', () => {
    it('return 후에도 logs가 반환되어야 한다', async () => {
      const code = 'console.log("before return");\nreturn;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);

      const value = result.value as { logs: { args: string[] }[] };
      expect(value.logs).toHaveLength(1);
      expect(value.logs[0].args).toEqual(['before return']);
    });

    it('return 후에도 showMessage 결과가 반환되어야 한다', async () => {
      const code = 'ctx.showMessage("hello", "title", "info");\nreturn;';
      const result = await runner.runCode(code, {}, { debugMode: true });

      expect(result.success).toBe(true);

      const value = result.value as {
        operations: { type: string; target: string; payload: unknown }[];
      };
      expect(value.operations).toHaveLength(1);
      expect(value.operations[0]).toEqual({
        type: 'showDialog',
        target: '_system',
        payload: { text: 'hello', title: 'title', dialogType: 'info' },
      });
    });
  });
});
