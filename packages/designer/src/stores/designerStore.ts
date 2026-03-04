import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ControlDefinition,
  ControlType,
  EventHandlerDefinition,
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
  windowState: 'Normal',
  auth: { enabled: false, provider: 'google', googleClientId: '', googleClientSecret: '', runtimeBaseUrl: '', allowedDomains: [] },
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
  windowState: 'Normal',
  themeColorMode: 'control',
};

interface DesignerState {
  controls: ControlDefinition[];
  formProperties: FormProperties;
  isDirty: boolean;
  currentFormId: string | null;
  formVersion: number | null; // 낙관적 잠금용
  currentProjectId: string | null;
  projectDefaultFont: FontDefinition | null;
  gridSize: number;
  formEventHandlers: Record<string, string>; // eventName → handlerName
  formEventCode: Record<string, string>;     // handlerName → code

  // Shell 상태
  editMode: 'form' | 'shell' | 'theme';
  shellControls: ControlDefinition[];
  shellProperties: ShellProperties;
  shellEventHandlers: EventHandlerDefinition[];
  shellName: string;
  currentShellId: string | null;
  projectShellTheme: string | undefined;

  addControl: (control: ControlDefinition) => void;
  updateControl: (id: string, changes: Partial<ControlDefinition>) => void;
  removeControl: (id: string) => void;
  removeControls: (ids: string[]) => void;
  moveControl: (id: string, position: { x: number; y: number }) => void;
  moveControls: (moves: Array<{ id: string; position: { x: number; y: number } }>) => void;
  resizeControl: (id: string, size: { width: number; height: number }, position?: { x: number; y: number }) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  setFormProperties: (props: Partial<FormProperties>) => void;
  setGridSize: (size: number) => void;
  loadForm: (formId: string, controls: ControlDefinition[], properties: FormProperties, eventHandlers?: Array<{ controlId: string; eventName: string; handlerCode: string }>, version?: number) => void;
  updateFormVersion: (version: number) => void;
  loadFormEvents: (eventHandlers: Record<string, string>, eventCode: Record<string, string>) => void;
  setFormEventHandler: (eventName: string, handlerName: string) => void;
  setFormEventCode: (handlerName: string, code: string) => void;
  deleteFormEventHandler: (eventName: string) => void;
  markClean: () => void;
  setCurrentProject: (projectId: string | null) => void;
  setProjectDefaultFont: (font: FontDefinition | null) => void;

