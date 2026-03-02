import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function ComboBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;
  const colors = useControlColors('ComboBox', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const baseStyle: CSSProperties = {
    width: size.width,
    height: size.height,
    background: colors.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    color: colors.color,
    padding: '2px 4px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  return (
    <select
      disabled
      value={selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : ''}
      style={baseStyle}
    >
      {items.map((item, i) => (
        <option key={i} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
