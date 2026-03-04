import { SwitchView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function SwitchControl({ properties, size }: DesignerControlProps) {
  return (
    <SwitchView
      checked={(properties.checked as boolean) ?? false}
      text={(properties.text as string) ?? ''}
      onText={(properties.onText as string) ?? ''}
      offText={(properties.offText as string) ?? ''}
      onColor={(properties.onColor as string) || undefined}
      offColor={(properties.offColor as string) || undefined}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
