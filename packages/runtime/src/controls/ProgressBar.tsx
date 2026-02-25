import type { CSSProperties, ReactNode } from 'react';
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

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    border: theme.controls.progressBar.border,
    borderRadius: theme.controls.progressBar.borderRadius,
    backgroundColor: colors.backgroundColor,
    overflow: 'hidden',
  };

  const range = maximum - minimum || 1;
  const percent = Math.max(0, Math.min(100, ((value - minimum) / range) * 100));

  return (
    <div
      className="wf-progressbar"
      data-control-id={id}
      style={{ ...containerStyle, ...style }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: theme.controls.progressBar.fillBackground,
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  );
}
