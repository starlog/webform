import type { ControlType } from '@webform/common';
import type { ComponentType } from 'react';

import { Button } from './Button';
import { TextBox } from './TextBox';
import { Label } from './Label';
import { CheckBox } from './CheckBox';
import { RadioButton } from './RadioButton';
import { ComboBox } from './ComboBox';
import { ListBox } from './ListBox';
import { NumericUpDown } from './NumericUpDown';
import { Panel } from './Panel';
import { GroupBox } from './GroupBox';
import { TabControl } from './TabControl';
import { DataGridView } from './DataGridView';
import { DateTimePicker } from './DateTimePicker';
import { ProgressBar } from './ProgressBar';
import { PictureBox } from './PictureBox';
import { SpreadsheetView } from './SpreadsheetView';
import { JsonEditor } from './JsonEditor';
import { MongoDBView } from './MongoDBView';
import { GraphView } from './GraphView';
import { TreeView } from './TreeView';
import { ListView } from './ListView';
import { MenuStrip } from './MenuStrip';
import { ToolStrip } from './ToolStrip';
import { StatusStrip } from './StatusStrip';
import { RichTextBox } from './RichTextBox';
import { WebBrowser } from './WebBrowser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  Button,
  TextBox,
  Label,
  CheckBox,
  RadioButton,
  ComboBox,
  ListBox,
  NumericUpDown,
  Panel,
  GroupBox,
  TabControl,
  DataGridView,
  DateTimePicker,
  ProgressBar,
  PictureBox,
  SpreadsheetView,
  JsonEditor,
  MongoDBView,
  GraphView,
  TreeView,
  ListView,
  MenuStrip,
  ToolStrip,
  StatusStrip,
  RichTextBox,
  WebBrowser,
};
