import { StatisticView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function StatisticControl({ properties, size }: DesignerControlProps) {
  return (
    <StatisticView
      title={(properties.title as string) ?? 'Statistic'}
      value={(properties.value as string) ?? '0'}
      prefix={(properties.prefix as string) ?? ''}
      suffix={(properties.suffix as string) ?? ''}
      precision={(properties.precision as number) ?? 0}
      showGroupSeparator={(properties.showGroupSeparator as boolean) ?? true}
      valueColor={(properties.valueColor as string) ?? ''}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
