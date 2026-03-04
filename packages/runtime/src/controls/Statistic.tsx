import type { CSSProperties, ReactNode } from 'react';
import { StatisticView } from '@webform/common/views';

interface StatisticProps {
  id: string;
  name: string;
  title?: string;
  value?: string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  showGroupSeparator?: boolean;
  valueColor?: string;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Statistic({
  id, title = 'Statistic', value = '0', prefix = '', suffix = '',
  precision = 0, showGroupSeparator = true, valueColor, foreColor, backColor, style,
}: StatisticProps) {
  return (
    <StatisticView
      title={title}
      value={value}
      prefix={prefix}
      suffix={suffix}
      precision={precision}
      showGroupSeparator={showGroupSeparator}
      valueColor={valueColor}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-statistic"
      data-control-id={id}
      style={style}
    />
  );
}
