import type { DesignerControlProps } from './registry';

interface MenuItem {
  text: string;
  shortcut?: string;
  children?: MenuItem[];
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
}

const DEFAULT_ITEMS: MenuItem[] = [
  { text: 'File', children: [{ text: 'New' }, { text: 'Open' }, { text: 'Save' }, { text: '', separator: true }, { text: 'Exit' }] },
  { text: 'Edit', children: [{ text: 'Undo' }, { text: 'Redo' }, { text: '', separator: true }, { text: 'Cut' }, { text: 'Copy' }, { text: 'Paste' }] },
  { text: 'View' },
  { text: 'Help' },
];

export function MenuStripControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as MenuItem[]) ?? [];
  const backColor = (properties.backColor as string) ?? '#F0F0F0';
  const foreColor = (properties.foreColor as string) ?? undefined;

  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: foreColor,
        borderBottom: '1px solid #D0D0D0',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {displayItems.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
