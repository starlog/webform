import type { ControlType } from '@webform/common';
import { COMMON_EVENTS, CONTROL_EVENTS } from '@webform/common';

export type EditorType =
  | 'text'
  | 'number'
  | 'color'
  | 'font'
  | 'dropdown'
  | 'boolean'
  | 'anchor'
  | 'collection';

export type PropertyCategory = 'Appearance' | 'Behavior' | 'Layout' | 'Design' | 'Data';

export interface PropertyMeta {
  name: string;
  label: string;
  category: PropertyCategory;
  editorType: EditorType;
  defaultValue?: unknown;
  options?: string[];
  min?: number;
  max?: number;
}

// 공통 속성 — 모든 컨트롤에 적용
const COMMON_LAYOUT: PropertyMeta[] = [
  { name: 'position.x',  label: 'X',      category: 'Layout', editorType: 'number', min: 0 },
  { name: 'position.y',  label: 'Y',      category: 'Layout', editorType: 'number', min: 0 },
  { name: 'size.width',  label: 'Width',  category: 'Layout', editorType: 'number', min: 1 },
  { name: 'size.height', label: 'Height', category: 'Layout', editorType: 'number', min: 1 },
  { name: 'anchor',      label: 'Anchor', category: 'Layout', editorType: 'anchor' },
  { name: 'dock',        label: 'Dock',   category: 'Layout', editorType: 'dropdown', options: ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'] },
];

const COMMON_BEHAVIOR: PropertyMeta[] = [
  { name: 'name',      label: 'Name',      category: 'Design',   editorType: 'text' },
  { name: 'enabled',   label: 'Enabled',   category: 'Behavior', editorType: 'boolean', defaultValue: true },
  { name: 'visible',   label: 'Visible',   category: 'Behavior', editorType: 'boolean', defaultValue: true },
  { name: 'tabIndex',  label: 'TabIndex',  category: 'Behavior', editorType: 'number',  min: 0 },
];

function withCommon(...extra: PropertyMeta[]): PropertyMeta[] {
  return [...COMMON_BEHAVIOR, ...extra, ...COMMON_LAYOUT];
}

// 각 컨트롤 타입별 속성 메타데이터
const buttonProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
  { name: 'properties.textAlign', label: 'TextAlign', category: 'Appearance', editorType: 'dropdown', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
);

const labelProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
  { name: 'properties.textAlign', label: 'TextAlign', category: 'Appearance', editorType: 'dropdown', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] },
  { name: 'properties.autoSize',  label: 'AutoSize',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
);

const textBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',        label: 'Text',        category: 'Appearance', editorType: 'text' },
  { name: 'properties.backColor',   label: 'BackColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',       label: 'Font',        category: 'Appearance', editorType: 'font' },
  { name: 'properties.multiline',  label: 'Multiline',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.readOnly',   label: 'ReadOnly',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.maxLength',  label: 'MaxLength',   category: 'Behavior',   editorType: 'number',  min: 0, max: 32767, defaultValue: 32767 },
  { name: 'properties.passwordChar', label: 'PasswordChar', category: 'Behavior', editorType: 'text' },
  { name: 'properties.textAlign',  label: 'TextAlign',   category: 'Appearance', editorType: 'dropdown', options: ['Left', 'Center', 'Right'] },
);

const checkBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.checked',   label: 'Checked',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const radioButtonProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.checked',   label: 'Checked',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.groupName', label: 'GroupName',  category: 'Behavior',   editorType: 'text' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const comboBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',         label: 'Items',         category: 'Data',       editorType: 'collection' },
  { name: 'properties.selectedIndex', label: 'SelectedIndex', category: 'Behavior',   editorType: 'number', min: -1 },
  { name: 'properties.backColor',     label: 'BackColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',     label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',         label: 'Font',          category: 'Appearance', editorType: 'font' },
  { name: 'properties.dropDownStyle', label: 'DropDownStyle', category: 'Appearance', editorType: 'dropdown', options: ['DropDown', 'DropDownList', 'Simple'] },
);

const listBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',         label: 'Items',         category: 'Data',       editorType: 'collection' },
  { name: 'properties.selectedIndex', label: 'SelectedIndex', category: 'Behavior',   editorType: 'number', min: -1 },
  { name: 'properties.backColor',     label: 'BackColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',     label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',         label: 'Font',          category: 'Appearance', editorType: 'font' },
  { name: 'properties.selectionMode', label: 'SelectionMode', category: 'Behavior',   editorType: 'dropdown', options: ['None', 'One', 'MultiSimple', 'MultiExtended'] },
);

