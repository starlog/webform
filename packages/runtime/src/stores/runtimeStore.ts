import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FormDefinition, ControlDefinition, UIPatch } from '@webform/common';

export interface DialogMessage {
  text: string;
  title: string;
  dialogType: 'info' | 'warning' | 'error' | 'success';
}

export interface NavigateRequest {
  formId: string;
  params: Record<string, unknown>;
}

export interface RuntimeState {
  currentFormDef: FormDefinition | null;
  controlStates: Record<string, Record<string, unknown>>;
  dialogQueue: DialogMessage[];
  navigateRequest: NavigateRequest | null;

  setFormDef: (def: FormDefinition) => void;
  updateControlState: (controlId: string, property: string, value: unknown) => void;
  getControlState: (controlId: string) => Record<string, unknown>;
  applyPatch: (patch: UIPatch) => void;
  applyPatches: (patches: UIPatch[]) => void;
  dismissDialog: () => void;
  requestNavigate: (formId: string, params?: Record<string, unknown>) => void;
  clearNavigateRequest: () => void;
}

function initControlStates(
  controls: ControlDefinition[],
  states: Record<string, Record<string, unknown>>,
) {
  for (const ctrl of controls) {
    states[ctrl.id] = {
      ...ctrl.properties,
      visible: ctrl.visible,
      enabled: ctrl.enabled,
    };
    if (ctrl.children) {
      initControlStates(ctrl.children, states);
    }
  }
}

function removeControlFromList(controls: ControlDefinition[], targetId: string): ControlDefinition[] {
  return controls.filter(c => {
    if (c.id === targetId) return false;
    if (c.children) {
      c.children = removeControlFromList(c.children, targetId);
    }
    return true;
  });
}

function addControlToParent(
  controls: ControlDefinition[],
  parentId: string,
  newControl: ControlDefinition,
): boolean {
  for (const c of controls) {
    if (c.id === parentId) {
      if (!c.children) c.children = [];
      c.children.push(newControl);
      return true;
    }
    if (c.children && addControlToParent(c.children, parentId, newControl)) {
      return true;
    }
  }
  return false;
}

export const useRuntimeStore = create<RuntimeState>()(
  immer((set, get) => ({
    currentFormDef: null,
    controlStates: {},
    dialogQueue: [],
    navigateRequest: null,

    setFormDef: (def) =>
      set((state) => {
        state.currentFormDef = def;
        state.controlStates = {};
        initControlStates(def.controls, state.controlStates);
      }),

    updateControlState: (controlId, property, value) =>
      set((state) => {
        if (!state.controlStates[controlId]) {
          state.controlStates[controlId] = {};
        }
        state.controlStates[controlId][property] = value;
      }),

    getControlState: (controlId) => {
      return get().controlStates[controlId] ?? {};
    },

    applyPatch: (patch) =>
      set((state) => {
        switch (patch.type) {
          case 'updateProperty': {
            const controlState = state.controlStates[patch.target];
            if (controlState) {
              Object.assign(controlState, patch.payload);
            }
            break;
          }
          case 'addControl': {
            const newControl = patch.payload as unknown as ControlDefinition;
            if (state.currentFormDef) {
              if (!addControlToParent(state.currentFormDef.controls, patch.target, newControl)) {
                state.currentFormDef.controls.push(newControl);
              }
              state.controlStates[newControl.id] = {
                ...newControl.properties,
                visible: newControl.visible,
                enabled: newControl.enabled,
              };
            }
            break;
          }
          case 'removeControl': {
            delete state.controlStates[patch.target];
            if (state.currentFormDef) {
              state.currentFormDef.controls = removeControlFromList(
                state.currentFormDef.controls,
                patch.target,
              );
            }
            break;
          }
          case 'showDialog': {
            const payload = patch.payload as { text?: string; title?: string; dialogType?: string };
            state.dialogQueue.push({
              text: payload.text ?? '',
              title: payload.title ?? '',
              dialogType: (payload.dialogType as DialogMessage['dialogType']) ?? 'info',
            });
            break;
          }
          case 'navigate': {
            const navPayload = patch.payload as { formId?: string; params?: Record<string, unknown> };
            state.navigateRequest = {
              formId: navPayload.formId ?? '',
              params: navPayload.params ?? {},
            };
            break;
          }
        }
      }),

    applyPatches: (patches) =>
      set((state) => {
        for (const patch of patches) {
          switch (patch.type) {
            case 'updateProperty': {
              const controlState = state.controlStates[patch.target];
              if (controlState) {
                Object.assign(controlState, patch.payload);
              }
              break;
            }
            case 'addControl': {
              const newControl = patch.payload as unknown as ControlDefinition;
              if (state.currentFormDef) {
                if (!addControlToParent(state.currentFormDef.controls, patch.target, newControl)) {
                  state.currentFormDef.controls.push(newControl);
                }
                state.controlStates[newControl.id] = {
                  ...newControl.properties,
                  visible: newControl.visible,
                  enabled: newControl.enabled,
                };
              }
              break;
            }
            case 'removeControl': {
              delete state.controlStates[patch.target];
              if (state.currentFormDef) {
                state.currentFormDef.controls = removeControlFromList(
                  state.currentFormDef.controls,
                  patch.target,
                );
              }
              break;
            }
            case 'showDialog': {
              const payload = patch.payload as { text?: string; title?: string; dialogType?: string };
              state.dialogQueue.push({
                text: payload.text ?? '',
                title: payload.title ?? '',
                dialogType: (payload.dialogType as DialogMessage['dialogType']) ?? 'info',
              });
              break;
            }
            case 'navigate': {
              const navPayload = patch.payload as { formId?: string; params?: Record<string, unknown> };
              state.navigateRequest = {
                formId: navPayload.formId ?? '',
                params: navPayload.params ?? {},
              };
              break;
            }
          }
        }
      }),

    dismissDialog: () =>
      set((state) => {
        state.dialogQueue.shift();
      }),

    requestNavigate: (formId, params) =>
      set((state) => {
        state.navigateRequest = { formId, params: params ?? {} };
      }),

    clearNavigateRequest: () =>
      set((state) => {
        state.navigateRequest = null;
      }),
  })),
);
