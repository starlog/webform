import type { CSSProperties, ReactNode } from 'react';
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

  const trackBg = checked ? onColor || '#1677ff' : offColor || 'rgba(0,0,0,0.25)';

  const trackStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: 44,
    height: 22,
    borderRadius: 11,
    backgroundColor: trackBg,
    cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  };

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: checked ? 24 : 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  };

  const trackTextStyle: CSSProperties = {
    fontSize: '0.65em',
    color: '#fff',
    userSelect: 'none',
    position: 'absolute',
    left: checked ? 6 : undefined,
    right: checked ? undefined : 6,
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    color: colors.color,
    opacity: enabled ? 1 : 0.5,
    ...style,
  };

  const displayText = checked ? onText : offText;

  return (
    <div className="wf-switch" data-control-id={id} style={containerStyle}>
      {text && (
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{text}</span>
      )}
      <div style={trackStyle} onClick={handleToggle}>
        {displayText && <span style={trackTextStyle}>{displayText}</span>}
        <div style={thumbStyle} />
      </div>
    </div>
  );
}
