import { describe, it, expect } from 'vitest';
import { snapToGrid, snapPositionToGrid, getSnaplines } from '../utils/snapGrid';

describe('snapToGrid', () => {
  it('snapToGrid(13, 8) === 16', () => {
    expect(snapToGrid(13, 8)).toBe(16);
  });

  it('snapToGrid(4, 8) === 8 (반올림)', () => {
    // Math.round(4/8) = Math.round(0.5) = 1 → 1 * 8 = 8
    expect(snapToGrid(4, 8)).toBe(8);
  });

  it('snapToGrid(3, 8) === 0 (반내림)', () => {
    // Math.round(3/8) = Math.round(0.375) = 0 → 0 * 8 = 0
    expect(snapToGrid(3, 8)).toBe(0);
  });

  it('snapToGrid(8, 8) === 8 (정확히 그리드에 맞는 값)', () => {
    expect(snapToGrid(8, 8)).toBe(8);
  });

  it('snapToGrid(0, 8) === 0', () => {
    expect(snapToGrid(0, 8)).toBe(0);
  });

  it('기본 gridSize는 8이다', () => {
    expect(snapToGrid(13)).toBe(16);
  });
});

describe('snapPositionToGrid', () => {
  it('snapPositionToGrid({ x: 13, y: 5 }) === { x: 16, y: 8 }', () => {
    expect(snapPositionToGrid({ x: 13, y: 5 })).toEqual({ x: 16, y: 8 });
  });

  it('x와 y 모두 그리드에 맞춘다', () => {
    expect(snapPositionToGrid({ x: 3, y: 11 }, 8)).toEqual({ x: 0, y: 8 });
  });
});

describe('getSnaplines', () => {
  it('정렬이 되는 경우 스냅라인을 반환한다', () => {
    const moving = { position: { x: 100, y: 50 }, size: { width: 80, height: 30 } };
    const targets = [
      { id: 't1', position: { x: 100, y: 100 }, size: { width: 60, height: 40 } },
    ];

    const lines = getSnaplines(moving, targets);
    const verticals = lines.filter((l) => l.type === 'vertical');
    expect(verticals.some((l) => l.position === 100)).toBe(true);
  });

  it('threshold 범위 밖이면 스냅라인을 생성하지 않는다', () => {
    const moving = { position: { x: 0, y: 0 }, size: { width: 50, height: 50 } };
    const targets = [
      { id: 't1', position: { x: 200, y: 200 }, size: { width: 50, height: 50 } },
    ];

    const lines = getSnaplines(moving, targets);
    expect(lines).toHaveLength(0);
  });

  it('중복 스냅라인을 제거한다', () => {
    const moving = { position: { x: 100, y: 100 }, size: { width: 50, height: 50 } };
    const targets = [
      { id: 't1', position: { x: 100, y: 200 }, size: { width: 50, height: 50 } },
      { id: 't2', position: { x: 100, y: 300 }, size: { width: 50, height: 50 } },
    ];

    const lines = getSnaplines(moving, targets);
    const vertical100 = lines.filter((l) => l.type === 'vertical' && l.position === 100);
    expect(vertical100).toHaveLength(1);
  });
});
