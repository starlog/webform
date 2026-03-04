import type { CSSProperties, ReactNode } from 'react';
import { NumericUpDownView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface NumericUpDownProps {
  id: string;
  name: string;
  value?: number;
  minimum?: number;
  maximum?: number;
  increment?: number;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function NumericUpDown({
  id, value = 0, minimum = 0, maximum = 100, increment = 1,
  backColor, foreColor, style, enabled = true, onValueChanged,
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
    <NumericUpDownView
      value={value}
      minimum={minimum}
      maximum={maximum}
      increment={increment}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-numericupdown"
      data-control-id={id}
      style={style}
    />
  );
}
