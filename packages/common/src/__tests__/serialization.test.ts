import { describe, it, expect } from 'vitest';
import { serializeFormDefinition, deserializeFormDefinition } from '../utils/serialization';
import type { FormDefinition } from '../types/form';

function makeValidControl(overrides?: Record<string, unknown>) {
  return {
    id: 'ctrl-1',
    type: 'Button' as const,
    name: 'btnSubmit',
    properties: { text: 'Submit' },
    position: { x: 10, y: 20 },
    size: { width: 100, height: 30 },
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None' as const,
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

function makeValidFormDefinition(overrides?: Partial<FormDefinition>): FormDefinition {
  return {
    id: 'form-1',
    name: 'MainForm',
    version: 1,
    properties: {
      title: 'Main Form',
      width: 800,
      height: 600,
      backgroundColor: '#FFFFFF',
      font: { family: 'Arial', size: 12, bold: false, italic: false, underline: false, strikethrough: false },
      startPosition: 'CenterScreen',
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls: [makeValidControl()],
    eventHandlers: [
      { controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: 'console.log("clicked")' },
    ],
    ...overrides,
  };
}

describe('FormDefinition 직렬화/역직렬화', () => {
  it('직렬화 → 역직렬화 라운드트립이 동일한 결과를 반환한다', () => {
    const form = makeValidFormDefinition();
    const json = serializeFormDefinition(form);
    const restored = deserializeFormDefinition(json);
    expect(restored).toEqual(form);
  });

  it('중첩 children 포함 FormDefinition 라운드트립', () => {
    const childControl = makeValidControl({ id: 'child-1', name: 'childBtn' });
    const parentControl = makeValidControl({
      id: 'panel-1',
      type: 'Panel',
      name: 'mainPanel',
      children: [childControl],
    });
    const form = makeValidFormDefinition({ controls: [parentControl] });

    const json = serializeFormDefinition(form);
    const restored = deserializeFormDefinition(json);
    expect(restored).toEqual(form);
    expect((restored.controls[0] as unknown as { children: unknown[] }).children).toHaveLength(1);
    expect((restored.controls[0] as unknown as { children: { id: string }[] }).children[0].id).toBe('child-1');
  });

  it('잘못된 JSON 문자열 → 에러를 던진다', () => {
    expect(() => deserializeFormDefinition('not valid json')).toThrow('Invalid JSON string');
  });

  it('유효하지 않은 FormDefinition JSON → 에러를 던진다', () => {
    const invalidJson = JSON.stringify({ foo: 'bar' });
    expect(() => deserializeFormDefinition(invalidJson)).toThrow('Invalid FormDefinition');
  });
});
