import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function ButtonControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'Button';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: (properties.backColor as string) || theme.controls.button.background,
      border: theme.controls.button.border,
      borderRadius: theme.controls.button.borderRadius,
      color: (properties.foreColor as string) || theme.controls.button.foreground,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
