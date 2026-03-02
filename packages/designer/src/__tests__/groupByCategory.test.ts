import { describe, it, expect } from 'vitest';
import { groupByCategory } from '../components/PropertyPanel/utils/groupByCategory';
import type { PropertyMeta } from '../components/PropertyPanel/controlProperties';

function makeMeta(overrides: Partial<PropertyMeta>): PropertyMeta {
  return {
    name: 'prop',
    label: 'Prop',
    category: 'Design',
    type: 'string',
    ...overrides,
  } as PropertyMeta;
}

describe('groupByCategory', () => {
  describe('카테고리 모드 (기본값)', () => {
    it('카테고리별로 그룹핑한다', () => {
      const metas = [
        makeMeta({ name: 'text', label: 'Text', category: 'Design' }),
        makeMeta({ name: 'backColor', label: 'BackColor', category: 'Appearance' }),
        makeMeta({ name: 'enabled', label: 'Enabled', category: 'Behavior' }),
        makeMeta({ name: 'font', label: 'Font', category: 'Appearance' }),
      ];

      const result = groupByCategory(metas);

      expect(result).toHaveLength(3);
      expect(result[0].category).toBe('Design');
      expect(result[0].properties).toHaveLength(1);
      expect(result[1].category).toBe('Appearance');
      expect(result[1].properties).toHaveLength(2);
      expect(result[2].category).toBe('Behavior');
      expect(result[2].properties).toHaveLength(1);
    });

    it('기본 카테고리 순서를 따른다', () => {
      const metas = [
        makeMeta({ name: 'a', label: 'A', category: 'Layout' }),
        makeMeta({ name: 'b', label: 'B', category: 'Design' }),
        makeMeta({ name: 'c', label: 'C', category: 'Behavior' }),
      ];

      const result = groupByCategory(metas);

      expect(result.map((g) => g.category)).toEqual(['Design', 'Behavior', 'Layout']);
    });

    it('데이터가 없는 카테고리는 포함하지 않는다', () => {
      const metas = [
        makeMeta({ name: 'text', label: 'Text', category: 'Design' }),
      ];

      const result = groupByCategory(metas);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Design');
    });

    it('빈 배열이면 빈 결과를 반환한다', () => {
      const result = groupByCategory([]);
      expect(result).toEqual([]);
    });

    it('category가 없는 속성은 Design으로 분류한다', () => {
      const metas = [
        makeMeta({ name: 'test', label: 'Test', category: undefined }),
      ];

      const result = groupByCategory(metas);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Design');
      expect(result[0].properties).toHaveLength(1);
    });
  });

  describe('알파벳순 모드', () => {
    it('알파벳순으로 정렬하여 All 그룹으로 반환한다', () => {
      const metas = [
        makeMeta({ name: 'c', label: 'Charlie', category: 'Design' }),
        makeMeta({ name: 'a', label: 'Alpha', category: 'Behavior' }),
        makeMeta({ name: 'b', label: 'Bravo', category: 'Appearance' }),
      ];

      const result = groupByCategory(metas, { sortMode: 'alphabetical' });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('All');
      expect(result[0].properties).toHaveLength(3);
      expect(result[0].properties[0].label).toBe('Alpha');
      expect(result[0].properties[1].label).toBe('Bravo');
      expect(result[0].properties[2].label).toBe('Charlie');
    });

    it('원본 배열을 변경하지 않는다', () => {
      const metas = [
        makeMeta({ name: 'c', label: 'C' }),
        makeMeta({ name: 'a', label: 'A' }),
      ];
      const original = [...metas];

      groupByCategory(metas, { sortMode: 'alphabetical' });

      expect(metas[0].label).toBe(original[0].label);
      expect(metas[1].label).toBe(original[1].label);
    });
  });

  describe('커스텀 카테고리 순서', () => {
    it('지정된 카테고리 순서대로 반환한다', () => {
      const metas = [
        makeMeta({ name: 'a', label: 'A', category: 'Layout' }),
        makeMeta({ name: 'b', label: 'B', category: 'Appearance' }),
        makeMeta({ name: 'c', label: 'C', category: 'Behavior' }),
      ];

      const result = groupByCategory(metas, {
        categoryOrder: ['Layout', 'Appearance', 'Behavior'],
      });

      expect(result.map((g) => g.category)).toEqual(['Layout', 'Appearance', 'Behavior']);
    });

    it('커스텀 순서에 없는 카테고리는 제외된다', () => {
      const metas = [
        makeMeta({ name: 'a', label: 'A', category: 'Design' }),
        makeMeta({ name: 'b', label: 'B', category: 'Layout' }),
      ];

      const result = groupByCategory(metas, {
        categoryOrder: ['Layout'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Layout');
    });

    it('Authentication 카테고리를 포함할 수 있다 (Shell 용)', () => {
      const metas = [
        makeMeta({ name: 'a', label: 'A', category: 'Layout' }),
        makeMeta({ name: 'b', label: 'B', category: 'Authentication' as never }),
      ];

      const result = groupByCategory(metas, {
        categoryOrder: ['Layout', 'Appearance', 'Behavior', 'Authentication'] as never[],
      });

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('Layout');
      expect(result[1].category).toBe('Authentication');
    });
  });
});
