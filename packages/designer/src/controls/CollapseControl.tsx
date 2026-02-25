import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface CollapsePanel {
  title: string;
  key: string;
}

export function CollapseControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();

  const panels = (properties.panels as CollapsePanel[]) ?? [
    { title: 'Panel 1', key: '1' },
    { title: 'Panel 2', key: '2' },
  ];
  const activeKeysStr = (properties.activeKeys as string) ?? '1';
  const bordered = (properties.bordered as boolean) ?? true;
  const expandIconPosition = (properties.expandIconPosition as string) ?? 'Start';

  const activeKeys = activeKeysStr.split(',').map((k) => k.trim());

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: bordered ? `1px solid ${theme.controls.panel.border}` : 'none',
        borderRadius: bordered ? 4 : 0,
        boxSizing: 'border-box',
        overflow: 'auto',
        backgroundColor: theme.form.backgroundColor,
        color: theme.form.foreground,
      }}
    >
      {panels.map((panel, i) => {
        const isActive = activeKeys.includes(panel.key);
        const icon = isActive ? '▼' : '▶';

        return (
          <div key={panel.key}>
            {/* 패널 간 border */}
            {bordered && i > 0 && (
              <div style={{ borderTop: `1px solid ${theme.controls.panel.border}` }} />
            )}
            {/* 헤더 */}
            <div
              style={{
                background: 'rgba(0,0,0,0.02)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexDirection: expandIconPosition === 'End' ? 'row-reverse' : 'row',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontWeight: 500 }}>{panel.title}</span>
            </div>
            {/* 바디 */}
            {isActive && (
              <div
                style={{
                  padding: 16,
                  position: 'relative',
                  minHeight: 40,
                }}
              >
                {children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
