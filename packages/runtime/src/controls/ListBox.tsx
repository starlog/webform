import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

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

const baseStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px inset #D0D0D0',
  overflow: 'auto',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  boxSizing: 'border-box',
};

export function ListBox({
  id,
  items = [],
  selectedIndex = -1,
  style,
  enabled = true,
  onSelectedIndexChanged,
}: ListBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

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
            backgroundColor: i === selectedIndex ? '#0078D7' : 'transparent',
            color: i === selectedIndex ? '#FFFFFF' : '#000000',
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
