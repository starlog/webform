import { buttonBaseStyle } from '@webform/common';
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
      ...buttonBaseStyle(theme, colors),
      width: size.width,
      height: size.height,
      cursor: 'default',
      pointerEvents: 'none',
    }}>
      {text}
    </button>
  );
}
