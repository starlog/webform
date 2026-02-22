import type {
  ControlDefinition,
  DebugLog,
  EventRequest,
  EventResponse,
  FormDefinition,
  UIPatch,
} from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';
import { snapshotState, diffToPatches, buildControlsContext } from './ControlProxy.js';

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

    const before = snapshotState(formStateByName);

    const senderName = idToName.get(payload.controlId) ?? payload.controlId;
    const ctx = {
      formId,
      controls: buildControlsContext(formStateByName),
      sender: formStateByName[senderName] ?? {},
      eventArgs: payload.eventArgs,
    };

    const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx, {
      debugMode: options?.debugMode,
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

    const { patches, logs } = this.extractPatches(before, result.value, nameToId);

    return {
      success: true,
      patches,
      logs,
      traces: result.traces,
    };
  }

  private extractPatches(
    before: Record<string, Record<string, unknown>>,
    resultValue: unknown,
    nameToId: Map<string, string>,
  ): { patches: UIPatch[]; logs?: DebugLog[] } {
    const patches: UIPatch[] = [];
    let logs: DebugLog[] | undefined;

    if (
      resultValue
      && typeof resultValue === 'object'
      && 'controls' in (resultValue as Record<string, unknown>)
    ) {
      const rv = resultValue as Record<string, unknown>;
      const after = rv.controls as Record<string, Record<string, unknown>>;
      const rawPatches = diffToPatches(before, after);

      // NAME 기반 patch target을 ID로 역변환 (런타임이 ID 키를 사용)
      for (const patch of rawPatches) {
        patches.push({
          ...patch,
          target: nameToId.get(patch.target) ?? patch.target,
        });
      }

      if (Array.isArray(rv.messages)) {
        for (const msg of rv.messages) {
          const m = msg as Record<string, unknown>;
          patches.push({
            type: 'showDialog',
            target: '_system',
            payload: {
              text: String(m.text ?? ''),
              title: String(m.title ?? ''),
              dialogType: String(m.dialogType ?? 'info'),
            },
          });
        }
      }

      if (Array.isArray(rv.navigations)) {
        for (const nav of rv.navigations) {
          const n = nav as Record<string, unknown>;
          patches.push({
            type: 'navigate',
            target: '_system',
            payload: {
              formId: String(n.formId ?? ''),
              params: (n.params as Record<string, unknown>) ?? {},
            },
          });
        }
      }

      if (Array.isArray(rv.logs)) {
        logs = rv.logs as DebugLog[];
      }
    }

    return { patches, logs };
  }
}
