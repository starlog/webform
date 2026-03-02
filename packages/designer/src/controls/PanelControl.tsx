import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function PanelControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();
  const borderStyle = (properties.borderStyle as string) ?? 'None';

  let border = 'none';
  if (borderStyle === 'FixedSingle') border = theme.controls.panel.border;
  else if (borderStyle === 'Fixed3D') border = theme.controls.panel.border;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      border,
      backgroundColor: (properties.backColor as string) ?? theme.controls.panel.background,
      borderRadius: theme.controls.panel.borderRadius,
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}
