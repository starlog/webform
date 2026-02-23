import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface SplitContainerProps {
  id: string;
  name: string;
  orientation?: 'Horizontal' | 'Vertical';
  splitterDistance?: number;
  splitterWidth?: number;
  fixedPanel?: 'None' | 'Panel1' | 'Panel2';
  isSplitterFixed?: boolean;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onSplitterMoved?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function SplitContainer({
  id,
  orientation = 'Vertical',
  splitterDistance: initialDistance,
  splitterWidth = 4,
  isSplitterFixed = false,
  backColor,
  style,
  onSplitterMoved,
  children,
}: SplitContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const [distance, setDistance] = useState<number | null>(null);
  const isVertical = orientation === 'Vertical';

  const childArr = Array.isArray(children) ? children : children ? [children] : [];

  const getContainerSize = useCallback(() => {
    if (!containerRef.current) return 0;
    return isVertical ? containerRef.current.offsetWidth : containerRef.current.offsetHeight;
  }, [isVertical]);

  const effectiveDistance = distance ?? initialDistance ?? (Math.round(getContainerSize() / 2) || 150);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isSplitterFixed) return;
      e.preventDefault();

      const startPos = isVertical ? e.clientX : e.clientY;
      const startDistance = effectiveDistance;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = (isVertical ? moveEvent.clientX : moveEvent.clientY) - startPos;
        const containerSize = getContainerSize();
        const newDistance = Math.max(20, Math.min(containerSize - splitterWidth - 20, startDistance + delta));
        setDistance(newDistance);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        updateControlState(id, 'splitterDistance', distance ?? startDistance);
        onSplitterMoved?.();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [id, isVertical, effectiveDistance, isSplitterFixed, splitterWidth, getContainerSize, updateControlState, onSplitterMoved, distance],
  );

  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: isVertical ? 'row' : 'column',
    backgroundColor: backColor || '#F0F0F0',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div ref={containerRef} data-control-id={id} style={containerStyle}>
      {/* Panel1 */}
      <div
        style={{
          ...(isVertical ? { width: effectiveDistance } : { height: effectiveDistance }),
          flexShrink: 0,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {childArr[0] ?? null}
      </div>

      {/* Splitter */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          ...(isVertical
            ? { width: splitterWidth, cursor: isSplitterFixed ? 'default' : 'col-resize' }
            : { height: splitterWidth, cursor: isSplitterFixed ? 'default' : 'row-resize' }),
          backgroundColor: '#C0C0C0',
          flexShrink: 0,
          userSelect: 'none',
        }}
      />

      {/* Panel2 */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {childArr[1] ?? null}
      </div>
    </div>
  );
}
