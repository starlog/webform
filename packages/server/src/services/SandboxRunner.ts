import ivm from 'isolated-vm';
import ts from 'typescript';
import { getMongoClient } from './adapters/MongoClientPool.js';
import './adapters/index.js'; // 어댑터 팩토리 등록 side-effect
import type { TraceEntry } from '@webform/common';
import { env } from '../config/index.js';
import { CodeInstrumenter } from './CodeInstrumenter.js';
import { validateSandboxUrl, isBlockedIP } from './validateSandboxUrl.js';
import type { SwaggerOperation } from './SwaggerParser.js';

export interface MongoConnectorInfo {
  controlName: string;
  connectionString: string;
  database: string;
  defaultCollection: string;
  queryTimeout: number;
  maxResultCount: number;
}

export interface SwaggerConnectorInfo {
  controlName: string;
  operations: SwaggerOperation[];
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  timeout: number;
}

export interface DataSourceConnectorInfo {
  controlName: string;
  dsType: 'database' | 'restApi' | 'static';
  dialect?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  baseUrl?: string;
  headers?: Record<string, string>;
  authType?: string;
  authCredentials?: Record<string, string>;
  data?: unknown[];
  queryTimeout: number;
  maxResultCount: number;
}

export interface SandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  debugMode?: boolean;
  mongoConnectors?: MongoConnectorInfo[];
  swaggerConnectors?: SwaggerConnectorInfo[];
  dataSourceConnectors?: DataSourceConnectorInfo[];
  shellMode?: boolean;
  appState?: Record<string, unknown>;
  currentFormId?: string;
  params?: Record<string, unknown>;
}

export interface SandboxResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorLine?: number;
  traces?: TraceEntry[];
}

/**
 * MongoDB 연결 문자열의 호스트가 내부 네트워크를 가리키는지 검증한다.
 * SSRF를 통한 내부 DB 무단 접근을 차단한다.
 */
