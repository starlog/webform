import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface DateTimePickerProps {
  id: string;
  name: string;
  value?: string;
  format?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  border: '1px solid #ADB2B5',
  padding: '2px 4px',
};

export function DateTimePicker({
  id,
  value = '',
  style,
  enabled = true,
  onValueChanged,
}: DateTimePickerProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

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
