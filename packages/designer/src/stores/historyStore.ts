import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ControlDefinition, FormProperties } from '@webform/common';
import { useDesignerStore } from './designerStore';

const MAX_HISTORY = 50;

export interface Snapshot {
  controls: ControlDefinition[];
  formProperties: FormProperties;
}

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  pushSnapshot: (snapshot: Snapshot) => void;
  undo: (currentSnapshot: Snapshot) => Snapshot | null;
  redo: (currentSnapshot: Snapshot) => Snapshot | null;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    pushSnapshot: (snapshot) => set((state) => {
      state.past.push(snapshot);
      if (state.past.length > MAX_HISTORY) {
        state.past.shift();
      }
      state.future = [];
      state.canUndo = true;
      state.canRedo = false;
    }),

    undo: (currentSnapshot) => {
      const { past } = get();
      if (past.length === 0) return null;

      const restored = past[past.length - 1];

      set((state) => {
        state.past.pop();
        state.future.push(currentSnapshot);
        state.canUndo = state.past.length > 0;
        state.canRedo = true;
      });

      return restored;
    },

    redo: (currentSnapshot) => {
      const { future } = get();
      if (future.length === 0) return null;

      const restored = future[future.length - 1];

      set((state) => {
        state.future.pop();
        state.past.push(currentSnapshot);
        state.canUndo = true;
        state.canRedo = state.future.length > 0;
      });

      return restored;
    },

    clear: () => set((state) => {
      state.past = [];
      state.future = [];
      state.canUndo = false;
      state.canRedo = false;
    }),
  })),
);

// --- 스냅샷 유틸리티 ---

/** 현재 controls + formProperties를 얕은 복사 스냅샷으로 생성 (구조적 공유) */
export function createSnapshot(): Snapshot {
  const { controls, formProperties } = useDesignerStore.getState();
  return {
    controls: [...controls],
    formProperties: { ...formProperties },
  };
}

/** 스냅샷을 복원하여 controls + formProperties를 교체 */
export function restoreSnapshot(snapshot: Snapshot): void {
  useDesignerStore.setState({
    controls: [...snapshot.controls],
    formProperties: { ...snapshot.formProperties },
    isDirty: true,
  });
}
