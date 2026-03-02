import {
  switchTrackStyle,
  switchThumbStyle,
  switchTrackTextStyle,
  switchContainerStyle,
} from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function SwitchControl({ properties, size }: DesignerControlProps) {
  const checked = (properties.checked as boolean) ?? false;
  const text = (properties.text as string) ?? '';
  const onText = (properties.onText as string) ?? '';
  const offText = (properties.offText as string) ?? '';
  const onColor = (properties.onColor as string) || undefined;
  const offColor = (properties.offColor as string) || undefined;
  const colors = useControlColors('Switch', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const displayText = checked ? onText : offText;

  return (
    <div
      style={{
        ...switchContainerStyle(colors),
        width: size.width,
        height: size.height,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
      }}
    >
      {text && (
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{text}</span>
      )}
      <div style={switchTrackStyle({ checked, onColor, offColor })}>
        {displayText && <span style={switchTrackTextStyle(checked)}>{displayText}</span>}
        <div style={switchThumbStyle(checked)} />
      </div>
    </div>
  );
}
