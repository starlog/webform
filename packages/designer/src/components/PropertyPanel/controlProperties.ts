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
  | 'collection'
  | 'tabEditor'
  | 'mongoColumns'
  | 'mongoConnectionString'
  | 'graphSample'
  | 'menuEditor'
  | 'toolStripEditor'
  | 'statusStripEditor';

export type PropertyCategory = 'Appearance' | 'Behavior' | 'Layout' | 'Design' | 'Data' | 'Sample';

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
  { name: 'properties.value',     label: 'Value',     category: 'Data',       editorType: 'text' },
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
  { name: 'properties.tabs',          label: 'Tabs',          category: 'Data',     editorType: 'tabEditor' },
  { name: 'properties.selectedIndex', label: 'SelectedIndex', category: 'Behavior', editorType: 'number', min: 0 },
);

const dataGridViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.columns',    label: 'Columns',    category: 'Data',       editorType: 'collection' },
  { name: 'properties.dataSource', label: 'DataSource', category: 'Data',       editorType: 'collection' },
  { name: 'properties.backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
  { name: 'properties.readOnly',  label: 'ReadOnly',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'type',                 label: 'Data Format', category: 'Sample',   editorType: 'graphSample' },
);

const spreadsheetViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.columns',        label: 'Columns',        category: 'Data',       editorType: 'collection' },
  { name: 'properties.data',           label: 'Data',           category: 'Data',       editorType: 'collection' },
  { name: 'properties.dataSource',     label: 'DataSource',     category: 'Data',       editorType: 'collection' },
  { name: 'properties.readOnly',       label: 'ReadOnly',       category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.showToolbar',    label: 'ShowToolbar',    category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showFormulaBar', label: 'ShowFormulaBar', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showRowNumbers', label: 'ShowRowNumbers', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowAddRows',   label: 'AllowAddRows',   category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowDeleteRows', label: 'AllowDeleteRows', category: 'Behavior', editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowSort',      label: 'AllowSort',      category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.allowFilter',    label: 'AllowFilter',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor',      label: 'BackColor',      category: 'Appearance', editorType: 'color' },
  { name: 'type',                     label: 'Data Format',    category: 'Sample',     editorType: 'graphSample' },
);

const jsonEditorProps: PropertyMeta[] = withCommon(
  { name: 'properties.value',       label: 'Value',       category: 'Data',       editorType: 'text' },
  { name: 'properties.font',        label: 'Font',        category: 'Appearance', editorType: 'font' },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.readOnly',    label: 'ReadOnly',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.expandDepth', label: 'ExpandDepth', category: 'Behavior',   editorType: 'number',  min: 0, max: 10, defaultValue: 1 },
  { name: 'properties.backColor',   label: 'BackColor',   category: 'Appearance', editorType: 'color' },
);

const mongoDBViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',            label: 'Title',            category: 'Appearance', editorType: 'text' },
  { name: 'properties.connectionString', label: 'ConnectionString', category: 'Data',       editorType: 'mongoConnectionString' },
  { name: 'properties.database',         label: 'Database',         category: 'Data',       editorType: 'text' },
  { name: 'properties.collection',       label: 'Collection',       category: 'Data',       editorType: 'text' },
  { name: 'properties.columns',          label: 'Columns',          category: 'Data',       editorType: 'mongoColumns' },
  { name: 'properties.filter',           label: 'Filter',           category: 'Data',       editorType: 'text' },
  { name: 'properties.pageSize',         label: 'PageSize',         category: 'Data',       editorType: 'number', min: 1, max: 1000, defaultValue: 50 },
  { name: 'properties.readOnly',         label: 'ReadOnly',         category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.showToolbar',      label: 'ShowToolbar',      category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.font',             label: 'Font',             category: 'Appearance', editorType: 'font' },
  { name: 'properties.foreColor',        label: 'ForeColor',        category: 'Appearance', editorType: 'color' },
  { name: 'properties.backColor',        label: 'BackColor',        category: 'Appearance', editorType: 'color' },
);

const graphViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.graphType',  label: 'GraphType',  category: 'Appearance', editorType: 'dropdown', options: ['Line', 'Bar', 'HorizontalBar', 'Area', 'StackedBar', 'StackedArea', 'Pie', 'Donut', 'Scatter', 'Radar'] },
  { name: 'properties.data',       label: 'Data',       category: 'Data',       editorType: 'collection' },
  { name: 'properties.title',      label: 'Title',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.xAxisTitle', label: 'XAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.yAxisTitle', label: 'YAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.showLegend', label: 'ShowLegend', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showGrid',   label: 'ShowGrid',   category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.colors',     label: 'Colors',     category: 'Appearance', editorType: 'text' },
  { name: 'properties.font',       label: 'Font',       category: 'Appearance', editorType: 'font' },
  { name: 'properties.foreColor',  label: 'ForeColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.graphType',  label: 'Data Format', category: 'Sample',     editorType: 'graphSample' },
);

const treeViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.nodes',        label: 'Nodes',        category: 'Data',       editorType: 'collection' },
  { name: 'properties.showLines',    label: 'ShowLines',    category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.showPlusMinus', label: 'ShowPlusMinus', category: 'Behavior', editorType: 'boolean', defaultValue: true },
  { name: 'properties.checkBoxes',   label: 'CheckBoxes',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor',    label: 'BackColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',    label: 'ForeColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',        label: 'Font',         category: 'Appearance', editorType: 'font' },
);

const listViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',         label: 'Items',         category: 'Data',       editorType: 'collection' },
  { name: 'properties.columns',       label: 'Columns',       category: 'Data',       editorType: 'collection' },
  { name: 'properties.view',          label: 'View',          category: 'Appearance', editorType: 'dropdown', options: ['LargeIcon', 'SmallIcon', 'List', 'Details', 'Tile'] },
  { name: 'properties.selectedIndex', label: 'SelectedIndex', category: 'Behavior',   editorType: 'number', min: -1 },
  { name: 'properties.multiSelect',   label: 'MultiSelect',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.fullRowSelect', label: 'FullRowSelect', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.gridLines',     label: 'GridLines',     category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor',     label: 'BackColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',     label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',         label: 'Font',          category: 'Appearance', editorType: 'font' },
);

const statusStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',     label: 'Items',     category: 'Data',       editorType: 'statusStripEditor' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const toolStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',     label: 'Items',     category: 'Data',       editorType: 'toolStripEditor' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const menuStripProps: PropertyMeta[] = withCommon(
  { name: 'properties.items',     label: 'Items',     category: 'Data',       editorType: 'menuEditor' },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',     label: 'Font',      category: 'Appearance', editorType: 'font' },
);

const richTextBoxProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',       label: 'Text',       category: 'Appearance', editorType: 'text' },
  { name: 'properties.readOnly',   label: 'ReadOnly',   category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.scrollBars', label: 'ScrollBars', category: 'Behavior',   editorType: 'dropdown', options: ['None', 'Horizontal', 'Vertical', 'Both'] },
  { name: 'properties.backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',  label: 'ForeColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',      label: 'Font',       category: 'Appearance', editorType: 'font' },
);

