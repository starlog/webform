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

export interface DesignerControlProps {
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
};

export interface ControlMeta {
  type: ControlType;
  displayName: string;
  icon: string;
  category: 'basic' | 'container';
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
];

export const TOOLBOX_CATEGORIES = [
  { id: 'basic',     name: '\uAE30\uBCF8 \uCEE8\uD2B8\uB864',  collapsed: false },
  { id: 'container', name: '\uCEE8\uD14C\uC774\uB108',      collapsed: false },
] as const;

export function getDesignerComponent(type: ControlType): ComponentType<DesignerControlProps> | undefined {
  return designerControlRegistry[type];
}

export function getControlsByCategory(categoryId: string): ControlMeta[] {
  return controlMetadata.filter((m) => m.category === categoryId);
}
