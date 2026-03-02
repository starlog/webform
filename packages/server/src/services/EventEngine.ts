import type {
  ApplicationShellDefinition,
  ControlDefinition,
  DebugLog,
  EventHandlerDefinition,
  EventRequest,
  EventResponse,
  FormDefinition,
  ShellEventRequest,
  UIPatch,
} from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';
import type { MongoConnectorInfo, SwaggerConnectorInfo } from './SandboxRunner.js';
import { buildControlsContext } from './ControlProxy.js';
import { parseSwaggerSpec } from './SwaggerParser.js';

export interface ExecuteEventOptions {
  debugMode?: boolean;
}

/** formDef.controls를 한 번 순회하여 id↔name 매핑, MongoConnector, SwaggerConnector를 모두 수집 */
function analyzeControls(controls: ControlDefinition[]): {
  idToName: Map<string, string>;
  nameToId: Map<string, string>;
  mongoConnectors: MongoConnectorInfo[];
  swaggerConnectors: SwaggerConnectorInfo[];
} {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  const mongoConnectors: MongoConnectorInfo[] = [];
  const swaggerConnectors: SwaggerConnectorInfo[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      // id↔name 매핑
      idToName.set(ctrl.id, ctrl.name);
      nameToId.set(ctrl.name, ctrl.id);

      // MongoDBConnector 수집
      if (ctrl.type === 'MongoDBConnector') {
        mongoConnectors.push({
          controlName: ctrl.name,
          connectionString: (ctrl.properties.connectionString as string) || '',
          database: (ctrl.properties.database as string) || '',
          defaultCollection: (ctrl.properties.defaultCollection as string) || '',
          queryTimeout: (ctrl.properties.queryTimeout as number) || 10000,
          maxResultCount: (ctrl.properties.maxResultCount as number) || 1000,
        });
      }

      // SwaggerConnector 수집
      if (ctrl.type === 'SwaggerConnector') {
        const specYaml = (ctrl.properties.specYaml as string) || '';
        if (specYaml) {
          let parsed;
          try {
            parsed = parseSwaggerSpec(specYaml);
          } catch (err) {
            console.warn(
              `[EventEngine] SwaggerConnector "${ctrl.name}" specYaml 파싱 실패:`,
              (err as Error).message,
            );
            parsed = null;
          }

          if (parsed) {
            // baseUrl 오버라이드: ctrl.properties.baseUrl이 있으면 우선 사용
            const baseUrl = (ctrl.properties.baseUrl as string) || parsed.baseUrl;

            // defaultHeaders 파싱
            let defaultHeaders: Record<string, string> = {};
            const headersStr = (ctrl.properties.defaultHeaders as string) || '{}';
            try {
              defaultHeaders = JSON.parse(headersStr);
            } catch {
              // JSON 파싱 실패 시 빈 객체
            }

            const timeout = (ctrl.properties.timeout as number) || 10000;

            swaggerConnectors.push({
              controlName: ctrl.name,
              operations: parsed.operations,
              baseUrl,
              defaultHeaders,
              timeout,
            });
          }
        }
      }

      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);
  return { idToName, nameToId, mongoConnectors, swaggerConnectors };
}

/** ID 키 formState → NAME 키 formState로 변환 */
function convertToNameKeyed(
  formState: Record<string, Record<string, unknown>>,
  idToName: Map<string, string>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [id, props] of Object.entries(formState)) {
    const name = idToName.get(id) ?? id;
    result[name] = props;
  }
  return result;
}

export class EventEngine {
  private sandboxRunner = new SandboxRunner();

  async executeEvent(
    formId: string,
    payload: EventRequest,
    formDef: FormDefinition,
    options?: ExecuteEventOptions,
  ): Promise<EventResponse> {
    return this.executeEventBase(
      formDef.controls,
      formDef.eventHandlers,
      payload.formState,
      {
        controlId: payload.controlId,
        eventName: payload.eventName,
        eventArgs: payload.eventArgs,
        itemScriptPath: payload.itemScriptPath,
      },
      {
        formId,
        debugMode: options?.debugMode,
      },
    );
  }

  async executeShellEvent(
    _projectId: string,
    payload: ShellEventRequest,
    shellDef: ApplicationShellDefinition,
    appState: Record<string, unknown>,
    options?: ExecuteEventOptions,
  ): Promise<EventResponse> {
    return this.executeEventBase(
      shellDef.controls,
      shellDef.eventHandlers,
      payload.shellState,
      {
        controlId: payload.controlId,
        eventName: payload.eventName,
        eventArgs: payload.eventArgs,
        itemScriptPath: payload.itemScriptPath,
      },
      {
        formId: null,
        debugMode: options?.debugMode,
        isShell: true,
        appState,
        currentFormId: payload.currentFormId,
      },
    );
  }

