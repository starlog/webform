import { DividerView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function DividerControl({ properties, size }: DesignerControlProps) {
  return (
    <DividerView
      text={(properties.text as string) ?? ''}
      orientation={(properties.orientation as string) ?? 'Horizontal'}
      textAlign={(properties.textAlign as string) ?? 'Center'}
      lineStyle={(properties.lineStyle as string) ?? 'Solid'}
      lineColor={properties.lineColor as string | undefined}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
