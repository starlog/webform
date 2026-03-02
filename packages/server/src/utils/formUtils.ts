import type { FormDefinition } from '@webform/common';

export function toFormDef(form: {
  _id: { toString(): string };
  name: string;
  version: number;
  properties: unknown;
  controls: unknown[];
  eventHandlers: unknown[];
}): FormDefinition {
  return {
    id: form._id.toString(),
    name: form.name,
    version: form.version,
    properties: form.properties,
    controls: form.controls,
    eventHandlers: form.eventHandlers,
  } as FormDefinition;
}
