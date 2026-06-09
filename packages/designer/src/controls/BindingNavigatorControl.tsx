import { BindingNavigatorView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function BindingNavigatorControl({ properties, size }: DesignerControlProps) {
  return (
    <BindingNavigatorView
      showAddButton={(properties.showAddButton as boolean) ?? true}
      showDeleteButton={(properties.showDeleteButton as boolean) ?? true}
      backColor={properties.backColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
