import type { CSSProperties, ReactNode } from 'react';
import { SwitchView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface SwitchProps {
  id: string;
  name: string;
  checked?: boolean;
  text?: string;
  onText?: string;
  offText?: string;
  onColor?: string;
  offColor?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Switch({
  id, checked = false, text, onText, offText, onColor, offColor,
  backColor, foreColor, style, enabled = true, onCheckedChanged,
}: SwitchProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleToggle = () => {
    if (!enabled) return;
    updateControlState(id, 'checked', !checked);
    onCheckedChanged?.();
  };

  return (
    <SwitchView
      checked={checked}
      text={text}
      onText={onText}
      offText={offText}
      onColor={onColor}
      offColor={offColor}
      interactive={enabled}
      disabled={!enabled}
      onToggle={handleToggle}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-switch"
      data-control-id={id}
      style={style}
    />
  );
}
