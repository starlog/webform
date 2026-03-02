import { describe, it, expect } from 'vitest';
import { CodeInstrumenter } from '../services/CodeInstrumenter.js';

describe('CodeInstrumenter', () => {
  const instrumenter = new CodeInstrumenter();

  describe('instrument() — 기본 동작', () => {
    it('단순 변수 선언 코드를 계측해야 한다', () => {
      const code = 'var x = 1;\nvar y = 2;';
      const { instrumentedCode, variableMap } = instrumenter.instrument(code);

      // __trace 호출이 삽입되어야 함
      expect(instrumentedCode).toContain('__trace');
      // 원본 코드의 의미가 보존되어야 함
      expect(instrumentedCode).toContain('x = 1');
      expect(instrumentedCode).toContain('y = 2');
      // variableMap에 변수가 기록되어야 함
      expect(variableMap.size).toBeGreaterThan(0);
    });

    it('변수 선언 시 변수명이 variableMap에 수집되어야 한다', () => {
      const code = 'var a = 10;\nvar b = 20;\nvar c = a + b;';
      const { variableMap } = instrumenter.instrument(code);

      // 3번째 줄에는 a, b, c 모두 포함
      const line3Vars = variableMap.get(3);
      expect(line3Vars).toBeDefined();
      expect(line3Vars).toContain('a');
      expect(line3Vars).toContain('b');
      expect(line3Vars).toContain('c');
    });

    it('let/const 선언도 수집해야 한다', () => {
      const code = 'let x = 1;\nconst y = 2;';
      const { variableMap } = instrumenter.instrument(code);

      const line2Vars = variableMap.get(2);
      expect(line2Vars).toContain('x');
      expect(line2Vars).toContain('y');
    });
  });

  describe('instrument() — if/else 문', () => {
    it('if/else 블록 내부에도 __trace가 삽입되어야 한다', () => {
      const code = [
        'var x = 1;',
        'if (x > 0) {',
        '  var y = 2;',
        '} else {',
        '  var z = 3;',
        '}',
      ].join('\n');

      const { instrumentedCode } = instrumenter.instrument(code);

      // if 블록과 else 블록 모두에 __trace가 있어야 함
      const traceCount = (instrumentedCode.match(/__trace/g) || []).length;
      // 최소 3개: x 선언, y 선언(if블록), z 선언(else블록) + if문 자체
      expect(traceCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('instrument() — 반복문', () => {
    it('for 루프 내부에 __trace가 삽입되어야 한다', () => {
      const code = [
        'var sum = 0;',
        'for (var i = 0; i < 3; i++) {',
        '  sum += i;',
        '}',
      ].join('\n');

      const { instrumentedCode } = instrumenter.instrument(code);

      const traceCount = (instrumentedCode.match(/__trace/g) || []).length;
      // 최소 3개: sum 선언, for문, sum += i (for블록 내부)
      expect(traceCount).toBeGreaterThanOrEqual(3);
    });

    it('while 루프 내부에 __trace가 삽입되어야 한다', () => {
      const code = [
        'var count = 0;',
        'while (count < 5) {',
        '  count++;',
        '}',
      ].join('\n');

      const { instrumentedCode } = instrumenter.instrument(code);

      const traceCount = (instrumentedCode.match(/__trace/g) || []).length;
      expect(traceCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('instrument() — try/catch', () => {
    it('try/catch 블록 내부에 __trace가 삽입되어야 한다', () => {
      const code = [
        'try {',
        '  var x = JSON.parse("{}");',
        '} catch (e) {',
        '  var y = e;',
        '}',
      ].join('\n');

      const { instrumentedCode } = instrumenter.instrument(code);

      const traceCount = (instrumentedCode.match(/__trace/g) || []).length;
      // try 블록 내부 + catch 블록 내부 + try문 자체
      expect(traceCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('instrument() — 구조분해 할당', () => {
    it('객체 구조분해에서 변수명을 수집해야 한다', () => {
      const code = 'var { a, b } = { a: 1, b: 2 };';
      const { variableMap } = instrumenter.instrument(code);

      const vars = variableMap.get(1);
      expect(vars).toBeDefined();
      expect(vars).toContain('a');
      expect(vars).toContain('b');
    });

    it('배열 구조분해에서 변수명을 수집해야 한다', () => {
      const code = 'var [x, y] = [1, 2];';
      const { variableMap } = instrumenter.instrument(code);

      const vars = variableMap.get(1);
      expect(vars).toBeDefined();
      expect(vars).toContain('x');
      expect(vars).toContain('y');
    });
  });

  describe('instrument() — 파싱 에러 처리', () => {
    it('잘못된 코드는 원본을 그대로 반환해야 한다', () => {
      const badCode = 'var x = {{{;';
      const { instrumentedCode, variableMap } = instrumenter.instrument(badCode);

      expect(instrumentedCode).toBe(badCode);
      expect(variableMap.size).toBe(0);
    });

    it('빈 코드도 정상 처리해야 한다', () => {
      const { instrumentedCode, variableMap } = instrumenter.instrument('');

      expect(instrumentedCode).toBeDefined();
      expect(variableMap.size).toBe(0);
    });
  });

  describe('generateTraceWrapper()', () => {
    it('__traces 배열 정의를 포함해야 한다', () => {
      const wrapper = CodeInstrumenter.generateTraceWrapper();
      expect(wrapper).toContain('__traces');
      expect(wrapper).toContain('[]');
    });

    it('__trace 함수 정의를 포함해야 한다', () => {
      const wrapper = CodeInstrumenter.generateTraceWrapper();
      expect(wrapper).toContain('function __trace');
      expect(wrapper).toContain('line');
      expect(wrapper).toContain('timestamp');
    });

    it('__captureVars 헬퍼 정의를 포함해야 한다', () => {
      const wrapper = CodeInstrumenter.generateTraceWrapper();
      expect(wrapper).toContain('function __captureVars');
      expect(wrapper).toContain('JSON.stringify');
    });

    it('순환 참조 대비 try/catch가 있어야 한다', () => {
      const wrapper = CodeInstrumenter.generateTraceWrapper();
      expect(wrapper).toContain('try');
      expect(wrapper).toContain('catch');
    });
  });

  describe('계측된 코드 실행 가능성', () => {
    it('계측된 코드가 eval로 실행 가능해야 한다', () => {
      const code = 'var x = 1;\nvar y = x + 1;';
      const { instrumentedCode } = instrumenter.instrument(code);
      const wrapper = CodeInstrumenter.generateTraceWrapper();

      // wrapper + 계측된 코드를 합쳐서 실행
      const fullCode = wrapper + '\n' + instrumentedCode + '\n__traces;';
      const traces = eval(fullCode) as { line: number; variables: Record<string, string> }[];

      expect(traces).toBeInstanceOf(Array);
      expect(traces.length).toBeGreaterThan(0);

      // 마지막 trace에서 x, y 변수값이 캡처되어야 함
      const lastTrace = traces[traces.length - 1];
      expect(lastTrace.variables).toBeDefined();
      expect(lastTrace.variables['x']).toBe('1');
      expect(lastTrace.variables['y']).toBe('2');
    });
  });
});
