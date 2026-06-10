import { useCallback, useMemo } from 'react';
import type {
  ControlDefinition,
  EventHandlerDefinition,
  EventArgs,
  ControlProxy,
  FormContext,
} from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';

function eventNameToProp(eventName: string): string {
  return `on${eventName}`;
}

/** 컨트롤 이름으로 ID를 찾는다 (재귀). controlStates는 ID 키이므로 이름 → ID 변환이 필요 */
function findControlIdByName(controls: ControlDefinition[], name: string): string | null {
  for (const c of controls) {
    if (c.name === name) return c.id;
    if (c.children && c.children.length > 0) {
      const found = findControlIdByName(c.children, name);
      if (found) return found;
    }
  }
  return null;
}

/** ctx.controls.<이름> 접근 시 이름을 컨트롤 ID로 해석 (ID를 직접 쓴 경우는 그대로 통과) */
function resolveControlId(nameOrId: string): string {
  const def = useRuntimeStore.getState().currentFormDef;
  if (!def) return nameOrId;
  return findControlIdByName(def.controls, nameOrId) ?? nameOrId;
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
      return createControlProxy(resolveControlId(prop), getStates, updateState);
    },
  });

  return {
    formId: getFormId(),
    controls: controlsProxy,
    dataSources: {},
    showDialog: async () => ({ dialogResult: 'Cancel' as const, data: {} }),
    navigate: (formId: string, params?: Record<string, unknown>) => {
      useRuntimeStore.getState().requestNavigate(formId, params);
    },
    close: () => { console.warn('close not yet implemented'); },
    getRadioGroupValue: () => null,
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
            if (!response.success) {
              console.error(
                `[EventHandler] 서버 핸들러 실행 실패 [${controlId}.${evt.eventName}]:`,
                response.error,
              );
              useRuntimeStore.getState().enqueueDialog({
                title: '오류',
                text: response.error || '요청을 처리하지 못했습니다.',
                dialogType: 'error',
              });
            }
          } catch (err) {
            console.error(`Server event handler error [${controlId}.${evt.eventName}]:`, err);
            useRuntimeStore.getState().enqueueDialog({
              title: '오류',
              text: '서버와 통신하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
              dialogType: 'error',
            });
          }
        };
      }
    }

    return result;
  }, [relevantEvents, controlId, getFormId, getControlStates, updateControlState, applyPatches, getFormState]);

  return handlers;
}
