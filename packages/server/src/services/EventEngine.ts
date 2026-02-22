import type {
  EventRequest,
  EventResponse,
  FormDefinition,
  UIPatch,
} from '@webform/common';
import { SandboxRunner } from './SandboxRunner.js';
import { snapshotState, diffToPatches, buildControlsContext } from './ControlProxy.js';

export class EventEngine {
  private sandboxRunner = new SandboxRunner();

  async executeEvent(
    formId: string,
    payload: EventRequest,
    formDef: FormDefinition,
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

    const before = snapshotState(payload.formState);

    const formState = JSON.parse(JSON.stringify(payload.formState));
    const ctx = {
      formId,
      controls: buildControlsContext(formState),
      sender: formState[payload.controlId] ?? {},
      eventArgs: payload.eventArgs,
    };

    const result = await this.sandboxRunner.runCode(handler.handlerCode, ctx);

    if (!result.success) {
      return {
        success: false,
        patches: [],
        error: result.error,
      };
    }

    const patches = this.extractPatches(before, result.value);

    return {
      success: true,
      patches,
    };
  }

  private extractPatches(
    before: Record<string, Record<string, unknown>>,
    resultValue: unknown,
  ): UIPatch[] {
    if (
      resultValue
      && typeof resultValue === 'object'
      && 'controls' in (resultValue as Record<string, unknown>)
    ) {
      const after = (resultValue as Record<string, unknown>)
        .controls as Record<string, Record<string, unknown>>;
      return diffToPatches(before, after);
    }

    return [];
  }
}
