import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface ToolStripItem {
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text?: string;
  tooltip?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;
  items?: ToolStripItem[];
}

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
  const theme = useTheme();
  const items = (properties.items as ToolStripItem[]) ?? [];
  const backColor = theme.controls.toolStrip.background;

  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: theme.controls.toolStrip.foreground,
        borderBottom: theme.controls.toolStrip.border,
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        paddingLeft: 2,
        paddingRight: 2,
      }}
    >
      {displayItems.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={i}
              style={{
                width: 1,
                height: 16,
                backgroundColor: theme.controls.toolStrip.separator,
                margin: '0 3px',
              }}
            />
          );
        }

        const isDisabled = item.enabled === false;
        const isDropdown = item.type === 'dropdown';

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '1px 4px',
              borderRadius: 2,
              opacity: isDisabled ? 0.5 : 1,
              whiteSpace: 'nowrap',
              ...(item.checked ? { backgroundColor: theme.accent.primary, border: `1px solid ${theme.accent.primaryHover}` } : {}),
            }}
          >
            {item.icon && <span style={{ fontSize: '12px' }}>{item.icon}</span>}
            {item.text && <span>{item.text}</span>}
            {isDropdown && <span style={{ fontSize: '8px', marginLeft: 1 }}>&#9660;</span>}
          </div>
        );
      })}
    </div>
  );
}
