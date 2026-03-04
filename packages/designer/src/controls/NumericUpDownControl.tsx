import { NumericUpDownView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function NumericUpDownControl({ properties, size }: DesignerControlProps) {
  return (
    <NumericUpDownView
      value={(properties.value as number) ?? 0}
      minimum={(properties.minimum as number) ?? 0}
      maximum={(properties.maximum as number) ?? 100}
      increment={(properties.increment as number) ?? 1}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
