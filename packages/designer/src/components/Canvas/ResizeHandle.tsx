/* eslint-disable react-refresh/only-export-components */
import { useDesignerStore } from '../../stores/designerStore';
import { useHistoryStore, createSnapshot } from '../../stores/historyStore';
import { snapToGrid, snapPositionToGrid } from '../../utils/snapGrid';

export type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

interface ResizeHandleProps {
  direction: ResizeDirection;
  controlId: string;
}

const HANDLE_SIZE = 7;
const MIN_SIZE = 20;

const CURSOR_MAP: Record<ResizeDirection, string> = {
  n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize',
  s: 's-resize', sw: 'sw-resize', w: 'w-resize', nw: 'nw-resize',
};

const POSITION_MAP: Record<ResizeDirection, React.CSSProperties> = {
  n:  { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' },
  ne: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  e:  { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' },
  se: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  s:  { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' },
  sw: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  w:  { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' },
  nw: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
};

export function ResizeHandle({ direction, controlId }: ResizeHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const { controls, gridSize, resizeControl } = useDesignerStore.getState();
    const control = controls.find((c) => c.id === controlId);
    if (!control) return;

    // 변경 전 스냅샷 저장
    useHistoryStore.getState().pushSnapshot(createSnapshot());

    const startPos = { ...control.position };
    const startSize = { ...control.size };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = startPos.x;
      let newY = startPos.y;
      let newWidth = startSize.width;
      let newHeight = startSize.height;

      if (direction.includes('e')) newWidth = Math.max(MIN_SIZE, startSize.width + deltaX);
      if (direction.includes('w')) {
        newWidth = Math.max(MIN_SIZE, startSize.width - deltaX);
        newX = startPos.x + startSize.width - newWidth;
      }
      if (direction.includes('s')) newHeight = Math.max(MIN_SIZE, startSize.height + deltaY);
      if (direction.includes('n')) {
        newHeight = Math.max(MIN_SIZE, startSize.height - deltaY);
        newY = startPos.y + startSize.height - newHeight;
      }

      const snappedSize = {
        width: snapToGrid(newWidth, gridSize),
        height: snapToGrid(newHeight, gridSize),
      };
      const snappedPos = snapPositionToGrid({ x: newX, y: newY }, gridSize);

      resizeControl(controlId, snappedSize, snappedPos);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="resize-handle"
      style={{
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        backgroundColor: '#fff',
        border: '1px solid #0078D7',
        cursor: CURSOR_MAP[direction],
        zIndex: 10,
        boxSizing: 'border-box',
        ...POSITION_MAP[direction],
      }}
      onMouseDown={handleMouseDown}
    />
  );
}
