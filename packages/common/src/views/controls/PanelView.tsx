import type { CSSProperties, ReactNode } from 'react';
import { panelBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface PanelViewProps {
  borderStyle?: string;
  backColor?: string;
  foreColor?: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function PanelView({
  borderStyle,
  backColor,
  foreColor,
  children,
  style,
  className,
  'data-control-id': dataControlId,
}: PanelViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('Panel', { backColor, foreColor });

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        ...panelBaseStyle(theme, colors, borderStyle),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
