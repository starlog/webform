import type { CSSProperties, ReactNode } from 'react';
import { BadgeView } from '@webform/common/views';

interface BadgeProps {
  id: string;
  name: string;
  count?: number;
  overflowCount?: number;
  showZero?: boolean;
  dot?: boolean;
  status?: 'Default' | 'Success' | 'Processing' | 'Error' | 'Warning';
  text?: string;
  badgeColor?: string;
  offset?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Badge({
  id, count = 0, overflowCount = 99, showZero = false, dot = false,
  status = 'Default', text = '', badgeColor, style,
}: BadgeProps) {
  return (
    <BadgeView
      count={count}
      overflowCount={overflowCount}
      showZero={showZero}
      dot={dot}
      status={status}
      text={text}
      badgeColor={badgeColor}
      className="wf-badge"
      data-control-id={id}
      style={style}
    />
  );
}
