import type { ControlType } from '@webform/common';
import { COMMON_EVENTS, CONTROL_EVENTS } from '@webform/common';

export type EditorType =
  | 'text'
  | 'password'
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
  | 'chartSample'
  | 'menuEditor'
  | 'toolStripEditor'
  | 'statusStripEditor'
  | 'swaggerSpec'
  | 'swaggerApis'
  | 'authUsers';

export type PropertyCategory = 'Appearance' | 'Behavior' | 'Layout' | 'Design' | 'Data' | 'APIs' | 'Sample' | 'Authentication';

export interface PropertyMeta {
  name: string;
  label: string;
  category: PropertyCategory;
  editorType: EditorType;
  defaultValue?: unknown;
  options?: (string | { label: string; value: string })[];
  min?: number;
  max?: number;
  condition?: { property: string; values: string[] };
  sampleRef?: string;
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
  { name: 'properties.chartType',  label: 'ChartType',  category: 'Appearance', editorType: 'dropdown', options: ['Line', 'Bar', 'Column', 'Area', 'StackedBar', 'StackedArea', 'Pie', 'Doughnut', 'Scatter', 'Radar'] },
  { name: 'properties.series',     label: 'Series',     category: 'Data',       editorType: 'collection', sampleRef: 'properties.chartType' },
  { name: 'properties.title',      label: 'Title',      category: 'Appearance', editorType: 'text' },
  { name: 'properties.xAxisTitle', label: 'XAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.yAxisTitle', label: 'YAxisTitle', category: 'Appearance', editorType: 'text' },
  { name: 'properties.showLegend', label: 'ShowLegend', category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.showGrid',   label: 'ShowGrid',   category: 'Behavior',   editorType: 'boolean', defaultValue: true },
  { name: 'properties.colors',     label: 'Colors',     category: 'Appearance', editorType: 'text' },
  { name: 'properties.font',       label: 'Font',       category: 'Appearance', editorType: 'font' },
  { name: 'properties.foreColor',  label: 'ForeColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.backColor',  label: 'BackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.chartType', label: 'Data Format', category: 'Sample',     editorType: 'chartSample' },
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

const swaggerConnectorProps: PropertyMeta[] = [
  { name: 'name',                       label: 'Name',            category: 'Design',   editorType: 'text' },
  { name: 'properties.specYaml',        label: 'Spec (YAML)',     category: 'Data',     editorType: 'swaggerSpec' },
  { name: 'properties.baseUrl',         label: 'Base URL',        category: 'Data',     editorType: 'text' },
  { name: 'properties.defaultHeaders',  label: 'DefaultHeaders',  category: 'Data',     editorType: 'text' },
  { name: 'properties.specYaml',        label: 'APIs',            category: 'APIs',     editorType: 'swaggerApis' },
  { name: 'properties.timeout',         label: 'Timeout (ms)',    category: 'Behavior', editorType: 'number', min: 1000, max: 60000, defaultValue: 10000 },
];

const dataSourceConnectorProps: PropertyMeta[] = [
  { name: 'name', label: 'Name', category: 'Design', editorType: 'text' },
  { name: 'properties.dsType', label: 'DsType', category: 'Data', editorType: 'dropdown', options: ['database', 'restApi', 'static'] },
  { name: 'properties.dialect', label: 'Dialect', category: 'Data', editorType: 'dropdown', options: ['mysql', 'postgresql', 'mssql'], condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.host', label: 'Host', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.port', label: 'Port', category: 'Data', editorType: 'number', min: 1, max: 65535, condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.user', label: 'User', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.password', label: 'Password', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.database', label: 'Database', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.ssl', label: 'SSL', category: 'Data', editorType: 'boolean', condition: { property: 'properties.dsType', values: ['database'] } },
  { name: 'properties.baseUrl', label: 'BaseUrl', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['restApi'] } },
  { name: 'properties.headers', label: 'Headers', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['restApi'] } },
  { name: 'properties.authType', label: 'AuthType', category: 'Data', editorType: 'dropdown', options: ['none', 'basic', 'bearer', 'apiKey'], condition: { property: 'properties.dsType', values: ['restApi'] } },
  { name: 'properties.authCredentials', label: 'AuthCredentials', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['restApi'] } },
  { name: 'properties.data', label: 'Data', category: 'Data', editorType: 'text', condition: { property: 'properties.dsType', values: ['static'] } },
  { name: 'properties.queryTimeout', label: 'QueryTimeout', category: 'Behavior', editorType: 'number', min: 1000, max: 60000 },
  { name: 'properties.maxResultCount', label: 'MaxResultCount', category: 'Behavior', editorType: 'number', min: 1, max: 100000 },
];

