import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface MenuItem {
  text: string;
  shortcut?: string;
  children?: MenuItem[];
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  formId?: string;
}

const DEFAULT_ITEMS: MenuItem[] = [
  { text: '파일', children: [{ text: '새로 만들기' }, { text: '열기' }, { text: '저장' }, { text: '', separator: true }, { text: '끝내기' }] },
  { text: '편집', children: [{ text: '실행 취소' }, { text: '다시 실행' }, { text: '', separator: true }, { text: '잘라내기' }, { text: '복사' }, { text: '붙여넣기' }] },
  { text: '보기' },
  { text: '도움말' },
];

export function MenuStripControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as MenuItem[]) ?? [];
  const backColor = (properties.backColor as string) ?? theme.controls.menuStrip.background;
  const foreColor = (properties.foreColor as string) ?? theme.controls.menuStrip.foreground;

  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: foreColor,
        borderBottom: theme.controls.menuStrip.border,
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
