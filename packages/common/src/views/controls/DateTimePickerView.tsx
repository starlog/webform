import type { CSSProperties } from 'react';
import { textInputBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface DateTimePickerViewProps {
  value?: string;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function DateTimePickerView({
  value = '',
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: DateTimePickerViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('DateTimePicker', { backColor, foreColor });

  return (
    <input
      type="date"
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
      onChange={interactive ? onChange : undefined}
    />
  );
}
