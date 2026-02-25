import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';

interface ProgressBarProps {
  id: string;
  name: string;
  value?: number;
  minimum?: number;
  maximum?: number;
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
  style,
}: ProgressBarProps) {
  const theme = useTheme();

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    border: theme.controls.progressBar.border,
    borderRadius: theme.controls.progressBar.borderRadius,
    backgroundColor: theme.controls.progressBar.background,
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
