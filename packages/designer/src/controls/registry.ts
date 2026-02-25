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
import { MongoDBConnectorControl } from './MongoDBConnectorControl';
import { SliderControl } from './SliderControl';
import { SwitchControl } from './SwitchControl';
import { UploadControl } from './UploadControl';
import { AlertControl } from './AlertControl';
import { TagControl } from './TagControl';
import { DividerControl } from './DividerControl';
import { CardControl } from './CardControl';
import { BadgeControl } from './BadgeControl';
import { AvatarControl } from './AvatarControl';
import { TooltipControl } from './TooltipControl';
import { CollapseControl } from './CollapseControl';
import { StatisticControl } from './StatisticControl';

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
  MongoDBConnector: MongoDBConnectorControl,
  Slider: SliderControl,
  Switch: SwitchControl,
  Upload: UploadControl,
  Alert: AlertControl,
  Tag: TagControl,
  Divider: DividerControl,
  Card: CardControl,
  Badge: BadgeControl,
  Avatar: AvatarControl,
  Tooltip: TooltipControl,
  Collapse: CollapseControl,
  Statistic: StatisticControl,
};

export interface ControlMeta {
  type: ControlType;
  displayName: string;
  icon: string;
  category: 'basic' | 'container' | 'data' | 'database';
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

  { type: 'MongoDBConnector', displayName: 'MongoDBConnector', icon: '\uD83D\uDDC4', category: 'database' },

  { type: 'Slider',  displayName: 'Slider',  icon: '\u23AF', category: 'basic' },
  { type: 'Switch',  displayName: 'Switch',  icon: '\u2298', category: 'basic' },
  { type: 'Upload',  displayName: 'Upload',  icon: '\u2B06', category: 'data' },
  { type: 'Alert',   displayName: 'Alert',   icon: '\u26A0', category: 'basic' },
  { type: 'Tag',     displayName: 'Tag',     icon: '\u2B21', category: 'basic' },
  { type: 'Divider', displayName: 'Divider', icon: '\u2014', category: 'basic' },
  { type: 'Badge',     displayName: 'Badge',     icon: '●', category: 'basic' },
  { type: 'Avatar',    displayName: 'Avatar',    icon: '⊙', category: 'basic' },
  { type: 'Tooltip',   displayName: 'Tooltip',   icon: '💬', category: 'basic' },
  { type: 'Statistic', displayName: 'Statistic', icon: '#', category: 'basic' },

  { type: 'Card',     displayName: 'Card',     icon: '▢', category: 'container' },
  { type: 'Collapse', displayName: 'Collapse', icon: '≡', category: 'container' },
];

export const TOOLBOX_CATEGORIES = [
  { id: 'basic',     name: '기본 컨트롤',  collapsed: false },
  { id: 'container', name: '컨테이너',      collapsed: false },
  { id: 'data',      name: '데이터',        collapsed: false },
  { id: 'database',  name: '데이터베이스',  collapsed: false },
] as const;

export function getDesignerComponent(type: ControlType): ComponentType<DesignerControlProps> | undefined {
  return designerControlRegistry[type];
}

export function getControlsByCategory(categoryId: string): ControlMeta[] {
  return controlMetadata.filter((m) => m.category === categoryId);
}
