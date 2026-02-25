import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function SwitchControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const checked = (properties.checked as boolean) ?? false;
  const text = (properties.text as string) ?? '';
  const onText = (properties.onText as string) ?? 'ON';
  const offText = (properties.offText as string) ?? 'OFF';
  const onColor = (properties.onColor as string) || '#1677ff';
  const offColor = (properties.offColor as string) || '#00000040';

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        color: (properties.foreColor as string) || theme.form.foreground,
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {text && (
        <span
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {text}
        </span>
      )}
      <div
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          backgroundColor: checked ? onColor : offColor,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: checked ? 'flex-start' : 'flex-end',
          padding: '0 5px',
          fontSize: 9,
          color: 'white',
        }}
      >
        <span>{checked ? onText : offText}</span>
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  );
}
