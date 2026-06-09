import { useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, Ref } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';
import type { ThemeTokens } from '../../types/theme.js';

export interface MenuItem {
  text: string;
  shortcut?: string;
  children?: MenuItem[];
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  formId?: string;
  hasScript?: boolean;
}

export interface MenuStripViewProps {
  items?: MenuItem[];
  /** 현재 열려 있는 최상위 메뉴 인덱스 (없으면 null) */
  openMenuIndex?: number | null;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  interactive?: boolean;
  disabled?: boolean;
  onTopLevelClick?: (index: number) => void;
  onTopLevelHover?: (index: number) => void;
  /** 드롭다운/서브메뉴 아이템 클릭. path는 최상위 인덱스를 제외한 하위 경로 */
  onMenuItemClick?: (item: MenuItem, path: number[], topIndex: number) => void;
  rootRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

/** DOM lib 없이 hover 배경색을 조작하기 위한 최소 타입 */
type HoverTarget = { style: { backgroundColor: string } };

function MenuPanel({
  items,
  submenu,
  enabled,
  onItemClick,
  theme,
}: {
  items: MenuItem[];
  /** true이면 우측 전개 서브메뉴 포지셔닝 */
  submenu: boolean;
  enabled: boolean;
  onItemClick: (item: MenuItem, path: number[]) => void;
  theme: ThemeTokens;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        position: 'absolute',
        ...(submenu ? { top: 0, left: '100%' } : { top: '100%', left: 0 }),
        backgroundColor: theme.controls.menuStrip.background,
        color: theme.controls.menuStrip.foreground,
        border: theme.popup.border,
        boxShadow: theme.popup.shadow,
        borderRadius: theme.popup.borderRadius,
        zIndex: submenu ? 1001 : 1000,
        minWidth: submenu ? 160 : 180,
        padding: '2px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={i}
              style={{ height: 1, backgroundColor: theme.controls.menuStrip.border, margin: '2px 0' }}
            />
          );
        }

        const isDisabled = item.enabled === false || !enabled;
        const hasChildren = item.children && item.children.length > 0;
        const isHovered = hoverIndex === i;

        return (
          <div
            key={i}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div
              onClick={() => {
                if (isDisabled || hasChildren) return;
                onItemClick(item, [i]);
              }}
              style={{
                padding: '4px 30px 4px 28px',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                whiteSpace: 'nowrap',
                backgroundColor: isHovered && !isDisabled ? theme.controls.menuStrip.hoverBackground : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 8,
                    width: 16,
                    textAlign: 'center',
                  }}
                >
                  {item.checked ? '✓' : ''}
                </span>
                <span>{item.text}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
                {item.shortcut && (
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>{item.shortcut}</span>
                )}
                {hasChildren && <span style={{ fontSize: '10px' }}>&#9654;</span>}
              </div>
            </div>

            {hasChildren && isHovered && (
              <MenuPanel
                items={item.children!}
                submenu
                enabled={enabled && !isDisabled}
                onItemClick={(subItem, subPath) => onItemClick(subItem, [i, ...subPath])}
                theme={theme}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MenuStripView({
  items = [],
  openMenuIndex = null,
  backColor,
  foreColor,
  font,
  interactive = false,
  disabled = false,
  onTopLevelClick,
  onTopLevelHover,
  onMenuItemClick,
  rootRef,
  style,
  className,
  'data-control-id': dataControlId,
}: MenuStripViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('MenuStrip', { backColor, foreColor });
  const clickable = interactive && !disabled;

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderBottom: theme.controls.menuStrip.border,
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: clickable ? 'visible' : 'hidden',
    position: 'relative',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const setHoverBg = (e: ReactMouseEvent, color: string) => {
    (e.currentTarget as unknown as HoverTarget).style.backgroundColor = color;
  };

  return (
    <div ref={rootRef} className={className} data-control-id={dataControlId} style={rootStyle}>
      {items.map((item, i) => {
        const isOpen = openMenuIndex === i;
        const hasChildren = item.children && item.children.length > 0;

        return (
          <div key={i} style={{ position: 'relative' }}>
            <div
              onClick={clickable ? () => onTopLevelClick?.(i) : undefined}
              onMouseEnter={clickable ? () => onTopLevelHover?.(i) : undefined}
              style={{
                padding: '2px 8px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                cursor: clickable ? 'pointer' : 'default',
                backgroundColor: isOpen ? theme.controls.menuStrip.activeBackground : undefined,
              }}
              onMouseOver={(e) => {
                if (!isOpen && clickable) setHoverBg(e, theme.controls.menuStrip.hoverBackground);
              }}
              onMouseOut={(e) => {
                if (!isOpen) setHoverBg(e, '');
              }}
            >
              {item.text}
            </div>

            {isOpen && hasChildren && (
              <MenuPanel
                items={item.children!}
                submenu={false}
                enabled={clickable}
                onItemClick={(subItem, path) => onMenuItemClick?.(subItem, path, i)}
                theme={theme}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
