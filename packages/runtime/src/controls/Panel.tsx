import type { CSSProperties, ReactNode } from 'react';
import { panelBaseStyle } from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface PanelProps {
  id: string;
  name: string;
  borderStyle?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Panel({ id, borderStyle, backColor, foreColor, style, children }: PanelProps) {
  const theme = useTheme();
  const colors = useControlColors('Panel', { backColor, foreColor });

  return (
    <div
      className="wf-panel"
      data-control-id={id}
      style={{
        ...panelBaseStyle(theme, colors, borderStyle),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
