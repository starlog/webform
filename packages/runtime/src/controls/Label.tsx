import type { CSSProperties, ReactNode } from 'react';
import { labelBaseStyle } from '@webform/common';
import { useControlColors } from '../theme/useControlColors';

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
  const colors = useControlColors('Label', { backColor, foreColor });

  return (
    <span
      className="wf-label"
      data-control-id={id}
      style={{
        ...labelBaseStyle(colors, textAlign),
        ...style,
      }}
    >
      {text}
    </span>
  );
}