const webBrowserProps: PropertyMeta[] = withCommon(
  { name: 'properties.url',             label: 'Url',             category: 'Data',       editorType: 'text' },
  { name: 'properties.allowNavigation', label: 'AllowNavigation', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.backColor',       label: 'BackColor',       category: 'Appearance', editorType: 'color' },
);

const chartProps: PropertyMeta[] = withCommon(
  { name: 'properties.chartType',  label: 'ChartType',  category: 'Appearance', editorType: 'dropdown', options: ['Line', 'Bar', 'Column', 'Area', 'Pie', 'Doughnut', 'Scatter', 'Radar'] },
  { name: 'properties.series',     label: 'Series',     category: 'Data',       editorType: 'collection' },
  { name: 'properties.title',      label: 'Title',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.xAxisTitle', label: 'XAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.yAxisTitle', label: 'YAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.showLegend', label: 'ShowLegend', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showGrid',   label: 'ShowGrid',   category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.font',       label: 'Font',       category: 'Appearance', editorType: 'font' },
  { name: 'properties.foreColor',  label: 'ForeColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color' },
);

const splitContainerProps: PropertyMeta[] = withCommon(
  { name: 'properties.orientation',      label: 'Orientation',      category: 'Behavior',   editorType: 'dropdown', options: ['Horizontal', 'Vertical'] },
  { name: 'properties.splitterDistance', label: 'SplitterDistance', category: 'Layout',     editorType: 'number', min: 0 },
  { name: 'properties.splitterWidth',   label: 'SplitterWidth',   category: 'Layout',     editorType: 'number', min: 1, max: 20, defaultValue: 4 },
  { name: 'properties.fixedPanel',      label: 'FixedPanel',      category: 'Behavior',   editorType: 'dropdown', options: ['None', 'Panel1', 'Panel2'] },
  { name: 'properties.isSplitterFixed', label: 'IsSplitterFixed', category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.backColor',       label: 'BackColor',       category: 'Appearance', editorType: 'color' },
);

const bindingNavigatorProps: PropertyMeta[] = withCommon(
  { name: 'properties.bindingSource',    label: 'BindingSource',    category: 'Data',       editorType: 'text' },
  { name: 'properties.showAddButton',    label: 'ShowAddButton',    category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showDeleteButton', label: 'ShowDeleteButton', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.backColor',        label: 'BackColor',        category: 'Appearance', editorType: 'color' },
  { name: 'properties.font',            label: 'Font',             category: 'Appearance', editorType: 'font' },
);

const mongoDBConnectorProps: PropertyMeta[] = [
  { name: 'name',                        label: 'Name',             category: 'Design',   editorType: 'text' },
  { name: 'properties.connectionString', label: 'ConnectionString', category: 'Data',     editorType: 'mongoConnectionString' },
  { name: 'properties.database',         label: 'Database',         category: 'Data',     editorType: 'text' },
  { name: 'properties.defaultCollection', label: 'DefaultCollection', category: 'Data',   editorType: 'text' },
  { name: 'properties.queryTimeout',     label: 'QueryTimeout',     category: 'Behavior', editorType: 'number', min: 1000, max: 60000, defaultValue: 10000 },
  { name: 'properties.maxResultCount',   label: 'MaxResultCount',   category: 'Behavior', editorType: 'number', min: 1, max: 100000, defaultValue: 1000 },
];

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
  MongoDBView:    mongoDBViewProps,
  GraphView:      graphViewProps,
  TreeView:       treeViewProps,
  ListView:       listViewProps,
  MenuStrip:      menuStripProps,
  ToolStrip:      toolStripProps,
  StatusStrip:    statusStripProps,
  RichTextBox:    richTextBoxProps,
  WebBrowser:     webBrowserProps,
  Chart:          chartProps,
  SplitContainer: splitContainerProps,
  BindingNavigator: bindingNavigatorProps,
  MongoDBConnector: mongoDBConnectorProps,
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

// Shell 속성 메타데이터
export const SHELL_PROPERTIES: PropertyMeta[] = [
  { name: 'width', label: 'Width', category: 'Layout', editorType: 'number', min: 400 },
  { name: 'height', label: 'Height', category: 'Layout', editorType: 'number', min: 300 },
  { name: 'title', label: 'Title', category: 'Appearance', editorType: 'text' },
  { name: 'backgroundColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'font', label: 'Font', category: 'Appearance', editorType: 'font' },
  {
    name: 'showTitleBar',
    label: 'ShowTitleBar',
    category: 'Appearance',
    editorType: 'boolean',
  },
  {
    name: 'formBorderStyle',
    label: 'FormBorderStyle',
    category: 'Appearance',
    editorType: 'dropdown',
    options: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'],
  },
  { name: 'maximizeBox', label: 'MaximizeBox', category: 'Behavior', editorType: 'boolean' },
  { name: 'minimizeBox', label: 'MinimizeBox', category: 'Behavior', editorType: 'boolean' },
];
