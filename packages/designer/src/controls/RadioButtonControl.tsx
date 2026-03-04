import { RadioButtonView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function RadioButtonControl({ properties, size }: DesignerControlProps) {
  return (
    <RadioButtonView
      text={(properties.text as string) ?? 'RadioButton'}
      checked={(properties.checked as boolean) ?? false}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
