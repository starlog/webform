import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function NumericUpDownControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as number) ?? 0;
  const arrowWidth = 17;

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
        padding: theme.controls.textInput.padding,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
      }}>
        {value}
      </div>
      <div style={{
        width: arrowWidth,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: theme.controls.textInput.border,
      }}>
        <div style={{
          flex: 1,
          backgroundColor: theme.controls.button.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
          borderBottom: theme.controls.textInput.border,
        }}>
          {'\u25B2'}
        </div>
        <div style={{
          flex: 1,
          backgroundColor: theme.controls.button.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
        }}>
          {'\u25BC'}
        </div>
      </div>
    </div>
  );
}
