import ivm from 'isolated-vm';
import { env } from '../config/index.js';

export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
}

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorLine?: number;
}

export class SandboxRunner {
  async runCode(
    code: string,
    context: Record<string, unknown>,
    options?: SandboxOptions,
  ): Promise<SandboxResult> {
    const timeout = options?.timeout ?? env.SANDBOX_TIMEOUT_MS;
    const memoryLimit = options?.memoryLimit ?? env.SANDBOX_MEMORY_LIMIT_MB;

    const isolate = new ivm.Isolate({ memoryLimit });
    const wrappedCode = this.wrapHandlerCode(code);

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      await this.blockDangerousGlobals(jail);
      await this.injectContext(jail, context);

      const script = await isolate.compileScript(wrappedCode);

      const result = await script.run(vmContext, { timeout, copy: true });

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
  ): Promise<void> {
    const blocked = [
      'process', 'require', 'eval', 'Function',
      '__dirname', '__filename', 'module', 'exports',
      'globalThis', 'setTimeout', 'setInterval',
      'setImmediate', 'queueMicrotask',
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

  private wrapHandlerCode(code: string): string {
    return `
      (function(ctx) {
        var __messages = [];
        var __logs = [];
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
        };
        ctx.showMessage = function(text, title, type) {
          __messages.push({
            text: String(text ?? ''),
            title: String(title ?? ''),
            dialogType: String(type ?? 'info')
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
        var sender = ctx.sender;
        (function() {
          ${code}
        })();
        return { controls: ctx.controls, messages: __messages, logs: __logs };
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
