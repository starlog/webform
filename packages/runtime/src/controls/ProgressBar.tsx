import type { CSSProperties, ReactNode } from 'react';

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

const containerStyle: CSSProperties = {
  boxSizing: 'border-box',
  border: '1px solid #ADB2B5',
  backgroundColor: '#E6E6E6',
  overflow: 'hidden',
};

export function ProgressBar({
  id,
  value = 0,
  minimum = 0,
  maximum = 100,
  style,
}: ProgressBarProps) {
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
          backgroundColor: '#06B025',
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  );
}
