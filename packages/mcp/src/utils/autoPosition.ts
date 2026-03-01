import type { ControlDefinition } from '@webform/common';

const GRID_SIZE = 16;
const GAP = 16;
const START_X = 16;
const START_Y = 16;

/**
 * 16px 그리드에 좌표를 스냅한다.
 */
export function snapToGrid(
  position: { x: number; y: number },
  gridSize = GRID_SIZE,
): { x: number; y: number } {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/**
 * 컨트롤이 docked 상태인지 확인한다.
 */
function isDocked(control: ControlDefinition): boolean {
  return control.dock !== undefined && control.dock !== 'None';
}

/**
 * 두 영역이 겹치는지 확인한다 (GAP 포함).
 */
function hasOverlap(
  controls: ControlDefinition[],
  position: { x: number; y: number },
  size: { width: number; height: number },
): boolean {
  for (const ctrl of controls) {
    if (
      position.x < ctrl.position.x + ctrl.size.width + GAP &&
      position.x + size.width + GAP > ctrl.position.x &&
      position.y < ctrl.position.y + ctrl.size.height + GAP &&
      position.y + size.height + GAP > ctrl.position.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 겹치지 않는 위치를 찾는다.
 * 전략: 기존 컨트롤들의 최하단 아래에 순차 배치.
 */
function findNonOverlappingPosition(
  existingControls: ControlDefinition[],
  newSize: { width: number; height: number },
): { x: number; y: number } {
  if (existingControls.length === 0) {
    return { x: START_X, y: START_Y };
  }

  let maxBottom = 0;
  for (const ctrl of existingControls) {
    const bottom = ctrl.position.y + ctrl.size.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const candidate = { x: START_X, y: maxBottom + GAP };

  while (hasOverlap(existingControls, candidate, newSize)) {
    candidate.y += GRID_SIZE;
  }

  return snapToGrid(candidate);
}

/**
 * 컨트롤 ID로 중첩 구조 내 컨트롤을 찾는다.
 */
function findControlByIdForPosition(
  controls: ControlDefinition[],
  id: string,
): ControlDefinition | undefined {
  for (const ctrl of controls) {
    if (ctrl.id === id) return ctrl;
    if (ctrl.children) {
      const found = findControlByIdForPosition(ctrl.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 컨트롤 추가 시 position 미지정이면 자동 배치한다.
 * parentId가 있으면 해당 컨테이너 내부 컨트롤만 대상으로 배치.
 */
export function autoPosition(
  existingControls: ControlDefinition[],
  newSize: { width: number; height: number },
  parentId?: string,
): { x: number; y: number } {
  const siblings = parentId
    ? (findControlByIdForPosition(existingControls, parentId)?.children || [])
    : existingControls.filter((c) => !isDocked(c));

  return findNonOverlappingPosition(siblings, newSize);
}
