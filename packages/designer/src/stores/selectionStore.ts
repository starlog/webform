import { create } from 'zustand';
import type { ControlDefinition } from '@webform/common';

interface SelectionState {
  selectedIds: Set<string>;
  clipboard: ControlDefinition[];

  select: (id: string) => void;
  deselect: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  copySelected: (controls: ControlDefinition[]) => void;
  pasteControls: () => ControlDefinition[];
}

function generateUniqueName(name: string): string {
  const match = name.match(/^(.+?)(\d+)$/);
  if (match) {
    const base = match[1];
    const num = parseInt(match[2], 10);
    return `${base}${num + 1}`;
  }
  return `${name}_copy`;
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedIds: new Set<string>(),
  clipboard: [],

  select: (id) => set({ selectedIds: new Set([id]) }),

  deselect: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    next.delete(id);
    return { selectedIds: next };
  }),

  toggleSelect: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { selectedIds: next };
  }),

  selectMultiple: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  copySelected: (controls) => set({ clipboard: controls }),

  pasteControls: () => {
    const { clipboard } = get();
    return clipboard.map((control) => ({
      ...structuredClone(control),
      id: crypto.randomUUID(),
      name: generateUniqueName(control.name),
      position: {
        x: control.position.x + 16,
        y: control.position.y + 16,
      },
    }));
  },
}));
