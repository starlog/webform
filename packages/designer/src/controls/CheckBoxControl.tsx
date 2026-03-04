import { CheckBoxView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function CheckBoxControl({ properties, size }: DesignerControlProps) {
  return (
    <CheckBoxView
      text={(properties.text as string) ?? 'CheckBox'}
      checked={(properties.checked as boolean) ?? false}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
