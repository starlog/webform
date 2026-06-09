import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, Ref } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface SplitContainerViewProps {
  orientation?: 'Horizontal' | 'Vertical';
  /** Panel1 크기(px). Vertical이면 너비, Horizontal이면 높이 */
  splitterDistance: number;
  splitterWidth?: number;
  isSplitterFixed?: boolean;
  backColor?: string;
  panel1?: ReactNode;
  panel2?: ReactNode;
  interactive?: boolean;
  onSplitterMouseDown?: (e: ReactMouseEvent) => void;
  containerRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function SplitContainerView({
  orientation = 'Vertical',
  splitterDistance,
  splitterWidth = 4,
  isSplitterFixed = false,
  backColor,
  panel1,
  panel2,
  interactive = false,
  onSplitterMouseDown,
  containerRef,
  style,
  className,
  'data-control-id': dataControlId,
}: SplitContainerViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('SplitContainer', { backColor });
  const isVertical = orientation === 'Vertical';
  const draggable = interactive && !isSplitterFixed;

  const rootStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isVertical ? 'row' : 'column',
    background: colors.background,
    border: theme.controls.panel.border,
    boxSizing: 'border-box',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div ref={containerRef} className={className} data-control-id={dataControlId} style={rootStyle}>
      {/* Panel1 */}
      <div
        style={{
          ...(isVertical ? { width: splitterDistance } : { height: splitterDistance }),
          flexShrink: 0,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {panel1}
      </div>

      {/* Splitter */}
      <div
        onMouseDown={draggable ? onSplitterMouseDown : undefined}
        style={{
          ...(isVertical
            ? { width: splitterWidth, cursor: draggable ? 'col-resize' : 'default' }
            : { height: splitterWidth, cursor: draggable ? 'row-resize' : 'default' }),
          backgroundColor: theme.controls.toolStrip.separator,
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
        {panel2}
      </div>
    </div>
  );
}
