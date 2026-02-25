export type TokenEditorType = 'color' | 'text' | 'number' | 'dropdown';

export interface TokenMeta {
  path: string;
  label: string;
  group: string;
  editorType: TokenEditorType;
  options?: string[];
}

export const TOKEN_GROUPS = [
  'Window',
  'Form',
  'Accent',
  'Button',
  'TextInput',
  'Select',
  'CheckRadio',
  'Panel',
  'GroupBox',
  'TabControl',
  'DataGrid',
  'ProgressBar',
  'MenuStrip',
  'ToolStrip',
  'StatusStrip',
  'Scrollbar',
  'Popup',
] as const;

export const TOKEN_METAS: TokenMeta[] = [
  // Window > TitleBar
  { path: 'window.titleBar.background', label: 'TitleBar Background', group: 'Window', editorType: 'text' },
  { path: 'window.titleBar.foreground', label: 'TitleBar Foreground', group: 'Window', editorType: 'color' },
  { path: 'window.titleBar.height', label: 'TitleBar Height', group: 'Window', editorType: 'number' },
  { path: 'window.titleBar.font', label: 'TitleBar Font', group: 'Window', editorType: 'text' },
  { path: 'window.titleBar.borderRadius', label: 'TitleBar Border Radius', group: 'Window', editorType: 'text' },
  { path: 'window.titleBar.controlButtonsPosition', label: 'Control Buttons Position', group: 'Window', editorType: 'dropdown', options: ['left', 'right'] },
  { path: 'window.border', label: 'Window Border', group: 'Window', editorType: 'text' },
  { path: 'window.borderRadius', label: 'Window Border Radius', group: 'Window', editorType: 'text' },
  { path: 'window.shadow', label: 'Window Shadow', group: 'Window', editorType: 'text' },

  // Form
  { path: 'form.backgroundColor', label: 'Background Color', group: 'Form', editorType: 'color' },
  { path: 'form.foreground', label: 'Foreground', group: 'Form', editorType: 'color' },
  { path: 'form.fontFamily', label: 'Font Family', group: 'Form', editorType: 'text' },
  { path: 'form.fontSize', label: 'Font Size', group: 'Form', editorType: 'text' },

  // Accent
  { path: 'accent.primary', label: 'Primary', group: 'Accent', editorType: 'color' },
  { path: 'accent.primaryHover', label: 'Primary Hover', group: 'Accent', editorType: 'color' },
  { path: 'accent.primaryForeground', label: 'Primary Foreground', group: 'Accent', editorType: 'color' },

  // Button
  { path: 'controls.button.background', label: 'Background', group: 'Button', editorType: 'color' },
  { path: 'controls.button.border', label: 'Border', group: 'Button', editorType: 'text' },
  { path: 'controls.button.borderRadius', label: 'Border Radius', group: 'Button', editorType: 'text' },
  { path: 'controls.button.foreground', label: 'Foreground', group: 'Button', editorType: 'color' },
  { path: 'controls.button.hoverBackground', label: 'Hover Background', group: 'Button', editorType: 'color' },
  { path: 'controls.button.padding', label: 'Padding', group: 'Button', editorType: 'text' },

  // TextInput
  { path: 'controls.textInput.background', label: 'Background', group: 'TextInput', editorType: 'color' },
  { path: 'controls.textInput.border', label: 'Border', group: 'TextInput', editorType: 'text' },
  { path: 'controls.textInput.borderRadius', label: 'Border Radius', group: 'TextInput', editorType: 'text' },
  { path: 'controls.textInput.foreground', label: 'Foreground', group: 'TextInput', editorType: 'color' },
  { path: 'controls.textInput.focusBorder', label: 'Focus Border', group: 'TextInput', editorType: 'text' },
  { path: 'controls.textInput.padding', label: 'Padding', group: 'TextInput', editorType: 'text' },

  // Select
  { path: 'controls.select.background', label: 'Background', group: 'Select', editorType: 'color' },
  { path: 'controls.select.border', label: 'Border', group: 'Select', editorType: 'text' },
  { path: 'controls.select.borderRadius', label: 'Border Radius', group: 'Select', editorType: 'text' },
  { path: 'controls.select.foreground', label: 'Foreground', group: 'Select', editorType: 'color' },
  { path: 'controls.select.selectedBackground', label: 'Selected Background', group: 'Select', editorType: 'color' },
  { path: 'controls.select.selectedForeground', label: 'Selected Foreground', group: 'Select', editorType: 'color' },

  // CheckRadio
  { path: 'controls.checkRadio.border', label: 'Border', group: 'CheckRadio', editorType: 'text' },
  { path: 'controls.checkRadio.background', label: 'Background', group: 'CheckRadio', editorType: 'color' },
  { path: 'controls.checkRadio.checkedBackground', label: 'Checked Background', group: 'CheckRadio', editorType: 'color' },
  { path: 'controls.checkRadio.borderRadius', label: 'Border Radius', group: 'CheckRadio', editorType: 'text' },

  // Panel
  { path: 'controls.panel.background', label: 'Background', group: 'Panel', editorType: 'text' },
  { path: 'controls.panel.border', label: 'Border', group: 'Panel', editorType: 'text' },
  { path: 'controls.panel.borderRadius', label: 'Border Radius', group: 'Panel', editorType: 'text' },

  // GroupBox
  { path: 'controls.groupBox.border', label: 'Border', group: 'GroupBox', editorType: 'text' },
  { path: 'controls.groupBox.borderRadius', label: 'Border Radius', group: 'GroupBox', editorType: 'text' },
  { path: 'controls.groupBox.foreground', label: 'Foreground', group: 'GroupBox', editorType: 'color' },

  // TabControl
  { path: 'controls.tabControl.tabBackground', label: 'Tab Background', group: 'TabControl', editorType: 'color' },
  { path: 'controls.tabControl.tabActiveBackground', label: 'Tab Active Background', group: 'TabControl', editorType: 'color' },
  { path: 'controls.tabControl.tabBorder', label: 'Tab Border', group: 'TabControl', editorType: 'text' },
  { path: 'controls.tabControl.tabBorderRadius', label: 'Tab Border Radius', group: 'TabControl', editorType: 'text' },
  { path: 'controls.tabControl.tabForeground', label: 'Tab Foreground', group: 'TabControl', editorType: 'color' },
  { path: 'controls.tabControl.tabActiveForeground', label: 'Tab Active Foreground', group: 'TabControl', editorType: 'color' },
  { path: 'controls.tabControl.contentBackground', label: 'Content Background', group: 'TabControl', editorType: 'color' },
  { path: 'controls.tabControl.contentBorder', label: 'Content Border', group: 'TabControl', editorType: 'text' },

  // DataGrid
  { path: 'controls.dataGrid.headerBackground', label: 'Header Background', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.headerForeground', label: 'Header Foreground', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.headerBorder', label: 'Header Border', group: 'DataGrid', editorType: 'text' },
  { path: 'controls.dataGrid.rowBackground', label: 'Row Background', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.rowAlternateBackground', label: 'Row Alt Background', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.rowForeground', label: 'Row Foreground', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.border', label: 'Border', group: 'DataGrid', editorType: 'text' },
  { path: 'controls.dataGrid.borderRadius', label: 'Border Radius', group: 'DataGrid', editorType: 'text' },
  { path: 'controls.dataGrid.selectedRowBackground', label: 'Selected Row Background', group: 'DataGrid', editorType: 'color' },
  { path: 'controls.dataGrid.selectedRowForeground', label: 'Selected Row Foreground', group: 'DataGrid', editorType: 'color' },

  // ProgressBar
  { path: 'controls.progressBar.background', label: 'Background', group: 'ProgressBar', editorType: 'color' },
  { path: 'controls.progressBar.fillBackground', label: 'Fill Background', group: 'ProgressBar', editorType: 'color' },
  { path: 'controls.progressBar.border', label: 'Border', group: 'ProgressBar', editorType: 'text' },
  { path: 'controls.progressBar.borderRadius', label: 'Border Radius', group: 'ProgressBar', editorType: 'text' },

  // MenuStrip
  { path: 'controls.menuStrip.background', label: 'Background', group: 'MenuStrip', editorType: 'text' },
  { path: 'controls.menuStrip.foreground', label: 'Foreground', group: 'MenuStrip', editorType: 'color' },
  { path: 'controls.menuStrip.border', label: 'Border', group: 'MenuStrip', editorType: 'text' },
  { path: 'controls.menuStrip.hoverBackground', label: 'Hover Background', group: 'MenuStrip', editorType: 'color' },
  { path: 'controls.menuStrip.hoverForeground', label: 'Hover Foreground', group: 'MenuStrip', editorType: 'color' },
  { path: 'controls.menuStrip.activeBackground', label: 'Active Background', group: 'MenuStrip', editorType: 'color' },

  // ToolStrip
  { path: 'controls.toolStrip.background', label: 'Background', group: 'ToolStrip', editorType: 'color' },
  { path: 'controls.toolStrip.foreground', label: 'Foreground', group: 'ToolStrip', editorType: 'color' },
  { path: 'controls.toolStrip.border', label: 'Border', group: 'ToolStrip', editorType: 'text' },
  { path: 'controls.toolStrip.buttonHoverBackground', label: 'Button Hover Background', group: 'ToolStrip', editorType: 'color' },
  { path: 'controls.toolStrip.separator', label: 'Separator', group: 'ToolStrip', editorType: 'color' },

  // StatusStrip
  { path: 'controls.statusStrip.background', label: 'Background', group: 'StatusStrip', editorType: 'color' },
  { path: 'controls.statusStrip.foreground', label: 'Foreground', group: 'StatusStrip', editorType: 'color' },
  { path: 'controls.statusStrip.border', label: 'Border', group: 'StatusStrip', editorType: 'text' },

  // Scrollbar
  { path: 'controls.scrollbar.trackBackground', label: 'Track Background', group: 'Scrollbar', editorType: 'text' },
  { path: 'controls.scrollbar.thumbBackground', label: 'Thumb Background', group: 'Scrollbar', editorType: 'color' },
  { path: 'controls.scrollbar.thumbHoverBackground', label: 'Thumb Hover Background', group: 'Scrollbar', editorType: 'color' },
  { path: 'controls.scrollbar.width', label: 'Width', group: 'Scrollbar', editorType: 'number' },

  // Popup
  { path: 'popup.background', label: 'Background', group: 'Popup', editorType: 'color' },
  { path: 'popup.border', label: 'Border', group: 'Popup', editorType: 'text' },
  { path: 'popup.shadow', label: 'Shadow', group: 'Popup', editorType: 'text' },
  { path: 'popup.borderRadius', label: 'Border Radius', group: 'Popup', editorType: 'text' },
  { path: 'popup.hoverBackground', label: 'Hover Background', group: 'Popup', editorType: 'color' },
];

export function getTokensByGroup(): Map<string, TokenMeta[]> {
  const map = new Map<string, TokenMeta[]>();
  for (const meta of TOKEN_METAS) {
    const list = map.get(meta.group) ?? [];
    list.push(meta);
    map.set(meta.group, list);
  }
  return map;
}
