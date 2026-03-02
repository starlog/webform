import { progressBarContainerStyle, progressBarFillStyle, computePercent } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export function ProgressBarControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const colors = useControlColors('ProgressBar', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const percent = computePercent(value, minimum, maximum);

  return (
    <div style={{
      ...progressBarContainerStyle(theme, colors),
      width: size.width,
      height: size.height,
    }}>
      <div style={progressBarFillStyle(theme, percent)} />
    </div>
  );
}