  /**
   * 아이템 스크립트 또는 이벤트 핸들러에서 핸들러 코드를 조회한다.
   * 아이템 스크립트가 우선이며, 없으면 컨트롤 레벨 핸들러를 사용한다.
   */
  private resolveHandlerCode(
    controls: ControlDefinition[],
    eventHandlers: EventHandlerDefinition[],
    payload: { controlId: string; eventName: string; itemScriptPath?: number[] },
  ): { handlerCode: string } | { error: string } {
    // 아이템 스크립트 우선 처리
    if (payload.itemScriptPath && payload.itemScriptPath.length > 0) {
      const handlerCode = this.findItemScript(
        { controls } as FormDefinition,
        payload.controlId,
        payload.itemScriptPath,
      );
      if (!handlerCode) {
        return {
          error: `No item script found at path [${payload.itemScriptPath.join(',')}] for control ${payload.controlId}`,
        };
      }
      return { handlerCode };
    }

    // 아이템 스크립트가 없으면 기존 컨트롤 레벨 핸들러 사용
    const handler = eventHandlers.find(
      (h) =>
        h.controlId === payload.controlId &&
        h.eventName === payload.eventName &&
        h.handlerType === 'server',
    );

    if (!handler) {
      return {
        error: `No server handler found: ${payload.controlId}.${payload.eventName}`,
      };
    }
    return { handlerCode: handler.handlerCode };
  }

  /**
   * executeEvent / executeShellEvent 공통 실행 흐름.
   * isShell 옵션에 따라 ctx 구성과 패치 추출 방식이 달라진다.
   */
  private async executeEventBase(
    controls: ControlDefinition[],
    eventHandlers: EventHandlerDefinition[],
    formState: Record<string, Record<string, unknown>>,
    payload: { controlId: string; eventName: string; eventArgs: unknown; itemScriptPath?: number[] },
    options: {
      formId: string | null;
      debugMode?: boolean;
      isShell?: boolean;
      appState?: Record<string, unknown>;
      currentFormId?: string;
    },
  ): Promise<EventResponse> {
    // 1. 핸들러 코드 조회
    const resolved = this.resolveHandlerCode(controls, eventHandlers, payload);
    if ('error' in resolved) {
      return { success: false, patches: [], error: resolved.error };
    }
    const { handlerCode } = resolved;

    // 2. 컨트롤 트리 한 번 순회로 ID↔NAME 매핑 + 커넥터 정보 수집
    const { idToName, nameToId, mongoConnectors, swaggerConnectors } = analyzeControls(controls);

    // 3. formState를 NAME 키로 변환 (사용자 코드가 ctx.controls.lblStatus 로 접근)
    const formStateById = JSON.parse(JSON.stringify(formState)) as Record<string, Record<string, unknown>>;
    const formStateByName = convertToNameKeyed(formStateById, idToName);

    // 4. ctx 구성
    const senderName = idToName.get(payload.controlId) ?? payload.controlId;
    const ctx: Record<string, unknown> = {
      formId: options.formId,
      controls: buildControlsContext(formStateByName),
      sender: formStateByName[senderName] ?? {},
      eventArgs: payload.eventArgs,
    };

    // Shell 모드 전용 ctx 속성
    let appStateCopy: Record<string, unknown> | undefined;
    if (options.isShell) {
      appStateCopy = JSON.parse(JSON.stringify(options.appState)) as Record<string, unknown>;
      ctx.currentFormId = options.currentFormId;
      ctx.appState = appStateCopy;
    }

    // 5. SandboxRunner 실행
    const runnerOptions: Record<string, unknown> = {
      debugMode: options.debugMode,
      mongoConnectors,
      swaggerConnectors,
    };
    if (options.isShell) {
      runnerOptions.shellMode = true;
      runnerOptions.appState = appStateCopy;
      runnerOptions.currentFormId = options.currentFormId;
    }

    const result = await this.sandboxRunner.runCode(handlerCode, ctx, runnerOptions);

    // 6. 에러 처리
    if (!result.success) {
      return {
        success: false,
        patches: [],
        error: result.error,
        errorLine: result.errorLine,
        traces: result.traces,
      };
    }

    // 7. 패치 추출 (Shell과 일반 폼에 따라 다른 추출 방식)
    const { patches, logs } = options.isShell
      ? this.extractShellPatches(result.value, nameToId, options.appState!)
      : this.extractPatches(result.value, nameToId);

    return {
      success: true,
      patches,
      logs,
      traces: result.traces,
    };
  }

