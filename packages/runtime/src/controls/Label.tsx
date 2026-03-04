import type { CSSProperties, ReactNode } from 'react';
import { LabelView } from '@webform/common/views';

interface LabelProps {
  id: string;
  name: string;
  text?: string;
  backColor?: string;
  foreColor?: string;
  textAlign?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Label({ id, text, backColor, foreColor, textAlign, style }: LabelProps) {
  return (
    <LabelView
      text={text}
      textAlign={textAlign}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-label"
      data-control-id={id}
      style={style}
    />
  );
}
