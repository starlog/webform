import type { CSSProperties, ReactNode } from 'react';
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

  const panelBorder: CSSProperties = {};
  if (borderStyle === 'FixedSingle') {
    panelBorder.border = theme.controls.panel.border;
  } else if (borderStyle === 'Fixed3D') {
    panelBorder.border = theme.controls.panel.border;
  }

  return (
    <div
      className="wf-panel"
      data-control-id={id}
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: colors.backgroundColor,
        color: colors.color,
        borderRadius: theme.controls.panel.borderRadius,
        ...panelBorder,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