  private extractPatches(
    resultValue: unknown,
    nameToId: Map<string, string>,
  ): { patches: UIPatch[]; logs?: DebugLog[] } {
    const patches: UIPatch[] = [];
    let logs: DebugLog[] | undefined;

    if (
      resultValue
      && typeof resultValue === 'object'
      && 'operations' in (resultValue as Record<string, unknown>)
    ) {
      const rv = resultValue as Record<string, unknown>;

      if (Array.isArray(rv.operations)) {
        for (const op of rv.operations) {
          const o = op as { type: string; target: string; payload: unknown };
          if (o.type === 'updateProperty') {
            // NAME 기반 target을 ID로 역변환 (런타임이 ID 키를 사용)
            const resolvedId = nameToId.get(o.target);
            if (!resolvedId) {
              console.warn(
                `[EventEngine] 컨트롤 이름 "${o.target}"에 대한 ID 매핑을 찾을 수 없습니다. ` +
                `폼 정의에 해당 이름의 컨트롤이 있는지 확인하세요. 등록된 이름: [${[...nameToId.keys()].join(', ')}]`,
              );
            }
            patches.push({
              ...o,
              target: resolvedId ?? o.target,
            } as UIPatch);
          } else {
            patches.push(o as UIPatch);
          }
        }
      }

      if (Array.isArray(rv.logs)) {
        logs = rv.logs as DebugLog[];
      }
    }

    return { patches, logs };
  }

  private extractShellPatches(
    resultValue: unknown,
    nameToId: Map<string, string>,
    originalAppState: Record<string, unknown>,
  ): { patches: UIPatch[]; logs?: DebugLog[] } {
    const patches: UIPatch[] = [];
    let logs: DebugLog[] | undefined;

    if (
      resultValue &&
      typeof resultValue === 'object' &&
      'operations' in (resultValue as Record<string, unknown>)
    ) {
      const rv = resultValue as Record<string, unknown>;

      if (Array.isArray(rv.operations)) {
        for (const op of rv.operations) {
          const o = op as { type: string; target: string; payload: unknown };
          if (o.type === 'updateProperty') {
            // Shell 컨트롤 변경: updateProperty → updateShell로 변환
            const resolvedId = nameToId.get(o.target) ?? o.target;
            patches.push({
              type: 'updateShell',
              target: resolvedId,
              payload: o.payload as Record<string, unknown>,
            });
          } else {
            // navigate, closeApp, showDialog 등은 그대로
            patches.push(o as UIPatch);
          }
        }
      }

      if (Array.isArray(rv.logs)) {
        logs = rv.logs as DebugLog[];
      }

      // appState 변경 감지
      if (rv.appState && typeof rv.appState === 'object') {
        const newAppState = rv.appState as Record<string, unknown>;
        const changed: Record<string, unknown> = {};
        let hasChanges = false;

        for (const [key, value] of Object.entries(newAppState)) {
          if (JSON.stringify(originalAppState[key]) !== JSON.stringify(value)) {
            changed[key] = value;
            hasChanges = true;
          }
        }
        // 삭제된 키 감지
        for (const key of Object.keys(originalAppState)) {
          if (!(key in newAppState)) {
            changed[key] = undefined;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          patches.push({
            type: 'updateAppState',
            target: '_system',
            payload: changed,
          });
        }
      }
    }

    return { patches, logs };
  }

  /** formDef.controls에서 controlId로 컨트롤을 재귀 검색 */
  private findControlById(controls: ControlDefinition[], controlId: string): ControlDefinition | null {
    for (const ctrl of controls) {
      if (ctrl.id === controlId) return ctrl;
      if (ctrl.children) {
        const found = this.findControlById(ctrl.children, controlId);
        if (found) return found;
      }
    }
    return null;
  }

  /** 컨트롤의 items에서 path 인덱스로 아이템을 찾아 script 반환 */
  private findItemScript(formDef: FormDefinition, controlId: string, path: number[]): string | undefined {
    const control = this.findControlById(formDef.controls, controlId);
    if (!control) return undefined;

    const items = control.properties.items as unknown[] | undefined;
    if (!Array.isArray(items) || items.length === 0) return undefined;

    let current: Record<string, unknown> | undefined;
    let currentItems = items;

    for (let i = 0; i < path.length; i++) {
      const idx = path[i];
      if (idx < 0 || idx >= currentItems.length) return undefined;
      current = currentItems[idx] as Record<string, unknown>;
      if (!current || typeof current !== 'object') return undefined;

      if (i < path.length - 1) {
        // MenuStrip uses 'children', ToolStrip dropdown uses 'items'
        const next = (current.children ?? current.items) as unknown[] | undefined;
        if (!Array.isArray(next)) return undefined;
        currentItems = next;
      }
    }

    return current?.script as string | undefined;
  }

}
