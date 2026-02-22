import type { ControlType } from '@webform/common';
import type { ComponentType } from 'react';

import { Button } from './Button';
import { TextBox } from './TextBox';
import { Label } from './Label';
import { CheckBox } from './CheckBox';
import { ComboBox } from './ComboBox';
import { Panel } from './Panel';
import { GroupBox } from './GroupBox';
import { TabControl } from './TabControl';
import { DataGridView } from './DataGridView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  Button,
  TextBox,
  Label,
  CheckBox,
  ComboBox,
  Panel,
  GroupBox,
  TabControl,
  DataGridView,
};
