import type { UIPatch } from '@webform/common';

export type PatchCollector = UIPatch[];

export function snapshotState(
  formState: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(formState));
}

export function diffToPatches(
  before: Record<string, Record<string, unknown>>,
  after: Record<string, Record<string, unknown>>,
): UIPatch[] {
  const patches: UIPatch[] = [];

  for (const [controlId, afterProps] of Object.entries(after)) {
    const beforeProps = before[controlId];

    if (!beforeProps) {
      continue;
    }

    const changedProps: Record<string, unknown> = {};
    let hasChanges = false;

    for (const [prop, value] of Object.entries(afterProps)) {
      if (!deepEqual(beforeProps[prop], value)) {
        changedProps[prop] = value;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      patches.push({
        type: 'updateProperty',
        target: controlId,
        payload: changedProps,
      });
    }
  }

  return patches;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

export function buildControlsContext(
  formState: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  return formState;
}
