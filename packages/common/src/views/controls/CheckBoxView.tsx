import type { CSSProperties } from 'react';
import {
  checkRadioBaseStyle,
  checkRadioInputStyle,
  checkRadioTextStyle,
} from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface CheckBoxViewProps {
  text?: string;
  checked?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: () => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function CheckBoxView({
  text = 'CheckBox',
  checked = false,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: CheckBoxViewProps) {
  const colors = useViewControlColors('CheckBox', { backColor, foreColor });

  return (
    <label
      className={className}
      data-control-id={dataControlId}
      style={{
        ...checkRadioBaseStyle(colors),
        fontSize: 'inherit',
        fontFamily: 'inherit',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly={!interactive}
        disabled={disabled}
        onChange={interactive ? onChange : undefined}
        style={checkRadioInputStyle}
      />
      <span style={checkRadioTextStyle}>{text}</span>
    </label>
  );
}
