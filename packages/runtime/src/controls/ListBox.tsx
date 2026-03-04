import type { CSSProperties, ReactNode } from 'react';
import { ListBoxView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  id, items = [], selectedIndex = -1, backColor, foreColor, style,
  enabled = true, onSelectedIndexChanged,
}: ListBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleClick = (index: number) => {
    if (!enabled) return;
    updateControlState(id, 'selectedIndex', index);
    onSelectedIndexChanged?.();
  };

  return (
    <ListBoxView
      items={items}
      selectedIndex={selectedIndex}
      interactive={enabled}
      disabled={!enabled}
      onItemClick={handleClick}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-listbox"
      data-control-id={id}
      style={style}
    />
  );
}
