import type { CSSProperties, ReactNode } from 'react';
import { PanelView } from '@webform/common/views';

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
  return (
    <PanelView
      borderStyle={borderStyle}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-panel"
      data-control-id={id}
      style={style}
    >
      {children}
    </PanelView>
  );
}
