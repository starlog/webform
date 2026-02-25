import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function GroupBoxControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'GroupBox';

  return (
    <fieldset style={{
      width: size.width,
      height: size.height,
      border: `1px solid ${theme.controls.groupBox.border}`,
      borderRadius: theme.controls.groupBox.borderRadius,
      margin: 0,
      padding: 0,
      position: 'relative',
      boxSizing: 'border-box',
      fontSize: 'inherit',
      fontFamily: 'inherit',
    }}>
      <legend style={{
        padding: '0 4px',
        fontSize: 'inherit',
        color: (properties.foreColor as string) ?? theme.controls.groupBox.foreground,
        marginLeft: 8,
      }}>
        {text}
      </legend>
      {children}
    </fieldset>
  );
}
