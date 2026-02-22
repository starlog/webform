import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface CheckBoxProps {
  id: string;
  name: string;
  text?: string;
  checked?: boolean;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  boxSizing: 'border-box',
  userSelect: 'none',
  cursor: 'pointer',
};

export function CheckBox({
  id,
  text,
  checked = false,
  style,
  enabled = true,
  onCheckedChanged,
}: CheckBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = () => {
    if (!enabled) return;
    updateControlState(id, 'checked', !checked);
    onCheckedChanged?.();
  };

  return (
    <label
      className="wf-checkbox"
      data-control-id={id}
      style={{ ...baseStyle, ...style, cursor: enabled ? 'pointer' : 'default' }}
      onClick={handleChange}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!enabled}
        onChange={() => {}}
        style={{ margin: 0, width: 16, height: 16 }}
      />
      {text}
    </label>
  );
}
