import { useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import { TooltipView } from '@webform/common/views';
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

export function Tooltip({
  id, title = 'Tooltip text', placement = 'Top', trigger = 'Hover',
  backColor, foreColor, style, onVisibleChanged, children,
}: TooltipProps) {
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

  return (
    <TooltipView
      title={title}
      placement={placement}
      isVisible={isVisible}
      backColor={backColor}
      foreColor={foreColor}
      triggerProps={triggerProps}
      className="wf-tooltip"
      data-control-id={id}
      style={style}
    >
      {children}
    </TooltipView>
  );
}
