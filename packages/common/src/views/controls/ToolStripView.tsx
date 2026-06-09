import type { CSSProperties, MouseEvent as ReactMouseEvent, Ref } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ToolStripItem {
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text?: string;
  tooltip?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;
  hasScript?: boolean;
  items?: ToolStripItem[];
}

export interface ToolStripViewProps {
  items?: ToolStripItem[];
  /** 현재 열려 있는 드롭다운 아이템 인덱스 (없으면 null) */
  openDropdownIndex?: number | null;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  interactive?: boolean;
  disabled?: boolean;
  onItemClick?: (item: ToolStripItem, index: number) => void;
  onSubItemClick?: (subItem: ToolStripItem, parentIndex: number, subIndex: number) => void;
  rootRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

/** DOM lib 없이 hover 배경색을 조작하기 위한 최소 타입 */
type HoverTarget = { style: { backgroundColor: string } };

export function ToolStripView({
  items = [],
  openDropdownIndex = null,
  backColor,
  foreColor,
  font,
  interactive = false,
  disabled = false,
  onItemClick,
  onSubItemClick,
  rootRef,
  style,
  className,
  'data-control-id': dataControlId,
}: ToolStripViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('ToolStrip', { backColor, foreColor });
  const clickable = interactive && !disabled;

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderBottom: theme.controls.toolStrip.border,
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingLeft: 2,
    paddingRight: 2,
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

        const isDisabled = item.enabled === false || !clickable;
        const isDropdown = item.type === 'dropdown';
        const isOpen = openDropdownIndex === i;
        const hoverable = clickable && item.enabled !== false && !item.checked;

        return (
          <div key={i} style={{ position: 'relative' }}>
            <div
              onClick={clickable ? () => onItemClick?.(item, i) : undefined}
              title={item.tooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '1px 4px',
                borderRadius: 2,
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: item.enabled === false ? 0.5 : 1,
                whiteSpace: 'nowrap',
                ...(item.checked
                  ? { backgroundColor: theme.accent.primary, border: `1px solid ${theme.accent.primaryHover}` }
                  : {}),
              }}
              onMouseEnter={(e) => {
                if (hoverable) setHoverBg(e, theme.controls.toolStrip.buttonHoverBackground);
              }}
              onMouseLeave={(e) => {
                if (hoverable) setHoverBg(e, '');
              }}
            >
              {item.icon && <span style={{ fontSize: '12px' }}>{item.icon}</span>}
              {item.text && <span>{item.text}</span>}
              {isDropdown && <span style={{ fontSize: '8px', marginLeft: 1 }}>&#9660;</span>}
            </div>

            {isDropdown && isOpen && item.items && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: theme.controls.toolStrip.background,
                  color: theme.controls.toolStrip.foreground,
                  border: theme.popup.border,
                  boxShadow: theme.popup.shadow,
                  borderRadius: theme.popup.borderRadius,
                  zIndex: 1000,
                  minWidth: 120,
                }}
              >
                {item.items.map((sub, si) => {
                  if (sub.type === 'separator') {
                    return (
                      <div
                        key={si}
                        style={{ height: 1, backgroundColor: theme.controls.toolStrip.separator, margin: '2px 0' }}
                      />
                    );
                  }
                  const subDisabled = sub.enabled === false;
                  return (
                    <div
                      key={si}
                      onClick={clickable ? () => onSubItemClick?.(sub, i, si) : undefined}
                      style={{
                        padding: '4px 12px',
                        cursor: subDisabled ? 'default' : 'pointer',
                        opacity: subDisabled ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!subDisabled && clickable)
                          setHoverBg(e, theme.controls.toolStrip.buttonHoverBackground);
                      }}
                      onMouseLeave={(e) => {
                        if (!subDisabled && clickable) setHoverBg(e, '');
                      }}
                    >
                      {sub.checked && <span>&#10003;</span>}
                      {sub.icon && <span>{sub.icon}</span>}
                      <span>{sub.text ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
