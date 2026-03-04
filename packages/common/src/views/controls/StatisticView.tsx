import type { CSSProperties } from 'react';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface StatisticViewProps {
  title?: string;
  value?: string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  showGroupSeparator?: boolean;
  valueColor?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

function formatValue(val: string, precision: number, showGroupSeparator: boolean): string {
  const num = Number(val);
  if (isNaN(num)) return val;

  let formatted = precision > 0 ? num.toFixed(precision) : String(Math.round(num));

  if (showGroupSeparator) {
    const [intPart, decPart] = formatted.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = decPart ? `${withCommas}.${decPart}` : withCommas;
  }

  return formatted;
}

export function StatisticView({
  title = 'Statistic',
  value = '0',
  prefix = '',
  suffix = '',
  precision = 0,
  showGroupSeparator = true,
  valueColor,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: StatisticViewProps) {
  const colors = useViewControlColors('Statistic', { backColor, foreColor });
  const formattedValue = formatValue(value, precision, showGroupSeparator);

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        boxSizing: 'border-box',
        background: colors.background,
        color: colors.color,
        userSelect: 'none',
        ...style,
      }}
    >
      {title && (
        <div style={{ fontSize: '0.85em', opacity: 0.65, marginBottom: 4 }}>{title}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {prefix && <span style={{ fontSize: '0.85em' }}>{prefix}</span>}
        <span
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: valueColor || colors.color,
          }}
        >
          {formattedValue}
        </span>
        {suffix && <span style={{ fontSize: '0.85em' }}>{suffix}</span>}
      </div>
    </div>
  );
}
