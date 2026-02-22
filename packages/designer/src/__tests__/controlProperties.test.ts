import { describe, it, expect } from 'vitest';
import { CONTROL_TYPES } from '@webform/common';
import {
  CONTROL_PROPERTY_META,
  CONTROL_EVENTS_META,
  getPropertyMeta,
} from '../components/PropertyPanel/controlProperties';

describe('controlProperties', () => {
  describe('CONTROL_PROPERTY_META', () => {
    // CONTROL_PROPERTY_META에 정의된 15개 컨트롤 타입
    const DEFINED_TYPES = [
      'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
      'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
      'ProgressBar', 'PictureBox', 'Panel', 'GroupBox', 'TabControl',
      'DataGridView',
    ] as const;

    it.each(DEFINED_TYPES)('%s에 대한 메타데이터가 존재한다', (type) => {
      expect(CONTROL_PROPERTY_META[type]).toBeDefined();
      expect(CONTROL_PROPERTY_META[type]!.length).toBeGreaterThan(0);
    });

    it('정의되지 않은 타입은 getPropertyMeta로 기본 속성을 반환한다', () => {
      const meta = getPropertyMeta('SplitContainer');
      expect(meta.length).toBeGreaterThan(0);
      // 기본 속성에는 공통 Layout/Behavior 속성이 포함
      const names = meta.map((m) => m.name);
      expect(names).toContain('position.x');
      expect(names).toContain('name');
    });

    it('Button 속성에 text, enabled, backColor가 포함된다', () => {
      const buttonMeta = CONTROL_PROPERTY_META['Button']!;
      const names = buttonMeta.map((m) => m.name);

      expect(names).toContain('properties.text');
      expect(names).toContain('enabled');
      expect(names).toContain('properties.backColor');
    });

    it('모든 정의된 컨트롤 타입에 공통 속성(position, size, name)이 포함된다', () => {
      for (const type of DEFINED_TYPES) {
        const meta = CONTROL_PROPERTY_META[type]!;
        const names = meta.map((m) => m.name);
        expect(names).toContain('position.x');
        expect(names).toContain('position.y');
        expect(names).toContain('size.width');
        expect(names).toContain('size.height');
        expect(names).toContain('name');
      }
    });
  });

  describe('CONTROL_EVENTS_META', () => {
    it('TextBox 이벤트에 TextChanged가 포함된다', () => {
      const textBoxEvents = CONTROL_EVENTS_META['TextBox'];
      expect(textBoxEvents).toBeDefined();
      expect(textBoxEvents).toContain('TextChanged');
    });

    it('TextBox 이벤트에 공통 이벤트(Click, KeyDown)도 포함된다', () => {
      const textBoxEvents = CONTROL_EVENTS_META['TextBox']!;
      expect(textBoxEvents).toContain('Click');
      expect(textBoxEvents).toContain('KeyDown');
    });

    it('DataGridView 이벤트에 CellClick이 포함된다', () => {
      const events = CONTROL_EVENTS_META['DataGridView'];
      expect(events).toBeDefined();
      expect(events).toContain('CellClick');
    });
  });
});
