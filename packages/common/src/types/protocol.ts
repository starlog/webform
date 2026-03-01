import type { ControlDefinition, FormDefinition, FormProperties } from './form';
import type { EventArgs } from './events';

export interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate'
    | 'updateShell' | 'updateAppState' | 'closeApp' | 'authLogout';
  target: string;
  payload: Record<string, unknown>;
}

export interface EventRequest {
  formId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  formState: Record<string, Record<string, unknown>>;
  appState?: Record<string, unknown>;
  scope?: 'shell' | 'form';
  itemScriptPath?: number[];
}

export interface DebugLog {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

export interface TraceEntry {
  line: number;
  column: number;
  timestamp: number;
  variables: Record<string, string>;
  duration?: number;
  ctxControls?: Record<string, string>;
}

export interface EventResponse {
  success: boolean;
  patches: UIPatch[];
  error?: string;
  logs?: DebugLog[];
  errorLine?: number;
  traces?: TraceEntry[];
}

export type DesignerWsMessage =
  | { type: 'controlAdded'; payload: ControlDefinition }
  | { type: 'controlUpdated'; payload: { controlId: string; changes: Record<string, unknown> } }
  | { type: 'controlRemoved'; payload: { controlId: string } }
  | { type: 'formPropertiesUpdated'; payload: Partial<FormProperties> }
  | { type: 'syncRequest'; payload: { formId: string } }
  | { type: 'syncResponse'; payload: FormDefinition };

export type RuntimeWsMessage =
  | { type: 'event'; payload: EventRequest }
  | { type: 'eventResult'; payload: EventResponse }
  | { type: 'uiPatch'; payload: UIPatch[]; scope?: 'shell' | 'form' }
  | { type: 'dataRefresh'; payload: { controlId: string; data: unknown[] } }
  | { type: 'error'; payload: { code: string; message: string } };

export type WsMessage = DesignerWsMessage | RuntimeWsMessage;
