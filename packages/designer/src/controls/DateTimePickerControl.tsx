import { DateTimePickerView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function DateTimePickerControl({ properties, size }: DesignerControlProps) {
  return (
    <DateTimePickerView
      value={(properties.value as string) ?? ''}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
