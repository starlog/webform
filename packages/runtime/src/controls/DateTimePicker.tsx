import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface DateTimePickerProps {
  id: string;
  name: string;
  value?: string;
  format?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function DateTimePicker({
  id,
  value = '',
  backColor,
  foreColor,
  style,
  enabled = true,
  onValueChanged,
}: DateTimePickerProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('DateTimePicker', { backColor, foreColor });

  const baseStyle: CSSProperties = {
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    backgroundColor: colors.backgroundColor,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: colors.color,
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateControlState(id, 'value', e.target.value);
    onValueChanged?.();
  };

  return (
    <input
      type="date"
      className="wf-datetimepicker"
      data-control-id={id}
      value={value}
      disabled={!enabled}
      onChange={handleChange}
      style={{ ...baseStyle, ...style }}
    />
  );
}
