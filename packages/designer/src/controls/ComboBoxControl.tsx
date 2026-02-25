import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function ComboBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;
  const displayText = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : '';

  const arrowWidth = 17;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: theme.controls.select.border,
      borderRadius: theme.controls.select.borderRadius,
    }}>
      <div style={{
        flex: 1,
        backgroundColor: (properties.backColor as string) || theme.controls.select.background,
        color: (properties.foreColor as string) || theme.controls.select.foreground,
        padding: '1px 2px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
      }}>
        {displayText}
      </div>
      <div style={{
        width: arrowWidth,
        backgroundColor: theme.controls.button.background,
        borderLeft: theme.controls.select.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
      }}>
        {'\u25BC'}
      </div>
    </div>
  );
}
