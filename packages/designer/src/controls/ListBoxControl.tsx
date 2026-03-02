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
      width: size.width,
      height: size.height,
      background: colors.background,
      border: theme.controls.select.border,
      borderRadius: theme.controls.select.borderRadius,
      color: colors.color,
      overflow: 'auto',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '1px 4px',
            backgroundColor: i === selectedIndex ? theme.controls.select.selectedBackground : 'transparent',
            color: i === selectedIndex ? theme.controls.select.selectedForeground : theme.controls.select.foreground,
            userSelect: 'none',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
