import type { CSSProperties, ReactNode } from 'react';

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
  const panelBorder: CSSProperties = {};
  if (borderStyle === 'FixedSingle') {
    panelBorder.border = '1px solid #888888';
  } else if (borderStyle === 'Fixed3D') {
    panelBorder.border = '2px inset #D0D0D0';
  }

  return (
    <div
      className="wf-panel"
      data-control-id={id}
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...panelBorder,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
