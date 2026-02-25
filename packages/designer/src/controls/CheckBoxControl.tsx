import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function CheckBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'CheckBox';
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
        border: theme.controls.checkRadio.border,
        backgroundColor: checked ? theme.controls.checkRadio.checkedBackground : theme.controls.checkRadio.background,
        borderRadius: theme.controls.checkRadio.borderRadius,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
      }}>
        {checked ? '\u2713' : ''}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
