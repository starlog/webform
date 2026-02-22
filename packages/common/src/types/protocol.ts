import type { ControlDefinition, FormDefinition, FormProperties } from './form';
import type { EventArgs } from './events';

export interface UIPatch {
  type: 'updateProperty' | 'addControl' | 'removeControl' | 'showDialog' | 'navigate';
  target: string;
  payload: Record<string, unknown>;
}

export interface EventRequest {
  formId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  formState: Record<string, Record<string, unknown>>;
}

export interface EventResponse {
  success: boolean;
  patches: UIPatch[];
  error?: string;
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
  | { type: 'uiPatch'; payload: UIPatch[] }
  | { type: 'dataRefresh'; payload: { controlId: string; data: unknown[] } }
  | { type: 'error'; payload: { code: string; message: string } };

export type WsMessage = DesignerWsMessage | RuntimeWsMessage;
