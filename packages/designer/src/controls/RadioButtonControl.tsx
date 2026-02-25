import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function RadioButtonControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'RadioButton';
  const checked = (properties.checked as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      color: (properties.foreColor as string) || theme.form.foreground,
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        border: theme.controls.checkRadio.border,
        backgroundColor: checked ? theme.controls.checkRadio.checkedBackground : theme.controls.checkRadio.background,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {checked && (
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: theme.accent.primary,
          }} />
        )}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
