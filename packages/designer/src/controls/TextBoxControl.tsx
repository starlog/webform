import type { CSSProperties } from 'react';
import { textInputBaseStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function TextBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? '';
  const multiline = (properties.multiline as boolean) ?? false;
  const passwordChar = (properties.passwordChar as string) ?? '';
  const colors = useControlColors('TextBox', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const baseStyle: CSSProperties = {
    ...textInputBaseStyle(theme, colors),
    width: size.width,
    height: size.height,
    pointerEvents: 'none',
  };

  if (multiline) {
    return (
      <textarea
        readOnly
        value={text}
        style={{ ...baseStyle, resize: 'none' }}
      />
    );
  }

  const inputType = passwordChar ? 'password' : 'text';

  return (
    <input
      type={inputType}
      readOnly
      value={text}
      style={baseStyle}
    />
  );
}
