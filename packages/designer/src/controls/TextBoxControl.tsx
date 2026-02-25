import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function TextBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? '';
  const multiline = (properties.multiline as boolean) ?? false;
  const passwordChar = (properties.passwordChar as string) ?? '';
  const displayText = passwordChar && text ? passwordChar.repeat(text.length) : text;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: (properties.backColor as string) || theme.controls.textInput.background,
      border: theme.controls.textInput.border,
      borderRadius: theme.controls.textInput.borderRadius,
      padding: theme.controls.textInput.padding,
      fontSize: 'inherit',
      fontFamily: 'inherit',
      overflow: 'hidden',
      whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
      color: (properties.foreColor as string) || theme.controls.textInput.foreground,
      boxSizing: 'border-box',
    }}>
      {displayText}
    </div>
  );
}
