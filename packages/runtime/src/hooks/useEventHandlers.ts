import { useCallback, useMemo } from 'react';
import type { EventHandlerDefinition, EventArgs, ControlProxy, FormContext } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';

function eventNameToProp(eventName: string): string {
  return `on${eventName}`;
}

function createControlProxy(controlId: string, getState: () => Record<string, Record<string, unknown>>, updateState: (id: string, prop: string, val: unknown) => void): ControlProxy {
  return new Proxy({} as ControlProxy, {
    get(_target, prop: string) {
      return getState()[controlId]?.[prop];
    },
    set(_target, prop: string, value: unknown) {
      updateState(controlId, prop, value);
      return true;
    },
  });
}

function createFormContext(
  _controlId: string,
  getFormId: () => string,
  getStates: () => Record<string, Record<string, unknown>>,
  updateState: (id: string, prop: string, val: unknown) => void,
): FormContext {
  const controlsProxy = new Proxy({} as Record<string, ControlProxy>, {
    get(_target, prop: string) {
      return createControlProxy(prop, getStates, updateState);
    },
  });

  return {
    formId: getFormId(),
    controls: controlsProxy,
    dataSources: {},
    showDialog: async () => ({ dialogResult: 'Cancel' as const, data: {} }),
    navigate: () => { console.warn('navigate not yet implemented'); },
    close: () => { console.warn('close not yet implemented'); },
  };
}

export function useEventHandlers(
  controlId: string,
  events: EventHandlerDefinition[],
): Record<string, (args?: Partial<EventArgs>) => void> {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const applyPatches = useRuntimeStore((s) => s.applyPatches);

  const getControlStates = useCallback(() => useRuntimeStore.getState().controlStates, []);
  const getFormId = useCallback(() => useRuntimeStore.getState().currentFormDef?.id ?? '', []);
  const getFormState = useCallback(() => useRuntimeStore.getState().controlStates, []);

  const relevantEvents = useMemo(
    () => events.filter((e) => e.controlId === controlId),
    [events, controlId],
  );

  const handlers = useMemo(() => {
    const result: Record<string, (args?: Partial<EventArgs>) => void> = {};

    for (const evt of relevantEvents) {
      const propName = eventNameToProp(evt.eventName);

      if (evt.handlerType === 'client') {
        result[propName] = () => {
          const ctx = createFormContext(controlId, getFormId, getControlStates, updateControlState);
          const sender = createControlProxy(controlId, getControlStates, updateControlState);
          const eventArgs: EventArgs = {
            type: evt.eventName,
            timestamp: Date.now(),
          };
          try {
            const fn = new Function('sender', 'e', 'ctx', evt.handlerCode);
            fn(sender, eventArgs, ctx);
          } catch (err) {
            console.error(`Client event handler error [${controlId}.${evt.eventName}]:`, err);
          }
        };
      } else {
        // server event
        result[propName] = async () => {
          const formId = getFormId();
          const eventArgs: EventArgs = {
            type: evt.eventName,
            timestamp: Date.now(),
          };
          try {
            const response = await apiClient.postEvent(formId, {
              formId,
              controlId,
              eventName: evt.eventName,
              eventArgs,
              formState: getFormState(),
            });
            if (response.success && response.patches) {
              applyPatches(response.patches);
            }
          } catch (err) {
            console.error(`Server event handler error [${controlId}.${evt.eventName}]:`, err);
          }
        };
      }
    }

    return result;
  }, [relevantEvents, controlId, getFormId, getControlStates, updateControlState, applyPatches, getFormState]);

  return handlers;
}
