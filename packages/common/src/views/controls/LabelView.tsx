import type { CSSProperties } from 'react';
import { labelBaseStyle } from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface LabelViewProps {
  text?: string;
  textAlign?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function LabelView({
  text = 'Label',
  textAlign,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: LabelViewProps) {
  const colors = useViewControlColors('Label', { backColor, foreColor });

  return (
    <span
      className={className}
      data-control-id={dataControlId}
      style={{
        ...labelBaseStyle(colors, textAlign),
        ...style,
      }}
    >
      {text}
    </span>
  );
}
