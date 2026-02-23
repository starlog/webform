import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ControlDefinition,
  ControlType,
  FontDefinition,
  FormProperties,
  ShellProperties,
  ApplicationShellDefinition,
} from '@webform/common';
import { flattenControls } from '@webform/common';

const DEFAULT_SHELL_PROPERTIES: ShellProperties = {
  title: 'Application',
  width: 1200,
  height: 800,
  backgroundColor: '#F0F0F0',
  font: {
    family: 'Segoe UI',
    size: 9,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  },
  showTitleBar: true,
  formBorderStyle: 'Sizable',
  maximizeBox: true,
  minimizeBox: true,
};

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
  projectDefaultFont: FontDefinition | null;
  gridSize: number;
  formEventHandlers: Record<string, string>; // eventName → handlerName
  formEventCode: Record<string, string>;     // handlerName → code

  // Shell 상태
  editMode: 'form' | 'shell';
  shellControls: ControlDefinition[];
  shellProperties: ShellProperties;
  currentShellId: string | null;

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
  loadForm: (formId: string, controls: ControlDefinition[], properties: FormProperties, eventHandlers?: Array<{ controlId: string; eventName: string; handlerCode: string }>) => void;
  loadFormEvents: (eventHandlers: Record<string, string>, eventCode: Record<string, string>) => void;
  setFormEventHandler: (eventName: string, handlerName: string) => void;
  setFormEventCode: (handlerName: string, code: string) => void;
  deleteFormEventHandler: (eventName: string) => void;
  markClean: () => void;
  setCurrentProject: (projectId: string | null) => void;
  setProjectDefaultFont: (font: FontDefinition | null) => void;

  // Shell 메서드
  setEditMode: (mode: 'form' | 'shell') => void;
  loadShell: (shellDef: ApplicationShellDefinition) => void;
  addShellControl: (control: ControlDefinition) => void;
  updateShellControl: (id: string, changes: Partial<ControlDefinition>) => void;
  removeShellControl: (id: string) => void;
  setShellProperties: (props: Partial<ShellProperties>) => void;
  getShellDefinition: () => ApplicationShellDefinition;
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
    SpreadsheetView: { width: 400, height: 300 },
    JsonEditor:      { width: 300, height: 250 },
    MongoDBView:     { width: 450, height: 350 },
    GraphView:       { width: 400, height: 300 },
    MenuStrip:       { width: 800, height: 24 },
    ToolStrip:       { width: 800, height: 25 },
    StatusStrip:     { width: 800, height: 22 },
    RichTextBox:     { width: 300, height: 150 },
    WebBrowser:      { width: 400, height: 300 },
    MongoDBConnector: { width: 120, height: 40 },
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
      return {
        tabs: [
          { title: 'TabPage1', id: crypto.randomUUID() },
          { title: 'TabPage2', id: crypto.randomUUID() },
        ],
        selectedIndex: 0,
      };
    case 'DataGridView':
      return { columns: [] };
    case 'SpreadsheetView':
      return {
        columns: [],
        data: [],
        readOnly: false,
        showToolbar: true,
        showFormulaBar: true,
        showRowNumbers: true,
        allowAddRows: true,
        allowDeleteRows: true,
        allowSort: true,
        allowFilter: false,
      };
    case 'JsonEditor':
      return { value: {}, readOnly: false, expandDepth: 1 };
    case 'MongoDBView':
      return {
        connectionString: '',
        database: '',
        collection: '',
        filter: '{}',
        pageSize: 50,
        readOnly: false,
        showToolbar: true,
      };
    case 'GraphView':
      return {
        graphType: 'Bar',
        title: '',
        showLegend: true,
        showGrid: true,
      };
    case 'StatusStrip':
      return {
        items: [{ type: 'label', text: 'Ready', spring: true }],
        backColor: '#F0F0F0',
      };
    case 'ToolStrip':
      return {
        items: [
          { type: 'button', text: 'New', icon: '📄' },
          { type: 'button', text: 'Open', icon: '📂' },
          { type: 'button', text: 'Save', icon: '💾' },
          { type: 'separator' },
          { type: 'button', text: 'Cut', icon: '✂' },
          { type: 'button', text: 'Copy', icon: '📋' },
          { type: 'button', text: 'Paste', icon: '📌' },
        ],
        backColor: '#F0F0F0',
      };
    case 'MenuStrip':
      return {
        items: [
          { text: 'File', children: [{ text: 'New', shortcut: 'Ctrl+N' }, { text: 'Open', shortcut: 'Ctrl+O' }, { text: 'Save', shortcut: 'Ctrl+S' }, { text: '', separator: true }, { text: 'Exit' }] },
          { text: 'Edit', children: [{ text: 'Undo', shortcut: 'Ctrl+Z' }, { text: 'Redo', shortcut: 'Ctrl+Y' }, { text: '', separator: true }, { text: 'Cut', shortcut: 'Ctrl+X' }, { text: 'Copy', shortcut: 'Ctrl+C' }, { text: 'Paste', shortcut: 'Ctrl+V' }] },
          { text: 'View' },
          { text: 'Help' },
        ],
      };
    case 'RichTextBox':
      return { text: '', readOnly: false, scrollBars: 'Both' };
    case 'WebBrowser':
      return { url: 'about:blank', allowNavigation: true };
    case 'MongoDBConnector':
      return {
        connectionString: '',
        database: '',
        defaultCollection: '',
        queryTimeout: 10000,
        maxResultCount: 1000,
      };
    default:
      return {};
  }
}

