import type { CSSProperties, ReactNode } from 'react';
import { ComboBoxView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface ComboBoxProps {
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

export function ComboBox({
  id, items = [], selectedIndex = -1, backColor, foreColor, style,
  enabled = true, onSelectedIndexChanged,
}: ComboBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = e.target.selectedIndex;
    updateControlState(id, 'selectedIndex', newIndex);
    onSelectedIndexChanged?.();
  };

  return (
    <ComboBoxView
      items={items}
      selectedIndex={selectedIndex}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-combobox"
      data-control-id={id}
      style={style}
    />
  );
}
