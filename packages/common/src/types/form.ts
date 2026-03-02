import type { DataBindingDefinition } from './datasource';
import type { EventHandlerDefinition } from './events';
import type { ThemeId } from './theme';

export interface FontDefinition {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

export interface FormProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  startPosition: 'CenterScreen' | 'Manual' | 'CenterParent';
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
  windowState?: 'Normal' | 'Maximized';
  theme?: ThemeId;
  themeColorMode?: 'theme' | 'control';
}

// Phase 1 - 기본 컨트롤 (11종), 컨테이너 (4종)
// Phase 2 - 데이터 컨트롤 (5종)
// Phase 3 - 고급 컨트롤 (5종)
export const CONTROL_TYPES = [
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl', 'SplitContainer',
  'DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView',
  'MenuStrip', 'ToolStrip', 'StatusStrip', 'RichTextBox', 'WebBrowser',
  'SpreadsheetView', 'JsonEditor', 'MongoDBView', 'GraphView',
  'MongoDBConnector',
  'SwaggerConnector',
  // Extra Elements — Step 1 (폼 필수 요소)
  'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
  // Extra Elements — Step 2 (모던 UI 강화)
  'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
] as const;

export type ControlType = (typeof CONTROL_TYPES)[number];

export interface AnchorStyle {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export type DockStyle = 'None' | 'Top' | 'Bottom' | 'Left' | 'Right' | 'Fill';

export interface CommonControlProperties {
  text?: string;
  visible?: boolean;
  enabled?: boolean;
  font?: FontDefinition;
  foreColor?: string;
  backColor?: string;
  [key: string]: unknown;
}

export interface ControlDefinition {
  id: string;
  type: ControlType;
  name: string;
  properties: CommonControlProperties;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children?: ControlDefinition[];
  anchor: AnchorStyle;
  dock: DockStyle;
  tabIndex: number;
  visible: boolean;
  enabled: boolean;
}

export interface FormDefinition {
  id: string;
  name: string;
  version: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
}
