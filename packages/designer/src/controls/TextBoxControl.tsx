import { TextBoxView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function TextBoxControl({ properties, size }: DesignerControlProps) {
  return (
    <TextBoxView
      text={(properties.text as string) ?? ''}
      multiline={(properties.multiline as boolean) ?? false}
      passwordChar={(properties.passwordChar as string) ?? ''}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
