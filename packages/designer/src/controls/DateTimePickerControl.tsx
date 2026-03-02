import type { CSSProperties } from 'react';
import { textInputBaseStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function DateTimePickerControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as string) ?? '';
  const colors = useControlColors('DateTimePicker', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const baseStyle: CSSProperties = {
    ...textInputBaseStyle(theme, colors),
    width: size.width,
    height: size.height,
    pointerEvents: 'none',
  };

  return (
    <input
      type="date"
      readOnly
      value={value}
      style={baseStyle}
    />
  );
}
