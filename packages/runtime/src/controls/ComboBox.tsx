import type { CSSProperties, ReactNode } from 'react';
import { comboBoxBaseStyle } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

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
  id,
  items = [],
  selectedIndex = -1,
  backColor,
  foreColor,
  style,
  enabled = true,
  onSelectedIndexChanged,
}: ComboBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('ComboBox', { backColor, foreColor });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = e.target.selectedIndex;
    updateControlState(id, 'selectedIndex', newIndex);
    onSelectedIndexChanged?.();
  };

  return (
    <select
      className="wf-combobox"
      data-control-id={id}
      style={{ ...comboBoxBaseStyle(theme, colors), ...style }}
      disabled={!enabled}
      value={selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : ''}
      onChange={handleChange}
    >
      {items.map((item, i) => (
        <option key={i} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
