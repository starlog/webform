import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CustomThemeDocument, ThemeTokens, PresetThemeId } from '@webform/common';
import { getPresetThemeById } from '@webform/common';

interface ThemeEditorState {
  themes: CustomThemeDocument[];
  currentThemeId: string | null;
  currentTheme: ThemeTokens | null;
  isDirty: boolean;
  loading: boolean;

  setThemes: (themes: CustomThemeDocument[]) => void;
  selectTheme: (id: string, tokens: ThemeTokens) => void;
  selectPreset: (id: PresetThemeId) => void;
  clearSelection: () => void;
  updateToken: (path: string, value: unknown) => void;
  setCurrentThemeName: (name: string) => void;
  markClean: () => void;
  setLoading: (loading: boolean) => void;
  addTheme: (theme: CustomThemeDocument) => void;
  removeTheme: (id: string) => void;
  updateThemeInList: (theme: CustomThemeDocument) => void;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

export const useThemeEditorStore = create<ThemeEditorState>()(
  immer((set) => ({
    themes: [],
    currentThemeId: null,
    currentTheme: null,
    isDirty: false,
    loading: false,

    setThemes: (themes) =>
      set((state) => {
        state.themes = themes;
      }),

    selectTheme: (id, tokens) =>
      set((state) => {
        state.currentThemeId = id;
        state.currentTheme = tokens;
        state.isDirty = false;
      }),

    selectPreset: (id) =>
      set((state) => {
        state.currentThemeId = id;
        state.currentTheme = getPresetThemeById(id);
        state.isDirty = false;
      }),

    clearSelection: () =>
      set((state) => {
        state.currentThemeId = null;
        state.currentTheme = null;
        state.isDirty = false;
      }),

    updateToken: (path, value) =>
      set((state) => {
        if (!state.currentTheme) return;
        setNestedValue(state.currentTheme as unknown as Record<string, unknown>, path, value);
        state.isDirty = true;
      }),

    setCurrentThemeName: (name) =>
      set((state) => {
        if (!state.currentTheme) return;
        state.currentTheme.name = name;
        state.isDirty = true;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.loading = loading;
      }),

    addTheme: (theme) =>
      set((state) => {
        state.themes.push(theme);
      }),

    removeTheme: (id) =>
      set((state) => {
        state.themes = state.themes.filter((t) => t._id !== id);
        if (state.currentThemeId === id) {
          state.currentThemeId = null;
          state.currentTheme = null;
          state.isDirty = false;
        }
      }),

    updateThemeInList: (theme) =>
      set((state) => {
        const index = state.themes.findIndex((t) => t._id === theme._id);
        if (index !== -1) {
          state.themes[index] = theme;
        }
      }),
  })),
);
