export interface EventHandlerDefinition {
  controlId: string;
  eventName: string;
  handlerType: 'server' | 'client';
  handlerCode: string;
}

export interface EventArgs {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

export const COMMON_EVENTS = [
  'Click', 'DoubleClick',
  'MouseEnter', 'MouseLeave', 'MouseDown', 'MouseUp', 'MouseMove',
  'KeyDown', 'KeyUp', 'KeyPress',
  'Enter', 'Leave',
  'Validating', 'Validated',
  'VisibleChanged', 'EnabledChanged',
] as const;

export const CONTROL_EVENTS: Record<string, readonly string[]> = {
  TextBox: ['TextChanged', 'KeyPress'],
  ComboBox: ['SelectedIndexChanged', 'DropDown', 'DropDownClosed'],
  CheckBox: ['CheckedChanged'],
  RadioButton: ['CheckedChanged'],
  DataGridView: ['CellClick', 'CellValueChanged', 'RowEnter', 'SelectionChanged'],
  NumericUpDown: ['ValueChanged'],
  DateTimePicker: ['ValueChanged'],
  ListBox: ['SelectedIndexChanged'],
  TabControl: ['SelectedIndexChanged'],
  TreeView: ['AfterSelect', 'AfterExpand', 'AfterCollapse'],
  ListView: ['SelectedIndexChanged', 'ItemActivate'],
  SpreadsheetView: ['CellChanged', 'RowAdded', 'RowDeleted', 'SelectionChanged', 'DataLoaded'],
};

export const FORM_EVENTS = [
  'Load', 'Shown', 'FormClosing', 'FormClosed', 'Resize',
] as const;

export interface ControlProxy {
  [property: string]: unknown;
}

export interface CollectionProxy {
  find(filter?: Record<string, unknown>): Promise<unknown[]>;
  findOne(filter?: Record<string, unknown>): Promise<unknown | null>;
  insertOne(doc: Record<string, unknown>): Promise<{ insertedId: string }>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

export interface DataSourceProxy {
  collection(name: string): CollectionProxy;
}

export interface DialogResult {
  dialogResult: 'OK' | 'Cancel';
  data: Record<string, unknown>;
}

export interface FormContext {
  formId: string;
  controls: Record<string, ControlProxy>;
  dataSources: Record<string, DataSourceProxy>;
  showDialog(formId: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formId: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
  getRadioGroupValue(groupName: string): string | null;
}
