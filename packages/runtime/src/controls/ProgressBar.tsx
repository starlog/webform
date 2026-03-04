import type { CSSProperties, ReactNode } from 'react';
import { ProgressBarView } from '@webform/common/views';

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
  id, value = 0, minimum = 0, maximum = 100, backColor, foreColor, style,
}: ProgressBarProps) {
  return (
    <ProgressBarView
      value={value}
      minimum={minimum}
      maximum={maximum}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-progressbar"
      data-control-id={id}
      style={style}
    />
  );
}
