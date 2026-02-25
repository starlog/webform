import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function DateTimePickerControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const format = (properties.format as string) ?? 'Short';
  const displayText = format === 'Long'
    ? '2026\uB144 2\uC6D4 22\uC77C \uC77C\uC694\uC77C'
    : '2026-02-22';
  const arrowWidth = 21;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: theme.controls.textInput.border,
      borderRadius: theme.controls.textInput.borderRadius,
    }}>
      <div style={{
        flex: 1,
        backgroundColor: (properties.backColor as string) || theme.controls.textInput.background,
        color: (properties.foreColor as string) || theme.controls.textInput.foreground,
        padding: '1px 4px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}>
        {displayText}
      </div>
      <div style={{
        width: arrowWidth,
        backgroundColor: theme.controls.button.background,
        borderLeft: theme.controls.textInput.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
      }}>
        {'\u25BC'}
      </div>
    </div>
  );
}
