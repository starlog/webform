import { Children, type CSSProperties, type ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

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
  childTabIds?: string[];
  backColor?: string;
  foreColor?: string;
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
  childTabIds,
  backColor,
  foreColor,
  style,
  enabled = true,
  onSelectedIndexChanged,
  children,
}: TabControlProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('TabControl', { backColor, foreColor });
  const { tabHeaderStyle, tabButtonBase, tabButtonActive, contentBorder } = useTabStyles();

  const childArray = Children.toArray(children);

  // Use tabs property as authoritative tab list
  const tabList = tabs ?? tabPages?.map((t) => ({ title: t })) ?? [];
  const tabCount = tabList.length || childArray.length;

  // Group children by tabId when childTabIds mapping is available
  const selectedTabId = tabs?.[selectedIndex]?.id;
  const visibleChildren =
    childTabIds && selectedTabId
      ? childArray.filter((_, i) => childTabIds[i] === selectedTabId)
      : [childArray[selectedIndex]];

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
        background: colors.background,
        color: colors.color,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Tab header */}
      <div style={{ ...tabHeaderStyle, flexShrink: 0, zIndex: 1 }}>
        {Array.from({ length: tabCount }, (_, i) => (
          <button
            key={tabs?.[i]?.id ?? i}
            style={i === selectedIndex ? tabButtonActive : tabButtonBase}
            onClick={() => handleTabClick(i)}
            disabled={!enabled}
          >
            {getTabName(i, tabs, tabPages, childArray[i])}
          </button>
        ))}
      </div>
      {/* Content area — children positioned relative to this container */}
      <div style={{
        flex: 1,
        position: 'relative',
        border: contentBorder,
        borderTop: 'none',
        overflow: 'hidden',
      }}>
        {visibleChildren}
      </div>
    </div>
  );
}
