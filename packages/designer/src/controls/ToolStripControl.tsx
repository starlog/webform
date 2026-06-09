import { ToolStripView, type ToolStripItem } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

const DEFAULT_ITEMS: ToolStripItem[] = [
  { type: 'button', text: '새로 만들기', icon: '📄' },
  { type: 'button', text: '열기', icon: '📂' },
  { type: 'button', text: '저장', icon: '💾' },
  { type: 'separator' },
  { type: 'button', text: '잘라내기', icon: '✂' },
  { type: 'button', text: '복사', icon: '📋' },
  { type: 'button', text: '붙여넣기', icon: '📌' },
];

export function ToolStripControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as ToolStripItem[]) ?? [];
  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <ToolStripView
      items={displayItems}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
