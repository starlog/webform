import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FormDefinition,
  ControlDefinition,
  UIPatch,
  ApplicationShellDefinition,
} from '@webform/common';

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
  pendingPatchGroups: UIPatch[][];

  // Shell 관련 상태
  shellDef: ApplicationShellDefinition | null;
  shellControlStates: Record<string, Record<string, unknown>>;
  appState: Record<string, unknown>;
  formHistory: Array<{ formId: string; params?: Record<string, unknown> }>;
  navigateParams: Record<string, unknown>;

  setFormDef: (def: FormDefinition) => void;
  updateControlState: (controlId: string, property: string, value: unknown) => void;
  getControlState: (controlId: string) => Record<string, unknown>;
  applyPatch: (patch: UIPatch) => void;
  applyPatches: (patches: UIPatch[]) => void;
  dismissDialog: () => void;
  requestNavigate: (formId: string, params?: Record<string, unknown>) => void;
  clearNavigateRequest: () => void;

  // Shell 관련 메서드
  setShellDef: (def: ApplicationShellDefinition | null) => void;
  updateShellControlState: (controlId: string, property: string, value: unknown) => void;
  getShellControlState: (controlId: string) => Record<string, unknown>;
  applyShellPatches: (patches: UIPatch[]) => void;
  setAppState: (key: string, value: unknown) => void;
  pushFormHistory: (formId: string, params?: Record<string, unknown>) => void;
  popFormHistory: () => { formId: string; params?: Record<string, unknown> } | null;
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

/** 단일 패치를 immer draft 상태에 적용하는 헬퍼 */
function applyPatchToState(
  state: {
    controlStates: Record<string, Record<string, unknown>>;
    currentFormDef: FormDefinition | null;
    dialogQueue: DialogMessage[];
    navigateRequest: NavigateRequest | null;
  },
  patch: UIPatch,
): void {
  switch (patch.type) {
    case 'updateProperty': {
      const controlState = state.controlStates[patch.target];
      if (controlState) {
        Object.assign(controlState, patch.payload);
      } else {
        console.warn(
          `[UIPatch] controlStates에 "${patch.target}" 키가 없습니다. ` +
          `패치가 무시됩니다. payload:`,
          patch.payload,
        );
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

export const useRuntimeStore = create<RuntimeState>()(
  immer((set, get) => ({
    currentFormDef: null,
    controlStates: {},
    dialogQueue: [],
    navigateRequest: null,
    pendingPatchGroups: [],

    // Shell 초기 상태
    shellDef: null,
    shellControlStates: {},
    appState: {},
    formHistory: [],
    navigateParams: {},

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
        applyPatchToState(state, patch);
      }),

    applyPatches: (patches) =>
      set((state) => {
        // showDialog 경계 기준으로 패치를 그룹으로 분할
        const groups: UIPatch[][] = [];
        let currentGroup: UIPatch[] = [];

        for (const patch of patches) {
          currentGroup.push(patch);
          if (patch.type === 'showDialog') {
            groups.push(currentGroup);
            currentGroup = [];
          }
        }
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }

        // 첫 번째 그룹만 즉시 적용
        if (groups.length > 0) {
          for (const patch of groups[0]) {
            applyPatchToState(state, patch);
          }
        }

        // 나머지 그룹은 pending으로 저장
        if (groups.length > 1) {
          state.pendingPatchGroups.push(...groups.slice(1));
        }
      }),

    dismissDialog: () =>
      set((state) => {
        state.dialogQueue.shift();

        // 다이얼로그 큐가 비고 대기 중인 패치 그룹이 있으면 다음 그룹 적용
        if (state.dialogQueue.length === 0 && state.pendingPatchGroups.length > 0) {
          const nextGroup = state.pendingPatchGroups.shift()!;
          for (const patch of nextGroup) {
            applyPatchToState(state, patch);
          }
        }
      }),

    requestNavigate: (formId, params) =>
      set((state) => {
        state.navigateRequest = { formId, params: params ?? {} };
      }),

    clearNavigateRequest: () =>
      set((state) => {
        state.navigateRequest = null;
      }),

    // --- Shell 관련 메서드 ---

    setShellDef: (def) =>
      set((state) => {
        state.shellDef = def;
        state.shellControlStates = {};
        if (def) {
          initControlStates(def.controls, state.shellControlStates);
        }
      }),

    updateShellControlState: (controlId, property, value) =>
      set((state) => {
        if (!state.shellControlStates[controlId]) {
          state.shellControlStates[controlId] = {};
        }
        state.shellControlStates[controlId][property] = value;
      }),

    getShellControlState: (controlId) => {
      return get().shellControlStates[controlId] ?? {};
    },

    applyShellPatches: (patches) =>
      set((state) => {
        for (const patch of patches) {
          switch (patch.type) {
            case 'updateShell': {
              const controlState = state.shellControlStates[patch.target];
              if (controlState) {
                Object.assign(controlState, patch.payload);
              }
              break;
            }
            case 'updateAppState': {
              for (const [key, value] of Object.entries(patch.payload)) {
                if (value === undefined) {
                  delete state.appState[key];
                } else {
                  state.appState[key] = value;
                }
              }
              break;
            }
            case 'navigate': {
              const navPayload = patch.payload as {
                formId?: string;
                params?: Record<string, unknown>;
                back?: boolean;
              };
              if (navPayload.back) {
                const prev =
                  state.formHistory.length > 0
                    ? state.formHistory[state.formHistory.length - 1]
                    : null;
                if (prev) {
                  state.formHistory.pop();
                  state.navigateRequest = {
                    formId: prev.formId,
                    params: prev.params ?? {},
                  };
                  state.navigateParams = prev.params ?? {};
                }
              } else {
                state.navigateRequest = {
                  formId: navPayload.formId ?? '',
                  params: navPayload.params ?? {},
                };
                state.navigateParams = navPayload.params ?? {};
              }
              break;
            }
            case 'closeApp': {
              try {
                window.close();
              } catch {
                window.location.href = 'about:blank';
              }
              break;
            }
            case 'showDialog': {
              const payload = patch.payload as {
                text?: string;
                title?: string;
                dialogType?: string;
              };
              state.dialogQueue.push({
                text: payload.text ?? '',
                title: payload.title ?? '',
                dialogType: (payload.dialogType as DialogMessage['dialogType']) ?? 'info',
              });
              break;
            }
            default:
              break;
          }
        }
      }),

    setAppState: (key, value) =>
      set((state) => {
        state.appState[key] = value;
      }),

    pushFormHistory: (formId, params) =>
      set((state) => {
        state.formHistory.push({ formId, params });
      }),

    popFormHistory: () => {
      const history = get().formHistory;
      if (history.length === 0) return null;
      const last = history[history.length - 1];
      set((state) => {
        state.formHistory.pop();
      });
      return last;
    },
  })),
);
