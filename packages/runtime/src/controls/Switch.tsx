import type { CSSProperties, ReactNode } from 'react';
import {
  switchTrackStyle,
  switchThumbStyle,
  switchTrackTextStyle,
  switchContainerStyle,
} from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

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
  id,
  checked = false,
  text,
  onText,
  offText,
  onColor,
  offColor,
  backColor,
  foreColor,
  style,
  enabled = true,
  onCheckedChanged,
}: SwitchProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('Switch', { backColor, foreColor });

  const handleToggle = () => {
    if (!enabled) return;
    updateControlState(id, 'checked', !checked);
    onCheckedChanged?.();
  };

  const trackStyle: CSSProperties = {
    ...switchTrackStyle({ checked, onColor, offColor }),
    cursor: enabled ? 'pointer' : 'not-allowed',
  };

  const displayText = checked ? onText : offText;

  return (
    <div
      className="wf-switch"
      data-control-id={id}
      style={{
        ...switchContainerStyle(colors),
        opacity: enabled ? 1 : 0.5,
        ...style,
      }}
    >
      {text && (
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{text}</span>
      )}
      <div style={trackStyle} onClick={handleToggle}>
        {displayText && <span style={switchTrackTextStyle(checked)}>{displayText}</span>}
        <div style={switchThumbStyle(checked)} />
      </div>
    </div>
  );
}
