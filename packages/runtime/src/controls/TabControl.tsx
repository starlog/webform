import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';

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

function useTabStyles() {
  const theme = useTheme();

  const tabHeaderStyle: CSSProperties = {
    display: 'flex',
    borderBottom: theme.controls.tabControl.tabBorder,
    backgroundColor: theme.controls.tabControl.contentBackground,
  };

  const tabButtonBase: CSSProperties = {
    padding: '4px 12px',
    border: theme.controls.tabControl.tabBorder,
    borderBottom: 'none',
    borderRadius: `${theme.controls.tabControl.tabBorderRadius} ${theme.controls.tabControl.tabBorderRadius} 0 0`,
    backgroundColor: theme.controls.tabControl.tabBackground,
    color: theme.controls.tabControl.tabForeground,
    cursor: 'pointer',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    marginRight: '-1px',
  };

  const tabButtonActive: CSSProperties = {
    ...tabButtonBase,
    backgroundColor: theme.controls.tabControl.tabActiveBackground,
    color: theme.controls.tabControl.tabActiveForeground,
    borderBottom: `1px solid ${theme.controls.tabControl.tabActiveBackground}`,
    marginBottom: '-1px',
    fontWeight: 'bold',
  };

  const contentBorder = theme.controls.tabControl.contentBorder;

  return { tabHeaderStyle, tabButtonBase, tabButtonActive, contentBorder };
}

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
  const { tabHeaderStyle, tabButtonBase, tabButtonActive, contentBorder } = useTabStyles();

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
          border: contentBorder,
          borderTop: 'none',
          overflow: 'hidden',
        }} />
      </div>
      {/* Children positioned relative to TabControl top-left (matching Designer coordinates) */}
      {childArray[selectedIndex] ?? null}
    </div>
  );
}
