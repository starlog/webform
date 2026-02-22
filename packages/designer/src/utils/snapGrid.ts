export interface Snapline {
  type: 'horizontal' | 'vertical';
  position: number;
}

export function snapToGrid(value: number, gridSize: number = 8): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPositionToGrid(
  position: { x: number; y: number },
  gridSize: number = 8,
): { x: number; y: number } {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}

export function getSnaplines(
  movingControl: { position: { x: number; y: number }; size: { width: number; height: number } },
  allControls: Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
  threshold: number = 4,
): Snapline[] {
  const snaplines: Snapline[] = [];

  const movingEdges = {
    left: movingControl.position.x,
    right: movingControl.position.x + movingControl.size.width,
    top: movingControl.position.y,
    bottom: movingControl.position.y + movingControl.size.height,
    centerX: movingControl.position.x + movingControl.size.width / 2,
    centerY: movingControl.position.y + movingControl.size.height / 2,
  };

  for (const target of allControls) {
    const targetEdges = {
      left: target.position.x,
      right: target.position.x + target.size.width,
      top: target.position.y,
      bottom: target.position.y + target.size.height,
      centerX: target.position.x + target.size.width / 2,
      centerY: target.position.y + target.size.height / 2,
    };

    // 수직 스냅라인 (x축 정렬)
    const verticalPairs: [number, number][] = [
      [movingEdges.left, targetEdges.left],
      [movingEdges.right, targetEdges.right],
      [movingEdges.centerX, targetEdges.centerX],
      [movingEdges.left, targetEdges.right],
      [movingEdges.right, targetEdges.left],
    ];

    for (const [a, b] of verticalPairs) {
      if (Math.abs(a - b) <= threshold) {
        snaplines.push({ type: 'vertical', position: b });
      }
    }

    // 수평 스냅라인 (y축 정렬)
    const horizontalPairs: [number, number][] = [
      [movingEdges.top, targetEdges.top],
      [movingEdges.bottom, targetEdges.bottom],
      [movingEdges.centerY, targetEdges.centerY],
      [movingEdges.top, targetEdges.bottom],
      [movingEdges.bottom, targetEdges.top],
    ];

    for (const [a, b] of horizontalPairs) {
      if (Math.abs(a - b) <= threshold) {
        snaplines.push({ type: 'horizontal', position: b });
      }
    }
  }

  // 중복 제거
  const unique = new Map<string, Snapline>();
  for (const line of snaplines) {
    const key = `${line.type}-${line.position}`;
    unique.set(key, line);
  }

  return Array.from(unique.values());
}
