import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function ProgressBarControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const percent = maximum > minimum
    ? ((value - minimum) / (maximum - minimum)) * 100
    : 0;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: (properties.backColor as string) || theme.controls.progressBar.background,
      border: theme.controls.progressBar.border,
      borderRadius: theme.controls.progressBar.borderRadius,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, percent))}%`,
        height: '100%',
        backgroundColor: theme.controls.progressBar.fillBackground,
        transition: 'width 0.2s',
      }} />
    </div>
  );
}
