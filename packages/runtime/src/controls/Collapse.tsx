import { Children, useState, type CSSProperties, type ReactNode } from 'react';
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
  childCollapseKeys?: string[];
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
  enabled = true, onActiveKeyChanged, childCollapseKeys, children,
}: CollapseProps) {
  const theme = useTheme();
  const colors = useControlColors('Collapse', { backColor, foreColor });
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  // Accordion: only open the first key from activeKeys
  const [activeKeyArray, setActiveKeyArray] = useState<string[]>(() => {
    if (!activeKeys) return [];
    const str = Array.isArray(activeKeys) ? activeKeys.join(',') : activeKeys;
    const keys = str.split(',').map((s) => s.trim()).filter(Boolean);
    return keys.length > 0 ? [keys[0]] : [];
  });

  const activeKeySet = new Set(activeKeyArray);
  const childArray = Children.toArray(children);

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
      {panels.map((panel, index) => {
        const isActive = activeKeySet.has(panel.key);
        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && index < panels.length - 1 ? theme.controls.panel.border : 'none',
              ...(isActive ? { flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 } : {}),
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
                  position: 'relative',
                  overflow: 'hidden',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {childCollapseKeys
                  ? childArray.filter((_, i) => childCollapseKeys[i] === panel.key)
                  : index === 0 ? childArray : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
