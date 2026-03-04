import type { CSSProperties } from 'react';
import { textInputBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface NumericUpDownViewProps {
  value?: number;
  minimum?: number;
  maximum?: number;
  increment?: number;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function NumericUpDownView({
  value = 0,
  minimum = 0,
  maximum = 100,
  increment = 1,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: NumericUpDownViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('NumericUpDown', { backColor, foreColor });

  return (
    <input
      type="number"
      className={className}
      data-control-id={dataControlId}
      style={{
        ...textInputBaseStyle(theme, colors),
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
      }}
      readOnly={!interactive}
      disabled={disabled}
      value={value}
      min={minimum}
      max={maximum}
      step={increment}
      onChange={interactive ? onChange : undefined}
    />
  );
}
