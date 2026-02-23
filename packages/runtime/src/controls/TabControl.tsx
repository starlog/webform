import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TabInfo {
  title: string;
  id?: string;
}

interface TabControlProps {
  id: string;
  name: string;
  selectedIndex?: number;
  tabs?: TabInfo[];
  tabPages?: string[];
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

function getTabName(
  index: number,
  tabs: TabInfo[] | undefined,
  tabPages: string[] | undefined,
  child: React.ReactNode,
): string {
  if (tabs && tabs[index]) return tabs[index].title;
  if (tabPages && tabPages[index]) return tabPages[index];
  return (child as React.ReactElement)?.props?.name ?? `Tab ${index + 1}`;
}

export function TabControl({
  id,
  selectedIndex = 0,
  tabs,
  tabPages,
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
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Visual overlay: tab headers + content border */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        <div style={{ ...tabHeaderStyle, pointerEvents: 'auto' }}>
          {childArray.map((child, i) => (
            <button
              key={i}
              style={i === selectedIndex ? tabButtonActive : tabButtonBase}
              onClick={() => handleTabClick(i)}
              disabled={!enabled}
            >
              {getTabName(i, tabs, tabPages, child)}
            </button>
          ))}
        </div>
        <div style={{
          flex: 1,
          border: '1px solid #A0A0A0',
          borderTop: 'none',
          overflow: 'hidden',
        }} />
      </div>
      {/* Children positioned relative to TabControl top-left (matching Designer coordinates) */}
      {childArray[selectedIndex] ?? null}
    </div>
  );
}
