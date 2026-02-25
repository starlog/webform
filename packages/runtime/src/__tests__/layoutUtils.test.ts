import { describe, it, expect } from 'vitest';
import { computeLayoutStyle, computeDockStyle, computeAnchorStyle } from '../renderer/layoutUtils';
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

  describe('computeLayoutStyle with parentSize (anchor)', () => {
    const parentSize = { width: 800, height: 600 };

    it('parentSize 없이 호출 → 기존 절대 위치 방식', () => {
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

    it('parentSize 있고 dock이 설정된 경우 → dock 우선', () => {
      const ctrl = createMockControl({ dock: 'Top' });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        width: '100%',
        height: 40,
        flexShrink: 0,
      });
    });

    it('Top+Left (기본) → left/top/width/height', () => {
      const ctrl = createMockControl({
        anchor: { top: true, left: true, bottom: false, right: false },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        width: 200,
        height: 40,
      });
    });

    it('Top+Left+Right → left/top/right/height (width 없음)', () => {
      const ctrl = createMockControl({
        anchor: { top: true, left: true, bottom: false, right: true },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        right: 550, // 800 - 50 - 200
        height: 40,
      });
    });

    it('Top+Bottom+Left → left/top/bottom/width (height 없음)', () => {
      const ctrl = createMockControl({
        anchor: { top: true, left: true, bottom: true, right: false },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        bottom: 460, // 600 - 100 - 40
        width: 200,
      });
    });

    it('All 4 → left/top/right/bottom (width/height 없음)', () => {
      const ctrl = createMockControl({
        anchor: { top: true, left: true, bottom: true, right: true },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        right: 550,
        bottom: 460,
      });
    });

    it('Bottom+Right → right/bottom/width/height', () => {
      const ctrl = createMockControl({
        anchor: { top: false, left: false, bottom: true, right: true },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        right: 550,
        bottom: 460,
        width: 200,
        height: 40,
      });
    });

    it('None (all false) → Top+Left와 동일 취급', () => {
      const ctrl = createMockControl({
        anchor: { top: false, left: false, bottom: false, right: false },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        top: 100,
        width: 200,
        height: 40,
      });
    });

    it('Top+Right → right/top/width/height (우측 거리 유지)', () => {
      const ctrl = createMockControl({
        anchor: { top: true, left: false, bottom: false, right: true },
      });
      const style = computeLayoutStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        right: 550,
        top: 100,
        width: 200,
        height: 40,
      });
    });
  });

  describe('computeAnchorStyle', () => {
    const parentSize = { width: 800, height: 600 };

    it('Bottom만 → bottom/left/width/height', () => {
      const ctrl = createMockControl({
        anchor: { top: false, left: false, bottom: true, right: false },
      });
      const style = computeAnchorStyle(ctrl, parentSize);
      expect(style).toEqual({
        position: 'absolute',
        left: 50,
        bottom: 460,
        width: 200,
        height: 40,
      });
    });
  });
});
