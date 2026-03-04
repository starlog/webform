import type { CSSProperties, ReactNode } from 'react';
import { RadioButtonView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  id, text, checked = false, groupName = 'default',
  backColor, foreColor, style, enabled = true, onCheckedChanged,
}: RadioButtonProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const controlStates = useRuntimeStore((s) => s.controlStates);

  const handleChange = () => {
    if (!enabled) return;
    for (const [ctrlId, state] of Object.entries(controlStates)) {
      if (state.groupName === groupName && state.checked === true) {
        updateControlState(ctrlId, 'checked', false);
      }
    }
    updateControlState(id, 'checked', true);
    onCheckedChanged?.();
  };

  return (
    <RadioButtonView
      text={text}
      checked={checked}
      groupName={groupName}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-radiobutton"
      data-control-id={id}
      style={style}
    />
  );
}
