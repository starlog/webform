import type { FormDefinition } from '../types/form.js';
import { validateFormDefinition } from './validation.js';

export function serializeFormDefinition(form: FormDefinition): string {
  return JSON.stringify(form);
}

export function deserializeFormDefinition(json: string): FormDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON string');
  }

  const result = validateFormDefinition(parsed);
  if (!result.valid) {
    throw new Error(`Invalid FormDefinition: ${result.errors.join('; ')}`);
  }

  return parsed as FormDefinition;
}
