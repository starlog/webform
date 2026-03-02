import { listBoxBaseStyle, listBoxItemStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function ListBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;
  const colors = useControlColors('ListBox', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  return (
    <div style={{
      ...listBoxBaseStyle(theme, colors),
      width: size.width,
      height: size.height,
    }}>
      {items.map((item, i) => (
        <div key={i} style={listBoxItemStyle(theme, i === selectedIndex)}>
          {item}
        </div>
      ))}
    </div>
  );
}
