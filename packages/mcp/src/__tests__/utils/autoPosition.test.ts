import { describe, it, expect } from 'vitest';
import { snapToGrid, autoPosition } from '../../utils/autoPosition.js';
import type { ControlDefinition } from '@webform/common';

// --- 헬퍼 ---

function makeControl(
  overrides: Partial<ControlDefinition> & { id: string; position: { x: number; y: number }; size: { width: number; height: number } },
): ControlDefinition {
  return {
    type: 'Button',
    name: overrides.id,
    properties: {},
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  } as ControlDefinition;
}

// --- snapToGrid ---

describe('snapToGrid', () => {
  it('정확히 그리드 위에 있는 좌표는 그대로 반환한다', () => {
    expect(snapToGrid({ x: 16, y: 32 })).toEqual({ x: 16, y: 32 });
  });

  it('가장 가까운 그리드 포인트로 스냅한다', () => {
    expect(snapToGrid({ x: 17, y: 25 })).toEqual({ x: 16, y: 32 });
  });

  it('0,0은 그대로 반환한다', () => {
    expect(snapToGrid({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('반올림으로 동작한다 (8 이상은 올림)', () => {
    expect(snapToGrid({ x: 8, y: 8 })).toEqual({ x: 16, y: 16 });
  });

  it('반올림으로 동작한다 (7 이하는 내림)', () => {
    expect(snapToGrid({ x: 7, y: 7 })).toEqual({ x: 0, y: 0 });
  });

  it('커스텀 gridSize를 지원한다', () => {
    expect(snapToGrid({ x: 10, y: 10 }, 8)).toEqual({ x: 8, y: 8 });
  });

  it('큰 좌표값도 정확히 스냅한다', () => {
    expect(snapToGrid({ x: 100, y: 200 })).toEqual({ x: 96, y: 208 });
  });
});

// --- autoPosition ---

describe('autoPosition', () => {
  it('기존 컨트롤이 없으면 (16, 16)에 배치한다', () => {
    const result = autoPosition([], { width: 75, height: 23 });
    expect(result).toEqual({ x: 16, y: 16 });
  });

  it('기존 컨트롤 아래에 GAP(16px)을 두고 배치한다', () => {
    const existing = [
      makeControl({
        id: 'btn1',
        position: { x: 16, y: 16 },
        size: { width: 75, height: 23 },
      }),
    ];

    const result = autoPosition(existing, { width: 75, height: 23 });

    // btn1의 bottom = 16 + 23 = 39, candidate.y = 39 + 16 = 55
    // snapToGrid(55) = Math.round(55/16)*16 = 3*16 = 48
    expect(result.x).toBe(16);
    expect(result.y).toBe(48);
  });

  it('여러 컨트롤이 있으면 최하단 아래에 배치한다', () => {
    const existing = [
      makeControl({
        id: 'btn1',
        position: { x: 16, y: 16 },
        size: { width: 75, height: 23 },
      }),
      makeControl({
        id: 'btn2',
        position: { x: 16, y: 80 },
        size: { width: 75, height: 23 },
      }),
    ];

    const result = autoPosition(existing, { width: 75, height: 23 });

    // btn2의 bottom = 80 + 23 = 103, candidate.y = 103 + 16 = 119
    // snapToGrid(119) = Math.round(119/16)*16 = 7*16 = 112
    expect(result.y).toBe(112);
  });

  it('docked 컨트롤은 무시한다', () => {
    const existing = [
      makeControl({
        id: 'menu1',
        position: { x: 0, y: 0 },
        size: { width: 800, height: 24 },
        dock: 'Top',
      }),
    ];

    const result = autoPosition(existing, { width: 75, height: 23 });

    // docked 컨트롤은 제외되므로 (16, 16)에 배치
    expect(result).toEqual({ x: 16, y: 16 });
  });

  it('parentId 지정 시 해당 컨테이너의 children 내에서 배치한다', () => {
    const panel = makeControl({
      id: 'panel1',
      type: 'Panel' as ControlDefinition['type'],
      position: { x: 16, y: 16 },
      size: { width: 200, height: 100 },
      children: [
        makeControl({
          id: 'btn1',
          position: { x: 16, y: 16 },
          size: { width: 75, height: 23 },
        }),
      ],
    });

    const result = autoPosition([panel], { width: 75, height: 23 }, 'panel1');

    // panel 내부 btn1의 bottom = 16 + 23 = 39, candidate.y = 39 + 16 = 55
    // snapToGrid(55) = Math.round(55/16)*16 = 3*16 = 48
    expect(result.y).toBe(48);
  });

  it('존재하지 않는 parentId면 빈 배열로 처리하여 (16,16)에 배치한다', () => {
    const existing = [
      makeControl({
        id: 'btn1',
        position: { x: 16, y: 16 },
        size: { width: 75, height: 23 },
      }),
    ];

    const result = autoPosition(existing, { width: 75, height: 23 }, 'nonexistent');

    expect(result).toEqual({ x: 16, y: 16 });
  });

  it('결과는 항상 그리드에 스냅된다', () => {
    const existing = [
      makeControl({
        id: 'btn1',
        position: { x: 16, y: 16 },
        size: { width: 75, height: 30 },
      }),
    ];

    const result = autoPosition(existing, { width: 75, height: 23 });

    expect(result.x % 16).toBe(0);
    expect(result.y % 16).toBe(0);
  });
});
