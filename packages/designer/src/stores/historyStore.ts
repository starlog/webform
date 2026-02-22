import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const MAX_HISTORY = 50;

interface HistoryState {
  past: string[];
  future: string[];
  canUndo: boolean;
  canRedo: boolean;

  pushSnapshot: (snapshot: string) => void;
  undo: () => string | null;
  redo: () => string | null;
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

    undo: () => {
      const { past } = get();
      if (past.length === 0) return null;

      const previous = past.length > 1 ? past[past.length - 2] : null;

      set((state) => {
        const popped = state.past.pop()!;
        state.future.push(popped);
        state.canUndo = state.past.length > 0;
        state.canRedo = true;
      });

      return previous;
    },

    redo: () => {
      const { future } = get();
      if (future.length === 0) return null;

      set((state) => {
        const snapshot = state.future.pop()!;
        state.past.push(snapshot);
        state.canUndo = true;
        state.canRedo = state.future.length > 0;
      });

      return get().past[get().past.length - 1];
    },

    clear: () => set((state) => {
      state.past = [];
      state.future = [];
      state.canUndo = false;
      state.canRedo = false;
    }),
  })),
);
