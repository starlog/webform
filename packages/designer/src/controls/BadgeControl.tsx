import { BadgeView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function BadgeControl({ properties, size }: DesignerControlProps) {
  return (
    <BadgeView
      count={(properties.count as number) ?? 0}
      overflowCount={(properties.overflowCount as number) ?? 99}
      showZero={(properties.showZero as boolean) ?? false}
      dot={(properties.dot as boolean) ?? false}
      status={(properties.status as string) ?? 'Default'}
      text={(properties.text as string) ?? ''}
      badgeColor={(properties.badgeColor as string) ?? ''}
      style={{ width: size.width, height: size.height }}
    />
  );
}
