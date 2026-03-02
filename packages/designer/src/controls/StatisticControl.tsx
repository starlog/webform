import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

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

export function StatisticControl({ properties, size }: DesignerControlProps) {
  const title = (properties.title as string) ?? 'Statistic';
  const value = (properties.value as string) ?? '0';
  const prefix = (properties.prefix as string) ?? '';
  const suffix = (properties.suffix as string) ?? '';
  const precision = (properties.precision as number) ?? 0;
  const showGroupSeparator = (properties.showGroupSeparator as boolean) ?? true;
  const valueColor = (properties.valueColor as string) ?? '';
  const colors = useControlColors('Statistic', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const formattedValue = formatValue(value, precision, showGroupSeparator);

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        boxSizing: 'border-box',
        background: colors.background,
        color: colors.color,
        userSelect: 'none',
      }}
    >
      {title && (
        <div style={{ fontSize: '0.85em', opacity: 0.65, marginBottom: 4 }}>{title}</div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
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
