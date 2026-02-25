import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';

interface ListBoxProps {
  id: string;
  name: string;
  items?: string[];
  selectedIndex?: number;
  style?: CSSProperties;
  enabled?: boolean;
  onSelectedIndexChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function ListBox({
  id,
  items = [],
  selectedIndex = -1,
  style,
  enabled = true,
  onSelectedIndexChanged,
}: ListBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();

  const baseStyle: CSSProperties = {
    backgroundColor: theme.controls.select.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    color: theme.controls.select.foreground,
    overflow: 'auto',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };

  const handleClick = (index: number) => {
    if (!enabled) return;
    updateControlState(id, 'selectedIndex', index);
    onSelectedIndexChanged?.();
  };

  return (
    <div
      className="wf-listbox"
      data-control-id={id}
      style={{ ...baseStyle, ...style, opacity: enabled ? 1 : 0.6 }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '1px 4px',
            backgroundColor: i === selectedIndex ? theme.controls.select.selectedBackground : 'transparent',
            color: i === selectedIndex ? theme.controls.select.selectedForeground : theme.controls.select.foreground,
            cursor: enabled ? 'pointer' : 'default',
            userSelect: 'none',
          }}
          onClick={() => handleClick(i)}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
