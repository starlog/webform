import * as acorn from 'acorn';
import { generate } from 'astring';
import type * as estree from 'estree';

export interface InstrumentResult {
  instrumentedCode: string;
  variableMap: Map<number, string[]>;
}

export class CodeInstrumenter {
  /**
   * 사용자 코드를 계측하여 각 Statement 앞에 __trace() 호출을 삽입한다.
   * 파싱 실패 시 원본 코드를 그대로 반환한다.
   */
  instrument(code: string): InstrumentResult {
    const variableMap = new Map<number, string[]>();

    let ast: estree.Program;
    try {
      ast = acorn.parse(code, {
        ecmaVersion: 2020,
        sourceType: 'script',
        locations: true,
        allowReturnOutsideFunction: true,
      }) as unknown as estree.Program;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[CodeInstrumenter] 파싱 실패: ${message}`);
      return { instrumentedCode: code, variableMap };
    }

    // 현재 스코프에서 선언된 변수들을 추적
    const declaredVars: string[] = [];

    this.walkBody(ast.body as estree.Statement[], variableMap, declaredVars);

    const instrumentedCode = generate(ast);
    return { instrumentedCode, variableMap };
  }

  /**
   * __traces 배열과 __trace 함수, __captureVars 헬퍼를 정의하는 래퍼 코드를 생성한다.
   */
  generateTraceWrapper(): string {
    return `
var __traces = [];
function __trace(line, col, vars) {
  __traces.push({
    line: line,
    column: col,
    timestamp: Date.now(),
    variables: vars || {}
  });
}
function __captureVars(names, evalFn) {
  var result = {};
  for (var i = 0; i < names.length; i++) {
    try {
      var val = evalFn(names[i]);
      try {
        result[names[i]] = JSON.stringify(val);
      } catch(e) {
        result[names[i]] = String(val);
      }
    } catch(e) {
      // 변수가 아직 선언되지 않은 경우 무시
    }
  }
  return result;
}
`;
  }

  /**
   * Statement 배열을 순회하며 각 Statement 앞에 __trace() 호출을 삽입한다.
   */
  private walkBody(
    body: estree.Statement[],
    variableMap: Map<number, string[]>,
    declaredVars: string[],
  ): void {
    const newBody: estree.Statement[] = [];

    for (const stmt of body) {
      // 중첩된 블록 내부도 재귀적으로 처리
      this.walkNestedStatements(stmt, variableMap, declaredVars);

      const line = stmt.loc?.start.line ?? 0;
      const col = stmt.loc?.start.column ?? 0;

      // VariableDeclaration인 경우 선언된 변수명 수집
      if (stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          this.collectBindingNames(decl.id, declaredVars);
        }
      }

      // 현재 줄에서 캡처할 변수 목록 기록
      const varsSnapshot = [...declaredVars];
      if (varsSnapshot.length > 0) {
        variableMap.set(line, varsSnapshot);
      }

      // __trace() 호출 Statement 생성
      const traceCall = this.createTraceCall(line, col, varsSnapshot);

      if (stmt.type === 'VariableDeclaration') {
        // 변수 선언은 실행 후 값을 캡처해야 하므로 trace를 뒤에 삽입
        newBody.push(stmt);
        newBody.push(traceCall);
      } else {
        newBody.push(traceCall);
        newBody.push(stmt);
      }
    }

    // 원본 배열을 수정된 배열로 교체
    body.length = 0;
    body.push(...newBody);
  }

  /**
   * 중첩된 Statement(if/for/while/블록 등) 내부를 재귀적으로 처리한다.
   */
  private walkNestedStatements(
    stmt: estree.Statement,
    variableMap: Map<number, string[]>,
    declaredVars: string[],
  ): void {
    switch (stmt.type) {
      case 'BlockStatement':
        this.walkBody(stmt.body, variableMap, declaredVars);
        break;
      case 'IfStatement':
        if (stmt.consequent.type === 'BlockStatement') {
          this.walkBody(stmt.consequent.body, variableMap, declaredVars);
        }
        if (stmt.alternate) {
          if (stmt.alternate.type === 'BlockStatement') {
            this.walkBody(stmt.alternate.body, variableMap, declaredVars);
          } else if (stmt.alternate.type === 'IfStatement') {
            this.walkNestedStatements(stmt.alternate, variableMap, declaredVars);
          }
        }
        break;
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        if (stmt.body.type === 'BlockStatement') {
          this.walkBody(stmt.body.body, variableMap, declaredVars);
        }
        break;
      case 'TryStatement':
        this.walkBody(stmt.block.body, variableMap, declaredVars);
        if (stmt.handler) {
          this.walkBody(stmt.handler.body.body, variableMap, declaredVars);
        }
        if (stmt.finalizer) {
          this.walkBody(stmt.finalizer.body, variableMap, declaredVars);
        }
        break;
      case 'SwitchStatement':
        for (const c of stmt.cases) {
          this.walkBody(
            c.consequent as estree.Statement[],
            variableMap,
            declaredVars,
          );
        }
        break;
    }
  }

  /**
   * 바인딩 패턴에서 변수명을 수집한다 (구조분해 할당 포함).
   */
  private collectBindingNames(pattern: estree.Pattern, names: string[]): void {
    switch (pattern.type) {
      case 'Identifier':
        if (!names.includes(pattern.name)) {
          names.push(pattern.name);
        }
        break;
      case 'ObjectPattern':
        for (const prop of pattern.properties) {
          if (prop.type === 'RestElement') {
            this.collectBindingNames(prop.argument, names);
          } else {
            this.collectBindingNames(prop.value, names);
          }
        }
        break;
      case 'ArrayPattern':
        for (const elem of pattern.elements) {
          if (elem) this.collectBindingNames(elem, names);
        }
        break;
      case 'AssignmentPattern':
        this.collectBindingNames(pattern.left, names);
        break;
      case 'RestElement':
        this.collectBindingNames(pattern.argument, names);
        break;
    }
  }

  /**
   * __trace(line, col, __captureVars([...varNames], function(__x) { return eval(__x); }))
   * 호출 AST 노드를 생성한다.
   * eval 래퍼를 호출 지점에서 정의하여 const/let 변수도 캡처 가능하게 한다.
   */
  private createTraceCall(
    line: number,
    col: number,
    varNames: string[],
  ): estree.ExpressionStatement {
    // function(__x) { return eval(__x); } — 호출 지점 스코프의 eval 래퍼
    const evalWrapper: estree.FunctionExpression = {
      type: 'FunctionExpression',
      params: [{ type: 'Identifier', name: '__x' }],
      body: {
        type: 'BlockStatement',
        body: [
          {
            type: 'ReturnStatement',
            argument: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'eval' },
              arguments: [{ type: 'Identifier', name: '__x' }],
              optional: false,
            },
          },
        ],
      },
    };

    const varsArg: estree.Expression =
      varNames.length > 0
        ? {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: '__captureVars' },
            arguments: [
              {
                type: 'ArrayExpression',
                elements: varNames.map(
                  (name): estree.Literal => ({
                    type: 'Literal',
                    value: name,
                  }),
                ),
              },
              evalWrapper,
            ],
            optional: false,
          }
        : { type: 'ObjectExpression', properties: [] };

    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: '__trace' },
        arguments: [
          { type: 'Literal', value: line } as estree.Literal,
          { type: 'Literal', value: col } as estree.Literal,
          varsArg,
        ],
        optional: false,
      },
    };
  }
}
