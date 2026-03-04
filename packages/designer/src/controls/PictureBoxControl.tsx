import { PictureBoxView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function PictureBoxControl({ properties, size }: DesignerControlProps) {
  return (
    <PictureBoxView
      imageUrl={properties.imageUrl as string | undefined}
      sizeMode={(properties.sizeMode as string) ?? 'Normal'}
      borderStyle={properties.borderStyle as string | undefined}
      backColor={properties.backColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
