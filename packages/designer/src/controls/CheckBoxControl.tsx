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
      width: size.width,
      height: size.height,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      color: colors.color,
      userSelect: 'none',
      boxSizing: 'border-box',
      cursor: 'default',
    }}>
      <input
        type="checkbox"
        checked={checked}
        readOnly
        style={{ margin: 0, width: 16, height: 16, pointerEvents: 'none' }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </label>
  );
}