const numericUpDownProps: PropertyMeta[] = withCommon(
  { name: 'properties.value',     label: 'Value',     category: 'Behavior',   editorType: 'number' },
  { name: 'properties.minimum',   label: 'Minimum',   category: 'Behavior',   editorType: 'number' },
  { name: 'properties.maximum',   label: 'Maximum',   category: 'Behavior',   editorType: 'number' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const dateTimePickerProps: PropertyMeta[] = withCommon(
  { name: 'properties.format',    label: 'Format',    category: 'Appearance', editorType: 'dropdown', options: ['Short', 'Long', 'Time', 'Custom'] },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const progressBarProps: PropertyMeta[] = withCommon(
  { name: 'properties.value',   label: 'Value',   category: 'Behavior', editorType: 'number', min: 0, max: 100 },
  { name: 'properties.minimum', label: 'Minimum', category: 'Behavior', editorType: 'number', min: 0 },
  { name: 'properties.maximum', label: 'Maximum', category: 'Behavior', editorType: 'number', min: 0 },
  { name: 'properties.style',   label: 'Style',   category: 'Appearance', editorType: 'dropdown', options: ['Blocks', 'Continuous', 'Marquee'] },
);

const pictureBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.imageUrl',    label: 'ImageUrl',    category: 'Appearance', editorType: 'text' },
  { name: 'properties.sizeMode',    label: 'SizeMode',    category: 'Behavior',   editorType: 'dropdown', options: ['Normal', 'StretchImage', 'AutoSize', 'CenterImage', 'Zoom'] },
  { name: 'properties.backColor',   label: 'BackColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderStyle', label: 'BorderStyle', category: 'Appearance', editorType: 'dropdown', options: ['None', 'FixedSingle', 'Fixed3D'] },
);

const panelProps: PropertyMeta[] = withCommon(
  { name: 'properties.backColor',   label: 'BackColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderStyle', label: 'BorderStyle', category: 'Appearance', editorType: 'dropdown', options: ['None', 'FixedSingle', 'Fixed3D'] },
  { name: 'properties.autoScroll',  label: 'AutoScroll',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
);

const groupBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const tabControlProps: PropertyMeta[] = withCommon(
  { name: 'properties.tabPages',      label: 'TabPages',      category: 'Data',     editorType: 'collection' },
  { name: 'properties.selectedIndex', label: 'SelectedIndex', category: 'Behavior', editorType: 'number', min: 0 },
);

const dataGridViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.columns',   label: 'Columns',   category: 'Data',       editorType: 'collection' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.readOnly',  label: 'ReadOnly',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
);

const spreadsheetViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.columns',        label: 'Columns',        category: 'Data',       editorType: 'collection' },
  { name: 'properties.data',           label: 'Data',           category: 'Data',       editorType: 'collection' },
  { name: 'properties.readOnly',       label: 'ReadOnly',       category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.showToolbar',    label: 'ShowToolbar',    category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showFormulaBar', label: 'ShowFormulaBar', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showRowNumbers', label: 'ShowRowNumbers', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowAddRows',   label: 'AllowAddRows',   category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowDeleteRows', label: 'AllowDeleteRows', category: 'Behavior', editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowSort',      label: 'AllowSort',      category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowFilter',    label: 'AllowFilter',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor',      label: 'BackColor',      category: 'Appearance', editorType: 'color' },
);

const jsonEditorProps: PropertyMeta[] = withCommon(
  { name: 'properties.font',        label: 'Font',        category: 'Appearance', editorType: 'font' },
  { name: 'properties.readOnly',    label: 'ReadOnly',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.expandDepth', label: 'ExpandDepth', category: 'Behavior',   editorType: 'number',  min: 0, max: 10, defaultValue: 1 },
  { name: 'properties.backColor',   label: 'BackColor',   category: 'Appearance', editorType: 'color' },
);

const defaultProps: PropertyMeta[] = withCommon();

// 현재 구현된 14개 + fallback
export const CONTROL_PROPERTY_META: Partial<Record<ControlType, PropertyMeta[]>> = {
  Button:         buttonProps,
  Label:          labelProps,
  TextBox:        textBoxProps,
  CheckBox:       checkBoxProps,
  RadioButton:    radioButtonProps,
  ComboBox:       comboBoxProps,
  ListBox:        listBoxProps,
  NumericUpDown:  numericUpDownProps,
  DateTimePicker: dateTimePickerProps,
  ProgressBar:    progressBarProps,
  PictureBox:     pictureBoxProps,
  Panel:          panelProps,
  GroupBox:       groupBoxProps,
  TabControl:     tabControlProps,
  DataGridView:   dataGridViewProps,
  SpreadsheetView: spreadsheetViewProps,
  JsonEditor:     jsonEditorProps,
};

export function getPropertyMeta(type: ControlType): PropertyMeta[] {
  return CONTROL_PROPERTY_META[type] ?? defaultProps;
}

// 이벤트 메타: 공통 이벤트 + 컨트롤 고유 이벤트
export const CONTROL_EVENTS_META: Partial<Record<ControlType, string[]>> = {};

for (const [controlType, specificEvents] of Object.entries(CONTROL_EVENTS) as [string, readonly string[]][]) {
  CONTROL_EVENTS_META[controlType as ControlType] = [
    ...COMMON_EVENTS,
    ...specificEvents.filter((e) => !(COMMON_EVENTS as readonly string[]).includes(e)),
  ];
}

export function getControlEvents(type: ControlType): string[] {
  return CONTROL_EVENTS_META[type] ?? [...COMMON_EVENTS];
}
