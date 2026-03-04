import type { CSSProperties, ReactNode } from 'react';
import { DividerView } from '@webform/common/views';

interface DividerProps {
  id: string;
  name: string;
  text?: string;
  orientation?: 'Horizontal' | 'Vertical';
  textAlign?: 'Left' | 'Center' | 'Right';
  lineStyle?: 'Solid' | 'Dashed' | 'Dotted';
  lineColor?: string;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Divider({
  id, text, orientation = 'Horizontal', textAlign = 'Center',
  lineStyle = 'Solid', lineColor, foreColor, backColor, style,
}: DividerProps) {
  return (
    <DividerView
      text={text}
      orientation={orientation}
      textAlign={textAlign}
      lineStyle={lineStyle}
      lineColor={lineColor}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-divider"
      data-control-id={id}
      style={style}
    />
  );
}
