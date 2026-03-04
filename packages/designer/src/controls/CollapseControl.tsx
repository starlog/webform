import { CollapseHeaderView } from '@webform/common/views';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { useDesignerStore } from '../stores/designerStore';
import type { DesignerControlProps } from './registry';

interface CollapsePanel {
  title: string;
  key: string;
  panelHeight?: number;
}

export function CollapseControl({ id, properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const colors = useControlColors('Collapse', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });
  const updateControl = useDesignerStore((s) => s.updateControl);

  const panels = (properties.panels as CollapsePanel[]) ?? [
    { title: 'Panel 1', key: '1' },
    { title: 'Panel 2', key: '2' },
  ];
  const rawActiveKeys = properties.activeKeys;
  const activeKeysStr = Array.isArray(rawActiveKeys)
    ? rawActiveKeys.join(',')
    : (rawActiveKeys as string) ?? '1';
  const bordered = (properties.bordered as boolean) ?? true;
  const expandIconPosition = (properties.expandIconPosition as string) ?? 'Start';

  const activeKeys = new Set(
    activeKeysStr.split(',').map((k) => k.trim()).filter(Boolean),
  );

  const handlePanelClick = (key: string) => {
    if (!id) return;
    const newActiveKeys = activeKeys.has(key) ? '' : key;
    updateControl(id, {
      properties: { ...properties, activeKeys: newActiveKeys },
    });
  };

  const HEADER_HEIGHT = 33;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: bordered ? theme.controls.panel.border : 'none',
        borderRadius: 8,
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: colors.background,
        color: colors.color,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {panels.map((panel, i) => {
        const isActive = activeKeys.has(panel.key);
        const panelHeight = panel.panelHeight && panel.panelHeight > 0 ? panel.panelHeight : undefined;

        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && i < panels.length - 1
                  ? theme.controls.panel.border
                  : 'none',
              ...(isActive && !panelHeight ? { flex: 1, display: 'flex', flexDirection: 'column' as const } : {}),
            }}
          >
            <CollapseHeaderView
              title={panel.title}
              isActive={isActive}
              expandIconPosition={expandIconPosition}
              interactive
              onClick={() => handlePanelClick(panel.key)}
            />
            {isActive && (
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: theme.controls.tabControl?.contentBackground ?? 'transparent',
                  ...(panelHeight
                    ? { height: panelHeight }
                    : { flex: 1, minHeight: HEADER_HEIGHT }),
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