async function validateMongoConnectionString(connectionString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(`Invalid MongoDB connection string`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '::1') {
    throw new Error(`Blocked MongoDB host: internal address not allowed`);
  }

  const { isIP } = await import('node:net');
  if (isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new Error(`Blocked MongoDB host: internal address not allowed`);
    }
  } else {
    // DNS 해석하여 실제 IP 확인
    const { lookup } = await import('node:dns/promises');
    try {
      const { address } = await lookup(hostname);
      if (isBlockedIP(address)) {
        throw new Error(`Blocked MongoDB host: internal address not allowed`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Blocked')) throw err;
      throw new Error(`DNS resolution failed for MongoDB host: ${hostname}`);
    }
  }
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
    const swaggerConnectors = options?.swaggerConnectors ?? [];
    const dataSourceConnectors = options?.dataSourceConnectors ?? [];
    const shellMode = options?.shellMode ?? false;

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
    const wrappedCode = this.wrapHandlerCode(
      codeToRun,
      debugMode,
      mongoConnectors,
      swaggerConnectors,
      dataSourceConnectors,
      shellMode,
      options?.currentFormId,
      options?.params,
    );

    try {
      const vmContext = await isolate.createContext();
      const jail = vmContext.global;

      await this.blockDangerousGlobals(jail, debugMode);
      await this.injectContext(jail, context, mongoConnectors, swaggerConnectors, dataSourceConnectors);

      if (shellMode && options?.appState) {
        await this.injectAppState(jail, options.appState);
      }

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
    swaggerConnectors: SwaggerConnectorInfo[] = [],
    dataSourceConnectors: DataSourceConnectorInfo[] = [],
  ): Promise<void> {
    await jail.set('__ctx__', new ivm.ExternalCopy(context).copyInto());

    const httpHandler = new ivm.Reference(async (method: string, url: string, body?: string) => {
      await validateSandboxUrl(url);

      // 서버 자체 API 호출 시 내부 인증 헤더 추가
      const headers: Record<string, string> = body
        ? { 'Content-Type': 'application/json' }
        : {};
      const selfPort = process.env.PORT || '4000';
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (
          (host === 'localhost' || host === '127.0.0.1') &&
          parsed.port === selfPort &&
          parsed.pathname.startsWith('/api/')
        ) {
          headers['X-Sandbox-Internal'] = 'true';
        }
      } catch {
        // URL 파싱 실패 시 무시 (validateSandboxUrl에서 이미 검증됨)
      }

      const res = await fetch(url, {
        method,
        headers,
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

          // SSRF 방어: 내부 네트워크 주소 차단
          await validateMongoConnectionString(info.connectionString);

          const client = getMongoClient(info.connectionString);
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
        },
      );
      await jail.set('__mongoHandler', mongoHandler);
    }

    if (swaggerConnectors.length > 0) {
      const connectorMap = new Map<string, SwaggerConnectorInfo>();
      for (const sc of swaggerConnectors) {
        connectorMap.set(sc.controlName, sc);
      }

      const swaggerHandler = new ivm.Reference(
        async (controlName: string, operationId: string, optionsJson: string) => {
          const info = connectorMap.get(controlName);
          if (!info) {
            throw new Error(`SwaggerConnector "${controlName}" not found`);
          }

          const op = info.operations.find((o) => o.operationId === operationId);
          if (!op) {
            throw new Error(
              `SwaggerConnector "${controlName}": operation "${operationId}" not found`,
            );
          }

          const opts = JSON.parse(optionsJson) as {
            path?: Record<string, unknown>;
            query?: Record<string, unknown>;
            body?: unknown;
            headers?: Record<string, string>;
          };

          // URL 구성: path 파라미터 치환
          let resolvedPath = op.path;
          if (opts.path) {
            for (const [key, val] of Object.entries(opts.path)) {
              resolvedPath = resolvedPath.replace(
                `{${key}}`,
                encodeURIComponent(String(val)),
              );
            }
          }

          // query string 추가
          let queryString = '';
          if (opts.query) {
            const params = new URLSearchParams();
            for (const [key, val] of Object.entries(opts.query)) {
              if (val !== undefined && val !== null) {
                params.append(key, String(val));
              }
            }
            const qs = params.toString();
            if (qs) queryString = '?' + qs;
          }

          const url = info.baseUrl + resolvedPath + queryString;

          // SwaggerConnector의 baseUrl은 디자이너가 설정한 신뢰 값이므로
          // SSRF 검증을 건너뛴다 (ctx.http와 달리 스크립트가 URL을 제어하지 않음)

          // headers 병합: defaultHeaders + extraHeaders + Content-Type
          const headers: Record<string, string> = { ...info.defaultHeaders };
          if (opts.headers) {
            Object.assign(headers, opts.headers);
          }

          let fetchBody: FormData | string | undefined;

          if (op.isMultipart && opts.body && typeof opts.body === 'object') {
            // multipart/form-data: body의 각 필드를 FormData로 변환
            const formData = new FormData();
            for (const [fieldName, fieldValue] of Object.entries(
              opts.body as Record<string, unknown>,
            )) {
              if (
                fieldValue &&
                typeof fieldValue === 'object' &&
                'dataUrl' in (fieldValue as Record<string, unknown>)
              ) {
                // dataUrl 필드 → 파일로 변환
                const fileInfo = fieldValue as { dataUrl: string; filename?: string };
                const match = fileInfo.dataUrl.match(
                  /^data:([^;]+);base64,(.+)$/,
                );
                if (match) {
                  const mimeType = match[1];
                  const buffer = Buffer.from(match[2], 'base64');
                  const blob = new Blob([buffer], { type: mimeType });
                  formData.append(
                    fieldName,
                    blob,
                    fileInfo.filename || 'file',
                  );
                }
              } else {
                formData.append(fieldName, String(fieldValue));
              }
            }
            fetchBody = formData;
            // Content-Type은 자동 설정 (boundary 포함)
          } else if (opts.body !== undefined) {
            if (!headers['Content-Type'] && !headers['content-type']) {
              headers['Content-Type'] = 'application/json';
            }
            fetchBody = JSON.stringify(opts.body);
          }

          // HTTP 요청 수행
          const res = await fetch(url, {
            method: op.method,
            headers: fetchBody instanceof FormData
              ? Object.fromEntries(
                  Object.entries(headers).filter(
                    ([k]) => k.toLowerCase() !== 'content-type',
                  ),
                )
              : headers,
            body: fetchBody,
            signal: AbortSignal.timeout(info.timeout),
          });

          const text = await res.text();
          let data: unknown;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }

          return new ivm.ExternalCopy({ status: res.status, ok: res.ok, data }).copyInto();
        },
      );
      await jail.set('__swaggerHandler', swaggerHandler);
    }

    if (dataSourceConnectors.length > 0) {
      const dsConnectorMap = new Map<string, DataSourceConnectorInfo>();
      for (const dc of dataSourceConnectors) {
        dsConnectorMap.set(dc.controlName, dc);
      }

      const dataSourceHandler = new ivm.Reference(
        async (controlName: string, operation: string, arg1?: string, arg2?: string) => {
          const info = dsConnectorMap.get(controlName);
          if (!info) {
            throw new Error(`DataSourceConnector "${controlName}" not found`);
          }

          if (info.dsType === 'database') {
            if (!info.host && !info.dialect) {
              throw new Error(`DataSourceConnector "${controlName}": database not configured`);
            }
            // DB host는 서버 어댑터를 통해 접근하므로 SSRF 검증 불필요
            // (MongoDBConnector와 동일 패턴)
            const { getSqlAdapter } = await import('./adapters/SqlAdapterPool.js');
            const config = {
              host: info.host,
              port: info.port,
              user: info.user,
              password: info.password,
              database: info.database,
              ssl: info.ssl,
            };
            const adapter = getSqlAdapter(controlName, info.dialect!, config);
            const params = arg1 ? JSON.parse(arg1) : {};
            const arg2Parsed = arg2 ? JSON.parse(arg2) : undefined;

            let result: unknown;
            switch (operation) {
              case 'query': {
                result = await adapter.executeQuery(params);
                break;
              }
              case 'rawQuery': {
                const sql = params.sql || params;
                const queryParams = arg2Parsed || [];
                result = await adapter.executeRawQuery(typeof sql === 'string' ? sql : JSON.stringify(sql), queryParams);
                break;
              }
              case 'tables': {
                result = await adapter.listTables();
                break;
              }
              case 'execute': {
                const sql = params.sql || params;
                const queryParams = arg2Parsed || [];
                result = await adapter.execute(typeof sql === 'string' ? sql : JSON.stringify(sql), queryParams);
                break;
              }
              case 'testConnection': {
                result = await adapter.testConnection();
                break;
              }
              default:
                throw new Error(`Unknown DataSource operation: ${operation}`);
            }
            return new ivm.ExternalCopy(result).copyInto();
          } else if (info.dsType === 'restApi') {
            if (!info.baseUrl) {
              throw new Error(`DataSourceConnector "${controlName}": baseUrl not configured`);
            }
            await validateSandboxUrl(info.baseUrl);
            const params = arg1 ? JSON.parse(arg1) : {};
            const method = (params.method || 'GET').toUpperCase();
            const path = params.path || '';
            const url = info.baseUrl + path;
            const queryParams = params.params;
            let fullUrl = url;
            if (queryParams && typeof queryParams === 'object') {
              const sp = new URLSearchParams();
              for (const [k, v] of Object.entries(queryParams)) {
                if (v !== undefined && v !== null) sp.append(k, String(v));
              }
              const qs = sp.toString();
              if (qs) fullUrl += '?' + qs;
            }
            const headers: Record<string, string> = { ...info.headers };
            if (info.authType === 'bearer' && info.authCredentials?.token) {
              headers['Authorization'] = `Bearer ${info.authCredentials.token}`;
            } else if (info.authType === 'basic' && info.authCredentials?.username) {
              const basic = Buffer.from(`${info.authCredentials.username}:${info.authCredentials.password || ''}`).toString('base64');
              headers['Authorization'] = `Basic ${basic}`;
            } else if (info.authType === 'apiKey' && info.authCredentials?.key) {
              headers[info.authCredentials.headerName || 'X-API-Key'] = info.authCredentials.key;
            }
            const fetchBody = params.body ? JSON.stringify(params.body) : undefined;
            if (fetchBody && !headers['Content-Type']) {
              headers['Content-Type'] = 'application/json';
            }
            const res = await fetch(fullUrl, {
              method,
              headers,
              body: fetchBody,
              signal: AbortSignal.timeout(info.queryTimeout),
            });
            const text = await res.text();
            let data: unknown;
            try { data = JSON.parse(text); } catch { data = text; }
            return new ivm.ExternalCopy({ status: res.status, ok: res.ok, data }).copyInto();
          } else if (info.dsType === 'static') {
            const params = arg1 ? JSON.parse(arg1) : {};
            let data: unknown[];
            try {
              data = typeof info.data === 'string' ? JSON.parse(info.data as unknown as string) : (info.data || []);
            } catch {
              data = [];
            }
            // Simple filter support
            if (params.filter && typeof params.filter === 'object') {
              data = data.filter((item: unknown) => {
                if (!item || typeof item !== 'object') return false;
                for (const [key, value] of Object.entries(params.filter)) {
                  if ((item as Record<string, unknown>)[key] !== value) return false;
                }
                return true;
              });
            }
            if (params.limit && typeof params.limit === 'number') {
              data = data.slice(0, params.limit);
            }
            return new ivm.ExternalCopy(data).copyInto();
          }
          throw new Error(`Unknown dsType: ${info.dsType}`);
        },
      );
      await jail.set('__dataSourceHandler', dataSourceHandler);
    }
  }

  private async injectAppState(
    jail: ivm.Reference<Record<string, unknown>>,
    appState: Record<string, unknown>,
  ): Promise<void> {
    await jail.set('__appState__', new ivm.ExternalCopy(appState).copyInto());
  }

  /**
   * debugMode 시 trace 함수(__traces, __trace, __captureVars)를 정의하는 코드를 생성한다.
   * CodeInstrumenter.generateTraceWrapper()를 기반으로 하되,
   * __trace에 ctx.controls 스냅샷 캡처 로직을 추가한다.
   */
  private buildTraceSetup(): string {
    // CodeInstrumenter의 기본 래퍼에서 __traces, __captureVars를 가져오되
    // __trace 함수는 ctx.controls 스냅샷을 포함하는 확장 버전으로 오버라이드한다.
    const baseWrapper = CodeInstrumenter.generateTraceWrapper();

    // 기본 __trace 함수를 ctx.controls 스냅샷을 포함하는 버전으로 교체
    const enhancedTrace = `
        var __origTrace = __trace;
        __trace = function(line, col, vars) {
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
        };`;

    return baseWrapper + enhancedTrace;
  }

  /**
   * Shell 모드 시 네비게이션 함수(navigateBack, navigateReplace, closeApp) 등을 정의하는 코드를 생성한다.
   */
  private buildShellSetup(shellDef: {
    currentFormId?: string;
    appState?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }): string {
    return `
        ctx.currentFormId = ${JSON.stringify(shellDef.currentFormId ?? '')};
        ctx.params = ${JSON.stringify(shellDef.params ?? {})};
        ctx.appState = typeof __appState__ !== 'undefined'
          ? JSON.parse(JSON.stringify(__appState__))
          : {};
        ctx.navigateBack = function() {
          __flushChanges();
          __operations.push({
            type: 'navigate',
            target: '_system',
            payload: { back: true }
          });
        };
        ctx.navigateReplace = function(formId, params) {
          __flushChanges();
          __operations.push({
            type: 'navigate',
            target: '_system',
            payload: {
              formId: String(formId || ''),
              params: params || {},
              replace: true
            }
          });
        };
        ctx.closeApp = function() {
          __flushChanges();
          __operations.push({
            type: 'closeApp',
            target: '_system',
            payload: {}
          });
        };`;
  }

  /**
   * console.log/warn/error/info를 __logs 배열에 기록하도록 오버라이드하는 코드를 생성한다.
   */
  private buildConsoleShim(): string {
    return `
        var console = {
          log: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'log', args: a, timestamp: Date.now() }); },
          warn: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'warn', args: a, timestamp: Date.now() }); },
          error: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'error', args: a, timestamp: Date.now() }); },
          info: function() { var a = []; for (var i = 0; i < arguments.length; i++) a.push(__stringify(arguments[i])); __logs.push({ type: 'info', args: a, timestamp: Date.now() }); }
        };`;
  }

  /**
   * __deepEqual, __stringify, __flushChanges 헬퍼 함수를 정의하는 코드를 생성한다.
   */
  private buildFlushChangesHelper(): string {
    return `
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
              if (typeof current[prop] === 'function') continue;
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
        };`;
  }

  /**
   * JSONPath 구현 함수를 정의하는 코드를 생성한다.
   */
  private buildJsonPathImpl(): string {
    return `
        function jsonPath(obj, expr) {
          if (typeof expr !== 'string' || expr.charAt(0) !== '$') return [];
          var tokens = [];
          var rest = expr.substring(1);
          while (rest.length > 0) {
            if (rest.substring(0, 2) === '..') {
              rest = rest.substring(2);
              var m = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
              if (m) {
                tokens.push({ type: 'recursive', key: m[0] });
                rest = rest.substring(m[0].length);
              }
            } else if (rest.charAt(0) === '.') {
              rest = rest.substring(1);
              var m2 = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
              if (m2) {
                tokens.push({ type: 'child', key: m2[0] });
                rest = rest.substring(m2[0].length);
              }
            } else if (rest.charAt(0) === '[') {
              var end = rest.indexOf(']');
              if (end === -1) break;
              var inside = rest.substring(1, end);
              rest = rest.substring(end + 1);
              if (inside === '*') {
                tokens.push({ type: 'wildcard' });
              } else if (inside.indexOf(':') !== -1) {
                var parts = inside.split(':');
                tokens.push({ type: 'slice', start: parts[0] ? parseInt(parts[0],10) : 0, end: parts[1] ? parseInt(parts[1],10) : undefined });
              } else if (inside.substring(0, 2) === '?(') {
                var filterExpr = inside.substring(2, inside.length - 1);
                tokens.push({ type: 'filter', expr: filterExpr });
              } else {
                var idx = parseInt(inside, 10);
                if (!isNaN(idx)) {
                  tokens.push({ type: 'index', index: idx });
                } else {
                  var unquoted = inside.replace(/^['"]|['"]$/g, '');
                  tokens.push({ type: 'child', key: unquoted });
                }
              }
            } else {
              break;
            }
          }
          function evalFilter(item, expr) {
            var m = expr.match(/^@\\.([A-Za-z_$][A-Za-z0-9_$]*)\\s*(===?|!==?|<=?|>=?|<|>)\\s*(.+)$/);
            if (!m) return false;
            var val = item[m[1]];
            var op = m[2];
            var rhs = m[3].trim();
            var cmp;
            if (rhs === 'true') cmp = true;
            else if (rhs === 'false') cmp = false;
            else if (rhs === 'null') cmp = null;
            else if (rhs.charAt(0) === '"' || rhs.charAt(0) === "'") cmp = rhs.substring(1, rhs.length - 1);
            else cmp = Number(rhs);
            switch (op) {
              case '==': case '===': return val == cmp;
              case '!=': case '!==': return val != cmp;
              case '<': return val < cmp;
              case '>': return val > cmp;
              case '<=': return val <= cmp;
              case '>=': return val >= cmp;
              default: return false;
            }
          }
          function descendAll(obj, key) {
            var results = [];
            if (obj !== null && typeof obj === 'object') {
              if (obj.hasOwnProperty(key)) results.push(obj[key]);
              if (Array.isArray(obj)) {
                for (var i = 0; i < obj.length; i++) {
                  results = results.concat(descendAll(obj[i], key));
                }
              } else {
                for (var k in obj) {
                  if (obj.hasOwnProperty(k)) {
                    results = results.concat(descendAll(obj[k], key));
                  }
                }
              }
            }
            return results;
          }
          var current = [obj];
          for (var t = 0; t < tokens.length; t++) {
            var token = tokens[t];
            var next = [];
            if (token.type === 'child') {
              for (var i = 0; i < current.length; i++) {
                if (current[i] !== null && typeof current[i] === 'object' && current[i].hasOwnProperty(token.key)) {
                  next.push(current[i][token.key]);
                }
              }
            } else if (token.type === 'index') {
              for (var i = 0; i < current.length; i++) {
                if (Array.isArray(current[i]) && token.index < current[i].length) {
                  next.push(current[i][token.index]);
                }
              }
            } else if (token.type === 'wildcard') {
              for (var i = 0; i < current.length; i++) {
                if (Array.isArray(current[i])) {
                  for (var j = 0; j < current[i].length; j++) next.push(current[i][j]);
                } else if (current[i] !== null && typeof current[i] === 'object') {
                  for (var k in current[i]) { if (current[i].hasOwnProperty(k)) next.push(current[i][k]); }
                }
              }
            } else if (token.type === 'recursive') {
              for (var i = 0; i < current.length; i++) {
                next = next.concat(descendAll(current[i], token.key));
              }
            } else if (token.type === 'slice') {
              for (var i = 0; i < current.length; i++) {
                if (Array.isArray(current[i])) {
                  var s = token.start || 0;
                  var e = token.end !== undefined ? token.end : current[i].length;
                  for (var j = s; j < e && j < current[i].length; j++) next.push(current[i][j]);
                }
              }
            } else if (token.type === 'filter') {
              for (var i = 0; i < current.length; i++) {
                if (Array.isArray(current[i])) {
                  for (var j = 0; j < current[i].length; j++) {
                    if (evalFilter(current[i][j], token.expr)) next.push(current[i][j]);
                  }
                }
              }
            }
            current = next;
          }
          return current;
        }`;
  }

  /**
   * MongoDB 커넥터별 메서드 바인딩 코드를 생성한다.
   */
  private buildMongoBindings(mongoConnectors: MongoConnectorInfo[]): string {
    return mongoConnectors.map((mc) => `
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
`).join('');
  }

  /**
   * Swagger 커넥터별 operation 메서드 바인딩 코드를 생성한다.
   */
  private buildSwaggerBindings(swaggerConnectors: SwaggerConnectorInfo[]): string {
    return (swaggerConnectors || []).map((sc) => `
        ctx.controls['${sc.controlName}'] = ctx.controls['${sc.controlName}'] || {};
${sc.operations.map((op) => `        ctx.controls['${sc.controlName}']['${op.operationId}'] = function(opts) {
          return __swaggerHandler.applySyncPromise(undefined, [
            '${sc.controlName}',
            '${op.operationId}',
            JSON.stringify(opts || {})
          ]);
        };`).join('\n')}
`).join('');
  }

  private buildDataSourceBindings(dataSourceConnectors: DataSourceConnectorInfo[]): string {
    return (dataSourceConnectors || []).map((dc) => `
        ctx.controls['${dc.controlName}'] = ctx.controls['${dc.controlName}'] || {};
        ctx.controls['${dc.controlName}'].query = function(params) {
          return __dataSourceHandler.applySyncPromise(undefined, ['${dc.controlName}', 'query', JSON.stringify(params || {})]);
        };
        ctx.controls['${dc.controlName}'].rawQuery = function(sql, params) {
          return __dataSourceHandler.applySyncPromise(undefined, ['${dc.controlName}', 'rawQuery', JSON.stringify(sql || ''), JSON.stringify(params || [])]);
        };
        ctx.controls['${dc.controlName}'].execute = function(sql, params) {
          return __dataSourceHandler.applySyncPromise(undefined, ['${dc.controlName}', 'execute', JSON.stringify(sql || ''), JSON.stringify(params || [])]);
        };
        ctx.controls['${dc.controlName}'].tables = function() {
          return __dataSourceHandler.applySyncPromise(undefined, ['${dc.controlName}', 'tables']);
        };
        ctx.controls['${dc.controlName}'].testConnection = function() {
          return __dataSourceHandler.applySyncPromise(undefined, ['${dc.controlName}', 'testConnection']);
        };
`).join('');
  }

  private wrapHandlerCode(
    code: string,
    debugMode?: boolean,
    mongoConnectors: MongoConnectorInfo[] = [],
    swaggerConnectors: SwaggerConnectorInfo[] = [],
    dataSourceConnectors: DataSourceConnectorInfo[] = [],
    shellMode?: boolean,
    currentFormId?: string,
    params?: Record<string, unknown>,
  ): string {
    const traceSetup = debugMode ? this.buildTraceSetup() : '';

    const returnValue = debugMode
      ? shellMode
        ? '{ operations: __operations, logs: __logs, traces: __traces, appState: ctx.appState }'
        : '{ operations: __operations, logs: __logs, traces: __traces }'
      : shellMode
        ? '{ operations: __operations, logs: __logs, appState: ctx.appState }'
        : '{ operations: __operations, logs: __logs }';

    const shellSetup = shellMode
      ? this.buildShellSetup({ currentFormId, params })
      : '';

    return `
      (function(ctx) {
        ctx.controls = ctx.controls || {};
        var __operations = [];
        var __logs = [];
${this.buildFlushChangesHelper()}
${this.buildConsoleShim()}${traceSetup}
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
        ctx.auth = {
          logout: function() {
            __flushChanges();
            __operations.push({
              type: 'authLogout',
              target: '_system',
              payload: {}
            });
          }
        };${shellSetup}
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
${this.buildMongoBindings(mongoConnectors)}
${this.buildSwaggerBindings(swaggerConnectors)}
${this.buildDataSourceBindings(dataSourceConnectors)}
        ctx.getRadioGroupValue = function(groupName) {
          for (var name in ctx.controls) {
            var ctrl = ctx.controls[name];
            if (ctrl.groupName === groupName && ctrl.checked === true) {
              return ctrl.text;
            }
          }
          return null;
        };
${this.buildJsonPathImpl()}
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
