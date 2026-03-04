import { PanelView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function PanelControl({ properties, size, children }: DesignerControlProps) {
  return (
    <PanelView
      borderStyle={(properties.borderStyle as string) ?? 'None'}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    >
      {children}
    </PanelView>
  );
}
