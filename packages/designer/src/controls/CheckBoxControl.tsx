import { checkRadioBaseStyle, checkRadioInputStyle, checkRadioTextStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function CheckBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'CheckBox';
  const checked = (properties.checked as boolean) ?? false;
  const colors = useControlColors('CheckBox', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  return (
    <label style={{
      ...checkRadioBaseStyle(colors),
      width: size.width,
      height: size.height,
      fontSize: 'inherit',
      fontFamily: 'inherit',
      cursor: 'default',
    }}>
      <input
        type="checkbox"
        checked={checked}
        readOnly
        style={checkRadioInputStyle}
      />
      <span style={checkRadioTextStyle}>
        {text}
      </span>
    </label>
  );
}
