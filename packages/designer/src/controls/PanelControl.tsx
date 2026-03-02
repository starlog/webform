import { panelBaseStyle } from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import type { DesignerControlProps } from './registry';

export function PanelControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();
  const colors = useControlColors('Panel', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });
  const borderStyle = (properties.borderStyle as string) ?? 'None';

  return (
    <div style={{
      ...panelBaseStyle(theme, colors, borderStyle),
      width: size.width,
      height: size.height,
    }}>
      {children}
    </div>
  );
}
