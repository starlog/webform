import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function LabelControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Label';
  const textAlign = (properties.textAlign as string) ?? 'TopLeft';
  const colors = useControlColors('Label', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const colorStyle: CSSProperties = {
    color: colors.color,
  };
  if (textAlign) colorStyle.textAlign = textAlign as CSSProperties['textAlign'];

  return (
    <span style={{
      width: size.width,
      height: size.height,
      display: 'inline-block',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      userSelect: 'none',
      boxSizing: 'border-box',
      ...colorStyle,
    }}>
      {text}
    </span>
  );
}
