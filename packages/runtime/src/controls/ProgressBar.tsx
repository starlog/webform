import type { CSSProperties, ReactNode } from 'react';
import { progressBarContainerStyle, progressBarFillStyle, computePercent } from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface ProgressBarProps {
  id: string;
  name: string;
  value?: number;
  minimum?: number;
  maximum?: number;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function ProgressBar({
  id,
  value = 0,
  minimum = 0,
  maximum = 100,
  backColor,
  foreColor,
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const colors = useControlColors('ProgressBar', { backColor, foreColor });

  const percent = computePercent(value, minimum, maximum);

  return (
    <div
      className="wf-progressbar"
      data-control-id={id}
      style={{ ...progressBarContainerStyle(theme, colors), ...style }}
    >
      <div style={progressBarFillStyle(theme, percent)} />
    </div>
  );
}
