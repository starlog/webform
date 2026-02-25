import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';

interface PanelProps {
  id: string;
  name: string;
  borderStyle?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Panel({ id, borderStyle, style, children }: PanelProps) {
  const theme = useTheme();

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
        borderRadius: theme.controls.panel.borderRadius,
        ...panelBorder,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
