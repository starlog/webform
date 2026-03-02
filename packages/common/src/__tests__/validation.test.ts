import { describe, it, expect } from 'vitest';
import { validateFormDefinition, sanitizeQueryInput } from '../utils/validation';
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

describe('validateFormDefinition', () => {
  it('올바른 FormDefinition → valid: true', () => {
    const form = makeValidFormDefinition();
    const result = validateFormDefinition(form);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('필수 필드(id) 누락 → valid: false', () => {
    const form = makeValidFormDefinition();
     
    const { id: _id, ...noId } = form;
    const result = validateFormDefinition(noId);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('필수 필드(name) 누락 → valid: false', () => {
    const form = makeValidFormDefinition();
     
    const { name: _name, ...noName } = form;
    const result = validateFormDefinition(noName);
    expect(result.valid).toBe(false);
  });

  it('필수 필드(controls) 누락 → valid: false', () => {
    const form = makeValidFormDefinition();
     
    const { controls: _controls, ...noControls } = form;
    const result = validateFormDefinition(noControls);
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeQueryInput', () => {
  it('$where 연산자를 제거한다', () => {
    const input = { $where: 'this.name === "admin"', name: '홍길동' };
    const result = sanitizeQueryInput(input);
    expect(result).not.toHaveProperty('$where');
    expect(result).toHaveProperty('name', '홍길동');
  });

  it('안전한 입력은 변경 없이 통과한다', () => {
    const input = { name: '홍길동', age: 30 };
    const result = sanitizeQueryInput(input);
    expect(result).toEqual({ name: '홍길동', age: 30 });
  });

  it('중첩된 $where를 재귀적으로 제거한다', () => {
    const input = {
      filter: {
        $where: 'malicious code',
        status: 'active',
      },
      name: 'test',
    };
    const result = sanitizeQueryInput(input);
    expect(result).toEqual({
      filter: { status: 'active' },
      name: 'test',
    });
  });

  it('$regex는 허용한다', () => {
    const input = { $regex: /test/ };
    const result = sanitizeQueryInput(input);
    expect(result).toHaveProperty('$regex');
  });
});
