import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';

interface ComboBoxProps {
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

export function ComboBox({
  id,
  items = [],
  selectedIndex = -1,
  style,
  enabled = true,
  onSelectedIndexChanged,
}: ComboBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();

  const baseStyle: CSSProperties = {
    backgroundColor: theme.controls.select.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    color: theme.controls.select.foreground,
    padding: '2px 4px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = e.target.selectedIndex;
    updateControlState(id, 'selectedIndex', newIndex);
    onSelectedIndexChanged?.();
  };

  return (
    <select
      className="wf-combobox"
      data-control-id={id}
      style={{ ...baseStyle, ...style }}
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
