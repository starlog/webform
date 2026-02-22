import type { CSSProperties, ReactNode } from 'react';

interface LabelProps {
  id: string;
  name: string;
  text?: string;
  foreColor?: string;
  textAlign?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  boxSizing: 'border-box',
  userSelect: 'none',
};

export function Label({ id, text, foreColor, textAlign, style }: LabelProps) {
  const colorStyle: CSSProperties = {};
  if (foreColor) colorStyle.color = foreColor;
  if (textAlign) colorStyle.textAlign = textAlign as CSSProperties['textAlign'];

  return (
    <span
      className="wf-label"
      data-control-id={id}
      style={{ ...baseStyle, ...colorStyle, ...style }}
    >
      {text}
    </span>
  );
}
