import { TagView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function TagControl({ properties, size }: DesignerControlProps) {
  return (
    <TagView
      tags={(properties.tags as string[]) ?? ['Tag1', 'Tag2']}
      tagColor={(properties.tagColor as string) ?? 'Default'}
      closable={(properties.closable as boolean) ?? false}
      addable={(properties.addable as boolean) ?? false}
      style={{ width: size.width, height: size.height }}
    />
  );
}
