import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function ListBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: (properties.backColor as string) || theme.controls.select.background,
      border: theme.controls.select.border,
      borderRadius: theme.controls.select.borderRadius,
      overflow: 'auto',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    }}>
      {items.length === 0 ? (
        <div style={{ padding: '2px 4px', color: '#999' }}>(항목 없음)</div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '1px 4px',
              backgroundColor: i === selectedIndex ? theme.controls.select.selectedBackground : 'transparent',
              color: i === selectedIndex ? theme.controls.select.selectedForeground : ((properties.foreColor as string) || theme.controls.select.foreground),
            }}
          >
            {item}
          </div>
        ))
      )}
    </div>
  );
}