  // Shell 메서드
  setEditMode: (mode: 'form' | 'shell' | 'theme') => void;
  loadShell: (shellDef: ApplicationShellDefinition) => void;
  addShellControl: (control: ControlDefinition) => void;
  updateShellControl: (id: string, changes: Partial<ControlDefinition>) => void;
  removeShellControl: (id: string) => void;
  setShellProperties: (props: Partial<ShellProperties>) => void;
  setProjectShellTheme: (theme: string | undefined) => void;
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
    MenuStrip:       { width: 800, height: 24 },
    ToolStrip:       { width: 800, height: 25 },
    StatusStrip:     { width: 800, height: 22 },
    RichTextBox:     { width: 300, height: 150 },
    WebBrowser:      { width: 400, height: 300 },
    MongoDBConnector: { width: 120, height: 40 },
    DataSourceConnector: { width: 160, height: 40 },
    Slider:          { width: 200, height: 30 },
    Switch:          { width: 120, height: 30 },
    Upload:          { width: 300, height: 120 },
    Alert:           { width: 300, height: 50 },
    Tag:             { width: 200, height: 30 },
    Divider:         { width: 300, height: 24 },
    Card:            { width: 300, height: 200 },
    Badge:           { width: 80,  height: 30 },
    Avatar:          { width: 40,  height: 40 },
    Tooltip:         { width: 100, height: 30 },
    Collapse:        { width: 300, height: 200 },
    Statistic:       { width: 150, height: 80 },
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
    case 'StatusStrip':
      return {
        items: [{ type: 'label', text: '준비', spring: true }],
      };
    case 'ToolStrip':
      return {
        items: [
          { type: 'button', text: '새로 만들기', icon: '📄' },
          { type: 'button', text: '열기', icon: '📂' },
          { type: 'button', text: '저장', icon: '💾' },
          { type: 'separator' },
          { type: 'button', text: '잘라내기', icon: '✂' },
          { type: 'button', text: '복사', icon: '📋' },
          { type: 'button', text: '붙여넣기', icon: '📌' },
        ],
      };
    case 'MenuStrip':
      return {
        items: [
          { text: '파일', children: [{ text: '새로 만들기', shortcut: 'Ctrl+N' }, { text: '열기', shortcut: 'Ctrl+O' }, { text: '저장', shortcut: 'Ctrl+S' }, { text: '', separator: true }, { text: '끝내기' }] },
          { text: '편집', children: [{ text: '실행 취소', shortcut: 'Ctrl+Z' }, { text: '다시 실행', shortcut: 'Ctrl+Y' }, { text: '', separator: true }, { text: '잘라내기', shortcut: 'Ctrl+X' }, { text: '복사', shortcut: 'Ctrl+C' }, { text: '붙여넣기', shortcut: 'Ctrl+V' }] },
          { text: '보기' },
          { text: '도움말' },
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
    case 'Slider':
      return { value: 0, minimum: 0, maximum: 100, orientation: 'Horizontal', showValue: true };
    case 'Switch':
      return { checked: false, text: '', onText: 'ON', offText: 'OFF' };
    case 'Upload':
      return { uploadMode: 'DropZone', text: 'Click or drag file to upload', borderStyle: 'Dashed' };
    case 'Alert':
      return { message: 'Alert message', description: '', alertType: 'Info', showIcon: true, closable: false, banner: false };
    case 'Tag':
      return { tags: ['Tag1', 'Tag2'], tagColor: 'Default', closable: false, addable: false };
    case 'Divider':
      return { text: '', orientation: 'Horizontal', textAlign: 'Center', lineStyle: 'Solid' };
    case 'Card':
      return { title: 'Card Title', subtitle: '', showHeader: true, showBorder: true, hoverable: false, size: 'Default', borderRadius: 8 };
    case 'Badge':
      return { count: 0, overflowCount: 99, showZero: false, dot: false, status: 'Default', text: '', badgeColor: '' };
    case 'Avatar':
      return { imageUrl: '', text: 'U', shape: 'Circle' };
    case 'Tooltip':
      return { title: 'Tooltip text', placement: 'Top', trigger: 'Hover' };
    case 'Collapse':
      return { panels: [{ title: 'Panel 1', key: '1', panelHeight: 0 }, { title: 'Panel 2', key: '2', panelHeight: 0 }], activeKeys: '1', accordion: false, bordered: true, expandIconPosition: 'Start' };
    case 'Statistic':
      return { title: 'Statistic', value: '0', prefix: '', suffix: '', precision: 0, showGroupSeparator: true, valueColor: '' };
    case 'DataSourceConnector':
      return {
        dsType: 'database',
        dialect: 'postgresql',
        host: '',
        port: 5432,
        user: '',
        password: '',
        database: '',
        ssl: false,
        baseUrl: '',
        headers: '{}',
        authType: 'none',
        authCredentials: '{}',
        data: '[]',
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
    formVersion: null as number | null,
    currentProjectId: null,
    projectDefaultFont: null as FontDefinition | null,
    gridSize: 8,
    formEventHandlers: {} as Record<string, string>,
    formEventCode: {} as Record<string, string>,

    // Shell 초기 상태
    editMode: 'form' as const,
    shellControls: [] as ControlDefinition[],
    shellProperties: DEFAULT_SHELL_PROPERTIES,
    shellEventHandlers: [] as EventHandlerDefinition[],
    shellName: 'Application Shell',
    currentShellId: null as string | null,
    projectShellTheme: undefined as string | undefined,

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

    moveControls: (moves) => set((state) => {
      for (const { id, position } of moves) {
        const control = state.controls.find((c) => c.id === id);
        if (control) control.position = position;
      }
      state.isDirty = true;
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

    bringForward: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index !== -1 && index < state.controls.length - 1) {
        const [control] = state.controls.splice(index, 1);
        state.controls.splice(index + 1, 0, control);
        state.isDirty = true;
      }
    }),

    sendBackward: (id) => set((state) => {
      const index = state.controls.findIndex((c) => c.id === id);
      if (index > 0) {
        const [control] = state.controls.splice(index, 1);
        state.controls.splice(index - 1, 0, control);
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

    loadForm: (formId, controls, properties, eventHandlers, version) => set((state) => {
      state.currentFormId = formId;
      state.formVersion = version ?? null;
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

      // Collapse 마이그레이션: Panel 자식이 없는 Collapse에 Panel 자동 생성
      const collapseControls = state.controls.filter((c) => c.type === 'Collapse');
      for (const cc of collapseControls) {
        const hasChildPanels = state.controls.some(
          (c) => c.type === 'Panel' && (c.properties._parentId as string) === cc.id && c.properties.collapseKey,
        );
        if (!hasChildPanels) {
          const panels = (cc.properties.panels as Array<{ title: string; key: string }>) ?? [];
          for (const panel of panels) {
            state.controls.push({
              id: crypto.randomUUID(),
              type: 'Panel',
              name: `collapsePanel_${panel.key}`,
              properties: { _parentId: cc.id, collapseKey: panel.key, borderStyle: 'None' },
              position: { x: cc.position.x, y: cc.position.y },
              size: { width: cc.size.width, height: cc.size.height },
              anchor: { top: true, bottom: false, left: true, right: false },
              dock: 'None',
              tabIndex: 0,
              visible: true,
              enabled: true,
            } as ControlDefinition);
          }
        }
      }

      state.isDirty = false;
    }),

    updateFormVersion: (version) => set((state) => {
      state.formVersion = version;
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
      state.shellName = shellDef.name;
      state.shellControls = shellDef.controls as ControlDefinition[];
      state.shellProperties = shellDef.properties;
      state.shellEventHandlers = (shellDef.eventHandlers ?? []) as EventHandlerDefinition[];
      state.projectShellTheme = shellDef.properties.theme;
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
      if ('theme' in props) {
        state.projectShellTheme = state.shellProperties.theme;
      }
      state.isDirty = true;
    }),

    setProjectShellTheme: (theme) => set((state) => {
      state.projectShellTheme = theme;
    }),

    getShellDefinition: (): ApplicationShellDefinition => {
      const state = get();
      return {
        id: state.currentShellId ?? '',
        projectId: state.currentProjectId ?? '',
        name: state.shellName,
        version: 1,
        properties: state.shellProperties,
        controls: state.shellControls,
        eventHandlers: state.shellEventHandlers,
      };
    },
  })),
);

