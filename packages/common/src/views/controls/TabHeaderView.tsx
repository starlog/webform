import type { CSSProperties } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';

export interface TabHeaderViewProps {
  tabNames: string[];
  selectedIndex: number;
  interactive?: boolean;
  onTabClick?: (index: number) => void;
  style?: CSSProperties;
}

export function TabHeaderView({
  tabNames,
  selectedIndex,
  interactive = false,
  onTabClick,
  style,
}: TabHeaderViewProps) {
  const theme = useSharedTheme();

  const tabButtonBase: CSSProperties = {
    padding: '4px 12px',
    border: theme.controls.tabControl.tabBorder,
    borderBottom: 'none',
    borderRadius: `${theme.controls.tabControl.tabBorderRadius} ${theme.controls.tabControl.tabBorderRadius} 0 0`,
    backgroundColor: theme.controls.tabControl.tabBackground,
    color: theme.controls.tabControl.tabForeground,
    cursor: interactive ? 'pointer' : 'default',
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

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: theme.controls.tabControl.tabBorder,
        backgroundColor: theme.controls.tabControl.contentBackground,
        flexShrink: 0,
        ...style,
      }}
    >
      {tabNames.map((name, i) => (
        <button
          key={i}
          style={i === selectedIndex ? tabButtonActive : tabButtonBase}
          onMouseDown={interactive ? (e) => e.stopPropagation() : undefined}
          onClick={
            interactive && onTabClick
              ? (e) => {
                  e.stopPropagation();
                  onTabClick(i);
                }
              : undefined
          }
        >
          {name}
        </button>
      ))}
    </div>
  );
}
