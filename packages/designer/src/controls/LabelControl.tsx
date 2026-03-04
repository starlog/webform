import { LabelView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function LabelControl({ properties, size }: DesignerControlProps) {
  return (
    <LabelView
      text={(properties.text as string) ?? 'Label'}
      textAlign={properties.textAlign as string | undefined}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
