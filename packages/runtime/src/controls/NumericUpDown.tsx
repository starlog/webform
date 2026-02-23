import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface NumericUpDownProps {
  id: string;
  name: string;
  value?: number;
  minimum?: number;
  maximum?: number;
  increment?: number;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px inset #A0A0A0',
  padding: '2px 4px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  boxSizing: 'border-box',
};

export function NumericUpDown({
  id,
  value = 0,
  minimum = 0,
  maximum = 100,
  increment = 1,
  style,
  enabled = true,
  onValueChanged,
}: NumericUpDownProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) newValue = minimum;
    if (newValue < minimum) newValue = minimum;
    if (newValue > maximum) newValue = maximum;
    updateControlState(id, 'value', newValue);
    onValueChanged?.();
  };

  return (
    <input
      type="number"
      className="wf-numericupdown"
      data-control-id={id}
      style={{ ...baseStyle, ...style }}
      disabled={!enabled}
      value={value}
      min={minimum}
      max={maximum}
      step={increment}
      onChange={handleChange}
    />
  );
}
