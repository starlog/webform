import { StatusStripView, type StatusStripItem } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

const DEFAULT_ITEMS: StatusStripItem[] = [
  { type: 'label', text: '준비', spring: true },
];

export function StatusStripControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as StatusStripItem[]) ?? [];
  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <StatusStripView
      items={displayItems}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
