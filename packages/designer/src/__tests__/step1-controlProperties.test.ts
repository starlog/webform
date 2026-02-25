import { describe, it, expect } from 'vitest';

import {
  CONTROL_PROPERTY_META,
  getPropertyMeta,
  type PropertyMeta,
} from '../components/PropertyPanel/controlProperties';

// 공통 속성 이름 목록 (withCommon으로 주입됨)
const COMMON_PROPERTY_NAMES = [
  'name',
  'enabled',
  'visible',
  'tabIndex',
  'position.x',
  'position.y',
  'size.width',
  'size.height',
  'anchor',
  'dock',
];

const STEP1_TYPES = ['Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider'] as const;

function getMeta(type: (typeof STEP1_TYPES)[number]): PropertyMeta[] {
  return CONTROL_PROPERTY_META[type]!;
}

function getNames(type: (typeof STEP1_TYPES)[number]): string[] {
  return getMeta(type).map((m) => m.name);
}

function findProp(type: (typeof STEP1_TYPES)[number], name: string): PropertyMeta | undefined {
  return getMeta(type).find((m) => m.name === name);
}

describe('Step 1 컨트롤 PropertyMeta 검증', () => {
  describe('CONTROL_PROPERTY_META 키 존재 확인', () => {
    it.each(STEP1_TYPES)('%s 키가 CONTROL_PROPERTY_META에 존재한다', (type) => {
      expect(CONTROL_PROPERTY_META[type]).toBeDefined();
      expect(CONTROL_PROPERTY_META[type]!.length).toBeGreaterThan(0);
    });
  });

  describe('withCommon() 공통 속성 포함 확인', () => {
    it.each(STEP1_TYPES)('%s에 공통 속성(name, enabled, visible, position, size 등)이 포함된다', (type) => {
      const names = getNames(type);
      for (const commonName of COMMON_PROPERTY_NAMES) {
        expect(names).toContain(commonName);
      }
    });
  });

  describe('Slider PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Slider');
      expect(names).toContain('properties.value');
      expect(names).toContain('properties.minimum');
      expect(names).toContain('properties.maximum');
      expect(names).toContain('properties.step');
      expect(names).toContain('properties.orientation');
      expect(names).toContain('properties.showValue');
      expect(names).toContain('properties.trackColor');
      expect(names).toContain('properties.fillColor');
    });

    it('dropdown 옵션이 PRD 스펙과 일치한다', () => {
      const orientation = findProp('Slider', 'properties.orientation');
      expect(orientation?.editorType).toBe('dropdown');
      expect(orientation?.options).toEqual(['Horizontal', 'Vertical']);
      expect(orientation?.defaultValue).toBe('Horizontal');
    });

    it('defaultValue 타입이 editorType과 일치한다', () => {
      expect(findProp('Slider', 'properties.value')?.defaultValue).toBe(0);
      expect(findProp('Slider', 'properties.minimum')?.defaultValue).toBe(0);
      expect(findProp('Slider', 'properties.maximum')?.defaultValue).toBe(100);
      expect(findProp('Slider', 'properties.step')?.defaultValue).toBe(1);
      expect(findProp('Slider', 'properties.showValue')?.defaultValue).toBe(true);
    });

    it('step의 min이 1이다', () => {
      expect(findProp('Slider', 'properties.step')?.min).toBe(1);
    });
  });

  describe('Switch PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Switch');
      expect(names).toContain('properties.checked');
      expect(names).toContain('properties.text');
      expect(names).toContain('properties.onText');
      expect(names).toContain('properties.offText');
      expect(names).toContain('properties.onColor');
      expect(names).toContain('properties.offColor');
    });

    it('defaultValue가 PRD 스펙과 일치한다', () => {
      expect(findProp('Switch', 'properties.checked')?.defaultValue).toBe(false);
      expect(findProp('Switch', 'properties.text')?.defaultValue).toBe('');
      expect(findProp('Switch', 'properties.onText')?.defaultValue).toBe('ON');
      expect(findProp('Switch', 'properties.offText')?.defaultValue).toBe('OFF');
    });
  });

  describe('Upload PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Upload');
      expect(names).toContain('properties.uploadMode');
      expect(names).toContain('properties.text');
      expect(names).toContain('properties.accept');
      expect(names).toContain('properties.multiple');
      expect(names).toContain('properties.maxFileSize');
      expect(names).toContain('properties.maxCount');
      expect(names).toContain('properties.backColor');
      expect(names).toContain('properties.foreColor');
      expect(names).toContain('properties.borderStyle');
    });

    it('dropdown 옵션이 PRD 스펙과 일치한다', () => {
      const uploadMode = findProp('Upload', 'properties.uploadMode');
      expect(uploadMode?.options).toEqual(['Button', 'DropZone']);
      expect(uploadMode?.defaultValue).toBe('DropZone');

      const borderStyle = findProp('Upload', 'properties.borderStyle');
      expect(borderStyle?.options).toEqual(['None', 'Solid', 'Dashed']);
      expect(borderStyle?.defaultValue).toBe('Dashed');
    });

    it('defaultValue 타입이 editorType과 일치한다', () => {
      expect(findProp('Upload', 'properties.text')?.defaultValue).toBe('Click or drag file to upload');
      expect(findProp('Upload', 'properties.accept')?.defaultValue).toBe('');
      expect(findProp('Upload', 'properties.multiple')?.defaultValue).toBe(false);
      expect(findProp('Upload', 'properties.maxFileSize')?.defaultValue).toBe(10);
      expect(findProp('Upload', 'properties.maxCount')?.defaultValue).toBe(1);
    });

    it('maxFileSize의 min/max가 올바르다', () => {
      const maxFileSize = findProp('Upload', 'properties.maxFileSize');
      expect(maxFileSize?.min).toBe(1);
      expect(maxFileSize?.max).toBe(100);
    });

    it('maxCount의 min/max가 올바르다', () => {
      const maxCount = findProp('Upload', 'properties.maxCount');
      expect(maxCount?.min).toBe(1);
      expect(maxCount?.max).toBe(20);
    });
  });

  describe('Alert PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Alert');
      expect(names).toContain('properties.message');
      expect(names).toContain('properties.description');
      expect(names).toContain('properties.alertType');
      expect(names).toContain('properties.showIcon');
      expect(names).toContain('properties.closable');
      expect(names).toContain('properties.banner');
      expect(names).toContain('properties.foreColor');
    });

    it('alertType dropdown 옵션이 PRD 스펙과 일치한다', () => {
      const alertType = findProp('Alert', 'properties.alertType');
      expect(alertType?.editorType).toBe('dropdown');
      expect(alertType?.options).toEqual(['Success', 'Info', 'Warning', 'Error']);
      expect(alertType?.defaultValue).toBe('Info');
    });

    it('defaultValue가 PRD 스펙과 일치한다', () => {
      expect(findProp('Alert', 'properties.message')?.defaultValue).toBe('Alert message');
      expect(findProp('Alert', 'properties.description')?.defaultValue).toBe('');
      expect(findProp('Alert', 'properties.showIcon')?.defaultValue).toBe(true);
      expect(findProp('Alert', 'properties.closable')?.defaultValue).toBe(false);
      expect(findProp('Alert', 'properties.banner')?.defaultValue).toBe(false);
    });
  });

  describe('Tag PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Tag');
      expect(names).toContain('properties.tags');
      expect(names).toContain('properties.tagColor');
      expect(names).toContain('properties.closable');
      expect(names).toContain('properties.addable');
      expect(names).toContain('properties.foreColor');
    });

    it('tags의 collection defaultValue 구조가 올바르다', () => {
      const tags = findProp('Tag', 'properties.tags');
      expect(tags?.editorType).toBe('collection');
      expect(tags?.defaultValue).toEqual(['Tag1', 'Tag2']);
    });

    it('tagColor dropdown 옵션이 PRD 스펙과 일치한다', () => {
      const tagColor = findProp('Tag', 'properties.tagColor');
      expect(tagColor?.editorType).toBe('dropdown');
      expect(tagColor?.options).toEqual([
        'Default', 'Blue', 'Green', 'Red', 'Orange', 'Purple', 'Cyan', 'Gold',
      ]);
      expect(tagColor?.defaultValue).toBe('Default');
    });

    it('boolean 속성의 defaultValue가 올바르다', () => {
      expect(findProp('Tag', 'properties.closable')?.defaultValue).toBe(false);
      expect(findProp('Tag', 'properties.addable')?.defaultValue).toBe(false);
    });
  });

  describe('Divider PropertyMeta', () => {
    it('고유 속성이 모두 포함된다', () => {
      const names = getNames('Divider');
      expect(names).toContain('properties.text');
      expect(names).toContain('properties.orientation');
      expect(names).toContain('properties.textAlign');
      expect(names).toContain('properties.lineStyle');
      expect(names).toContain('properties.lineColor');
      expect(names).toContain('properties.foreColor');
    });

    it('dropdown 옵션이 PRD 스펙과 일치한다', () => {
      const orientation = findProp('Divider', 'properties.orientation');
      expect(orientation?.options).toEqual(['Horizontal', 'Vertical']);
      expect(orientation?.defaultValue).toBe('Horizontal');

      const textAlign = findProp('Divider', 'properties.textAlign');
      expect(textAlign?.options).toEqual(['Left', 'Center', 'Right']);
      expect(textAlign?.defaultValue).toBe('Center');

      const lineStyle = findProp('Divider', 'properties.lineStyle');
      expect(lineStyle?.options).toEqual(['Solid', 'Dashed', 'Dotted']);
      expect(lineStyle?.defaultValue).toBe('Solid');
    });

    it('defaultValue가 PRD 스펙과 일치한다', () => {
      expect(findProp('Divider', 'properties.text')?.defaultValue).toBe('');
    });
  });

  describe('getPropertyMeta() 호환성', () => {
    it.each(STEP1_TYPES)('getPropertyMeta(%s)가 올바른 메타데이터를 반환한다', (type) => {
      const meta = getPropertyMeta(type);
      expect(meta).toEqual(CONTROL_PROPERTY_META[type]);
    });
  });
});
