import type { CSSProperties } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface StatusStripItem {
  type: 'label' | 'progressBar' | 'dropDownButton';
  text?: string;
  spring?: boolean;
  width?: number;
  value?: number;
}

export interface StatusStripViewProps {
  items?: StatusStripItem[];
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  interactive?: boolean;
  disabled?: boolean;
  onItemClick?: (item: StatusStripItem, index: number) => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function StatusStripView({
  items = [],
  backColor,
  foreColor,
  font,
  interactive = false,
  disabled = false,
  onItemClick,
  style,
  className,
  'data-control-id': dataControlId,
}: StatusStripViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('StatusStrip', { backColor, foreColor });
  const clickable = interactive && !disabled;
  const itemCursor = clickable ? 'pointer' : 'default';

  const handleItemClick = (item: StatusStripItem, index: number) => {
    if (!clickable) return;
    onItemClick?.(item, index);
  };

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderTop: theme.controls.statusStrip.border,
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingLeft: 4,
    paddingRight: 4,
    gap: 2,
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  return (
    <div className={className} data-control-id={dataControlId} style={rootStyle}>
      {items.map((item, i) => {
        if (item.type === 'progressBar') {
          const val = item.value ?? 0;
          return (
            <div
              key={i}
              onClick={() => handleItemClick(item, i)}
              style={{
                width: item.spring ? undefined : (item.width ?? 100),
                flexGrow: item.spring ? 1 : undefined,
                height: 14,
                backgroundColor: theme.controls.progressBar.background,
                border: theme.controls.progressBar.border,
                borderRadius: theme.controls.progressBar.borderRadius,
                overflow: 'hidden',
                cursor: itemCursor,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, val))}%`,
                  height: '100%',
                  backgroundColor: theme.controls.progressBar.fillBackground,
                }}
              />
            </div>
          );
        }

        if (item.type === 'dropDownButton') {
          return (
            <div
              key={i}
              onClick={() => handleItemClick(item, i)}
              style={{
                flexGrow: item.spring ? 1 : undefined,
                width: item.spring ? undefined : (item.width ?? undefined),
                padding: '0 4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: itemCursor,
              }}
            >
              <span>{item.text ?? ''}</span>
              <span style={{ fontSize: '8px' }}>&#9660;</span>
            </div>
          );
        }

        // label
        return (
          <div
            key={i}
            onClick={() => handleItemClick(item, i)}
            style={{
              flexGrow: item.spring ? 1 : undefined,
              width: item.spring ? undefined : (item.width ?? undefined),
              padding: '0 4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: itemCursor,
            }}
          >
            {item.text ?? ''}
          </div>
        );
      })}
    </div>
  );
}
