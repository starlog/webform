import { AlertView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function AlertControl({ properties, size }: DesignerControlProps) {
  return (
    <AlertView
      message={(properties.message as string) ?? 'Alert message'}
      description={(properties.description as string) ?? ''}
      alertType={(properties.alertType as string) ?? 'Info'}
      showIcon={(properties.showIcon as boolean) ?? true}
      closable={(properties.closable as boolean) ?? false}
      banner={(properties.banner as boolean) ?? false}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
