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

// --- 이진 탐색 기반 스냅라인 (대규모 컨트롤 최적화) ---

interface SnapEdge {
  position: number;
  controlId: string;
}

export interface SnapEdgeIndex {
  xEdges: SnapEdge[];
  yEdges: SnapEdge[];
}

/** 컨트롤 edge 좌표를 정렬된 배열로 사전 빌드 (드래그 시작 시 1회 호출) */
export function buildSnapEdgeIndex(
  controls: Array<{ id: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
  excludeIds?: Set<string>,
): SnapEdgeIndex {
  const xEdges: SnapEdge[] = [];
  const yEdges: SnapEdge[] = [];

  for (const c of controls) {
    if (excludeIds?.has(c.id)) continue;
    const { x, y } = c.position;
    const { width, height } = c.size;
    xEdges.push(
      { position: x, controlId: c.id },
      { position: x + width, controlId: c.id },
      { position: x + Math.floor(width / 2), controlId: c.id },
    );
    yEdges.push(
      { position: y, controlId: c.id },
      { position: y + height, controlId: c.id },
      { position: y + Math.floor(height / 2), controlId: c.id },
    );
  }

  xEdges.sort((a, b) => a.position - b.position);
  yEdges.sort((a, b) => a.position - b.position);
  return { xEdges, yEdges };
}

/** 정렬된 edge 배열에서 threshold 범위 내 position들을 이진 탐색으로 추출 */
function searchEdgesInRange(edges: SnapEdge[], target: number, threshold: number): number[] {
  const results: number[] = [];
  const lo = target - threshold;
  const hi = target + threshold;

  // lower bound: lo 이상인 첫 인덱스 찾기
  let left = 0;
  let right = edges.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (edges[mid].position < lo) left = mid + 1;
    else right = mid;
  }

  // lo..hi 범위 내 edge 수집
  for (let i = left; i < edges.length && edges[i].position <= hi; i++) {
    results.push(edges[i].position);
  }
  return results;
}

/** 이진 탐색 기반 getSnaplines (SnapEdgeIndex 사용) */
export function getSnaplinesFromIndex(
  movingControl: { position: { x: number; y: number }; size: { width: number; height: number } },
  index: SnapEdgeIndex,
  threshold: number = 4,
): Snapline[] {
  const unique = new Map<string, Snapline>();
  const { x, y } = movingControl.position;
  const { width, height } = movingControl.size;

  const movingXEdges = [x, x + width, x + Math.floor(width / 2)];
  const movingYEdges = [y, y + height, y + Math.floor(height / 2)];

  for (const mx of movingXEdges) {
    for (const pos of searchEdgesInRange(index.xEdges, mx, threshold)) {
      const key = `vertical-${pos}`;
      if (!unique.has(key)) unique.set(key, { type: 'vertical', position: pos });
    }
  }

  for (const my of movingYEdges) {
    for (const pos of searchEdgesInRange(index.yEdges, my, threshold)) {
      const key = `horizontal-${pos}`;
      if (!unique.has(key)) unique.set(key, { type: 'horizontal', position: pos });
    }
  }

  return Array.from(unique.values());
}
