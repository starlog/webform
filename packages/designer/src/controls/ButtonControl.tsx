import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function ButtonControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'Button';
  const colors = useControlColors('Button', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  return (
    <button style={{
      width: size.width,
      height: size.height,
      background: colors.background,
      border: theme.controls.button.border,
      padding: theme.controls.button.padding,
      borderRadius: theme.controls.button.borderRadius,
      color: colors.color,
      fontSize: 'inherit',
      fontFamily: 'inherit',
      textAlign: 'center',
      cursor: 'default',
      boxSizing: 'border-box',
      pointerEvents: 'none',
    }}>
      {text}
    </button>
  );
}
