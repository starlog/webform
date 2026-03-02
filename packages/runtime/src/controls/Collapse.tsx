import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { useRuntimeStore } from '../stores/runtimeStore';

interface CollapsePanel {
  title: string;
  key: string;
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
  id,
  panels = [
    { title: 'Panel 1', key: '1' },
    { title: 'Panel 2', key: '2' },
  ],
  activeKeys = '1',
  accordion = false,
  bordered = true,
  expandIconPosition = 'Start',
  backColor,
  foreColor,
  style,
  enabled = true,
  onActiveKeyChanged,
  children,
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
    let newKeys: string[];
    if (accordion) {
      newKeys = activeKeySet.has(key) ? [] : [key];
    } else {
      newKeys = activeKeySet.has(key)
        ? activeKeyArray.filter((k) => k !== key)
        : [...activeKeyArray, key];
    }
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
    overflow: 'auto',
    ...style,
  };

  const icon = (isActive: boolean) => (
    <span
      style={{
        fontSize: '0.7em',
        transition: 'transform 0.3s',
        display: 'inline-block',
        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      ▶
    </span>
  );

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
        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && index < panels.length - 1 ? theme.controls.panel.border : 'none',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(0,0,0,0.02)',
                cursor: enabled ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                userSelect: 'none',
              }}
              onClick={() => handleToggle(panel.key)}
            >
              {expandIconPosition === 'Start' && icon(isActive)}
              <span style={{ flex: 1 }}>{panel.title}</span>
              {expandIconPosition === 'End' && icon(isActive)}
            </div>
            <div
              style={{
                overflow: 'hidden',
                maxHeight: isActive ? '9999px' : '0px',
                transition: 'max-height 0.3s ease',
              }}
            >
              <div className="wf-collapse-panel-content" style={{ padding: '8px 12px', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                {childArray[index]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
