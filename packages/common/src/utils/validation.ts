import { CONTROL_TYPES } from '../types/form.js';
import type { ControlDefinition, FormDefinition } from '../types/form.js';

const DOCK_STYLES = ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'] as const;

const DANGEROUS_OPERATORS = new Set(['$where', '$function', '$accumulator', '$expr']);

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateControlDefinition(control: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(control)) {
    return { valid: false, errors: ['Control must be an object'] };
  }

  const c = control as Record<string, unknown>;

  if (typeof c.id !== 'string' || c.id === '') {
    errors.push('Control id must be a non-empty string');
  }

  if (typeof c.type !== 'string' || !(CONTROL_TYPES as readonly string[]).includes(c.type)) {
    errors.push(`Control type must be one of: ${CONTROL_TYPES.join(', ')}`);
  }

  if (typeof c.name !== 'string' || c.name === '') {
    errors.push('Control name must be a non-empty string');
  }

  if (!isObject(c.position) || typeof (c.position as Record<string, unknown>).x !== 'number' || typeof (c.position as Record<string, unknown>).y !== 'number') {
    errors.push('Control position must be { x: number, y: number }');
  }

  if (!isObject(c.size)) {
    errors.push('Control size must be { width: number, height: number }');
  } else {
    const size = c.size as Record<string, unknown>;
    if (typeof size.width !== 'number' || size.width <= 0) {
      errors.push('Control size.width must be a positive number');
    }
    if (typeof size.height !== 'number' || size.height <= 0) {
      errors.push('Control size.height must be a positive number');
    }
  }

  if (c.children !== undefined) {
    if (!Array.isArray(c.children)) {
      errors.push('Control children must be an array');
    } else {
      for (let i = 0; i < c.children.length; i++) {
        const childResult = validateControlDefinition(c.children[i]);
        if (!childResult.valid) {
          errors.push(...childResult.errors.map(e => `children[${i}]: ${e}`));
        }
      }
    }
  }

  if (!isObject(c.anchor)) {
    errors.push('Control anchor must be { top, bottom, left, right } with boolean values');
  } else {
    const anchor = c.anchor as Record<string, unknown>;
    for (const dir of ['top', 'bottom', 'left', 'right']) {
      if (typeof anchor[dir] !== 'boolean') {
        errors.push(`Control anchor.${dir} must be a boolean`);
      }
    }
  }

  if (typeof c.dock !== 'string' || !(DOCK_STYLES as readonly string[]).includes(c.dock)) {
    errors.push(`Control dock must be one of: ${DOCK_STYLES.join(', ')}`);
  }

  if (typeof c.tabIndex !== 'number' || !Number.isInteger(c.tabIndex) || c.tabIndex < 0) {
    errors.push('Control tabIndex must be a non-negative integer');
  }

  if (typeof c.visible !== 'boolean') {
    errors.push('Control visible must be a boolean');
  }

  if (typeof c.enabled !== 'boolean') {
    errors.push('Control enabled must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

export function validateFormDefinition(form: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(form)) {
    return { valid: false, errors: ['FormDefinition must be an object'] };
  }

  const f = form as Record<string, unknown>;

  if (typeof f.id !== 'string' || f.id === '') {
    errors.push('FormDefinition id must be a non-empty string');
  }

  if (typeof f.name !== 'string' || f.name === '') {
    errors.push('FormDefinition name must be a non-empty string');
  }

  if (typeof f.version !== 'number' || !Number.isInteger(f.version) || f.version <= 0) {
    errors.push('FormDefinition version must be a positive integer');
  }

  if (!isObject(f.properties)) {
    errors.push('FormDefinition properties must be an object');
  } else {
    const props = f.properties as Record<string, unknown>;
    if (typeof props.title !== 'string') {
      errors.push('FormDefinition properties.title must be a string');
    }
    if (typeof props.width !== 'number') {
      errors.push('FormDefinition properties.width must be a number');
    }
    if (typeof props.height !== 'number') {
      errors.push('FormDefinition properties.height must be a number');
    }
  }

  if (!Array.isArray(f.controls)) {
    errors.push('FormDefinition controls must be an array');
  } else {
    for (let i = 0; i < f.controls.length; i++) {
      const controlResult = validateControlDefinition(f.controls[i]);
      if (!controlResult.valid) {
        errors.push(...controlResult.errors.map(e => `controls[${i}]: ${e}`));
      }
    }
  }

  if (!Array.isArray(f.eventHandlers)) {
    errors.push('FormDefinition eventHandlers must be an array');
  } else {
    for (let i = 0; i < f.eventHandlers.length; i++) {
      const handler = f.eventHandlers[i];
      if (!isObject(handler)) {
        errors.push(`eventHandlers[${i}] must be an object`);
        continue;
      }
      const h = handler as Record<string, unknown>;
      if (typeof h.controlId !== 'string') errors.push(`eventHandlers[${i}].controlId must be a string`);
      if (typeof h.eventName !== 'string') errors.push(`eventHandlers[${i}].eventName must be a string`);
      if (h.handlerType !== 'server' && h.handlerType !== 'client') errors.push(`eventHandlers[${i}].handlerType must be 'server' or 'client'`);
      if (typeof h.handlerCode !== 'string') errors.push(`eventHandlers[${i}].handlerCode must be a string`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeQueryInput(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (DANGEROUS_OPERATORS.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map(item =>
        isObject(item) ? sanitizeQueryInput(item) : item
      );
    } else if (isObject(value)) {
      result[key] = sanitizeQueryInput(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ValidationResult를 다른 모듈에서 사용 가능하도록 export
export type { ValidationResult, ControlDefinition, FormDefinition };
