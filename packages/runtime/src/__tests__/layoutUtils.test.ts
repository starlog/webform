import { describe, it, expect } from 'vitest';
import { computeLayoutStyle, computeDockStyle } from '../renderer/layoutUtils';
import type { ControlDefinition } from '@webform/common';

function createMockControl(overrides?: Partial<ControlDefinition>): ControlDefinition {
  return {
    id: 'ctrl1',
    type: 'Button',
    name: 'button1',
    properties: {},
    position: { x: 50, y: 100 },
    size: { width: 200, height: 40 },
    anchor: { top: true, left: true, bottom: false, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

describe('layoutUtils', () => {
  describe('computeLayoutStyle', () => {
    it('position/size를 CSS absolute 스타일로 변환한다', () => {
      const ctrl = createMockControl();
      const style = computeLayoutStyle(ctrl);

      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        width: 200,
        height: 40,
      });
    });

    it('dock이 None이 아니면 dock 스타일을 우선 적용한다', () => {
      const ctrl = createMockControl({ dock: 'Top' });
      const style = computeLayoutStyle(ctrl);

      expect(style).toEqual({
        width: '100%',
        height: 40,
        flexShrink: 0,
      });
    });
  });

  describe('computeDockStyle', () => {
    it("Fill → absolute로 모든 방향 0", () => {
      const style = computeDockStyle('Fill', { width: 100, height: 50 });

      expect(style).toEqual({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      });
    });

    it('Top → 전체 너비, 높이 유지, flexbox 흐름', () => {
      const style = computeDockStyle('Top', { width: 300, height: 60 });

      expect(style).toEqual({
        width: '100%',
        height: 60,
        flexShrink: 0,
      });
    });

    it('Bottom → 전체 너비, 높이 유지, flexbox 흐름', () => {
      const style = computeDockStyle('Bottom', { width: 300, height: 60 });

      expect(style).toEqual({
        width: '100%',
        height: 60,
        flexShrink: 0,
      });
    });

    it('Left → 너비 유지, 전체 높이, flexbox 흐름', () => {
      const style = computeDockStyle('Left', { width: 200, height: 400 });

      expect(style).toEqual({
        width: 200,
        height: '100%',
        flexShrink: 0,
      });
    });

    it('Right → 너비 유지, 전체 높이, flexbox 흐름', () => {
      const style = computeDockStyle('Right', { width: 200, height: 400 });

      expect(style).toEqual({
        width: 200,
        height: '100%',
        flexShrink: 0,
      });
    });

    it('None → 빈 객체 반환', () => {
      const style = computeDockStyle('None', { width: 100, height: 100 });
      expect(style).toEqual({});
    });
  });
});
