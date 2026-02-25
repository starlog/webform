import { useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import { useControlColors } from '../theme/useControlColors';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TooltipProps {
  id: string;
  name: string;
  title?: string;
  placement?: 'Top' | 'Bottom' | 'Left' | 'Right' | 'TopLeft' | 'TopRight' | 'BottomLeft' | 'BottomRight';
  trigger?: 'Hover' | 'Click' | 'Focus';
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onVisibleChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
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

export function Tooltip({
  id,
  title = 'Tooltip text',
  placement = 'Top',
  trigger = 'Hover',
  backColor,
  foreColor,
  style,
  onVisibleChanged,
  children,
}: TooltipProps) {
  useControlColors('Tooltip', { backColor, foreColor });
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const [isVisible, setIsVisible] = useState(false);

  const setVisibility = useCallback(
    (visible: boolean) => {
      setIsVisible(visible);
      updateControlState(id, 'tooltipVisible', visible);
      onVisibleChanged?.();
    },
    [id, updateControlState, onVisibleChanged],
  );

  const show = () => setVisibility(true);
  const hide = () => setVisibility(false);
  const toggle = () => setVisibility(!isVisible);

  const triggerProps: Record<string, () => void> = {};
  if (trigger === 'Hover') {
    triggerProps.onMouseEnter = show;
    triggerProps.onMouseLeave = hide;
  } else if (trigger === 'Click') {
    triggerProps.onClick = toggle;
  } else if (trigger === 'Focus') {
    triggerProps.onFocus = show;
    triggerProps.onBlur = hide;
  }

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

  return (
    <div
      className="wf-tooltip"
      data-control-id={id}
      style={{ position: 'relative', ...style }}
      {...triggerProps}
    >
      {children}
      {isVisible && title && <div style={popupStyle}>{title}</div>}
    </div>
  );
}
