import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface StatusStripItem {
  type: 'label' | 'progressBar' | 'dropDownButton';
  text?: string;
  spring?: boolean;
  width?: number;
  value?: number;
}

interface StatusStripProps {
  id: string;
  name: string;
  items?: StatusStripItem[];
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  onItemClicked?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function StatusStrip({
  id,
  items = [],
  style,
  enabled = true,
  backColor,
  foreColor,
  font,
  onItemClicked,
}: StatusStripProps) {
  const theme = useTheme();
  const colors = useControlColors('StatusStrip', { backColor, foreColor });
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleItemClick = useCallback(
    (item: StatusStripItem, index: number) => {
      if (!enabled) return;
      updateControlState(id, 'clickedItem', { ...item, index });
      onItemClicked?.();
    },
    [id, enabled, updateControlState, onItemClicked],
  );

  const mergedStyle: CSSProperties = {
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
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  return (
    <div className="wf-statusstrip" data-control-id={id} style={mergedStyle}>
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
                cursor: enabled ? 'pointer' : 'default',
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
                cursor: enabled ? 'pointer' : 'default',
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
              cursor: enabled ? 'pointer' : 'default',
            }}
          >
            {item.text ?? ''}
          </div>
        );
      })}
    </div>
  );
}
