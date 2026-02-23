export const VERSION = '1.0.0';

// types/form
export type {
  FontDefinition,
  FormProperties,
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
  DatabaseConfig,
  RestApiConfig,
  AuthConfig,
  StaticConfig,
  DataBindingDefinition,
} from './types/datasource';

// types/shell
export type {
  ApplicationShellDefinition,
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

// utils
export { validateFormDefinition, validateControlDefinition, sanitizeQueryInput } from './utils/validation';
export { serializeFormDefinition, deserializeFormDefinition } from './utils/serialization';
export { flattenControls, nestControls } from './utils/controlUtils';
