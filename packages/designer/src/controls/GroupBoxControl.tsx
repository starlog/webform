import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import type { DesignerControlProps } from './registry';

export function GroupBoxControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? 'GroupBox';
  const colors = useControlColors('GroupBox', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <fieldset style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: theme.controls.groupBox.border,
        borderRadius: theme.controls.groupBox.borderRadius,
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}>
        {text && (
          <legend style={{
            padding: '0 4px',
            fontSize: 'inherit',
            color: colors.color,
            marginLeft: 8,
          }}>
            {text}
          </legend>
        )}
      </fieldset>
      {children}
    </div>
  );
}
