import { describe, it, expect } from 'vitest';
import { CONTROL_DEFAULTS } from '../../utils/controlDefaults.js';
import type { ControlDefault } from '../../utils/controlDefaults.js';
import { CONTROL_TYPES } from '@webform/common';

describe('CONTROL_DEFAULTS', () => {
  it('모든 ControlType에 대한 기본값이 정의되어 있다', () => {
    for (const type of CONTROL_TYPES) {
      expect(CONTROL_DEFAULTS[type], `${type}의 기본값이 없습니다`).toBeDefined();
    }
  });

  it('모든 기본값에 필수 필드가 포함되어 있다', () => {
    for (const type of CONTROL_TYPES) {
      const def: ControlDefault = CONTROL_DEFAULTS[type];
      expect(def.size, `${type}.size`).toBeDefined();
      expect(def.size.width, `${type}.size.width`).toBeGreaterThan(0);
      expect(def.size.height, `${type}.size.height`).toBeGreaterThan(0);
      expect(def.properties, `${type}.properties`).toBeDefined();
      expect(typeof def.description, `${type}.description`).toBe('string');
      expect(def.description.length, `${type}.description is empty`).toBeGreaterThan(0);
      expect(typeof def.category, `${type}.category`).toBe('string');
      expect(typeof def.isContainer, `${type}.isContainer`).toBe('boolean');
    }
  });

  describe('기본 컨트롤', () => {
    it('Button의 기본값이 올바르다', () => {
      const btn = CONTROL_DEFAULTS.Button;
      expect(btn.size).toEqual({ width: 75, height: 23 });
      expect(btn.properties.text).toBe('Button');
      expect(btn.category).toBe('기본 컨트롤');
      expect(btn.isContainer).toBe(false);
    });

    it('Label의 기본값이 올바르다', () => {
      const lbl = CONTROL_DEFAULTS.Label;
      expect(lbl.properties.text).toBe('Label');
      expect(lbl.isContainer).toBe(false);
    });

    it('TextBox의 기본 text는 빈 문자열이다', () => {
      expect(CONTROL_DEFAULTS.TextBox.properties.text).toBe('');
    });

    it('CheckBox는 기본 checked=false이다', () => {
      expect(CONTROL_DEFAULTS.CheckBox.properties.checked).toBe(false);
    });

    it('ComboBox는 빈 items와 selectedIndex=-1이다', () => {
      const combo = CONTROL_DEFAULTS.ComboBox;
      expect(combo.properties.items).toEqual([]);
      expect(combo.properties.selectedIndex).toBe(-1);
    });

    it('NumericUpDown은 0~100 범위 기본값이다', () => {
      const num = CONTROL_DEFAULTS.NumericUpDown;
      expect(num.properties.value).toBe(0);
      expect(num.properties.minimum).toBe(0);
      expect(num.properties.maximum).toBe(100);
    });
  });

  describe('컨테이너', () => {
    it('Panel은 컨테이너 타입이다', () => {
      expect(CONTROL_DEFAULTS.Panel.isContainer).toBe(true);
    });

    it('GroupBox는 컨테이너 타입이다', () => {
      expect(CONTROL_DEFAULTS.GroupBox.isContainer).toBe(true);
    });

    it('TabControl은 2개 탭 기본값이다', () => {
      const tab = CONTROL_DEFAULTS.TabControl;
      expect(tab.isContainer).toBe(true);
      expect(tab.properties.tabs).toHaveLength(2);
    });

    it('Card는 컨테이너 타입이다', () => {
      expect(CONTROL_DEFAULTS.Card.isContainer).toBe(true);
    });

    it('Collapse는 컨테이너 타입이다', () => {
      expect(CONTROL_DEFAULTS.Collapse.isContainer).toBe(true);
    });
  });

  describe('카테고리 분류', () => {
    it('기본 컨트롤 11종이 올바른 카테고리에 속한다', () => {
      const basicTypes = [
        'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
        'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
        'ProgressBar', 'PictureBox',
      ] as const;
      for (const type of basicTypes) {
        expect(CONTROL_DEFAULTS[type].category).toBe('기본 컨트롤');
      }
    });

    it('컨테이너 4종이 올바른 카테고리에 속한다', () => {
      const containerTypes = ['Panel', 'GroupBox', 'TabControl', 'SplitContainer'] as const;
      for (const type of containerTypes) {
        expect(CONTROL_DEFAULTS[type].category).toBe('컨테이너');
      }
    });

    it('데이터 컨트롤 5종이 올바른 카테고리에 속한다', () => {
      const dataTypes = ['DataGridView', 'BindingNavigator', 'Chart', 'TreeView', 'ListView'] as const;
      for (const type of dataTypes) {
        expect(CONTROL_DEFAULTS[type].category).toBe('데이터');
      }
    });
  });

  describe('비컨테이너 컨트롤', () => {
    it('Button, TextBox, Label 등은 컨테이너가 아니다', () => {
      expect(CONTROL_DEFAULTS.Button.isContainer).toBe(false);
      expect(CONTROL_DEFAULTS.TextBox.isContainer).toBe(false);
      expect(CONTROL_DEFAULTS.DataGridView.isContainer).toBe(false);
    });
  });
});
