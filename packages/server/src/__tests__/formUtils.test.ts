import { describe, it, expect } from 'vitest';
import { toFormDef } from '../utils/formUtils.js';

describe('toFormDef', () => {
  const mockForm = {
    _id: { toString: () => 'form-123' },
    name: 'TestForm',
    version: 2,
    properties: { title: 'Test', width: 800, height: 600 },
    controls: [
      { id: 'btn-1', type: 'Button', name: 'button1', properties: { text: 'Click' } },
    ],
    eventHandlers: [
      { controlId: 'btn-1', eventName: 'Click', handlerType: 'server', code: 'console.log("hi")' },
    ],
  };

  it('_id를 id 문자열로 변환한다', () => {
    const result = toFormDef(mockForm);
    expect(result.id).toBe('form-123');
  });

  it('name, version을 그대로 전달한다', () => {
    const result = toFormDef(mockForm);
    expect(result.name).toBe('TestForm');
    expect(result.version).toBe(2);
  });

  it('properties를 그대로 전달한다', () => {
    const result = toFormDef(mockForm);
    expect(result.properties).toEqual({ title: 'Test', width: 800, height: 600 });
  });

  it('controls 배열을 그대로 전달한다', () => {
    const result = toFormDef(mockForm);
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0]).toEqual(mockForm.controls[0]);
  });

  it('eventHandlers 배열을 그대로 전달한다', () => {
    const result = toFormDef(mockForm);
    expect(result.eventHandlers).toHaveLength(1);
  });

  it('ObjectId-like _id를 처리한다', () => {
    const mongoForm = {
      ...mockForm,
      _id: { toString: () => '65a1b2c3d4e5f6a7b8c9d0e1' },
    };
    const result = toFormDef(mongoForm);
    expect(result.id).toBe('65a1b2c3d4e5f6a7b8c9d0e1');
  });
});
