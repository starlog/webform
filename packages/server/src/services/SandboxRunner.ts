import ivm from 'isolated-vm';
import ts from 'typescript';
import { MongoClient } from 'mongodb';
import type { TraceEntry } from '@webform/common';
import { env } from '../config/index.js';
import { CodeInstrumenter } from './CodeInstrumenter.js';

export interface MongoConnectorInfo {
  controlName: string;
  connectionString: string;
  database: string;
  defaultCollection: string;
  queryTimeout: number;
  maxResultCount: number;
}

export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;
  mongoConnectors?: MongoConnectorInfo[];
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
    const mongoConnectors = options?.mongoConnectors ?? [];

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
    const wrappedCode = this.wrapHandlerCode(codeToRun, debugMode, mongoConnectors);

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      await this.blockDangerousGlobals(jail, debugMode);
      await this.injectContext(jail, context, mongoConnectors);

      const script = await isolate.compileScript(wrappedCode);

      const result = await script.run(vmContext, { timeout, copy: true });

      if (debugMode && result && typeof result === 'object') {
        const resultObj = result as Record<string, unknown>;
        const traces = resultObj.traces as TraceEntry[] | undefined;
        const userError = resultObj.__error as string | undefined;
        const rest = Object.fromEntries(
          Object.entries(resultObj).filter(([k]) => k !== 'traces' && k !== '__error'),
        );

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
    mongoConnectors: MongoConnectorInfo[] = [],
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

    if (mongoConnectors.length > 0) {
      const connectorMap = new Map<string, MongoConnectorInfo>();
      for (const mc of mongoConnectors) {
        connectorMap.set(mc.controlName, mc);
      }

      const mongoHandler = new ivm.Reference(
        async (controlName: string, operation: string, collection: string, arg1?: string, arg2?: string) => {
          const info = connectorMap.get(controlName);
          if (!info) {
            throw new Error(`MongoDBConnector "${controlName}" not found`);
          }
          if (!info.connectionString) {
            throw new Error(`MongoDBConnector "${controlName}": connectionString is empty`);
          }

          const client = new MongoClient(info.connectionString);
          try {
            await client.connect();
            const db = client.db(info.database);
            const col = db.collection(collection || info.defaultCollection);
            const filter = arg1 ? JSON.parse(arg1) : {};
            const arg2Parsed = arg2 ? JSON.parse(arg2) : undefined;

            let result: unknown;
            switch (operation) {
              case 'find': {
                result = await col.find(filter).limit(info.maxResultCount).toArray();
                break;
              }
              case 'findOne': {
                result = await col.findOne(filter);
                break;
              }
              case 'insertOne': {
                // arg1 = document to insert
                const insertResult = await col.insertOne(filter);
                result = { insertedId: String(insertResult.insertedId) };
                break;
              }
              case 'updateOne': {
                // arg1 = filter, arg2 = update fields
                const updateResult = await col.updateOne(filter, { $set: arg2Parsed });
                result = { modifiedCount: updateResult.modifiedCount };
                break;
              }
              case 'deleteOne': {
                const deleteResult = await col.deleteOne(filter);
                result = { deletedCount: deleteResult.deletedCount };
                break;
              }
              case 'count': {
                result = await col.countDocuments(filter);
                break;
              }
              default:
                throw new Error(`Unknown MongoDB operation: ${operation}`);
            }
            return new ivm.ExternalCopy(result).copyInto();
          } finally {
            await client.close();
          }
        },
      );
      await jail.set('__mongoHandler', mongoHandler);
    }
  }

  private wrapHandlerCode(code: string, debugMode?: boolean, mongoConnectors: MongoConnectorInfo[] = []): string {
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
      ? '{ operations: __operations, logs: __logs, traces: __traces }'
      : '{ operations: __operations, logs: __logs }';

    return `
      (function(ctx) {
        ctx.controls = ctx.controls || {};
        var __operations = [];
        var __logs = [];
        var __lastSnapshot = JSON.parse(JSON.stringify(ctx.controls));
        var __stringify = function(val) {
          if (val === undefined) return 'undefined';
          if (val === null) return 'null';
          if (typeof val === 'string') return val;
          try { return JSON.stringify(val); } catch(e) { return String(val); }
        };
        var __deepEqual = function(a, b) {
          if (a === b) return true;
          if (a === null || b === null) return false;
          if (typeof a !== typeof b) return false;
          if (typeof a === 'object') {
            return JSON.stringify(a) === JSON.stringify(b);
          }
          return false;
        };
        var __flushChanges = function() {
          var controls = ctx.controls;
          for (var name in controls) {
            if (!controls.hasOwnProperty(name)) continue;
            var current = controls[name];
            var snapshot = __lastSnapshot[name];
            var changed = {};
            var hasChanges = false;
            for (var prop in current) {
              if (!current.hasOwnProperty(prop)) continue;
              if (!snapshot || !__deepEqual(snapshot[prop], current[prop])) {
                changed[prop] = current[prop];
                hasChanges = true;
              }
            }
            if (hasChanges) {
              __operations.push({
                type: 'updateProperty',
                target: name,
                payload: changed
              });
            }
          }
          __lastSnapshot = JSON.parse(JSON.stringify(ctx.controls));
        };
        var console = {
          log: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'log', args: a, timestamp: Date.now() }); },
          warn: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'warn', args: a, timestamp: Date.now() }); },
          error: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'error', args: a, timestamp: Date.now() }); },
          info: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'info', args: a, timestamp: Date.now() }); }
        };${traceSetup}
        ctx.showMessage = function(text, title, type) {
          __flushChanges();
          __operations.push({
            type: 'showDialog',
            target: '_system',
            payload: {
              text: String(text ?? ''),
              title: String(title ?? ''),
              dialogType: String(type ?? 'info')
            }
          });
        };
        ctx.navigate = function(formId, params) {
          __flushChanges();
          __operations.push({
            type: 'navigate',
            target: '_system',
            payload: {
              formId: String(formId ?? ''),
              params: params || {}
            }
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
${mongoConnectors.map((mc) => `
        ctx.controls['${mc.controlName}'] = ctx.controls['${mc.controlName}'] || {};
        ctx.controls['${mc.controlName}'].find = function(collection, filter) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'find', String(collection || ''), JSON.stringify(filter || {})]);
        };
        ctx.controls['${mc.controlName}'].findOne = function(collection, filter) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'findOne', String(collection || ''), JSON.stringify(filter || {})]);
        };
        ctx.controls['${mc.controlName}'].insertOne = function(collection, doc) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'insertOne', String(collection || ''), JSON.stringify(doc || {})]);
        };
        ctx.controls['${mc.controlName}'].updateOne = function(collection, filter, update) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'updateOne', String(collection || ''), JSON.stringify(filter || {}), JSON.stringify(update || {})]);
        };
        ctx.controls['${mc.controlName}'].deleteOne = function(collection, filter) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'deleteOne', String(collection || ''), JSON.stringify(filter || {})]);
        };
        ctx.controls['${mc.controlName}'].count = function(collection, filter) {
          return __mongoHandler.applySyncPromise(undefined, ['${mc.controlName}', 'count', String(collection || ''), JSON.stringify(filter || {})]);
        };
`).join('')}
        ctx.getRadioGroupValue = function(groupName) {
          for (var name in ctx.controls) {
            var ctrl = ctx.controls[name];
            if (ctrl.groupName === groupName && ctrl.checked === true) {
              return ctrl.text;
            }
          }
          return null;
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
          __flushChanges();
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
        __flushChanges();
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
