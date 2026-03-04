import { ButtonView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function ButtonControl({ properties, size }: DesignerControlProps) {
  return (
    <ButtonView
      text={(properties.text as string) ?? 'Button'}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
