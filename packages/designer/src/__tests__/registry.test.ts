import { describe, it, expect } from 'vitest';
import {
  designerControlRegistry,
  controlMetadata,
  getDesignerComponent,
  getControlsByCategory,
} from '../controls/registry';
import { createDefaultControl, getDefaultSize } from '../stores/designerStore';
import type { ControlType } from '@webform/common';

// Phase 1 컨트롤 타입 목록 (기본 11종 + 컨테이너 3종)
const PHASE1_TYPES: ControlType[] = [
  'Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton',
  'ComboBox', 'ListBox', 'NumericUpDown', 'DateTimePicker',
  'ProgressBar', 'PictureBox',
  'Panel', 'GroupBox', 'TabControl',
];

describe('designerControlRegistry', () => {
  it.each(PHASE1_TYPES)('%s 컴포넌트가 등록되어 있어야 한다', (type) => {
    expect(designerControlRegistry[type]).toBeDefined();
    expect(typeof designerControlRegistry[type]).toBe('function');
  });

  it('getDesignerComponent로 등록된 컴포넌트를 조회할 수 있어야 한다', () => {
    for (const type of PHASE1_TYPES) {
      expect(getDesignerComponent(type)).toBe(designerControlRegistry[type]);
    }
  });
});

describe('controlMetadata', () => {
  it('모든 Phase 1 타입에 대한 메타데이터가 존재해야 한다', () => {
    const metaTypes = controlMetadata.map((m) => m.type);
    for (const type of PHASE1_TYPES) {
      expect(metaTypes).toContain(type);
    }
  });

  it('getControlsByCategory로 카테고리별 컨트롤을 필터링할 수 있어야 한다', () => {
    const basicControls = getControlsByCategory('basic');
    expect(basicControls.length).toBeGreaterThan(0);
    expect(basicControls.every((m) => m.category === 'basic')).toBe(true);

    const containerControls = getControlsByCategory('container');
    expect(containerControls.length).toBeGreaterThan(0);
    expect(containerControls.every((m) => m.category === 'container')).toBe(true);
  });
});

describe('defaultControlSizes', () => {
  it.each(PHASE1_TYPES)('%s에 대한 기본 크기(width, height)가 존재해야 한다', (type) => {
    const size = getDefaultSize(type);
    expect(size).toBeDefined();
    expect(typeof size.width).toBe('number');
    expect(typeof size.height).toBe('number');
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});

describe('createDefaultControl', () => {
  it('Button 타입으로 생성 시 고유 id와 type=Button을 가져야 한다', () => {
    const control = createDefaultControl('Button', { x: 10, y: 20 });

    expect(control.id).toBeDefined();
    expect(control.id.length).toBeGreaterThan(0);
    expect(control.type).toBe('Button');
    expect(control.position).toEqual({ x: 10, y: 20 });
  });

  it('기본 속성(properties)이 포함되어야 한다', () => {
    const control = createDefaultControl('Button', { x: 0, y: 0 });
    expect(control.properties).toBeDefined();
    expect(control.properties.text).toBe('Button');
  });

  it('기본 크기(size)가 포함되어야 한다', () => {
    const control = createDefaultControl('Button', { x: 0, y: 0 });
    expect(control.size).toBeDefined();
    expect(control.size.width).toBeGreaterThan(0);
    expect(control.size.height).toBeGreaterThan(0);
  });

  it('두 번 호출 시 서로 다른 id를 생성해야 한다', () => {
    const control1 = createDefaultControl('Button', { x: 0, y: 0 });
    const control2 = createDefaultControl('Button', { x: 0, y: 0 });

    expect(control1.id).not.toBe(control2.id);
  });
});
