import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface RadioButtonProps {
  id: string;
  name: string;
  text?: string;
  checked?: boolean;
  groupName?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  boxSizing: 'border-box',
  userSelect: 'none',
  cursor: 'pointer',
};

export function RadioButton({
  id,
  text,
  checked = false,
  groupName = 'default',
  style,
  enabled = true,
  onCheckedChanged,
}: RadioButtonProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const controlStates = useRuntimeStore((s) => s.controlStates);

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
      style={{ ...baseStyle, ...style, cursor: enabled ? 'pointer' : 'default' }}
      onClick={handleChange}
    >
      <input
        type="radio"
        name={groupName}
        checked={checked}
        disabled={!enabled}
        onChange={() => {}}
        style={{ margin: 0, width: 16, height: 16 }}
      />
      {text}
    </label>
  );
}
