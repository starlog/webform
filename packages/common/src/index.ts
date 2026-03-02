export const VERSION = '1.0.0';

// types/form
export type {
  FontDefinition,
  FormProperties,
  CommonControlProperties,
  ControlDefinition,
  FormDefinition,
  AnchorStyle,
} from './types/form';
export { type ControlType, type DockStyle, CONTROL_TYPES } from './types/form';

// types/events
export type {
  EventHandlerDefinition,
  EventArgs,
  ControlProxy,
  CollectionProxy,
  DataSourceProxy,
  FormContext,
  DialogResult,
} from './types/events';
export { COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from './types/events';

// types/datasource
export type {
  DataSourceDefinition,
  DatabaseDialect,
  DatabaseConfig,
  RestApiConfig,
  AuthConfig,
  StaticConfig,
} from './types/datasource';

// types/shell
export type {
  AuthSettings,
  ApplicationShellDefinition,
  AppLoadResponse,
  ShellProperties,
  ShellEventRequest,
  ShellEventType,
} from './types/shell';
export { SHELL_EVENTS } from './types/shell';

// types/protocol
export type {
  DebugLog,
  TraceEntry,
  UIPatch,
  EventRequest,
  EventResponse,
  DesignerWsMessage,
  RuntimeWsMessage,
  WsMessage,
} from './types/protocol';

// types/theme
export type {
  ThemeId,
  ThemeTokens,
  TitleBarTokens,
  WindowTokens,
  FormTokens,
  ButtonTokens,
  TextInputTokens,
  SelectTokens,
  CheckRadioTokens,
  PanelTokens,
  GroupBoxTokens,
  TabControlTokens,
  DataGridTokens,
  ProgressBarTokens,
  MenuStripTokens,
  ToolStripTokens,
  StatusStripTokens,
  ScrollbarTokens,
  AccentTokens,
  PopupTokens,
  ControlTokens,
  CustomThemeDocument,
} from './types/theme';

// themes
export {
  FALLBACK_THEME,
  getDefaultTheme,
  windowsXpTheme,
} from './themes/presets';

// utils
export { validateFormDefinition, validateControlDefinition, sanitizeQueryInput } from './utils/validation';
export { serializeFormDefinition, deserializeFormDefinition } from './utils/serialization';
export { flattenControls, nestControls } from './utils/controlUtils';

// theme utilities (shared between designer & runtime)
export {
  controlThemeMap,
  chromeControlTypes,
  resolveControlThemeColors,
  computeControlColors,
} from './theme/controlThemeMap';
export type { ResolvedControlColors } from './theme/controlThemeMap';
export { mergeThemeWithDefaults } from './theme/mergeWithDefaults';

// shared control styles
export {
  type CSSStyle,
  buttonBaseStyle,
  textInputBaseStyle,
  labelBaseStyle,
  checkRadioBaseStyle,
  checkRadioInputStyle,
  checkRadioTextStyle,
  comboBoxBaseStyle,
  listBoxBaseStyle,
  listBoxItemStyle,
  panelBaseStyle,
  groupBoxFieldsetStyle,
  groupBoxLegendStyle,
  progressBarContainerStyle,
  progressBarFillStyle,
  computePercent,
  switchTrackStyle,
  switchThumbStyle,
  switchTrackTextStyle,
  switchContainerStyle,
  sliderInputStyle,
  sliderContainerStyle,
  sliderValueStyle,
  ALERT_STYLES,
  alertContainerStyle,
  alertIconStyle,
  BADGE_STATUS_COLORS,
  PICTURE_SIZE_MODE_MAP,
  DIVIDER_FLEX_MAP,
} from './styles/controlStyles';
