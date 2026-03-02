import type { CSSProperties, ReactNode } from 'react';
import { checkRadioBaseStyle, checkRadioInputStyle, checkRadioTextStyle } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

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
  id,
  text,
  checked = false,
  backColor,
  foreColor,
  style,
  enabled = true,
  onCheckedChanged,
}: CheckBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('CheckBox', { backColor, foreColor });

  const handleChange = () => {
    if (!enabled) return;
    updateControlState(id, 'checked', !checked);
    onCheckedChanged?.();
  };

  return (
    <label
      className="wf-checkbox"
      data-control-id={id}
      style={{
        ...checkRadioBaseStyle(colors),
        ...style,
        cursor: enabled ? 'pointer' : 'default',
      }}
      onClick={handleChange}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!enabled}
        onChange={() => {}}
        style={checkRadioInputStyle}
      />
      <span style={checkRadioTextStyle}>
        {text}
      </span>
    </label>
  );
}
