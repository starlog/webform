import type {
  ApplicationShellDefinition,
  ControlDefinition,
  DebugLog,
  EventRequest,
  EventResponse,
  FormDefinition,
  ShellEventRequest,
  UIPatch,
} from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';
import type { MongoConnectorInfo } from './SandboxRunner.js';
import { buildControlsContext } from './ControlProxy.js';

export interface ExecuteEventOptions {
  debugMode?: boolean;
}

/** formDef.controls에서 id↔name 매핑 생성 (children 포함 재귀) */
function buildControlMaps(controls: ControlDefinition[]): {
  idToName: Map<string, string>;
  nameToId: Map<string, string>;
} {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      idToName.set(ctrl.id, ctrl.name);
      nameToId.set(ctrl.name, ctrl.id);
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);
  return { idToName, nameToId };
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
    const handler = formDef.eventHandlers.find(
      (h) => h.controlId === payload.controlId
        && h.eventName === payload.eventName
        && h.handlerType === 'server',
    );

    if (!handler) {
      return {
        success: false,
        patches: [],
        error: `No server handler found: ${payload.controlId}.${payload.eventName}`,
      };
    }

    // ID↔NAME 매핑 구축
    const { idToName, nameToId } = buildControlMaps(formDef.controls);

    // formState를 NAME 키로 변환 (사용자 코드가 ctx.controls.lblStatus 로 접근)
    const formStateById = JSON.parse(JSON.stringify(payload.formState)) as Record<string, Record<string, unknown>>;
    const formStateByName = convertToNameKeyed(formStateById, idToName);

    const senderName = idToName.get(payload.controlId) ?? payload.controlId;
    const ctx = {
      formId,
      controls: buildControlsContext(formStateByName),
      sender: formStateByName[senderName] ?? {},
      eventArgs: payload.eventArgs,
    };

    const mongoConnectors = this.extractMongoConnectors(formDef.controls);

    const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
      debugMode: options?.debugMode,
      mongoConnectors,
    });

    if (!result.success) {
      return {
        success: false,
        patches: [],
        error: result.error,
        errorLine: result.errorLine,
        traces: result.traces,
      };
    }

    const { patches, logs } = this.extractPatches(result.value, nameToId);

    return {
      success: true,
      patches,
      logs,
      traces: result.traces,
    };
  }

  async executeShellEvent(
    _projectId: string,
    payload: ShellEventRequest,
    shellDef: ApplicationShellDefinition,
    appState: Record<string, unknown>,
    options?: ExecuteEventOptions,
  ): Promise<EventResponse> {
    const handler = shellDef.eventHandlers.find(
      (h) =>
        h.controlId === payload.controlId &&
        h.eventName === payload.eventName &&
        h.handlerType === 'server',
    );

    if (!handler) {
      return {
        success: false,
        patches: [],
        error: `No server handler found: ${payload.controlId}.${payload.eventName}`,
      };
    }

    // Shell controls ID↔NAME 매핑
    const { idToName, nameToId } = buildControlMaps(shellDef.controls);
    const shellStateById = JSON.parse(JSON.stringify(payload.shellState)) as Record<
      string,
      Record<string, unknown>
    >;
    const shellStateByName = convertToNameKeyed(shellStateById, idToName);

    const senderName = idToName.get(payload.controlId) ?? payload.controlId;
    const appStateCopy = JSON.parse(JSON.stringify(appState)) as Record<string, unknown>;

    const ctx = {
      formId: null,
      controls: buildControlsContext(shellStateByName),
      sender: shellStateByName[senderName] ?? {},
      eventArgs: payload.eventArgs,
      currentFormId: payload.currentFormId,
      appState: appStateCopy,
    };

    const mongoConnectors = this.extractMongoConnectors(shellDef.controls);

    const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
      debugMode: options?.debugMode,
      mongoConnectors,
      shellMode: true,
      appState: appStateCopy,
      currentFormId: payload.currentFormId,
    });

    if (!result.success) {
      return {
        success: false,
        patches: [],
        error: result.error,
        errorLine: result.errorLine,
        traces: result.traces,
      };
    }

    const { patches, logs } = this.extractShellPatches(result.value, nameToId, appState);

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

  private extractMongoConnectors(controls: ControlDefinition[]): MongoConnectorInfo[] {
    const connectors: MongoConnectorInfo[] = [];

    function walk(ctrls: ControlDefinition[]) {
      for (const ctrl of ctrls) {
        if (ctrl.type === 'MongoDBConnector') {
          connectors.push({
            controlName: ctrl.name,
            connectionString: (ctrl.properties.connectionString as string) || '',
            database: (ctrl.properties.database as string) || '',
            defaultCollection: (ctrl.properties.defaultCollection as string) || '',
            queryTimeout: (ctrl.properties.queryTimeout as number) || 10000,
            maxResultCount: (ctrl.properties.maxResultCount as number) || 1000,
          });
        }
        if (ctrl.children) walk(ctrl.children);
      }
    }
    walk(controls);
    return connectors;
  }
}
