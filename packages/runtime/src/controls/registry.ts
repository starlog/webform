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
import { TreeView } from './TreeView';
import { ListView } from './ListView';
import { MenuStrip } from './MenuStrip';
import { ToolStrip } from './ToolStrip';
import { StatusStrip } from './StatusStrip';
import { RichTextBox } from './RichTextBox';
import { WebBrowser } from './WebBrowser';
import { Chart } from './Chart';
import { SplitContainer } from './SplitContainer';
import { BindingNavigator } from './BindingNavigator';
import { MongoDBConnector } from './MongoDBConnector';
import { SwaggerConnector } from './SwaggerConnector';
import { DataSourceConnector } from './DataSourceConnector';
import { Slider } from './Slider';
import { Switch } from './Switch';
import { Upload } from './Upload';
import { Alert } from './Alert';
import { Tag } from './Tag';
import { Divider } from './Divider';
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { Collapse } from './Collapse';
import { Statistic } from './Statistic';

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
  TreeView,
  ListView,
  MenuStrip,
  ToolStrip,
  StatusStrip,
  RichTextBox,
  WebBrowser,
  Chart,
  SplitContainer,
  BindingNavigator,
  MongoDBConnector,
  SwaggerConnector,
  DataSourceConnector,
  Slider,
  Switch,
  Upload,
  Alert,
  Tag,
  Divider,
  Card,
  Badge,
  Avatar,
  Tooltip,
  Collapse,
  Statistic,
};
