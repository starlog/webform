import type { ComponentType } from 'react';
import type { ControlType } from '@webform/common';
import { ButtonControl } from './ButtonControl';
import { LabelControl } from './LabelControl';
import { TextBoxControl } from './TextBoxControl';
import { CheckBoxControl } from './CheckBoxControl';
import { RadioButtonControl } from './RadioButtonControl';
import { ComboBoxControl } from './ComboBoxControl';
import { ListBoxControl } from './ListBoxControl';
import { NumericUpDownControl } from './NumericUpDownControl';
import { DateTimePickerControl } from './DateTimePickerControl';
import { ProgressBarControl } from './ProgressBarControl';
import { PictureBoxControl } from './PictureBoxControl';
import { PanelControl } from './PanelControl';
import { GroupBoxControl } from './GroupBoxControl';
import { TabControlControl } from './TabControlControl';
import { SpreadsheetViewControl } from './SpreadsheetViewControl';
import { JsonEditorControl } from './JsonEditorControl';
import { MongoDBViewControl } from './MongoDBViewControl';
import { GraphViewControl } from './GraphViewControl';
import { DataGridViewControl } from './DataGridViewControl';
import { TreeViewControl } from './TreeViewControl';
import { ListViewControl } from './ListViewControl';
import { MenuStripControl } from './MenuStripControl';
import { ToolStripControl } from './ToolStripControl';
import { StatusStripControl } from './StatusStripControl';
import { RichTextBoxControl } from './RichTextBoxControl';
import { WebBrowserControl } from './WebBrowserControl';
import { ChartControl } from './ChartControl';
import { SplitContainerControl } from './SplitContainerControl';
import { BindingNavigatorControl } from './BindingNavigatorControl';

export interface DesignerControlProps {
  id?: string;
  properties: Record<string, unknown>;
  size: { width: number; height: number };
  children?: React.ReactNode;
}

export const designerControlRegistry: Partial<
  Record<ControlType, ComponentType<DesignerControlProps>>
> = {
  Button: ButtonControl,
  Label: LabelControl,
  TextBox: TextBoxControl,
  CheckBox: CheckBoxControl,
  RadioButton: RadioButtonControl,
  ComboBox: ComboBoxControl,
  ListBox: ListBoxControl,
  NumericUpDown: NumericUpDownControl,
  DateTimePicker: DateTimePickerControl,
  ProgressBar: ProgressBarControl,
  PictureBox: PictureBoxControl,
  Panel: PanelControl,
  GroupBox: GroupBoxControl,
  TabControl: TabControlControl,
  DataGridView: DataGridViewControl,
  SpreadsheetView: SpreadsheetViewControl,
  JsonEditor: JsonEditorControl,
  MongoDBView: MongoDBViewControl,
  GraphView: GraphViewControl,
  TreeView: TreeViewControl,
  ListView: ListViewControl,
  MenuStrip: MenuStripControl,
  ToolStrip: ToolStripControl,
  StatusStrip: StatusStripControl,
  RichTextBox: RichTextBoxControl,
  WebBrowser: WebBrowserControl,
  Chart: ChartControl,
  SplitContainer: SplitContainerControl,
  BindingNavigator: BindingNavigatorControl,
};

export interface ControlMeta {
  type: ControlType;
  displayName: string;
  icon: string;
  category: 'basic' | 'container' | 'data';
}

export const controlMetadata: ControlMeta[] = [
  { type: 'Button',          displayName: 'Button',          icon: '\u25AD',  category: 'basic' },
  { type: 'Label',           displayName: 'Label',           icon: 'A',  category: 'basic' },
  { type: 'TextBox',         displayName: 'TextBox',         icon: '\u25A4',  category: 'basic' },
  { type: 'CheckBox',        displayName: 'CheckBox',        icon: '\u2611',  category: 'basic' },
  { type: 'RadioButton',     displayName: 'RadioButton',     icon: '\u25C9',  category: 'basic' },
  { type: 'ComboBox',        displayName: 'ComboBox',        icon: '\u25BE',  category: 'basic' },
  { type: 'ListBox',         displayName: 'ListBox',         icon: '\u2630',  category: 'basic' },
  { type: 'NumericUpDown',   displayName: 'NumericUpDown',   icon: '#',  category: 'basic' },
  { type: 'DateTimePicker',  displayName: 'DateTimePicker',  icon: '\uD83D\uDCC5', category: 'basic' },
  { type: 'ProgressBar',     displayName: 'ProgressBar',     icon: '\u2593',  category: 'basic' },
  { type: 'PictureBox',      displayName: 'PictureBox',      icon: '\uD83D\uDDBC', category: 'basic' },

  { type: 'Panel',           displayName: 'Panel',           icon: '\u25A1',  category: 'container' },
  { type: 'GroupBox',        displayName: 'GroupBox',        icon: '\u25A3',  category: 'container' },
  { type: 'TabControl',      displayName: 'TabControl',      icon: '\u229E',  category: 'container' },

  { type: 'DataGridView',    displayName: 'DataGridView',    icon: '\u25A6',  category: 'data' },
  { type: 'SpreadsheetView', displayName: 'SpreadsheetView', icon: '\u25A8',  category: 'data' },
  { type: 'JsonEditor',     displayName: 'JsonEditor',     icon: '{}', category: 'data' },
  { type: 'MongoDBView',   displayName: 'MongoDBView',   icon: '\u25A7', category: 'data' },
  { type: 'GraphView',    displayName: 'GraphView',    icon: '\uD83D\uDCCA', category: 'data' },
  { type: 'TreeView',    displayName: 'TreeView',    icon: '\uD83C\uDF33', category: 'data' },
  { type: 'ListView',    displayName: 'ListView',    icon: '\uD83D\uDCCB', category: 'data' },

  { type: 'MenuStrip',   displayName: 'MenuStrip',   icon: '\u2261',  category: 'container' },
  { type: 'ToolStrip',   displayName: 'ToolStrip',   icon: '\uD83D\uDEE0', category: 'container' },
  { type: 'StatusStrip', displayName: 'StatusStrip', icon: '\u2581',  category: 'container' },
  { type: 'RichTextBox', displayName: 'RichTextBox', icon: '\uD83D\uDCDD', category: 'basic' },
  { type: 'WebBrowser',  displayName: 'WebBrowser',  icon: '\uD83C\uDF10', category: 'data' },

  { type: 'Chart',            displayName: 'Chart',            icon: '\uD83D\uDCC8', category: 'data' },
  { type: 'SplitContainer',   displayName: 'SplitContainer',   icon: '\u229F',  category: 'container' },
  { type: 'BindingNavigator', displayName: 'BindingNavigator', icon: '\u23E9', category: 'data' },
];

export const TOOLBOX_CATEGORIES = [
  { id: 'basic',     name: '\uAE30\uBCF8 \uCEE8\uD2B8\uB864',  collapsed: false },
  { id: 'container', name: '\uCEE8\uD14C\uC774\uB108',      collapsed: false },
  { id: 'data',      name: '\uB370\uC774\uD130',        collapsed: false },
] as const;

export function getDesignerComponent(type: ControlType): ComponentType<DesignerControlProps> | undefined {
  return designerControlRegistry[type];
}

export function getControlsByCategory(categoryId: string): ControlMeta[] {
  return controlMetadata.filter((m) => m.category === categoryId);
}
