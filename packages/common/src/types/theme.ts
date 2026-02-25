/**
 * 테마 시스템 타입 정의.
 * 각 테마는 ThemeTokens 인터페이스를 구현하여 UI 전체에 일관된 스타일을 적용한다.
 */

export type PresetThemeId =
  | 'arctic-frost'
  | 'autumn-harvest'
  | 'cherry-blossom'
  | 'dark-monokai'
  | 'forest-green'
  | 'macos-tahoe'
  | 'material-blue'
  | 'ocean-breeze'
  | 'retro-terminal'
  | 'solarized-light'
  | 'sunset-glow'
  | 'ubuntu-2004'
  | 'vibrant-neon'
  | 'windows-xp';
export type ThemeId = PresetThemeId | (string & {});

export interface TitleBarTokens {
  background: string;
  foreground: string;
  height: number;
  font: string;
  borderRadius: string;
  /** 윈도우 컨트롤 버튼 위치: 'right' (Windows/Ubuntu) | 'left' (macOS) */
  controlButtonsPosition: 'left' | 'right';
}

export interface WindowTokens {
  titleBar: TitleBarTokens;
  border: string;
  borderRadius: string;
  shadow: string;
}

export interface FormTokens {
  backgroundColor: string;
  foreground: string;
  fontFamily: string;
  fontSize: string;
}

export interface ButtonTokens {
  background: string;
  border: string;
  borderRadius: string;
  foreground: string;
  hoverBackground: string;
  padding: string;
}

export interface TextInputTokens {
  background: string;
  border: string;
  borderRadius: string;
  foreground: string;
  focusBorder: string;
  padding: string;
}

export interface SelectTokens {
  background: string;
  border: string;
  borderRadius: string;
  foreground: string;
  selectedBackground: string;
  selectedForeground: string;
}

export interface CheckRadioTokens {
  border: string;
  background: string;
  checkedBackground: string;
  borderRadius: string;
}

export interface PanelTokens {
  background: string;
  border: string;
  borderRadius: string;
}

export interface GroupBoxTokens {
  border: string;
  borderRadius: string;
  foreground: string;
}

export interface TabControlTokens {
  tabBackground: string;
  tabActiveBackground: string;
  tabBorder: string;
  tabBorderRadius: string;
  tabForeground: string;
  tabActiveForeground: string;
  contentBackground: string;
  contentBorder: string;
}

export interface DataGridTokens {
  headerBackground: string;
  headerForeground: string;
  headerBorder: string;
  rowBackground: string;
  rowAlternateBackground: string;
  rowForeground: string;
  border: string;
  borderRadius: string;
  selectedRowBackground: string;
  selectedRowForeground: string;
}

export interface ProgressBarTokens {
  background: string;
  fillBackground: string;
  border: string;
  borderRadius: string;
}

export interface MenuStripTokens {
  background: string;
  foreground: string;
  border: string;
  hoverBackground: string;
  hoverForeground: string;
  activeBackground: string;
}

export interface ToolStripTokens {
  background: string;
  foreground: string;
  border: string;
  buttonHoverBackground: string;
  separator: string;
}

export interface StatusStripTokens {
  background: string;
  foreground: string;
  border: string;
}

export interface ScrollbarTokens {
  trackBackground: string;
  thumbBackground: string;
  thumbHoverBackground: string;
  width: number;
}

export interface AccentTokens {
  primary: string;
  primaryHover: string;
  primaryForeground: string;
}

export interface PopupTokens {
  background: string;
  border: string;
  shadow: string;
  borderRadius: string;
  hoverBackground: string;
}

export interface ControlTokens {
  button: ButtonTokens;
  textInput: TextInputTokens;
  select: SelectTokens;
  checkRadio: CheckRadioTokens;
  panel: PanelTokens;
  groupBox: GroupBoxTokens;
  tabControl: TabControlTokens;
  dataGrid: DataGridTokens;
  progressBar: ProgressBarTokens;
  menuStrip: MenuStripTokens;
  toolStrip: ToolStripTokens;
  statusStrip: StatusStripTokens;
  scrollbar: ScrollbarTokens;
}

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  window: WindowTokens;
  form: FormTokens;
  controls: ControlTokens;
  accent: AccentTokens;
  popup: PopupTokens;
}

/** 서버에 저장되는 커스텀 테마 문서 */
export interface CustomThemeDocument {
  _id: string;
  name: string;
  basePreset: PresetThemeId;
  tokens: ThemeTokens;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