// 컨트롤 타입별 기본 dock 스타일
function getDefaultDock(type: ControlType): 'None' | 'Top' | 'Bottom' {
  switch (type) {
    case 'MenuStrip':
    case 'ToolStrip':
      return 'Top';
    case 'StatusStrip':
      return 'Bottom';
    default:
      return 'None';
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
  const props = getDefaultProperties(type);
  const { projectDefaultFont } = useDesignerStore.getState();
  if (projectDefaultFont) {
    props.font = { ...projectDefaultFont };
  }
  return {
    id: crypto.randomUUID(),
    type,
    name: generateControlName(type),
    properties: props,
    position,
    size: getDefaultSize(type),
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: getDefaultDock(type),
    tabIndex: 0,
    visible: true,
    enabled: true,
  };
}

export { getDefaultSize };

export const useDesignerStore = create<DesignerState>()(
  immer((set, get) => ({
    controls: [] as ControlDefinition[],
    formProperties: DEFAULT_FORM_PROPERTIES,
    isDirty: false,
    currentFormId: null,
    currentProjectId: null,
    projectDefaultFont: null as FontDefinition | null,
    gridSize: 8,
    formEventHandlers: {} as Record<string, string>,
    formEventCode: {} as Record<string, string>,

    // Shell 초기 상태
    editMode: 'form' as const,
    shellControls: [] as ControlDefinition[],
    shellProperties: DEFAULT_SHELL_PROPERTIES,
    currentShellId: null as string | null,

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

    loadForm: (formId, controls, properties, eventHandlers) => set((state) => {
      state.currentFormId = formId;
      state.controls = flattenControls(controls) as ControlDefinition[];
      state.formProperties = properties;

      if (eventHandlers) {
        // 서버에서 reload하는 경우: 이벤트 핸들러 복원
        state.formEventHandlers = {};
        state.formEventCode = {};

        for (const eh of eventHandlers) {
          if (eh.controlId === formId) {
            // 폼 레벨 이벤트
            const handlerName = `Form_${eh.eventName}`;
            state.formEventHandlers[eh.eventName] = handlerName;
            state.formEventCode[handlerName] = eh.handlerCode;
          } else {
            // 컨트롤 레벨 이벤트
            const ctrl = state.controls.find((c) => c.id === eh.controlId);
            if (!ctrl) continue;
            const handlerName = `${ctrl.name}_${eh.eventName}`;
            if (!ctrl.properties._eventHandlers) ctrl.properties._eventHandlers = {};
            if (!ctrl.properties._eventCode) ctrl.properties._eventCode = {};
            (ctrl.properties._eventHandlers as Record<string, string>)[eh.eventName] = handlerName;
            (ctrl.properties._eventCode as Record<string, string>)[handlerName] = eh.handlerCode;
          }
        }
      }
      // eventHandlers가 undefined인 경우 (Undo/Redo):
      // formEventHandlers/formEventCode를 리셋하지 않고 기존 값 보존
      // 컨트롤 레벨 이벤트는 스냅샷의 properties._eventHandlers에 이미 포함됨

      state.isDirty = false;
    }),

    loadFormEvents: (eventHandlers, eventCode) => set((state) => {
      state.formEventHandlers = eventHandlers;
      state.formEventCode = eventCode;
    }),

    setFormEventHandler: (eventName, handlerName) => set((state) => {
      if (handlerName) {
        state.formEventHandlers[eventName] = handlerName;
      } else {
        delete state.formEventHandlers[eventName];
      }
      state.isDirty = true;
    }),

    setFormEventCode: (handlerName, code) => set((state) => {
      state.formEventCode[handlerName] = code;
      state.isDirty = true;
    }),

    deleteFormEventHandler: (eventName) => set((state) => {
      const handlerName = state.formEventHandlers[eventName];
      delete state.formEventHandlers[eventName];
      if (handlerName) delete state.formEventCode[handlerName];
      state.isDirty = true;
    }),

    markClean: () => set((state) => {
      state.isDirty = false;
    }),

    setCurrentProject: (projectId) => set((state) => {
      state.currentProjectId = projectId;
      if (projectId === null) {
        state.projectDefaultFont = null;
      }
    }),

    setProjectDefaultFont: (font) => set((state) => {
      state.projectDefaultFont = font;
    }),

    // Shell 메서드
    setEditMode: (mode) => set((state) => {
      state.editMode = mode;
    }),

    loadShell: (shellDef) => set((state) => {
      state.currentShellId = shellDef.id;
      state.shellControls = shellDef.controls as ControlDefinition[];
      state.shellProperties = shellDef.properties;
      state.editMode = 'shell';
      state.isDirty = false;
    }),

    addShellControl: (control) => set((state) => {
      state.shellControls.push(control);
      state.isDirty = true;
    }),

    updateShellControl: (id, changes) => set((state) => {
      const index = state.shellControls.findIndex((c) => c.id === id);
      if (index !== -1) {
        Object.assign(state.shellControls[index], changes);
        state.isDirty = true;
      }
    }),

    removeShellControl: (id) => set((state) => {
      state.shellControls = state.shellControls.filter((c) => c.id !== id);
      state.isDirty = true;
    }),

    setShellProperties: (props) => set((state) => {
      Object.assign(state.shellProperties, props);
      state.isDirty = true;
    }),

    getShellDefinition: (): ApplicationShellDefinition => {
      const state = get();
      return {
        id: state.currentShellId ?? '',
        projectId: state.currentProjectId ?? '',
        name: state.shellProperties.title,
        version: 1,
        properties: state.shellProperties,
        controls: state.shellControls,
        eventHandlers: [],
      };
    },
  })),
);
