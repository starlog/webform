import type { CSSProperties, ReactNode } from 'react';
import { useControlColors } from '../theme/useControlColors';

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

export function Statistic({
  id,
  title = 'Statistic',
  value = '0',
  prefix = '',
  suffix = '',
  precision = 0,
  showGroupSeparator = true,
  valueColor,
  foreColor,
  backColor,
  style,
}: StatisticProps) {
  const colors = useControlColors('Statistic', { backColor, foreColor });

  const formattedValue = formatValue(value, precision, showGroupSeparator);

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    background: colors.background,
    color: colors.color,
    ...style,
  };

  return (
    <div className="wf-statistic" data-control-id={id} style={containerStyle}>
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
