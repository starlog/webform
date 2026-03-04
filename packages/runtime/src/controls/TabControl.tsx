import { Children, type CSSProperties, type ReactNode } from 'react';
import { TabHeaderView } from '@webform/common/views';
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
  id, selectedIndex = 0, tabs, tabPages, childTabIds,
  backColor, foreColor, style, enabled = true,
  onSelectedIndexChanged, children,
}: TabControlProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('TabControl', { backColor, foreColor });

  const childArray = Children.toArray(children);
  const tabList = tabs ?? tabPages?.map((t) => ({ title: t })) ?? [];
  const tabCount = tabList.length || childArray.length;

  const tabNames = Array.from({ length: tabCount }, (_, i) =>
    getTabName(i, tabs, tabPages, childArray[i]),
  );

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
      <TabHeaderView
        tabNames={tabNames}
        selectedIndex={selectedIndex}
        interactive={enabled}
        onTabClick={handleTabClick}
        style={{ zIndex: 1 }}
      />
      <div style={{
        flex: 1,
        position: 'relative',
        border: theme.controls.tabControl.contentBorder,
        borderTop: 'none',
        overflow: 'hidden',
      }}>
        {visibleChildren}
      </div>
    </div>
  );
}
