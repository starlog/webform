import { useState, type CSSProperties, type ReactNode } from 'react';
import { CollapseHeaderView } from '@webform/common/views';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { useRuntimeStore } from '../stores/runtimeStore';

interface CollapsePanel {
  title: string;
  key: string;
  panelHeight?: number;
}

interface CollapseProps {
  id: string;
  name: string;
  panels?: CollapsePanel[];
  activeKeys?: string;
  accordion?: boolean;
  bordered?: boolean;
  expandIconPosition?: 'Start' | 'End';
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onActiveKeyChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Collapse({
  id, panels = [
    { title: 'Panel 1', key: '1' },
    { title: 'Panel 2', key: '2' },
  ],
  activeKeys = '1', accordion: _accordion = false, bordered = true,
  expandIconPosition = 'Start', backColor, foreColor, style,
  enabled = true, onActiveKeyChanged, children,
}: CollapseProps) {
  const theme = useTheme();
  const colors = useControlColors('Collapse', { backColor, foreColor });
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const [activeKeyArray, setActiveKeyArray] = useState<string[]>(() => {
    if (!activeKeys) return [];
    const str = Array.isArray(activeKeys) ? activeKeys.join(',') : activeKeys;
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  });

  const activeKeySet = new Set(activeKeyArray);
  const childArray = Array.isArray(children) ? children : children ? [children] : [];

  const handleToggle = (key: string) => {
    if (!enabled) return;
    const newKeys: string[] = activeKeySet.has(key) ? [] : [key];
    setActiveKeyArray(newKeys);
    updateControlState(id, 'activeKeys', newKeys.join(','));
    onActiveKeyChanged?.();
  };

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    background: colors.background,
    color: colors.color,
    border: bordered ? theme.controls.panel.border : 'none',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...style,
  };

  return (
    <div className="wf-collapse" data-control-id={id} style={containerStyle}>
      <style>{`.wf-collapse-panel-content > * {
        position: static !important;
        left: auto !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        white-space: normal !important;
        overflow-wrap: break-word !important;
        text-overflow: clip !important;
      }`}</style>
      {panels.map((panel, index) => {
        const isActive = activeKeySet.has(panel.key);
        const hasPanelHeight = panel.panelHeight && panel.panelHeight > 0;
        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && index < panels.length - 1 ? theme.controls.panel.border : 'none',
              ...(isActive && !hasPanelHeight ? { flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 } : {}),
            }}
          >
            <CollapseHeaderView
              title={panel.title}
              isActive={isActive}
              expandIconPosition={expandIconPosition}
              interactive={enabled}
              onClick={() => handleToggle(panel.key)}
            />
            {isActive && (
              <div
                style={{
                  overflow: 'auto',
                  ...(hasPanelHeight
                    ? { height: panel.panelHeight }
                    : { flex: 1, minHeight: 0 }),
                }}
              >
                <div
                  className="wf-collapse-panel-content"
                  style={{
                    padding: '8px 12px',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {index === 0 ? childArray : null}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
