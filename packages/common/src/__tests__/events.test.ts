import { describe, it, expect } from 'vitest';
import { COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '../types/events';

describe('COMMON_EVENTS', () => {
  it("'Click'을 포함한다", () => {
    expect(COMMON_EVENTS).toContain('Click');
  });

  it("'MouseEnter'를 포함한다", () => {
    expect(COMMON_EVENTS).toContain('MouseEnter');
  });

  it('배열이며 비어있지 않다', () => {
    expect(Array.isArray(COMMON_EVENTS)).toBe(true);
    expect(COMMON_EVENTS.length).toBeGreaterThan(0);
  });
});

describe('CONTROL_EVENTS', () => {
  it("TextBox에 'TextChanged'가 포함된다", () => {
    expect(CONTROL_EVENTS['TextBox']).toContain('TextChanged');
  });

  it("ComboBox에 'SelectedIndexChanged'가 포함된다", () => {
    expect(CONTROL_EVENTS['ComboBox']).toContain('SelectedIndexChanged');
  });

  it("DataGridView에 'CellClick'이 포함된다", () => {
    expect(CONTROL_EVENTS['DataGridView']).toContain('CellClick');
  });
});

describe('FORM_EVENTS', () => {
  it("'Load'를 포함한다", () => {
    expect(FORM_EVENTS).toContain('Load');
  });

  it("'FormClosing'을 포함한다", () => {
    expect(FORM_EVENTS).toContain('FormClosing');
  });
});
