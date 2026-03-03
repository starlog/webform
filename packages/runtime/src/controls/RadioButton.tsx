import type { CSSProperties, ReactNode } from 'react';
import { checkRadioBaseStyle, checkRadioInputStyle, checkRadioTextStyle } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

interface RadioButtonProps {
  id: string;
  name: string;
  text?: string;
  checked?: boolean;
  groupName?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function RadioButton({
  id,
  text,
  checked = false,
  groupName = 'default',
  backColor,
  foreColor,
  style,
  enabled = true,
  onCheckedChanged,
}: RadioButtonProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const controlStates = useRuntimeStore((s) => s.controlStates);
  const colors = useControlColors('RadioButton', { backColor, foreColor });

  const handleChange = () => {
    if (!enabled) return;

    // 같은 groupName을 가진 모든 RadioButton의 checked를 false로
    for (const [ctrlId, state] of Object.entries(controlStates)) {
      if (state.groupName === groupName && state.checked === true) {
        updateControlState(ctrlId, 'checked', false);
      }
    }

    // 자신의 checked를 true로
    updateControlState(id, 'checked', true);
    onCheckedChanged?.();
  };

  return (
    <label
      className="wf-radiobutton"
      data-control-id={id}
      style={{
        ...checkRadioBaseStyle(colors),
        ...style,
        cursor: enabled ? 'pointer' : 'default',
      }}
    >
      <input
        type="radio"
        name={groupName}
        checked={checked}
        disabled={!enabled}
        onChange={handleChange}
        style={checkRadioInputStyle}
      />
      <span style={checkRadioTextStyle}>
        {text}
      </span>
    </label>
  );
}
