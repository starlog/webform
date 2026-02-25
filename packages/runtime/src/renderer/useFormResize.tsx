import { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode, MouseEvent as ReactMouseEvent } from 'react';

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const EDGE_SIZE = 4;
const CORNER_SIZE = 8;

interface HandleDef {
  direction: ResizeDirection;
  style: CSSProperties;
}

const HANDLES: HandleDef[] = [
  {
    direction: 'n',
    style: {
      top: 0,
      left: CORNER_SIZE,
      right: CORNER_SIZE,
      height: EDGE_SIZE,
      cursor: 'n-resize',
    },
  },
  {
    direction: 's',
    style: {
      bottom: 0,
      left: CORNER_SIZE,
      right: CORNER_SIZE,
      height: EDGE_SIZE,
      cursor: 's-resize',
    },
  },
  {
    direction: 'e',
    style: {
      right: 0,
      top: CORNER_SIZE,
      bottom: CORNER_SIZE,
      width: EDGE_SIZE,
      cursor: 'e-resize',
    },
  },
  {
    direction: 'w',
    style: {
      left: 0,
      top: CORNER_SIZE,
      bottom: CORNER_SIZE,
      width: EDGE_SIZE,
      cursor: 'w-resize',
    },
  },
  {
    direction: 'nw',
    style: {
      top: 0,
      left: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      cursor: 'nw-resize',
    },
  },
  {
    direction: 'ne',
    style: {
      top: 0,
      right: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      cursor: 'ne-resize',
    },
  },
  {
    direction: 'se',
    style: {
      bottom: 0,
      right: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      cursor: 'se-resize',
    },
  },
  {
    direction: 'sw',
    style: {
      bottom: 0,
      left: 0,
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      cursor: 'sw-resize',
    },
  },
];

interface UseFormResizeOptions {
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  minHeight?: number;
  enabled: boolean;
}

export function useFormResize({
  initialWidth,
  initialHeight,
  minWidth = 200,
  minHeight = 150,
  enabled,
}: UseFormResizeOptions) {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    setSize({ width: initialWidth, height: initialHeight });
  }, [initialWidth, initialHeight]);

  const startDrag = useCallback(
    (direction: ResizeDirection, e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = sizeRef.current.width;
      const startH = sizeRef.current.height;

      const onMouseMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        let w = startW;
        let h = startH;

        if (direction === 'e' || direction === 'ne' || direction === 'se') {
          w = Math.max(minWidth, startW + dx);
        }
        if (direction === 'w' || direction === 'nw' || direction === 'sw') {
          w = Math.max(minWidth, startW - dx);
        }
        if (direction === 's' || direction === 'se' || direction === 'sw') {
          h = Math.max(minHeight, startH + dy);
        }
        if (direction === 'n' || direction === 'ne' || direction === 'nw') {
          h = Math.max(minHeight, startH - dy);
        }

        setSize({ width: w, height: h });
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [minWidth, minHeight],
  );

  if (!enabled) {
    return {
      width: initialWidth,
      height: initialHeight,
      resizeHandles: null as ReactNode,
    };
  }

  const handleBaseStyle: CSSProperties = {
    position: 'absolute',
    zIndex: 100,
  };

  const resizeHandles: ReactNode = (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.direction}
          style={{ ...handleBaseStyle, ...h.style }}
          onMouseDown={(e) => startDrag(h.direction, e)}
        />
      ))}
    </>
  );

  return {
    width: size.width,
    height: size.height,
    resizeHandles,
  };
}
