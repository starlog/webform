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

  const allActiveKeys = new Set(
    activeKeysStr.split(',').map((k) => k.trim()).filter(Boolean),
  );

  const designerSelectedKey = (properties._designerSelectedKey as string) ?? '';

  // 디자이너: 아코디언 — _designerSelectedKey 패널만 활성 표시
  // fallback: allActiveKeys의 첫 번째 키
  const visibleKey = designerSelectedKey && allActiveKeys.has(designerSelectedKey)
    ? designerSelectedKey
    : (allActiveKeys.size > 0 ? allActiveKeys.values().next().value : panels[0]?.key);

  const handlePanelClick = (key: string) => {
    if (!id) return;
    // 아코디언: 클릭한 패널만 활성화
    updateControl(id, {
      properties: {
        ...properties,
        activeKeys: key,
        _designerSelectedKey: key,
      },
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
        const isActive = panel.key === visibleKey;
        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && i < panels.length - 1
                  ? theme.controls.panel.border
                  : 'none',
              ...(isActive ? { flex: 1, display: 'flex', flexDirection: 'column' as const } : {}),
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
                  flex: 1,
                  minHeight: HEADER_HEIGHT,
                  outline: '2px solid #0078D7',
                  outlineOffset: -2,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
