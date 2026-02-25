import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';

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
  const theme = useTheme();

  const baseStyle: CSSProperties = {
    backgroundColor: theme.controls.textInput.background,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: theme.controls.textInput.foreground,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };

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