const sliderProps: PropertyMeta[] = withCommon(
  { name: 'properties.value',       label: 'Value',       category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
  { name: 'properties.minimum',     label: 'Minimum',     category: 'Behavior',   editorType: 'number',   defaultValue: 0 },
  { name: 'properties.maximum',     label: 'Maximum',     category: 'Behavior',   editorType: 'number',   defaultValue: 100 },
  { name: 'properties.step',        label: 'Step',        category: 'Behavior',   editorType: 'number',   defaultValue: 1, min: 1 },
  { name: 'properties.orientation', label: 'Orientation', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Horizontal', options: ['Horizontal', 'Vertical'] },
  { name: 'properties.showValue',   label: 'ShowValue',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.trackColor',  label: 'TrackColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.fillColor',   label: 'FillColor',   category: 'Appearance', editorType: 'color' },
);

const switchProps: PropertyMeta[] = withCommon(
  { name: 'properties.checked',  label: 'Checked',  category: 'Behavior',   editorType: 'boolean', defaultValue: false },
  { name: 'properties.text',     label: 'Text',     category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.onText',   label: 'OnText',   category: 'Appearance', editorType: 'text',    defaultValue: 'ON' },
  { name: 'properties.offText',  label: 'OffText',  category: 'Appearance', editorType: 'text',    defaultValue: 'OFF' },
  { name: 'properties.onColor',  label: 'OnColor',  category: 'Appearance', editorType: 'color' },
  { name: 'properties.offColor', label: 'OffColor', category: 'Appearance', editorType: 'color' },
);

const uploadProps: PropertyMeta[] = withCommon(
  { name: 'properties.uploadMode',  label: 'UploadMode',      category: 'Appearance', editorType: 'dropdown', defaultValue: 'DropZone', options: ['Button', 'DropZone'] },
  { name: 'properties.text',        label: 'Text',            category: 'Appearance', editorType: 'text',     defaultValue: 'Click or drag file to upload' },
  { name: 'properties.accept',      label: 'Accept',          category: 'Behavior',   editorType: 'text',     defaultValue: '' },
  { name: 'properties.multiple',    label: 'Multiple',        category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.maxFileSize', label: 'MaxFileSize(MB)', category: 'Behavior',   editorType: 'number',   defaultValue: 10, min: 1, max: 100 },
  { name: 'properties.maxCount',    label: 'MaxCount',        category: 'Behavior',   editorType: 'number',   defaultValue: 1, min: 1, max: 20 },
  { name: 'properties.backColor',   label: 'BackColor',       category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',   label: 'ForeColor',       category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderStyle', label: 'BorderStyle',     category: 'Appearance', editorType: 'dropdown', defaultValue: 'Dashed', options: ['None', 'Solid', 'Dashed'] },
);

const alertProps: PropertyMeta[] = withCommon(
  { name: 'properties.message',     label: 'Message',     category: 'Appearance', editorType: 'text',     defaultValue: 'Alert message' },
  { name: 'properties.description', label: 'Description', category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.alertType',   label: 'AlertType',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Info', options: ['Success', 'Info', 'Warning', 'Error'] },
  { name: 'properties.showIcon',    label: 'ShowIcon',    category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.closable',    label: 'Closable',    category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.banner',      label: 'Banner',      category: 'Appearance', editorType: 'boolean',  defaultValue: false },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
);

const tagProps: PropertyMeta[] = withCommon(
  { name: 'properties.tags',     label: 'Tags',     category: 'Data',       editorType: 'collection', defaultValue: ['Tag1', 'Tag2'] },
  { name: 'properties.tagColor', label: 'TagColor', category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Default', options: ['Default', 'Blue', 'Green', 'Red', 'Orange', 'Purple', 'Cyan', 'Gold'] },
  { name: 'properties.closable', label: 'Closable', category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.addable',  label: 'Addable',  category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);

const dividerProps: PropertyMeta[] = withCommon(
  { name: 'properties.text',        label: 'Text',        category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.orientation', label: 'Orientation', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Horizontal', options: ['Horizontal', 'Vertical'] },
  { name: 'properties.textAlign',   label: 'TextAlign',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Center', options: ['Left', 'Center', 'Right'] },
  { name: 'properties.lineStyle',   label: 'LineStyle',   category: 'Appearance', editorType: 'dropdown', defaultValue: 'Solid', options: ['Solid', 'Dashed', 'Dotted'] },
  { name: 'properties.lineColor',   label: 'LineColor',   category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',   label: 'ForeColor',   category: 'Appearance', editorType: 'color' },
);

const cardProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',        label: 'Title',        category: 'Appearance', editorType: 'text',     defaultValue: 'Card Title' },
  { name: 'properties.subtitle',     label: 'Subtitle',     category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.showHeader',   label: 'ShowHeader',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.showBorder',   label: 'ShowBorder',   category: 'Appearance', editorType: 'boolean',  defaultValue: true },
  { name: 'properties.hoverable',    label: 'Hoverable',    category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.size',         label: 'Size',         category: 'Appearance', editorType: 'dropdown', defaultValue: 'Default', options: ['Default', 'Small'] },
  { name: 'properties.backColor',    label: 'BackColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',    label: 'ForeColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.borderRadius', label: 'BorderRadius', category: 'Appearance', editorType: 'number',   defaultValue: 8, min: 0, max: 24 },
);

const badgeProps: PropertyMeta[] = withCommon(
  { name: 'properties.count',         label: 'Count',         category: 'Data',       editorType: 'number',   defaultValue: 0, min: 0 },
  { name: 'properties.overflowCount', label: 'OverflowCount', category: 'Behavior',   editorType: 'number',   defaultValue: 99, min: 1 },
  { name: 'properties.showZero',      label: 'ShowZero',      category: 'Behavior',   editorType: 'boolean',  defaultValue: false },
  { name: 'properties.dot',           label: 'Dot',           category: 'Appearance', editorType: 'boolean',  defaultValue: false },
  { name: 'properties.status',        label: 'Status',        category: 'Appearance', editorType: 'dropdown', defaultValue: 'Default', options: ['Default', 'Success', 'Processing', 'Error', 'Warning'] },
  { name: 'properties.text',          label: 'Text',          category: 'Appearance', editorType: 'text',     defaultValue: '' },
  { name: 'properties.badgeColor',    label: 'BadgeColor',    category: 'Appearance', editorType: 'color' },
  { name: 'properties.offset',        label: 'Offset',        category: 'Layout',     editorType: 'text',     defaultValue: '' },
);

const avatarProps: PropertyMeta[] = withCommon(
  { name: 'properties.imageUrl',  label: 'ImageUrl',  category: 'Data',       editorType: 'text',     defaultValue: '' },
  { name: 'properties.text',      label: 'Text',      category: 'Appearance', editorType: 'text',     defaultValue: 'U' },
  { name: 'properties.shape',     label: 'Shape',     category: 'Appearance', editorType: 'dropdown', defaultValue: 'Circle', options: ['Circle', 'Square'] },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);

const tooltipProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',     label: 'Title',     category: 'Appearance', editorType: 'text',     defaultValue: 'Tooltip text' },
  { name: 'properties.placement', label: 'Placement', category: 'Appearance', editorType: 'dropdown', defaultValue: 'Top', options: ['Top', 'Bottom', 'Left', 'Right', 'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'] },
  { name: 'properties.trigger',   label: 'Trigger',   category: 'Behavior',   editorType: 'dropdown', defaultValue: 'Hover', options: ['Hover', 'Click', 'Focus'] },
  { name: 'properties.backColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor', label: 'ForeColor', category: 'Appearance', editorType: 'color' },
);

const collapseProps: PropertyMeta[] = withCommon(
  { name: 'properties.panels',             label: 'Panels',        category: 'Data',       editorType: 'collection', defaultValue: [{ title: 'Panel 1', key: '1', panelHeight: 0 }, { title: 'Panel 2', key: '2', panelHeight: 0 }] },
  { name: 'properties.activeKeys',         label: 'ActiveKeys',    category: 'Behavior',   editorType: 'text',       defaultValue: '1' },
  { name: 'properties.accordion',          label: 'Accordion',     category: 'Behavior',   editorType: 'boolean',    defaultValue: false },
  { name: 'properties.bordered',           label: 'Bordered',      category: 'Appearance', editorType: 'boolean',    defaultValue: true },
  { name: 'properties.expandIconPosition', label: 'ExpandIconPos', category: 'Appearance', editorType: 'dropdown',   defaultValue: 'Start', options: ['Start', 'End'] },
  { name: 'properties.backColor',          label: 'BackColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',          label: 'ForeColor',     category: 'Appearance', editorType: 'color' },
);

const statisticProps: PropertyMeta[] = withCommon(
  { name: 'properties.title',              label: 'Title',          category: 'Appearance', editorType: 'text',    defaultValue: 'Statistic' },
  { name: 'properties.value',              label: 'Value',          category: 'Data',       editorType: 'text',    defaultValue: '0' },
  { name: 'properties.prefix',             label: 'Prefix',         category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.suffix',             label: 'Suffix',         category: 'Appearance', editorType: 'text',    defaultValue: '' },
  { name: 'properties.precision',          label: 'Precision',      category: 'Data',       editorType: 'number',  defaultValue: 0, min: 0, max: 10 },
  { name: 'properties.showGroupSeparator', label: 'GroupSeparator', category: 'Appearance', editorType: 'boolean', defaultValue: true },
  { name: 'properties.valueColor',         label: 'ValueColor',     category: 'Appearance', editorType: 'color' },
  { name: 'properties.foreColor',          label: 'ForeColor',      category: 'Appearance', editorType: 'color' },
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
  MongoDBView:    mongoDBViewProps,
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
  SwaggerConnector: swaggerConnectorProps,
  DataSourceConnector: dataSourceConnectorProps,
  Slider:  sliderProps,
  Switch:  switchProps,
  Upload:  uploadProps,
  Alert:   alertProps,
  Tag:     tagProps,
  Divider: dividerProps,
  // ── Step 2 신규 컨트롤 ──
  Card:      cardProps,
  Badge:     badgeProps,
  Avatar:    avatarProps,
  Tooltip:   tooltipProps,
  Collapse:  collapseProps,
  Statistic: statisticProps,
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
  { name: 'theme', label: 'Theme', category: 'Appearance', editorType: 'dropdown', options: [] },
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
  { name: 'windowState', label: 'WindowState', category: 'Layout', editorType: 'dropdown', options: ['Normal', 'Maximized'] },
  { name: 'auth.enabled', label: 'Auth Enabled', category: 'Authentication', editorType: 'boolean' },
  { name: 'auth.provider', label: 'Provider', category: 'Authentication', editorType: 'dropdown', options: ['google', 'password'] },
  { name: 'auth.googleClientId', label: 'Google Client ID', category: 'Authentication', editorType: 'text', condition: { property: 'auth.provider', values: ['google'] } },
  { name: 'auth.googleClientSecret', label: 'Google Client Secret', category: 'Authentication', editorType: 'password', condition: { property: 'auth.provider', values: ['google'] } },
  { name: 'auth.runtimeBaseUrl', label: 'Runtime Base URL', category: 'Authentication', editorType: 'text' },
  { name: 'auth.allowedDomains', label: 'Allowed Domains', category: 'Authentication', editorType: 'text', condition: { property: 'auth.provider', values: ['google'] } },
  { name: 'auth.users', label: 'Users', category: 'Authentication', editorType: 'authUsers', condition: { property: 'auth.provider', values: ['password'] } },
];
