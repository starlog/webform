import type { CSSProperties } from 'react';
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
    width: size.width,
    height: size.height,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    background: colors.background,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: colors.color,
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
