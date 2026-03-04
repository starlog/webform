import type { CSSProperties, ReactNode } from 'react';

export interface TooltipViewProps {
  title?: string;
  placement?: string;
  isVisible?: boolean;
  backColor?: string;
  foreColor?: string;
  children?: ReactNode;
  triggerProps?: Record<string, () => void>;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

const PLACEMENT_STYLES: Record<string, CSSProperties> = {
  Top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
  Bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
  Left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
  Right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
  TopLeft: { bottom: '100%', left: 0, marginBottom: 8 },
  TopRight: { bottom: '100%', right: 0, marginBottom: 8 },
  BottomLeft: { top: '100%', left: 0, marginTop: 8 },
  BottomRight: { top: '100%', right: 0, marginTop: 8 },
};

export function TooltipView({
  title = 'Tooltip text',
  placement = 'Top',
  isVisible = false,
  backColor,
  foreColor,
  children,
  triggerProps,
  style,
  className,
  'data-control-id': dataControlId,
}: TooltipViewProps) {
  const resolvedBgColor = backColor || 'rgba(0,0,0,0.85)';
  const resolvedFgColor = foreColor || '#fff';

  const popupStyle: CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: resolvedBgColor,
    color: resolvedFgColor,
    padding: '6px 8px',
    borderRadius: 6,
    fontSize: '0.85em',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    ...(PLACEMENT_STYLES[placement] || PLACEMENT_STYLES.Top),
  };

  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{ position: 'relative', ...style }}
      {...triggerProps}
    >
      {hasChildren ? (
        children
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: '1px dashed gray',
            minHeight: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'gray',
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
        >
          [Tooltip] {title}
        </div>
      )}
      {isVisible && title && <div style={popupStyle}>{title}</div>}
    </div>
  );
}
