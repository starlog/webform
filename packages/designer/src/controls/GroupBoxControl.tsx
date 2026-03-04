import { GroupBoxView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function GroupBoxControl({ properties, size, children }: DesignerControlProps) {
  return (
    <GroupBoxView
      text={(properties.text as string) ?? 'GroupBox'}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    >
      {children}
    </GroupBoxView>
  );
}
