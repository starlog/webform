import ivm from 'isolated-vm';
import ts from 'typescript';
import type { TraceEntry } from '@webform/common';
import { env } from '../config/index.js';
import { CodeInstrumenter } from './CodeInstrumenter.js';

export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;
}

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorLine?: number;
  traces?: TraceEntry[];
}

export class SandboxRunner {
  async runCode(
    code: string,
    context: Record<string, unknown>,
    options?: SandboxOptions,
  ): Promise<SandboxResult> {
    const timeout = options?.timeout ?? env.SANDBOX_TIMEOUT_MS;
    const memoryLimit = options?.memoryLimit ?? env.SANDBOX_MEMORY_LIMIT_MB;
    const debugMode = options?.debugMode ?? false;

    // TypeScript → JavaScript 변환 (type annotations 제거)
    let jsCode: string;
    try {
      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.None,
          removeComments: false,
        },
      });
      jsCode = transpiled.outputText;
    } catch {
      jsCode = code; // 트랜스파일 실패 시 원본 사용
    }

    let codeToRun = jsCode;
    if (debugMode) {
      const instrumenter = new CodeInstrumenter();
      const { instrumentedCode } = instrumenter.instrument(jsCode);
      codeToRun = instrumentedCode;
    }

    const isolate = new ivm.Isolate({ memoryLimit });
    const wrappedCode = this.wrapHandlerCode(codeToRun, debugMode);

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      await this.blockDangerousGlobals(jail, debugMode);
      await this.injectContext(jail, context);

      const script = await isolate.compileScript(wrappedCode);

      const result = await script.run(vmContext, { timeout, copy: true });

      if (debugMode && result && typeof result === 'object') {
        const resultObj = result as Record<string, unknown>;
        const traces = resultObj.traces as TraceEntry[] | undefined;
        const userError = resultObj.__error as string | undefined;
        const { traces: _t, __error: _e, ...rest } = resultObj;

        if (userError) {
          return { success: false, error: userError, traces };
        }

        return { success: true, value: rest, traces };
      }

      return { success: true, value: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorLine = this.extractErrorLine(err, wrappedCode);
      return { success: false, error: message, errorLine };
    } finally {
      isolate.dispose();
    }
  }

  private async blockDangerousGlobals(
    jail: ivm.Reference<Record<string, unknown>>,
    debugMode?: boolean,
  ): Promise<void> {
    const blocked = [
      'process', 'require', 'Function',
      '__dirname', '__filename', 'module', 'exports',
      'globalThis', 'setTimeout', 'setInterval',
      'setImmediate', 'queueMicrotask',
      // debugMode에서는 __captureVars가 eval을 사용하므로 차단하지 않음
      ...(debugMode ? [] : ['eval']),
    ];

    for (const name of blocked) {
      await jail.set(name, undefined);
    }
  }

  private async injectContext(
    jail: ivm.Reference<Record<string, unknown>>,
    context: Record<string, unknown>,
  ): Promise<void> {
    await jail.set('__ctx__', new ivm.ExternalCopy(context).copyInto());

    const httpHandler = new ivm.Reference(async (method: string, url: string, body?: string) => {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }
      return new ivm.ExternalCopy({ status: res.status, ok: res.ok, data }).copyInto();
    });
    await jail.set('__httpHandler', httpHandler);
  }

  private wrapHandlerCode(code: string, debugMode?: boolean): string {
    const traceSetup = debugMode
      ? `
        var __traces = [];
        function __trace(line, col, vars) {
          var __cc = {};
          try {
            var __ks = Object.keys(ctx.controls);
            for (var __i = 0; __i < __ks.length; __i++) {
              try { __cc[__ks[__i]] = JSON.stringify(ctx.controls[__ks[__i]]); }
              catch(__e2) { __cc[__ks[__i]] = String(ctx.controls[__ks[__i]]); }
            }
          } catch(__e3) {}
          __traces.push({
            line: line,
            column: col,
            timestamp: Date.now(),
            variables: vars || {},
            ctxControls: __cc
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
        }`
      : '';

    const returnValue = debugMode
      ? '{ controls: ctx.controls, messages: __messages, logs: __logs, traces: __traces, navigations: __navigations }'
      : '{ controls: ctx.controls, messages: __messages, logs: __logs, navigations: __navigations }';

    return `
      (function(ctx) {
        var __messages = [];
        var __logs = [];
        var __navigations = [];
        var __stringify = function(val) {
          if (val === undefined) return 'undefined';
          if (val === null) return 'null';
          if (typeof val === 'string') return val;
          try { return JSON.stringify(val); } catch(e) { return String(val); }
        };
        var console = {
          log: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'log', args: a, timestamp: Date.now() }); },
          warn: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'warn', args: a, timestamp: Date.now() }); },
          error: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'error', args: a, timestamp: Date.now() }); },
          info: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'info', args: a, timestamp: Date.now() }); }
        };${traceSetup}
        ctx.showMessage = function(text, title, type) {
          __messages.push({
            text: String(text ?? ''),
            title: String(title ?? ''),
            dialogType: String(type ?? 'info')
          });
        };
        ctx.navigate = function(formId, params) {
          __navigations.push({
            formId: String(formId ?? ''),
            params: params || {}
          });
        };
        ctx.http = {
          get: function(url) {
            return __httpHandler.applySyncPromise(undefined, ['GET', String(url)]);
          },
          post: function(url, body) {
            return __httpHandler.applySyncPromise(undefined, ['POST', String(url), JSON.stringify(body)]);
          },
          put: function(url, body) {
            return __httpHandler.applySyncPromise(undefined, ['PUT', String(url), JSON.stringify(body)]);
          },
          patch: function(url, body) {
            return __httpHandler.applySyncPromise(undefined, ['PATCH', String(url), JSON.stringify(body)]);
          },
          delete: function(url) {
            return __httpHandler.applySyncPromise(undefined, ['DELETE', String(url)]);
          }
        };
        var sender = ctx.sender;${
      debugMode
        ? `
        var __userError;
        try {
          ${code}
        } catch (__e) {
          __userError = __e;
        } finally {
          var __result = ${returnValue};
          if (__userError) {
            __result.__error = __userError.message || String(__userError);
          }
          return __result;
        }`
        : `
        (function() {
          ${code}
        })();
        return ${returnValue};`
    }
      })(__ctx__)
    `;
  }

  private extractErrorLine(err: unknown, wrappedCode: string): number | undefined {
    if (!(err instanceof Error) || !err.stack) return undefined;

    const stack = err.stack;

    // isolated-vm 에러 스택에서 줄 번호 추출
    // 형식: "<isolated-vm>:줄:컬럼" 또는 "<anonymous>:줄:컬럼"
    const lineMatch = stack.match(/:(\d+):\d+/);
    if (!lineMatch) return undefined;

    const rawLine = parseInt(lineMatch[1], 10);

    // 래퍼 코드에서 사용자 코드 시작 줄 오프셋 계산
    // (function() { 다음 줄부터 사용자 코드가 시작됨
    const lines = wrappedCode.split('\n');
    let wrapperLineCount = 0;
    for (let i = 0; i < lines.length; i++) {
      wrapperLineCount++;
      if (lines[i].trim().startsWith('(function() {')) {
        break;
      }
    }

    const userLine = rawLine - wrapperLineCount;
    return userLine > 0 ? userLine : undefined;
  }
}
