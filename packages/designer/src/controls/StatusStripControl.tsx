import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface StatusStripItem {
  type: 'label' | 'progressBar' | 'dropDownButton';
  text?: string;
  spring?: boolean;
  width?: number;
  value?: number;
}

const DEFAULT_ITEMS: StatusStripItem[] = [
  { type: 'label', text: '준비', spring: true },
];

export function StatusStripControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as StatusStripItem[]) ?? [];
  const backColor = theme.controls.statusStrip.background;

  const displayItems = items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: theme.controls.statusStrip.foreground,
        borderTop: theme.controls.statusStrip.border,
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        paddingLeft: 4,
        paddingRight: 4,
        gap: 2,
      }}
    >
      {displayItems.map((item, i) => {
        if (item.type === 'progressBar') {
          const val = item.value ?? 0;
          return (
            <div
              key={i}
              style={{
                width: item.spring ? undefined : (item.width ?? 100),
                flexGrow: item.spring ? 1 : undefined,
                height: 14,
                backgroundColor: theme.controls.progressBar.background,
                borderRadius: 1,
                overflow: 'hidden',
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
            style={{
              flexGrow: item.spring ? 1 : undefined,
              width: item.spring ? undefined : (item.width ?? undefined),
              padding: '0 4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.text ?? ''}
          </div>
        );
      })}
    </div>
  );
}
