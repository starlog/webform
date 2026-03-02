import { groupBoxFieldsetStyle, groupBoxLegendStyle } from '@webform/common';
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
      <fieldset style={groupBoxFieldsetStyle(theme)}>
        {text && (
          <legend style={groupBoxLegendStyle(colors)}>
            {text}
          </legend>
        )}
      </fieldset>
      {children}
    </div>
  );
}
