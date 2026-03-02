import type { CSSProperties } from 'react';
import { comboBoxBaseStyle } from '@webform/common';
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
    ...comboBoxBaseStyle(theme, colors),
    width: size.width,
    height: size.height,
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
