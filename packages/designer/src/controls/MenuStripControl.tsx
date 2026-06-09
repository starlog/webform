import { MenuStripView, type MenuItem } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

const DEFAULT_ITEMS: MenuItem[] = [
  { text: '파일', children: [{ text: '새로 만들기' }, { text: '열기' }, { text: '저장' }, { text: '', separator: true }, { text: '끝내기' }] },
  { text: '편집', children: [{ text: '실행 취소' }, { text: '다시 실행' }, { text: '', separator: true }, { text: '잘라내기' }, { text: '복사' }, { text: '붙여넣기' }] },
  { text: '보기' },
  { text: '도움말' },
];

export function MenuStripControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as MenuItem[]) ?? [];
  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <MenuStripView
      items={displayItems}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
