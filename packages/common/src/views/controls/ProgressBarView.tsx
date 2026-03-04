import type { CSSProperties } from 'react';
import {
  progressBarContainerStyle,
  progressBarFillStyle,
  computePercent,
} from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ProgressBarViewProps {
  value?: number;
  minimum?: number;
  maximum?: number;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function ProgressBarView({
  value = 0,
  minimum = 0,
  maximum = 100,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: ProgressBarViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('ProgressBar', { backColor, foreColor });
  const percent = computePercent(value, minimum, maximum);

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{ ...progressBarContainerStyle(theme, colors), ...style }}
    >
      <div style={progressBarFillStyle(theme, percent)} />
    </div>
  );
}
