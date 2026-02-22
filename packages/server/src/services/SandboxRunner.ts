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

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      await this.blockDangerousGlobals(jail);
      await this.injectContext(jail, context);

      const wrappedCode = this.wrapHandlerCode(code);
      const script = await isolate.compileScript(wrappedCode);

      const result = await script.run(vmContext, { timeout, copy: true });

      return { success: true, value: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
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
        return { controls: ctx.controls, messages: __messages };
      })(__ctx__)
    `;
  }
}
