import type { CSSProperties, ReactNode } from 'react';
import { CheckBoxView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface CheckBoxProps {
  id: string;
  name: string;
  text?: string;
  checked?: boolean;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function CheckBox({
  id, text, checked = false, backColor, foreColor, style,
  enabled = true, onCheckedChanged,
}: CheckBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = () => {
    if (!enabled) return;
    updateControlState(id, 'checked', !checked);
    onCheckedChanged?.();
  };

  return (
    <CheckBoxView
      text={text}
      checked={checked}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-checkbox"
      data-control-id={id}
      style={style}
    />
  );
}
