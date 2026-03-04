import { AvatarView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function AvatarControl({ properties, size }: DesignerControlProps) {
  return (
    <AvatarView
      imageUrl={(properties.imageUrl as string) ?? ''}
      text={(properties.text as string) ?? 'U'}
      shape={(properties.shape as string) ?? 'Circle'}
      backColor={(properties.backColor as string) ?? '#1677ff'}
      foreColor={(properties.foreColor as string) ?? '#ffffff'}
      style={{ width: size.width, height: size.height }}
    />
  );
}
