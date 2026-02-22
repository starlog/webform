import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TabControlProps {
  id: string;
  name: string;
  selectedIndex?: number;
  style?: CSSProperties;
  enabled?: boolean;
  onSelectedIndexChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const tabHeaderStyle: CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #A0A0A0',
  backgroundColor: '#F0F0F0',
};

const tabButtonBase: CSSProperties = {
  padding: '4px 12px',
  border: '1px solid #A0A0A0',
  borderBottom: 'none',
  backgroundColor: '#E8E8E8',
  cursor: 'pointer',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  marginRight: '-1px',
};

const tabButtonActive: CSSProperties = {
  ...tabButtonBase,
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #FFFFFF',
  marginBottom: '-1px',
  fontWeight: 'bold',
};

const tabContentStyle: CSSProperties = {
  position: 'relative',
  border: '1px solid #A0A0A0',
  borderTop: 'none',
  flex: 1,
  overflow: 'hidden',
};

export function TabControl({
  id,
  selectedIndex = 0,
  style,
  enabled = true,
  onSelectedIndexChanged,
  children,
}: TabControlProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  // children are tab pages rendered by ControlRenderer
  const childArray = Array.isArray(children) ? children : children ? [children] : [];

  const handleTabClick = (index: number) => {
    if (!enabled) return;
    updateControlState(id, 'selectedIndex', index);
    onSelectedIndexChanged?.();
  };

  return (
    <div
      className="wf-tabcontrol"
      data-control-id={id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={tabHeaderStyle}>
        {childArray.map((child, i) => {
          const tabName = (child as React.ReactElement)?.props?.name ?? `Tab ${i + 1}`;
          return (
            <button
              key={i}
              style={i === selectedIndex ? tabButtonActive : tabButtonBase}
              onClick={() => handleTabClick(i)}
              disabled={!enabled}
            >
              {tabName}
            </button>
          );
        })}
      </div>
      <div style={tabContentStyle}>
        {childArray[selectedIndex] ?? null}
      </div>
    </div>
  );
}
