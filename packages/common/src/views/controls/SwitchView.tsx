import type { CSSProperties } from 'react';
import {
  switchTrackStyle,
  switchThumbStyle,
  switchTrackTextStyle,
  switchContainerStyle,
} from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface SwitchViewProps {
  checked?: boolean;
  text?: string;
  onText?: string;
  offText?: string;
  onColor?: string;
  offColor?: string;
  interactive?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function SwitchView({
  checked = false,
  text,
  onText,
  offText,
  onColor,
  offColor,
  interactive = false,
  disabled,
  onToggle,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: SwitchViewProps) {
  const colors = useViewControlColors('Switch', { backColor, foreColor });
  const displayText = checked ? onText : offText;

  const trackStyle: CSSProperties = {
    ...switchTrackStyle({ checked, onColor, offColor }),
    cursor: interactive && !disabled ? 'pointer' : disabled ? 'not-allowed' : 'default',
  };

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        ...switchContainerStyle(colors),
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {text && (
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{text}</span>
      )}
      <div style={trackStyle} onClick={interactive ? onToggle : undefined}>
        {displayText && <span style={switchTrackTextStyle(checked)}>{displayText}</span>}
        <div style={switchThumbStyle(checked)} />
      </div>
    </div>
  );
}
