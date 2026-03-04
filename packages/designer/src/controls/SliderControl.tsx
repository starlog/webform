import { SliderView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function SliderControl({ properties, size }: DesignerControlProps) {
  return (
    <SliderView
      value={(properties.value as number) ?? 0}
      minimum={(properties.minimum as number) ?? 0}
      maximum={(properties.maximum as number) ?? 100}
      step={(properties.step as number) ?? 1}
      orientation={(properties.orientation as string) ?? 'Horizontal'}
      showValue={(properties.showValue as boolean) ?? true}
      trackColor={properties.trackColor as string | undefined}
      fillColor={properties.fillColor as string | undefined}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
