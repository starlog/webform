import type { CSSProperties, ReactNode } from 'react';
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

  const colorStyle: CSSProperties = {
    color: colors.color,
  };
  if (textAlign) colorStyle.textAlign = textAlign as CSSProperties['textAlign'];

  return (
    <span
      className="wf-label"
      data-control-id={id}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        boxSizing: 'border-box',
        userSelect: 'none',
        ...colorStyle,
        ...style,
      }}
    >
      {text}
    </span>
  );
}
