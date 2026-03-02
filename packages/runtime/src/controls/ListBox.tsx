import type { CSSProperties, ReactNode } from 'react';
import { listBoxBaseStyle, listBoxItemStyle } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface ListBoxProps {
  id: string;
  name: string;
  items?: string[];
  selectedIndex?: number;
  backColor?: string;
  foreColor?: string;
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
  backColor,
  foreColor,
  style,
  enabled = true,
  onSelectedIndexChanged,
}: ListBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('ListBox', { backColor, foreColor });

  const handleClick = (index: number) => {
    if (!enabled) return;
    updateControlState(id, 'selectedIndex', index);
    onSelectedIndexChanged?.();
  };

  return (
    <div
      className="wf-listbox"
      data-control-id={id}
      style={{ ...listBoxBaseStyle(theme, colors), ...style, opacity: enabled ? 1 : 0.6 }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            ...listBoxItemStyle(theme, i === selectedIndex),
            cursor: enabled ? 'pointer' : 'default',
          }}
          onClick={() => handleClick(i)}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
