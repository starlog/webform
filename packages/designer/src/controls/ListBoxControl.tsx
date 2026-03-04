import { ListBoxView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function ListBoxControl({ properties, size }: DesignerControlProps) {
  return (
    <ListBoxView
      items={(properties.items as string[]) ?? []}
      selectedIndex={(properties.selectedIndex as number) ?? -1}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
