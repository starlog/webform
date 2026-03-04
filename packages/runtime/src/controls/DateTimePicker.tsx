import type { CSSProperties, ReactNode } from 'react';
import { DateTimePickerView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  id, value = '', backColor, foreColor, style,
  enabled = true, onValueChanged,
}: DateTimePickerProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateControlState(id, 'value', e.target.value);
    onValueChanged?.();
  };

  return (
    <DateTimePickerView
      value={value}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-datetimepicker"
      data-control-id={id}
      style={style}
    />
  );
}
