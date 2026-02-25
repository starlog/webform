import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

function formatValue(value: string, precision: number, showGroupSeparator: boolean): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  const fixed = num.toFixed(precision);
  if (!showGroupSeparator) return fixed;

  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

export function StatisticControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();

  const title = (properties.title as string) ?? 'Statistic';
  const value = (properties.value as string) ?? '0';
  const prefix = (properties.prefix as string) ?? '';
  const suffix = (properties.suffix as string) ?? '';
  const precision = (properties.precision as number) ?? 0;
  const showGroupSeparator = (properties.showGroupSeparator as boolean) ?? true;
  const valueColor = (properties.valueColor as string) ?? '';
  const foreColor = (properties.foreColor as string) ?? '';

  const displayValue = formatValue(value, precision, showGroupSeparator);
  const valueStyle = valueColor || foreColor || theme.form.foreground;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: 8,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: foreColor || theme.form.foreground,
          opacity: 0.6,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
        {prefix && <span style={{ fontSize: 14, color: valueStyle }}>{prefix}</span>}
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: valueStyle,
          }}
        >
          {displayValue}
        </span>
        {suffix && <span style={{ fontSize: 14, color: valueStyle }}>{suffix}</span>}
      </div>
    </div>
  );
}
