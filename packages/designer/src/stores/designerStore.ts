import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ControlDefinition, ControlType, FormProperties } from '@webform/common';

const DEFAULT_FORM_PROPERTIES: FormProperties = {
  title: 'Form1',
  width: 800,
  height: 600,
  backgroundColor: '#F0F0F0',
  font: {
    family: 'Segoe UI',
    size: 9,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  },
  startPosition: 'CenterScreen',
  formBorderStyle: 'Sizable',
  maximizeBox: true,
  minimizeBox: true,
};

interface DesignerState {
  controls: ControlDefinition[];
  formProperties: FormProperties;
  isDirty: boolean;
  currentFormId: string | null;
  currentProjectId: string | null;
  gridSize: number;

  addControl: (control: ControlDefinition) => void;
  updateControl: (id: string, changes: Partial<ControlDefinition>) => void;
  removeControl: (id: string) => void;
  removeControls: (ids: string[]) => void;
  moveControl: (id: string, position: { x: number; y: number }) => void;
  resizeControl: (id: string, size: { width: number; height: number }, position?: { x: number; y: number }) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setFormProperties: (props: Partial<FormProperties>) => void;
  setGridSize: (size: number) => void;
  loadForm: (formId: string, controls: ControlDefinition[], properties: FormProperties) => void;
  markClean: () => void;
  setCurrentProject: (projectId: string | null) => void;
}

// 컨트롤 타입별 기본 크기
function getDefaultSize(type: ControlType): { width: number; height: number } {
  const sizes: Partial<Record<ControlType, { width: number; height: number }>> = {
    Button:         { width: 75,  height: 23 },
    Label:          { width: 100, height: 23 },
    TextBox:        { width: 100, height: 23 },
    CheckBox:       { width: 104, height: 24 },
    RadioButton:    { width: 104, height: 24 },
    ComboBox:       { width: 121, height: 23 },
    ListBox:        { width: 120, height: 96 },
    Panel:          { width: 200, height: 100 },
    GroupBox:       { width: 200, height: 100 },
    DataGridView:   { width: 240, height: 150 },
    PictureBox:     { width: 100, height: 50 },
    ProgressBar:    { width: 100, height: 23 },
    NumericUpDown:  { width: 120, height: 23 },
    DateTimePicker: { width: 200, height: 23 },
    TabControl:     { width: 200, height: 100 },
    SplitContainer: { width: 150, height: 100 },
  };
  return sizes[type] ?? { width: 100, height: 23 };
}

// 컨트롤 타입별 기본 속성
function getDefaultProperties(type: ControlType): Record<string, unknown> {
  switch (type) {
    case 'Button':
      return { text: 'Button' };
    case 'Label':
      return { text: 'Label' };
    case 'TextBox':
      return { text: '' };
    case 'CheckBox':
      return { text: 'CheckBox', checked: false };
    case 'RadioButton':
      return { text: 'RadioButton', checked: false, groupName: 'default' };
    case 'ComboBox':
      return { items: [], selectedIndex: -1 };
    case 'ListBox':
      return { items: [], selectedIndex: -1 };
    case 'NumericUpDown':
      return { value: 0, minimum: 0, maximum: 100 };
    case 'DateTimePicker':
      return { format: 'Short' };
    case 'ProgressBar':
      return { value: 0, minimum: 0, maximum: 100 };
    case 'PictureBox':
      return { sizeMode: 'Normal' };
    case 'Panel':
      return { borderStyle: 'None' };
    case 'GroupBox':
      return { text: 'GroupBox' };
    case 'TabControl':
      return { tabPages: ['TabPage1', 'TabPage2'], selectedIndex: 0 };
    case 'DataGridView':
      return { columns: [] };
    default:
      return {};
  }
}

// 컨트롤 이름 카운터
const nameCounters = new Map<string, number>();

function generateControlName(type: ControlType): string {
  const baseName = type.charAt(0).toLowerCase() + type.slice(1);
  const count = (nameCounters.get(type) ?? 0) + 1;
  nameCounters.set(type, count);
  return `${baseName}${count}`;
}

export function createDefaultControl(
  type: ControlType,
  position: { x: number; y: number },
): ControlDefinition {
  return {
    id: crypto.randomUUID(),
    type,
    name: generateControlName(type),
    properties: getDefaultProperties(type),
    position,
    size: getDefaultSize(type),
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
  };
}

export { getDefaultSize };

export const useDesignerStore = create<DesignerState>()(
  immer((set) => ({
    controls: [] as ControlDefinition[],
    formProperties: DEFAULT_FORM_PROPERTIES,
    isDirty: false,
    currentFormId: null,
    currentProjectId: null,
    gridSize: 8,

    addControl: (control) => set((state) => {
      state.controls.push(control);
      state.isDirty = true;
    }),

    updateControl: (id, changes) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        Object.assign(state.controls[index], changes);
        state.isDirty = true;
      }
    }),

    removeControl: (id) => set((state) => {
      state.controls = state.controls.filter((c) => c.id !== id);
      state.isDirty = true;
    }),

    removeControls: (ids) => set((state) => {
      const idSet = new Set(ids);
      state.controls = state.controls.filter((c) => !idSet.has(c.id));
      state.isDirty = true;
    }),

    moveControl: (id, position) => set((state) => {
      const control = state.controls.find((c) => c.id === id);
      if (control) {
        control.position = position;
        state.isDirty = true;
      }
    }),

    resizeControl: (id, size, position) => set((state) => {
      const control = state.controls.find((c) => c.id === id);
      if (control) {
        control.size = size;
        if (position) control.position = position;
        state.isDirty = true;
      }
    }),

    bringToFront: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        const [control] = state.controls.splice(index, 1);
        state.controls.push(control);
        state.isDirty = true;
      }
    }),

    sendToBack: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1) {
        const [control] = state.controls.splice(index, 1);
        state.controls.unshift(control);
        state.isDirty = true;
      }
    }),

    setFormProperties: (props) => set((state) => {
      Object.assign(state.formProperties, props);
      state.isDirty = true;
    }),

    setGridSize: (size) => set((state) => {
      state.gridSize = size;
    }),

    loadForm: (formId, controls, properties) => set((state) => {
      state.currentFormId = formId;
      state.controls = controls;
      state.formProperties = properties;
      state.isDirty = false;
    }),

    markClean: () => set((state) => {
      state.isDirty = false;
    }),

    setCurrentProject: (projectId) => set((state) => {
      state.currentProjectId = projectId;
    }),
  })),
);
