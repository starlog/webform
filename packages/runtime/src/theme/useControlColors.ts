import type { ControlType, ThemeTokens } from '@webform/common';
import { useTheme } from './ThemeContext';
import { useThemeColorMode } from './ThemeColorModeContext';

interface ControlColorProps {
  backColor?: string;
  foreColor?: string;
}

interface ControlColors {
  backgroundColor: string;
  color: string;
}

type ThemeColorResolver = (theme: ThemeTokens) => { background: string; foreground: string };

const controlThemeMap: Record<string, ThemeColorResolver> = {
  Button: (t) => ({ background: t.controls.button.background, foreground: t.controls.button.foreground }),
  TextBox: (t) => ({ background: t.controls.textInput.background, foreground: t.controls.textInput.foreground }),
  NumericUpDown: (t) => ({ background: t.controls.textInput.background, foreground: t.controls.textInput.foreground }),
  DateTimePicker: (t) => ({ background: t.controls.textInput.background, foreground: t.controls.textInput.foreground }),
  RichTextBox: (t) => ({ background: t.controls.textInput.background, foreground: t.controls.textInput.foreground }),
  ComboBox: (t) => ({ background: t.controls.select.background, foreground: t.controls.select.foreground }),
  ListBox: (t) => ({ background: t.controls.select.background, foreground: t.controls.select.foreground }),
  TreeView: (t) => ({ background: t.controls.select.background, foreground: t.controls.select.foreground }),
  ListView: (t) => ({ background: t.controls.select.background, foreground: t.controls.select.foreground }),
  Panel: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  PictureBox: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  GroupBox: (t) => ({ background: t.controls.panel.background, foreground: t.controls.groupBox.foreground }),
  DataGridView: (t) => ({ background: t.controls.dataGrid.rowBackground, foreground: t.controls.dataGrid.rowForeground }),
  MenuStrip: (t) => ({ background: t.controls.menuStrip.background, foreground: t.controls.menuStrip.foreground }),
  ToolStrip: (t) => ({ background: t.controls.toolStrip.background, foreground: t.controls.toolStrip.foreground }),
  BindingNavigator: (t) => ({ background: t.controls.toolStrip.background, foreground: t.controls.toolStrip.foreground }),
  StatusStrip: (t) => ({ background: t.controls.statusStrip.background, foreground: t.controls.statusStrip.foreground }),
  TabControl: (t) => ({ background: t.controls.tabControl.contentBackground, foreground: t.controls.tabControl.tabActiveForeground }),
  ProgressBar: (t) => ({ background: t.controls.progressBar.background, foreground: t.form.foreground }),
  Label: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  CheckBox: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  RadioButton: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Chart: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  GraphView: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  JsonEditor: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  SpreadsheetView: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  MongoDBView: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  SplitContainer: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  WebBrowser: (t) => ({ background: t.controls.textInput.background, foreground: t.form.foreground }),
  Slider: (t) => ({ background: t.controls.progressBar.background, foreground: t.form.foreground }),
  Switch: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Upload: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Alert: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Tag: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Divider: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Card: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  Badge: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Avatar: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Tooltip: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Collapse: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  Statistic: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
};

function resolveThemeColors(controlType: ControlType, theme: ThemeTokens) {
  const resolver = controlThemeMap[controlType];
  if (resolver) return resolver(theme);
  return { background: theme.form.backgroundColor, foreground: theme.form.foreground };
}

export function useControlColors(
  controlType: ControlType,
  props: ControlColorProps,
): ControlColors {
  const theme = useTheme();
  const mode = useThemeColorMode();
  const themeColors = resolveThemeColors(controlType, theme);

  if (mode === 'theme') {
    return {
      backgroundColor: themeColors.background,
      color: themeColors.foreground,
    };
  }

  return {
    backgroundColor: props.backColor ?? themeColors.background,
    color: props.foreColor ?? themeColors.foreground,
  };
}
