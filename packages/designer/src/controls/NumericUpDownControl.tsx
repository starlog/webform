import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function NumericUpDownControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const increment = (properties.increment as number) ?? 1;
  const colors = useControlColors('NumericUpDown', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const baseStyle: CSSProperties = {
    width: size.width,
    height: size.height,
    background: colors.background,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: colors.color,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  return (
    <input
      type="number"
      readOnly
      value={value}
      min={minimum}
      max={maximum}
      step={increment}
      style={baseStyle}
    />
  );
}
