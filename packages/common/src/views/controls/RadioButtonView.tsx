import type { CSSProperties } from 'react';
import {
  checkRadioBaseStyle,
  checkRadioInputStyle,
  checkRadioTextStyle,
} from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface RadioButtonViewProps {
  text?: string;
  checked?: boolean;
  groupName?: string;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: () => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function RadioButtonView({
  text = 'RadioButton',
  checked = false,
  groupName,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: RadioButtonViewProps) {
  const colors = useViewControlColors('RadioButton', { backColor, foreColor });

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
        type="radio"
        name={groupName}
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
