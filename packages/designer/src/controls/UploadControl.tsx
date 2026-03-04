import { UploadView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function UploadControl({ properties, size }: DesignerControlProps) {
  return (
    <UploadView
      uploadMode={(properties.uploadMode as string) ?? 'DropZone'}
      text={(properties.text as string) ?? 'Click or drag file to upload'}
      borderStyle={(properties.borderStyle as string) ?? 'Dashed'}
      backColor={(properties.backColor as string) || undefined}
      foreColor={(properties.foreColor as string) || undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
